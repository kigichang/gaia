/**
 * 柯本－蓋格氣候分區（Kottek et al. 2006）的存取層。
 *
 * ## 為什麼是維也納那份 ASCII 網格
 *
 * 柯本分類是**由氣溫與雨量的門檻算出來的**，沒有「官方界線圖」；能拿到的都是別人
 * 算好的網格。維也納獸醫大學那份（koeppen-geiger.vu-wien.ac.at，Kottek et al. 2006）
 * 是課本與百科用得最多的一版，而且它提供**純文字的 0.5° 網格**（`Lat Lon Cls` 三欄，
 * 92,416 個陸地格），2.6 MB、一行一格，不必寫 GeoTIFF 解碼器就能用。
 *
 * ⚠️ 另外兩條路都被否掉了：Beck et al. (2018／2023) 的新版**只發布 GeoTIFF**；
 * Esri Living Atlas 上的柯本圖層是 **Image Service（點陣）**，拿不到向量。
 *
 * ⚠️ 這份網格是 **1951–2000 年**的統計。同一個網站另外有 1986–2010 的版本，但那個
 * **只提供 KMZ，而 KMZ 裡是一張 PNG 疊圖**（實測解開來就是 720×360 的圖片加圖例），
 * 不是向量。期距寫在圖層的 notes 裡。
 *
 * ## 為什麼可以用 dissolve
 *
 * 網格的每一格都是一個 0.5° 的正方形，相鄰格共用的邊**逐位元相同、方向相反**——
 * 這正是 `lib/dissolve.mjs` 有向邊相消的前提（它本來是為國家公園的分區圖寫的）。
 * 所以同一個亞型的所有格子可以無損地併成一個 MultiPolygon。
 *
 * ⚠️ **簡化容差必須是 0。** 這一層要的是「把同一格的邊界原封不動地保留、只把**完全
 * 共線**的頂點拿掉」——`simplifyGeometry(geom, 0, 1)` 剛好是這件事（Douglas–Peucker
 * 在容差 0 時只會刪掉垂距為 0 的點）。容差一旦大於 0，階梯狀的邊界就會被切角，而
 * 相鄰兩類是**各自**簡化的，切完之後兩邊對不齊，整張圖會裂出白縫（生物群系那一層
 * 就是這樣，只好用半透明外框去補）。這裡不必補，因為邊界仍然逐位元相同。
 *
 * 座標一律是 0.5 的倍數，所以 `digits: 1` 是無損的。
 */

import { readZipText } from "./unzip.mjs";

export const KOPPEN_URL = "https://koeppen-geiger.vu-wien.ac.at/data/Koeppen-Geiger-ASCII.zip";
export const SOURCE_PAGE = "https://koeppen-geiger.vu-wien.ac.at/present.htm";
export const LICENSE = "維也納獸醫大學公開提供，供教學與研究使用（須引用 Kottek et al. 2006）";
export const SOURCE_LABEL = "柯本－蓋格氣候分類圖（Kottek et al. 2006）";

/** 網格解析度（度）。每一格的半寬用來組正方形。 */
export const CELL = 0.5;

/**
 * 30 個亞型：中文名、判準（卡片副標）、代表地點。
 *
 * ⚠️ **這份表就是這一層的教學內容本身**，不是裝飾：亞型多達 30 個，不可能一個顏色
 * 一個（本站的分類色上限是六色），所以地圖上畫的是**五大類的顏色**，而「這一塊到底
 * 是哪一個代碼」只有點下去才看得到。表裡漏一筆，那一塊就會退化成只有代碼的卡片。
 *
 * 判準用的是 Kottek et al. (2006) 表 1 的門檻，中文名採臺灣高中地理課本的慣用譯名。
 * 代表地點是課本常舉的例子，用來讓學生把代碼接回具體地方（本站 `src/content/places`
 * 的每一筆也都有 `koppen` 欄位，兩邊可以互相對照）。
 */
