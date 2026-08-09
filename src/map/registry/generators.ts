import type { GeneratorId } from "./types.ts";

/**
 * 完全由程式產生的圖層幾何。
 *
 * 這類圖層不需要任何檔案、不需要網路，所以是驗證整條架構鏈
 * （registry → resolve → geo.ts 的 line 分支 → 排序 → 圖例）最安全的起點：
 * 它跟資料取得的失敗模式完全隔離。
 */

/**
 * 重要緯線。
 *
 * 回歸線與極圈用的是地球轉軸傾角的實際值（約 23.436°），不是課本簡寫的 23.5°——
 * 畫在地圖上時兩者差不多 7 公里，但既然是程式產生的就沒有理由取近似值。
 * 標註文字仍然用學生熟悉的名稱。
 *
 * 這組線是「全球地理形貌」主題的骨架：沙漠帶之所以落在南北緯 30° 附近、
 * 針葉林帶之所以落在 60° 附近，都要先有這些參考線才講得清楚。
 */
const LATITUDE_LINES: { id: string; name: string; lat: number }[] = [
  { id: "arctic-circle", name: "北極圈", lat: 66.56361 },
  { id: "lat-60n", name: "北緯60°", lat: 60 },
  { id: "lat-30n", name: "北緯30°", lat: 30 },
  { id: "tropic-of-cancer", name: "北回歸線", lat: 23.43661 },
  { id: "equator", name: "赤道", lat: 0 },
  { id: "tropic-of-capricorn", name: "南回歸線", lat: -23.43661 },
  { id: "lat-30s", name: "南緯30°", lat: -30 },
  { id: "lat-60s", name: "南緯60°", lat: -60 },
  { id: "antarctic-circle", name: "南極圈", lat: -66.56361 },
];

/**
 * 等緯度線在 Web Mercator 下就是直線，理論上兩個端點就夠。
 * 每 5° 經度取一個節點（73 個）是為了讓沿線標註有足夠的放置機會，
 * 成本也幾乎為零。
 */
function latitudeLines(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: LATITUDE_LINES.map((line) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, line.lat]),
      },
      properties: { id: line.id, name: line.name, lat: line.lat },
    })),
  };
}

const GENERATORS: Record<GeneratorId, () => GeoJSON.FeatureCollection> = {
  "latitude-lines": latitudeLines,
};

export function generateLayer(id: GeneratorId): GeoJSON.FeatureCollection {
  return GENERATORS[id]();
}
