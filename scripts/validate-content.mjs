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
  ReservoirLiveSchema,
} from "../src/lib/schema.ts";
// 圖層註冊表是刻意設計成純資料的，就是為了能在這裡被 Node 直接載入做交叉檢查。
// 見 src/map/registry/types.ts 的說明。
import { DERIVED_FILES, THEMES, allLayers } from "../src/map/registry/index.ts";
/**
 * 程式產生的幾何（緯度參考線、行星風系）。這裡真的把它跑起來，理由跟載入註冊表
 * 一樣：那些圖層沒有 geojson 可以比對，`featureIds` 或內容檔的檔名打錯字的話，
 * 執行期是**完全靜默**的——切出來的 FeatureCollection 是空的、卡片退回只有圖層
 * 說明，console 什麼都不會說。generators.ts 只 `import type`，Node 讀得動。
 */
import { generateLayer } from "../src/map/registry/generators.ts";
/**
 * 地理要素說明的分片產生器。這裡拿它來**逐 byte 比對** `public/data/geo-content/`
 * 有沒有跟 `src/content/geo/` 同步——那份產物是詳情卡唯一會讀到的東西，忘了重跑
 * `npm run build:geo-content` 的話，畫面上顯示的是上一版的文字而且完全靜默。
 */
import { GEO_CONTENT_OUT, buildGeoContentShards } from "./lib/geo-content.mjs";

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

// ── 分片是否與內容檔同步（public/data/geo-content/<collection>.json）─────
//
// ⚠️ 這是「編輯了內容卻忘了重新產生」唯一擋得住的地方。詳情卡讀的是分片，不是
// src 底下那份，所以不同步的症狀是**卡片顯示上一版的文字**——沒有錯誤訊息、
// build 也照樣成功。比對的是最終要寫進檔案的那個字串本身（見 lib/geo-content.mjs）。
{
  const shards = await buildGeoContentShards(ROOT);
  const outDir = join(ROOT, GEO_CONTENT_OUT);
  let existing = [];
  try {
    existing = (await readdir(outDir)).filter((f) => f.endsWith(".json"));
  } catch {
    if (shards.size > 0) {
      errors.push(`${GEO_CONTENT_OUT}/ 不存在 → 跑 npm run build:geo-content`);
    }
  }
  for (const [collection, { json }] of shards) {
    const path = join(outDir, `${collection}.json`);
    const actual = await readFile(path, "utf8").catch(() => null);
    if (actual === null) {
      errors.push(
        `${GEO_CONTENT_OUT}/${collection}.json → 缺這一份分片，跑 npm run build:geo-content`,
      );
    } else if (actual !== json) {
      errors.push(
        `${GEO_CONTENT_OUT}/${collection}.json → 與 src/content/geo/${collection}/ 不同步，` +
          `跑 npm run build:geo-content`,
      );
    }
  }
  for (const file of existing) {
    if (!shards.has(file.slice(0, -".json".length))) {
      errors.push(
        `${GEO_CONTENT_OUT}/${file} → src/content/geo/ 底下沒有這個 collection，` +
          `跑 npm run build:geo-content 清掉`,
      );
    }
  }
  if (shards.size > 0) console.log(`geo-content: ${shards.size} 個分片與內容檔同步`);
}

/**
 * ── 內容檔裡不准有 markdown ──────────────────────────────────────────────
 *
 * 詳情卡把 `facts[].value`（以及 subtitle／stats／sources）直接放進文字節點，
 * **沒有任何 markdown 算繪**。所以 `**粗體**` 會原樣印出兩對星號給學生看，而且
 * **完全靜默**——build 過、typecheck 過、schema 也過，只有把那一張卡打開來看
 * 才發現得了。2026-08 掃出 6 處（維蘇威、聖母峰、普哈胡努 ×2、尤耶亞科山、
 * 信風），全部改成本站原本的慣例（用「」或改寫句子）。
 *
 * ⚠️ 正確的修法不是加一個 markdown 算繪器：那會替一份純資料檔開一條新的語法
 * 通道，而 `sources`、`stats`、圖層的 `description`／`notes` 全都不會經過它，
 * 寫的人分不出哪裡能用、哪裡不能用。
 *
 * 檢查放在**檔案層級**（不是逐欄位）是刻意的：`**` 在這些資料檔裡沒有任何
 * 合法用途，整份掃最簡單也最不會漏。
 */
