/**
 * 惠特里西《世界主要農業區》（Whittlesey 1936）的**教學示意分區**。
 *
 * ## ⚠️ 這一層跟本站其他圖層不一樣：它沒有上游資料集
 *
 * 惠特里西那份分類是 1936 年的**製圖分類**，活在論文的兩張摺頁圖版與課本圖版裡，
 * **沒有任何人把它發成開放的向量資料**（查過 FAO 全目錄、ArcGIS Online、
 * Harvard Dataverse 與 Natural Earth）。所以這一層的分區範圍是**編者依原圖版
 * 與論文內文判讀後手寫出來的**，每一張說明卡都標 `schematic: true`。
 *
 * 原始出處：Whittlesey, D. (1936) "Major Agricultural Regions of the Earth",
 * *Annals of the Association of American Geographers* 26(4): 199–240。
 * 圖版是 Goode's 201 HC 底圖的**東西兩半球兩張**，不是一張世界圖——所以任何
 * 單張世界版（包括課本上那張）本來就已經是重新投影、重新描過的。
 *
 * ## 為什麼用「方框 → 網格 → dissolve」而不是直接手繪多邊形
 *
 * 12 個類型要鋪滿全球陸地，而手繪的面**沒有拓樸保證**：兩個類型稍微疊到，
 * 0.25 不透明度的兩片面就會疊出一個圖例上沒有的顏色；稍微離開，就會露出一條
 * 白縫。12 個類型兩兩之間有 66 對邊界，靠肉眼是抓不完的。
 *
 * 改成「**手寫方框 + 明確的疊畫順序 → 0.5° 網格 → 每格只留一個類型 → dissolve**」
 * 之後，不重疊與不留縫變成**建構上必然成立**，不是驗出來的。手繪的部分仍然是
 * 手繪的——`REGIONS` 裡每一個方框都是人判讀圖版寫下來的。
 *
 * ⚠️ 格距刻意跟「主要農業帶」（FAO SOLAW）一模一樣是 **0.5°**：兩層因此逐格對得起來，
 * 可以直接比較「1936 年的分類」與「2010 年的實測分類」。這是這一層最好的用法。
 *
 * ⚠️ 代價是**邊界是階梯狀的、小島會消失**（形心落在海裡的格會被陸地遮罩濾掉）。
 * 這對一張示意圖是可以接受的，但要寫進 notes。
 *
 * ## 疊畫順序（`REGIONS` 的排列順序就是它，後畫的蓋掉先畫的）
 *
 * 跟圖版本身的建構順序一致：先鋪大面積的底（A 游牧、B 大牧場、C 游耕、K 自給農牧），
 * 再壓上中等的（E／F 集約自給、J 混合農業、I 商業穀物、H 地中海、L 酪農、D 粗放定耕），
 * 最後才是小面積的 G 熱帶栽培業。順序錯了會出現「安地斯被亞馬遜蓋掉」這種錯誤。
 *
 * ⚠️ **`BLANKS` 一定要最後套用。** 惠特里西自己說有第十四類「完全未利用的土地」，
 * 而且圖版上它是**畫在有字母的區域裡面的封閉空白**（撒哈拉整體是 A，只有最乾的
 * 核心是空白），不是整片空白的大陸。
 */

import fs from "node:fs";
import path from "node:path";

export const SOURCE_PAGE =
  "https://cbpbu.ac.in/userfiles/file/2020/STUDY_MAT/GEO/Major%20Agricultural%20Regions%20of%20the%20Earth.pdf";
export const LICENSE = "分類與分區依據為 Whittlesey (1936) 的論文與圖版；界線判讀、簡化與說明文字為本站編寫";
export const SOURCE_LABEL = "Whittlesey《世界主要農業區》（1936）";

/** 產物格距（度）。⚠️ 跟「主要農業帶」（FAO）相同，兩層才逐格對得起來。 */
export const CELL = 0.5;

