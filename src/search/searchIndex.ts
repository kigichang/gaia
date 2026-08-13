import {
  getIndigenousGroup,
  getPlace,
  getSpecies,
} from "../content";
import { allLayers, layerInstanceId } from "../map/registry/index";
import { layerItems, resolveLayerData } from "../map/registry/resolve";
import type { LayerDefinition, ThemeDefinition } from "../map/registry/types";

/**
 * 主題頁搜尋框的索引。
 *
 * ⚠️ **這支必須放在 `src/map/registry/` 外面。** 註冊表的 `index.ts` 與
 * `themes/*.ts` 得維持 Node 可直接 import（`scripts/validate-content.mjs` 用
 * type stripping 載入它們做建置期交叉檢查），而這裡會 import `src/content`
 * （裡面是 `import.meta.glob`）與 `resolve.ts`，兩者都只能在瀏覽器跑。
 *
 * ## 索引哪些東西
 *
 * - **地物**：只索引「有 `browse` 設定」「有 `items`」或「來源是 `generated`」的
 *   ready 圖層。這條規則不是隨手挑的：
 *   - `browse` 本來就代表「這個圖層的圖徵是一份可以逐一點選的清單」，所以未來
 *     新圖層照常宣告 `browse` 就會自動進索引，不必回來改這裡。
 *   - 它同時把 `quakes` 擋在外面——那份 geojson 有 400 KB、2831 筆**沒有名稱**的
 *     點，它是密度場不是清單（見 global.ts 的說明）。索引它只會多抓一份大檔案
 *     然後產生 2831 筆搜不到的項目。
 * - **圖層本身**：所有 ready 圖層的名稱。搜「河流」也該找得到「世界主要河流」
 *   這個圖層，選了就把它打開。`planned` 的不列，因為勾不動。
 *
 * ## 為什麼是 lazy 的
 *
 * 建索引要抓 `tw-counties.geojson`(35 KB) 與 `world-rivers.geojson`(146 KB)。
 * 一個班 30 個學生同時開站時，這 181 KB 不該是每個人都無條件付的成本，所以
 * `buildSearchIndex()` 由搜尋框第一次獲得焦點時才呼叫。資料一律走
 * `resolveLayerData()`，與圖層顯示共用同一份 module-level 快取，不會抓兩次。
 */

export interface SearchHit {
  /** React key 與去重用 */
  key: string;
  /** feature = 單一圖徵；layer = 整個圖層 */
  kind: "feature" | "layer";
  title: string;
  /** 圖層名稱或分組，跨主題時 UI 另外加主題徽章 */
  subtitle: string;
  themeId: string;
  themeLabel: string;
  layerId: string;
  /** kind === "layer" 時為 undefined */
  featureId?: string;
  /** 子項目圖層（特有種）才有 */
  itemId?: string;
  /**
   * 附屬圖層（五大山脈 → 主峰）才有，值是附屬圖層的 instanceId。
   * 有它就代表這一筆的資料與詳情卡都在 `layer.attach` 上，不在圖層本身。
   */
  attachedId?: string;
  /** 已轉小寫的比對字串 */
  haystack: string;
}

/** 這個圖層的圖徵值不值得逐一索引。 */
function indexesFeatures(layer: LayerDefinition): boolean {
  if (layer.status !== "ready") return false;
  if (layer.items) return true;
  if (layer.browse) return true;
  return layer.source?.type === "generated";
}

