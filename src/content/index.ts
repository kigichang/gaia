import type { Climate, Place } from "../lib/schema";

/**
 * 載入所有地點資料。
 *
 * 這裡直接把 JSON 當成 Place 使用而不在瀏覽器端跑 zod 驗證——
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
