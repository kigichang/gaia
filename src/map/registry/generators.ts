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

/**
 * 洋流（暖流／寒流）。
 *
 * ## 為什麼是程式產生，而不是 `public/data/geo-manual/` 的一份手繪 geojson
 *
 * CLAUDE.md 原本把洋流歸在「手繪教學示意幾何」那一類，而它的**路徑**確實是手訂的
 * （洋流沿著海岸與海盆走，沒有參數推得出來）。改走 generator 的理由是另外三件事，
 * 全部是「手抄座標一定會出事」的那一類：
 *
 * 1. **箭頭。** 洋流的方向就是這一層的教學內容（北半球順時針、南半球逆時針的
 *    環流），而箭羽要在 Web Mercator 上看起來一樣大就得依緯度校正（同 `windBelts`）
 *    ——手抄幾十對箭羽座標既算不準也改不動。
 * 2. **跨 ±180。** 北太平洋暖流、北／南赤道暖流與西風漂流**一定**會跨越換日線，
 *    而跨了 maplibre 會畫一條繞過整個地球的橫線**而且不報錯**（見 CLAUDE.md
 *    國際換日線那節）。這裡讓 `splitAntimeridian()` 保證，不靠人記得。
 * 3. **控制點旁邊寫得下「這條是什麼」。** geojson 沒有註解，而這 18 條每一條都有
 *    一句話要交代（黑潮怎麼繞過臺灣、祕魯寒流為什麼要貼著海岸）。
 *
 * ⚠️ 路徑仍然是**示意**的（幾十個控制點的平滑曲線，不是實測的流軸），所以圖層
 * **必須**標 `schematic: true`。
 *
 * ⚠️ **控制點的經度刻意寫成「連續、可以超過 ±180」的形式**（例如北太平洋暖流從
 * 145 一路寫到 232、西風漂流從 20 寫到 380）。先在連續空間裡平滑與算箭頭，最後
 * 才一次 wrap＋切段——反過來做的話，平滑曲線會在換日線附近被拉直，而箭頭會指錯邊。
 */

/** 洋流控制點：連續經度（可超過 ±180）、緯度。 */
interface CurrentDef {
  id: string;
  name: string;
  kind: "warm" | "cold";
  path: [number, number][];
}

