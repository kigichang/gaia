import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView } from "../map/MapView";
import { LayerPanel } from "../components/LayerPanel";
import { MapLegend } from "../components/MapLegend";
import { AppMenu } from "../components/AppMenu";
import { MapLayersPopover } from "../components/MapLayersPopover";
import { LayerDrawer } from "../components/LayerDrawer";
import { MapSearchBox } from "../components/MapSearchBox";
import { DonateButton } from "../components/DonateButton";
import { MapDetailPanel } from "../components/MapDetailPanel";
import { DetailCard, detailTitle, type Selection } from "../components/DetailCard";
import { browseLayerExtra } from "../components/ThemeBrowse";
import { DEFAULT_THEME_ID, getTheme, layerInstanceId } from "../map/registry/index";
import {
  colorOf,
  expandActive,
  itemColorOf,
  layerItems,
  resolveLayerData,
  type ActiveState,
} from "../map/registry/resolve";
import {
  MAX_ACTIVE_BY_KIND,
  type DetailSpec,
  type LayerDefinition,
  type ThemeDefinition,
} from "../map/registry/types";
import { useGeoLayers } from "../map/useGeoLayers";
import { useDrawerOpen } from "../useDrawerOpen";
import { usePopover } from "../usePopover";
import { hitInstanceId, type SearchHit } from "../search/searchIndex";
import { bboxOf } from "../map/layers/geo";
import type { ChromeState } from "../chrome";

interface ThemeMapPageProps {
  chrome: ChromeState;
}

/**
 * 主題地圖頁：`/theme/:themeId`。
 *
 * 整頁由 `src/map/registry` 的圖層註冊表驅動，加一個新主題或新圖層只要加一筆
 * 註冊表資料，不需要動這支元件。
 *
 * 版面是滿版地圖 + 浮動控制（仿 Google Map）：左上搜尋框（藥丸裡含開圖層抽屜的
 * ☰）、右上 ⋮⋮⋮ 主題與外觀選單、左下圖例與「圖層」磚，點圖徵或選搜尋結果從
 * 搜尋框下方開詳情面板。細節與那幾條硬規則見 CLAUDE.md 的「全螢幕地圖外框與
 * 浮動控制」。
 */
export function ThemeMapPage({ chrome }: ThemeMapPageProps) {
  const { themeId } = useParams();
  const theme = getTheme(themeId);
  if (!theme) return <Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />;
  return <ThemeMapView key="theme-map" theme={theme} chrome={chrome} />;
}

