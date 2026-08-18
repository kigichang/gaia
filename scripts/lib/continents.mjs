/**
 * 七大洲範圍（Natural Earth 國界 → 依洲別聯集）的存取層。
 *
 * ## 為什麼是「把國界併起來」而不是直接抓一份大洲圖
 *
 * 公開、可自由使用的**大洲多邊形**其實沒有：Esri Living Atlas 的 World Continents
 * 不是開放資料，Natural Earth 只有國界（每個國家帶一個 `CONTINENT` 欄位）。而
 * 「把同一洲的國家併起來」正好是本站已經有工具的事——`lib/dissolve.mjs` 的有向邊
 * 相消，當初為了國家公園的分區圖寫的，前提是「相鄰多邊形共用的邊逐位元相同」。
 *
 * ⚠️ **Natural Earth 的國界滿足那個前提**（實測七大洲全部併得起來，沒有一次串不上），
 * 但**環的繞行方向跟 GeoJSON 慣例相反**（外環是順時針，shapefile 的老慣例）。
 * 不先反轉的話 `dissolveRings` 會把每一個環都判成內環，然後丟「合併後沒有任何外環」
 * ——那個錯誤訊息完全不會讓人想到繞行方向。
 *
 * ## ⚠️ 上游的洲別是「整個國家算一洲」，不切開跨洲國家
 *
 * 這件事不能照單全收：Natural Earth 把**整個俄羅斯算成歐洲**（1,700 萬 km²），
 * 於是歐洲會變成 2,290 萬 km²、亞洲剩 3,120 萬 km²——課本寫的是歐洲 1,018 萬、
 * 亞洲 4,458 萬，差距大到不是「定義不同」可以解釋的，而是**錯的**。
 *
 * 所以本層依課本講的那幾條分界線，把四個跨洲國家切開（見 `DIVIDES`）：
 *
 * | 國家 | 分界 | 切出來的面積 | 對照 |
 * |---|---|---|---|
 * | 俄羅斯 | 烏拉山（東經 60°） | 歐洲 392 萬 km² | 歐俄約 396 萬 |
 * | 哈薩克 | 烏拉河 | 歐洲 30 萬 km² | 歐哈約 18–43 萬（界線定義不一） |
 * | 土耳其 | 土耳其海峽 | 歐洲 2.5 萬 km² | 東色雷斯 2.4 萬 |
 * | 埃及 | 蘇伊士運河與蘇伊士灣 | 亞洲 5.6 萬 km² | 西奈半島約 6 萬 |
 *
 * 切完之後七大洲的面積跟課本數字對得上（見 build-geodata.mjs 的交叉檢查）。
 *
 * ## ⚠️ 每一條分界線只切它該切的那個國家（`countries`），不要套用到全部
 *
 * 這一條踩過，而且症狀很好認：**地圖上會冒出幾條橫貫大陸的直線**。
 *
 * 半平面裁切（Sutherland–Hodgman）把一個環切成兩半時，兩半沿著切線各自補一段
 * 「連接邊」。環只跨過切線**兩次**時，兩半的連接邊剛好方向相反，dissolve 會把
 * 它們消掉、看不出這個環被切過（伊朗被烏拉山那條線掃到就是這種情形）。但環跨過
 * 切線**四次以上**時，左半補的是 X1→X2、X3→X4，右半補的是 X2→X3、X4→X1
 * ——它們**不成對，消不掉**，於是整條切線變成一條畫在地圖上的線。
 *
 * 實測：把土耳其海峽那條線套用到全部國家時，它延伸出去橫掃俄羅斯，而俄羅斯本島
 * 的環跟它交會很多次，結果是一條從土耳其一路拉到西伯利亞的紫線。
 *
 * ⚠️ 代價是**接點會有小重疊**：切線與國界的交會處（例如烏拉山那條線碰到俄哈邊界
 * 的地方），被切的那一國多了一個交點、鄰國沒有，兩邊的邊因此消不掉，會留下一小片
 * 雙重覆蓋的三角形。它小到看不出來（世界尺度下遠小於一個像素），而且 dissolve
 * 仍然串得起來——比整條假線好得多。
 */

import { geometryAreaKm2 } from "./plates.mjs";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/**
 * 50m 的國界。
 *
 * ⚠️ **不要換成 10m**：這一層的 `maxzoom` 是 5（世界尺度），10m 的座標量會讓產物
 * 直接撞穿大小預算，而多出來的細節一個像素都看不到。也不要換成 110m——那份的
 * 島嶼掉得太多（連冰島以外的北大西洋島群都沒有），大洋洲會只剩澳洲與紐西蘭。
 */
export const COUNTRIES_URL = `${NE}/ne_50m_admin_0_countries.geojson`;

export const LICENSE = "Natural Earth（public domain）";
export const SOURCE_LABEL = "Natural Earth";

/**
 * 七大洲。**陣列順序只用來檢查「七個都在」**，圖徵順序由面積決定（見 build-geodata）。
 *
 * ⚠️ `id` 同時是 geojson 的 `properties.id`、搜尋結果的 key、以及
 * `src/content/geo/world-continents/<id>.json` 的檔名——三者必須是同一個字串
 * （比照板塊邊界與交通軸線的既有規則）。
 */
