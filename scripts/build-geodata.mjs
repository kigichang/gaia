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
    url: `${NE}/ne_10m_admin_1_states_provinces.geojson`,
    license: "Natural Earth（public domain）",
    sourceLabel: "Natural Earth",
    // 相鄰面各自簡化會在共用邊界開出次像素縫隙（見 lib/simplify.mjs），
    // 所以這個圖層在註冊表裡設了 maxzoom，讓它在縫隙可解析之前就停止繪製。
    tolerance: 0.0005,
    digits: 4,
    // ⚠️ 已知資料限制：Natural Earth 10m 的 TWN 只有 **21** 個一級行政區，
    // **沒有連江縣（馬祖）**——已確認上游整份資料集裡都找不到它，不是這裡的
    // 篩選寫錯。要補齊 22 個縣市得改用政府資料開放平臺的 shapefile（需要
    // ogr2ogr，摩擦較大）。圖層的 description 有向使用者明講這件事。
    transform: (raw) =>
      raw.features
        .filter((f) => f.properties.adm0_a3 === "TWN")
        .map((f) => ({
          type: "Feature",
          geometry: f.geometry,
          properties: {
            id: slugify(f.properties.iso_3166_2 || f.properties.name_en || f.properties.name),
            // 上游的中文名混用「台」與「臺」（台中市 vs 臺南市）。
            // 教學網站用課綱的正式寫法統一成「臺」。
            name: (f.properties.name_zht || f.properties.name_zh || f.properties.name).replace(
              /^台/,
              "臺",
            ),
          },
        })),
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

  process.stdout.write(`- ${source.id}：下載中…`);
  const raw = await (await fetchWithRetry(source.url)).json();
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
      source: source.url,
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