for (const dir of ["places", "indigenous", "species", "geo"]) {
  const base = join(ROOT, "src/content", dir);
  const walk = async (d, rel) => {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(next, `${rel}/${entry.name}`);
      } else if (entry.name.endsWith(".json")) {
        const text = await readFile(next, "utf8");
        if (text.includes("**")) {
          errors.push(
            `${rel}/${entry.name} → 含 markdown 粗體標記「**」，卡片不算繪 markdown（會原樣印出星號）。要強調請用「」或改寫句子`,
          );
        }
      }
    }
  };
  await walk(base, dir);
}

// ── 產生／手繪的 geojson ────────────────────────────────────────────────
/**
 * 刻意跟另一個圖層共用 `properties.id` 的產物，因此**允許重複**。
 *
 * 颱風的 757 個中心定位點共用母圖層那 14 個颱風的 id——那是 CLAUDE_TW.md
 * 「三層共用 id」的同一條規則：同一個實體就該是同一個 id，點定位點才會開出
 * 那個颱風的卡片、選取時整條路徑才會連同它所有的定位點一起加粗。
 *
 * 世界紀錄熱帶氣旋的 1,729 個中心定位點共用母圖層那 33 條路徑的 id，同一條規則。
 *
 * ⚠️ 這是白名單不是開關：其他檔案的 id 重複幾乎都是 bug（`slugify()` 把中文
 * 剝成空字串是最常見的一種），照樣要讓驗證失敗。
 */
const SHARED_ID_COLLECTIONS = new Set([
  "data/geo/tw-typhoon-centers.geojson",
  "data/geo/world-cyclone-centers.geojson",
]);

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
    if (dupes.length && !SHARED_ID_COLLECTIONS.has(publicPath)) {
      errors.push(`${publicPath} → properties.id 重複：${[...new Set(dupes)].join("、")}`);
    }
    geoCollectionIds.set(publicPath, new Set(ids));
  }
  if (files.length) console.log(`${relDir}: ${files.length} 個 geojson 通過驗證`);
}

