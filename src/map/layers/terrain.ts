import type { Map as MapLibreMap } from "maplibre-gl";
import { TERRAIN_SOURCE_ID, addDemSource } from "./hillshade";

/** 3D 地形起伏倍率。1.0 是真實比例，教學上稍微誇張比較看得出地勢。 */
const TERRAIN_EXAGGERATION = 1.4;

/**
 * 切換 3D 地形。開啟時同時把視角壓低，否則正射俯視看不出立體感。
 *
 * 注意：`map.queryTerrainElevation()` 需要 terrain 啟用才有值，
 * 所以「查詢海拔」功能會依賴這個開關。
 */
export function setTerrainEnabled(map: MapLibreMap, enabled: boolean) {
  if (enabled) {
    addDemSource(map, TERRAIN_SOURCE_ID);
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
    if (map.getPitch() < 30) map.easeTo({ pitch: 55, duration: 600 });
  } else {
    map.setTerrain(null);
    if (map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  }
}
