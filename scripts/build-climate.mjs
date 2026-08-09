#!/usr/bin/env node
/**
 * 由 Open-Meteo ERA5 再分析資料產生各地點的氣候正常值（1991–2020）。
 *
 * 為什麼在建置階段做而不是執行期呼叫 API：
 *   1. 一個班級同時開站會對 Open-Meteo 產生大量請求，可能被限流；
 *   2. 執行期抓 30 年逐日資料再聚合，圖表要等好幾秒才畫得出來。
 *
 * 產出：public/data/climate/<place-id>.json（由本腳本管理，請勿手動編輯）
 *
 * 用法：npm run build:climate
 */
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exists = (p) => access(p).then(() => true).catch(() => false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACES_DIR = join(ROOT, "src/content/places");
const OUT_DIR = join(ROOT, "public/data/climate");

const PERIOD_START = "1991-01-01";
const PERIOD_END = "2020-12-31";
const PERIOD_LABEL = "1991–2020";
const YEARS = 30;

/** Open-Meteo 免費方案會回 429，遇到就指數退避重試。 */
async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status !== 429 || i === attempts - 1) {
      throw new Error(`Open-Meteo ${res.status}`);
    }
    const waitMs = 5000 * 2 ** i;
    process.stdout.write(`（429，${waitMs / 1000}s 後重試）`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("unreachable");
}

async function fetchNormals(place) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(place.coord.lat));
  url.searchParams.set("longitude", String(place.coord.lng));
  url.searchParams.set("start_date", PERIOD_START);
  url.searchParams.set("end_date", PERIOD_END);
  url.searchParams.set("daily", "temperature_2m_mean,precipitation_sum");
  url.searchParams.set("timezone", "GMT");

  const res = await fetchWithRetry(url);
  const json = await res.json();

  const { time, temperature_2m_mean: temps, precipitation_sum: precip } = json.daily;

  const tempSum = Array(12).fill(0);
  const tempCount = Array(12).fill(0);
  const precipSum = Array(12).fill(0);

  for (let i = 0; i < time.length; i++) {
    const month = Number(time[i].slice(5, 7)) - 1;
    if (temps[i] !== null) {
      tempSum[month] += temps[i];
      tempCount[month] += 1;
    }
    if (precip[i] !== null) precipSum[month] += precip[i];
  }

  return {
    placeId: place.id,
    period: PERIOD_LABEL,
    source: "Open-Meteo ERA5 再分析資料",
    temperature_c: tempSum.map((s, i) => round(tempCount[i] ? s / tempCount[i] : 0, 1)),
    // 30 年總量除以年數 = 月平均累積雨量
    precipitation_mm: precipSum.map((s) => round(s / YEARS, 1)),
  };
}

const round = (n, digits) => Number(n.toFixed(digits));

async function main() {
  // 預設只補抓還沒有的地點；加 --force 重抓全部
  const force = process.argv.includes("--force");
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(PLACES_DIR)).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const place = JSON.parse(await readFile(join(PLACES_DIR, file), "utf8"));
    const outPath = join(OUT_DIR, `${place.id}.json`);
    if (!force && (await exists(outPath))) {
      console.log(`跳過 ${place.id}（已存在，用 --force 重抓）`);
      continue;
    }
    process.stdout.write(`抓取 ${place.id} (${place.name.zh}) … `);
    try {
      const normals = await fetchNormals(place);
      await writeFile(outPath, JSON.stringify(normals, null, 2) + "\n");
      console.log("完成");
    } catch (err) {
      console.log(`失敗：${err.message}`);
      process.exitCode = 1;
    }
    // Open-Meteo 免費方案有速率限制，兩次請求之間留點間隔
    await new Promise((r) => setTimeout(r, 1200));
  }
}

await main();
