/**
 * 臺灣與鄰國專屬經濟海域（Marine Regions Maritime Boundaries v12）的存取層。
 *
 * ## 為什麼不是官方資料
 *
 * **中華民國從來沒有公告過經濟海域外界線的座標。**《中華民國專屬經濟海域及大陸礁層法》
 * （1998）宣告 200 浬，但第 3 條寫的是外界線「由行政院訂定，並得分批公告之」——至今
 * 沒有公告。實際公告過的是行政院 1999-02-10「中華民國第一批領海基線、領海及鄰接區
 * 外界線」（2009-11-18 修正），只有**基線、12 浬領海、24 浬鄰接區**；經濟海域的執法
 * 依據另有 2003-11-07 核定的「中華民國第一批專屬經濟海域**暫定執法線**」。
 *
 * 那份官方向量圖資在海洋委員會 NODASS（nodass.namr.gov.tw）圖台上看得到，但**下載
 * 要會員登入**，直接撞上 CLAUDE.md 硬性禁止事項 #1。所以這一層只能用第三方模型，
 * 比照 Bird (2003) 板塊模型的既有判例（見 lib/plates.mjs 的檔頭）：公開、帶完整
 * 幾何、每一片都標明主張方，並且把授權署名與模型限制講清楚。
 *
 * ## 這份資料在說什麼（會影響文案，不要看漏）
 *
 * - 臺灣那一片上游標的是 **Overlapping claim Taiwan: Taiwan / China**，`pol_type`
 *   是 `Overlapping claim` 而不是 `200NM`。它不是「我國的經濟海域」，是「這片海
 *   臺灣與中國都主張」。**文案不可以把它寫成我國既定海域。**
 * - 它的西界是與中國的中線、東界是與日本的中線（實測 123.0°E／23.5°N 已在界外，
 *   因為那裡離與那國比離臺灣近）。**這些界線是等距推算出來的，不是任何條約或公告。**
 * - 收錄含澎湖周邊與東沙群島（南伸到 17.3°N），**不含金門馬祖、南沙、中沙**。
 *   南沙／中沙那一片上游歸在 `Overlapping claim: South China Sea`（mrgid 49003），
 *   主張方只列中國，所以這一層沒有太平島與中沙——那是收錄範圍的缺口，不是漏掉。
 * - Marine Regions **沒有臺灣的 12 浬／24 浬圖層**（`eez_12nm`／`eez_24nm` 在臺灣
 *   附近只有中、日、菲），所以領海與鄰接區這一層做不出來。
 * - 上游自己聲明這份資料 "not meant to be used for legal, economical or navigational
 *   purposes… developed solely for scientific, educational and research purposes"。
 *
 * ## 授權
 *
 * **CC-BY（Maritime Boundaries v11 起）**，要求標示出處。所以圖層與**每一份內容檔**
 * 的 `sources` 都必須列 `Marine Regions 海域界線資料庫`——`FeatureCard` 有內容檔時
 * 顯示的是內容檔的 `sources`，只寫在圖層定義上是看不到的（比照 tw-rivers 對
 * OpenStreetMap 的 ODbL 署名，那個坑記在 CLAUDE_TW.md）。
 */

import { geometryAreaKm2 } from "./plates.mjs";

const WFS = "https://geo.vliz.be/geoserver/MarineRegions/wfs";

/**
 * 四片海域的 WFS 查詢。
 *
 * ⚠️ **用 `mrgid` 篩，不要用 `territory1='Taiwan'` 之類的名稱欄位。** mrgid 是
 * Marine Regions 的永久識別碼（跟河川用水利署代碼、板塊用 Bird 代碼是同一個理由）；
 * 名稱欄位在「重疊主張」那兩筆上的填法跟一般 200NM 海域不一樣，實測用
 * `sovereign1='Taiwan'` 選得到兩筆、用 `territory1` 只選得到一筆。
 */
export const EEZ_URL =
  `${WFS}?service=WFS&version=1.1.0&request=GetFeature` +
  `&typeName=MarineRegions:eez&outputFormat=application/json` +
  `&CQL_FILTER=${encodeURIComponent("mrgid IN (8321,8322,8487,48954)")}`;

export const LICENSE = "Creative Commons Attribution（CC-BY）";
/** ⚠️ CC-BY 要求標示出處，這個字串要跟內容檔的 `sources` 逐字一致。 */
export const SOURCE_LABEL = "Marine Regions 海域界線資料庫";
export const SOURCE_URL = "https://www.marineregions.org/eezsearch.php";

/**
 * 裁切框 `[西, 南, 東, 北]`。
 *
 * 日本的經濟海域東到 157.6°E、菲律賓南到 3.1°N。整片畫進臺灣主題是錯的：
 * `fitBounds` 會飛到整個西太平洋，而這個主題的建議底圖 NLSC 只有臺灣範圍，
 * 拉遠之後畫面上是一片沒有圖磚的空白。裁切之後產物 ~100 KB，不裁是 ~940 KB。
 *
 * ⚠️ **邊界值挑在畫面外**：zoom 7 的視野約 21 個經度（以 121°E 為中心約
 * 110.5–131.5），所以 108／136 這兩條邊在教學會用的縮放尺度上看不到。再往外拉
 * 就會看到那兩條**筆直的**邊——那是裁切線不是海域界線，圖層的 `notes` 有交代。
 */
export const CLIP_BOX = [108, 8, 136, 34];