/**
 * 12 個類型。⚠️ `zh` 用臺灣課本的譯名，`letter` 是圖版上的原始字母——**字母要留著**，
 * 那是讀者回去對照原圖版唯一的鑰匙。
 *
 * ⚠️ 圖版上還有第 13 類 **M 園藝業（Specialized Horticulture）**，這一層**不畫**：
 * 惠特里西自己在圖版上把它畫成「小塊的實心黑點」，而且內文明講「多數這類地區
 * 小到無法在圖上表示」。把幾個點放大成一片色塊會**扭曲原圖**，所以寧可不畫、
 * 在 notes 裡交代。（順帶一提，臺灣的課本世界圖通常也不把園藝業畫成獨立分區。）
 */
export const TYPES = {
  "nomadic-herding": {
    letter: "A",
    zh: "游牧",
    en: "Nomadic Herding",
    meta: "自給・粗放・逐水草而居",
  },
  "livestock-ranching": {
    letter: "B",
    zh: "大牧場放牧業",
    en: "Livestock Ranching",
    meta: "商業・粗放・定居的大農牧場",
  },
  "shifting-cultivation": {
    letter: "C",
    zh: "游耕（遷移農業）",
    en: "Shifting Cultivation",
    meta: "自給・粗放・田地會移動",
  },
  "rudimental-tillage": {
    letter: "D",
    zh: "粗放定耕",
    en: "Rudimental Sedentary Tillage",
    meta: "自給・粗放・田地固定、輪流休耕",
  },
  "intensive-rice": {
    letter: "E",
    zh: "集約自給農業（水稻）",
    en: "Intensive Subsistence Tillage, Rice Dominant",
    meta: "自給・集約・以水田為主",
  },
  "intensive-dry": {
    letter: "F",
    zh: "集約自給農業（旱作）",
    en: "Intensive Subsistence Tillage without Paddy Rice",
    meta: "自給・集約・不種水稻",
  },
  plantation: {
    letter: "G",
    zh: "熱帶栽培業",
    en: "Commercial Plantation Crop Tillage",
    meta: "商業・集約・熱帶的單一作物農園",
  },
  mediterranean: {
    letter: "H",
    zh: "地中海型農業",
    en: "Mediterranean Agriculture",
    meta: "商業・集約・冬雨夏乾",
  },
  "commercial-grain": {
    letter: "I",
    zh: "商業性穀物農業",
    en: "Commercial Grain Farming",
    meta: "商業・粗放・機械化的小麥帶",
  },
  "commercial-mixed": {
    letter: "J",
    zh: "混合農業",
    en: "Commercial Livestock and Crop Farming",
    meta: "商業・集約・作物與牲畜在同一個農場",
  },
  "subsistence-mixed": {
    letter: "K",
    zh: "自給性農牧混合",
    en: "Subsistence Crop and Livestock Farming",
    meta: "自給・作物與牲畜在同一個農場",
  },
  dairying: {
    letter: "L",
    zh: "酪農業",
    en: "Commercial Dairy Farming",
    meta: "商業・集約・冷涼濕潤、靠近市場",
  },
};

/**
 * 六個大類（六個核取方塊）。⚠️ **顏色是大類、圖徵是 12 個類型**，
 * 比照柯本（五色／30 亞型）與「主要農業帶」（六色／10 類）的既有形狀。
 *
 * 併法用的是惠特里西自己的兩條軸線（自給↔商業、粗放↔集約），以及他自己的
 * 第一條判準「作物與牲畜的組合」：
 *
 * - **`crop-livestock`** 收的正是圖版上三個「作物＋牲畜」類型（K／J／L），
 *   它們的差別只在「自給還是商業」與「是不是專門擠奶」。
 * - **`extensive-commercial`** 收 B 與 I：兩者都是新大陸乾燥邊緣上的商業性粗放經營，
 *   在北美就是洛磯山東側那一組同心帶。
 * - **`warm-commercial`** 收 H 與 G：兩者都是暖濕度足夠的地方發展出來、
 *   為市場生產的**多年生／專業化作物**農業。
 */
export const TYPE_GROUPS = [
  { id: "nomadic", label: "游牧", types: ["nomadic-herding"] },
  { id: "shifting-rudimental", label: "游耕與粗放定耕", types: ["shifting-cultivation", "rudimental-tillage"] },
  { id: "intensive-subsistence", label: "集約自給農業", types: ["intensive-rice", "intensive-dry"] },
  { id: "crop-livestock", label: "作物與牲畜混合農牧", types: ["subsistence-mixed", "commercial-mixed", "dairying"] },
  { id: "extensive-commercial", label: "大牧場放牧與商業性穀物", types: ["livestock-ranching", "commercial-grain"] },
  { id: "warm-commercial", label: "地中海型農業與熱帶栽培業", types: ["mediterranean", "plantation"] },
];

