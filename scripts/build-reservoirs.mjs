#!/usr/bin/env node
/**
 * 產生水庫即時水情：public/data/reservoirs-live.json。
 *
 * ## 為什麼是建置期抓、不是執行期抓
 *
 * 比照 build-climate.mjs（Open-Meteo）與 build-species.mjs（GBIF）的既有理由，
 * 再加上兩條這個端點獨有的：
 *
 * 1. **opendata.wra.gov.tw 沒有 CORS 標頭**，瀏覽器根本抓不到（純靜態站沒有
 *    伺服器可以代理）。
 * 2. 它前面掛著 bot 防護（見 lib/reservoirs.mjs），一個班 30 個學生同時開站，
 *    看起來就會像是攻擊。
 *
 * ## 這份檔案跟 public/data/geo/tw-reservoirs.geojson 的分工
 *
 * geojson  ＝ 位置與**基本資料**（容量、壩高、集水面積）。一年才變一次，
 *             由 build-geodata.mjs 產生，commit 進 repo。
 * 這份 JSON ＝ **會變的那一半**（蓄水量、水位、進出流量、集水區降雨）。
 *
 * 兩份都 commit 進 repo，靠 `code`（水庫代碼）join。commit 這份的理由是它要當
 * **fallback**：CI 每次部署都會重抓一次（見 .github/workflows/deploy.yml），
 * 但上游掛掉的時候部署不該跟著失敗——寧可顯示一份有明確觀測時間的舊資料，
 * 也不要讓整個圖層變成空的。⚠️ 所以 UI **一定**要把 `observedAt` 顯示出來
 * （ReservoirCard 有做），使用者才看得出自己在看多舊的東西。
 *
 * 用法：
 *   npm run build:reservoirs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./lib/fetch-retry.mjs";
import {
  CONDITIONS_URL,
  LICENSE,
  RESERVOIR_IDS,
  fetchReservoirBasics,
  fetchReservoirConditions,
} from "./lib/reservoirs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "public/data/reservoirs-live.json");

/** 四捨五入到指定小數位；null 保持 null（上游很多欄位是空的，不能當成 0）。 */
const round = (v, digits = 1) =>
  v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

process.stdout.write("- 水庫即時水情：下載中…");
const [basics, conditions] = await Promise.all([
  fetchReservoirBasics(fetchWithRetry),
  fetchReservoirConditions(fetchWithRetry),
]);

const reservoirs = {};
const missing = [];

for (const [code, b] of basics) {
  const id = RESERVOIR_IDS[b.name];
  if (!id) {
    // 對照表由 build-geodata.mjs 共用，兩支腳本看到的名單必須一致
    console.error(`\n✗ 水庫「${b.name}」不在 RESERVOIR_IDS 對照表裡`);
    process.exit(1);
  }
  const c = conditions.get(code);
  if (!c) {
    missing.push(b.name);
    continue;
  }

  /**
   * 蓄水百分比 = 有效蓄水量 ÷ **目前有效容量**。
   *
   * 分母用基本資料的「目前有效容量」（已扣除淤積量，逐年重測），不是設計總容量——
   * 石門、白河這些老水庫淤積很多，用設計容量當分母會系統性地低估蓄水率。
   *
   * **不夾在 100% 以下**：滿庫溢流時上游本來就會給出略高於 100 的值，那是真的。
   * 夾住等於竄改資料；要夾的是顏色級距（見 thematicColors.ts），不是數字本身。
   */
  const capacity = b.effectiveCapacity_10k_m3;
  const percent =
    capacity && capacity > 0 && c.storage_10k_m3 != null
      ? round((c.storage_10k_m3 / capacity) * 100, 1)
      : null;

  reservoirs[id] = {
    code,
    observedAt: c.observedAt,
    percent,
    storage: round(c.storage_10k_m3, 2),
    capacity: round(capacity, 2),
    waterLevel_m: round(c.waterLevel_m, 2),
    inflow_cms: round(c.inflow_cms, 2),
    outflow_cms: round(c.outflow_cms, 2),
    rainfall_mm: round(c.rainfall_mm, 1),
  };
}

const observedTimes = Object.values(reservoirs).map((r) => r.observedAt).sort();

const out = {
  metadata: {
    source: CONDITIONS_URL,
    license: LICENSE,
    generatedAt: new Date().toISOString(),
    /** 最新／最舊的一筆觀測時間。上游各水庫回報時刻不一致，兩個都留著才看得出來。 */
    observedFrom: observedTimes[0] ?? null,
    observedTo: observedTimes.at(-1) ?? null,
    count: observedTimes.length,
  },
  reservoirs,
};

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, `${JSON.stringify(out, null, 1)}\n`);

const kb = ((await import("node:fs")).statSync(OUT_PATH).size / 1024).toFixed(0);
console.log(`完成：${observedTimes.length}／${basics.size} 座有水情，${kb} KB`);
if (missing.length) {
  // 這**不是**錯誤：白河、虎頭埤這些水庫上游本來就常常不回報。
  // 但要印出來，否則「怎麼少了一座」永遠沒有人會發現。
  console.log(`  （無即時水情：${missing.join("、")}）`);
}
console.log(`  觀測時間 ${out.metadata.observedFrom} ～ ${out.metadata.observedTo}`);
