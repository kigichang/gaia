#!/usr/bin/env node
/**
 * 建置前的內容驗證。schema 不符就讓 `npm run build` 直接失敗，
 * 避免壞掉的地點資料上線後在瀏覽器才炸開。
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PlaceSchema,
  ClimateSchema,
  IndigenousGroupSchema,
  SpeciesSchema,
  SpeciesOccurrenceSchema,
  GeoFeatureSchema,
  GeoCollectionSchema,
} from "../src/lib/schema.ts";
// 圖層註冊表是刻意設計成純資料的，就是為了能在這裡被 Node 直接載入做交叉檢查。
// 見 src/map/registry/types.ts 的說明。
import { THEMES, allLayers } from "../src/map/registry/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACES_DIR = join(ROOT, "src/content/places");
const CLIMATE_DIR = join(ROOT, "public/data/climate");
const INDIGENOUS_DIR = join(ROOT, "src/content/indigenous");
const SPECIES_DIR = join(ROOT, "src/content/species");
const SPECIES_OCCURRENCE_DIR = join(ROOT, "public/data/species");
const GEO_CONTENT_DIR = join(ROOT, "src/content/geo");
/** build-geodata.mjs 的產物，與手繪的教學示意幾何分開放，禁止手改的界線才清楚 */
const GEO_DATA_DIRS = ["public/data/geo", "public/data/geo-manual"];

const errors = [];

async function validateDir(dir, schema, label, extraCheck, ext = ".json") {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(ext));
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

await validateDir(INDIGENOUS_DIR, IndigenousGroupSchema, "indigenous", (group, file) => {
  if (basename(file, ".json") !== group.id) {
    errors.push(`indigenous/${file} → 檔名必須等於 id（${group.id}.json）`);
  }
});

const species = await validateDir(SPECIES_DIR, SpeciesSchema, "species", (sp, file) => {
  if (basename(file, ".json") !== sp.id) {
    errors.push(`species/${file} → 檔名必須等於 id（${sp.id}.json）`);
  }
});

const speciesIds = new Set(species.map((s) => s.id));
await validateDir(
  SPECIES_OCCURRENCE_DIR,
  SpeciesOccurrenceSchema,
  "species-occurrence",
  (occurrence, file) => {
    const expectedId = basename(file, ".geojson");
    if (!speciesIds.has(expectedId)) {
      errors.push(`species-occurrence/${file} → 沒有對應的 species/${expectedId}.json`);
    }
    const wrongSpeciesId = occurrence.features.find((f) => f.properties.speciesId !== expectedId);
    if (wrongSpeciesId) {
      errors.push(
        `species-occurrence/${file} → 內含 speciesId「${wrongSpeciesId.properties.speciesId}」跟檔名不符`,
      );
    }
  },
  ".geojson",
);

// ── 地理要素內容檔（src/content/geo/<collection>/<id>.json）─────────────
//
// 巢狀目錄，所以不能直接用 validateDir。
const geoFeatures = [];
try {
  for (const collection of await readdir(GEO_CONTENT_DIR)) {
    const dir = join(GEO_CONTENT_DIR, collection);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
      const result = GeoFeatureSchema.safeParse(raw);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(`geo/${collection}/${file} → ${issue.path.join(".")}: ${issue.message}`);
        }
        continue;
      }
      if (basename(file, ".json") !== result.data.id) {
        errors.push(`geo/${collection}/${file} → 檔名必須等於 id（${result.data.id}.json）`);
      }
      if (result.data.collection !== collection) {
        errors.push(`geo/${collection}/${file} → collection 必須等於目錄名（${collection}）`);
      }
      geoFeatures.push(result.data);
    }
  }
  console.log(`geo-features: ${geoFeatures.length} 筆通過驗證`);
} catch {
  console.log("（略過 geo-features：目錄不存在）");
}

