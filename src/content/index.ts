import type {
  Climate,
  GeoFeature,
  IndigenousGroup,
  Place,
  ReservoirLive,
  Species,
  SpeciesOccurrence,
} from "../lib/schema";

/**
 * 載入所有地點／原住民族／物種資料。
 *
 * 這裡直接把 JSON 當成對應型別使用而不在瀏覽器端跑 zod 驗證——
 * `npm run build` 會先執行 scripts/validate-content.mjs 驗過全部內容，
 * 格式錯誤在建置階段就會擋下來，不必把 zod 打包進前端。
 */
const placeModules = import.meta.glob<{ default: Place }>("./places/*.json", {
  eager: true,
});

export const places: Place[] = Object.values(placeModules)
  .map((m) => m.default)
  .sort((a, b) => b.coord.lat - a.coord.lat);

export const placeById = new Map(places.map((p) => [p.id, p]));

export function getPlace(id: string): Place | undefined {
  return placeById.get(id);
}

/** 氣候正常值由 build:climate 產生成靜態 JSON，執行期只讀本地檔案，不打 Open-Meteo。 */
const climateCache = new Map<string, Promise<Climate | null>>();

export function loadClimate(placeId: string): Promise<Climate | null> {
  const cached = climateCache.get(placeId);
  if (cached) return cached;

  const promise = fetch(`${import.meta.env.BASE_URL}data/climate/${placeId}.json`)
    .then((res) => (res.ok ? (res.json() as Promise<Climate>) : null))
    .catch(() => null);

  climateCache.set(placeId, promise);
  return promise;
}

const indigenousModules = import.meta.glob<{ default: IndigenousGroup }>(
  "./indigenous/*.json",
  { eager: true },
);

/** 16 族原住民代表點，依中文名排序方便清單瀏覽。 */
export const indigenousGroups: IndigenousGroup[] = Object.values(indigenousModules)
  .map((m) => m.default)
  .sort((a, b) => a.name.zh.localeCompare(b.name.zh, "zh-Hant"));

export const indigenousGroupById = new Map(indigenousGroups.map((g) => [g.id, g]));

export function getIndigenousGroup(id: string): IndigenousGroup | undefined {
  return indigenousGroupById.get(id);
}

const speciesModules = import.meta.glob<{ default: Species }>("./species/*.json", {
  eager: true,
});

export const speciesList: Species[] = Object.values(speciesModules)
  .map((m) => m.default)
  .sort((a, b) => a.name.zh.localeCompare(b.name.zh, "zh-Hant"));

export const speciesById = new Map(speciesList.map((s) => [s.id, s]));

export function getSpecies(id: string): Species | undefined {
  return speciesById.get(id);
}

/**
 * 註冊表驅動的地理要素說明（縣市、河流、山脈…）。
 *
 * 幾何在 public/data/geo 底下，這裡只有文字說明。**不是每個圖徵都需要內容檔**——
 * 查不到就由 FeatureCard 退回顯示 geojson 的 name 與圖層自己的說明。
 *
 * ## ⚠️ 這一組**不是** `import.meta.glob`，是延遲載入的分片
 *
 * 地點／原住民族／物種那三組加起來只有 51 份，而且**搜尋索引要同步讀得到**
 * （`searchIndex.ts` 的別名就是從那三組來的），所以它們仍然 eager。
 *
 * 地理要素相反：500 多份、原始檔 680 KB，而搜尋索引**一個字都沒用到**
 * （`searchIndex.ts` 只 import place／indigenous／species 三支）。原本 eager 的
 * 後果是主 chunk 的 gzip 多背一百多 KB，**每個進站的人都要付**——即使他只打開
 * 一個圖層、只點一張卡。所以改成由 `scripts/build-geo-content.mjs` 按 collection
 * 打包到 `public/data/geo-content/<collection>.json`，點開卡片才抓那一份
 * （比照古蹟歷史沿革的縣市分片與搜尋索引的 lazy 化）。
 *
 * ⚠️ **內容仍然寫在 `src/content/geo/`**，分片是產物、禁止手改；
 * `validate-content.mjs` 會逐 byte 比對，忘了跑 `npm run build:geo-content`
 * 就讓建置失敗。
 */
