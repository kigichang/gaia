#!/usr/bin/env node
/**
 * 建置前的內容驗證。schema 不符就讓 `npm run build` 直接失敗，
 * 避免壞掉的地點資料上線後在瀏覽器才炸開。
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { PlaceSchema, ClimateSchema } from "../src/lib/schema.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACES_DIR = join(ROOT, "src/content/places");
const CLIMATE_DIR = join(ROOT, "public/data/climate");

const errors = [];

async function validateDir(dir, schema, label, extraCheck) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log(`（略過 ${label}：目錄不存在）`);
    return [];
  }

  const parsed = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${label}/${file} → ${issue.path.join(".")}: ${issue.message}`);
      }
      continue;
    }
    extraCheck?.(result.data, file);
    parsed.push(result.data);
  }
  console.log(`${label}: ${parsed.length} 筆通過驗證`);
  return parsed;
}

const places = await validateDir(PLACES_DIR, PlaceSchema, "places", (place, file) => {
  if (basename(file, ".json") !== place.id) {
    errors.push(`places/${file} → 檔名必須等於 id（${place.id}.json）`);
  }
});

const placeIds = new Set(places.map((p) => p.id));
await validateDir(CLIMATE_DIR, ClimateSchema, "climate", (climate, file) => {
  if (!placeIds.has(climate.placeId)) {
    errors.push(`climate/${file} → placeId「${climate.placeId}」沒有對應的地點資料`);
  }
});

if (errors.length) {
  console.error(`\n內容驗證失敗（${errors.length} 個問題）：`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("內容驗證通過 ✓");
