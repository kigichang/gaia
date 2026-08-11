import { useCallback, useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { addGeoLayer, bindGeoLayerInteractions, removeGeoLayer } from "./layers/geo";
import { enforceThemeLayerOrder } from "./layerOrder";
import { geoHitLayerIds } from "./registry/index.ts";
import type { DetailSpec, LayerRender } from "./registry/types.ts";

export interface GeoLayerInstance {
  /** maplibre id 的前綴，例如 "places"、"species-mikado-pheasant" */
  instanceId: string;
  render: LayerRender;
  color: string;
  minzoom?: number;
  maxzoom?: number;
  /** 尚未載入完成時傳 null——hook 先略過，資料到齊後 instances 改變會自動補上 */
  data: GeoJSON.FeatureCollection | null;
  detail: DetailSpec;
}

/**
 * 主題圖層管理。
 *
 * ## 關鍵坑（沿用自舊的 useThematicLayers）
 *
 * `MapView` 切底圖時呼叫 `map.setStyle()`，會清空所有自訂 source/layer，然後在
 * `style.load` 重新加回 contour/hillshade。**主題圖層不是 MapView 加的，
 * MapView 不知道要重新套用它們**——所以需要下面「切底圖之後是誰負責重套」那一節
 * 描述的回呼機制。
 *
 * ## 為什麼互動綁定與圖層套用要分成不同的 effect
 *
 * CLAUDE.md 禁止合併的那兩個 effect，本質是兩條不變量：
 * **互動不得在 style.load 時重綁**（`map.on(event, layerId, handler)` 是掛在 Map
 * 實例上而不是圖層上，重綁只會讓監聽無限累積），以及 **instance 消失時必須解綁**。
 *
 * 舊版是「靜態兩層綁一次 + 特有種用 ref Map 追蹤」。泛化成 N 個動態圖層之後，
 * **每一層都變成動態的情形**，所以把特有種那套 ref Map 升格成唯一模式，
 * 並把互動 effect 的依賴改成 instanceId 集合的字串 key——這樣「資料剛載入完成」
 * （instances 內容變了但 id 集合沒變）不會觸發重綁。
 *
 * ## 切底圖之後是誰負責重套
 *
 * 回傳的 `reapply` 要接到 `<MapView onStyleApplied={reapply} />`。
 *
 * 舊做法是在這裡自己也掛一個 `map.on("style.load", apply)`，不改 MapView。
 * **那個做法有 race**：本 hook 在 mount 就註冊，MapView 是在切底圖那一刻才註冊，
 * 所以本 hook 的監聽先跑——重新加圖層並排序時，等高線根本還沒被加回去，
 * 排序於是反過來。而且它**只在部分底圖上重現**（NLSC 樣式只有兩個圖層、載入極快，
 * 時序跟 liberty 完全不同），非常難查。
 *
 * 補救式的觸發都試過而且都不夠：`styledata` 在小樣式上會太早觸發；`idle` 在
 * 背景分頁不觸發；`queueMicrotask` 也擋不住 `style.load` 本身是非同步派送的情況。
 * 正解是**讓 MapView 在做完自己的事之後明確回呼**，時序就不再是猜的。
 *
 * ⚠️ 呼叫端傳進來的 `instances` 必須 useMemo，否則每次算繪都會重跑套用邏輯。
 */
export function useGeoLayers(
  map: MapLibreMap | null,
  instances: GeoLayerInstance[],
  onSelect: (detail: DetailSpec, featureId: string) => void,
  /**
   * 要強調的圖徵 id（見 `addGeoLayer` 的說明）。通常只有目前選取的那一筆，選到
   * 山脈時會多一筆它的主峰。
   *
   * 刻意只收 id、不收「是哪個圖層的」：圖徵 id 在各 collection 內是唯一的
   * （`taipei`／`amis`／`tw-tao`），同時可見的兩個圖層撞到同一個 id 實務上不會
   * 發生，就算發生了兩邊一起強調也不會錯到哪裡去。換來的是呼叫端不必解析
   * 「這個 id 屬於哪個 instance」——主峰在地形景點、山脈在五大山脈，兩個圖層
   * 各自拿同一份清單去比對就好。
   */
  highlightIds: readonly string[],
): () => void {
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // 切底圖重套時要帶著「當下」的強調清單，所以跟 instances 一樣走 ref
  const highlightIdsRef = useRef(highlightIds);
  highlightIdsRef.current = highlightIds;
  // 陣列每次算繪都是新的，用內容當 effect 依賴才不會白重跑（比照 instanceKey）
  const highlightKey = highlightIds.join("|");

  // 只有「有哪些 instance」會影響互動綁定，資料載入完成不會。
  const instanceKey = instances.map((i) => i.instanceId).join("|");

  // ── Effect 1：互動綁定 ──────────────────────────────────────────────
  const interactionCleanups = useRef(new Map<string, () => void>());
  useEffect(() => {
    if (!map) return;

    // 一個 instance 可能有多個可點圖層（有標註的線＝線＋標註），所以記帳的 key
    // 是 instanceId 而不是 layerId——游標與重複點擊的處理需要它們被當成一組。
    const wanted = new Map(
      instancesRef.current
        .filter((i) => i.detail.type !== "none")
        .map((i) => [i.instanceId, geoHitLayerIds(i.instanceId, i.render)]),
    );

    for (const [instanceId, off] of interactionCleanups.current) {
      if (!wanted.has(instanceId)) {
        off();
        interactionCleanups.current.delete(instanceId);
      }
    }

    for (const [instanceId, layerIds] of wanted) {
      if (interactionCleanups.current.has(instanceId)) continue;
      interactionCleanups.current.set(
        instanceId,
        bindGeoLayerInteractions(map, layerIds, (featureId) => {
          // 從 ref 現查 detail，避免 closure 抓到過期的 DetailSpec
          const inst = instancesRef.current.find((i) => i.instanceId === instanceId);
          if (inst) onSelectRef.current(inst.detail, featureId);
        }),
      );
    }
  }, [map, instanceKey]);

  // 卸載時解掉所有互動監聽
  useEffect(() => {
    const cleanups = interactionCleanups.current;
    return () => {
      cleanups.forEach((off) => off());
      cleanups.clear();
    };
  }, []);

  // ── Effect 2：套用圖層（含切底圖後重套）───────────────────────────────
  const applied = useRef(new Map<string, LayerRender>());
  const applyRef = useRef<() => void>(() => {});

  /**
   * 給 `<MapView onStyleApplied>` 用的穩定回呼。
   * 切底圖之後 MapView 會在把等高線加回去之後呼叫它，此時重套才排得出正確順序。
   */
  const reapply = useCallback(() => {
    // setStyle 清掉了所有圖層，記帳也要跟著清，否則會以為圖層都還在
    applied.current.clear();
    applyRef.current();
  }, []);
  useEffect(() => {
    if (!map) return;

    const apply = () => {
      // 讀 ref 而不是 closure，這才是 style.load 重套時能看到最新資料的原因
      const list = instancesRef.current.filter((i) => i.data);
      const want = new Set(list.map((i) => i.instanceId));

      for (const [instanceId, render] of applied.current) {
        if (!want.has(instanceId)) {
          removeGeoLayer(map, instanceId, render);
          applied.current.delete(instanceId);
        }
      }

      for (const i of list) {
        addGeoLayer(map, {
          instanceId: i.instanceId,
          data: i.data!,
          color: i.color,
          render: i.render,
          minzoom: i.minzoom,
          maxzoom: i.maxzoom,
          highlightIds: highlightIdsRef.current,
        });
        applied.current.set(i.instanceId, i.render);
      }

      enforceThemeLayerOrder(map, list);
    };

    applyRef.current = apply;
    apply();
    // 強調清單也要在這裡重跑：它只改 paint，addGeoLayer 對既有圖層走
    // setPaintProperty，不會把圖層拆掉重加。
  }, [map, instances, highlightKey]);

  // 換地圖實例時清掉記帳，否則新地圖會以為圖層已經加過
  useEffect(() => {
    const bookkeeping = applied.current;
    return () => {
      bookkeeping.clear();
    };
  }, [map]);

  return reapply;
}
