/**
 * 板塊與板塊邊界（Bird 2003 的 PB2002 模型）的存取層。
 *
 * ## 為什麼是 Bird (2003) 而不是別的
 *
 * 這是**唯一**一份公開、帶完整幾何、而且每一段邊界都標了種類的全球板塊模型；
 * 課本講的「聚合、張裂、錯動三種板塊邊界」要畫得出來，就得有那個分類欄位。
 * Natural Earth 沒有板塊，USGS 只有靜態圖片。
 *
 * 幾何取自 Hugo Ahlenius / Nordpil 轉製的 GeoJSON 版（原始資料是 Bird 自己發布的
 * 文字檔）。授權是 **ODC-BY 1.0**：可以自由使用，但**必須標示出處**——所以
 * `plates` 與 `plate-boundaries` 兩層的 `sources` 都要同時列 Peter Bird 與 Nordpil，
 * 少一個就違反授權。
 *
 * ⚠️ 這份資料的 -180/180 分割是轉製者手動處理過的（README 有寫），所以跨換日線的
 * 板塊（太平洋、澳洲）在檔案裡本來就是 MultiPolygon。**不要自己再去接它們**。
 */

const GEOJSON =
  "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON";

/** 板塊面（52 塊，其中太平洋與澳洲因為跨換日線而是 MultiPolygon）。 */
export const PLATES_URL = `${GEOJSON}/PB2002_plates.json`;

/**
 * 邊界的「step」檔（5,824 段）。
 *
 * ⚠️ **不要改用同一個資料夾裡的 `PB2002_boundaries.json`**：那份只有 241 條乾淨的
 * 線，但 `Type` 欄位**只分得出 subduction（65 條）與空字串（176 條）**，畫不出課本
 * 要的三分類。step 檔雖然有 10 MB，但它每一段都帶 `STEPCLASS`（OSR／CRB／OTF／
 * CTF／SUB／OCB／CCB），那正是三分類的依據。只在建置期抓，產物只有幾十 KB。
 */
export const STEPS_URL = `${GEOJSON}/PB2002_steps.json`;

export const LICENSE = "Open Data Commons Attribution License 1.0（ODC-BY）";
/** ⚠️ ODC-BY 要求標示出處，兩個都要列（見檔頭）。 */
export const SOURCE_LABELS = ["Peter Bird (2003) 板塊模型", "Nordpil 板塊資料集"];

/**
 * 三種板塊邊界。`classes` 是 Bird 的 `STEPCLASS` 代碼。
 *
 * ⚠️ 陣列順序就是圖層抽屜與圖例的順序，依課本講述的順序排（張裂 → 聚合 → 錯動）。
 */
export const BOUNDARY_TYPES = [
  {
    id: "divergent",
    name: "張裂型邊界",
    /** OSR＝中洋脊（海洋擴張脊）、CRB＝大陸裂谷 */
    classes: ["OSR", "CRB"],
  },
  {
    id: "convergent",
    name: "聚合型邊界",
    /** SUB＝隱沒帶、OCB＝海洋聚合邊界、CCB＝大陸聚合（碰撞）邊界 */
    classes: ["SUB", "OCB", "CCB"],
  },
  {
    id: "transform",
    name: "錯動型邊界",
    /** OTF＝海洋轉形斷層、CTF＝大陸轉形斷層 */
    classes: ["OTF", "CTF"],
  },
];

/** `STEPCLASS` → 三分類 id。建置時對不到就讓建置失敗，不要靜默丟掉。 */
export const STEP_CLASS_TO_TYPE = Object.fromEntries(
  BOUNDARY_TYPES.flatMap((t) => t.classes.map((c) => [c, t.id])),
);

/**
 * 分類的顯示順序。`browse.groupBy: "category"` 是**依序切、不排序**的，
 * 所以產物裡同一類的板塊必須連續，見 build-geodata.mjs 的 transform。
 */
export const CATEGORY_ORDER = ["主要板塊", "次要板塊", "微板塊"];

/**
 * Bird 的板塊代碼 → 本站的 id、中文名與分類。**52 筆，一筆不能少**
 * （`fetchPlates()` 會檢查），對不到就讓建置失敗——多一塊板塊是要由人決定
 * 中文名與分類的事件，不是可以自動猜的。
 *
 * 中文名與分類取自維基百科〈板塊列表〉（zh-tw），比照五大山脈與颱風對照表的既有
 * 做法：維基百科是次級來源，只用來查已有共識的名稱，數值一律另外由幾何算。
 *
 * ⚠️ **主要板塊在這裡是 8 塊，不是課本說的 7 塊。** Bird 把課本合稱的「印澳板塊」
 * 分成印度板塊與澳洲板塊兩塊，所以圖上會是 8 塊。這件事寫在圖層的 `notes` 裡，
 * 不要為了湊 7 塊把其中一塊降級——那會讓地圖跟資料對不起來。
 */
