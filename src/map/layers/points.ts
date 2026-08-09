import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";

/**
 * 通用點位圖層 helper。
 *
 * 三種主題（地形景點、原住民族分佈、特有種生態分佈）都用同一組函式加圖層，
 * 差別只在資料來源與顏色。地形景點跟原住民族是固定一種強調色（清單靠點擊瀏覽，
 * 不需要靠顏色分類比較）；特有種要依物種分色，因為多物種疊加比較時，
 * 顏色是唯一能一眼分辨「這是哪個物種」的方式。
 */
export interface PointLayerSpec {
  sourceId: string;
  layerId: string;
  data: GeoJSON.FeatureCollection<GeoJSON.Point>;
  color: string;
  /** 圓點半徑（px），預設 6 */
  radius?: number;
}

export function addPointLayer(map: MapLibreMap, spec: PointLayerSpec) {
  const { sourceId, layerId, data, color, radius = 6 } = spec;

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as GeoJSONSource).setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": radius,
        "circle-color": color,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.85,
      },
    });
  }
}

export function removePointLayer(map: MapLibreMap, ids: { sourceId: string; layerId: string }) {
  if (map.getLayer(ids.layerId)) map.removeLayer(ids.layerId);
  if (map.getSource(ids.sourceId)) map.removeSource(ids.sourceId);
}

export function setLayerVisible(map: MapLibreMap, layerId: string, visible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
}

/** 把任意陣列轉成點位 GeoJSON，供 addPointLayer 使用。 */
export function toFeatureCollection<T>(
  items: T[],
  getCoord: (item: T) => [number, number],
  getId: (item: T) => string,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: getCoord(item) },
      properties: { id: getId(item) },
    })),
  };
}

/**
 * 幫圖層掛上點擊（回呼收到該點的 `id` 屬性）與滑鼠游標樣式切換。
 * 回傳的 cleanup 函式要在 layer 被移除或 effect 卸載時呼叫。
 */
export function bindPointLayerInteractions(
  map: MapLibreMap,
  layerId: string,
  onClick: (id: string) => void,
) {
  const handleClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") onClick(id);
  };
  const setPointer = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const resetCursor = () => {
    map.getCanvas().style.cursor = "";
  };

  map.on("click", layerId, handleClick);
  map.on("mouseenter", layerId, setPointer);
  map.on("mouseleave", layerId, resetCursor);

  return () => {
    map.off("click", layerId, handleClick);
    map.off("mouseenter", layerId, setPointer);
    map.off("mouseleave", layerId, resetCursor);
  };
}
