/**
 * 水利署水庫開放資料的共用存取層。
 *
 * 被兩支腳本使用，而且**用途刻意分開**：
 *   - `build-geodata.mjs` 用 `fetchReservoirBasics()` + 蓄水範圍 KML 產生**靜態**
 *     幾何（public/data/geo/tw-reservoirs.geojson），commit 進 repo，一年才變一次。
 *   - `build-reservoirs.mjs` 用 `fetchReservoirConditions()` 產生**即時**水情
 *     （public/data/reservoirs-live.json），每次部署重抓、不進版控。
 *
 * ⚠️ **JSON 格式的端點過不了上游的 bot 防護，一律用 CSV。**
 * opendata.wra.gov.tw 前面掛著 F5 的 JS 挑戰（回應是一頁 `bobcmn`/`TSPD` 的
 * HTML 而不是資料，HTTP 狀態碼仍然是 **200**）。實測 `format=JSON` 幾乎必中，
 * `format=CSV` 絕大多數會過，偶爾也會被攔一次。所以：
 *   1. 只用 `format=CSV`；
 *   2. `assertNotChallenge()` 會辨識那頁 HTML 並轉成錯誤，交給呼叫端的指數退避重試。
 * 沒有第 2 點的話，CSV 剖析器會把那頁 HTML 當成一欄叫 `<!DOCTYPE html>` 的資料表
 * 安靜地吃下去，然後產出 0 筆水庫——這正是它咬人的方式。
 */

/** 資料集 45501「水庫水情資料」，每小時更新。 */
export const CONDITIONS_URL =
  "https://opendata.wra.gov.tw/api/v2/2be9044c-6e44-4856-aad5-dd108c2e6679?format=CSV";

/** 資料集 32726「水庫基本資料」，每年更新。 */
export const BASICS_URL =
  "https://opendata.wra.gov.tw/api/v2/708a43b0-24dc-40b7-9ed2-fca6a291e7ae?format=CSV";

/**
 * 資料集 13795「水庫蓄水範圍」的 KML。
 *
 * 這個網址是**參數化**的（`fname=ressub&filetype=KML`），不像 TGOS 的縣市界那樣
 * 帶發布日期，所以可以寫死，不需要 resolveDataGovTwUrl() 那套查詢。網址本身是從
 * data.gov.tw 資料集 13795 的檔案清冊裡拿到的。約 38 MB。
 */
export const EXTENT_KML_URL =
  "https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=ressub&filetype=KML";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部水利署";

/**
 * 水庫中文名 → 本站 id。
 *
 * 比照 `COUNTY_IDS` 的既有決定：**寫死對照表而不是 slugify**。理由一樣——這些 id
 * 是內容檔的檔名（src/content/geo/tw-reservoirs/<id>.json）與圖徵強調用的 key，
 * 必須跨上游改版保持穩定，而上游只給中文名。中文名 slugify 出來會是空字串。
 *
 * 對不到就讓建置失敗（見 build-geodata.mjs 的 transform）：新增一座公告水庫是
 * 罕見事件，該由人決定它的 id，而不是靜默生出一個沒有內容檔對應的新代碼。
 */
export const RESERVOIR_IDS = {
  新山水庫: "xinshan",
  西勢水庫: "xishi",
  翡翠水庫: "feitsui",
  直潭壩: "zhitan",
  石門水庫: "shihmen",
  寶山水庫: "baoshan",
  寶山第二水庫: "baoshan-2",
  大埔水庫: "dapu",
  永和山水庫: "yonghesan",
  明德水庫: "mingde",
  鯉魚潭水庫: "liyutan",
  德基水庫: "deji",
  谷關水庫: "guguan",
  石岡壩: "shigang",
  霧社水庫: "wushe",
  日月潭水庫: "sun-moon-lake",
  集集攔河堰: "jiji",
  湖山水庫: "hushan",
  仁義潭水庫: "renyitan",
  蘭潭水庫: "lantan",
  鹿寮溪水庫: "luliaoxi",
  白河水庫: "baihe",
  尖山埤水庫: "jianshanpi",
  德元埤水庫: "deyuanpi",
  虎頭埤水庫: "hutoupi",
  鹽水埤水庫: "yanshuipi",
  烏山頭水庫: "wushantou",
  曾文水庫: "zengwen",
  南化水庫: "nanhua",
  鏡面水庫: "jingmian",
  澄清湖水庫: "chengcinghu",
  阿公店水庫: "agongdian",
  鳳山水庫: "fengshan",
  牡丹水庫: "mudan",
  成功水庫: "chenggong",
  興仁水庫: "xingren",
  東衛水庫: "dongwei",
  西安水庫: "xian",
  七美水庫: "qimei",
  小池水庫: "xiaochi",
};

/**
 * 上游的 bot 防護回的是 HTTP 200 + 一頁 HTML，不是錯誤狀態碼。
 * 認出來並丟例外，才能讓呼叫端的指數退避真的重試。
 */
function assertNotChallenge(text, url) {
  if (/^\s*<!DOCTYPE html>/i.test(text) || /bobcmn|TSPD/.test(text.slice(0, 2000))) {
    throw new Error(`${url} → 被上游的 bot 防護攔截（回了 HTML 而不是 CSV）`);
  }
}

/**
 * 夠用的 CSV 剖析器（引號、跳脫引號、欄位內逗號與換行）。
 *
 * 不能用 `split(",")`：`集水面積` 這類欄位的值是 `"48,100.00"`，千分位逗號在
 * 引號裡面。比照 lib/simplify.mjs 與 lib/unzip.mjs 的既有作法，不加依賴。
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  // 去掉 BOM——上游的 CSV 一律帶 BOM（JSON 才沒有），不去掉的話第一個欄位名
  // 會變成 "﻿民國年"，對不到任何欄位而且完全不報錯。
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r") { /* 忽略，交給 \n 收尾 */ }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])),
  );
}

