/**
 * 國家重要濕地範圍圖的存取層（內政部國家公園署）。
 *
 * 比照 lib/protected-areas.mjs：把「上游長什麼樣、哪裡會咬人」關在一個模組裡，
 * build-geodata.mjs 只看得到一個回傳 GeoJSON feature 陣列的函式。
 *
 * ## 為什麼是這一份資料
 *
 * 《濕地保育法》把濕地分成國際級／國家級／地方級三級，由內政部（國家公園署）
 * 與地方主管機關公告。**這是站上唯一一份把「湖泊、潟湖、河口、埤塘、鹽田」
 * 一起收進同一個法定分類的官方圖資**——它本身就在示範一件課本會講的事：
 * 湖泊與潟湖在生態分類上都是濕地的一種。
 *
 * ## 取得路徑：索引 CSV → TGOS 的 SHP
 *
 * data.gov.tw 資料集 25659 的唯一資源是一份**索引 CSV**（三列：範圍圖、保育
 * 利用計畫範圍圖、功能分區圖），真正的圖資在 TGOS 上。這跟國家公園那份
 * 「圖層彙整」是同一種形狀，所以走同一條路：索引網址去 data.gov.tw 查、
 * 圖資網址從索引列裡讀，兩段都不寫死。
 *
 * ⚠️ **TGOS 的網址帶未編碼的中文檔名**（`重要濕地1150109(更新龍鑾潭).zip`），
 * 要靠 `new URL()` 的序列化補上百分比編碼。自己跑 `encodeURIComponent` 會把
 * 已編碼的部分再編一次，得到一個看起來很像對的 404（保護區那一層踩過）。
 *
 * ## ⚠️ 四個實測過的坑
 *
 * 1. **`SERIAL_NUM` 不是唯一的。** 89 筆記錄只有 88 個編號：`19-15` 底下是
 *    番子田埤（葫蘆埤）的**北池與南池**兩筆。以編號分組合併成一個圖徵，公告
 *    面積取兩筆之和（12 + 33.26），名稱取兩個 `SUB_TITLE` 的共同前綴。
 *    不分組的話 `build-geodata.mjs` 的「id 有重複」檢查會直接讓建置失敗。
 * 2. **一個「濕地」可能有很多個分區。** 淡水河流域重要濕地有 11 個
 *    （關渡、挖子尾、五股…），嘉南埤圳重要濕地有 18 個（林初埤、烏樹林埤…）。
 *    所以圖徵名稱是 `SUB_TITLE || TITLE`——**關渡重要濕地必須搜得到**，
 *    而它在上游只存在於 `SUB_TITLE` 裡。
 * 3. **兩個名稱含 Big5 打不出來的字，上游用括號拆字寫。** `草(水土)重要濕地`
 *    是南投縣竹山鎮的**草坔**重要濕地、`(木宜)梧重要濕地` 是雲林縣口湖鄉的
 *    **椬梧**重要濕地（兩者都用官方計畫書與縣府文件核對過）。照抄會在畫面上
 *    印出括號，而且搜「草坔」「椬梧」搜不到。
 * 4. **`AREA` 是公告面積（公頃），可以拿來交叉比對。** 實測 88 個分區的幾何
 *    面積與它的差距中位數只有 **0.46%**，最大的一筆（永安 +4.9%）也在容差內
 *    ——這是唯一抓得到「投影或分組弄錯」的檢查（比照國家公園的 `officialHa`）。
 */
import { parseCsv } from "./csv.mjs";
import { fetchBuffer } from "./fetch-retry.mjs";
import { geodesicArea } from "./dissolve.mjs";
import { readShapefileZip, ringsToPolygons } from "./shp.mjs";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "內政部國家公園署";
export const SOURCE_PAGE = "https://data.gov.tw/dataset/25659";

/** 政府資料開放平臺「國家重要濕地」——一份指向 TGOS 圖資的索引 CSV。 */
const DATASET_ID = 25659;

/** 索引 CSV 裡要的那一列（另外兩列是保育利用計畫範圍圖與功能分區圖）。 */
const LAYER_NAME = "重要濕地範圍圖";

const HECTARE = 10000;

/**
 * 級別的顯示順序，同時是可點清單的分組順序（`browse.groupBy: "category"`
 * 依序切、不排序，所以 feature 必須讓同一級連續）。
 */
export const LEVEL_ORDER = ["國際級", "國家級", "地方級", "暫定地方級"];

