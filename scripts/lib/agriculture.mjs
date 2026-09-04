/**
 * 世界主要農業帶（FAO「Major agricultural systems」，SOLAW 2011）的存取層。
 *
 * ## 為什麼是這一份，以及**它不是課本那張圖**
 *
 * 臺灣高中地理教的農業分類是惠特里西（Whittlesey, 1936）那一套——游牧、游耕、
 * 集約自給（水稻／旱作）、地中海型農業、混合農業、酪農業、商業性穀物農業、
 * 熱帶栽培業、市場園藝業。⚠️ **那個分類沒有任何開放、可機器讀取的資料集**：
 * 它是 1936 年的製圖分類，活在課本圖版與地圖集裡，沒有人把它發成 GIS 資料
 * （查過 FAO 全目錄、ArcGIS Online、Harvard Dataverse 與 Natural Earth）。
 *
 * 所以這一層畫的是 FAO 自己的「主要農業系統」分類，**類別名一律照 FAO 的原意翻譯，
 * 不可以改寫成惠特里西的詞**（不能把 `114 Rainfed agriculture: temperate` 叫成
 * 「商業性穀物農業」或「小麥帶」——那一格裡也有玉米帶與西歐的混合農業）。
 * 兩套分類的對應關係寫在各張說明卡裡，那才是誠實的做法。
 *
 * ## 為什麼不是 GAEZ
 *
 * 註冊表原本掛的來源是「FAO 全球農業生態區（GAEZ）」。實際去抓才發現兩個問題：
 * GAEZ v4 **只發 GeoTIFF**（57 類那份 57 MB、33 類那份 49 MB，1 公里全球格網
 * 壓成這個大小必定是 tiled／compressed，沒有 TIFF 解碼器讀不了），而且 AEZ 是
 * **生物物理的潛力分區**、不是實際觀測到的農業系統——它回答「這裡適合種什麼」，
 * 不是「這裡實際在做哪一種農業」。這一層要的是後者。
 *
 * ⚠️ 另外三條路也試過：FAO FGGD 那份 `Map5_10.zip` 只有 184 KB 但內容是
 * **ArcInfo binary GRID**（`w001001.adf`），本站的工具讀不了、而且只涵蓋開發中國家；
 * MapSPAM 是每一格 42 種作物的收穫面積（144 MB CSV），要自己發明一條
 * 「哪一種作物算主導」的規則，那是本站內容規範明文禁止的無來源推論；
 * EarthStat 的下載連結目前 404，而且它是連續的耕地比例、不是分類。
 *
 * ## 資料形狀
 *
 * zip 裡是一份 ArcInfo ASCII GRID：6 行標頭 + 2160 列 × 4320 欄的整數，
 * 5 弧分（1/12°）、WGS84、**第一列在最北邊**。純文字，跟柯本那份 0.5° 網格
 * 一樣不需要任何解碼器。
 *
 * ⚠️ **標頭寫的 `cellsize 0.083333` 是四捨五入過的，不可以拿來算座標**：
 * 4320 × 0.083333 = 359.99856，繞地球一圈少了 0.0014°。真正的格距是 **1/12**，
 * 而且只有用 1/12 算，降尺度之後的格線才會**正好落在 0.5° 的倍數上**——
 * 那是相鄰格共用邊逐位元相同、dissolve 消得掉的前提（見 lib/koppen.mjs 檔頭）。
 *
 * ## 為什麼降到 0.5°
 *
 * 原始 5 弧分直接 dissolve 太細，而且這一層要教的是「**帶**」不是「地塊」。
 * 實測三種解析度的產物大小（六個群組合計／最大的一份）：
 *
 *   1/12°（原始）  沒有量，光是 rangelands 就遠超過 1 MB 的硬上限
 *   0.25°          1,357 KB／653 KB（rangelands 超過 500 KB 的提醒門檻）
 *   **0.5°**       **307 KB／139 KB**  ← 現在用這個，跟柯本的分片同一個量級
 *
 * 0.5° 除了塞得進預算，畫出來也**比較像農業帶**：多數決把零碎的小塊吃掉，
 * 留下的是連成一片的帶。⚠️ 代價是尼羅河谷這種窄於半度的帶會被旁邊的沙漠吃掉
 * （原始解析度讀得到 108，0.5° 之後是 221），這件事要寫進圖層的 notes。
 *
 * ⚠️ **多數決要先把水域（101）剔掉再算**，否則海岸線上每一格都會變成水。
 * 剔掉之後仍然是「陸地上哪一類最多」，所以一格裡森林占多數時就是森林——
 * 這一層不畫森林，那一格因此是空白的，那是對的（不是漏掉）。
 */

import { readZipText } from "./unzip.mjs";

export const FARMSYS_URL =
  "https://storage.googleapis.com/fao-maps-catalog-data/geonetwork/aquamaps/farmsysASCII.zip";
export const SOURCE_PAGE =
  "https://data.apps.fao.org/catalog/iso/c9be830e-daf5-4926-bbf6-0051ad057c53";