const OCEAN_CURRENTS: CurrentDef[] = [
  // ── 暖流 ────────────────────────────────────────────────────────────
  {
    // 從呂宋島東方北上，貼著臺灣東岸與琉球群島，再沿日本南岸往東北
    id: "kuroshio",
    name: "黑潮",
    kind: "warm",
    path: [
      [126.5, 12.5], [126.0, 16.5], [123.5, 20.0], [122.3, 23.0],
      [123.6, 25.6], [127.5, 28.5], [132.0, 31.5], [136.5, 33.2], [141.0, 35.2],
    ],
  },
  {
    // 黑潮離開日本後橫越北太平洋，撞上北美西岸分成阿拉斯加暖流與加利福尼亞寒流
    id: "north-pacific-drift",
    name: "北太平洋暖流",
    kind: "warm",
    path: [[143.0, 36.5], [160.0, 39.5], [180.0, 42.5], [200.0, 44.5], [220.0, 45.0], [232.0, 44.0]],
  },
  {
    id: "alaska",
    name: "阿拉斯加暖流",
    kind: "warm",
    path: [[-131.0, 47.5], [-136.0, 53.0], [-145.0, 57.5], [-155.0, 58.5], [-163.0, 55.5]],
  },
  {
    /**
     * 信風吹出來的一條，由東往西橫越太平洋。
     *
     * ⚠️ 經度**必須一路遞減**（-166 → -196 → -217，也就是 194°E → 164°E → 143°E）。
     * 寫成 wrap 過的 `190, 165, 143` 會讓連續空間裡出現一個 +350° 的跳躍，
     * 平滑與切段全部失效——實測會產出 29 段碎線與一條 44° 的橫跨線。
     */
    id: "north-equatorial",
    name: "北赤道暖流",
    kind: "warm",
    path: [[-100.0, 11.5], [-133.0, 11.5], [-166.0, 10.5], [-196.0, 9.5], [-217.0, 10.0]],
  },
  {
    id: "south-equatorial",
    name: "南赤道暖流",
    kind: "warm",
    path: [[-85.0, -4.5], [-115.0, -5.0], [-145.0, -4.5], [-175.0, -5.5], [-197.0, -7.5], [-212.0, -9.0]],
  },
  {
    // 從佛羅里達海峽北上，在哈特拉斯角外海轉向東北離岸
    id: "gulf-stream",
    name: "墨西哥灣流",
    kind: "warm",
    path: [[-80.5, 24.5], [-79.5, 29.5], [-77.5, 33.0], [-73.0, 36.5], [-66.0, 39.5], [-56.0, 41.5], [-47.0, 43.5]],
  },
  {
    // 灣流的延伸，把熱量送到西歐與挪威沿岸
    id: "north-atlantic-drift",
    name: "北大西洋暖流",
    kind: "warm",
    path: [[-45.0, 44.5], [-33.0, 48.5], [-21.0, 53.0], [-10.0, 57.5], [1.0, 61.5], [10.0, 66.0], [18.0, 70.0]],
  },
  {
    id: "brazil",
    name: "巴西暖流",
    kind: "warm",
    path: [[-35.0, -8.0], [-37.5, -15.0], [-43.0, -22.5], [-49.5, -29.5], [-55.0, -36.0]],
  },
  {
    id: "east-australian",
    name: "東澳暖流",
    kind: "warm",
    path: [[152.0, -22.0], [153.5, -28.0], [152.5, -34.0], [150.0, -39.0], [147.0, -42.5]],
  },
  {
    // 沿莫三比克海峽南下，繞過南非南端之後大半被西風漂流帶回印度洋
    id: "agulhas",
    name: "阿古拉斯暖流",
    kind: "warm",
    path: [[41.0, -13.0], [37.5, -21.0], [32.0, -28.5], [27.0, -34.0], [21.0, -37.0]],
  },

  // ── 寒流 ────────────────────────────────────────────────────────────
  {
    // 從千島群島南下，在日本東北外海與黑潮相遇，形成世界級漁場
    id: "oyashio",
    name: "親潮",
    kind: "cold",
    path: [[165.0, 53.0], [157.0, 48.0], [150.0, 44.5], [146.0, 42.0], [143.5, 39.0]],
  },
  {
    id: "california",
    name: "加利福尼亞寒流",
    kind: "cold",
    path: [[-127.0, 47.0], [-126.0, 40.5], [-122.0, 34.0], [-116.5, 27.5], [-111.0, 22.0]],
  },
  {
    id: "labrador",
    name: "拉布拉多寒流",
    kind: "cold",
    path: [[-63.0, 66.0], [-59.0, 60.0], [-55.5, 54.0], [-52.5, 48.5], [-50.0, 43.5]],
  },
  {
    id: "canary",
    name: "加那利寒流",
    kind: "cold",
    path: [[-10.0, 37.0], [-13.0, 31.0], [-17.0, 25.0], [-19.0, 19.0], [-19.5, 13.0]],
  },
  {
    // 沿南美西岸北上，湧升流造就世界最大的漁場，也造就了阿他加馬沙漠
    id: "peru",
    name: "祕魯寒流",
    kind: "cold",
    path: [[-75.0, -43.0], [-74.0, -34.0], [-73.0, -25.0], [-78.0, -17.0], [-83.0, -9.0], [-88.0, -4.5]],
  },
  {
    // 沿非洲西南岸北上，納米比沙漠就在它旁邊
    id: "benguela",
    name: "本格拉寒流",
    kind: "cold",
    path: [[17.5, -34.5], [14.0, -28.0], [11.0, -21.5], [9.5, -15.0], [8.5, -9.0]],
  },
  {
    id: "west-australian",
    name: "西澳寒流",
    kind: "cold",
    path: [[115.0, -35.0], [112.5, -29.0], [111.0, -22.5], [112.0, -16.0]],
  },
  {
    // ⚠️ 唯一一條繞地球一圈的洋流：控制點從 20 一路寫到 380（＝360°），
    // 交給 splitAntimeridian() 切段。緯度的起伏是德雷克海峽與非洲南方的實際偏北。
    id: "west-wind-drift",
    name: "西風漂流",
    kind: "cold",
    path: [
      [20.0, -47.0], [50.0, -46.0], [90.0, -48.0], [130.0, -52.0], [170.0, -57.0],
      [210.0, -59.0], [250.0, -58.0], [290.0, -57.0], [305.0, -55.0], [330.0, -48.0], [355.0, -45.5], [380.0, -47.0],
    ],
  },
];

/** Catmull–Rom 取樣數。控制點之間插這麼多段，曲線在世界尺度上就看不出折角。 */
const CURRENT_SAMPLES = 10;
/** 箭羽在畫面上的長度（度經度）。 */
const CURRENT_BARB = 3.4;
/** 每隔大約這麼長（畫面上的度）放一支箭頭。 */
const CURRENT_ARROW_EVERY = 42;

