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

/**
 * 行星風系（三胞環流的理想模型）。
 *
 * ## 為什麼是程式產生，而且**應該**是程式產生
 *
 * 行星風系不是測出來的界線，而是**理想化的模型**：氣壓帶在赤道、南北緯 30°、60°，
 * 風帶夾在它們中間。實際大氣有海陸分布、季風與駐波，隨季節南北移動好幾度。所以
 * 這一層沒有「權威資料檔」可抓，只有課本的示意圖——而示意圖的參數（帶的緯度、
 * 箭頭的間隔與斜率）本來就該寫成程式碼裡看得懂、改得動的常數，不是一份手抄的
 * 幾千個座標。這也是它必須標 `schematic: true` 的原因。
 *
 * ⚠️ 幾何一律**不跨越 ±180**（箭頭與線段的中心經度都留了半個長度的餘裕）：
 * 跨了 maplibre 會畫一條繞過整個地球的線而且不報錯（見 CLAUDE.md 國際換日線那節）。
 */

/** 箭頭與氣壓帶線段的經度間隔（度）。 */
const ARROW_LON_SPACING = 40;
/** 箭頭的水平長度（度經度）。 */
const ARROW_LON_LENGTH = 20;
/**
 * 箭頭在**畫面上**的傾角（度）。
 *
 * ⚠️ 不能直接用固定的緯度差當斜率：Web Mercator 的縱向拉伸是 1/cos(緯度)，
 * 同樣 10° 的緯度差在 75°N 看起來比赤道長將近三倍，極地東風會變成幾乎垂直的箭頭。
 * 所以緯度差由 `tan(傾角) × 經度長度 × cos(緯度)` 反推——六條帶的箭頭因此在畫面上
 * 一律是同一個斜度。
 */
const ARROW_SCREEN_SLOPE_DEG = 30;

/** 一支箭頭（軸 + 兩根箭羽）。`dLon`／`dLat` 是**指向**，正值＝往東／往北。 */
function arrow(lon: number, lat: number, dLon: number, dLat: number): number[][][] {
  const tail: [number, number] = [lon - dLon / 2, lat - dLat / 2];
  const tip: [number, number] = [lon + dLon / 2, lat + dLat / 2];
  // 箭羽：把軸的反向量旋轉 ±28°，長度取軸的 0.32
  const back = { x: -dLon, y: -dLat };
  const barb = (deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180;
    const x = back.x * Math.cos(r) - back.y * Math.sin(r);
    const y = back.x * Math.sin(r) + back.y * Math.cos(r);
    return [tip[0] + x * 0.32, tip[1] + y * 0.32];
  };
  return [
    [tail, tip],
    [barb(28), tip, barb(-28)],
  ];
}

/**
 * 三個風帶（各含南北半球）。`from` 是課本說的風向來源，`toLon`／`toLat` 是**去向**
 * 的正負號——信風從東北吹來，所以往西南去（`toLon: -1, toLat: -1`，北半球往赤道
 * ＝緯度變小）。
 */
const WIND_BELTS: {
  id: string;
  name: string;
  bands: { lat: number; toLon: -1 | 1; toLat: -1 | 1 }[];
}[] = [
  {
    id: "trades",
    name: "信風",
    bands: [
      { lat: 16, toLon: -1, toLat: -1 }, // 東北信風
      { lat: -16, toLon: -1, toLat: 1 }, // 東南信風
    ],
  },
  {
    id: "westerlies",
    name: "西風",
    bands: [
      { lat: 45, toLon: 1, toLat: 1 },
      { lat: -45, toLon: 1, toLat: -1 },
    ],
  },
  {
    id: "polar-easterlies",
    name: "極地東風",
    /**
     * ⚠️ 極地東風的課本範圍是 60–90°，這裡把箭頭放在 **70°** 而不是帶的正中央
     * （75°）：Web Mercator 在高緯度縱向拉伸得厲害，主題預設視角（zoom 1.8）
     * 的上緣只到約 66°N，往北每多 5° 就要多縮小一級才看得到。70° 是「還在帶裡、
     * 而且縮小一點就看得到」的折衷。
     */
    bands: [
      { lat: 70, toLon: -1, toLat: -1 },
      { lat: -70, toLon: -1, toLat: 1 },
    ],
  },
];

/**
 * 三條氣壓帶。⚠️ 刻意畫成**間斷的短線段**而不是橫貫全圖的長線：它們的緯度
 * （0°／±30°／±60°）跟「緯度參考線」完全重疊，畫成長線就會變成兩條疊在一起的
 * 線，只有顏色不同——短線段配上自己的標註才看得出是兩種不同的東西。
 */
const PRESSURE_BELTS: { id: string; name: string; lats: number[] }[] = [
  { id: "pressure-equatorial", name: "赤道低壓帶", lats: [0] },
  { id: "pressure-subtropical", name: "副熱帶高壓帶", lats: [30, -30] },
  { id: "pressure-subpolar", name: "副極地低壓帶", lats: [60, -60] },
];

/** 氣壓帶線段的長度（度經度）。要放得下「副熱帶高壓帶」六個字。 */
const PRESSURE_SEGMENT_LENGTH = 34;

function windBelts(): GeoJSON.FeatureCollection {
  const slope = Math.tan((ARROW_SCREEN_SLOPE_DEG * Math.PI) / 180);
  // 箭頭中心經度：-160, -120, …, 160（半長 10°，所以最外側只到 ±170，不跨 ±180）
  const arrowLons = Array.from(
    { length: Math.floor(360 / ARROW_LON_SPACING) },
    (_, i) => -180 + ARROW_LON_SPACING / 2 + i * ARROW_LON_SPACING,
  );
  // 氣壓帶線段中心：-150, -90, …, 150（半長 17°，同樣不跨 ±180）
  const segmentLons = [-150, -90, -30, 30, 90, 150];

  const winds: GeoJSON.Feature[] = WIND_BELTS.map((belt) => ({
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: belt.bands.flatMap((band) => {
        const dLat = slope * ARROW_LON_LENGTH * Math.cos((band.lat * Math.PI) / 180);
        return arrowLons.flatMap((lon) =>
          arrow(lon, band.lat, band.toLon * ARROW_LON_LENGTH, band.toLat * dLat),
        );
      }),
    },
    properties: { id: belt.id, name: belt.name },
  }));

  const pressure: GeoJSON.Feature[] = PRESSURE_BELTS.map((belt) => ({
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: belt.lats.flatMap((lat) =>
        segmentLons.map((lon) => [
          [lon - PRESSURE_SEGMENT_LENGTH / 2, lat],
          [lon + PRESSURE_SEGMENT_LENGTH / 2, lat],
        ]),
      ),
    },
    properties: { id: belt.id, name: belt.name },
  }));

  // 氣壓帶排在前面：它們是骨架，風帶是夾在骨架之間的東西
  return { type: "FeatureCollection", features: [...pressure, ...winds] };
}

const GENERATORS: Record<GeneratorId, () => GeoJSON.FeatureCollection> = {
  "latitude-lines": latitudeLines,
  "wind-belts": windBelts,
};

export function generateLayer(id: GeneratorId): GeoJSON.FeatureCollection {
  return GENERATORS[id]();
}
