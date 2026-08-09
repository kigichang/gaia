import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { addPointLayer, bindPointLayerInteractions, removePointLayer } from "./layers/points";
import { INDIGENOUS_COLOR, PLACES_COLOR } from "./thematicColors";

export const PLACES_SOURCE_ID = "places-source";
export const PLACES_LAYER_ID = "places-points";
export const INDIGENOUS_SOURCE_ID = "indigenous-source";
export const INDIGENOUS_LAYER_ID = "indigenous-points";
export const speciesSourceId = (id: string) => `species-${id}-source`;
export const speciesLayerId = (id: string) => `species-${id}-points`;

export type ThematicKind = "place" | "indigenous" | "species";

export interface ActiveSpeciesLayer {
  id: string;
  color: string;
  /** 尚未載入完成時傳 null，hook 會先略過這個物種，等資料就緒後自動補上 */
  data: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
}

export interface ThematicLayersConfig {
  showPlaces: boolean;
  placesData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  showIndigenous: boolean;
  indigenousData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  activeSpecies: ActiveSpeciesLayer[];
}

/** 把 speciesId 統一寫進 properties.id，讓三種主題圖層都能用同一套點擊處理邏輯。 */
function withIdProperty(
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
  id: string,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: data.features.map((f) => ({ ...f, properties: { ...f.properties, id } })),
  };
}

/**
 * 管理 Explore 頁的三種可複選疊加主題圖層（地形景點／原住民族分佈／特有種生態分佈）。
 *
 * 關鍵坑：MapView 切換底圖時會呼叫 map.setStyle()，這會清空所有自訂 source/layer，
 * 然後在 style.load 事件重新加回 contour/hillshade（見 MapView.tsx）。這個 hook
 * 不修改 MapView，而是直接對外部拿到的 map 實例額外掛一個 style.load 監聽，
 * 每次都重新套用主題圖層，否則切底圖會把這裡加的點位圖層一起清掉。
 *
 * `map.on(event, layerId, handler)` 的監聽是掛在 Map 實例上、不是掛在圖層上，
 * 所以點擊互動只需要在圖層第一次建立時綁一次，setStyle 造成的圖層重建不需要重綁。
 *
 * `config` 物件要用 `useMemo`（依 showPlaces/showIndigenous/activeSpecies 的實際內容）
 * 在呼叫端做好記憶化——這個 hook 的 effect 依賴整個 config 物件，每次拿到新的物件
 * 參照就會重新跑一次 apply()。add/remove 本身是 idempotent 的，重跑不會壞掉，
 * 但沒有必要每次跟主題圖層無關的 re-render 都重新套用一次圖層。
 */
export function useThematicLayers(
  map: MapLibreMap | null,
  config: ThematicLayersConfig,
  onSelect: (kind: ThematicKind, id: string) => void,
) {
  const configRef = useRef(config);
  configRef.current = config;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 地形景點／原住民族分佈是固定圖層，互動只需要綁一次，
  // 綁定即使圖層還沒建立也不會出錯（maplibre 只是還沒有東西可以觸發事件）。
  useEffect(() => {
    if (!map) return;
    const cleanups = [
      bindPointLayerInteractions(map, PLACES_LAYER_ID, (id) => onSelectRef.current("place", id)),
      bindPointLayerInteractions(map, INDIGENOUS_LAYER_ID, (id) =>
        onSelectRef.current("indigenous", id),
      ),
    ];
    return () => cleanups.forEach((c) => c());
  }, [map]);

  // 特有種圖層是動態集合，需要追蹤哪些物種已經綁過互動，避免重複綁定。
  const speciesInteractionCleanups = useRef(new Map<string, () => void>());

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      const c = configRef.current;

      if (c.showPlaces) {
        addPointLayer(map, {
          sourceId: PLACES_SOURCE_ID,
          layerId: PLACES_LAYER_ID,
          data: c.placesData,
          color: PLACES_COLOR,
        });
      } else {
        removePointLayer(map, { sourceId: PLACES_SOURCE_ID, layerId: PLACES_LAYER_ID });
      }

      if (c.showIndigenous) {
        addPointLayer(map, {
          sourceId: INDIGENOUS_SOURCE_ID,
          layerId: INDIGENOUS_LAYER_ID,
          data: c.indigenousData,
          color: INDIGENOUS_COLOR,
          radius: 7,
        });
      } else {
        removePointLayer(map, { sourceId: INDIGENOUS_SOURCE_ID, layerId: INDIGENOUS_LAYER_ID });
      }

      const desired = new Set(c.activeSpecies.filter((s) => s.data).map((s) => s.id));
      for (const id of speciesInteractionCleanups.current.keys()) {
        if (!desired.has(id)) {
          removePointLayer(map, { sourceId: speciesSourceId(id), layerId: speciesLayerId(id) });
          speciesInteractionCleanups.current.get(id)?.();
          speciesInteractionCleanups.current.delete(id);
        }
      }
      for (const sp of c.activeSpecies) {
        if (!sp.data) continue;
        addPointLayer(map, {
          sourceId: speciesSourceId(sp.id),
          layerId: speciesLayerId(sp.id),
          data: withIdProperty(sp.data, sp.id),
          color: sp.color,
          radius: 4,
        });
        if (!speciesInteractionCleanups.current.has(sp.id)) {
          speciesInteractionCleanups.current.set(
            sp.id,
            bindPointLayerInteractions(map, speciesLayerId(sp.id), (id) =>
              onSelectRef.current("species", id),
            ),
          );
        }
      }
    };

    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, config]);

  // hook 卸載（離開 Explore 頁）時把所有物種互動監聽解除，避免記憶體洩漏
  useEffect(() => {
    return () => {
      speciesInteractionCleanups.current.forEach((cleanup) => cleanup());
      speciesInteractionCleanups.current.clear();
    };
  }, []);
}