/**
 * ⚠️ 退避重試必須包住 **assertNotChallenge**，不能只包住 fetch。
 *
 * bot 防護回的是 HTTP **200** + 一頁 HTML，所以呼叫端那個看狀態碼的
 * `fetchWithRetry` 完全不會重試——它眼中那次請求是成功的。挑戰頁大約每幾次會
 * 出現一次，只要沒有這一層，`npm run build:reservoirs` 就會隨機失敗，而錯誤訊息
 * 指向「被攔截」卻沒有人再試一次。
 */
async function fetchCsv(url, fetchWithRetry, attempts = 4) {
  for (let i = 0; ; i++) {
    try {
      const text = await (await fetchWithRetry(url)).text();
      assertNotChallenge(text, url);
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error(`${url} → CSV 剖析後 0 筆，上游格式可能變了`);
      return rows;
    } catch (err) {
      if (i === attempts - 1) throw err;
      const waitMs = 3000 * 2 ** i;
      process.stdout.write(`（${waitMs / 1000}s 後重試）`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

/**
 * 有效容量（萬立方公尺）→ 給人看的字串。
 *
 * 上游一律用「萬立方公尺」，但曾文是 50,479 萬——五位數的「萬」沒有人讀得出量級，
 * 所以破億就換成「億立方公尺」。這個字串只進 geojson 的 `meta`（圖層抽屜清單的
 * 次標）；詳情卡拿的是原始數字，自己決定怎麼排版。
 */
export function formatCapacity(tenThousandM3) {
  if (tenThousandM3 == null) return "不詳";
  if (tenThousandM3 >= 10000) return `${(tenThousandM3 / 10000).toFixed(2)} 億立方公尺`;
  return `${Math.round(tenThousandM3).toLocaleString("zh-TW")} 萬立方公尺`;
}

/**
 * 收掉欄位裡的換行與空白。
 *
 * ⚠️ 上游的文字欄位**內含換行**：石門水庫的鄉鎮是 `"桃園市龍潭區、\n大溪區、復興區"`，
 * 鯉魚潭是 `"苗栗縣卓蘭鎮\n大湖鄉"`。那是 CSV 引號裡的真實換行，不是剖析錯誤——
 * 上游那份表格是排版用的斷行。不收掉的話它會直接跑進清單次標與詳情卡。
 *
 * 空白是**整個刪掉**而不是併成一個空格：這幾個欄位全是中文（鄉鎮、河川、壩型、
 * 機關、功能），中文詞之間本來就不該有空格，換成空格會得到「龍潭區、 大溪區」
 * 這種頓號後面多一格的結果。
 */
const clean = (v) => (v == null ? v : String(v).replace(/\s+/g, ""));

/** 千分位逗號 → number；空字串與非數字回 null（上游很多欄位是空的）。 */
export const num = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * 水庫基本資料：水庫代碼 → { 名稱、容量、壩高、集水面積… }。
 *
 * 容量單位是**萬立方公尺**，面積單位是**公頃**（實測對過：新山水庫集水面積 160
 * 公頃 = 1.6 km²、滿水位面積 50.9 公頃，與 KML 量到的 0.57 km² 相符）。
 */
export async function fetchReservoirBasics(fetchWithRetry) {
  const rows = await fetchCsv(BASICS_URL, fetchWithRetry);
  const byCode = new Map();
  for (const r of rows) {
    const code = r["水庫代碼"];
    if (!code) continue;
    byCode.set(code, {
      code,
      name: clean(r["水庫名稱"]),
      region: clean(r["地區別"]),
      river: clean(r["河川名稱"]),
      authority: clean(r["機關名稱"]),
      town: clean(r["鄉鎮市區名稱"]),
      damType: clean(r["型式"]),
      damHeight_m: num(r["壩堰高"]),
      catchment_ha: num(r["集水面積"]),
      surface_ha: num(r["滿水位面積"]),
      /** 目前有效容量（萬立方公尺）——蓄水百分比的分母 */
      effectiveCapacity_10k_m3: num(r["目前有效容量"]),
      purpose: clean(r["功能"]),
      surveyedAt: clean(r["最近完成庫容測量時間"]),
    });
  }
  return byCode;
}

/**
 * 水庫水情：水庫代碼 → 最新一筆觀測。
 *
 * 上游一次回**過去 24 小時、每小時一筆**（實測 63 座水庫共 450 列），所以要自己
 * 挑每座水庫 `observationtime` 最大的那一筆，不能拿第一列。
 *
 * `effectivewaterstoragecapacity`（有效蓄水量，萬立方公尺）很多列是空的，
 * 空的要跳過而不是當成 0——當成 0 會讓一座滿水位的水庫顯示成完全乾涸。
 */
export async function fetchReservoirConditions(fetchWithRetry) {
  const rows = await fetchCsv(CONDITIONS_URL, fetchWithRetry);
  const latest = new Map();
  for (const r of rows) {
    const code = r.reservoiridentifier;
    const time = r.observationtime;
    const storage = num(r.effectivewaterstoragecapacity);
    if (!code || !time || storage == null) continue;
    const prev = latest.get(code);
    if (!prev || time > prev.observedAt) {
      latest.set(code, {
        code,
        observedAt: time,
        storage_10k_m3: storage,
        waterLevel_m: num(r.waterlevel),
        inflow_cms: num(r.inflowdischarge),
        outflow_cms: num(r.totaloutflow),
        rainfall_mm: num(r.accumulaterainfallincatchment),
      });
    }
  }
  return latest;
}