export const PLATES = {
  // 主要板塊（8）
  PA: { id: "plate-pa", name: "太平洋板塊", category: "主要板塊" },
  NA: { id: "plate-na", name: "北美板塊", category: "主要板塊" },
  EU: { id: "plate-eu", name: "歐亞板塊", category: "主要板塊" },
  AF: { id: "plate-af", name: "非洲板塊", category: "主要板塊" },
  AN: { id: "plate-an", name: "南極板塊", category: "主要板塊" },
  AU: { id: "plate-au", name: "澳洲板塊", category: "主要板塊" },
  SA: { id: "plate-sa", name: "南美板塊", category: "主要板塊" },
  IN: { id: "plate-in", name: "印度板塊", category: "主要板塊" },
  // 次要板塊（14）
  SO: { id: "plate-so", name: "索馬利亞板塊", category: "次要板塊" },
  NZ: { id: "plate-nz", name: "納斯卡板塊", category: "次要板塊" },
  PS: { id: "plate-ps", name: "菲律賓海板塊", category: "次要板塊" },
  AR: { id: "plate-ar", name: "阿拉伯板塊", category: "次要板塊" },
  CA: { id: "plate-ca", name: "加勒比板塊", category: "次要板塊" },
  CO: { id: "plate-co", name: "科科斯板塊", category: "次要板塊" },
  CL: { id: "plate-cl", name: "加洛林板塊", category: "次要板塊" },
  SC: { id: "plate-sc", name: "斯科舍板塊", category: "次要板塊" },
  BU: { id: "plate-bu", name: "緬甸板塊", category: "次要板塊" },
  NH: { id: "plate-nh", name: "新海布里地板塊", category: "次要板塊" },
  AM: { id: "plate-am", name: "阿穆爾板塊", category: "次要板塊" },
  OK: { id: "plate-ok", name: "鄂霍次克板塊", category: "次要板塊" },
  SU: { id: "plate-su", name: "巽他板塊", category: "次要板塊" },
  YA: { id: "plate-ya", name: "揚子板塊", category: "次要板塊" },
  // 微板塊（30）
  TI: { id: "plate-ti", name: "帝汶板塊", category: "微板塊" },
  KE: { id: "plate-ke", name: "克馬德克板塊", category: "微板塊" },
  TO: { id: "plate-to", name: "湯加板塊", category: "微板塊" },
  NI: { id: "plate-ni", name: "紐阿福歐板塊", category: "微板塊" },
  WL: { id: "plate-wl", name: "木百靈板塊", category: "微板塊" },
  MO: { id: "plate-mo", name: "毛克板塊", category: "微板塊" },
  SB: { id: "plate-sb", name: "南俾斯麥板塊", category: "微板塊" },
  SS: { id: "plate-ss", name: "所羅門海板塊", category: "微板塊" },
  NB: { id: "plate-nb", name: "北俾斯麥板塊", category: "微板塊" },
  JF: { id: "plate-jf", name: "胡安·德富卡板塊", category: "微板塊" },
  AP: { id: "plate-ap", name: "阿爾蒂普拉諾板塊", category: "微板塊" },
  ND: { id: "plate-nd", name: "北安地斯板塊", category: "微板塊" },
  ON: { id: "plate-on", name: "沖繩板塊", category: "微板塊" },
  MA: { id: "plate-ma", name: "馬里亞納板塊", category: "微板塊" },
  FT: { id: "plate-ft", name: "富圖納板塊", category: "微板塊" },
  SL: { id: "plate-sl", name: "設得蘭板塊", category: "微板塊" },
  AS: { id: "plate-as", name: "愛琴海板塊", category: "微板塊" },
  AT: { id: "plate-at", name: "安那托利亞板塊", category: "微板塊" },
  RI: { id: "plate-ri", name: "里維拉板塊", category: "微板塊" },
  BH: { id: "plate-bh", name: "鳥首板塊", category: "微板塊" },
  MS: { id: "plate-ms", name: "摩鹿加海板塊", category: "微板塊" },
  BS: { id: "plate-bs", name: "班達海板塊", category: "微板塊" },
  MN: { id: "plate-mn", name: "馬努斯板塊", category: "微板塊" },
  CR: { id: "plate-cr", name: "康威礁板塊", category: "微板塊" },
  BR: { id: "plate-br", name: "巴爾莫勒爾礁板塊", category: "微板塊" },
  EA: { id: "plate-ea", name: "復活節島板塊", category: "微板塊" },
  JZ: { id: "plate-jz", name: "胡安·費爾南德斯板塊", category: "微板塊" },
  GP: { id: "plate-gp", name: "加拉巴哥板塊", category: "微板塊" },
  SW: { id: "plate-sw", name: "南桑威奇板塊", category: "微板塊" },
  PM: { id: "plate-pm", name: "巴拿馬板塊", category: "微板塊" },
};

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * 球面上一個環的立體角（steradian），帶號。
 *
 * ⚠️ **不可以用平面多邊形面積（shoelace）代替**：那算出來的單位是「平方度」，
 * 在高緯度會嚴重高估——南極板塊會變成比太平洋板塊還大。這條公式是標準的球面
 * 多邊形面積，`ringsAreaKm2()` 的總和實測等於地球表面積 510.1 百萬 km²，那是
 * 這段程式唯一有意義的自我檢查。
 */
function ringSteradians(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return total / 2;
}

/** GeoJSON 幾何（Polygon／MultiPolygon）的球面面積，單位平方公里。 */
export function geometryAreaKm2(geometry) {
  const polygonArea = (rings) =>
    rings.reduce((sum, ring, i) => sum + (i === 0 ? 1 : -1) * Math.abs(ringSteradians(ring)), 0);
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((sum, rings) => sum + polygonArea(rings), 0) * EARTH_RADIUS_KM ** 2;
}

/**
 * 給人看的面積字串。板塊的量級橫跨五個數量級（巴爾莫勒爾礁 20 萬 ↔ 太平洋 1 億），
 * 所以要兩種寫法。
 *
 * ⚠️ 門檻是 **1 億**不是 1 千萬：北美板塊 5,543 萬 km² 寫成「0.55 億 km²」中文讀起來
 * 很彆扭，而那是主要板塊裡最常被讀到的一個。
 */
export function formatArea(km2) {
  if (km2 >= 1e8) return `${(km2 / 1e8).toFixed(2)} 億 km²`;
  if (km2 >= 1e4) return `${Math.round(km2 / 1e4).toLocaleString("en-US")} 萬 km²`;
  return `${Math.round(km2).toLocaleString("en-US")} km²`;
}
