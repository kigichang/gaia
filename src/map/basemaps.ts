import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import { ATTRIBUTION, BASEMAP_STYLES, NLSC_TILES } from "../config";

export type BasemapId = "liberty" | "nlsc-emap" | "nlsc-photo";

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  liberty: "世界地圖",
  "nlsc-emap": "臺灣通用電子地圖",
  "nlsc-photo": "臺灣正射影像",
};

/** 由 NLSC WMTS 組出一份最小的 raster 樣式。 */
function nlscStyle(tiles: string): StyleSpecification {
  return {
    version: 8,
    // 等高線標註是 symbol 圖層，需要 glyphs 才畫得出來；借用 OpenFreeMap 的字型端點
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      nlsc: {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
        maxzoom: 20,
        attribution: ATTRIBUTION.nlsc,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e8e4dc" } },
      { id: "nlsc", type: "raster", source: "nlsc" },
    ],
  };
}

/**
 * 地名要挑哪一個欄位，依序往下試。
 *
 * OpenMapTiles（OpenFreeMap 與 Carto 都是這個 schema）把 OSM 的 `name:*` 多語名稱
 * 原樣放進圖磚，所以「世界地圖用繁體中文顯示」不需要另一份資料，只要換一條表達式。
 *
 * ⚠️ 順序不能改成先 `name:zh`：那一欄在 OSM 上**簡繁混雜**（中國大陸的地物幾乎都是
 * 簡體），只有 `name:zh-Hant` 保證是繁體。實測世界地圖尺度的 171 個國家裡有 154 個
 * 有 `name:zh-Hant`，剩下 17 個只好退回 `name:zh`——那 17 個裡的簡體殘留由下面的
 * `ZH_HANT_OVERRIDES` 收尾。
 *
 * ⚠️ 最後一定要留一個 `""`：`coalesce` 全部落空時會回 null，而下面的 `slice`／
 * `index-of` 拿到 null 會在執行期丟錯——那會讓**整個底圖的標註**一起消失。
 */
const NAME_FIELDS = ["name:zh-Hant", "name:zh", "name:zh-Hans", "name:latin", "name_en", "name"];

/**
 * OSM 的多值名稱分隔符號，只取第一段。
 *
 * 實測 `name:zh-Hant` 會出現「德拉瓦州;特拉華州」「斯威士兰 / 史瓦蒂尼」這種一格
 * 塞好幾個譯名的寫法（世界尺度約 1.5% 的標籤），照原樣畫出來在圖上很難讀。
 *
 * ⚠️ 帶空白的那兩個要排在前面一起比，否則「斯威士兰 / 史瓦蒂尼」會切在斜線上、
 * 留下一個尾隨空白。
 */
const NAME_SEPARATORS = [" ;", " /", ";", "/"];

/**
 * 少數在圖磚裡仍是簡體、或用語跟臺灣課本不同的標籤，逐筆改寫。
 *
 * ⚠️ **這不是簡繁轉換器**：maplibre 的表達式沒有辦法逐字換字形，只能整串比對後替換。
 * 所以這份表不可能「補完」，收錄範圍必須是一條講得出來的界線。
 *
 * **收錄範圍是機械掃出來的**：把 `place` 圖層的 `country`／`continent` 與整個
 * `water_name` 圖層，在 **zoom 2–5**（世界地圖尺度，也就是攤開整個世界時字最大、
 * 學生一定會讀到的那一層標籤）的所有圖磚掃過一遍，逐筆看過選出來的名稱，把簡體與
 * 非臺灣譯名列在這裡。實測是 171 個國家 + 9 個大洲 + 116 個水體。
 *
 * ⚠️ **省、州與城市刻意不收**：那個尺度有上萬筆、長尾沒有盡頭（悉尼／孟买／奥克兰
 * ……），硬編一份維護不起來。放大到單一國家之後仍會看到簡體地名，那是**已知限制**，
 * 不是漏掉。
 *
 * ⚠️ key 是「圖磚給的名稱**切掉多值之後**」的字串，不是 OSM 的原始欄位——所以
 * `斯威士兰 / 史瓦蒂尼` 這種要寫成 `斯威士兰`。上游哪天補上 `name:zh-Hant`，key 就
 * 對不到而自動失效（畫出來的是上游的新值），這是刻意讓它安全退場的方式。
 */
