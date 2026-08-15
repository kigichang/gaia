/**
 * 侵臺颱風的路徑與災損。
 *
 * ## 來源：交通部中央氣象署「颱風資料庫」（rdc28）
 *
 * 兩份東西都從同一個站台來，而且**都不需要金鑰**（實測 2026-08）：
 *
 * 1. **最佳路徑資料**（`TrackBEST.txt`）——氣象署事後重新分析過的官方路徑，
 *    每筆有時間、經緯度、中心氣壓、近中心最大風速、陣風與暴風半徑。
 * 2. **颱風概況表**——那一頁的 HTML 是伺服器端算繪的，表格裡直接有
 *    侵臺路徑分類、登陸地段、動態與**災情**。該頁自己註明
 *    「災情節錄自內政部消防署及行政院農委會資料」，所以死亡人數與農損金額
 *    本來就是這兩個主管機關的官方統計，由氣象署彙整。
 *
 * ⚠️ **為什麼不用中央氣象署開放資料平臺**：`opendata.cwa.gov.tw` 要申請 API key，
 * 直接撞上硬性禁止事項 #1（與地震那次同一個結論）。rdc28 這兩條路徑是公開網頁，
 * 剖析它比照 `lib/quakes-major.mjs` 剖析〈災害地震〉表的既有作法。
 *
 * ⚠️ **`TrackData` 這一組產品在網站 UI 上標示「僅供研究用使用者瀏覽、下載」，
 * 但 `get_txt` 端點實測不需登入。** 那是一個**沒有文件的內部端點**，沒有版本與
 * 格式承諾，所以下面有硬檢查：14 個颱風每一個都必須抓到路徑點與概況表，
 * 對不上就讓建置失敗，不要靜默少畫幾條。
 *
 * ## ⚠️ 一個颱風可能有好幾次「侵臺」，概況表是**一次一張表**
 *
 * 1986 韋恩三度侵臺，概況表就有三張 `侵臺次數` 分表，各自有自己的登陸地段與動態。
 * 只抓一張、或用 dict 讓後面蓋掉前面，都會拿到錯的那一次——實測韋恩的第 3 次
 * 登陸地段是 `---`（沒有登陸），而課本要講的是**第 1 次由濁水溪口登陸**。
 * 所以 `parseSummary()` 回傳的是 `visits[]`，主要那一次由
 * 「**第一個有登陸地段的**」決定（韋恩 → 第 1 次、納莉 → 第 2 次，兩個都對）。
 */

/** 颱風資料庫首頁（產物 metadata 與圖層 sources 用）。 */
export const SOURCE_PAGE = "https://rdc28.cwa.gov.tw/TDB/";
export const SOURCE_LABEL = "交通部中央氣象署 颱風資料庫";
export const LICENSE = "政府資料開放授權條款第 1 版";

const DETAIL = (id) => `https://rdc28.cwa.gov.tw/TDB/public/typhoon_detail?typhoon_id=${id}`;
const TRACK = (year, en) =>
  "https://rdc28.cwa.gov.tw/TDB/public/typhoon_detail/get_txt?txt=" +
  encodeURIComponent(`${year}/${en}/OBS/TrackData/${year}.${en}.TrackBEST.txt`);

/**
 * 侵臺颱風路徑分類（氣象署〈颱風百問〉第 41 題，統計期間 1911–2024）。
 *
 * 官方在資料庫 UI 上稱它「侵臺颱風路徑(九類)」，第十類另外叫「特殊」。
 * 這是這一層最值得教的東西：颱風不是只有一種走法。
 */
export const PATH_CATEGORIES = {
  1: "通過臺灣北部海面向西或西北",
  2: "通過臺灣北部向西或西北",
  3: "通過臺灣中部向西或西北",
  4: "通過臺灣南部向西或西北",
  5: "通過臺灣南部海面向西或西北",
  6: "沿臺灣東岸或東部海面北上",
  7: "沿臺灣西岸或臺灣海峽北上",
  8: "通過臺灣南部海面向東或東北",
  9: "通過臺灣南部向東或東北",
  特殊: "無法歸於官方九類的走法",
};

/** 可點清單的分組順序（`browse.groupBy` 依序切、不排序，所以 transform 要照這個排）。 */
export const CATEGORY_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "特殊"];

