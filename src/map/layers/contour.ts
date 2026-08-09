import type { Map as MapLibreMap } from "maplibre-gl";
import { CONTOUR_MIN_ZOOM, CONTOUR_THRESHOLDS, TERRAIN_MAXZOOM } from "../../config";
import { getDemSource } from "../demSource";

/** 圖層／來源 ID 常數。全站一律用這些常數，不要在別處寫死字串。 */
export const CONTOUR_SOURCE_ID = "contour-source";
export const CONTOUR_LINE_LAYER_ID = "contour-lines";
export const CONTOUR_LABEL_LAYER_ID = "contour-labels";

/**
 * 在地圖上加入等高線來源與線／標註兩個圖層。
 *
 * 等高線不是預先產製的圖磚，而是由 maplibre-contour 在瀏覽器端從 terrarium
 * DEM 圖磚即時計算等值線。單位一律公尺（`multiplier` 保持預設 1）。
 */
export function addContourLayers(map: MapLibreMap) {
  if (map.getSource(CONTOUR_SOURCE_ID)) return;

  const demSource = getDemSource();

  map.addSource(CONTOUR_SOURCE_ID, {
    type: "vector",
    tiles: [
      demSource.contourProtocolUrl({
        thresholds: CONTOUR_THRESHOLDS,
        contourLayer: "contours",
        elevationKey: "ele",
        levelKey: "level",
        extent: 4096,
        buffer: 1,
      }),
    ],
    maxzoom: TERRAIN_MAXZOOM,
  });

  map.addLayer({
    id: CONTOUR_LINE_LAYER_ID,
    type: "line",
    source: CONTOUR_SOURCE_ID,
    "source-layer": "contours",
    minzoom: CONTOUR_MIN_ZOOM,
    layout: { "line-join": "round" },
    paint: {
      "line-color": "rgba(120, 78, 42, 0.55)",
      // level = 該高程能整除的最高門檻索引；1 是計曲線（主曲線），0 是首曲線
      "line-width": ["match", ["get", "level"], 1, 1.4, 0.6],
    },
  });

  map.addLayer({
    id: CONTOUR_LABEL_LAYER_ID,
    type: "symbol",
    source: CONTOUR_SOURCE_ID,
    "source-layer": "contours",
    minzoom: CONTOUR_MIN_ZOOM + 1,
    // 只在計曲線上標高程，首曲線全標會擠成一團
    filter: [">", ["get", "level"], 0],
    layout: {
      "symbol-placement": "line",
      "text-size": 11,
      // 只標數字、不加「m」單位。沿線放置時字串越長就需要越平直的線段，
      // 等高線很彎，加了單位之後幾乎所有標註都會被放置演算法拒絕（實測掉到 0 個）。
      // 這也符合地形圖慣例：等高線只標數字，單位在圖例說明。
      "text-field": ["get", "ele"],
      "text-font": ["Noto Sans Bold"],
      // 實測值：spacing 120 + max-angle 60 在玉山一帶約可標出 19 個高程，
      // 涵蓋 1500–3500 m；用預設的 250/45 只剩 6 個，太稀疏。
      "symbol-spacing": 120,
      "text-max-angle": 60,
      "text-padding": 2,
    },
    paint: {
      "text-color": "rgba(90, 58, 30, 0.95)",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": 1.2,
    },
  });
}

export function setContourVisibility(map: MapLibreMap, visible: boolean) {
  const value = visible ? "visible" : "none";
  for (const id of [CONTOUR_LINE_LAYER_ID, CONTOUR_LABEL_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}