/**
 * 四筆海域：`mrgid` → 本站 id、中文名、短名、分類。
 *
 * ⚠️ **`id` 同時是三個東西**：geojson 的 `properties.id`、註冊表 `LayerItem` 的
 * item id、以及 `src/content/geo/tw-eez/<id>.json` 的檔名。三者一致，點子項目名稱
 * 才會開出那片海域的內容檔（比照交通軸線十條的既有做法）。
 *
 * ⚠️ 陣列順序就是圖層抽屜與圖例的順序。
 *
 * `simplify` 是**逐圖徵**的簡化參數，理由見 build-geodata.mjs 的 transform：
 * 臺灣本島那個洞（＝陸地）必須留在 0.0008°，否則海域面染會蓋過海岸線好幾公里；
 * 日、菲的島嶼細節在這個主題沒有教學意義，粗掉即可。
 */
export const EEZ_ZONES = [
  {
    mrgid: 8321,
    id: "taiwan",
    name: "臺灣周邊專屬經濟海域",
    shortName: "臺灣",
    /** ⚠️ 上游的 `pol_type` 是 `Overlapping claim`，不是 `200NM`，見檔頭 */
    category: "臺灣與中國重疊主張",
    simplify: { outer: 0.002, hole: 0.0008, minHoleDiag: 0.01 },
  },
  {
    mrgid: 8487,
    id: "japan",
    name: "日本專屬經濟海域",
    shortName: "日本",
    category: "鄰國專屬經濟海域",
    simplify: { outer: 0.02, hole: 0.02, minHoleDiag: 0.25 },
  },
  {
    mrgid: 8322,
    id: "philippines",
    name: "菲律賓專屬經濟海域",
    shortName: "菲律賓",
    category: "鄰國專屬經濟海域",
    simplify: { outer: 0.02, hole: 0.02, minHoleDiag: 0.25 },
  },
  {
    mrgid: 48954,
    id: "senkaku",
    name: "釣魚臺列嶼周邊爭議海域",
    shortName: "釣魚臺周邊",
    category: "臺灣、日本與中國重疊主張",
    simplify: { outer: 0.002, hole: 0.0008, minHoleDiag: 0.01 },
  },
];

export const EEZ_BY_MRGID = new Map(EEZ_ZONES.map((z) => [z.mrgid, z]));

/**
 * 把一個環裁切到矩形範圍內（Sutherland–Hodgman）。
 *
 * 自己寫是刻意的，比照 lib/simplify.mjs 與 lib/dissolve.mjs：整包只為了對一個
 * **矩形**（凸多邊形）裁切，用不著真正的多邊形裁剪器。剩下的退化情形（沿著裁切邊
 * 走出來的零面積邊）在面染上看不出來，而外框本來就會沿著裁切邊畫一條線。
 *
 * @param ring 閉合環（頭尾同點）
 * @param box `[西, 南, 東, 北]`
 * @returns 裁切後的閉合環，完全在框外時回 null
 */
export function clipRingToBox(ring, box) {
  const [west, south, east, north] = box;
  /** `[座標軸索引, 保留的方向（1＝大於等於）, 門檻]` */
  const edges = [
    [0, 1, west],
    [0, -1, east],
    [1, 1, south],
    [1, -1, north],
  ];

  let out = ring.slice(0, -1);
  for (const [axis, sign, value] of edges) {
    const inside = (p) => (sign > 0 ? p[axis] >= value : p[axis] <= value);
    const intersect = (a, b) => {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    };
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      const aIn = inside(a);
      const bIn = inside(b);
      if (aIn) next.push(a);
      if (aIn !== bIn) next.push(intersect(a, b));
    }
    out = next;
    if (out.length === 0) return null;
  }
  out.push(out[0]);
  return out.length >= 4 ? out : null;
}

/** 環的 bounding box 對角線長度（度）。用來丟掉小到看不見的陸地洞。 */
export function ringDiagonal(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/**
 * 面積交叉比對：用球面公式重算的面積 vs 上游 `area_km2`。
 *
 * ⚠️ **一定要在裁切與簡化之前算**（比照板塊那一層的既有註解）。這是唯一能抓到
 * 「幾何抓錯、環的內外判斷反了、上游改版」的檢查——比照國家公園的 `officialHa`
 * 與板塊的「面積總和＝地球表面積」。實測 8321 重算 356,428 vs 上游 355,433（+0.28%）。
 *
 * @returns 給日誌用的一行字
 */
export function checkArea(zone, geometry, upstreamKm2) {
  const computed = geometryAreaKm2(geometry);
  const diff = computed / upstreamKm2 - 1;
  if (Math.abs(diff) > 0.2) {
    throw new Error(
      `${zone.name} 重算面積 ${Math.round(computed).toLocaleString("en-US")} km²，` +
        `與上游 ${upstreamKm2.toLocaleString("en-US")} 差 ${(diff * 100).toFixed(1)}%——幾何可能抓錯了`,
    );
  }
  const flag = Math.abs(diff) > 0.05 ? "  ⚠ 差距偏大" : "";
  return (
    `  · ${zone.name}：上游 ${upstreamKm2.toLocaleString("en-US")} km²、` +
    `重算 ${Math.round(computed).toLocaleString("en-US")} km²（差 ${(diff * 100).toFixed(2)}%）${flag}`
  );
}

/**
 * 給人看的面積字串。四片的量級從 7 萬到 400 萬 km²，統一用「萬 km²」讀起來最順，
 * 但卡片上要看得到確切數字，所以另外保留 `area_km2`。
 */
export function formatArea(km2) {
  return `約 ${Math.round(km2).toLocaleString("en-US")} km²`;
}
