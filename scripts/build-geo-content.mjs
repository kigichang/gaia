#!/usr/bin/env node
/**
 * 把 `src/content/geo/<collection>/<id>.json` 打包成
 * `public/data/geo-content/<collection>.json`，讓詳情卡改成延遲載入。
 *
 * 取得邏輯、分片單位與「為什麼要有這一層」全部寫在 `lib/geo-content.mjs`。
 *
 * ⚠️ 這支**不打任何外部 API**，純粹是本地檔案的轉換，所以跟 build:geodata 那幾支
 * 不同：內容一改就重跑一次，成本是零。`npm run validate` 會逐 byte 比對，忘了跑
 * 就讓建置失敗。
 */
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GEO_CONTENT_OUT, buildGeoContentShards } from "./lib/geo-content.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, GEO_CONTENT_OUT);

/** 單一分片的大小預算，比照 build-geodata.mjs：超過就讓建置失敗，不是印個警告。 */
const HARD_LIMIT = 512 * 1024;
const WARN_LIMIT = 256 * 1024;

const shards = await buildGeoContentShards(ROOT);
await mkdir(OUT_DIR, { recursive: true });

let total = 0;
let changed = 0;
for (const [collection, { json, count }] of shards) {
  const bytes = Buffer.byteLength(json);
  total += bytes;
  if (bytes > HARD_LIMIT) {
    console.error(
      `✗ ${collection}.json ${(bytes / 1024).toFixed(0)} KB 超過 ${HARD_LIMIT / 1024} KB 上限`,
    );
    process.exit(1);
  }
  if (bytes > WARN_LIMIT) {
    console.warn(`⚠️  ${collection}.json ${(bytes / 1024).toFixed(0)} KB（接近上限）`);
  }
  const path = join(OUT_DIR, `${collection}.json`);
  const prev = await readFile(path, "utf8").catch(() => null);
  if (prev !== json) {
    await writeFile(path, json);
    changed += 1;
  }
  console.log(`${collection}.json　${count} 筆　${(bytes / 1024).toFixed(0)} KB`);
}

// collection 整個被刪掉時，殘留的分片會讓卡片顯示已經不存在的內容——比對不出來，
// 因為 validate 只往「src 有的」那個方向看。所以這裡主動清掉。
const stale = (await readdir(OUT_DIR))
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !shards.has(f.slice(0, -".json".length)));
for (const f of stale) {
  await unlink(join(OUT_DIR, f));
  console.log(`（移除已不存在的 collection：${f}）`);
}

console.log(
  `geo-content: ${shards.size} 個 collection、合計 ${(total / 1024).toFixed(0)} KB` +
    `（${changed} 份有變動${stale.length ? `、${stale.length} 份移除` : ""}）`,
);