const ZH_HANT_OVERRIDES: Record<string, string> = {
  // 國家與大洲
  伯利兹: "貝里斯",
  刚果民主共和国: "剛果民主共和國",
  加纳: "迦納",
  吉尔吉斯斯坦: "吉爾吉斯",
  圣卢西亚: "聖露西亞",
  奥地利: "奧地利",
  斯威士兰: "史瓦帝尼",
  梵蒂冈: "梵蒂岡",
  // 這幾個字形是繁體，但譯名是中國大陸用法，改成外交部與課綱的寫法
  危地馬拉: "瓜地馬拉",
  洪都拉斯: "宏都拉斯",
  塔吉克斯坦: "塔吉克",
  畿內亞: "幾內亞",
  巴布亞新畿內亞: "巴布亞紐幾內亞",
  中非: "中非共和國",
  // 海洋、海峽、灣與大湖
  东西伯利亚海: "東西伯利亞海",
  休伦湖: "休倫湖",
  俾斯麦海: "俾斯麥海",
  几内亚湾: "幾內亞灣",
  切萨皮克湾: "切薩皮克灣",
  加利福尼亚湾: "加利福尼亞灣",
  卡奇湾: "卡奇灣",
  塞兰海: "塞蘭海",
  奥涅加湖: "奧涅加湖",
  密歇根湖: "密西根湖",
  巴芬湾: "巴芬灣",
  所罗门海: "所羅門海",
  托雷斯海峡: "托雷斯海峽",
  望加锡海峡: "望加錫海峽",
  杭州湾: "杭州灣",
  格陵兰海: "格陵蘭海",
  梅尔维尔子爵海峡: "梅爾維爾子爵海峽",
  温尼伯湖: "溫尼伯湖",
  班达海: "班達海",
  白鹤滩水库: "白鶴灘水庫",
  小湾电站水库: "小灣電站水庫",
  瓜亚基尔湾: "瓜亞基爾灣",
  维多利亚湖: "維多利亞湖",
  维纳恩湖: "維納恩湖",
  苏必利尔湖: "蘇必利爾湖",
  迪克森海峡: "迪克森海峽",
  邦尼湾: "邦尼灣",
  阿拉斯加湾: "阿拉斯加灣",
  马鲁古海: "馬魯古海",
  麦克卢尔海峡: "麥克盧爾海峽",
  // 同上，字形是繁體但譯名跟著上面的國名一起改
  莫桑比克海峡: "莫三比克海峽",
  马六甲海峡: "麻六甲海峽",
  洪都拉斯灣: "宏都拉斯灣",
};

/**
 * 組出「繁體中文優先」的 `text-field` 表達式。
 *
 * 三個步驟都在同一條表達式裡完成（maplibre 不接受 JS 回呼，只能用表達式）：
 * 1. `coalesce` 依 `NAME_FIELDS` 挑第一個有值的名稱
 * 2. 切掉多值名稱的第二段以後
 * 3. `match` 套用 `ZH_HANT_OVERRIDES`
 *
 * 第 2 步的取巧之處：`index-of` 找不到時回 -1，而 `slice` 的 end 吃到負數會**從尾巴
 * 倒數**（也就是安靜地砍掉最後一個字，不會報錯）。所以先把分隔符號接在字串尾巴
 * （`concat`）再找，找不到的情況自然會回傳字串長度，不需要額外的 `case` 判斷。
 *
 * ⚠️ `index-of` 的參數順序是 **`[要找的東西, 被搜尋的字串]`**，跟 `slice`／JS 的
 * `indexOf` 相反。寫反了會**每一個地名都少掉最後一個字**（德國→德、埃及→埃），
 * 而且 `tsc` 抓不到（表達式是斷言進型別的）、console 也不會有任何錯誤——只有把
 * 地圖畫出來看才發現得了。實測踩過。
 */
function localizedTextField(): ExpressionSpecification {
  const raw = ["coalesce", ...NAME_FIELDS.map((f) => ["get", f]), ""];
  const cut = ["min", ...NAME_SEPARATORS.map((s) => ["index-of", s, ["concat", ["var", "raw"], s]])];
  const overrides = Object.entries(ZH_HANT_OVERRIDES).flat();
  return [
    "let",
    "raw",
    raw,
    ["let", "zh", ["slice", ["var", "raw"], 0, cut], ["match", ["var", "zh"], ...overrides, ["var", "zh"]]],
  ] as unknown as ExpressionSpecification;
}

/**
 * 把樣式裡所有「以地名當文字」的 symbol 圖層換成繁體中文優先的表達式。
 *
 * 判準是原本的 `text-field` 有沒有提到 `name`：公路盾牌用的是 `["get","ref"]`、
 * 門牌是 `{housenumber}`，兩者都不該被改寫。Carto Positron 那份用的是舊式的
 * `"{name_en}"` 字串樣板（連 stops 物件都有），JSON 化之後一樣比對得到。
 */
function localizeStyle(style: StyleSpecification): StyleSpecification {
  const textField = localizedTextField();
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const current = layer.layout?.["text-field"];
    if (current === undefined || !JSON.stringify(current).includes("name")) continue;
    layer.layout!["text-field"] = textField;
  }
  return style;
}

async function fetchStyle(url: string): Promise<StyleSpecification> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as StyleSpecification;
}

/**
 * 取得底圖樣式。
 *
 * OpenFreeMap 是免費且無 SLA 的服務，這裡先 fetch 樣式 JSON 確認可用，
 * 失敗才回退到 Carto Positron，避免整張地圖開天窗。
 *
 * 兩份向量樣式都要先抓成 JSON 再改寫地名語系，所以備援也不能只回網址；
 * 真的連備援樣式都抓不到時才退回網址字串（那時已經沒有東西可以改寫了）。
 */
export async function loadBasemapStyle(id: BasemapId): Promise<string | StyleSpecification> {
  if (id === "nlsc-emap") return nlscStyle(NLSC_TILES.emap);
  if (id === "nlsc-photo") return nlscStyle(NLSC_TILES.photo);

  try {
    return localizeStyle(await fetchStyle(BASEMAP_STYLES.liberty));
  } catch (err) {
    console.warn("[gaia] OpenFreeMap 無法載入，改用 Carto Positron 備援底圖", err);
    try {
      return localizeStyle(await fetchStyle(BASEMAP_STYLES.positron));
    } catch {
      return BASEMAP_STYLES.positron;
    }
  }
}

/** 找出樣式中第一個 symbol 圖層，用來當作 hillshade 的 beforeId（讓地名壓在陰影之上）。 */
export function firstSymbolLayerId(style: StyleSpecification | undefined): string | undefined {
  return style?.layers?.find((l) => l.type === "symbol")?.id;
}
