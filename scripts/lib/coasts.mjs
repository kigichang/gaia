/**
 * 臺灣本島海岸地形分段的存取層。
 *
 * ## 幾何是算出來的，不是手繪的
 *
 * 海岸線本身是精確且公開的事實（比照交通軸線那節的判斷：可查證的東西不該降級成
 * 示意線），所以這一層**不進 `geo-manual`**，而是從**內政部國土測繪中心的縣市界
 * GML**（政府資料開放平臺資料集 7442，跟 `tw-counties` 同一份）算出來：
 *
 * 1. 取本島 19 個縣市的大塊多邊形（排除連江、金門、澎湖）；
 * 2. 用 `lib/dissolve.mjs` 的有向邊相消把它們併成一個環——**縣市界就是同一份拓樸
 *    切出來的**，相鄰縣市共用的邊逐位元相同、方向相反，所以相消得掉；
 * 3. 在四個分界點把環切成四段。
 *
 * ⚠️ **一定要對「原始 GML」做相消，不能對 `tw-counties.geojson` 做。** 那份產物是
 * **逐縣市**簡化過的（tolerance 0.0008），Douglas–Peucker 不保拓樸，共用邊界因此
 * 不再逐位元相同——實測拿它去相消會得到 **103 個碎環**而不是一個島。
 *
 * ⚠️ **輸入的環要先轉成逆時針。** `parseNlscGml` 不保證繞行方向，而 `dissolveRings`
 * 是靠帶號面積的正負號分外環／內環的：不轉的話串出來的環全部是負的，函式會丟
 * 「合併後沒有任何外環」。⚠️ `lib/gml.mjs` 的 `ringArea()` 回的是**絕對值**，
 * 判斷方向要自己算帶號面積（這裡的 `signedArea`）。
 *
 * ℹ️ 相消之後除了本島還會多出兩塊：**臺北市（272 km²）與嘉義市（60 km²）**。那兩個
 * 是被完全包住的飛地，它們與母縣市之間的邊沒有相消掉，於是各自成環。**本島那一個
 * 環不受影響**（它是最大的一個，實測 31,695 點、36,562 km²，周長 1,193 km ≈ 官方的
 * 1,200 公里），所以直接取面積最大的那一塊。
 *
 * ## 分界點取自站上既有的資料，不另外抄一份座標
 *
 * 分類與四個分界點來自維基百科〈台灣海岸〉：北部岬灣海岸「西起淡水河口，東至三貂角」、
 * 西部砂泥海岸「北起淡水河口，南至屏東縣枋山鄉楓港」、恆春半島珊瑚礁海岸「東起屏東縣
 * 滿州鄉九棚，西至楓港」、東部斷層海岸「北起三貂角，南至九棚」。
 *
 * 那四個地名在站上都已經有座標，所以**從既有檔案讀，不要抄第二份**（比照北回歸線的
 * 緯度值從 `LATITUDE_LINES` 撈、五大山脈主峰的座標從 `src/content/places` join）：
 *
 * | 分界點 | 來源 |
 * |---|---|
 * | 三貂角 | `geo-manual/tw-territory.geojson` 的 `taiwan-east-point`（本島極東點，由 NLSC 縣市界頂點算出） |
 * | 淡水河口 | `geo/tw-rivers.geojson` 淡水河那條線的**海側端點** |
 * | 楓港溪口 | 同上，楓港溪 |
 * | 九棚溪口 | 同上，九棚溪 |
 *
 * ⚠️ 河川線是 OSM 的實測河道，端點不一定正好落在 NLSC 的海岸線上（實測淡水河口差
 * 1.0 公里、其餘三個都在 0.1 公里內），所以是「取環上最近的頂點」當切點，不是硬接。
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dissolveRings, geodesicArea } from "./dissolve.mjs";
import { parseNlscGml, ringArea } from "./gml.mjs";
import { readZipText } from "./unzip.mjs";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "內政部國土測繪中心";
export const DATASET_ID = 7442;

/** 連江、金門、澎湖不屬於本島海岸線。 */
const OFFSHORE_COUNTIES = new Set(["連江縣", "金門縣", "澎湖縣"]);