export const SUBTYPES = {
  // ── A 熱帶（最冷月 ≥ 18 °C）
  Af: {
    zh: "熱帶雨林氣候",
    meta: "最冷月 ≥18 °C・最乾月降水 ≥60 mm",
    places: "新加坡、亞馬遜盆地、剛果盆地",
  },
  Am: {
    zh: "熱帶季風氣候",
    meta: "最冷月 ≥18 °C・有短乾季，年雨量仍很大",
    places: "仰光、印度西南岸、菲律賓部分地區",
  },
  As: {
    zh: "熱帶莽原氣候（夏乾）",
    meta: "最冷月 ≥18 °C・乾季落在高日照的夏季",
    places: "東非沿岸、夏威夷背風側",
  },
  Aw: {
    zh: "熱帶莽原氣候（冬乾）",
    meta: "最冷月 ≥18 °C・乾季落在冬季",
    places: "東非莽原、巴西高原、印度德干高原",
  },

  // ── B 乾燥（蒸發量大於降水量；門檻隨氣溫與雨季分配而變）
  BWh: {
    zh: "熱帶沙漠氣候",
    meta: "乾燥・年均溫 ≥18 °C",
    places: "撒哈拉、阿拉伯半島、澳洲中部",
  },
  BWk: {
    zh: "溫帶沙漠氣候",
    meta: "乾燥・年均溫 <18 °C",
    places: "戈壁、塔克拉瑪干、巴塔哥尼亞",
  },
  BSh: {
    zh: "熱帶草原氣候（半乾燥）",
    meta: "半乾燥・年均溫 ≥18 °C",
    places: "薩赫爾、印度西北、墨西哥北部",
  },
  BSk: {
    zh: "溫帶草原氣候（半乾燥）",
    meta: "半乾燥・年均溫 <18 °C",
    places: "北美大平原西部、中亞、黃土高原",
  },

  // ── C 溫帶（最冷月 −3 ~ 18 °C，最暖月 ≥ 10 °C）
  Cfa: {
    zh: "溫暖濕潤氣候",
    meta: "溫帶・全年有雨・最暖月 ≥22 °C",
    places: "臺北、上海、東京、美國東南部",
  },
  Cfb: {
    zh: "西岸海洋性氣候",
    meta: "溫帶・全年有雨・最暖月 <22 °C",
    places: "倫敦、巴黎、紐西蘭、智利南部",
  },
  Cfc: {
    zh: "副極地海洋性氣候",
    meta: "溫帶・全年有雨・只有 1–3 個月 ≥10 °C",
    places: "冰島南岸、挪威沿海、福克蘭群島",
  },
  Csa: {
    zh: "地中海型氣候（夏熱）",
    meta: "溫帶・夏乾冬雨・最暖月 ≥22 °C",
    places: "羅馬、雅典、洛杉磯、伯斯",
  },
  Csb: {
    zh: "地中海型氣候（夏涼）",
    meta: "溫帶・夏乾冬雨・最暖月 <22 °C",
    places: "舊金山、波特蘭、智利中部、開普敦",
  },
  Csc: {
    zh: "高地夏乾氣候",
    meta: "溫帶・夏乾冬雨・只有 1–3 個月 ≥10 °C",
    places: "智利安地斯高地（面積極小）",
  },
  Cwa: {
    zh: "副熱帶季風氣候（冬乾）",
    meta: "溫帶・冬乾夏雨・最暖月 ≥22 °C",
    places: "香港、廣州、新德里、嘉南平原",
  },
  Cwb: {
    zh: "高地副熱帶氣候（冬乾）",
    meta: "溫帶・冬乾夏雨・最暖月 <22 °C",
    places: "昆明、墨西哥市、約翰尼斯堡",
  },
  Cwc: {
    zh: "高地冬乾氣候",
    meta: "溫帶・冬乾夏雨・只有 1–3 個月 ≥10 °C",
    places: "安地斯與衣索比亞高地（面積極小）",
  },

  // ── D 大陸性（最冷月 < −3 °C，最暖月 ≥ 10 °C）
  Dfa: {
    zh: "濕潤大陸性氣候（夏熱）",
    meta: "大陸性・全年有雨・最暖月 ≥22 °C",
    places: "芝加哥、明尼亞波利斯、烏克蘭東部",
  },
  Dfb: {
    zh: "濕潤大陸性氣候（夏暖）",
    meta: "大陸性・全年有雨・最暖月 <22 °C",
    places: "莫斯科、蒙特婁、斯德哥爾摩",
  },
  Dfc: {
    zh: "副極地氣候（針葉林氣候）",
    meta: "大陸性・全年有雨・只有 1–3 個月 ≥10 °C",
    places: "西伯利亞、加拿大北部、阿拉斯加內陸",
  },
  Dfd: {
    zh: "極端大陸性副極地氣候",
    meta: "大陸性・全年有雨・最冷月 <−38 °C",
    places: "西伯利亞東北（維科揚斯克一帶）",
  },
  Dsa: { zh: "夏乾大陸性氣候（夏熱）", meta: "大陸性・夏乾・最暖月 ≥22 °C", places: "土耳其東部、伊朗西北" },
  Dsb: { zh: "夏乾大陸性氣候（夏暖）", meta: "大陸性・夏乾・最暖月 <22 °C", places: "美國內陸山區、伊朗高原" },
  Dsc: { zh: "夏乾副極地氣候", meta: "大陸性・夏乾・只有 1–3 個月 ≥10 °C", places: "土耳其與伊朗的高山區" },
  Dwa: {
    zh: "冬乾大陸性氣候（夏熱）",
    meta: "大陸性・冬乾夏雨・最暖月 ≥22 °C",
    places: "北京、首爾、華北平原",
  },
  Dwb: {
    zh: "冬乾大陸性氣候（夏暖）",
    meta: "大陸性・冬乾夏雨・最暖月 <22 °C",
    places: "哈爾濱、海參崴、蒙古東部",
  },
  Dwc: {
    zh: "冬乾副極地氣候",
    meta: "大陸性・冬乾夏雨・只有 1–3 個月 ≥10 °C",
    places: "外貝加爾、蒙古北部、大興安嶺",
  },
  Dwd: {
    zh: "冬乾極端大陸性氣候",
    meta: "大陸性・冬乾夏雨・最冷月 <−38 °C",
    places: "奧伊米亞康一帶（北半球寒極）",
  },

  // ── E 極地（最暖月 < 10 °C）
  ET: { zh: "苔原氣候", meta: "極地・最暖月 0–10 °C", places: "北極海沿岸、高山頂、南極半島" },
  EF: { zh: "冰原氣候", meta: "極地・最暖月 <0 °C", places: "南極內陸、格陵蘭冰蓋" },
};