/** Catmull–Rom 平滑（連續經度空間，端點各自重複一次）。 */
function smooth(path: [number, number][]): [number, number][] {
  const p = [path[0], ...path, path[path.length - 1]];
  const out: [number, number][] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let s = 0; s < CURRENT_SAMPLES; s++) {
      const t = s / CURRENT_SAMPLES;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((k) =>
        0.5 *
        ((2 * p1[k]) +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
      ) as [number, number]);
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

/** 緯度 → Mercator 的縱向拉伸倍率（畫面上的 dy = dLat / cos(lat)）。 */
const stretch = (lat: number) => Math.cos((Math.min(Math.abs(lat), 84) * Math.PI) / 180);

/**
 * 一支箭頭（只有兩根箭羽，軸就是洋流本身）。
 *
 * 方向先換算到**畫面空間**再旋轉，回來時才乘上 `cos(lat)`——不做這一步的話，
 * 西風漂流（南緯 47–59°）的箭羽會被縱向拉成兩根幾乎垂直的長線。
 */
function currentBarbs(from: [number, number], tip: [number, number]): [number, number][][] {
  const k = stretch(tip[1]);
  const sx = tip[0] - from[0];
  const sy = (tip[1] - from[1]) / k;
  const len = Math.hypot(sx, sy) || 1;
  const [ux, uy] = [-sx / len, -sy / len];
  return [28, -28].map((deg) => {
    const r = (deg * Math.PI) / 180;
    const x = (ux * Math.cos(r) - uy * Math.sin(r)) * CURRENT_BARB;
    const y = (ux * Math.sin(r) + uy * Math.cos(r)) * CURRENT_BARB;
    return [tip, [tip[0] + x, tip[1] + y * k]];
  });
}

/**
 * 把連續經度的線切成不跨越 ±180 的幾段，並在換日線上補一個端點。
 *
 * ⚠️ 補端點是必要的：直接在跨越處斷開，線會在畫面邊緣前幾度就停住，看起來像
 * 資料缺了一塊。
 */
function splitAntimeridian(line: [number, number][]): [number, number][][] {
  const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
  const out: [number, number][][] = [];
  let seg: [number, number][] = [[wrap(line[0][0]), line[0][1]]];
  for (let i = 1; i < line.length; i++) {
    const [lon0, lat0] = line[i - 1];
    const [lon1, lat1] = line[i];
    // 連續空間裡跨過 180 的奇數倍就是跨了換日線
    const crossings = Math.floor((lon1 + 180) / 360) - Math.floor((lon0 + 180) / 360);
    if (crossings === 0) {
      seg.push([wrap(lon1), lat1]);
      continue;
    }
    const edge = 180 + 360 * Math.min(Math.floor((lon0 + 180) / 360), Math.floor((lon1 + 180) / 360));
    const t = (edge - lon0) / (lon1 - lon0);
    const latEdge = lat0 + (lat1 - lat0) * t;
    const sign = lon1 > lon0 ? 1 : -1;
    seg.push([180 * sign, latEdge]);
    out.push(seg);
    seg = [[-180 * sign, latEdge], [wrap(lon1), lat1]];
  }
  out.push(seg);
  return out.filter((s) => s.length > 1);
}

function oceanCurrents(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: OCEAN_CURRENTS.map((current) => {
      const line = smooth(current.path);

      // 依畫面長度平均安排箭頭，最後一支一定在終點（洋流的去向）
      const screenLen = (a: [number, number], b: [number, number]) =>
        Math.hypot(b[0] - a[0], (b[1] - a[1]) / stretch((a[1] + b[1]) / 2));
      let total = 0;
      for (let i = 1; i < line.length; i++) total += screenLen(line[i - 1], line[i]);
      const arrows = Math.max(1, Math.round(total / CURRENT_ARROW_EVERY));
      const barbs: [number, number][][] = [];
      for (let a = 1; a <= arrows; a++) {
        const at = Math.round(((line.length - 1) * a) / arrows);
        barbs.push(...currentBarbs(line[Math.max(0, at - 1)], line[at]));
      }

      return {
        type: "Feature",
        geometry: {
          type: "MultiLineString",
          coordinates: [...splitAntimeridian(line), ...barbs.flatMap(splitAntimeridian)],
        },
        properties: { id: current.id, name: current.name, kind: current.kind },
      };
    }),
  };
}

const GENERATORS: Record<GeneratorId, () => GeoJSON.FeatureCollection> = {
  "latitude-lines": latitudeLines,
  "wind-belts": windBelts,
  "ocean-currents": oceanCurrents,
};

export function generateLayer(id: GeneratorId): GeoJSON.FeatureCollection {
  return GENERATORS[id]();
}
