#!/usr/bin/env node
/**
 * 由公開資料集產生主題圖層用的 GeoJSON。
 *
 * 為什麼在建置階段做：比照 build-climate.mjs / build-species.mjs 的既有作法。
 * 上游檔案動輒數十 MB，執行期不可能讓學生的瀏覽器去抓；本腳本只在開發機上跑，
 * 產物 commit 進 repo，**CI 永遠不會執行它**。
 *
 * 產出：public/data/geo/<id>.geojson（由本腳本管理，請勿手動編輯）
 *       手繪的教學示意幾何放 public/data/geo-manual/，本腳本永遠不碰那個目錄。
 *
 * 用法：
 *   npm run build:geodata                  # 已存在的跳過
 *   npm run build:geodata -- --force       # 全部重抓
 *   npm run build:geodata -- --only=quakes # 只處理一個資料集
 */
import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simplifyGeometry, slugify } from "./lib/simplify.mjs";
import { parseNlscGml, ringArea } from "./lib/gml.mjs";
import { readZipText } from "./lib/unzip.mjs";

const exists = (p) => access(p).then(() => true).catch(() => false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public/data/geo");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

/**
 * 大小預算。
 *
 * 真正的限制不是 GitHub Pages（1 GB 站台／單檔 100 MB），而是**一個班 30 個學生
 * 同時用學校 wifi 開站**。超過硬上限就讓腳本失敗而不是只印警告——上游資料集
 * 變動時，payload 不能悄悄地膨脹。
 */
const SOFT_LIMIT = 500 * 1024;
const HARD_LIMIT = 1024 * 1024;

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/**
 * 政府資料開放平臺的資料集 metadata API（免金鑰、回 JSON）。
 * 7442 =「直轄市、縣市界線(TWD97經緯度)」，發布機關是內政部國土測繪中心——
 * 跟本站底圖用的 NLSC WMTS 同一個來源。
 */
const DATA_GOV_TW_DATASET = (id) => `https://data.gov.tw/api/v2/rest/dataset/${id}`;

/**
 * 縣市中文名 → ISO 3166-2:TW 代碼的 id。
 *
 * 為什麼是寫死的對照表而不是 slugify：NLSC 的 GML **只有「名稱」一個屬性**，沒有
 * COUNTYCODE（那在 SHP 版才有）。而這些 id 是內容檔的檔名（src/content/geo/
 * tw-counties/<id>.json）與圖徵強調用的 key，必須跨資料源改版保持穩定——原本從
 * Natural Earth 的 iso_3166_2 產生的就是這一組，換資料源不能讓它們全部變號。
 *
 * 對不到就讓建置失敗（見 transform）：縣市改名／新增是重大行政變更，應該由人來
 * 決定新 id，而不是靜默地生出一個沒有內容檔對應的新代碼。
 */
const COUNTY_IDS = {
  臺北市: "tw-tpe",
  新北市: "tw-tpq",
  桃園市: "tw-tao",
  臺中市: "tw-txg",
  臺南市: "tw-tnn",
  高雄市: "tw-khh",
  基隆市: "tw-kee",
  新竹市: "tw-hsz",
  嘉義市: "tw-cyi",
  新竹縣: "tw-hsq",
  苗栗縣: "tw-mia",
  彰化縣: "tw-cha",
  南投縣: "tw-nan",
  雲林縣: "tw-yun",
  嘉義縣: "tw-cyq",
  屏東縣: "tw-pif",
  宜蘭縣: "tw-ila",
  花蓮縣: "tw-hua",
  臺東縣: "tw-ttt",
  澎湖縣: "tw-pen",
  金門縣: "tw-kin",
  連江縣: "tw-lie",
};

/**
 * 離島的面積下限（度²）。
 *
 * NLSC 是實測界線，把每一塊礁岩都收了進來——澎湖 296 個、連江 183 個、金門 43 個
 * polygon，光是這些就佔掉檔案的六成，而它們在這個圖層可見的縮放範圍（maxzoom 11）
 * 全都小於一個像素。1e-5 度² ≈ 0.11 km²，實測留下澎湖 21、連江 11、金門 7 個島，
 * 課本會提到的東引（4.4 km²）、七美（7.4 km²）、小琉球（6.9 km²）都在門檻之上。
 *
 * ⚠️ Douglas–Peucker 不會刪掉整個環（環少於 4 點就還原成原始環），所以這個過濾
 * **必須在簡化之前**做，不能指望容差幫忙。
 */
const MIN_ISLAND_AREA = 1e-5;

/**
 * 世界主要河流的中文名對照。
 *
 * Natural Earth 的 50m 河流資料**完全沒有中文名欄位**（只有 name / name_en /
 * name_alt），所以中文名只能自己對照。這裡只收課綱會提到的大河；對不到的
 * 就沿用原名，不會壞掉。
 *
 * 同一條河在 NE 裡常被切成多段、各段用當地語言命名（長江上游叫 Jinsha／
 * Tongtian／Tuotuo，尼羅河分成 Victoria Nile／Albert Nile／El Bahr el Abyad），
 * 所以這裡把各段都指到學生認得的那個名字。
 */
const RIVER_NAMES_ZH = {
  Amazonas: "亞馬遜河",
  Ucayali: "亞馬遜河（烏卡亞利段）",
  Nile: "尼羅河",
  "Victoria Nile": "尼羅河（維多利亞段）",
  "Albert Nile": "尼羅河（艾伯特段）",
  "El Bahr el Abyad": "白尼羅河",
  "Bahr el Jebel": "尼羅河（傑貝勒段）",
  Kagera: "卡蓋拉河",
  "Damietta Branch": "尼羅河三角洲（杜姆亞特分流）",
  "Rosetta Branch": "尼羅河三角洲（羅塞塔分流）",
  Yangtze: "長江",
  "Chang Jiang": "長江",
  Jinsha: "金沙江",
  Tongtian: "通天河",
  Tuotuo: "沱沱河",
  // ⚠️ NE 把黃河的 name 寫成 "Huang"（不是 "Huang He"），漏掉這個 key
  // 就會讓課本上最常提到的大河之一顯示成英文
  Huang: "黃河",
  "Huang He": "黃河",
  "Heilong Jiang": "黑龍江",
  Abay: "青尼羅河",
  "El Bahr el Azraq": "青尼羅河",
  Yukon: "育空河",
  Orinoco: "奧里諾科河",
  Columbia: "哥倫比亞河",
  Ohio: "俄亥俄河",
  Madeira: "馬德拉河",
  Kasai: "開賽河",
  Ubangi: "烏班吉河",
  "Shatt al Arab": "阿拉伯河",
  "Al Furat": "幼發拉底河",
  Firat: "幼發拉底河",
  Congo: "剛果河",
  Lualaba: "剛果河（盧阿拉巴段）",
  Mississippi: "密西西比河",
  Missouri: "密蘇里河",
  Ganges: "恆河",
  Brahmaputra: "布拉馬普特拉河",
  Yarlung: "雅魯藏布江",
  Indus: "印度河",
  Mekong: "湄公河",
  Lancang: "瀾滄江",
  Danube: "多瑙河",
  Donau: "多瑙河",
  Volga: "伏爾加河",
  Niger: "尼日河",
  Zambezi: "尚比西河",
  Amur: "黑龍江（阿穆爾河）",
  Lena: "勒拿河",
  Ob: "鄂畢河",
  Irtysh: "額爾濟斯河",
  Yenisey: "葉尼塞河",
  Angara: "安加拉河",
  Mackenzie: "馬更些河",
  "St. Lawrence": "聖羅倫斯河",
  Paraná: "巴拉那河",
  Murray: "墨累河",
  Darling: "達令河",
  Euphrates: "幼發拉底河",
  Tigris: "底格里斯河",
  Rhine: "萊茵河",
  Rhein: "萊茵河",
  Seine: "塞納河",
  Ayeyarwady: "伊洛瓦底江",
  Irrawaddy: "伊洛瓦底江",
};

const SOURCES = [
  {
    id: "tw-counties",
    label: "臺灣縣市界",
    /**
     * 資料源是內政部國土測繪中心，不是 Natural Earth。
     *
     * ⚠️ **不要改回 Natural Earth**：NE 10m 的 TWN 只有 **21** 個一級行政區，
     * 整份資料集裡都沒有連江縣（馬祖），而馬祖正是課本講「臺灣的離島」時一定會
     * 點名的地方。NLSC 這份是實測界線、22 個縣市齊全、中文名原生就是課綱用的
     * 「臺」字寫法，而且每半年更新。
     *
     * 代價是格式：政府資料開放平臺只提供 SHP 與 GML，沒有 GeoJSON。SHP 要 ogr2ogr
     * （得先裝 GDAL），所以走 GML——它是純文字 XML，用 lib/unzip.mjs + lib/gml.mjs
     * 兩個免依賴的小模組就能處理完。
     */
    resolveUrl: () => resolveDataGovTwUrl(7442, /GML/),
    license: "政府資料開放授權條款第 1 版",
    sourceLabel: "內政部國土測繪中心",
    // 下載回來的是 zip 包一個 12 MB 的 GML，不是 JSON
    parse: async (res) => {
      const buf = Buffer.from(await res.arrayBuffer());
      return parseNlscGml(readZipText(buf, (name) => name.toLowerCase().endsWith(".gml")));
    },
    // 相鄰面各自簡化會在共用邊界開出次像素縫隙（見 lib/simplify.mjs），
    // 所以這個圖層在註冊表裡設了 maxzoom，讓它在縫隙可解析之前就停止繪製。
    //
    // 0.0008° ≈ 89 公尺，在圖層的 maxzoom 11 約 1.3 px、在實際教學會用的 zoom 7–10
    // 都是次像素。NLSC 原始資料有 33 萬個點，不簡化是 570 KB；這個容差落在 192 KB。
    tolerance: 0.0008,
    digits: 4,
    transform: (features) =>
      features.map((f) => {
        const name = f.properties.名稱;
        const id = COUNTY_IDS[name];
        if (!id) {
          throw new Error(`縣市「${name}」不在 COUNTY_IDS 對照表裡，請先決定它的 id`);
        }
        return {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            // 次像素的礁岩在簡化階段刪不掉，只能在這裡先濾（見 MIN_ISLAND_AREA）
            coordinates: f.geometry.coordinates.filter(
              (polygon) => ringArea(polygon[0]) >= MIN_ISLAND_AREA,
            ),
          },
          properties: { id, name },
        };
      }),
  },
  {
    id: "world-rivers",
    label: "世界主要河流",
    // 50m 是世界尺度主題的正確比例尺；10m 的臺灣河川覆蓋太薄，
    // 所以「臺灣主要河川」在註冊表裡維持 planned，不能拿這份資料充數。
    url: `${NE}/ne_50m_rivers_lake_centerlines.geojson`,
    license: "Natural Earth（public domain）",
    sourceLabel: "Natural Earth",
    tolerance: 0.01,
    digits: 3,
    // scalerank <= 3（116 條）而不是 <= 2（62 條）：實測 <= 2 會漏掉黃河、恆河、
    // 伏爾加河、尼日河、印度河——全都是課綱會點名的大河，漏掉就不能叫「世界主要河流」。
    transform: (raw) =>
      raw.features
        .filter((f) => f.properties.scalerank <= 3 && f.properties.name)
        .map((f, i) => ({
          type: "Feature",
          geometry: f.geometry,
          properties: {
            id: `${slugify(f.properties.name)}-${i}`,
            // NE 沒有中文名欄位，對不到就沿用原名
            name: RIVER_NAMES_ZH[f.properties.name] ?? f.properties.name,
          },
        })),
  },
  {
    id: "quakes",
    label: "全球地震帶",
    // 免金鑰、ACAO: *。單次上限 20000 筆；抓之前先打 /count 確認沒超過。
    //
    // 門檻選 M≥6.5、自 1960 年起（約 2800 筆／390 KB）是量出來的，不是隨手訂的：
    // M≥6.0 自 1975 年起是 7284 筆、1030 KB，直接撞上大小預算的硬上限。而且
    // 7000 個重疊的點在教室投影機上就是一坨糊的，較高的門檻配上較長的時間窗
    // （65 年，涵蓋 1960 智利、1964 阿拉斯加這類大事件）反而把板塊邊緣描得更清楚。
    url:
      "https://earthquake.usgs.gov/fdsnws/event/1/query" +
      "?format=geojson&minmagnitude=6.5&starttime=1960-01-01&orderby=time",
    countUrl:
      "https://earthquake.usgs.gov/fdsnws/event/1/count" +
      "?format=geojson&minmagnitude=6.5&starttime=1960-01-01",
    license: "USGS（public domain）",
    sourceLabel: "USGS",
    // 點位不需要簡化，只取位：2 位小數 ≈ 1.1 公里，在這個圖層可見的每個 zoom
    // 都是次像素，光取位就能把檔案砍掉一半。
    tolerance: 0,
    digits: 2,
    transform: (raw) =>
      raw.features
        .filter((f) => f.geometry?.type === "Point" && f.properties.mag != null)
        .map((f) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: f.geometry.coordinates.slice(0, 2) },
          properties: {
            id: slugify(f.id),
            mag: Math.round(f.properties.mag * 10) / 10,
            depth_km: Math.round(f.geometry.coordinates[2] ?? 0),
            year: new Date(f.properties.time).getUTCFullYear(),
          },
        })),
  },
];

