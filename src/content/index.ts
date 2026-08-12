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
 */
const geoFeatureModules = import.meta.glob<{ default: GeoFeature }>("./geo/*/*.json", {
  eager: true,
});

const geoFeatureByKey = new Map(
  Object.values(geoFeatureModules).map((m) => [
    `${m.default.collection}/${m.default.id}`,
    m.default,
  ]),
);

export function getGeoFeature(collection: string, id: string): GeoFeature | undefined {
  return geoFeatureByKey.get(`${collection}/${id}`);
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
