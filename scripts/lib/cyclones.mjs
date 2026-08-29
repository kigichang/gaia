/**
 * 世界紀錄級熱帶氣旋的最佳路徑。
 *
 * ## 來源：IBTrACS v04r01（美國國家環境資訊中心 NCEI）
 *
 * IBTrACS（International Best Track Archive for Climate Stewardship）是 WMO 指定
 * 的全球熱帶氣旋最佳路徑典藏，把各洋盆負責機構（NHC、JTWC、日本氣象廳、印度氣象局、
 * 留尼旺、澳洲氣象局、斐濟…）事後重新分析過的路徑併成同一份檔案。**免金鑰、
 * 有 CORS 標頭**（實測 `ACAO: *`），但**只在建置期呼叫**——見下面那條大小的說明。
 *
 * ⚠️ **為什麼不是各洋盆各抓一份官方資料**：那會變成七個格式互不相同的來源
 * （NHC 的 HURDAT2、JTWC 的 btk、氣象廳的 bst…），而且 1899 年的馬希納只在
 * IBTrACS 併進來的歷史資料集（td9636）裡才找得到。整合工作 IBTrACS 已經做完了，
 * 而且它是 WMO 認可的那一份。
 *
 * ## ⚠️ 這份檔案有 331 MB，而且我們只要其中 33 個氣旋
 *
 * `ibtracs.ALL.list.v04r01.csv` 收錄 1842 年以來全球 13,584 個氣旋、逐 3 小時
 * 一筆。**不可以 `await res.text()`**——那會把 331 MB 一次讀進記憶體再切行。
 * 這裡改成**逐塊解碼、逐行過濾**（`streamRows()`），常駐記憶體只有一個緩衝區與
 * 我們要的那 33 條路徑。
 *
 * ⚠️ 也不要改抓 `ibtracs.since1980.*`（小很多）：卡門(1960)、南施(1961)、
 * 波拉(1970)、狄普(1979)、馬希納(1899) 五個都在 1980 年以前，而它們正是這一層
 * 最重要的幾筆（最低氣壓與致死最多都在裡面）。分成「since1980 ＋ 幾個洋盆檔」
 * 反而更大：光是 WP 一個洋盆就有 114 MB。
 *
 * ⚠️ 上游是 Apache 且支援 Range（實測回 206），理論上可以拿 SID 排序做二分搜尋
 * 把下載量壓到幾 MB。**刻意不做**：那要依賴「列一定依 SID 排序」這個沒有任何
 * 承諾的性質，而這支腳本一年跑不了幾次，串流一次是幾分鐘的事。
 *
 * ## ⚠️ 路徑會跨越 ±180，而且 IBTrACS 的經度是**連續**的
 *
 * 颶風約翰(1994) 是「行進距離最遠」的紀錄保持者，它從墨西哥外海一路向西越過
 * 換日線進入西北太平洋、又折回東邊——IBTrACS 把它的經度寫成 266.9 一路減到
 * 172.9（**超過 180 就不 wrap**）。直接丟給 maplibre 會畫出一條繞過整個地球的
 * 橫線而且**不報錯**（洋流那一層踩過同一個坑，見 registry/generators.ts）。
 * 所以座標一律先正規化到 [-180, 180]，再用 `splitAntimeridian()` 切段並在
 * ±180 上補端點。伊歐佳(2006) 與馬希納那幾筆也走同一條路徑。
 *
 * ## ⚠️ 風速一律取 `USA_WIND`（一分鐘平均），缺值就不寫
 *
 * IBTrACS 每一筆都同時收了好幾個機構的風速，而**平均時距不同**：美系機構
 * （NHC／JTWC）是一分鐘平均，日本氣象廳、印度氣象局、澳洲氣象局是十分鐘或
 * 三分鐘平均，同樣的一個颱風用十分鐘平均會少 10–15%。混著用等於在同一條色階上
 * 比兩把不同的尺，所以**只取 USA_WIND**——它也是維基百科那張紀錄表「一分鐘平均
 * 風速」欄的來源。
 *
 * 代價是 1899 年的馬希納沒有任何美系機構的重新分析，整條路徑都沒有風速，
 * 在地圖上會畫成 ramp 的「無風速紀錄」灰。那是誠實的：那個年代本來就沒有這種
 * 觀測，而它保持的紀錄（最高風暴潮）也不是風速。
 */

/** 逐行過濾用的來源。⚠️ 331 MB，見檔頭。 */
export const TRACK_URL =
  "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/" +
  "v04r01/access/csv/ibtracs.ALL.list.v04r01.csv";