// ── 水庫即時水情（public/data/reservoirs-live.json）─────────────────────
//
// 這份檔案是**每次部署重抓**的（見 .github/workflows/deploy.yml），所以它是全站
// 唯一一份「內容會在沒有人改程式的情況下變動」的資料。上游欄位改名時最糟的結果
// 是它變成結構正確但空的 JSON——執行期完全靜默（水庫都還在，只是每一座都顯示
// 「暫無資料」）。在這裡擋下來。
{
  const livePath = join(ROOT, "public/data/reservoirs-live.json");
  try {
    const raw = JSON.parse(await readFile(livePath, "utf8"));
    const result = ReservoirLiveSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`reservoirs-live.json → ${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      const ids = result.data.reservoirs;
      const geojsonIds = geoCollectionIds.get("data/geo/tw-reservoirs.geojson");
      // id 對不起來就代表兩份檔案是不同版本產生的，join 會靜默失敗（水情永遠是空的）
      const orphans = geojsonIds
        ? Object.keys(ids).filter((id) => !geojsonIds.has(id))
        : [];
      if (orphans.length) {
        errors.push(
          `reservoirs-live.json → ${orphans.join("、")} 在 tw-reservoirs.geojson 裡沒有對應的水庫，` +
            `請重跑 npm run build:geodata -- --force --only=tw-reservoirs`,
        );
      }
      console.log(`reservoirs-live: ${Object.keys(ids).length} 座水庫有即時水情`);
    }
  } catch (err) {
    errors.push(
      `public/data/reservoirs-live.json 讀不到或不是合法 JSON（${err.message}）——請執行 npm run build:reservoirs`,
    );
  }
}

// ── 圖層註冊表交叉檢查 ──────────────────────────────────────────────────
//
// 這是把註冊表寫成純資料所換來的東西。少了這一段，一個打錯的 remote path 在
// 執行期是 fetch 404 → resolveLayerData 回 null → 圖層永遠不出現 → **console
// 完全沒有訊息**，只會在上課上到一半才發現。這裡讓它變成建置失敗。
{
  const seenLayerIds = new Map();
  /** 被圖層層級 `featureIds` 切分的 geojson → 它的全部圖徵 id（只讀一次） */
  const sliceableSourceIds = new Map();
  /** 同一份 geojson → 已經被某一層認領的圖徵 id */
  const sliceClaims = new Map();
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

    /**
     * 資料限制一律放 `notes`，`description` 裡不留 ⚠️。
     *
     * 圖層抽屜就是靠這件事把兩者分開：說明留在核取方塊下面，警語收進圖層名稱旁邊
     * 那顆 ⚠️ 按鈕開出來的小視窗（沒有 notes 就沒有按鈕）。警語漏回 description
     * 的話，那一列會長回原本的長度、但按鈕不會出現——畫面上看起來只是「這個圖層
     * 的說明比較長」，沒有任何線索指向寫錯了地方。
     */
    if (layer.description?.includes("⚠️")) {
      errors.push(
        `registry/${theme.id} → 圖層「${layer.id}」的 description 含 ⚠️，資料限制要改放 notes（抽屜的 ⚠️ 小視窗只讀 notes）`,
      );
    }
    for (const note of layer.notes ?? []) {
      if (!note.startsWith("⚠️ ")) {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」的 notes 有一則不是以「⚠️ 」開頭：${note.slice(0, 20)}…`,
        );
      }
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

    // remote 與 derived 來源指到的檔案必須真的存在。
    // derived 也要查：它一樣是 fetch，檔案不在就一樣是「圖層靜默消失」。
    const remotePaths = [];
    const collectPaths = (source) => {
      if (source?.type === "remote") remotePaths.push(source.path);
      if (source?.type === "derived") remotePaths.push(...DERIVED_FILES[source.derived]);
    };
    collectPaths(layer.source);
    collectPaths(layer.attach?.source);
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

    /**
     * 用 `featureIds` 從母圖層切分的子項目（交通軸線），每一個 id 都要真的存在。
     *
     * 打錯一個字的後果是**那條軸線從地圖上靜默消失**：切出來的 FeatureCollection
     * 是空的，`useGeoLayers` 照樣把圖層加上去，只是什麼都不畫，console 也沒有東西。
     * 順便擋掉「兩者都沒填」——`expandActive` 對那種子項目是直接跳過的。
     */
    if (layer.items?.from.type === "inline" && layer.source?.type === "remote") {
      let ids = null;
      for (const item of layer.items.from.list) {
        if (item.source) continue;
        if (!item.featureIds?.length) {
          errors.push(
            `registry/${theme.id} → 圖層「${layer.id}」的子項目「${item.id}」既沒有 source 也沒有 featureIds，執行期會被靜默跳過`,
          );
          continue;
        }
        if (ids === null) {
          try {
            const fc = JSON.parse(await readFile(join(ROOT, "public", layer.source.path), "utf8"));
            ids = new Set(fc.features.map((f) => String(f.properties?.id)));
          } catch {
            ids = new Set(); // 母圖層檔案不存在的錯誤上面那段已經報過了
          }
        }
        for (const fid of item.featureIds) {
          if (!ids.has(fid)) {
            errors.push(
              `registry/${theme.id} → 圖層「${layer.id}」的子項目「${item.id}」宣告的 featureId「${fid}」不在 public/${layer.source.path} 裡（那個子項目會變成空圖層）`,
            );
          }
        }
      }
    }

    /**
     * 同一件事的圖層層級版本：世界櫥窗那九層各自用 `featureIds` 從兩份共用的
     * geojson 切出自己那幾筆（見 registry/types.ts）。這裡查**兩個方向**——
     *
     * 1. 宣告的每個 id 真的存在（打錯字＝那一層變成空圖層，完全靜默）；
     * 2. 反過來，被這種方式切分的 geojson 裡**每個圖徵都要被某一層認領**。
     *    少了第二條，之後在 `world-picks.geojson` 加一筆卻忘了寫進任何一層的
     *    `featureIds`，那個點會從地圖上消失而沒有任何訊息——那正是拆層之後最容易
     *    犯的錯。第二條在下面所有主題都跑完之後才判得出來，所以先記帳。
     */
    if (layer.featureIds && layer.source?.type === "remote") {
      const path = layer.source.path;
      let ids = sliceableSourceIds.get(path);
      if (ids === undefined) {
        try {
          const fc = JSON.parse(await readFile(join(ROOT, "public", path), "utf8"));
          ids = new Set(fc.features.map((f) => String(f.properties?.id)));
        } catch {
          ids = new Set(); // 檔案不存在的錯誤上面那段已經報過了
        }
        sliceableSourceIds.set(path, ids);
      }
      const claimed = sliceClaims.get(path) ?? new Set();
      for (const fid of layer.featureIds) {
        claimed.add(fid);
        if (!ids.has(fid)) {
          errors.push(
            `registry/${theme.id} → 圖層「${layer.id}」宣告的 featureId「${fid}」不在 public/${path} 裡（那一層會變成空圖層）`,
          );
        }
      }
      sliceClaims.set(path, claimed);
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

    // 子項目自己的詳情卡（`items.detail`，見 registry/types.ts）：那個 collection
    // 沒有 geojson，內容檔就是卡片的全部內容，所以一個 collection 都不能是空的。
    if (layer.items?.detail?.type === "geo" && layer.status === "ready") {
      const collection = layer.items.detail.collection;
      if (!geoFeatures.some((f) => f.collection === collection)) {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」的 items.detail.collection「${collection}」底下一份內容檔都沒有（點子項目名稱會開出一張只重複圖層說明的卡）`,
        );
      }
    }
  }

  /**
   * 上面記帳的第二個方向：被圖層層級 `featureIds` 切分的 geojson，每個圖徵都要有
   * 主人。⚠️ **刻意只查這一種切分**，不套到 `items.featureIds`——交通軸線那份母圖層
   * 是否被子項目涵蓋完畢，從來沒有人保證過。
   */
  for (const [path, ids] of sliceableSourceIds) {
    const claimed = sliceClaims.get(path) ?? new Set();
    const orphans = [...ids].filter((id) => !claimed.has(id));
    if (orphans.length) {
      errors.push(
        `registry → public/${path} 的圖徵「${orphans.join("、")}」沒有被任何圖層的 featureIds 認領（它們不會出現在地圖上，而且完全靜默）`,
      );
    }
  }

  console.log(`registry: ${THEMES.length} 個主題／${seenLayerIds.size} 個圖層通過交叉檢查`);
}

/**
 * 地理要素內容檔的 (collection, id) 必須在對應 geojson 裡找得到。
 * 反向**刻意不要求**：沒有內容檔的圖徵（例如還沒寫說明的縣市）是允許的。
 *
 * ⚠️ 例外是 `kind: "elevation"`（垂直植被帶）：那一層**沒有 geojson**，顏色由 DEM
 * 逐像素算出來，它的「圖徵」就是 `items` 那六個高程分帶。所以 id 改成跟 items 對，
 * 對不上一樣要失敗——`handleItemNameClick` 傳的 featureId 就是 item id，打錯字的話
 * 點下去會開出一張只有圖層說明的卡，完全靜默。
 */
const elevationItemIds = new Map(); // collection → Set(item id)
for (const { layer } of allLayers()) {
  if (layer.render?.kind !== "elevation" || layer.detail?.type !== "geo") continue;
  const list = layer.items?.from.type === "inline" ? layer.items.from.list : [];
  elevationItemIds.set(layer.detail.collection, new Set(list.map((i) => i.id)));
}

/**
 * 同一件事的第二種例外：**程式產生的圖層也沒有 geojson**（行星風系）。
 * 它的圖徵 id 由 generators.ts 算出來，所以直接跑一次拿真正的 id 來比對——
 * 這同時擋掉兩個方向的打錯字：`featureIds` 指到不存在的圖徵（子項目變空圖層），
 * 以及內容檔的檔名跟圖徵對不起來（卡片退回只有圖層說明）。
 */
/**
 * 第三種例外：**子項目自己的詳情卡**（`items.detail`，目前只有古蹟三級的定義）。
 * 那個 collection 同樣沒有 geojson——它的「圖徵」就是 `items` 那三個級別，所以
 * id 改成跟 items 對。理由與高程分帶相同：`handleItemNameClick` 傳的 featureId
 * 就是 item id，打錯字的話點下去會開出一張只重複圖層說明的卡，完全靜默。
 */
const itemDetailIds = new Map(); // collection → Set(item id)
for (const { layer } of allLayers()) {
  if (layer.items?.detail?.type !== "geo") continue;
  const list = layer.items.from.type === "inline" ? layer.items.from.list : [];
  itemDetailIds.set(layer.items.detail.collection, new Set(list.map((i) => i.id)));
}

const generatedIds = new Map(); // collection → Set(feature id)
for (const { theme, layer } of allLayers()) {
  if (layer.source?.type !== "generated") continue;
  const ids = new Set(
    generateLayer(layer.source.generator).features.map((f) => String(f.properties?.id)),
  );
  if (layer.detail?.type === "geo") generatedIds.set(layer.detail.collection, ids);
  const list = layer.items?.from.type === "inline" ? layer.items.from.list : [];
  for (const item of list) {
    for (const fid of item.featureIds ?? []) {
      if (!ids.has(fid)) {
        errors.push(
          `registry/${theme.id} → 圖層「${layer.id}」的子項目「${item.id}」宣告的 featureId「${fid}」不在 generators.ts 的「${layer.source.generator}」產物裡（那個子項目會變成空圖層）`,
        );
      }
    }
  }
}

for (const f of geoFeatures) {
  const generated = generatedIds.get(f.collection);
  if (generated) {
    if (!generated.has(f.id)) {
      errors.push(
        `geo/${f.collection}/${f.id}.json → 這個 collection 由程式產生，但 generators.ts 的產物裡沒有 id「${f.id}」`,
      );
    }
    continue;
  }
  const items = elevationItemIds.get(f.collection);
  if (items) {
    if (!items.has(f.id)) {
      errors.push(
        `geo/${f.collection}/${f.id}.json → 這個 collection 由高程分帶圖層提供，但 items 裡沒有 id「${f.id}」`,
      );
    }
    continue;
  }
  const itemIds = itemDetailIds.get(f.collection);
  if (itemIds) {
    if (!itemIds.has(f.id)) {
      errors.push(
        `geo/${f.collection}/${f.id}.json → 這個 collection 是某個圖層的 items.detail，但 items 裡沒有 id「${f.id}」`,
      );
    }
    continue;
  }
  const found = [...geoCollectionIds.entries()].some(
    ([path, ids]) => path.includes(f.collection) && ids.has(f.id),
  );
  if (geoCollectionIds.size && !found) {
    errors.push(`geo/${f.collection}/${f.id}.json → 在對應的 geojson 裡找不到 id「${f.id}」`);
  }
}

// 高程分帶反過來**要求每一帶都有內容檔**：這一層沒有 geojson，FeatureCard 的
// fallback 在這裡等於沒有退路，少一個檔案就是一張只有圖層說明的卡。
for (const [collection, ids] of elevationItemIds) {
  for (const id of ids) {
    if (!geoFeatures.some((f) => f.collection === collection && f.id === id)) {
      errors.push(`geo/${collection} → 高程分帶「${id}」缺內容檔，點帶名會開出沒有內容的卡`);
    }
  }
}

// `items.detail` 同理：宣告了「子項目名稱要開一張定義卡」，就每一個子項目都要有。
// 少一份的話那一格會退回成「重複一次圖層說明」——三級古蹟裡有一級沒有定義，
// 在畫面上看起來只是「這一級的說明比較短」，不會有任何錯誤。
for (const [collection, ids] of itemDetailIds) {
  for (const id of ids) {
    if (!geoFeatures.some((f) => f.collection === collection && f.id === id)) {
      errors.push(`geo/${collection} → 子項目「${id}」缺內容檔，點子項目名稱會開出沒有內容的卡`);
    }
  }
}

if (errors.length) {
  console.error(`\n內容驗證失敗（${errors.length} 個問題）：`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("內容驗證通過 ✓");