function ThemeMapView({ theme, chrome }: { theme: ThemeDefinition; chrome: ChromeState }) {
  const navigate = useNavigate();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(() => defaultOnIds(theme));
  const [activeItemIds, setActiveItemIds] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Selection>(() => theme.initialSelection ?? null);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection | null>>({});
  const [pendingHit, setPendingHit] = useState<SearchHit | null>(null);
  const { open: drawerOpen, setOpen: setDrawerOpen, closeTransient } = useDrawerOpen();

  // 抽屜的開關繫結。刻意上提到這裡：☰ 住在搜尋藥丸裡、面板是抽屜，兩者不再
  // 共用一個 DOM 子樹（為什麼這樣安全，見 LayerDrawer.tsx 的說明）。
  const { triggerProps: drawerTriggerProps, panelProps: drawerPanelProps } = usePopover({
    open: drawerOpen,
    onOpenChange: setDrawerOpen,
    label: `圖層選單：${theme.label}`,
    dismissOnOutsideClick: false,
  });

  const active = useMemo<ActiveState>(
    () => ({ layerIds: activeLayerIds, itemIds: activeItemIds }),
    [activeLayerIds, activeItemIds],
  );

  const { instances, pending } = useMemo(
    () => expandActive(theme, active, data),
    [theme, active, data],
  );

  // 缺哪些資料就去解析。key 已經寫進 data（即使結果是 null）之後就不會再要求，
  // 所以這裡不會無限循環。
  const pendingKey = pending.map((p) => p.key).join("|");
  useEffect(() => {
    for (const p of pending) {
      void resolveLayerData(p.source).then((fc) => {
        setData((prev) => (p.key in prev ? prev : { ...prev, [p.key]: fc }));
      });
    }
    // pending 每次算繪都是新陣列，只在「缺的東西變了」時才重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  // 抽屜疊在詳情面板之上，所以一旦選了圖徵就得把抽屜收起來，否則剛開出來的
  // 詳情卡會被整片蓋住。用 closeTransient 而不是 setOpen(false)：這是系統替
  // 使用者做的決定，不可以覆寫他自己記在 localStorage 裡的偏好。
  const handleSelect = useCallback(
    (detail: DetailSpec, featureId: string) => {
      setSelected({ detail, featureId });
      closeTransient();
    },
    [closeTransient],
  );

  /**
   * 要在地圖上強調的圖徵：選取的那一筆，加上它「順帶指名」的關聯圖徵。
   *
   * 母子關聯（五大山脈 ↔ 主峰、縣市界 ↔ 縣市政府）**兩個方向都成立**：選了主峰要
   * 連所屬山脈一起加粗，選了山脈也要連主峰一起標出來。
   *
   * ⚠️ 唯一的線索是附屬圖徵身上那個 `attach.parentProperty`，**兩個方向都從它推**，
   * 不要再回頭去寫死屬性名。早期版本寫死 `["peakId", "rangeId"]`，加了縣市政府之後
   * 立刻壞掉——`countyId` 不在那份清單裡，點縣市政府時所屬縣市不會被強調，而且
   * 因為卡片與相機都正常，這件事在畫面上很容易被忽略過去。母 → 子的方向也不需要
   * 母圖徵身上有任何屬性：反過來找「哪個子項目指向我」就好。
   *
   * 強調是各圖層拿**同一份 id 清單**去比對的，所以這裡不需要知道對方在哪一層；
   * 那一層沒開就自然不會有東西被標，也合理。
   */
  const parentProperties = useMemo(
    () =>
      theme.layers
        .map((l) => l.attach?.parentProperty)
        .filter((p): p is string => Boolean(p)),
    [theme],
  );

  const highlightIds = useMemo(() => {
    if (!selected) return [];
    const ids = [selected.featureId];
    if (parentProperties.length === 0) return ids;

    const add = (v: unknown) => {
      if (typeof v === "string" && !ids.includes(v)) ids.push(v);
    };
    for (const inst of instances) {
      for (const f of inst.data?.features ?? []) {
        const p = f.properties;
        if (!p) continue;
        for (const key of parentProperties) {
          // 子 → 母：選中的就是這個子項目，把它指到的母圖徵加進來
          if (p.id === selected.featureId) add(p[key]);
          // 母 → 子：這個子項目指回選中的母圖徵，把它自己加進來
          if (p[key] === selected.featureId) add(p.id);
        }
      }
    }
    return ids;
  }, [selected, instances, parentProperties]);

  // 切底圖之後由 MapView 明確回呼重套主題圖層（見 useGeoLayers 的說明）。
  const reapplyLayers = useGeoLayers(map, instances, handleSelect, highlightIds);

  // 換主題：重設圖層開關與詳情卡，並把相機飛過去。
  //
  // ⚠️ 刻意**不用** key={themeId} 強制 remount：remount 會拆掉並重建 maplibre
  // 地圖，丟掉整份圖磚快取，而且每次導覽都會在 window.__gaiaMaps 累積一個新實例，
  // 讓文件裡的驗證指令拿到已經 remove() 掉的地圖。
  const firstRender = useRef(true);
  const pendingHitRef = useRef<SearchHit | null>(null);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setActiveLayerIds(defaultOnIds(theme));
    setActiveItemIds({});
    // 跨主題搜尋：目標圖徵與相機都由下面的 pendingHit effect 決定。這裡要是照常
    // 飛到主題預設相機，畫面會先飛一次再飛第二次，而且 initialSelection 的詳情卡
    // 會閃一下才被換掉。ref 而不是 state：導覽發生在 setState 生效之前。
    //
    // 但詳情卡一定要清掉：目標圖徵若是 detail.type === "none" 的圖層（緯度參考線），
    // pendingHit effect 永遠不會 setSelected，上一個主題的詳情卡就會留在畫面上。
    if (pendingHitRef.current?.themeId === theme.id) {
      setSelected(null);
      return;
    }
    setSelected(theme.initialSelection ?? null);
    map?.flyTo({ center: theme.camera.center, zoom: theme.camera.zoom, duration: 1200 });
  }, [theme, map]);

  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const toggleItem = useCallback((layerId: string, itemId: string) => {
    setActiveItemIds((prev) => {
      const current = prev[layerId] ?? [];
      const next = current.includes(itemId)
        ? current.filter((x) => x !== itemId)
        : [...current, itemId];
      return { ...prev, [layerId]: next };
    });
  }, []);

  /**
   * 飛到某個圖徵：點的用 flyTo，線／面用 fitBounds。
   *
   * `attached` 時目標在附屬圖層（五大山脈 → 主峰），它的資料與 browse 設定都在
   * `layer.attach` 上而不是圖層自己身上。
   */
  const flyToFeature = useCallback(
    (layer: LayerDefinition, featureId: string, attached = false) => {
      if (!map) return;
      const attach = layer.attach;
      const browse = attached ? attach?.browse : layer.browse;
      const instanceId = attached
        ? attach?.id
        : layer.items
          ? layerInstanceId(layer.id, featureId)
          : layer.id;
      const inst = instances.find((i) => i.instanceId === instanceId);
      const fc = inst?.data;
      if (!fc) return;

      if (layer.items && !attached) {
        // 子項目整份就是一個圖層（例如一個物種的所有觀測點），框住全部
        const bounds = bboxOf(fc);
        if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
        return;
      }

      const feature = fc.features.find((f) => f.properties?.id === featureId);
      if (!feature) return;

      if (feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates;
        const zoom = Number(feature.properties?.zoom) || browse?.zoom || 11;
        map.flyTo({ center: [lng, lat], zoom, duration: 1200 });
      } else {
        const bounds = bboxOf({ type: "FeatureCollection", features: [feature] });
        if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
      }
    },
    [map, instances],
  );

  const handleBrowseSelect = useCallback(
    (layer: LayerDefinition, featureId: string) => {
      setSelected({ detail: layer.detail, featureId });
      closeTransient();
      flyToFeature(layer, featureId);
    },
    [flyToFeature, closeTransient],
  );

  /**
   * 點清單裡的附屬圖徵（五大山脈底下的主峰）。
   *
   * 開的是**主峰自己的** `PlaceCard`（有海拔與氣候圖表），不是山脈的卡片——所屬山脈
   * 則由 `highlightIds` 一起在地圖上加粗，這就是「選子類視同也選父類」。
   */
  const handleBrowseSelectAttached = useCallback(
    (layer: LayerDefinition, featureId: string) => {
      const attach = layer.attach;
      if (!attach) return;
      setSelected({ detail: attach.detail, featureId });
      closeTransient();
      flyToFeature(layer, featureId, true);
    },
    [flyToFeature, closeTransient],
  );

  /**
   * 把圖層（必要時連同子項目）打開。
   *
   * `MAX_ACTIVE_BY_KIND` 的上限平常是靠 `LayerPanel` 把核取方塊 disable 掉來
   * 落實的，搜尋自動勾選會繞過那個 UI，所以這裡得自己守。`Set` 保序，迭代順序
   * 最前面的就是最早勾的那一個，踢它最不意外。
   */
  const enableLayer = useCallback(
    (layer: LayerDefinition, itemId?: string) => {
      setActiveLayerIds((prev) => {
        if (prev.has(layer.id)) return prev;
        const kind = layer.render.kind;
        const sameKind = [...prev].filter(
          (id) => theme.layers.find((l) => l.id === id)?.render.kind === kind,
        );
        const next = new Set(prev);
        if (sameKind.length >= MAX_ACTIVE_BY_KIND[kind]) next.delete(sameKind[0]);
        next.add(layer.id);
        return next;
      });

      const items = layer.items;
      if (!itemId || !items) return;
      setActiveItemIds((prev) => {
        const current = prev[layer.id] ?? [];
        if (current.includes(itemId)) return prev;
        const next = [...current, itemId];
        // 超過同時可比較的數量就從最早勾的開始擠掉（色票長度是硬上限）
        return { ...prev, [layer.id]: next.slice(Math.max(0, next.length - items.maxActive)) };
      });
    },
    [theme],
  );

  const clearPending = useCallback(() => {
    pendingHitRef.current = null;
    setPendingHit(null);
  }, []);

  /**
   * 選了一筆搜尋結果。
   *
   * 不能在這裡直接飛過去：圖層可能還沒勾選、資料可能還沒抓回來，甚至可能要先
   * 換主題。所以只記下待處理的目標，剩下的交給下面的 effect 分批完成。
   */
  const handleSelectHit = useCallback(
    (hit: SearchHit) => {
      pendingHitRef.current = hit;
      setPendingHit(hit);
      closeTransient();
      if (hit.themeId !== theme.id) navigate(`/theme/${hit.themeId}`);
    },
    [theme, navigate, closeTransient],
  );

  const handleItemNameClick = useCallback(
    (layerId: string, itemId: string) => {
      const layer = theme.layers.find((l) => l.id === layerId);
      if (!layer) return;
      setSelected({ detail: layer.detail, featureId: itemId });
      closeTransient();
      flyToFeature(layer, itemId);
    },
    [theme, flyToFeature, closeTransient],
  );

  /**
   * 消化搜尋結果。可能要跑好幾輪：勾選圖層 → 等資料抓回來 → 才飛得過去。
   * 每一輪只做當下做得到的事，做不到就 return，等 instances 變了再來。
   *
   * ⚠️ 宣告順序在換主題那個 effect 之後是刻意的：跨主題時兩個 effect 會在
   * 同一輪跑，換主題要先把圖層勾選重設掉，我們才在乾淨的狀態上加圖層。
   */
  useEffect(() => {
    if (!pendingHit || !map || pendingHit.themeId !== theme.id) return;
    const layer = theme.layers.find((l) => l.id === pendingHit.layerId);
    if (!layer || layer.status !== "ready") {
      clearPending();
      return;
    }

    enableLayer(layer, pendingHit.itemId);

    // 圖層本身的搜尋結果落在有子項目的圖層上（例如「特有種生態分佈」）：
    // 沒有指定物種就沒有幾何可以框，勾起來讓使用者自己挑就是正確的結束。
    if (!pendingHit.featureId || (layer.items && !pendingHit.itemId)) {
      clearPending();
      return;
    }

    const inst = instances.find((i) => i.instanceId === hitInstanceId(pendingHit));
    if (!inst?.data) return; // 資料還沒到

    if (pendingHit.kind === "feature") {
      // 附屬圖徵（主峰）的詳情卡與 zoom 都在 attach 上，不是母圖層的
      const attached = Boolean(pendingHit.attachedId);
      const detail = attached ? layer.attach?.detail : layer.detail;
      // detail.type === "none" 的圖層（緯度參考線）飛過去就好——
      // 開一張沒有內容的詳情卡什麼都沒教到
      if (detail && detail.type !== "none") {
        setSelected({ detail, featureId: pendingHit.featureId });
      }
      flyToFeature(layer, pendingHit.featureId, attached);
    } else {
      const bounds = bboxOf(inst.data);
      if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
    }
    clearPending();
  }, [pendingHit, theme, map, instances, enableLayer, flyToFeature, clearPending]);

  // 資料抓失敗時 instance 的 data 永遠是 null，effect 不會再被觸發，pending 會
  // 一直卡著（並讓下一次換主題誤以為還有待處理的目標）。給它一條死線。
  useEffect(() => {
    if (!pendingHit) return;
    const timer = setTimeout(clearPending, 8000);
    return () => clearTimeout(timer);
  }, [pendingHit, clearPending]);

  // 子項目的圖徵數（特有種的觀測點筆數）
  const itemCounts = useMemo(() => {
    const counts: Record<string, number | undefined> = {};
    for (const layer of theme.layers) {
      if (!layer.items) continue;
      for (const item of layerItems(layer)) {
        if (!item.source) continue;
        const inst = instances.find(
          (i) => i.instanceId === layerInstanceId(layer.id, item.id),
        );
        counts[item.id] = inst?.data?.features.length;
      }
    }
    return counts;
  }, [theme, instances]);

  const legendEntries = useMemo(
    () =>
      theme.layers
        .filter((l) => l.status === "ready" && activeLayerIds.has(l.id))
        .flatMap((layer) => {
          if (layer.items) {
            const items = layerItems(layer);
            return (activeItemIds[layer.id] ?? [])
              .filter((id) => instances.some((i) => i.instanceId === layerInstanceId(layer.id, id) && i.data))
              .map((id, index) => ({
                key: `${layer.id}-${id}`,
                label: items.find((it) => it.id === id)?.label ?? id,
                color: itemColorOf(layer, id, index),
                kind: layer.render.kind,
                schematic: layer.schematic,
              }));
          }
          if (!layer.colorRole) return [];
          return [
            {
              key: layer.id,
              label: layer.label,
              color: colorOf(layer.colorRole),
              kind: layer.render.kind,
              schematic: layer.schematic,
              // 依數值分級上色的圖層要把級距一起畫進圖例（見 MapLegend.tsx）
              ramp: layer.render.kind === "circle" ? layer.render.colorRamp : undefined,
            },
          ];
        }),
    [theme, activeLayerIds, activeItemIds, instances],
  );

  // 有 browse 設定、已勾選、資料已載入的圖層 → 顯示可點清單
  const browseLayers = theme.layers.filter(
    (l) => l.status === "ready" && l.browse && !l.items && activeLayerIds.has(l.id),
  );

  // 可點清單長在圖層抽屜裡（見 ThemeBrowse.tsx 的 browseLayerExtra）
  const dataOf = useCallback(
    (layerId: string) => instances.find((i) => i.instanceId === layerId)?.data ?? null,
    [instances],
  );
  const renderLayerExtra = browseLayerExtra({
    layers: browseLayers,
    dataOf,
    selected,
    onSelect: handleBrowseSelect,
    onSelectAttached: handleBrowseSelectAttached,
  });

  const detailOpen = Boolean(selected);

  return (
    // data-* 驅動 --left-panel-w／--bottom-sheet-h，浮動控制靠這兩個屬性讓開，
    // 不准有第二條硬寫 left/bottom 的規則（見 styles.css 的說明）。
    <div className="map-shell" data-detail-open={detailOpen} data-drawer-open={drawerOpen}>
      {/*
        ⚠️ MapView 必須是 shell 的第一個、無條件的子節點。
        永遠不要把它移進條件分支、加 key 的包裝層、或抽屜／面板擁有的子樹——
        任何一種都會讓 React 重建這個節點，於是 maplibre remount：整份圖磚快取
        丟掉，window.__gaiaMaps 累積殘骸。面板一律是「排在地圖後面」的兄弟節點，
        地圖的 reconciliation 位置永遠是 index 0。

        也因為面板是絕對定位的疊層而不是把地圖擠小的欄位，canvas 尺寸與面板開關
        完全無關，所以這裡不需要（也不該有）任何 map.resize()。
      */}
      <MapView
        className="map-shell-canvas"
        initialCenter={theme.camera.center}
        initialZoom={theme.camera.zoom}
        basemap={chrome.basemap}
        overlays={chrome.overlays}
        onReady={setMap}
        onStyleApplied={reapplyLayers}
        navPosition="bottom-right"
        scalePosition="bottom-right"
      />

      {/* 搜尋框是左上角那一欄的頂端，詳情面板接在它下面（--search-h）。
          贊助按鈕排在搜尋框右邊，同一列。 */}
      <div className="map-top-left">
        <MapSearchBox
          themeLabel={theme.label}
          themeId={theme.id}
          menuButtonProps={drawerTriggerProps}
          menuLabel={`圖層選單：${theme.label}`}
          onSelectHit={handleSelectHit}
        />
        <DonateButton />
      </div>

      <div className="map-top-right">
        <AppMenu themePref={chrome.themePref} onThemePrefChange={chrome.onThemePrefChange} />
      </div>

      <div className="map-bottom-left">
        <MapLegend entries={legendEntries} />
        <MapLayersPopover chrome={chrome} />
      </div>

      {detailOpen && (
        <MapDetailPanel onClose={() => setSelected(null)} title={detailTitle(selected)}>
          <DetailCard
            selection={selected}
            itemCounts={itemCounts}
            theme={theme}
            instances={instances}
          />
        </MapDetailPanel>
      )}

      <LayerDrawer
        open={drawerOpen}
        panelProps={drawerPanelProps}
        onClose={() => setDrawerOpen(false)}
        title={theme.label}
        subtitle={theme.subtitle}
      >
        <LayerPanel
          theme={theme}
          activeLayerIds={activeLayerIds}
          onToggleLayer={toggleLayer}
          activeItemIds={activeItemIds}
          onToggleItem={toggleItem}
          onItemNameClick={handleItemNameClick}
          itemCounts={itemCounts}
          renderLayerExtra={renderLayerExtra}
        />
      </LayerDrawer>
    </div>
  );
}

function defaultOnIds(theme: ThemeDefinition): Set<string> {
  return new Set(
    theme.layers.filter((l) => l.status === "ready" && l.defaultOn).map((l) => l.id),
  );
}