/** 產物 metadata 與詳情卡署名用。⚠️ 連的是資料集本身的產品頁，不是 NCEI 首頁。 */
export const SOURCE_PAGE = "https://www.ncei.noaa.gov/products/international-best-track-archive";
export const SOURCE_LABEL = "IBTrACS 全球熱帶氣旋最佳路徑";
export const LICENSE = "公有領域（美國政府作品）";

/**
 * 可點清單的分組（`browse.groupBy`）。
 *
 * ⚠️ **依序切、不排序**，所以 `transform` 必須讓同一個洋盆的圖徵連續。
 * 分組沿用維基百科紀錄表「生成海域」欄的講法，只把「東北太平洋」與「中太平洋」
 * 併成一組（那是同一個颶風季的東西半段，中太平洋只有伊歐佳一筆），並把
 * 澳洲近海與南太平洋併成一組（南半球那六筆分屬三個機構，課本一律當一區講）。
 */
export const BASIN_ORDER = [
  "西北太平洋",
  "東北與中太平洋",
  "北大西洋",
  "北印度洋",
  "西南印度洋",
  "澳洲近海與南太平洋",
  "南大西洋",
];

/**
 * 收錄名單。
 *
 * ⚠️ **這 33 筆逐字對應維基百科〈熱帶氣旋〉「紀錄」那張表**，不是編者自己挑的
 * ——「紀錄」就是這一層要教的東西，少一筆或多一筆都會讓「這張表在地圖上長什麼
 * 樣子」這件事對不起來。表格本身的每一列都附有原始出處（NHC 的颱風報告、
 * AOML 的 FAQ、氣象機構的新聞稿），逐一寫進各自的說明卡。
 *
 * ⚠️ `sid` 是 IBTrACS 的序號，人工從官方的
 * `IBTrACS_SerialNumber_NameMapping_v04r01_*.txt` 對出來的（那份 1 MB 的對照表
 * 每次改版檔名都會變日期，所以**不由程式抓**）。格式是
 * `<年><年積日><半球><起始緯度><起始經度>`，所以肉眼就能粗略核對：狄普的
 * `1979275N06159` ＝ 1979 年第 275 天、北緯 6 度、東經 159 度生成。
 * 五筆上游沒有名字的（波拉、奧里薩、阿耆尼、馬希納、卡塔琳娜）是靠生成時間與
 * 位置對出來的，`fetchCyclones()` 會再用 bbox 與強度交叉檢查一次。
 *
 * ⚠️ `pressure` / `wind` 是**維基百科那張表列的紀錄值**，不是 IBTrACS 算出來的。
 * 兩者會有出入（各機構的重新分析結果不同，例如南施的 882 hPa 是日本氣象廳的值），
 * 所以產物裡寫的是 IBTrACS 自己的極值，這兩欄只拿來**交叉檢查**：差太多就印一行
 * 警告，讓人去看是不是對錯了氣旋。
 *
 * `name` 只放中文名、不含「颱風／颶風／氣旋」——沿線標註對字串長度極度敏感
 * （見 CLAUDE.md「沿線標註很脆弱」與颱風那一層的實測表）。稱謂放 `kind`，
 * 由 `meta` 與說明卡負責講。
 */