function push(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** 內容檔裡的別名（英文名、學名、分布地…），讓搜尋不只比對得到中文主名。 */
function contentKeywords(
  layer: LayerDefinition,
  id: string,
  detail = layer.detail,
): (string | undefined)[] {
  switch (detail.type) {
    case "place": {
      const p = getPlace(id);
      return p ? [p.name.en, p.landform, p.koppen, p.curriculum.unit] : [];
    }
    case "indigenous": {
      const g = getIndigenousGroup(id);
      return g ? [g.name.en, g.language, ...g.mainDistribution] : [];
    }
    case "species": {
      const s = getSpecies(id);
      return s ? [s.name.en, s.name.latin, s.habitat, s.conservationStatus] : [];
    }
    default:
      return [];
  }
}

async function featureHits(
  theme: ThemeDefinition,
  layer: LayerDefinition,
): Promise<SearchHit[]> {
  // 子項目圖層（特有種）：一個勾選項就是一個搜尋結果，不展開成上千筆觀測點——
  // 觀測點的 properties 只有日期與紀錄類型，沒有名字可搜。
  if (layer.items) {
    return layerItems(layer).map((item) => ({
      key: `${theme.id}:${layer.id}:${item.id}`,
      kind: "feature" as const,
      title: item.label,
      subtitle: layer.label,
      themeId: theme.id,
      themeLabel: theme.label,
      layerId: layer.id,
      featureId: item.id,
      itemId: item.id,
      haystack: push([item.label, ...contentKeywords(layer, item.id)]),
    }));
  }

  if (!layer.source) return [];
  const fc = await resolveLayerData(layer.source);
  if (!fc) return [];

  const hits: SearchHit[] = [];

  // 附屬圖徵（五大山脈 → 主峰）也要搜得到：主峰以前在「地形景點」圖層裡、本來就
  // 進得了索引，搬家之後不補這一段，搜「玉山」就會突然找不到。
  if (layer.attach) {
    const attachFc = await resolveLayerData(layer.attach.source);
    for (const feature of attachFc?.features ?? []) {
      const props = feature.properties ?? {};
      if (typeof props.id !== "string" || typeof props.name !== "string") continue;
      hits.push({
        key: `${theme.id}:${layer.attach.id}:${props.id}`,
        kind: "feature",
        title: props.name,
        // 副標寫「五大山脈・主峰」，使用者才知道搜到的東西住在哪個勾選項底下
        subtitle: `${layer.label}・${layer.attach.label}`,
        themeId: theme.id,
        themeLabel: theme.label,
        layerId: layer.id,
        featureId: props.id,
        attachedId: layer.attach.id,
        haystack: push([
          props.name,
          typeof props.meta === "string" ? props.meta : undefined,
          ...contentKeywords(layer, props.id, layer.attach.detail),
        ]),
      });
    }
  }

  const seenNames = new Set<string>();
  for (const feature of fc.features) {
    const props = feature.properties ?? {};
    const id = props.id;
    const name = props.name;
    // 沒有 id 就選不了、沒有名字就搜不到，兩者缺一都直接跳過
    if (typeof id !== "string" || typeof name !== "string") continue;

    // 同名只留第一段。Natural Earth 把一條河拆成多個 LineString（`niger-0`、
    // `niger-1`…），照單全收的話搜「河」會出現一整排一模一樣的「尼羅河」。
    // 選到的是第一段而不是整條，這與圖層可點清單的既有行為一致。
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    hits.push({
      key: `${theme.id}:${layer.id}:${id}`,
      kind: "feature",
      title: name,
      subtitle: layer.label,
      themeId: theme.id,
      themeLabel: theme.label,
      layerId: layer.id,
      featureId: id,
      haystack: push([
        name,
        // 沿線標註用的短名也要能搜。這不是「順便多加一個欄位」：`shortName` 是
        // 這一層在地圖上實際印出來的字（「高鐵」「國道1」），而全名是
        // 「臺灣高速鐵路」——使用者看到什麼就會搜什麼，只索引 `name` 的話，
        // 搜最常用的俗名「高鐵」只搜得到圖層本身，而圖層結果是不開卡的。
        // 「國道」「南迴」剛好是全名的子字串才沒暴露這件事。
        typeof props.shortName === "string" ? props.shortName : undefined,
        typeof props.meta === "string" ? props.meta : undefined,
        ...contentKeywords(layer, id),
      ]),
    });
  }
  return hits;
}

function layerHit(theme: ThemeDefinition, layer: LayerDefinition): SearchHit {
  return {
    key: `layer:${theme.id}:${layer.id}`,
    kind: "layer",
    title: layer.label,
    // 只寫分組名就好，「這是圖層不是地物」由結果列上的徽章負責說
    subtitle: layer.group,
    themeId: theme.id,
    themeLabel: theme.label,
    layerId: layer.id,
    haystack: push([layer.label, layer.group, layer.description]),
  };
}

let indexPromise: Promise<SearchHit[]> | null = null;

/** 建立（或取回）全站索引。重複呼叫共用同一個 Promise。 */
export function buildSearchIndex(): Promise<SearchHit[]> {
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const ready = allLayers().filter(({ layer }) => layer.status === "ready");

    const featureLists = await Promise.all(
      ready
        .filter(({ layer }) => indexesFeatures(layer))
        .map(({ theme, layer }) => featureHits(theme, layer)),
    );

    return [
      ...featureLists.flat(),
      ...ready.map(({ theme, layer }) => layerHit(theme, layer)),
    ];
  })();

  return indexPromise;
}

const MAX_RESULTS = 12;

/**
 * 子字串比對 + 排序。
 *
 * 刻意不引入模糊比對依賴：中文沒有詞形變化，子字串比對已經涵蓋「濁水」→
 * 「濁水溪」這類真實輸入，而模糊比對在只有幾百筆的索引上只會製造雜訊。
 */
export function searchHits(
  index: SearchHit[],
  query: string,
  currentThemeId: string,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of index) {
    const title = hit.title.toLowerCase();
    let score: number;
    if (title === q) score = 0;
    else if (title.startsWith(q)) score = 1;
    else if (title.includes(q)) score = 2;
    else if (hit.haystack.includes(q)) score = 3;
    else continue;

    // 目前主題永遠排在跨主題結果前面：搜尋是「在這張地圖上找東西」，
    // 換主題是使用者要額外付出的代價，不該預設推到最上面。
    if (hit.themeId !== currentThemeId) score += 10;
    // 同分時圖徵優先於圖層：搜「河流」時「濁水溪」比「主要河川（圖層）」更像答案
    if (hit.kind === "layer") score += 4;
    scored.push({ hit, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.hit.title.localeCompare(b.hit.title, "zh-Hant"))
    .slice(0, MAX_RESULTS)
    .map((s) => s.hit);
}

/** 給 ThemeMapPage 用：把 hit 換算成 maplibre instance id。 */
export function hitInstanceId(hit: SearchHit): string {
  // 附屬圖徵的資料在附屬圖層那個 instance 上，不在母圖層的
  return hit.attachedId ?? layerInstanceId(hit.layerId, hit.itemId);
}
