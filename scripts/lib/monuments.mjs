/**
 * 文化部文化資產局「文資局古蹟」開放資料的存取層。
 *
 * 一份上游 JSON（8.1 MB、1,064 筆）產出**四種**東西，所以取得邏輯集中在這裡：
 *   - 三個 geojson（依指定級別分檔）→ public/data/geo/tw-monuments-<slug>.geojson
 *   - 每個縣市一份歷史沿革分片      → public/data/monuments/<county-id>.json
 *
 * 為什麼分成三個 geojson 而不是一個：級別是三個各自可勾選的子圖層，而**只勾
 * 「國定古蹟」就只該付 45 KB**，不是整包 429 KB。一個班 30 個學生同時開站時，
 * 這個差別就是這一層能不能開的差別。
 *
 * 為什麼歷史沿革不進 geojson：`pastHistory` 中位數 409 字，1,064 筆全帶進去是
 * **1.9 MB**，直接爆掉 build-geodata.mjs 的 1 MB 硬上限（實測）。改成按縣市分片、
 * 點開卡片才抓，最大的臺北市也只有 290 KB，而且只有真的點到才付。
 *
 * ⚠️ 上游沒有 CORS 標頭，瀏覽器一定抓不到——這一份只能在建置期用（比照水利署）。
 */

/** 政府資料開放平臺資料集 6246「文資局古蹟」。 */
export const DATASET_ID = 6246;

/** 資料集裡只有一個 JSON 資源，用它的說明比對（比照 tw-counties 的 /GML/）。 */
export const RESOURCE_PATTERN = /古蹟資訊/;

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "文化部文化資產局";

/**
 * 指定級別 → 本站的子圖層 slug 與序位。
 *
 * `rank` 由**低到高**（縣市定 1 → 國定 3），這個方向是刻意的：色階必須由淺到深
 * 遞增才過得了色票驗證器的「steps read light→dark」，而語意上也該是「級別越高、
 * 顏色越深」。反過來排會同時弄壞驗證與語意。
 *
 * 對不到就讓建置失敗——上游新增一個級別是法規層級的變動，該由人決定怎麼呈現。
 */
export const LEVELS = {
  "國定古蹟": { slug: "national", rank: 3 },
  "直轄市定古蹟": { slug: "municipal", rank: 2 },
  "縣(市)定古蹟": { slug: "county", rank: 1 },
};

/** 臺灣（含離島）的合理座標範圍，用來偵測經緯度顛倒。 */
const LAT_RANGE = [21.5, 26.5];
const LNG_RANGE = [118.0, 122.2];
const inRange = (v, [lo, hi]) => v >= lo && v <= hi;

/**
 * 剝掉名稱裡的級別前綴。
 *
 * ⚠️ 實測有 5 筆把級別寫進了個案名稱（`國定古蹟麥寮拱範宮`、`國定古蹟-北港朝天宮`、
 * `縣定古蹟永濟義渡碑(名間鄉)`…）。不剝掉的話，清單與卡片上會出現
 * 「國定古蹟・國定古蹟麥寮拱範宮」這種把級別講兩次的標題。
 */
function stripLevelPrefix(name) {
  return name.replace(/^(國定古蹟|直轄市定古蹟|縣\(市\)定古蹟|縣定古蹟|市定古蹟)[-－\s]*/, "").trim();
}

/** 種類。A99「其他設施」會另外帶一個 `other` 寫實際類別，有就用它。 */
function kindOf(assetsTypes) {
  const names = (assetsTypes ?? []).map((t) => (t.other || t.name || "").trim()).filter(Boolean);
  return [...new Set(names)].join("、") || "其他";
}

/** 公告指定的年份。`announcementList` 可能有多筆（後續變更），取最早那筆＝指定年。 */
function designatedYear(announcementList) {
  const dates = (announcementList ?? [])
    .map((a) => (a.registerDate || "").slice(0, 4))
    .filter((y) => /^\d{4}$/.test(y))
    .sort();
  return dates[0] ? Number(dates[0]) : null;
}

/**
 * 抓取並正規化整份古蹟資料。
 *
 * **module-level 快取**：三個 geojson 各是 build-geodata.mjs 的一筆 SOURCES，
 * 但上游那 8.1 MB 只該下載一次。同一個 process 內重複呼叫共用同一個 Promise。
 */
let cached = null;

export function fetchMonuments(fetchWithRetry, resolveUrl, countyIds) {
  cached ??= load(fetchWithRetry, resolveUrl, countyIds);
  return cached;
}