export const CYCLONES = [
  // ── 西北太平洋 ──────────────────────────────────────────────
  { id: "carmen-1960", sid: "1960227N23126", name: "卡門", en: "CARMEN", year: 1960, kind: "颱風",
    basin: "西北太平洋", record: "風眼最大（直徑約 370 公里）", pressure: 980, wind: 75 },
  { id: "nancy-1961", sid: "1961250N07173", name: "南施", en: "NANCY", year: 1961, kind: "颱風",
    basin: "西北太平洋", record: "一分鐘風速最高的非正式紀錄（185 節）", pressure: 882, wind: 185 },
  { id: "tip-1979", sid: "1979275N06159", name: "狄普", en: "TIP", year: 1979, kind: "颱風",
    basin: "西北太平洋", record: "中心氣壓最低、範圍最大（870 hPa）", pressure: 870, wind: 165 },
  { id: "forrest-1983", sid: "1983259N08161", name: "佛瑞特", en: "FORREST", year: 1983, kind: "颱風",
    basin: "西北太平洋", record: "增強最快（24 小時內降 100 hPa）", pressure: 885, wind: 150 },
  { id: "haiyan-2013", sid: "2013306N07162", name: "海燕", en: "HAIYAN", year: 2013, kind: "颱風",
    basin: "西北太平洋", record: "官方衛星觀測首次測得一分鐘風速 170 節", pressure: 895, wind: 170 },
  { id: "meranti-2016", sid: "2016253N13144", name: "莫蘭蒂", en: "MERANTI", year: 2016, kind: "颱風",
    basin: "西北太平洋", record: "以最高強度進入呂宋海峽", pressure: 890, wind: 170 },
  { id: "goni-2020", sid: "2020299N11144", name: "天鵝", en: "GONI", year: 2020, kind: "颱風",
    basin: "西北太平洋", record: "登陸時風速最高", pressure: 905, wind: 170 },
  { id: "surigae-2021", sid: "2021102N06144", name: "舒力基", en: "SURIGAE", year: 2021, kind: "颱風",
    basin: "西北太平洋", record: "北半球 4 月最強", pressure: 895, wind: 170 },
  // ── 東北與中太平洋 ──────────────────────────────────────────
  { id: "john-1994", sid: "1994222N11267", name: "約翰", en: "JOHN", year: 1994, kind: "颶風",
    basin: "東北與中太平洋", record: "行進距離最遠（13,280 公里）", pressure: 929, wind: 150 },
  { id: "patricia-2015", sid: "2015293N13266", name: "帕翠莎", en: "PATRICIA", year: 2015, kind: "颶風",
    basin: "東北與中太平洋", record: "一分鐘風速最高的正式紀錄（185 節）", pressure: 872, wind: 185 },
  { id: "ioke-2006", sid: "2006228N10218", name: "伊歐佳", en: "IOKE", year: 2006, kind: "颶風",
    basin: "東北與中太平洋", record: "中太平洋氣壓最低", pressure: 915, wind: 140 },
  // ── 北大西洋 ────────────────────────────────────────────────
  { id: "allen-1980", sid: "1980214N11330", name: "亞蘭", en: "ALLEN", year: 1980, kind: "颶風",
    basin: "北大西洋", record: "大西洋首個一分鐘風速 165 節", pressure: 899, wind: 165 },
  { id: "katrina-2005", sid: "2005236N23285", name: "卡崔娜", en: "KATRINA", year: 2005, kind: "颶風",
    basin: "北大西洋", record: "損失最大（1,250 億美元）", pressure: 902, wind: 150 },
  { id: "wilma-2005", sid: "2005289N18282", name: "葳瑪", en: "WILMA", year: 2005, kind: "颶風",
    basin: "北大西洋", record: "風眼最小（直徑約 3.7 公里）", pressure: 882, wind: 160 },
  { id: "marco-2008", sid: "2008280N18268", name: "馬可", en: "MARCO", year: 2008, kind: "熱帶風暴",
    basin: "北大西洋", record: "覆蓋範圍最小（烈風半徑 18.5 公里）", pressure: 998, wind: 55 },
  { id: "harvey-2017", sid: "2017228N14314", name: "哈維", en: "HARVEY", year: 2017, kind: "颶風",
    basin: "北大西洋", record: "與卡崔娜並列損失最大", pressure: 937, wind: 115 },
  { id: "melissa-2025", sid: "2025294N14290", name: "梅麗莎", en: "MELISSA", year: 2025, kind: "颶風",
    basin: "北大西洋", record: "大西洋再現一分鐘風速 165 節", pressure: 892, wind: 165 },
  // ── 北印度洋 ────────────────────────────────────────────────
  { id: "bhola-1970", sid: "1970312N12086", name: "波拉", en: "BHOLA", year: 1970, kind: "氣旋",
    basin: "北印度洋", record: "致死最多（逾 50 萬人）", pressure: 966, wind: 115 },
  { id: "odisha-1999", sid: "1999298N12099", name: "奧里薩", en: "ODISHA", year: 1999, kind: "氣旋",
    basin: "北印度洋", record: "北印度洋氣壓最低", pressure: 912, wind: 140 },
  { id: "fani-2019", sid: "2019116N02090", name: "法尼", en: "FANI", year: 2019, kind: "氣旋",
    basin: "北印度洋", record: "北印度洋首個一分鐘風速 150 節", pressure: 932, wind: 150 },
  { id: "agni-2004", sid: "2004332N02072", name: "阿耆尼", en: "AGNI", year: 2004, kind: "氣旋",
    basin: "北印度洋", record: "最靠近赤道（0.7°N）", pressure: 1006, wind: 65 },
  { id: "gonu-2007", sid: "2007151N14072", name: "古努", en: "GONU", year: 2007, kind: "氣旋",
    basin: "北印度洋", record: "阿拉伯海有紀錄以來最強", pressure: 920, wind: 145 },
  { id: "kyarr-2019", sid: "2019296N15066", name: "基亞爾", en: "KYARR", year: 2019, kind: "氣旋",
    basin: "北印度洋", record: "阿拉伯海再現三分鐘風速 130 節", pressure: 922, wind: 135 },
  // ── 西南印度洋 ──────────────────────────────────────────────
  { id: "hyacinthe-1980", sid: "1980015S18060", name: "亞森特", en: "HYACINTHE", year: 1980, kind: "氣旋",
    basin: "西南印度洋", record: "總降雨量最大（6,083 公釐）", pressure: 978, wind: 70 },
  { id: "gafilo-2004", sid: "2004061S12072", name: "加菲洛", en: "GAFILO", year: 2004, kind: "氣旋",
    basin: "西南印度洋", record: "西南印度洋氣壓最低", pressure: 895, wind: 140 },
  { id: "fantala-2016", sid: "2016102S12074", name: "凡塔拉", en: "FANTALA", year: 2016, kind: "氣旋",
    basin: "西南印度洋", record: "西南印度洋風速最高", pressure: 910, wind: 155 },
  // ── 澳洲近海與南太平洋 ──────────────────────────────────────
  { id: "mahina-1899", sid: "1899063S12145", name: "馬希納", en: "MAHINA", year: 1899, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "風暴潮最高（13 公尺）", pressure: 914, wind: null },
  { id: "olivia-1996", sid: "1996095S09133", name: "奧里維亞", en: "OLIVIA", year: 1996, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "陣風最強（每秒 113.2 公尺）", pressure: 925, wind: 125 },
  { id: "freddy-2023", sid: "2023036S12117", name: "弗雷迪", en: "FREDDY", year: 2023, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "持續時間最長（36 天）", pressure: 927, wind: 140 },
  { id: "monica-2006", sid: "2006106S10153", name: "莫妮卡", en: "MONICA", year: 2006, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "南半球登陸時風速最高", pressure: 916, wind: 155 },
  { id: "zoe-2002", sid: "2002358S08185", name: "佐伊", en: "ZOE", year: 2002, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "南半球風速最高（並列）", pressure: 890, wind: 155 },
  { id: "winston-2016", sid: "2016041S14170", name: "溫斯頓", en: "WINSTON", year: 2016, kind: "氣旋",
    basin: "澳洲近海與南太平洋", record: "南半球氣壓最低", pressure: 884, wind: 155 },
  // ── 南大西洋 ────────────────────────────────────────────────
  { id: "catarina-2004", sid: "2004086S29318", name: "卡塔琳娜", en: "CATARINA", year: 2004, kind: "氣旋",
    basin: "南大西洋", record: "南大西洋首個增強到颶風強度", pressure: 972, wind: 85 },
];