/**
 * 收錄的颱風。
 *
 * ⚠️ **id 是人工寫的，不能用 `slugify()`**：那支是 `[^a-z0-9]+ → -`，中文名會全部
 * 被剝掉、14 個颱風得到 14 個空字串（比照 `FAULT_IDS`／`RIVERS`／`RESERVOIR_IDS`）。
 * id 同時是內容檔的檔名，必須跨上游改版保持穩定。
 *
 * ⚠️ **同名颱風會重複出現**（颱風名字會重複使用），所以 id 一律帶年份。
 *
 * ⚠️ **這 14 個是編者依課綱與災損量級挑的，不是官方排名。** 氣象署 1958 年以來
 * 共列 454 個發布過警報的颱風；挑選準則是「課本必講 × 災損量級 × 侵臺路徑分類要分散」。
 * 要增刪就改這張表，順手更新圖層說明裡的數字。
 *
 * `en` 必須逐字等於氣象署的英文名（路徑檔的檔名用它組出來）。
 * ⚠️ 上游的英文名偶爾帶尾隨空白（實測 `SOULIK `、`KROSA `），這裡一律寫乾淨的。
 */
export const TYPHOONS = [
  { id: "wayne-1986", tdbId: "198612", year: 1986, en: "WAYNE", name: "韋恩" },
  { id: "tim-1994", tdbId: "199405", year: 1994, en: "TIM", name: "提姆" },
  { id: "herb-1996", tdbId: "199608", year: 1996, en: "HERB", name: "賀伯" },
  { id: "winnie-1997", tdbId: "199714", year: 1997, en: "WINNIE", name: "溫妮" },
  { id: "xangsane-2000", tdbId: "200020", year: 2000, en: "XANGSANE", name: "象神" },
  { id: "toraji-2001", tdbId: "200108", year: 2001, en: "TORAJI", name: "桃芝" },
  { id: "nari-2001", tdbId: "200116", year: 2001, en: "NARI", name: "納莉" },
  { id: "mindulle-2004", tdbId: "200407", year: 2004, en: "MINDULLE", name: "敏督利" },
  { id: "longwang-2005", tdbId: "200519", year: 2005, en: "LONGWANG", name: "龍王" },
  { id: "krosa-2007", tdbId: "200715", year: 2007, en: "KROSA", name: "柯羅莎" },
  { id: "morakot-2009", tdbId: "200908", year: 2009, en: "MORAKOT", name: "莫拉克" },
  { id: "soulik-2013", tdbId: "201307", year: 2013, en: "SOULIK", name: "蘇力" },
  { id: "soudelor-2015", tdbId: "201513", year: 2015, en: "SOUDELOR", name: "蘇迪勒" },
  { id: "gaemi-2024", tdbId: "202403", year: 2024, en: "GAEMI", name: "凱米" },
];

/** 上游用 `-99` 表示缺值，`---` 表示沒有這一項。 */
const MISSING_NUM = -99;
const isBlank = (s) => !s || s === "---";

const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n !== MISSING_NUM ? n : null;
};