type GeoShard = Record<string, GeoFeature>;

/** collection → 分片。存 Promise 讓並發的呼叫共用同一次請求（比照 MonumentCard）。 */
const geoShardPromises = new Map<string, Promise<GeoShard | null>>();
/** 已經解析完成的分片。`getLoadedGeoFeature()` 只看這一份，所以它是同步的。 */
const geoShardsLoaded = new Map<string, GeoShard | null>();

export function loadGeoCollection(collection: string): Promise<GeoShard | null> {
  let promise = geoShardPromises.get(collection);
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}data/geo-content/${collection}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<GeoShard>) : null))
      .catch(() => null)
      .then((shard) => {
        geoShardsLoaded.set(collection, shard);
        return shard;
      });
    geoShardPromises.set(collection, promise);
  }
  return promise;
}

/**
 * 先把某個 collection 的說明抓起來放著。
 *
 * 呼叫時機是**圖層被勾選**而不是卡片被點開：那時候本來就在抓那一層的 geojson，
 * 順手多抓幾十 KB 幾乎感覺不到；等使用者真的點下去，卡片就不必先閃一段
 * 「說明載入中…」。沒有勾那一層的人一個 byte 都不會付，這正是分片的重點。
 */
export function prefetchGeoCollection(collection: string): void {
  void loadGeoCollection(collection);
}

/**
 * 同步取用**已經載入**的說明。
 *
 * ⚠️ 分片還沒到就回 `undefined`，跟「這個圖徵沒有內容檔」長得一模一樣。所以要
 * 渲染卡片請用 `useGeoFeature()`（它會等），這一支只給「還沒到就先不顯示也無所謂」
 * 的地方用——目前只有詳情面板的標題列。
 */
export function getLoadedGeoFeature(collection: string, id: string): GeoFeature | undefined {
  return geoShardsLoaded.get(collection)?.[id];
}

/**
 * 水庫即時水情由 build:reservoirs 產生成靜態 JSON，執行期只讀本地檔案。
 *
 * **不能在執行期打水利署的 API**：那個端點沒有 CORS 標頭（瀏覽器直接被擋），
 * 前面還掛著 bot 防護。比照氣候與物種資料的既有做法。
 *
 * 抓失敗回 null——呼叫端（registry/resolve.ts 的 tw-reservoirs）要能只用靜態
 * 幾何把圖層畫出來，水情缺就顯示「暫無資料」，不是整層消失。
 */
let reservoirLivePromise: Promise<ReservoirLive | null> | null = null;

export function loadReservoirLive(): Promise<ReservoirLive | null> {
  reservoirLivePromise ??= fetch(`${import.meta.env.BASE_URL}data/reservoirs-live.json`)
    .then((res) => (res.ok ? (res.json() as Promise<ReservoirLive>) : null))
    .catch(() => null);
  return reservoirLivePromise;
}

/**
 * 物種觀測點由 build:species 產生成靜態 GeoJSON，執行期只讀本地檔案，不打 GBIF。
 * 缺資料（尚未執行 build:species）就回傳 null，呼叫端要能處理這個情況。
 */
const speciesOccurrenceCache = new Map<string, Promise<SpeciesOccurrence | null>>();

export function loadSpeciesOccurrence(speciesId: string): Promise<SpeciesOccurrence | null> {
  const cached = speciesOccurrenceCache.get(speciesId);
  if (cached) return cached;

  const promise = fetch(`${import.meta.env.BASE_URL}data/species/${speciesId}.geojson`)
    .then((res) => (res.ok ? (res.json() as Promise<SpeciesOccurrence>) : null))
    .catch(() => null);

  speciesOccurrenceCache.set(speciesId, promise);
  return promise;
}