async function load(fetchWithRetry, resolveUrl, countyIds) {
  const url = await resolveUrl(DATASET_ID, RESOURCE_PATTERN);
  const raw = await (await fetchWithRetry(url)).json();
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`古蹟資料剖析後 0 筆，上游格式可能變了（${url}）`);
  }

  const records = [];
  const warnings = [];
  /** 經緯度顛倒的個案。靜默修正會讓上游哪天修好了也沒有人知道，所以要列名。 */
  const swapped = [];
  /** 沒有座標的個案。靜默跳過的話「少了一處」永遠不會有人發現（比照水庫的 skipped）。 */
  const missing = [];

  for (const r of raw) {
    const levelName = r.assetsClassifyName;
    const level = LEVELS[levelName];
    if (!level) {
      throw new Error(`古蹟級別「${levelName}」不在 LEVELS 對照表裡，請先決定它的呈現方式`);
    }

    const name = stripLevelPrefix(String(r.caseName ?? "").trim());
    if (!r.caseId) throw new Error(`古蹟「${name}」沒有 caseId，無法產生穩定的 id`);

    let lat = Number(r.latitude);
    let lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      missing.push(name);
      continue;
    }
    // ⚠️ 實測 5 筆的經緯度是相反的（國父紀念館、赤崁樓旁的打狗英國領事館…）。
    // 判準是「緯度欄落在經度範圍、經度欄落在緯度範圍」，對調後全部落回正確縣市。
    if (!inRange(lat, LAT_RANGE) && inRange(lat, LNG_RANGE) && inRange(lng, LAT_RANGE)) {
      [lat, lng] = [lng, lat];
      swapped.push(name);
    }
    if (!inRange(lat, LAT_RANGE) || !inRange(lng, LNG_RANGE)) {
      throw new Error(`古蹟「${name}」的座標 (${lat}, ${lng}) 不在臺灣範圍內，請先確認上游資料`);
    }

    const addr = (r.addresses ?? [])[0] ?? {};
    const county = (addr.cityName ?? "").trim();
    const countyId = countyIds[county];
    if (!countyId) {
      throw new Error(`古蹟「${name}」的縣市「${county}」不在 COUNTY_IDS 對照表裡`);
    }
    records.push({
      id: `monument-${r.caseId}`,
      name,
      levelName,
      levelSlug: level.slug,
      levelRank: level.rank,
      county,
      /** 歷史沿革分片的檔名（見 historyShards）。MonumentCard 靠它算出要抓哪一份。 */
      countyId,
      district: (addr.distName ?? "").trim(),
      address: (addr.address ?? "").trim(),
      kind: kindOf(r.assetsTypes),
      year: designatedYear(r.announcementList),
      url: (r.caseUrl ?? "").trim(),
      authority: (r.govInstitutionName ?? "").trim(),
      history: (r.pastHistory ?? "").trim(),
      reason: (r.registerReason ?? "").trim(),
      lat,
      lng,
    });
  }

  if (swapped.length) {
    warnings.push(`經緯度顛倒、已對調（${swapped.length} 筆）：${swapped.join("、")}`);
  }
  if (missing.length) {
    warnings.push(`⚠ 沒有座標、已跳過（${missing.length} 筆）：${missing.join("、")}`);
  }
  return { records, warnings };
}

/**
 * 一筆記錄 → geojson Feature。
 *
 * 刻意**不放** `history`／`reason`：那兩個欄位是分片檔的內容，混進來會讓
 * geojson 從 429 KB 變成 1.9 MB（見檔頭）。
 */
export function monumentFeature(r) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id,
      name: r.name,
      level: r.levelName,
      county: r.county,
      /** MonumentCard 用它算出歷史沿革分片的網址，不必在瀏覽器再放一份縣市對照表 */
      countyId: r.countyId,
      district: r.district,
      address: r.address,
      kind: r.kind,
      ...(r.year != null && { year: r.year }),
      url: r.url,
      authority: r.authority,
      /** 搜尋索引與（未來若有的）清單次標共用 */
      meta: `${r.county}${r.district}・${r.kind}`,
    },
  };
}

/**
 * 依縣市把歷史沿革切成分片：countyId → { <古蹟 id>: { history, reason } }。
 *
 * ⚠️ **臺東縣一處古蹟都沒有**（上游只有 21 個縣市出現），所以這裡產出的分片是
 * 21 份而不是 22 份。任何「每個縣市都該有一份」的檢查都會誤判。
 */
export function historyShards(records) {
  const shards = new Map();
  for (const r of records) {
    if (!shards.has(r.countyId)) shards.set(r.countyId, {});
    shards.get(r.countyId)[r.id] = { history: r.history, reason: r.reason };
  }
  return shards;
}