export const CONTINENTS = {
  asia: { name: "亞洲", en: "Asia" },
  africa: { name: "非洲", en: "Africa" },
  "north-america": { name: "北美洲", en: "North America" },
  "south-america": { name: "南美洲", en: "South America" },
  antarctica: { name: "南極洲", en: "Antarctica" },
  europe: { name: "歐洲", en: "Europe" },
  oceania: { name: "大洋洲", en: "Oceania" },
};

/** 上游 `CONTINENT` 欄位 → 本站的洲別 id。 */
const NE_CONTINENT_TO_ID = {
  Asia: "asia",
  Africa: "africa",
  Europe: "europe",
  "North America": "north-america",
  "South America": "south-america",
  Oceania: "oceania",
  Antarctica: "antarctica",
};

/**
 * 上游把 8 個離島領地歸在 `Seven seas (open ocean)`——那不是一個洲，只是「不屬於
 * 任何大陸棚的島」。全部小於 2,500 km²，在世界尺度上都是幾個像素，但**不能讓它們
 * 沒有洲別**（那樣點下去會是一片沒有卡片的陸地）。
 *
 * ⚠️ 對不到就讓建置失敗：上游哪天新增一筆，應該由人決定它屬於哪一洲。
 */
const SEVEN_SEAS = {
  Seychelles: "africa",
  Mauritius: "africa",
  "Saint Helena": "africa",
  "Br. Indian Ocean Ter.": "africa",
  Maldives: "asia",
  /** 南喬治亞：聯合國 M49 歸在美洲，本站從之 */
  "S. Geo. and the Is.": "south-america",
  /** 凱爾蓋朗、克羅澤：亞南極島群 */
  "Fr. S. Antarctic Lands": "antarctica",
  "Heard I. and McDonald Is.": "antarctica",
};

/**
 * 課本講的洲界，每一條寫成一條**直線**（`[起點, 終點]`），左側（逆時針側）為正。
 *
 * ⚠️ 這些是**簡化過的直線**，不是實測界線——洲界本來就沒有國際公認的畫法，
 * 課本畫的也是這幾條示意線。收錄的取捨寫在圖層的 `notes` 裡。
 *
 * ⚠️ **`countries` 是必要的，不是最佳化**：直線沒有端點，套用到別的國家時會延伸到
 * 幾千公里外把人家切開，而那正是「橫貫大陸的假線」的來源（見檔頭）。加一條新的
 * 分界線時，`countries` 只列那條線真正要切開的國家。
 */
export const DIVIDES = {
  /** 烏拉山：東經 60°，由南往北，左側＝西側＝歐洲 */
  ural: { line: [[60, 45], [60, 80]], countries: ["Russia"] },
  /** 烏拉河：從裏海北岸（51.9°E, 47.1°N）往東北到俄哈邊界，左側＝西北側＝歐洲 */
  uralRiver: { line: [[51.9, 47.1], [59.5, 51.3]], countries: ["Kazakhstan"] },
  /** 土耳其海峽：達達尼爾（26.2°E, 40.05°N）到博斯普魯斯（29.02°E, 41.05°N），左側＝北＝歐洲 */
  bosphorus: { line: [[26.2, 40.05], [29.02, 41.05]], countries: ["Turkey"] },
  /** 蘇伊士運河：蘇伊士（32.55°E, 29.95°N）往北到塞得港，左側＝西＝非洲 */
  suez: { line: [[32.55, 29.95], [32.3, 31.3]], countries: ["Egypt"] },
  /** 蘇伊士灣：從灣口（34.3°E, 27.6°N）往西北到蘇伊士，左側＝西南＝非洲 */
  suezGulf: { line: [[34.3, 27.6], [32.55, 29.95]], countries: ["Egypt"] },
};

/**
 * 用一條直線把環切一半（Sutherland–Hodgman，凸裁切區的標準做法）。
 *
 * 跟 `lib/eez.mjs` 的 `clipRingToBox` 是同一個演算法，差別在裁切邊界是任意方向的
 * 直線而不是經緯度方框——洲界（烏拉河、土耳其海峽、蘇伊士灣）沒有一條是正南北或
 * 正東西的，用方框切會把鄰近的陸地一起切進去。
 *
 * @param {[number, number][]} ring 封閉環（首尾相同）
 * @param {[number, number]} a 直線起點
 * @param {[number, number]} b 直線終點
 * @param {1 | -1} keep 1＝保留左側（逆時針側），-1＝保留右側
 * @returns 封閉環，整個環都在另一側時回 null
 */
