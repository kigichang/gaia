import type { Map as MapLibreMap } from "maplibre-gl";
import { ATTRIBUTION, TERRAIN_MAXZOOM } from "../../config";
import { getDemSource } from "../demSource";

export { DEM_SOURCE_ID, TERRAIN_SOURCE_ID, HILLSHADE_LAYER_ID } from "./ids";
import { DEM_SOURCE_ID, HILLSHADE_LAYER_ID } from "./ids";
/**
 * 加入 raster-dem 來源。
 *
 * 這裡刻意用 `demSource.sharedDemProtocolUrl` 而不是直接指向 AWS，
 * 這樣地形陰影／3D 地形會重用等高線已經下載並解碼過的 DEM 圖磚快取，
 * 同一塊圖磚只會下載一次。
 */
export function addDemSource(map: MapLibreMap, sourceId: string = DEM_SOURCE_ID) {
  if (map.getSource(sourceId)) return;
  const demSource = getDemSource();
  map.addSource(sourceId, {
    type: "raster-dem",
    encoding: "terrarium",
    tiles: [demSource.sharedDemProtocolUrl],
    maxzoom: TERRAIN_MAXZOOM,
    tileSize: 256,
    attribution: ATTRIBUTION.terrain,
  });
}

/** 地形陰影。beforeId 通常傳底圖第一個 symbol 圖層，讓陰影疊在地物之下、地名之上。 */
export function addHillshadeLayer(map: MapLibreMap, beforeId?: string) {
  addDemSource(map);
  if (map.getLayer(HILLSHADE_LAYER_ID)) return;
  map.addLayer(
    {
      id: HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: DEM_SOURCE_ID,
      paint: {
        "hillshade-exaggeration": 0.45,
        "hillshade-shadow-color": "#5a4632",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#7d6a52",
      },
    },
    beforeId,
  );
}

export function setHillshadeVisibility(map: MapLibreMap, visible: boolean) {
  if (map.getLayer(HILLSHADE_LAYER_ID)) {
    map.setLayoutProperty(HILLSHADE_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}
