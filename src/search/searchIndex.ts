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
  // 子項目圖層：每個勾選項本身就是一個搜尋結果（搜「臺灣黑熊」「國定古蹟」）。
  //
  // 預設**不展開**成圖徵：特有種的子項目 source 是觀測點 geojson，properties 只有
  // 日期與紀錄類型、沒有名字可搜，抓下來（五份共 262 KB）也產不出任何結果。
  // 需要展開的圖層要明確開 `items.indexFeatures`（目前只有古蹟，見 types.ts）。
  if (layer.items) {
    const items = layerItems(layer);
    const hits: SearchHit[] = items.map((item) => ({
      key: `${theme.id}:${layer.id}:${item.id}`,
      kind: "feature" as const,
      title: item.label,
      subtitle: layer.label,
      themeId: theme.id,
      themeLabel: theme.label,
      layerId: layer.id,
      featureId: item.id,
      itemId: item.id,
      /**
       * ⚠️ `item.keywords` 不是可有可無的。子項目靠 `featureIds` 從母圖層切分時
       * （交通軸線），圖徵本身不會被索引，於是**地圖上沿線印出來的那個短名進不了
       * haystack**——而使用者看到什麼就會搜什麼。「高鐵」不是「臺灣高速鐵路」的
       * 子字串，少了 keywords 就會搜不到（見 CLAUDE.md「搜尋索引」那節對
       * shortName 的要求）。
       */
      haystack: push([item.label, ...(item.keywords ?? []), ...contentKeywords(layer, item.id)]),
    }));
    if (!layer.items.indexFeatures) return hits;

    for (const item of items) {
      if (!item.source) continue;
      const fc = await resolveLayerData(item.source);
      for (const feature of fc?.features ?? []) {
        const props = feature.properties ?? {};
        // 比照下面一般圖層的規則：沒有 id 就選不了、沒有名字就搜不到
        if (typeof props.id !== "string" || typeof props.name !== "string") continue;
        hits.push({
          key: `${theme.id}:${layer.id}:${item.id}:${props.id}`,
          kind: "feature",
          title: props.name,
          // 副標寫「古蹟・國定古蹟」，使用者才知道搜到的東西住在哪個勾選項底下
          subtitle: `${layer.label}・${item.label}`,
          themeId: theme.id,
          themeLabel: theme.label,
          layerId: layer.id,
          featureId: props.id,
          // itemId 一定要帶：hitInstanceId() 靠它算出是哪一個子圖層的 instance
          itemId: item.id,
          haystack: push([
            props.name,
            typeof props.meta === "string" ? props.meta : undefined,
          ]),
        });
      }
    }
    return hits;
  }

  if (!layer.source) return [];
  const fc = await resolveLayerData(layer.source);
  if (!fc) return [];

  const hits: SearchHit[] = [];

  /**
   * 附屬圖徵（五大山脈 → 主峰）也要搜得到：主峰以前在「地形景點」圖層裡、本來就
   * 進得了索引，搬家之後不補這一段，搜「玉山」就會突然找不到。
   *
   * ⚠️ **但要跟一般圖層同一條規則：沒有 `browse` 就不索引。** 索引一份資料代表
   * 建索引時就得把它抓下來，而搜尋索引是 lazy 的（見檔頭）——颱風的中心定位點
   * 有 757 筆、118 KB，而且**沒有 `name`**，抓下來一筆搜尋結果也產不出來，
   * 等於讓每個學生白付那 118 KB。這跟特有種觀測點要靠 `items.indexFeatures`
   * 明確開啟是同一個判斷。
   */
  if (layer.attach?.browse) {
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
  /** hit.key → 該圖徵的 meta，給下面「撞名才補副標」那段用 */
  const metaOf = new Map<string, string | undefined>();
  for (const feature of fc.features) {
    const props = feature.properties ?? {};
    const id = props.id;
    const name = props.name;
    // 沒有 id 就選不了、沒有名字就搜不到，兩者缺一都直接跳過
    if (typeof id !== "string" || typeof name !== "string") continue;

    // 同名只留第一段。Natural Earth 把一條河拆成多個 LineString（`niger-0`、
    // `niger-1`…），照單全收的話搜「河」會出現一整排一模一樣的「尼羅河」。
    // 選到的是第一段而不是整條，這與圖層可點清單的既有行為一致。
    //
    // ⚠️ 但去重的 key 要**連 `meta` 一起**，不能只看名稱：同名不一定是同一個東西。
    // 鄉鎮市區有 8 個重複名（中正區、信義區、中山區、東區…）散在不同縣市，只看名稱
    // 的話搜「中正區」永遠只出得來一個，另一個**從此搜不到**，而且畫面上沒有任何
    // 線索說明為什麼。被拆段的河流不受影響：它們的 `meta` 全是 undefined，
    // 同名同 meta 仍然會被收斂成一筆（實測 world-rivers 的 24 個重複名全部如此）。
    const dedupeKey = `${name} ${typeof props.meta === "string" ? props.meta : ""}`;
    if (seenNames.has(dedupeKey)) continue;
    seenNames.add(dedupeKey);

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
        // 上游原生就有英文名時一起收（目前只有鄉鎮市區界的 TOWNENG）。
        // `contentKeywords` 只對 place／indigenous／species 這三種 detail 回傳別名，
        // detail.type === "geo" 的圖層拿不到任何別名，這一行是它們唯一的來源。
        typeof props.en === "string" ? props.en : undefined,
        typeof props.meta === "string" ? props.meta : undefined,
        ...contentKeywords(layer, id),
      ]),
    });
    metaOf.set(`${theme.id}:${layer.id}:${id}`, typeof props.meta === "string" ? props.meta : undefined);
  }

  /**
   * 同名的結果要把 `meta` 補進副標，否則畫面上是兩列**一模一樣**的字。
   *
   * 只對真的撞名的標題做，不是全部都加：鄉鎮市區界有 8 個重複名（中正區出現在
   * 臺北市與基隆市、東區有四個），不補的話使用者看到兩列「中正區／鄉鎮市區界」
   * 而無從選擇；但水庫的 `meta` 是「蓄水 62%・有效容量 …」這種長字串，沒撞名還
   * 硬加只會把副標塞爆。
   */
  const titleCount = new Map<string, number>();
  for (const hit of hits) titleCount.set(hit.title, (titleCount.get(hit.title) ?? 0) + 1);
  for (const hit of hits) {
    const meta = metaOf.get(hit.key);
    if (meta && (titleCount.get(hit.title) ?? 0) > 1) hit.subtitle = `${hit.subtitle}・${meta}`;
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

    /**
     * 鄉鎮市區界／人口與都市體系／主要作物分布三層共用同一個 featureId 與同一張
     * 詳情卡，所以同一個鄉鎮在索引裡最多會產生**五筆一模一樣的標題**（鄉鎮界 1 +
     * 人口 1 + 作物 3）。既然選哪一筆都開同一張卡，那五筆就只是雜訊——合併成一筆。
     *
     * 依 featureId 去重、保留第一筆。`ready` 的順序來自 `theme.layers`，鄉鎮市區界
     * 排在最前面，所以活下來的是它——選了會 `fitBounds` 到整個鄉鎮的面，比飛到一個
     * 形心點更適合「給我看這個鄉鎮」。
     *
     * ⚠️ 一般圖層自己那套 dedup（`seenNames`）**跨不了圖層**（每次呼叫都新建），
     * 而子項目那條分支根本沒有 dedup，所以這件事只能在這裡做。
     */
    const townshipLayers = new Set(
      ready
        .filter(({ layer }) => layer.detail.type === "township")
        .map(({ theme, layer }) => `${theme.id}:${layer.id}`),
    );
    const seenTownship = new Set<string>();
    const features = featureLists.flat().filter((hit) => {
      // ⚠️ 子項目**本身**那幾筆（「果樹」「蔬菜」「茶」）不是鄉鎮，一定要留著，
      // 否則搜「茶」就找不到那個子圖層了。它們的辨識特徵是 featureId === itemId。
      if (!townshipLayers.has(`${hit.themeId}:${hit.layerId}`)) return true;
      if (!hit.featureId || hit.featureId === hit.itemId) return true;
      const key = `${hit.themeId}:${hit.featureId}`;
      if (seenTownship.has(key)) return false;
      seenTownship.add(key);
      return true;
    });

    return [...features, ...ready.map(({ theme, layer }) => layerHit(theme, layer))];
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