export function clipRingToHalfPlane(ring, [ax, ay], [bx, by], keep) {
  const dx = bx - ax;
  const dy = by - ay;
  /** 帶號距離（正＝直線左側）。乘上 keep 之後一律「>= 0 為保留」。 */
  const side = (p) => (dx * (p[1] - ay) - dy * (p[0] - ax)) * keep;
  /**
   * ⚠️ 交點必須只由 `a`、`b` 與直線算出來，不可以摻進「現在切的是哪一側」——
   * 兩側算出來的交點要**逐位元相同**，dissolve 才消得掉同一洲的兩半（見檔頭）。
   */
  const intersect = (p, q) => {
    const sp = dx * (p[1] - ay) - dy * (p[0] - ax);
    const sq = dx * (q[1] - ay) - dy * (q[0] - ax);
    const t = sp / (sp - sq);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };

  const src = ring.slice(0, -1);
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const p = src[i];
    const q = src[(i + 1) % src.length];
    const pIn = side(p) >= 0;
    if (pIn) out.push(p);
    if (pIn !== side(q) >= 0) out.push(intersect(p, q));
  }
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
}

/**
 * 把一個 polygon（外環 + 內環）依**適用於這個國家**的分界線切成小片。
 *
 * @param polygon GeoJSON Polygon 的 coordinates
 * @param country 上游的 `NAME`；只有列在 `DIVIDES[].countries` 裡的才會被切
 * @returns `{ rings, flags }[]`，`flags[分界線 id]` 是 1（左側）或 -1（右側）
 */
export function splitPolygon(polygon, country) {
  let pieces = [{ rings: polygon, flags: {} }];
  for (const [id, { line: [a, b], countries }] of Object.entries(DIVIDES)) {
    if (!countries.includes(country)) continue;
    const next = [];
    for (const piece of pieces) {
      for (const keep of [1, -1]) {
        const rings = piece.rings
          .map((ring) => clipRingToHalfPlane(ring, a, b, keep))
          .filter(Boolean);
        if (rings.length) next.push({ rings, flags: { ...piece.flags, [id]: keep } });
      }
    }
    pieces = next;
  }
  return pieces;
}

/** 環的外接矩形 `[west, south, east, north]`。 */
export function ringBbox(ring) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [x, y] of ring) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  return [west, south, east, north];
}

/**
 * 一小片陸地屬於哪一洲。
 *
 * @param {string} name 上游的 `NAME`
 * @param {string} neContinent 上游的 `CONTINENT`
 * @param {Record<string, 1 | -1>} flags 這一片在各分界線的哪一側（見 `splitPolygon`）
 * @param {[number, number, number, number]} bbox 這一片的外接矩形
 */
export function assignContinent(name, neContinent, flags, bbox) {
  if (neContinent === "Seven seas (open ocean)") {
    const id = SEVEN_SEAS[name];
    if (!id) throw new Error(`上游把「${name}」歸在 Seven seas，請先決定它屬於哪一洲`);
    return id;
  }

  /**
   * ⚠️ 楚科奇那幾塊在換日線**西經那一側**（經度 -180 ~ -169），它們的經度當然
   * 小於 60，但那跟烏拉山一點關係都沒有。少了這一條，白令海峽那一帶會變成歐洲。
   */
  if (name === "Russia") {
    if (bbox[0] < 0) return "asia";
    return flags.ural > 0 ? "europe" : "asia";
  }
  if (name === "Kazakhstan") return flags.uralRiver > 0 ? "europe" : "asia";
  if (name === "Turkey") return flags.bosphorus > 0 ? "europe" : "asia";
  /** 西奈半島＝運河以東**而且**蘇伊士灣以東北。少一個條件會把紅海西岸也算進亞洲。 */
  if (name === "Egypt") return flags.suez < 0 && flags.suezGulf < 0 ? "asia" : "africa";
  /**
   * 夏威夷群島屬玻里尼西亞，課本畫在大洋洲；上游只有「美國」一個圖徵，所以依
   * 位置把它挑出來（它本來就是獨立的幾塊島，不需要切）。
   */
  if (name === "United States of America" && bbox[2] < -150 && bbox[3] < 30) return "oceania";

  const id = NE_CONTINENT_TO_ID[neContinent];
  if (!id) throw new Error(`未知的洲別「${neContinent}」（${name}）`);
  return id;
}

/**
 * 這一片的球面面積（km²）。
 *
 * ⚠️ **一定要在簡化之前算**（比照板塊與經濟海域的既有註解）：七大洲的面積總和是
 * 這一層唯一的自我檢查，簡化之後算出來的數字對不上任何東西。
 */
export function pieceAreaKm2(rings) {
  return geometryAreaKm2({ type: "Polygon", coordinates: rings });
}

/** 環的帶號面積（度²）。用來丟掉小到看不見的島。 */
export function ringSignedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/**
 * 陸地總面積（百萬 km²）的期望值，用來交叉檢查。
 *
 * 常見的數字是 1.49 億 km²（含南極洲）。本站用 Natural Earth 50m 算出來會少一點：
 * 南極洲那一份的界線是**岩床海岸線、不含冰棚**（實測 1,226 萬 vs 常見的 1,400 萬），
 * 加上 50m 的島嶼收錄不完全。誤差落在 5% 以內就算過。
 */
export const EXPECTED_LAND_KM2 = 149e6;
export const LAND_TOLERANCE = 0.05;