/**
 * 各級別的**濕地處數**（不是分區數），用來擋上游改版。
 *
 * ⚠️ 這組數字**不是拿第一次跑出來的結果回填的**——活動斷層那次的教訓是
 * 「硬檢查會鎖住錯誤的初始值」。國際級 2 與國家級 40 跟維基百科〈臺灣濕地列表〉
 * 整理的公告名錄逐一對得上；地方級由地方主管機關公告，這份中央圖資只收了已經
 * 完成範圍圖公告的 17 處 + 2 處暫定，那是**資料範圍的缺口**，圖層 `notes` 有交代。
 */
const EXPECTED_BY_LEVEL = {
  國際級: 2,
  國家級: 40,
  地方級: 17,
  暫定地方級: 2,
};

/** 分區總數（＝ geojson 的圖徵數），同樣是硬檢查。 */
const EXPECTED_ZONES = 88;

/**
 * 上游用括號拆字寫的兩個罕用字（見檔頭第 3 點）。
 * key 是 DBF 裡的原字串，value 是官方公告的正確名稱。
 */
const NAME_FIXES = {
  "草(水土)重要濕地": "草坔重要濕地",
  "(木宜)梧重要濕地": "椬梧重要濕地",
};

/** 公告面積與幾何面積差多少要出聲／直接失敗（比照國家公園的 checkArea）。 */
const AREA_WARN = 0.1;
const AREA_FAIL = 0.5;

/** 索引 CSV 自己也是一筆開放資料，網址去 data.gov.tw 查而不是寫死。 */
async function resolveIndexUrl(fetchWithRetry) {
  const meta = await (
    await fetchWithRetry(`https://data.gov.tw/api/v2/rest/dataset/${DATASET_ID}`)
  ).json();
  const csv = (meta?.result?.distribution ?? []).filter((d) => d.resourceFormat === "CSV");
  if (csv.length !== 1) {
    throw new Error(`資料集 ${DATASET_ID} 的 CSV 資源有 ${csv.length} 個`);
  }
  return csv[0].resourceDownloadUrl;
}

/** 從索引挑出「重要濕地範圍圖」那一列的下載網址。 */
function pickLayerUrl(rows) {
  const matched = rows.filter((row) => (row.Layer_Name ?? "").trim() === LAYER_NAME);
  if (matched.length !== 1) {
    const listed = rows.map((r) => r.Layer_Name).join("、") || "（空）";
    throw new Error(`索引裡「${LAYER_NAME}」有 ${matched.length} 列（現有：${listed}）`);
  }
  const raw = (matched[0].Download_URL ?? "").trim();
  if (!raw) throw new Error(`「${LAYER_NAME}」那一列沒有 Download_URL`);
  // ⚠️ 中文檔名要靠 new URL() 補百分比編碼，不要自己跑 encodeURIComponent
  return new URL(raw).href;
}

/**
 * 同一個編號的多筆 `SUB_TITLE` 取共同前綴當名稱（見檔頭第 1 點）。
 *
 * 只有 `19-15` 一組會走到這裡（番子田埤(葫蘆埤)(北) / (南)），前綴是
 * 「番子田埤(葫蘆埤)」。前綴空掉就代表上游把兩件不相干的東西塞進同一個編號，
 * 那時寧可直接失敗，不要猜一個名字。
 */
function commonName(names, serial) {
  let prefix = names[0];
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
    prefix = prefix.slice(0, i);
  }
  prefix = prefix.replace(/[(（\s]+$/, "");
  if (!prefix) {
    throw new Error(`編號 ${serial} 的 ${names.length} 筆名稱沒有共同前綴：${names.join("、")}`);
  }
  return prefix;
}

/** 編號 → 本站 id。`暫61` 這種暫定編號改寫成 `prov-61`，避免跟 `61` 撞。 */
export function wetlandId(serial) {
  return `wetland-${serial.replace(/^暫/, "prov-")}`;
}

/** 排序鍵：先級別，再依官方編號（03 之後大致是由北到南的地理順序）。 */
function sortKey(serial) {
  const [main, sub] = serial.replace(/^暫/, "").split("-");
  return [Number(main), Number(sub ?? 0)];
}

