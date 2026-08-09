// maplibre-gl v6 起不再提供 default export，必須用 namespace import
import * as maplibregl from "maplibre-gl";
import mlcontour from "maplibre-contour";
import { TERRAIN_MAXZOOM, TERRAIN_TILES_URL } from "../config";

/**
 * 全站共用的單例 DemSource。
 *
 * 為什麼要單例：`setupMaplibre()` 會在 maplibre 全域註冊 protocol handler，
 * 而 DemSource 建構時會啟動一個 web worker。比較頁同時有兩張地圖，若各自
 * 建立 DemSource 就會有兩個 worker、兩份快取，同一塊 DEM 圖磚被下載兩次。
 *
 * maplibre-contour 會把 worker 以 Blob URL 內嵌，因此不需要額外部署 worker 檔案，
 * 在 GitHub Pages 這種純靜態主機上也能正常運作。
 */
let demSource: InstanceType<typeof mlcontour.DemSource> | null = null;

export function getDemSource() {
  if (!demSource) {
    demSource = new mlcontour.DemSource({
      url: TERRAIN_TILES_URL,
      encoding: "terrarium",
      maxzoom: TERRAIN_MAXZOOM,
      // 等高線的等值線計算丟到 worker，避免拖慢主執行緒的地圖互動
      worker: true,
      cacheSize: 100,
      timeoutMs: 10_000,
    });
    demSource.setupMaplibre(maplibregl);
  }
  return demSource;
}