/**
 * 只取夠大的塊（度² ≈ 5e-3 約 60 km²）。
 *
 * 目的不是過濾礁岩，而是**不要把離岸小島的環丟進相消**——它們跟本島沒有共用邊，
 * 會各自留下一個環，之後還要再挑一次。
 */
const MIN_PART_DEG2 = 5e-3;

/** 本島周長的合理範圍（公里）。差太多就是挑錯環或投影不對。 */
const PERIMETER_RANGE = [1050, 1350];

/**
 * 四段海岸。順序就是圖層抽屜裡可點清單的順序，照維基百科〈台灣海岸〉的章節排。
 *
 * `from`／`to` 是**沿著環的走向**（實測本島環是逆時針：三貂角 → 北海岸向西 →
 * 淡水河口 → 西海岸向南 → 楓港 → 南岸向東 → 九棚 → 東海岸向北 → 回三貂角）。
 *
 * `literatureKm` 是那篇條目寫的長度。⚠️ **它跟本站量出來的不是同一種數字**：條目
 * 給的是概略的段長，本站畫的是 NLSC 逐灣逐岬的實測岸線，量出來一定比較長
 * （實測 140／537／95／422，合計 1,194 公里 ≈ 官方本島岸線 1,200 公里）。
 * 兩個都印在建置日誌上，卡片寫的是條目的數字並註明差異——比照河川長度那條
 * 「兩種基準的數字不放進同一個欄位」的既有規則。
 */
export const COASTS = [
  {
    id: "tw-coast-north",
    name: "北部岬灣海岸",
    shortName: "北部海岸",
    en: "Northern Headland-and-Bay Coast",
    from: "三貂角",
    to: "淡水河口",
    range: "淡水河口－三貂角",
    literatureKm: 80,
  },
  {
    id: "tw-coast-west",
    name: "西部砂泥海岸",
    shortName: "西部海岸",
    en: "Western Sandy-and-Muddy Coast",
    from: "淡水河口",
    to: "楓港溪口",
    range: "淡水河口－楓港",
    literatureKm: 400,
  },
  {
    id: "tw-coast-hengchun",
    name: "恆春半島珊瑚礁海岸",
    shortName: "恆春半島",
    en: "Hengchun Peninsula Coral Reef Coast",
    from: "楓港溪口",
    to: "九棚溪口",
    range: "楓港－九棚",
    literatureKm: 90,
  },
  {
    id: "tw-coast-east",
    name: "東部斷層海岸",
    shortName: "東部海岸",
    en: "Eastern Fault Coast",
    from: "九棚溪口",
    to: "三貂角",
    range: "三貂角－九棚",
    literatureKm: 380,
  },
];

/** 分界點：站上哪一份檔案的哪一個圖徵。 */
const SPLIT_POINTS = [
  { name: "三貂角", file: "public/data/geo-manual/tw-territory.geojson", id: "taiwan-east-point" },
  { name: "淡水河口", file: "public/data/geo/tw-rivers.geojson", id: "danshui-river", end: true },
  { name: "楓港溪口", file: "public/data/geo/tw-rivers.geojson", id: "fenggang-river", end: true },
  { name: "九棚溪口", file: "public/data/geo/tw-rivers.geojson", id: "jiupeng-river", end: true },
];

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
}

export function lineLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** 帶號面積（正＝逆時針）。⚠️ `gml.mjs` 的 `ringArea()` 回絕對值，不能拿來判方向。 */
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

/**
 * 從站上既有的 geojson 讀出一個分界點的座標。
 *
 * `end: true` 代表要的是那條線的**海側端點**（河川線是由源頭往下游畫的，最後一個點
 * 就是出海口）。找不到就直接失敗——分界點錯掉的話四段海岸會整個接錯，而畫面上
 * 只會看起來像「線畫歪了」。
 */
