import {
  indigenousGroups,
  loadReservoirLive,
  loadSpeciesOccurrence,
  places,
  speciesList,
} from "../../content";
import { formatLatitude } from "../../compare/LatitudeSlider";
import { toFeatureCollection } from "../layers/geo";
import { LAYER_COLORS } from "../thematicColors";
import type { GeoLayerInstance } from "../useGeoLayers";
import { DERIVED_FILES, layerInstanceId } from "./index.ts";
import { generateLayer } from "./generators.ts";
import type {
  ColorRole,
  DerivedId,
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
// 這裡也是可點清單所需屬性（name／meta／zoom）附加上去的地方——
// 有了它，一個通用的清單元件就能取代 ExplorePage 裡兩份寫死的清單。

const BUNDLED_LOADERS = {
  /**
   * 地形景點（臺灣）。
   *
   * **排除五座主峰**：它們已經是「五大山脈」的附屬圖徵（`tw-range-peaks`），
   * 兩層同時開啟時會在完全相同的座標上疊出兩顆點，而點擊仲裁只會挑中其中一顆。
   * 歸屬關係讀自 `tw-ranges.geojson` 的 `peakId`——跟 `tw-range-peaks` 是同一份
   * 單一事實來源，不會漂開，也共用 `resolveLayerData` 的快取，不會多抓一次檔案。
   *
   * 抓不到山脈幾何時 `rangePeakToRange()` 回空 Map，於是這裡退回顯示全部地點
   * （含主峰）——比整層消失好，見那支函式的說明。
   */
  "places-taiwan": async () => {
    const peakToRange = await rangePeakToRange();
    return placesCollection("taiwan", (p) => !peakToRange.has(p.id));
  },
  "places-world": async () => placesCollection("world"),
  indigenous: async () =>
    toFeatureCollection(
      indigenousGroups,
      (g) => [g.representativeCoord.lng, g.representativeCoord.lat],
      (g) => g.id,
      (g) => ({ name: g.name.zh, meta: g.mainDistribution.join("、"), zoom: 10 }),
    ),
};

/** derived 來源依賴的檔案路徑一律取自 `DERIVED_FILES`（驗證器也讀同一份）。 */
const remote = (path: string): LayerSource => ({ type: "remote", path });

const RANGES_SOURCE = remote(DERIVED_FILES["tw-range-peaks"][0]);

/**
 * 主峰 id → 所屬山脈 id，取自 `tw-ranges.geojson` 的 `peakId`。
 *
 * 走 `resolveLayerData` 是刻意的：它跟「五大山脈」線圖層**共用同一個快取項目**，
 * 所以這裡不會多抓一次檔案（3.6 KB）。抓失敗回空 Map——那會讓地形景點退回顯示
 * 全部地點（含主峰），比整層消失好。
 */
async function rangePeakToRange(): Promise<Map<string, string>> {
  const fc = await resolveLayerData(RANGES_SOURCE);
  const map = new Map<string, string>();
  for (const f of fc?.features ?? []) {
    const peakId = f.properties?.peakId;
    const rangeId = f.properties?.id;
    if (typeof peakId === "string" && typeof rangeId === "string") map.set(peakId, rangeId);
  }
  return map;
}

const DERIVED_LOADERS: Record<
  DerivedId,
  () => Promise<GeoJSON.FeatureCollection | null>
> = {
  "tw-range-peaks": async () => {
    const peakToRange = await rangePeakToRange();
    if (peakToRange.size === 0) return null;
    return placesCollection(
      "taiwan",
      (p) => peakToRange.has(p.id),
      (p) => ({ rangeId: peakToRange.get(p.id)! }),
    );
  },

  /**
   * 水庫＝靜態幾何（位置、容量、壩高）＋ 即時水情（蓄水量、水位、進出流量）。
   *
   * 兩份資料的更新頻率差了四個數量級，所以分成兩個檔案、在這裡 join。
   *
   * ⚠️ **水情抓不到時仍然要回傳圖層**（只是每一座都沒有 `percent`）：
   * 圓點會畫成 ramp 的 nodata 灰、詳情卡顯示「暫無即時資料」。整層消失是最糟的
   * 失敗模式——使用者只會看到「水庫圖層壞了」，而基本資料其實好端端的。
   */
  "tw-reservoirs": async () => {
    const [fc, live] = await Promise.all([
      resolveLayerData(remote(DERIVED_FILES["tw-reservoirs"][0])),
      loadReservoirLive(),
    ]);
    if (!fc) return null;

    return {
      ...fc,
      features: fc.features.map((f) => {
        const props = f.properties ?? {};
        const status = typeof props.id === "string" ? live?.reservoirs[props.id] : undefined;
        return {
          ...f,
          properties: {
            ...props,
            // ⚠️ `percent` 只在真的有值時才寫進去。寫成 null 會讓算繪用的
            // `["has", "percent"]` 判成 true，於是「暫無資料」被畫成 0%——
            // 那是把資料缺漏謊報成水庫見底。
            ...(status?.percent != null && { percent: status.percent }),
            ...(status && {
              observedAt: status.observedAt,
              storage: status.storage,
              waterLevel_m: status.waterLevel_m,
              inflow_cms: status.inflow_cms,
              outflow_cms: status.outflow_cms,
              rainfall_mm: status.rainfall_mm,
            }),
            // 清單次標改成以水情為主——這一層的重點就是「現在還有多少水」
            meta:
              status?.percent != null
                ? `蓄水 ${status.percent}%・有效容量 ${props.capacityLabel}`
                : `暫無即時水情・有效容量 ${props.capacityLabel}`,
          },
        };
      }),
    };
  },
};

function placesCollection(
  region: "taiwan" | "world",
  keep: (p: (typeof places)[number]) => boolean = () => true,
  extra: (p: (typeof places)[number]) => Record<string, unknown> = () => ({}),
) {
  return toFeatureCollection(
    places.filter((p) => p.region === region && keep(p)),
    (p) => [p.coord.lng, p.coord.lat],
    (p) => p.id,
    (p) => ({
      name: p.name.zh,
      meta: `${formatLatitude(p.coord.lat)}・${p.landform}`,
      zoom: p.defaultZoom ?? 11,
      ...extra(p),
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
      : source.type === "derived"
        ? `derived:${source.derived}`
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
    promise = BUNDLED_LOADERS[source.content]();
  } else if (source.type === "derived") {
    promise = DERIVED_LOADERS[source.derived]();
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

    // 附屬圖徵沒有自己的核取方塊，母圖層勾了就一起上（見 types.ts 的 LayerAttachment）
    if (layer.attach) {
      instances.push({
        instanceId: layer.attach.id,
        render: layer.attach.render,
        color: COLORS[layer.attach.colorRole],
        // ⚠️ 縮放範圍刻意**不繼承**母圖層，見 types.ts 的 LayerAttachment
        minzoom: layer.attach.minzoom,
        maxzoom: layer.attach.maxzoom,
        data: take(layer.attach.source),
        detail: layer.attach.detail,
      });
    }
  }

  return { instances, pending };
}

/** 顏色角色查詢，給圖例與圖層抽屜的色塊用。 */
export function colorOf(role: ColorRole): string {
  return COLORS[role];
}
