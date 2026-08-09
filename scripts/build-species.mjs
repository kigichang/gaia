#!/usr/bin/env node
/**
 * 由 GBIF（Global Biodiversity Information Facility）取得台灣特有種的真實觀測紀錄，
 * 產生每個物種的觀測點 GeoJSON。
 *
 * 為什麼在建置階段做而不是執行期呼叫 API：
 *   1. 比照 build-climate.mjs 的既有作法，避免上課時大量學生同時開站對 GBIF
 *      發出重複請求；
 *   2. 執行期只需要讀一個小檔案，地圖疊圖不用等 API 回應。
 *
 * 產出：public/data/species/<species-id>.geojson（由本腳本管理，請勿手動編輯）
 *
 * 用法：npm run build:species [-- --force]
 *
 * 資料限制（務必讓使用者知道）：GBIF 觀測紀錄反映的是「歷史觀測熱點」，
 * 受賞鳥/採集活動的地點偏好影響，不是嚴謹的族群密度普查；已加
 * hasGeospatialIssue=false 篩掉座標明顯有問題的紀錄，但教學呈現時
 * 不要暗示這就是完整、精確的分布範圍。
 */
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exists = (p) => access(p).then(() => true).catch(() => false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECIES_DIR = join(ROOT, "src/content/species");
const OUT_DIR = join(ROOT, "public/data/species");

/** 每個物種最多收錄的觀測點筆數，避免地圖過載與 repo 檔案過大。 */
const MAX_RECORDS = 200;

/** GBIF 沒有 Open-Meteo 那麼容易 429，但保守起見套用同樣的退避重試。 */
async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status !== 429 || i === attempts - 1) {
      throw new Error(`GBIF ${res.status}`);
    }
    const waitMs = 5000 * 2 ** i;
    process.stdout.write(`（429，${waitMs / 1000}s 後重試）`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("unreachable");
}

async function fetchOccurrences(species) {
  const url = new URL("https://api.gbif.org/v1/occurrence/search");
  url.searchParams.set("taxonKey", String(species.gbifTaxonKey));
  url.searchParams.set("country", "TW");
  url.searchParams.set("hasCoordinate", "true");
  // 篩掉座標明顯有問題的紀錄（如落在海裡、經緯度顛倒等)
  url.searchParams.set("hasGeospatialIssue", "false");
  url.searchParams.set("limit", String(MAX_RECORDS));

  const res = await fetchWithRetry(url);
  const json = await res.json();

  return {
    type: "FeatureCollection",
    features: json.results.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.decimalLongitude, r.decimalLatitude] },
      properties: {
        speciesId: species.id,
        date: r.eventDate ?? null,
        basisOfRecord: r.basisOfRecord ?? "UNKNOWN",
      },
    })),
  };
}

async function main() {
  // 預設只補抓還沒有的物種；加 --force 重抓全部
  const force = process.argv.includes("--force");
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SPECIES_DIR)).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const species = JSON.parse(await readFile(join(SPECIES_DIR, file), "utf8"));
    const outPath = join(OUT_DIR, `${species.id}.geojson`);
    if (!force && (await exists(outPath))) {
      console.log(`跳過 ${species.id}（已存在，用 --force 重抓）`);
      continue;
    }
    process.stdout.write(`抓取 ${species.id} (${species.name.zh}) … `);
    try {
      const geojson = await fetchOccurrences(species);
      await writeFile(outPath, JSON.stringify(geojson, null, 2) + "\n");
      console.log(`完成，${geojson.features.length} 筆觀測點`);
    } catch (err) {
      console.log(`失敗：${err.message}`);
      process.exitCode = 1;
    }
    // 兩次請求之間留點間隔，避免短時間內大量打 GBIF
    await new Promise((r) => setTimeout(r, 800));
  }
}

await main();