/** 把一格 HTML 攤平成純文字。`<br>` 是排版斷行，換成頓號比併成空白好讀。 */
const cellText = (html) =>
  html
    .replace(/<br\s*\/?>/gi, "｜")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCodePoint(Number.parseInt(d, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 剖析「颱風概況表」。
 *
 * 表格結構：第一張表是名稱／編號／生成地點，之後**每一次侵臺各一張表**。
 * 只截到下一個 `card-header` 為止，否則會把底下「觀測資料」那一整區也吃進來。
 */
function parseSummary(html, tdbId) {
  const start = html.indexOf("颱風概況表");
  if (start < 0) throw new Error(`${tdbId}：找不到「颱風概況表」，上游改版了`);
  const next = html.indexOf("card-header", start + 1);
  const section = html.slice(start, next > 0 ? next : start + 20000);

  const tables = [...section.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) =>
    Object.fromEntries(
      [...m[1].matchAll(/<th scope="row">([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)].map(
        (r) => [cellText(r[1]), cellText(r[2])],
      ),
    ),
  );

  const head = tables.find((t) => t["名稱"]);
  if (!head) throw new Error(`${tdbId}：概況表沒有「名稱」欄`);

  // 生成地點是「經度, 緯度」（實測莫拉克 136.0, 21.0 落在西北太平洋洋面上）
  const origin = (head["生成地點"] ?? "").split(",").map((v) => Number.parseFloat(v));

  const visits = tables
    .filter((t) => t["侵臺路徑分類"] != null)
    .map((t) => ({
      label: t["侵臺次數"] ?? null,
      nearDate: isBlank(t["侵(近)臺日期"]) ? null : t["侵(近)臺日期"].replace(/\s+/g, ""),
      // 「海上 2009-08-05 20:30:00｜陸上 2009-08-06 08:30:00」——時系是 TST
      issued: isBlank(t["發布時間"]) ? null : t["發布時間"],
      lifted: isBlank(t["解除時間"]) ? null : t["解除時間"],
      reports: num(t["發布報數"]),
      intensity: isBlank(t["最大強度"]) ? null : t["最大強度"],
      maxWind: num(t["近中心最大風速"]),
      category: isBlank(t["侵臺路徑分類"]) ? null : t["侵臺路徑分類"],
      landfall: isBlank(t["登陸地段"]) ? null : t["登陸地段"],
      movement: isBlank(t["動態"]) ? null : t["動態"],
      harm: isBlank(t["災情"]) ? null : t["災情"],
    }));

  if (visits.length === 0) throw new Error(`${tdbId}：概況表沒有任何「侵臺路徑分類」欄`);

  return {
    name: head["名稱"],
    origin: origin.length === 2 && origin.every(Number.isFinite) ? origin : null,
    visits,
  };
}

/**
 * 剖析最佳路徑檔。
 *
 * 欄位：`Year Name YYYY/MM/DD HH:MM Lat Lon Press Wind Gust 7Dir 10Dir Warn`
 *
 * ⚠️ **時間是 UTC。** 換算臺灣時間要 +8——這跟 USGS 地震那個「921 被印成 09-20」
 * 是同一個坑（莫拉克在花蓮登陸的官方時間是 8/7 23:50 TST，用 UTC 直接印會變 8/7 15:50）。
 * 產物存的是原始 UTC 時戳，要顯示的一方負責換算。
 *
 * ⚠️ **時間解析度不一致**：平時 6 小時一筆，2002 年後海上警報期間 3 小時，
 * 2019 年後陸上警報期間 1 小時。所以近年颱風的路徑點明顯比早年密——
 * 那不是路徑比較彎，是取樣比較密。
 */
function parseTrack(text, tdbId) {
  const points = [];
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 11 || !/^\d{4}\/\d{2}\/\d{2}$/.test(f[2])) continue;
    const lat = num(f[4]);
    const lng = num(f[5]);
    if (lat == null || lng == null) continue;
    // 已經是 UTC，直接組成 ISO 8601 才不會被讀成本地時間
    const utc = new Date(`${f[2].replaceAll("/", "-")}T${f[3]}:00Z`);
    /**
     * 臺灣時間（UTC+8）的「月/日」與「時」，**拆成兩個欄位**。
     *
     * ⚠️ **這是產物裡唯一一組給人看的字串，而且是刻意的**：地圖上要在選取的
     * 路徑點旁邊標出時刻，而 maplibre 的表達式**沒有辦法做時區換算**——`time`
     * 是 UTC，直接印會把莫拉克在花蓮登陸的 8/7 23:50 印成 8/7 15:50，就是 USGS
     * 地震那個「921 被印成 09-20」的同一個坑。所以換算在建置期做完。
     *
     * 拆兩個欄位是為了讓算繪端自己決定要不要接上時刻（低縮放只標日期，
     * 放大之後才 `["concat", 日期, " ", 時]`），而不是存兩份長字串。
     */
    const tst = new Date(utc.getTime() + 8 * 3600 * 1000);
    const [d, h] = tst.toISOString().split("T");
    const [, mm, dd] = d.split("-");

    points.push({
      time: utc.toISOString().replace(".000", ""),
      // "8/22"——月份不補零，路徑點很密，每個字都影響標註放得下放不下
      date: `${Number(mm)}/${Number(dd)}`,
      hour: h.slice(0, 2),
      /**
       * 每天一個的「日標」＝ UTC 00:00（＝臺灣時間當天 08:00）。低縮放時只標這些，
       * 否則 757 個點會糊成一片。⚠️ 這是 6 小時取樣一定會落到的整點，所以每個
       * 颱風都標得出來（實測每個颱風 6–21 個）。
       */
      day: f[3] === "00:00",
      lng,
      lat,
      pressure: num(f[6]),
      wind: num(f[7]),
      gust: num(f[8]),
      /**
       * 0＝未發布警報、1＝海上警報、2＝海上陸上警報。
       *
       * ⚠️ 早年的颱風整條路徑都是 `-99`（實測 1986 韋恩），那是**缺值不是 0**
       * ——那時候的警報狀態沒有一起數化。`num()` 會把它變成 null，呼叫端要略過
       * 這個屬性而不是補 0（比照氣壓缺值的處理）。
       */
      warn: num(f[10]),
    });
  }
  if (points.length === 0) throw new Error(`${tdbId}：最佳路徑檔剖析出 0 個定位點`);
  return points;
}

/**
 * 抓取全部 14 個颱風。回傳 `{ typhoons, warnings }`。
 *
 * 逐一抓（14 個 × 2 個請求），不做批次——這是一個網頁站台不是 API，
 * 而且一年才重跑一次，沒有必要為它寫並發控制。
 *
 * **module-level 快取**：`tw-typhoons`（路徑線）與 `tw-typhoon-centers`（定位點）
 * 是同一份上游資料的兩種幾何，一個 process 只該抓一次（比照 `monuments.mjs`
 * 三個級別共用一份下載）。⚠️ 快取命中時 `warnings` 回空陣列，否則同一份對照表
 * 會在建置日誌上印兩遍。
 */
let cached = null;

export async function fetchTyphoons(fetchWithRetry) {
  if (cached) return { typhoons: cached, warnings: [] };
  const result = await fetchAll(fetchWithRetry);
  cached = result.typhoons;
  return result;
}

async function fetchAll(fetchWithRetry) {
  const typhoons = [];
  const warnings = [];

  for (const meta of TYPHOONS) {
    const summary = parseSummary(await (await fetchWithRetry(DETAIL(meta.tdbId))).text(), meta.tdbId);
    const track = parseTrack(await (await fetchWithRetry(TRACK(meta.year, meta.en))).text(), meta.tdbId);

    // 上游的「名稱」寫成「莫拉克 (MORAKOT)」，用它交叉檢查對照表沒有抄錯編號
    if (!summary.name.includes(meta.name)) {
      throw new Error(
        `${meta.tdbId}：概況表寫的是「${summary.name}」，對照表寫的是「${meta.name}」——編號可能抄錯了`,
      );
    }

    /**
     * 主要那一次侵臺：**第一個有登陸地段的**。
     *
     * ⚠️ 不要改成「最後一次」或「發布報數最多的那次」：韋恩三次的報數是
     * 12／4／26，報數最多的第 3 次根本沒有登陸也沒有災情，而課本要講的正是
     * 第 1 次由濁水溪口登陸。納莉的第 1 次也只是在琉球外海打轉。
     */
    const primary = summary.visits.find((v) => v.landfall) ?? summary.visits[0];
    if (!primary.category) throw new Error(`${meta.tdbId}：主要那次侵臺沒有路徑分類`);
    if (!PATH_CATEGORIES[primary.category]) {
      throw new Error(`${meta.tdbId}：未知的侵臺路徑分類「${primary.category}」`);
    }

    // 災情可能掛在別次侵臺上（韋恩第 3 次是 `---`），取第一個有值的
    const harm = summary.visits.map((v) => v.harm).find(Boolean) ?? null;
    if (!harm) throw new Error(`${meta.tdbId}：概況表沒有任何災情敘述`);

    const pressures = track.map((p) => p.pressure).filter((v) => v != null);
    const winds = track.map((p) => p.wind).filter((v) => v != null);

    typhoons.push({
      ...meta,
      origin: summary.origin,
      visits: summary.visits,
      primary,
      harm,
      track,
      // ⚠️ 缺值時是 null，呼叫端**不可以**把 null 寫進 properties——`["has", prop]`
      // 會判成 true，把資料缺漏畫成 0（水庫蓄水率那次的坑）
      minPressure: pressures.length ? Math.min(...pressures) : null,
      peakWind: winds.length ? Math.max(...winds) : null,
    });

    const [w, s, e, n] = bbox(track);
    warnings.push(
      `${meta.year} ${meta.name}（${meta.en}）：${track.length} 點・` +
        `第 ${primary.category} 類・登陸 ${primary.landfall ?? "無"}・` +
        `bbox ${w.toFixed(1)}E–${e.toFixed(1)}E／${s.toFixed(1)}N–${n.toFixed(1)}N` +
        (summary.visits.length > 1 ? `・侵臺 ${summary.visits.length} 次` : ""),
    );
  }

  if (typhoons.length !== TYPHOONS.length) {
    throw new Error(`只抓到 ${typhoons.length} 個颱風，預期 ${TYPHOONS.length}`);
  }
  return { typhoons, warnings };
}

function bbox(track) {
  const lngs = track.map((p) => p.lng);
  const lats = track.map((p) => p.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/** 「第 3 類」／「特殊路徑」——可點清單的組名，也是搜尋副標的一部分。 */
export const categoryLabel = (c) => (c === "特殊" ? "特殊路徑" : `第 ${c} 類`);