export async function fetchWetlands(fetchWithRetry) {
  const warnings = [];
  const indexUrl = await resolveIndexUrl(fetchWithRetry);
  const rows = parseCsv(await (await fetchWithRetry(indexUrl)).text());
  if (rows.length === 0) throw new Error("重要濕地圖資索引 CSV 剖析後 0 列");

  const { features: records } = readShapefileZip(await fetchBuffer(pickLayerUrl(rows)));

  /** 依官方編號分組（一個編號＝一個濕地分區，可能有好幾筆記錄）。 */
  const zones = new Map();
  for (const record of records) {
    const p = record.properties;
    const serial = String(p.SERIAL_NUM ?? "").trim();
    const title = NAME_FIXES[String(p.TITLE ?? "").trim()] ?? String(p.TITLE ?? "").trim();
    const level = String(p.LEVEL_1 ?? "").trim();
    if (!serial || !title || !level) {
      throw new Error(`有記錄缺 SERIAL_NUM／TITLE／LEVEL_1，上游欄位可能變了：${JSON.stringify(p)}`);
    }
    if (!LEVEL_ORDER.includes(level)) {
      throw new Error(`未知的濕地級別「${level}」（${title}）`);
    }
    const zone = zones.get(serial) ?? {
      serial,
      title,
      level,
      names: [],
      cities: [],
      officialHa: 0,
      rings: [],
    };
    zone.names.push(String(p.SUB_TITLE ?? "").trim() || title);
    for (const city of [p.CITY_1, p.CITY_2]) {
      const name = String(city ?? "").trim();
      if (name && !zone.cities.includes(name)) zone.cities.push(name);
    }
    zone.officialHa += Number(p.AREA) || 0;
    zone.rings.push(...record.rings);
    zones.set(serial, zone);
  }

  if (zones.size !== EXPECTED_ZONES) {
    throw new Error(
      `重要濕地分區 ${zones.size} 個，與預期的 ${EXPECTED_ZONES} 個不符——` +
        `新增或撤銷公告要連同圖層說明一起更新`,
    );
  }

  const wetlandsByLevel = new Map();
  for (const zone of zones.values()) {
    if (!wetlandsByLevel.has(zone.level)) wetlandsByLevel.set(zone.level, new Set());
    wetlandsByLevel.get(zone.level).add(zone.title);
  }
  for (const [level, expected] of Object.entries(EXPECTED_BY_LEVEL)) {
    const actual = wetlandsByLevel.get(level)?.size ?? 0;
    if (actual !== expected) {
      throw new Error(`${level}重要濕地 ${actual} 處，與預期的 ${expected} 處不符`);
    }
  }

  const ordered = [...zones.values()].sort((a, b) => {
    const byLevel = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    if (byLevel !== 0) return byLevel;
    const [am, as] = sortKey(a.serial);
    const [bm, bs] = sortKey(b.serial);
    return am - bm || as - bs;
  });

  const features = ordered.map((zone) => {
    const coordinates = ringsToPolygons(zone.rings, zone.title);
    const areaHa = geodesicArea(coordinates) / HECTARE;
    const drift = Math.abs(areaHa - zone.officialHa) / zone.officialHa;
    if (drift > AREA_FAIL) {
      throw new Error(
        `${zone.title}：幾何面積 ${areaHa.toFixed(1)} 公頃與公告的 ${zone.officialHa} 差 ` +
          `${(drift * 100).toFixed(0)}%，可能挑錯圖層或投影`,
      );
    }
    if (drift > AREA_WARN) {
      warnings.push(
        `${zone.title}：幾何面積 ${areaHa.toFixed(1)} 公頃 vs 公告 ${zone.officialHa}` +
          `（差 ${(drift * 100).toFixed(0)}%）`,
      );
    }

    const name = zone.names.length === 1 ? zone.names[0] : commonName(zone.names, zone.serial);
    // 分區名跟濕地名不同時（關渡 vs 淡水河流域），副標要先講它屬於哪一處濕地
    const parent = name === zone.title ? null : zone.title;
    const meta = [parent, zone.cities.join("、"), `公告面積 ${formatHa(zone.officialHa)}`]
      .filter(Boolean)
      .join("・");

    return {
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates },
      properties: {
        id: wetlandId(zone.serial),
        name,
        meta,
        // 可點清單的分組（LayerBrowse.groupBy）
        category: zone.level,
        serial: zone.serial,
        ...(parent ? { wetland: parent } : {}),
        counties: zone.cities.join("、"),
        officialHa: Number(zone.officialHa.toFixed(2)),
      },
    };
  });

  const levels = LEVEL_ORDER.map((level) => `${level} ${wetlandsByLevel.get(level)?.size ?? 0}`);
  warnings.push(
    `${features.length} 個分區／${[...new Set(ordered.map((z) => z.title))].length} 處濕地（${levels.join("、")}）`,
  );

  return { features, warnings };
}

/** 公告面積的顯示字串：小的保留兩位小數，大的取整數並加千分位。 */
export function formatHa(ha) {
  if (ha < 10) return `${ha.toFixed(2)} 公頃`;
  return `${Math.round(ha).toLocaleString("en-US")} 公頃`;
}
