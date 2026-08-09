import {
  indigenousGroups,
  loadSpeciesOccurrence,
  places,
  speciesList,
} from "../../content";
import { formatLatitude } from "../../compare/LatitudeSlider";
import { toFeatureCollection } from "../layers/geo";
import { LAYER_COLORS } from "../thematicColors";
import type { GeoLayerInstance } from "../useGeoLayers";
import { layerInstanceId } from "./index.ts";
import { generateLayer } from "./generators.ts";
import type {
  ColorRole,
  LayerDefinition,
  LayerItem,
  LayerSource,
  ThemeDefinition,
} from "./types.ts";

/**
 * 把註冊表的「標籤」解析成實際資料。
 *
 * ⚠️ 這支是**瀏覽器專用**的，跟 `./index.ts` 有一條明確的界線：
 * index.ts 必須維持 Node 可直接 import（validate-content.mjs 要載入它），
 * 所以任何需要 `import.meta.glob` 或內容資料的邏輯都只能放在這裡。
 */

/** 編譯期確保每個 ColorRole 都有對應色碼。 */
const COLORS: Record<ColorRole, string> = LAYER_COLORS;

// ── 已打包進 bundle 的內容 → GeoJSON ───────────────────────────────────
//
// 這裡也是側欄清單所需屬性（name／meta／zoom）附加上去的地方——
// 有了它，一個通用的清單元件就能取代 ExplorePage 裡兩份寫死的清單。

const BUNDLED_LOADERS = {
  "places-taiwan": () => placesCollection("taiwan"),
  "places-world": () => placesCollection("world"),
  indigenous: () =>
    toFeatureCollection(
      indigenousGroups,
      (g) => [g.representativeCoord.lng, g.representativeCoord.lat],
      (g) => g.id,
      (g) => ({ name: g.name.zh, meta: g.mainDistribution.join("、"), zoom: 10 }),
    ),
};

function placesCollection(region: "taiwan" | "world") {
  return toFeatureCollection(
    places.filter((p) => p.region === region),
    (p) => [p.coord.lng, p.coord.lat],
    (p) => p.id,
    (p) => ({
      name: p.name.zh,
      meta: `${formatLatitude(p.coord.lat)}・${p.landform}`,
      zoom: p.defaultZoom ?? 11,
    }),
  );
}

// ── 子項目清單 ─────────────────────────────────────────────────────────
//
// 特有種清單從 src/content/species/*.json 推導，不硬編在註冊表裡：
// 新增一個物種 JSON 就會自動出現在 UI。

const ITEM_LISTS = {
  species: (): LayerItem[] =>
    speciesList.map((s) => ({
      id: s.id,
      label: s.name.zh,
      source: { type: "remote", path: `data/species/${s.id}.geojson` },
    })),
};

export function layerItems(layer: LayerDefinition): LayerItem[] {
  if (!layer.items) return [];
  const { from } = layer.items;
  return from.type === "inline" ? from.list : ITEM_LISTS[from.collection]();
}

// ── 資料解析 ───────────────────────────────────────────────────────────

const cache = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();

const cacheKey = (source: LayerSource) =>
  source.type === "remote"
    ? `remote:${source.path}`
    : source.type === "bundled"
      ? `bundled:${source.content}`
      : `generated:${source.generator}`;

/**
 * 三種來源一律回傳 Promise，即使 bundled/generated 其實是同步的。
 *
 * 這不會有成本：`useGeoLayers` 在 map 還沒建立前什麼都不做，而 map 建立完成
 * （`load` 事件）遠晚於一個 microtask，所以同步來源不會有「先閃一下空白」的問題。
 * 換來的是呼叫端只有一條程式路徑。
 */
export function resolveLayerData(
  source: LayerSource,
): Promise<GeoJSON.FeatureCollection | null> {
  const key = cacheKey(source);
  const cached = cache.get(key);
  if (cached) return cached;

  let promise: Promise<GeoJSON.FeatureCollection | null>;
  if (source.type === "bundled") {
    promise = Promise.resolve(BUNDLED_LOADERS[source.content]());
  } else if (source.type === "generated") {
    promise = Promise.resolve(generateLayer(source.generator));
  } else if (source.path.startsWith("data/species/")) {
    // 走既有的 loadSpeciesOccurrence，沿用它的快取，避免同一份 geojson 抓兩次
    const speciesId = source.path.slice("data/species/".length).replace(/\.geojson$/, "");
    promise = loadSpeciesOccurrence(speciesId).then(
      (d) => d as GeoJSON.FeatureCollection | null,
    );
  } else {
    promise = fetch(`${import.meta.env.BASE_URL}${source.path}`)
      .then((res) => (res.ok ? (res.json() as Promise<GeoJSON.FeatureCollection>) : null))
      .catch(() => null);
  }

  cache.set(key, promise);
  return promise;
}

// ── 展開成 useGeoLayers 需要的 instances ──────────────────────────────

export interface ActiveState {
  /** 勾選的圖層 id */
  layerIds: Set<string>;
  /** 圖層 id → 勾選的子項目 id（依勾選順序，決定色票指派） */
  itemIds: Record<string, string[]>;
}

export interface PendingSource {
  key: string;
  source: LayerSource;
}

/**
 * 把「勾了哪些圖層」換算成圖層實例，並回報還缺哪些資料。
 *
 * 呼叫端拿 `pending` 去 `resolveLayerData()`，結果放進 `data` 再算一次——
 * 資料到齊時 instances 會自然帶上 data，`useGeoLayers` 就會把圖層加上去。
 */
export function expandActive(
  theme: ThemeDefinition,
  active: ActiveState,
  data: Record<string, GeoJSON.FeatureCollection | null | undefined>,
): { instances: GeoLayerInstance[]; pending: PendingSource[] } {
  const instances: GeoLayerInstance[] = [];
  const pending: PendingSource[] = [];

  const take = (source: LayerSource) => {
    const key = cacheKey(source);
    if (!(key in data)) pending.push({ key, source });
    return data[key] ?? null;
  };

  for (const layer of theme.layers) {
    if (layer.status !== "ready" || !active.layerIds.has(layer.id)) continue;

    if (layer.items) {
      const items = layerItems(layer);
      const selected = active.itemIds[layer.id] ?? [];
      selected.forEach((itemId, index) => {
        const item = items.find((it) => it.id === itemId);
        if (!item?.source) return;
        instances.push({
          instanceId: layerInstanceId(layer.id, item.id),
          render: layer.render,
          // 依勾選順序指派色票，這是多物種疊圖時分辨物種的唯一線索
          color: layer.items!.palette[index % layer.items!.palette.length],
          minzoom: layer.minzoom,
          maxzoom: layer.maxzoom,
          data: take(item.source),
          detail: layer.detail,
        });
      });
      continue;
    }

    instances.push({
      instanceId: layer.id,
      render: layer.render,
      color: COLORS[layer.colorRole],
      minzoom: layer.minzoom,
      maxzoom: layer.maxzoom,
      data: take(layer.source),
      detail: layer.detail,
    });
  }

  return { instances, pending };
}

/** 顏色角色查詢，給圖例與側欄色塊用。 */
export function colorOf(role: ColorRole): string {
  return COLORS[role];
}