/**
 * 五大類（地圖上的五個核取方塊）。**陣列順序就是圖例與抽屜的順序**，依課本
 * 講述的 A→E 排。
 *
 * ⚠️ 為什麼是五類而不是 30 類：30 個分類色沒有人分得出來（本站掃過整個色域，
 * 六色已經是 all-pairs 全過的上限，見 thematicColors.ts）。所以**顏色是大類、
 * 圖徵是亞型**——地圖畫五個顏色，點下去才告訴你是哪一個代碼。
 */
export const KOPPEN_GROUPS = [
  { id: "a", letter: "A", label: "A 熱帶氣候", codes: ["Af", "Am", "As", "Aw"] },
  { id: "b", letter: "B", label: "B 乾燥氣候", codes: ["BWh", "BWk", "BSh", "BSk"] },
  {
    id: "c",
    letter: "C",
    label: "C 溫帶氣候",
    codes: ["Cfa", "Cfb", "Cfc", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc"],
  },
  {
    id: "d",
    letter: "D",
    label: "D 大陸性氣候",
    codes: ["Dfa", "Dfb", "Dfc", "Dfd", "Dsa", "Dsb", "Dsc", "Dwa", "Dwb", "Dwc", "Dwd"],
  },
  { id: "e", letter: "E", label: "E 極地氣候", codes: ["ET", "EF"] },
];

/** 30 個亞型一個都不能漏——漏掉的那一塊會在地圖上變成空白。 */
const GROUPED = KOPPEN_GROUPS.flatMap((g) => g.codes);
if (GROUPED.length !== Object.keys(SUBTYPES).length) {
  throw new Error(`KOPPEN_GROUPS 涵蓋 ${GROUPED.length} 個亞型，SUBTYPES 有 ${Object.keys(SUBTYPES).length} 個`);
}

/**
 * `Lat Lon Cls` 三欄的文字檔 → `Map<亞型代碼, 正方形環[]>`。
 *
 * 環一律逆時針（GeoJSON 外環慣例），而且**四個角都用 `Lat ± 0.25` 算出來**——
 * 相鄰格因此共用逐位元相同的邊，dissolve 才消得掉（見檔頭）。
 */
export function parseKoppenGrid(text) {
  const half = CELL / 2;
  const byCode = new Map();
  const lines = text.trim().split("\n");
  for (const line of lines.slice(1)) {
    const [lat, lon, code] = line.trim().split(/\s+/);
    if (!code) continue;
    if (!SUBTYPES[code]) throw new Error(`未知的柯本代碼「${code}」，SUBTYPES 要補一筆`);
    const y = Number(lat);
    const x = Number(lon);
    const ring = [
      [x - half, y - half],
      [x + half, y - half],
      [x + half, y + half],
      [x - half, y + half],
      [x - half, y - half],
    ];
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(ring);
  }

  // 實測 92,416 格／30 個亞型（1951–2000）。掉一半代表上游換檔了
  const total = [...byCode.values()].reduce((n, r) => n + r.length, 0);
  if (total < 80000) throw new Error(`只讀到 ${total} 格，上游的檔案格式可能變了`);
  return byCode;
}

/**
 * 下載並剖析網格，**整個 process 只做一次**。
 *
 * 五大類是五個資料集（五個產物檔），但它們吃的是同一份 2.6 MB 的文字檔——
 * 比照古蹟三級與作物三種共用 module-level 快取的既有做法，不要下載五次。
 */
let cached = null;
export async function fetchKoppenGrid(fetchBuffer) {
  if (!cached) {
    const buf = await fetchBuffer(KOPPEN_URL);
    cached = parseKoppenGrid(readZipText(buf, (name) => name.toLowerCase().endsWith(".txt")));
  }
  return cached;
}

/** 一個亞型的 feature 屬性（卡片走 `FeatureCard` 的 fallback，沒有內容檔）。 */
export function subtypeProperties(code) {
  const s = SUBTYPES[code];
  return {
    id: code.toLowerCase(),
    // 代碼要排在最前面：這一層存在的理由之一就是「地點卡上的 Cfa 是什麼意思」
    name: `${code} ${s.zh}`,
    meta: s.meta,
    detail: `代表地點：${s.places}`,
  };
}