/** 比照 build-species.mjs 的指數退避。上游是 CDN／公家服務，偶爾會 429 或 5xx。 */
async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || i === attempts - 1) throw new Error(`${url} → HTTP ${res.status}`);
    const waitMs = 5000 * 2 ** i;
    process.stdout.write(`（${res.status}，${waitMs / 1000}s 後重試）`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("unreachable");
}

/**
 * 從政府資料開放平臺查出某個資料集當下的下載網址。
 *
 * 為什麼不寫死網址：TGOS 的檔名帶著發布日期（`COUNTY_MOI_1140318_.zip`），每次改版
 * 都是一個新網址、舊的會消失。寫死等於把腳本綁在某一版資料上，半年後 `--force`
 * 重跑就 404。查 API 只多一次請求，換來的是「重跑就會拿到最新的界線」。
 */
async function resolveDataGovTwUrl(datasetId, descriptionPattern) {
  const meta = await (await fetchWithRetry(DATA_GOV_TW_DATASET(datasetId))).json();
  const distributions = meta?.result?.distribution ?? [];
  const match = distributions.filter((d) => descriptionPattern.test(d.resourceDescription ?? ""));
  if (match.length !== 1) {
    const listed = distributions.map((d) => d.resourceDescription).join("、") || "（空）";
    throw new Error(
      `資料集 ${datasetId} 符合 ${descriptionPattern} 的資源有 ${match.length} 個（現有：${listed}）`,
    );
  }
  return match[0].resourceDownloadUrl;
}