{
  const grouped = TYPE_GROUPS.flatMap((g) => g.types);
  const declared = Object.keys(TYPES);
  const missing = declared.filter((t) => !grouped.includes(t));
  if (missing.length) throw new Error(`TYPE_GROUPS 沒有涵蓋類型 ${missing.join("、")}`);
  if (grouped.length !== declared.length) {
    throw new Error(`TYPE_GROUPS 有 ${grouped.length} 個類型，TYPES 有 ${declared.length} 個`);
  }
}

/**
 * 分區範圍：`[類型, [西, 南, 東, 北], 這一塊是哪裡]`。
 *
 * ⚠️ **順序就是疊畫順序，後面的蓋掉前面的**（見檔頭）。搬動任何一列之前，
 * 先想清楚它會蓋掉誰、或被誰蓋掉。
 *
 * ⚠️ 方框一律是**經緯度的矩形**，靠陸地遮罩裁出海岸線——所以框可以畫得比實際
 * 範圍大一點、讓它涵蓋整個地理區，不必去描海岸。
 */
export const REGIONS = [
  // ── 底層：面積最大的四個自給／粗放類型
  ["nomadic-herding", [-17, 13, 30, 30], "撒哈拉與薩赫爾"],
  ["nomadic-herding", [34, 13, 60, 32], "阿拉伯半島"],
  ["nomadic-herding", [44, 24, 77, 40], "伊朗、阿富汗、俾路支與塔爾沙漠"],
  ["nomadic-herding", [55, 36, 120, 52], "中亞、新疆與蒙古"],
  ["nomadic-herding", [78, 28, 100, 37], "青藏高原"],
  ["nomadic-herding", [33, -8, 51, 12], "索馬利、衣索比亞低地與東非馬賽草原"],
  ["nomadic-herding", [12, -29, 21, -17], "納米比與西喀拉哈里"],
  ["nomadic-herding", [14, 66, 45, 71], "拉普蘭與科拉半島（馴鹿）"],
  ["nomadic-herding", [55, 64, 175, 73], "北西伯利亞（馴鹿）"],
  ["nomadic-herding", [-168, 64, -140, 72], "阿拉斯加北部（馴鹿）"],

  ["livestock-ranching", [-122, 25, -102, 52], "北美西部（大盆地、洛磯山與大平原西側）"],
  ["livestock-ranching", [-73, 3, -62, 11], "奧利諾科的里亞諾"],
  ["livestock-ranching", [-60, -23, -41, -7], "巴西內陸（坎普與塞拉多）"],
  ["livestock-ranching", [-73, -52, -62, -22], "大廈谷、乾燥彭巴與巴塔哥尼亞"],
  ["livestock-ranching", [19, -27, 24, -18], "波札那與東喀拉哈里"],
  ["livestock-ranching", [17, -34, 26, -29], "大卡魯"],
  ["livestock-ranching", [113, -31, 153, -11], "澳洲內陸與北部"],
  ["livestock-ranching", [166, -47, 175, -40], "紐西蘭南島"],

  ["shifting-cultivation", [-79, -16, -45, 9], "亞馬遜盆地、圭亞那與奧利諾科"],
  ["shifting-cultivation", [-96, 7, -82, 19], "中美洲與墨西哥南部"],
  ["shifting-cultivation", [-17, -20, 33, 13], "撒哈拉以南非洲（幾內亞灣岸至剛果盆地）"],
  ["shifting-cultivation", [23, -20, 40, -8], "安哥拉東部、尚比亞、辛巴威與莫三比克"],
  ["shifting-cultivation", [95, -10, 150, 24], "東南亞內陸山地、婆羅洲、蘇門答臘與新幾內亞"],
  ["shifting-cultivation", [78, 19, 87, 25], "印度喬塔那格浦爾高原"],
  ["shifting-cultivation", [46, -26, 51, -12], "馬達加斯加東部"],

  ["subsistence-mixed", [22, 48, 52, 62], "歐俄、白俄羅斯、波羅的海與波蘭東部"],
  ["subsistence-mixed", [52, 50, 112, 60], "西西伯利亞與中西伯利亞森林草原"],
  ["subsistence-mixed", [118, 47, 135, 54], "阿穆爾河與滿洲北緣"],
  ["subsistence-mixed", [17, 41, 30, 49], "巴爾幹、匈牙利與羅馬尼亞"],
  ["subsistence-mixed", [27, 35, 52, 43], "安那托利亞、外高加索與伊朗北部"],
  ["subsistence-mixed", [-105, 17, -97, 25], "墨西哥高原"],

  // ── 中層：集約自給、混合農業、商業穀物、地中海、酪農、粗放定耕
  ["intensive-rice", [100, 20, 123, 34], "華南與長江流域"],
  ["intensive-rice", [125, 34, 131, 42], "朝鮮半島"],
  ["intensive-rice", [129, 30, 142, 38], "日本本州、四國與九州"],
  ["intensive-rice", [76, 21, 96, 29], "恆河平原、孟加拉與阿薩姆河谷"],
  ["intensive-rice", [77, 8, 87, 21], "印度東岸（科羅曼德爾與奧里薩）"],
  ["intensive-rice", [72, 8, 77, 18], "印度西岸（馬拉巴與康坎）"],
  ["intensive-rice", [92, 8, 110, 25], "中南半島各三角洲（伊洛瓦底、昭披耶、湄公、紅河）"],
  ["intensive-rice", [100, -9, 116, -5], "爪哇與蘇門答臘南部"],
  ["intensive-rice", [119, 8, 127, 19], "呂宋與維薩亞斯"],
  ["intensive-rice", [79, 5, 82, 10], "斯里蘭卡濕帶"],
  ["intensive-rice", [45, -22, 48, -17], "馬達加斯加中央高地"],

  ["intensive-dry", [104, 33, 123, 42], "華北平原、黃土高原與山東"],
  ["intensive-dry", [119, 41, 132, 49], "滿洲"],
  ["intensive-dry", [138, 37, 146, 46], "北海道與本州北部"],
  ["intensive-dry", [68, 27, 78, 34], "旁遮普與印度河上游"],
  ["intensive-dry", [70, 15, 80, 24], "德干內陸與古吉拉特"],
  ["intensive-dry", [29, 22, 34, 32], "埃及與尼羅河谷"],
  ["intensive-dry", [42, 12, 46, 18], "阿拉伯半島西南（葉門高地）"],

  // ⚠️ **這一列一定要排在 `intensive-rice` 後面**：「華南與長江流域」那個框
  // （100–123°E）涵蓋了臺灣，排在前面的話會被水稻蓋掉，而臺灣正是這一層最該
  // 講的一筆。踩過一次——查驗時臺灣出來的是 E，不是 C。
  ["shifting-cultivation", [119.5, 21.5, 122.5, 25.5], "臺灣（原圖版判定為游耕，見說明卡）"],

  ["commercial-mixed", [-10, 40, 25, 56], "西歐與中歐"],
  ["commercial-mixed", [-98, 35, -75, 43], "美國玉米帶與東部"],
  ["commercial-mixed", [-63, -38, -53, -29], "濕潤彭巴與烏拉圭"],
  ["commercial-mixed", [-74, -42, -70, -35], "智利南部"],
  ["commercial-mixed", [24, -31, 31, -22], "南非高草原（Highveld）與辛巴威"],
  ["commercial-mixed", [145, -39, 151, -33], "澳洲東南沿海"],

  ["commercial-grain", [-114, 49, -96, 56], "加拿大草原三省"],
  ["commercial-grain", [-108, 44, -96, 49], "美國春麥帶（達科他與蒙大拿）"],
  ["commercial-grain", [-103, 35, -96, 42], "美國冬麥帶（堪薩斯）"],
  // ⚠️ 拆成東西兩段，而且**西段的北界壓在 52°N**：原本寫成一個 28–88°E／45–57°N 的
  // 大框，結果把莫斯科（55.7°N）也畫成商業性穀物農業——那裡是森林帶，圖版上是 K。
  // 草原帶本來就是往東才北移的，一個矩形表達不了。
  ["commercial-grain", [28, 44, 50, 52], "烏克蘭、北高加索與窩瓦河下游"],
  ["commercial-grain", [50, 48, 88, 56], "哈薩克與西西伯利亞草原"],
  ["commercial-grain", [-66, -40, -63, -29], "阿根廷乾燥彭巴"],
  ["commercial-grain", [114, -35, 120, -28], "西澳小麥帶"],
  ["commercial-grain", [134, -37, 147, -31], "南澳與維多利亞的小麥區"],

  ["mediterranean", [-10, 36, 2, 41], "伊比利半島南部與東部"],
  ["mediterranean", [2, 36, 27, 44], "法國南部、義大利、巴爾幹沿海與希臘"],
  ["mediterranean", [27, 31, 37, 38], "安那托利亞沿海與黎凡特"],
  ["mediterranean", [-10, 30, 25, 37], "北非地中海沿岸"],
  ["mediterranean", [-123, 32, -118, 40], "加州"],
  ["mediterranean", [-72, -37, -70, -30], "智利中部"],
  ["mediterranean", [17, -35, 24, -32], "南非開普"],

  ["dairying", [-10, 50, 15, 62], "愛爾蘭、不列顛、丹麥、荷蘭與德國北部"],
  ["dairying", [15, 55, 24, 62], "波羅的海沿岸與芬蘭南部"],
  ["dairying", [-92, 43, -66, 49], "五大湖、聖羅倫斯河谷與新英格蘭"],
  ["dairying", [-124, 43, -121, 50], "北美太平洋岸西北部"],
  ["dairying", [172, -42, 179, -34], "紐西蘭北島"],

  ["rudimental-tillage", [-17, 4, 12, 15], "塞內甘比亞、幾內亞灣岸與奈及利亞中部帶"],
  ["rudimental-tillage", [36, 6, 42, 15], "衣索比亞高地"],
  ["rudimental-tillage", [28, -5, 35, 4], "東非大湖區高地"],
  ["rudimental-tillage", [12, -15, 21, -8], "安哥拉高原"],
  ["rudimental-tillage", [28, -34, 33, -29], "特蘭斯凱與納塔爾"],
  ["rudimental-tillage", [-79, -21, -64, 6], "安地斯山區（哥倫比亞至玻利維亞）"],
  ["rudimental-tillage", [-92, 16, -86, 22], "猶加敦與馬雅低地"],
  ["rudimental-tillage", [-43, -13, -34, -3], "巴西東北部"],

  // ── 最上層：面積最小的熱帶栽培業（圖版上是網點，會壓在別的類型上）
  ["plantation", [-95, 30, -78, 36], "美國棉花帶"],
  ["plantation", [-52, -25, -44, -19], "巴西東南部咖啡區"],
  ["plantation", [-85, 17, -60, 23], "加勒比海諸島（蔗糖）"],
  ["plantation", [-4, 4, 9, 8], "西非可可與油棕帶"],
  ["plantation", [9, 2, 12, 6], "喀麥隆"],
  ["plantation", [35, -3, 38, 1], "肯亞高地"],
  ["plantation", [36, -9, 40, -4], "坦干伊喀（瓊麻）"],
  ["plantation", [33, -18, 37, -13], "尼亞薩蘭與莫三比克（茶）"],
  ["plantation", [30, -31, 32, -28], "納塔爾蔗糖"],
  ["plantation", [88, 25, 96, 28], "阿薩姆與杜阿爾斯茶區"],
  ["plantation", [80, 6, 82, 8], "錫蘭茶區"],
  ["plantation", [75, 9, 78, 12], "尼爾吉里與喀拉拉"],
  ["plantation", [99, 1, 105, 7], "馬來半島橡膠"],
  ["plantation", [97, 2, 100, 5], "蘇門答臘德利菸草帶"],
  ["plantation", [145, -25, 153, -16], "昆士蘭沿海蔗糖"],
];