export const LICENSE = "CC-BY 4.0（須標示 FAO）";
export const SOURCE_LABEL = "聯合國糧農組織 世界主要農業系統（SOLAW 2011）";

/** 原始網格的格距（度）。⚠️ 標頭寫 0.083333 是四捨五入過的，見檔頭。 */
export const SOURCE_CELL = 1 / 12;
/** 產物的格距（度）。6 個原始格併成一格。 */
export const CELL = 0.5;
const SUB = Math.round(CELL / SOURCE_CELL);

const NCOLS = 4320;
const NROWS = 2160;
/** 水域。多數決之前要先剔掉，見檔頭。 */
const WATER = 101;

/**
 * 上游 14 個類別裡，**這一層真的會畫出來的那 10 個**。
 *
 * ⚠️ 沒有收進來的四個是 `101 Water`、`107 Forest`、`221 Desert`、`104 Other`。
 * 那不是漏掉：這一層叫「主要農業帶」，森林與沙漠不是農業系統，而且本站已經有
 * 「森林與沙漠帶」（生物群系）在畫同一件事——兩層都是面，同時打開只會糊成一團。
 * 少掉的那些地方在這一層上就是空白，而空白本身有教學意義：**農業帶的邊界在哪裡**。
 *
 * `zh`／`meta`／`places` 的用法比照 lib/koppen.mjs 的 `SUBTYPES`：`meta` 是卡片副標
 * 上那一行判準，`places` 是課本會舉的例子。⚠️ 這三欄漏一筆，那一塊在地圖上就只會
 * 有代碼、沒有名字。
 */
export const SYSTEMS = {
  109: {
    zh: "灌溉農業：水稻",
    meta: "灌溉・以水田為主",
    places: "湄公河三角洲、爪哇、恆河平原、泰國中部、孟加拉",
  },
  108: {
    zh: "灌溉農業：水稻以外的作物",
    meta: "灌溉・非水田",
    places: "尼羅河三角洲、兩河流域、印度河平原、加州中央谷地、臺灣西部平原",
  },
  110: { zh: "雨養農業：乾燥熱帶", meta: "雨養・熱帶乾濕季", places: "薩赫爾、印度德干高原西部、巴西東北部" },
  111: { zh: "雨養農業：濕潤熱帶", meta: "雨養・熱帶全年多雨", places: "巴西東南部、西非幾內亞灣岸、東南亞島嶼" },
  112: { zh: "雨養農業：高地", meta: "雨養・高原與山地", places: "衣索比亞高地、安地斯山區、東非高原" },
  113: { zh: "雨養農業：副熱帶", meta: "雨養・副熱帶", places: "阿根廷彭巴、澳洲東南、地中海沿岸" },
  114: { zh: "雨養農業：溫帶", meta: "雨養・溫帶", places: "美國中西部、加拿大草原、烏克蘭黑土區、西歐" },
  222: { zh: "放牧地：副熱帶", meta: "天然草地放牧・副熱帶", places: "澳洲內陸、南非高原、薩赫爾南緣、西班牙中部" },
  224: { zh: "放牧地：溫帶", meta: "天然草地放牧・溫帶", places: "北美大平原西部、中亞草原、巴塔哥尼亞" },
  225: { zh: "放牧地：寒帶", meta: "天然草地放牧・寒帶", places: "西伯利亞北部、加拿大北部、青藏高原" },
};

/**
 * 六個大類（六個核取方塊）。⚠️ **顏色是大類、圖徵是上游的類別**，
 * 比照柯本氣候分區「顏色是五大類、圖徵是 30 個亞型」的既有形狀，理由相同：
 * 本站掃出來的分類色上限是六色，而上游有 10 個要畫的類別。
 *
 * 併法要說得出口：**灌溉的兩類刻意不合併**（水稻是這一層最重要的一格，而它只佔
 * 9,400 個原始格——併進「灌溉」就等於在地圖上消失）；雨養的五類依氣候帶併成
 * 熱帶／副熱帶與溫帶／高地三組；放牧的三類全部併成一組（三個氣候帶的放牧在
 * 課本裡是同一件事，而且它們合起來就是「乾燥半乾燥地區的畜牧帶」那條線索）。
 */
export const SYSTEM_GROUPS = [
  { id: "paddy", label: "灌溉：水稻", codes: [109] },
  { id: "irrigated-other", label: "灌溉：其他作物", codes: [108] },
  { id: "rainfed-tropics", label: "雨養：熱帶", codes: [110, 111] },
  { id: "rainfed-temperate", label: "雨養：副熱帶與溫帶", codes: [113, 114] },
  { id: "rainfed-highlands", label: "雨養：高地", codes: [112] },
  { id: "rangelands", label: "放牧地", codes: [222, 224, 225] },
];

/** 十個類別一個都不能漏——漏掉的那一類會在地圖上靜默地不出現。 */
{
  const grouped = SYSTEM_GROUPS.flatMap((g) => g.codes);
  const declared = Object.keys(SYSTEMS).map(Number);
  const missing = declared.filter((c) => !grouped.includes(c));
  if (missing.length) throw new Error(`SYSTEM_GROUPS 沒有涵蓋類別 ${missing.join("、")}`);
  if (grouped.length !== declared.length) {
    throw new Error(`SYSTEM_GROUPS 有 ${grouped.length} 個類別，SYSTEMS 有 ${declared.length} 個`);
  }
}