async function build(source) {
  const outPath = join(OUT_DIR, `${source.id}.geojson`);
  if (!FORCE && (await exists(outPath))) {
    console.log(`- ${source.id}：已存在，跳過（--force 可重抓）`);
    return true;
  }

  if (source.countUrl) {
    const count = await (await fetchWithRetry(source.countUrl)).json();
    console.log(`  ${source.id}：上游 ${count.count} 筆（單次上限 ${count.maxAllowed}）`);
    if (count.count > count.maxAllowed) {
      console.error(`✗ ${source.id}：超過單次上限，需要改成按時間分段抓取`);
      return false;
    }
  }

  process.stdout.write(`- ${source.id}：`);
  const url = source.resolveUrl ? await source.resolveUrl() : source.url;
  process.stdout.write("下載中…");
  const res = await fetchWithRetry(url);
  // 預設是 GeoJSON；需要先解壓／換格式的資料源自己提供 parse（見 tw-counties）
  const raw = source.parse ? await source.parse(res) : await res.json();
  process.stdout.write("轉換中…");

  const features = source
    .transform(raw)
    .map((f) => ({
      ...f,
      geometry: source.tolerance
        ? simplifyGeometry(f.geometry, source.tolerance, source.digits)
        : simplifyGeometry(f.geometry, 0, source.digits),
    }));

  if (features.length === 0) {
    console.error(`\n✗ ${source.id}：轉換後 0 筆，上游欄位可能變了`);
    return false;
  }

  const ids = features.map((f) => f.properties.id);
  if (new Set(ids).size !== ids.length) {
    console.error(`\n✗ ${source.id}：properties.id 有重複`);
    return false;
  }

  const out = {
    type: "FeatureCollection",
    // 出處與授權要能追溯（CLAUDE.md：每筆資料都要標來源），
    // 也讓 commit 進 repo 的 diff 自我解釋。
    metadata: {
      collection: source.id,
      source: url,
      license: source.license,
      generatedAt: new Date().toISOString(),
      ...(source.tolerance ? { simplifyTolerance: source.tolerance } : {}),
      featureCount: features.length,
    },
    features,
  };

  const json = JSON.stringify(out);
  const bytes = Buffer.byteLength(json);
  const kb = (bytes / 1024).toFixed(0);

  if (bytes > HARD_LIMIT) {
    console.error(
      `\n✗ ${source.id}：${kb} KB 超過硬上限 ${HARD_LIMIT / 1024} KB，請調高 tolerance 或縮小篩選範圍`,
    );
    return false;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(outPath, json);
  const warn = bytes > SOFT_LIMIT ? `（⚠ 超過建議值 ${SOFT_LIMIT / 1024} KB）` : "";
  console.log(`完成：${features.length} 筆／${kb} KB${warn}`);
  return true;
}

const targets = ONLY ? SOURCES.filter((s) => s.id === ONLY) : SOURCES;
if (targets.length === 0) {
  console.error(`找不到資料集「${ONLY}」。可用：${SOURCES.map((s) => s.id).join("、")}`);
  process.exit(1);
}

let ok = true;
for (const source of targets) {
  try {
    if (!(await build(source))) ok = false;
  } catch (err) {
    console.error(`\n✗ ${source.id}：${err.message}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("地理資料產生完成 ✓");