/** 欄位索引。⚠️ IBTrACS 的 CSV 有 174 欄且**不使用引號**（實測），所以 split(",") 是安全的。 */
const COL = { sid: 0, season: 1, basin: 3, name: 5, time: 6, nature: 7, lat: 8, lon: 9, wmoWind: 10, wmoPres: 11, trackType: 13, usaWind: 23, usaPres: 24 };

/**
 * ⚠️ **一定要先 `trim()`。** IBTrACS 的缺值不是空字串，是**空白填滿的欄位**
 * （`, ,` 或 `,   ,`），而 `Number("  ")` 在 JavaScript 是 **0，不是 NaN**。
 * 少了這一步，狄普的「中心氣壓最低」會變成 0 hPa、波拉的風速會變成 0 節，
 * 而且完全不報錯——地圖上只會看到色階全部落在最淺那一階。實測踩過。
 */
const num = (v) => {
  const t = (v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
};

/** 正規化到 [-180, 180]。IBTrACS 對跨換日線的氣旋會寫出 >180 的連續經度，見檔頭。 */
const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * 把一條路徑切成不跨越 ±180 的幾段，並在換日線上補端點。
 *
 * 比照 registry/generators.ts 的同名函式（洋流用的那支）。不共用是因為那支是
 * 瀏覽器端的 TypeScript，這裡是建置期的 .mjs——本站沒有兩邊都吃得到的模組層。
 */
export function splitAntimeridian(points) {
  const segments = [];
  let current = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];
    const delta = next.lng - prev.lng;
    if (Math.abs(delta) > 180) {
      // 往東走就從 +180 出去、-180 進來，往西相反
      const edge = delta < 0 ? 180 : -180;
      // 以「不繞遠路」的那一側的經度差內插緯度
      const span = delta - Math.sign(delta) * 360;
      const t = (edge - prev.lng) / span;
      const lat = prev.lat + (next.lat - prev.lat) * t;
      current.push({ ...prev, lng: edge, lat });
      segments.push(current);
      current = [{ ...next, lng: -edge, lat }];
    }
    current.push(next);
  }
  segments.push(current);
  return segments.filter((s) => s.length > 1);
}