/**
 * ArcInfo ASCII GRID → `Int16Array`（長度 4320 × 2160，第一列在最北邊）。
 *
 * 逐字元掃描而不是 `split(/\s+/)`：那份文字有 3,500 萬個數字，切成陣列會產生
 * 九百多萬個字串物件。負號只可能出現在 `NODATA_value`（-9999），而這份資料的
 * 陸海遮罩已經用 101 表示水域、實測一個 NODATA 都沒有，所以負號直接當分隔字元
 * 處理（真的出現時會被讀成 9999，落在 `SYSTEMS` 之外而被忽略）。
 */
export function parseAsciiGrid(text) {
  let p = 0;
  const header = {};
  for (let i = 0; i < 6; i++) {
    const end = text.indexOf("\n", p);
    const [key, value] = text.slice(p, end).trim().split(/\s+/);
    header[key.toLowerCase()] = Number(value);
    p = end + 1;
  }
  if (header.ncols !== NCOLS || header.nrows !== NROWS) {
    throw new Error(`網格大小變成 ${header.ncols}×${header.nrows}，預期 ${NCOLS}×${NROWS}`);
  }
  if (header.xllcorner !== -180 || header.yllcorner !== -90) {
    throw new Error(`網格原點變成 (${header.xllcorner}, ${header.yllcorner})，預期 (-180, -90)`);
  }

  const grid = new Int16Array(NCOLS * NROWS);
  let k = 0;
  let cur = 0;
  let has = false;
  for (let i = p; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      cur = cur * 10 + (c - 48);
      has = true;
    } else if (has) {
      grid[k++] = cur;
      cur = 0;
      has = false;
    }
  }
  if (has) grid[k++] = cur;
  if (k !== NCOLS * NROWS) throw new Error(`只讀到 ${k} 格，預期 ${NCOLS * NROWS}`);
  return grid;
}

/**
 * 多數決降尺度到 0.5°，回傳 `Map<類別碼, 正方形環[]>`（只含 `SYSTEMS` 裡的類別）。
 *
 * 環一律逆時針（GeoJSON 外環慣例），四個角都用 0.5 的倍數算出來，
 * 相鄰格因此共用逐位元相同的邊——dissolve 消得掉，比照柯本。
 */
export function downsample(grid) {
  const outCols = NCOLS / SUB;
  const outRows = NROWS / SUB;
  const byCode = new Map();
  const tally = new Map();
  for (let r = 0; r < outRows; r++) {
    for (let c = 0; c < outCols; c++) {
      tally.clear();
      for (let dr = 0; dr < SUB; dr++) {
        for (let dc = 0; dc < SUB; dc++) {
          const v = grid[(r * SUB + dr) * NCOLS + (c * SUB + dc)];
          if (v === WATER || v === 0) continue;
          tally.set(v, (tally.get(v) ?? 0) + 1);
        }
      }
      // 平手時取代碼小的那一個，結果才不會跟著 Map 的插入順序漂移
      let best = 0;
      let bestN = 0;
      for (const [v, n] of tally) {
        if (n > bestN || (n === bestN && v < best)) {
          best = v;
          bestN = n;
        }
      }
      if (!SYSTEMS[best]) continue;
      const y1 = 90 - r * CELL;
      const y0 = y1 - CELL;
      const x0 = -180 + c * CELL;
      const x1 = x0 + CELL;
      if (!byCode.has(best)) byCode.set(best, []);
      byCode.get(best).push([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ]);
    }
  }

  // 實測 0.5° 之後這十類共 32,814 格。掉一大截代表上游換檔了
  const total = [...byCode.values()].reduce((n, rings) => n + rings.length, 0);
  if (total < 28000) throw new Error(`降尺度後只剩 ${total} 格，上游的檔案可能變了`);
  for (const code of Object.keys(SYSTEMS)) {
    if (!byCode.get(Number(code))?.length) throw new Error(`類別 ${code} 一格都沒有`);
  }
  return byCode;
}

/**
 * 下載並剖析網格，**整個 process 只做一次**。
 *
 * 六個大類是六個資料集（六個產物檔），但它們吃的是同一份 673 KB 的 zip
 * ——比照柯本五大類與岩石六大類共用 module-level 快取的既有做法。
 */
let cached = null;
export async function fetchFarmingSystems(fetchBuffer) {
  if (!cached) {
    const buf = await fetchBuffer(FARMSYS_URL);
    cached = downsample(parseAsciiGrid(readZipText(buf, (name) => name.toLowerCase().endsWith(".asc"))));
  }
  return cached;
}

/** 一個類別的 feature 屬性。內容檔在 `src/content/geo/agriculture/<代碼>.json`。 */
export function systemProperties(code) {
  const s = SYSTEMS[code];
  return { id: String(code), name: s.zh, meta: s.meta, detail: `代表地區：${s.places}` };
}
