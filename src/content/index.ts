import type { Climate, IndigenousGroup, Place, Species, SpeciesOccurrence } from "../lib/schema";

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