/** 球面距離（公里）。用來交叉檢查「行進距離最遠」那一筆。 */
function haversineKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 逐塊解碼、逐行過濾那份 331 MB 的 CSV。
 *
 * ⚠️ **不要改成 `await res.text()`**，見檔頭。也不要用 `res.body.getReader()` 手動
 * 迴圈——undici 的 body 本來就是 async iterable，`for await` 讀起來短得多。
 */
async function streamRows(fetchWithRetry, wanted, onRow) {
  const res = await fetchWithRetry(TRACK_URL);
  const decoder = new TextDecoder();
  let buffer = "";
  let lineNo = 0;
  let bytes = 0;
  let lastReport = 0;

  const handle = (line) => {
    lineNo++;
    // 第 1 行是欄名、第 2 行是單位
    if (lineNo <= 2 || line === "") return;
    // 先比對前 13 個字元（SID 是定長），比 split 整整 174 欄便宜得多
    const sid = line.slice(0, 13);
    if (!wanted.has(sid)) return;
    onRow(sid, line.split(","));
  };

  for await (const chunk of res.body) {
    bytes += chunk.length;
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      handle(buffer.slice(0, nl).replace(/\r$/, ""));
      buffer = buffer.slice(nl + 1);
    }
    if (bytes - lastReport > 50 * 1024 * 1024) {
      lastReport = bytes;
      process.stdout.write(`${Math.round(bytes / 1024 / 1024)}MB…`);
    }
  }
  buffer += decoder.decode();
  for (const line of buffer.split("\n")) handle(line.replace(/\r$/, ""));
}

/**
 * ⚠️ module-level 快取：`world-cyclones` 與 `world-cyclone-centers` 兩個 dataset
 * 共用同一次 331 MB 的下載（比照 lib/typhoons.mjs 與 lib/mountains.mjs）。
 * 一個 process 裡連跑兩個 `--only` 是沒有的事，但 `npm run build:geodata --force`
 * 會依序跑完整個 SOURCES，那時就差在有沒有重抓一次。
 */
let cached = null;