async function readSplitPoint(root, spec) {
  const fc = JSON.parse(await readFile(join(root, spec.file), "utf8"));
  const feature = fc.features.find((f) => f.properties?.id === spec.id);
  if (!feature) {
    throw new Error(`${spec.name}：${spec.file} 裡找不到 id 為 ${spec.id} 的圖徵`);
  }
  const g = feature.geometry;
  if (g.type === "Point") return g.coordinates;
  const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
  const points = lines.flat();
  return spec.end ? points[points.length - 1] : points[0];
}

export async function fetchCoasts(fetchWithRetry, resolveUrl, root) {
  const warnings = [];

  const url = await resolveUrl();
  const buf = Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
  const features = parseNlscGml(readZipText(buf, (n) => n.toLowerCase().endsWith(".gml")));

  const rings = [];
  for (const f of features) {
    if (OFFSHORE_COUNTIES.has(f.properties.名稱)) continue;
    for (const polygon of f.geometry.coordinates) {
      const outer = polygon[0];
      if (ringArea(outer) < MIN_PART_DEG2) continue;
      // dissolveRings 靠帶號面積分外環／內環，輸入必須統一成逆時針
      rings.push(signedArea(outer) > 0 ? outer : [...outer].reverse());
    }
  }
  if (rings.length === 0) throw new Error("縣市界 GML 裡沒有本島級的多邊形，上游欄位可能變了");

  const polygons = dissolveRings(rings, "臺灣本島海岸線", 0);
  // 最大的那一塊就是本島；另外兩塊是臺北市與嘉義市那兩個飛地（見檔頭）
  const island = polygons
    .map((p) => ({ ring: p[0], area: Math.abs(geodesicArea([p])) }))
    .sort((a, b) => b.area - a.area)[0].ring;

  const perimeter = lineLengthKm([...island, island[0]]);
  if (perimeter < PERIMETER_RANGE[0] || perimeter > PERIMETER_RANGE[1]) {
    throw new Error(
      `本島海岸線周長 ${perimeter.toFixed(0)} 公里落在合理範圍 ` +
        `${PERIMETER_RANGE.join("–")} 之外，可能挑錯環`,
    );
  }
  warnings.push(
    `本島海岸線 ${island.length} 點／周長 ${perimeter.toFixed(0)} 公里（官方約 1,200 公里）`,
  );

  /** 分界點 → 環上最近的頂點索引。 */
  const index = new Map();
  for (const spec of SPLIT_POINTS) {
    const target = await readSplitPoint(root, spec);
    let best = 0;
    let bestKm = Infinity;
    island.forEach((p, i) => {
      const d = haversineKm(target, p);
      if (d < bestKm) {
        bestKm = d;
        best = i;
      }
    });
    // 3 公里以內才算對得上；差更多代表分界點的來源資料變了
    if (bestKm > 3) {
      throw new Error(`${spec.name}：離海岸線最近的頂點有 ${bestKm.toFixed(1)} 公里，對不上`);
    }
    index.set(spec.name, best);
    warnings.push(`分界點 ${spec.name}：環上第 ${best} 點，距來源座標 ${bestKm.toFixed(2)} 公里`);
  }

  const arc = (a, b) => (a <= b ? island.slice(a, b + 1) : [...island.slice(a), ...island.slice(0, b + 1)]);

  return {
    features: COASTS.map((coast) => {
      const points = arc(index.get(coast.from), index.get(coast.to));
      const km = lineLengthKm(points);
      warnings.push(
        `${coast.name}：${points.length} 點／量得 ${km.toFixed(0)} 公里（文獻約 ${coast.literatureKm} 公里）`,
      );
      return {
        type: "Feature",
        geometry: { type: "LineString", coordinates: points },
        properties: {
          id: coast.id,
          name: coast.name,
          shortName: coast.shortName,
          en: coast.en,
          meta: `${coast.range}・約 ${coast.literatureKm} 公里`,
        },
      };
    }),
    warnings,
  };
}