// ── 產生／手繪的 geojson ────────────────────────────────────────────────
/** 相對於 public/ 的路徑 → 該檔案裡所有 feature 的 id */
const geoCollectionIds = new Map();
for (const relDir of GEO_DATA_DIRS) {
  const dir = join(ROOT, relDir);
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".geojson") || f.endsWith(".json"));
  } catch {
    continue;
  }
  for (const file of files) {
    const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
    const result = GeoCollectionSchema.safeParse(raw);
    const publicPath = `${relDir.replace(/^public\//, "")}/${file}`;
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${publicPath} → ${issue.path.join(".")}: ${issue.message}`);
      }
      continue;
    }
    const ids = result.data.features.map((f) => f.properties.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) {
      errors.push(`${publicPath} → properties.id 重複：${[...new Set(dupes)].join("、")}`);
    }
    geoCollectionIds.set(publicPath, new Set(ids));
  }
  if (files.length) console.log(`${relDir}: ${files.length} 個 geojson 通過驗證`);
}

// ── 圖層註冊表交叉檢查 ──────────────────────────────────────────────────
//
// 這是把註冊表寫成純資料所換來的東西。少了這一段，一個打錯的 remote path 在
// 執行期是 fetch 404 → resolveLayerData 回 null → 圖層永遠不出現 → **console
// 完全沒有訊息**，只會在上課上到一半才發現。這裡讓它變成建置失敗。
{
  const seenLayerIds = new Map();
  for (const { theme, layer } of allLayers()) {
    // 圖層 id 是 maplibre source/layer id 的前綴，撞名會靜默互相覆蓋
    if (seenLayerIds.has(layer.id)) {
      errors.push(
        `registry → 圖層 id「${layer.id}」重複（${seenLayerIds.get(layer.id)} 與 ${theme.id}）`,
      );
    }
    seenLayerIds.set(layer.id, theme.id);

    // 附屬圖層（五大山脈 → 主峰）也是 maplibre id 的前綴，一樣要參與撞名檢查
    if (layer.attach) {
      if (seenLayerIds.has(layer.attach.id)) {
        errors.push(
          `registry → 圖層 id「${layer.attach.id}」重複（${seenLayerIds.get(layer.attach.id)} 與 ${theme.id} 的 attach）`,
        );
      }
      seenLayerIds.set(layer.attach.id, theme.id);
      if (!layer.attach.parentProperty) {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」的 attach 缺 parentProperty，清單巢狀與連動強調都會失效`,
        );
      }
    }

    if (!theme.groups.includes(layer.group)) {
      errors.push(
        `registry/${theme.id} → 圖層「${layer.id}」的 group「${layer.group}」不在 theme.groups 裡，側欄會顯示不出來`,
      );
    }

    if (layer.status === "ready" && !layer.source && !layer.items) {
      errors.push(`registry/${theme.id} → ready 的圖層「${layer.id}」必須有 source 或 items`);
    }

    if (layer.items && layer.items.maxActive > layer.items.palette.length) {
      errors.push(
        `registry/${theme.id} → 圖層「${layer.id}」的 maxActive（${layer.items.maxActive}）超過色票長度（${layer.items.palette.length}）`,
      );
    }

    // browse.zoom 必須落在圖層畫得出來的縮放範圍內。
    //
    // maplibre 的規則是 minzoom <= z < maxzoom，超出範圍圖層就是不畫。點清單「飛過去」
    // 卻飛到一個畫不出來的 zoom，畫面會是一片空白，而詳情卡、相機、paint 表達式全都
    // 正常——完全靜默。踩過一次：縣市政府繼承了縣市界的 maxzoom 11，browse.zoom 卻是 14。
    for (const [what, cfg] of [
      [`圖層「${layer.id}」`, layer],
      ...(layer.attach ? [[`圖層「${layer.id}」的 attach`, layer.attach]] : []),
    ]) {
      const z = cfg.browse?.zoom;
      if (z == null) continue;
      const lo = cfg.minzoom ?? 0;
      const hi = cfg.maxzoom ?? 24;
      if (z < lo || z >= hi) {
        errors.push(
          `registry/${theme.id} → ${what} 的 browse.zoom（${z}）落在算繪範圍 [${lo}, ${hi}) 之外，點清單會飛到一片空白`,
        );
      }
    }

    // remote 來源指到的檔案必須真的存在
    const remotePaths = [];
    if (layer.source?.type === "remote") remotePaths.push(layer.source.path);
    if (layer.attach?.source.type === "remote") remotePaths.push(layer.attach.source.path);
    if (layer.items?.from.type === "inline") {
      for (const item of layer.items.from.list) {
        if (item.source?.type === "remote") remotePaths.push(item.source.path);
      }
    }
    for (const p of remotePaths) {
      try {
        await readFile(join(ROOT, "public", p));
      } catch {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」宣告的 public/${p} 不存在（執行期會靜默變成空圖層）`,
        );
      }
    }

    // detail.collection 要有對應的內容目錄或 geojson
    if (layer.detail?.type === "geo") {
      const known =
        geoFeatures.some((f) => f.collection === layer.detail.collection) ||
        [...geoCollectionIds.keys()].some((p) => p.includes(layer.detail.collection));
      if (layer.status === "ready" && !known) {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」的 detail.collection「${layer.detail.collection}」找不到對應的內容或 geojson`,
        );
      }
    }
  }
  console.log(`registry: ${THEMES.length} 個主題／${seenLayerIds.size} 個圖層通過交叉檢查`);
}

// 地理要素內容檔的 (collection, id) 必須在對應 geojson 裡找得到。
// 反向**刻意不要求**：沒有內容檔的圖徵（例如還沒寫說明的縣市）是允許的。
for (const f of geoFeatures) {
  const found = [...geoCollectionIds.entries()].some(
    ([path, ids]) => path.includes(f.collection) && ids.has(f.id),
  );
  if (geoCollectionIds.size && !found) {
    errors.push(`geo/${f.collection}/${f.id}.json → 在對應的 geojson 裡找不到 id「${f.id}」`);
  }
}

if (errors.length) {
  console.error(`\n內容驗證失敗（${errors.length} 個問題）：`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("內容驗證通過 ✓");