export async function fetchCyclones(fetchWithRetry) {
  if (cached) return { cyclones: cached, warnings: [] };

  const bySid = new Map(CYCLONES.map((c) => [c.sid, c]));
  const rows = new Map(CYCLONES.map((c) => [c.sid, []]));

  await streamRows(fetchWithRetry, new Set(bySid.keys()), (sid, cells) => {
    // 只要主路徑。`spur` 是上游把兩個機構認定成不同氣旋時分岔出來的副本，
    // 收進來會讓路徑在同一段上分叉。
    if (cells[COL.trackType] !== "main") return;
    const lat = num(cells[COL.lat]);
    const lon = num(cells[COL.lon]);
    if (lat === null || lon === null) return;
    rows.get(sid).push({
      time: cells[COL.time],
      lat,
      /** 正規化後的經度（畫圖用） */
      lng: wrapLng(lon),
      /** 上游的連續經度（跨換日線時會 >180）。只用來印 bbox 交叉檢查，見下 */
      rawLng: lon,
      wind: num(cells[COL.usaWind]),
      /**
       * ⚠️ 氣壓可以退回 `WMO_PRES`，風速不行。氣壓沒有「平均時距」的問題——
       * 一個氣壓值就是一個氣壓值，各機構的重新分析頂多差幾百帕；而 `USA_PRES`
       * 對 1990 年代以前的氣旋幾乎整欄是空的（狄普那個 870 hPa 的世界紀錄
       * **只存在於 `WMO_PRES`**，全部退回 null 的話這一層最重要的一個數字就沒了）。
       */
      pressure: num(cells[COL.usaPres]) ?? num(cells[COL.wmoPres]),
      nature: (cells[COL.nature] ?? "").trim(),
      upstreamName: (cells[COL.name] ?? "").trim(),
    });
  });

  const warnings = [];
  const cyclones = CYCLONES.map((meta) => {
    const all = rows.get(meta.sid);
    if (all.length === 0) {
      throw new Error(`${meta.name}（${meta.sid}）在 IBTrACS 裡一筆定位點都沒有——序號可能改了`);
    }

    /**
     * ⚠️ IBTrACS v04 把每一筆之間內插成 3 小時一格，只有整 6 小時那些才是機構
     * 真正發布的定位。全收會讓定位點多一倍、而且「一顆點＝一次官方定位」這句話
     * 就不成立了。收不滿 4 筆的（1899 年那種每天只定位一兩次的）退回全收，
     * 否則整條路徑會只剩兩三個點。
     */
    const synoptic = all.filter((p) => /\s(00|06|12|18):00:00$/.test(p.time));
    const track = synoptic.length >= 4 ? synoptic : all;

    const winds = track.map((p) => p.wind).filter((w) => w !== null);
    const pressures = track.map((p) => p.pressure).filter((p) => p !== null);
    const peakWind = winds.length ? Math.max(...winds) : null;
    const minPressure = pressures.length ? Math.min(...pressures) : null;

    let lengthKm = 0;
    for (let i = 1; i < track.length; i++) lengthKm += haversineKm(track[i - 1], track[i]);
    const start = new Date(`${all[0].time.replace(" ", "T")}Z`);
    const end = new Date(`${all.at(-1).time.replace(" ", "T")}Z`);
    const days = (end - start) / 86400000;

    const lats = track.map((p) => p.lat);
    /** ⚠️ bbox 用**未正規化**的經度：跨換日線的氣旋用 wrap 過的值算 min/max
     *  會得到 `-179.6–179.8E` 這種橫跨全球、看不出對錯的範圍。 */
    const lngs = track.map((p) => p.rawLng);
    warnings.push(
      `${meta.name}（${meta.en} ${meta.year}）：${track.length} 點／` +
        `${lengthKm.toFixed(0)} km／${days.toFixed(1)} 天／` +
        `最低氣壓 ${minPressure ?? "—"} hPa／最大一分鐘風速 ${peakWind ?? "—"} 節／` +
        `bbox ${Math.min(...lngs).toFixed(1)}–${Math.max(...lngs).toFixed(1)}E ` +
        `${Math.min(...lats).toFixed(1)}–${Math.max(...lats).toFixed(1)}N`,
    );

    /**
     * ⚠️ 交叉檢查：**對錯序號是這一層唯一會靜默出錯的地方**（五筆上游沒有名字的
     * 尤其危險——波拉、奧里薩、阿耆尼、馬希納、卡塔琳娜是靠生成時間與位置對出來的）。
     *
     * 門檻放到 40 hPa 與 30 節，因為維基百科那張表引的是**各洋盆負責機構**的值，
     * 而這裡算的是 IBTrACS 裡美系機構（JTWC／NHC）的重新分析，兩者本來就不同。
     * 實測 33 筆裡最大的落差是莫妮卡 **37 hPa**（JTWC 879 vs 澳洲氣象局 916），
     * 其次是法尼 32（JTWC 900 vs 印度氣象局 932）、阿耆尼 30、溫斯頓 23、
     * 古努 22、天鵝 21 hPa。⚠️ **這些不是錯，是同一個氣旋的兩個官方答案**
     * ——說明卡上引用的數字一律以紀錄表（也就是該洋盆負責機構）為準，
     * 產物裡則寫 IBTrACS 自己的極值，兩邊各自標清楚出處。
     *
     * 對錯氣旋的話落差是三位數（把缺值當 0 那次是 870–998 hPa），這個門檻擋得住。
     */
    if (minPressure !== null && Math.abs(minPressure - meta.pressure) > 40) {
      warnings.push(
        `  ⚠ ${meta.name} 的最低氣壓 ${minPressure} hPa 與紀錄表的 ${meta.pressure} hPa 差 ` +
          `${Math.abs(minPressure - meta.pressure)} hPa，請確認序號沒有對錯`,
      );
    }
    if (meta.wind !== null && peakWind !== null && Math.abs(peakWind - meta.wind) > 30) {
      warnings.push(
        `  ⚠ ${meta.name} 的最大風速 ${peakWind} 節與紀錄表的 ${meta.wind} 節差 ` +
          `${Math.abs(peakWind - meta.wind)} 節，請確認序號沒有對錯`,
      );
    }

    return { ...meta, track, peakWind, minPressure, lengthKm, days };
  });

  cached = cyclones;
  return { cyclones, warnings };
}