/**
 * 第十四類：**完全未利用的土地**（惠特里西自己的說法）。最後套用，把格子清成空白。
 *
 * ⚠️ 圖版上這些是**畫在字母區域裡面的封閉空白**，不是整片空白的大陸——撒哈拉整體
 * 是 A，只有最乾的核心是空白。所以這裡的框刻意比整個沙漠小。
 */
export const BLANKS = [
  [[3, 22, 25, 29], "撒哈拉極乾核心（利比亞沙漠、塔內茲魯夫特）"],
  [[45, 17, 55, 23], "魯卜哈利沙漠"],
  [[78, 37, 88, 41], "塔克拉瑪干"],
  [[82, 33, 95, 37], "青藏高原高處與柴達木"],
  [[124, -26, 132, -21], "澳洲大沙沙漠與吉布森沙漠"],
  [[-70.5, -27, -69, -18], "阿他加馬"],
];

/** 陸地遮罩：直接讀已經產好的大洲圖層（比照人口與作物讀鄉鎮界的既有做法）。 */
function loadLandMask(root) {
  const file = path.join(root, "public/data/geo/world-continents.geojson");
  if (!fs.existsSync(file)) {
    throw new Error(
      `找不到陸地遮罩 ${file}。這一層要先有大洲圖層：先跑 npm run build:geodata -- --only=world-continents`,
    );
  }
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const polys = [];
  for (const f of doc.features) {
    // ⚠️ 南極洲不要：惠特里西的圖版根本沒有畫到那裡（兩張半球圖都止於南緯 50–55° 附近）
    if (f.properties.name === "南極洲") continue;
    const mp = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const rings of mp) {
      let w = 180, s = 90, e = -180, n = -90;
      for (const [x, y] of rings[0]) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
      polys.push({ bbox: [w, s, e, n], rings });
    }
  }
  return polys;
}

const inRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/**
 * 方框 + 疊畫順序 + 陸地遮罩 → `Map<類型, 正方形環[]>`。
 *
 * 環一律逆時針（GeoJSON 外環慣例），四個角都是 0.5 的倍數，相鄰格因此共用逐位元
 * 相同的邊——`dissolveRings` 消得掉，比照柯本與「主要農業帶」。
 */
export function buildGrid(root) {
  const land = loadLandMask(root);
  const cols = Math.round(360 / CELL);
  const rows = Math.round(180 / CELL);
  const cell = new Array(cols * rows).fill(null);
  const idx = (r, c) => r * cols + c;

  const paint = (box, value) => {
    const [w, s, e, n] = box;
    const c0 = Math.max(0, Math.floor((w + 180) / CELL));
    const c1 = Math.min(cols, Math.ceil((e + 180) / CELL));
    const r0 = Math.max(0, Math.floor((90 - n) / CELL));
    const r1 = Math.min(rows, Math.ceil((90 - s) / CELL));
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) cell[idx(r, c)] = value;
  };
  for (const [type, box] of REGIONS) paint(box, type);
  for (const [box] of BLANKS) paint(box, null);

  // 陸地遮罩只套在有指派的格上（全球 259,200 格逐格做點在多邊形內太慢）
  const byType = new Map(Object.keys(TYPES).map((t) => [t, []]));
  let assigned = 0, onLand = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = cell[idx(r, c)];
      if (!type) continue;
      assigned++;
      const y1 = 90 - r * CELL, y0 = y1 - CELL;
      const x0 = -180 + c * CELL, x1 = x0 + CELL;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let hit = false;
      for (const p of land) {
        const [bw, bs, be, bn] = p.bbox;
        if (cx < bw || cx > be || cy < bs || cy > bn) continue;
        if (inRing(cx, cy, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(cx, cy, h))) { hit = true; break; }
      }
      if (!hit) continue;
      onLand++;
      byType.get(type).push([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    }
  }

  for (const [type, rings] of byType) {
    if (!rings.length) throw new Error(`類型 ${type}（${TYPES[type].letter}）一格都沒有——方框可能被後面的蓋光了`);
  }
  return { byType, assigned, onLand };
}

/** 一個類型的 feature 屬性。內容檔在 `src/content/geo/whittlesey/<id>.json`。 */
export function typeProperties(id) {
  const t = TYPES[id];
  return { id, name: `${t.letter} ${t.zh}`, en: t.en, meta: t.meta };
}
