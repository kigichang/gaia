import { PlaceCard } from "./PlaceCard";
import { IndigenousCard } from "./IndigenousCard";
import { SpeciesCard } from "./SpeciesCard";
import { FeatureCard } from "./FeatureCard";
import { ReservoirCard } from "./ReservoirCard";
import { MonumentCard } from "./MonumentCard";
import { TownshipCard } from "./TownshipCard";
import { QuakeCard, quakeTitle } from "./QuakeCard";
import { useEffect, useState } from "react";
import {
  getIndigenousGroup,
  getLoadedGeoFeature,
  getPlace,
  getSpecies,
  loadGeoCollection,
} from "../content";
import { useGeoFeature } from "../content/useGeoContent";
import type { DetailSpec, LayerDefinition, ThemeDefinition } from "../map/registry/types";
import type { GeoLayerInstance } from "../map/useGeoLayers";

/** 目前選取的圖徵。`detail` 決定要拿哪一種內容來渲染，`featureId` 是它的 id。 */
export type Selection = { detail: DetailSpec; featureId: string } | null;

/**
 * 把一筆選取轉成對應的詳情卡。
 *
 * 從 `ThemeMapPage` 搬出來的（原本是同檔案內的區域元件），行為完全沒變——
 * 主題頁改成滿版之後那支檔案已經夠長了，而這一段跟版面完全無關。
 */
export function DetailCard({
  selection,
  itemCounts,
  theme,
  instances,
}: {
  selection: Selection;
  itemCounts: Record<string, number | undefined>;
  theme: ThemeDefinition;
  instances: GeoLayerInstance[];
}) {
  if (!selection) {
    return <p className="detail-empty">點地圖上的圖徵或清單查看說明。</p>;
  }

  const { detail, featureId } = selection;
  if (detail.type === "geo") {
    return (
      <GeoDetailCard
        spec={detail}
        featureId={featureId}
        theme={theme}
        instances={instances}
      />
    );
  }
  if (detail.type === "township") {
    /**
     * 鄉鎮市區界／人口／作物三層共用的卡片。三層的 featureId 都是官方 TOWNCODE，
     * 所以這裡不必知道使用者點的是哪一層——`TownshipCard` 會自己把五份資料抓齊。
     *
     * `seed` 是從**已勾選**圖層撿到的 properties，只為了讓標題在抓取完成前先出現。
     * 撿不到（三層都沒勾、純粹從搜尋跳過來）也沒關係，卡片會等資料到。
     */
    const owners = theme.layers.filter((l) => l.detail.type === "township");
    const seed = instances
      .filter((i) => i.detail.type === "township")
      .flatMap((i) => i.data?.features ?? [])
      .find((f) => f.properties?.id === featureId)?.properties ?? undefined;

    /**
     * ⚠️ featureId 不是鄉鎮時要退回圖層說明，**不能回 `null`**——回 null 的話畫面
     * 會是一張空白面板，而 `data-detail-open` 仍然是 true。
     *
     * 當初是為了「點『果樹』這個**子項目名稱**」而加的（`handleItemNameClick` 傳的
     * featureId 是 `"fruit"`，那不是 TOWNCODE）。那條路徑現在走 `items.detail`
     * 的作物說明卡了，所以這裡是**守衛而不是主要路徑**——但不要拿掉：這一層有
     * 三個子項目、五份資料與三個共用同一組 featureId 的圖層，任何一條新路徑傳進
     * 一個非 TOWNCODE 的 id，症狀都是一張完全靜默的空白面板。
     */
    if (!/^tw-\d+$/.test(featureId)) {
      const owner = owners.find((l) => l.items) ?? owners[0];
      return (
        <FeatureCard
          fallback={{
            layerLabel: owner?.label ?? "鄉鎮市區",
            description: owner ? fullDescription(owner) : "",
            sources: owner?.sources ?? [],
          }}
        />
      );
    }

    return (
      <TownshipCard
        featureId={featureId}
        seed={seed}
        // 卡片依**實際畫出來的區塊**挑署名，所以這裡給的是「圖層 id → sources」
        // 的對照，不是先取好的聯集（見 TownshipCard 的說明）
        sourcesByLayer={Object.fromEntries(owners.map((l) => [l.id, l.sources]))}
      />
    );
  }
  if (detail.type === "quake") {
    /**
     * ⚠️ 這裡找的是**整個 feature**，不是只有 properties：震央的經緯度就是幾何本身
     * （存進 properties 等於把座標寫兩份），見 registry/types.ts 的說明。
     *
     * ⚠️ **有兩個圖層是 `quake`**（臺灣地震、重大地震），而且重大地震那 92 筆跟母
     * 圖層**共用同一個 id**（那是連動強調要的）。所以不能像水庫那樣 `find` 第一個
     * 符合的圖層——那會讓點重大地震時拿到母圖層的 feature（沒有地名與災害情形）
     * 與母圖層的說明，卡片退化成「規模 7.7 地震」而不是「南投集集地震」。
     * 這跟 `findGeoOwner` 只回第一個符合圖層是同一類的坑。
     *
     * 規則：**兩層都找，有 `name` 的那一筆優先**（那就是重大地震那一層——母圖層的
     * 震央沒有名字）。
     */
    const owners = theme.layers.filter((l) => l.detail.type === "quake");
    const hits = owners
      .map((layer) => ({
        layer,
        feature: instances
          .find((i) => i.instanceId === layer.id)
          ?.data?.features.find((f) => f.properties?.id === featureId),
      }))
      .filter((h): h is { layer: LayerDefinition; feature: GeoJSON.Feature } => Boolean(h.feature));
    const best = hits.find((h) => h.feature.properties?.name) ?? hits[0];
    /**
     * ⚠️ 刻意**不傳圖層說明**：那段字在 762 個震央上逐字相同，而且跟圖層抽屜那一列
     * 重複。圖層層級的話留在抽屜（說明在核取方塊下面、資料限制在 ⚠️ 小視窗），卡片
     * 只講這一次地震自己的事。見 `QuakeCard` 的說明。
     */
    return best ? <QuakeCard feature={best.feature} sources={best.layer.sources} /> : null;
  }
  if (detail.type === "reservoir") {
    // 水庫沒有內容檔，卡片的資料就在圖層的 geojson 裡（基本資料 + join 進來的
    // 即時水情）。找不到 instance 代表圖層剛好還沒載完，這時不要算繪空卡。
    const owner = theme.layers.find((l) => l.detail.type === "reservoir");
    const fc = instances.find((i) => i.instanceId === owner?.id)?.data;
    const props = fc?.features.find((f) => f.properties?.id === featureId)?.properties;
    return props ? <ReservoirCard properties={props} /> : null;
  }
  if (detail.type === "monument") {
    // 古蹟同樣沒有內容檔，資料在 geojson 裡。但它是 items 圖層，**三個級別各是一個
    // instance**（tw-monuments-national／-municipal／-county），所以不能像水庫那樣
    // 用單一 owner.id 去找——要掃過所有古蹟 instance。
    const props = instances
      .filter((i) => i.detail.type === "monument")
      .flatMap((i) => i.data?.features ?? [])
      .find((f) => f.properties?.id === featureId)?.properties;
    return props ? <MonumentCard properties={props} /> : null;
  }
  if (detail.type === "place") {
    const place = getPlace(featureId);
    return place ? <PlaceCard place={place} /> : null;
  }
  if (detail.type === "indigenous") {
    const group = getIndigenousGroup(featureId);
    return group ? <IndigenousCard group={group} /> : null;
  }
  if (detail.type === "species") {
    const species = getSpecies(featureId);
    return species ? (
      <SpeciesCard species={species} occurrenceCount={itemCounts[featureId]} />
    ) : null;
  }
  return null;
}

/**
 * 圖層說明的完整文字＝`description` + 所有 `notes`。
 *
 * 圖層抽屜把兩者分開（警語收進圖層名稱旁邊的 ⚠️ 小視窗，讓那份長清單捲得動），
 * 但**詳情卡不分**：這張卡是沒有內容檔的圖徵唯一看得到說明的地方，把資料限制
 * 藏起來會違反「不得暗示精確性」的既有承諾。分開只是抽屜的排版手段，不是可以
 * 少講一半的授權。
 */
function fullDescription(layer: { description: string; notes?: string[] }) {
  return layer.notes?.length ? [layer.description, ...layer.notes].join("") : layer.description;
}

/**
 * 哪個圖層（或附屬圖層）擁有這個 geo collection。
 *
 * 附屬圖層沒有自己的 `description`／`sources`，沒填就沿用母圖層的——它們本來就是
 * 同一個勾選項底下的東西，來源與說明多半一致。
 */
function findGeoOwner(theme: ThemeDefinition, collection: string) {
  for (const l of theme.layers) {
    if (l.detail.type === "geo" && l.detail.collection === collection) {
      return {
        id: l.id,
        label: l.label,
        description: fullDescription(l),
        sources: l.sources,
        schematic: l.schematic,
      };
    }
    /**
     * 子項目自己的詳情卡（古蹟三級的定義，見 registry/types.ts 的 `LayerItems.detail`）。
     * 母圖層的 `detail` 是 `monument`、對不到這個 collection，不看這裡的話 fallback
     * 會拿不到圖層標題與來源，卡片會退化成用 collection 這個內部字串當標題。
     */
    if (l.items?.detail?.type === "geo" && l.items.detail.collection === collection) {
      return {
        id: l.id,
        label: l.label,
        description: fullDescription(l),
        sources: l.sources,
        schematic: l.schematic,
      };
    }
    const a = l.attach;
    if (a?.detail.type === "geo" && a.detail.collection === collection) {
      return {
        id: a.id,
        label: a.label,
        description: a.description ?? fullDescription(l),
        sources: a.sources ?? l.sources,
        // ⚠️ 附屬圖徵可以不是示意的（世界主要山脈的中軸線是算出來的，主峰卻是
        // 上游的真實座標），所以這裡讓 attach 覆蓋得掉，見 registry/types.ts
        schematic: a.schematic ?? l.schematic,
      };
    }
  }
  return undefined;
}

/**
 * 地理要素的詳情卡。
 *
 * ⚠️ **它必須是一個獨立的元件，不能寫回 `DetailCard` 的 if 分支裡。** 說明改成
 * 延遲載入之後這裡要用 hook（`useGeoFeature`），而 `DetailCard` 對每一種
 * `detail.type` 都是提早 return 的——在那種位置呼叫 hook 會違反 hooks 規則。
 */
function GeoDetailCard({
  spec,
  featureId,
  theme,
  instances,
}: {
  spec: Extract<DetailSpec, { type: "geo" }>;
  featureId: string;
  theme: ThemeDefinition;
  instances: GeoLayerInstance[];
}) {
  const { feature, loading } = useGeoFeature(spec.collection, featureId);
  // 找出這個圖徵屬於哪個圖層，好在沒有內容檔時退回顯示圖層自己的說明。
  // **附屬圖層也要找**（縣市界 → 縣市政府）：它不在 theme.layers 裡，漏掉的話
  // fallback 會拿不到名稱與說明，卡片標題會退化成 collection 這個內部字串。
  const owner = findGeoOwner(theme, spec.collection);
  /**
   * ⚠️ **不能只找 `instanceId === owner.id`。** 子項目圖層的 instance id 是
   * `<圖層 id>-<子項目 id>`（主要作物分布是 tw-crops-fruit／-vegetable／-tea），
   * 只比對圖層 id 會一個都對不到 → props 是 undefined → 卡片退化成「只有圖層
   * 標題與說明」，看起來像 fallback 正常運作，其實是查錯了地方。
   * 改成掃過所有指向同一個 collection 的 instance。
   */
  const props = instances
    .filter((i) => i.detail.type === "geo" && i.detail.collection === spec.collection)
    .flatMap((i) => i.data?.features ?? [])
    .find((f) => f.properties?.id === featureId)?.properties;
  return (
    <FeatureCard
      feature={feature}
      loading={loading}
      fallback={{
        name:
          typeof props?.[spec.fallbackNameProperty ?? "name"] === "string"
            ? String(props[spec.fallbackNameProperty ?? "name"])
            : undefined,
        meta: typeof props?.meta === "string" ? props.meta : undefined,
        // 原始外文名（世界主要河流與全球活火山都靠它才顯示得出原名）
        en: typeof props?.en === "string" ? props.en : undefined,
        /**
         * ⚠️ 兩個屬性名都要讀。`detail` 是這個欄位本來的名字（`FeatureCard`
         * 的 prop 就叫這個），臺灣河川用它放公告的管理等級；`top` 是主要作物
         * 分布先前用的名字（那個鄉鎮種最多的前三種）。
         *
         * 之所以不統一成一個：`tw-crops-*.geojson` 是產物，改個 key 就得重跑
         * `build:geodata` 去打農情調查的 API 逐縣市重抓一次——為了一個屬性名
         * 付那個代價不值得。**新圖層一律用 `detail`。**
         */
        detail:
          typeof props?.detail === "string"
            ? props.detail
            : typeof props?.top === "string"
              ? props.top
              : undefined,
        layerLabel: owner?.label ?? spec.collection,
        /**
         * ⚠️ `hideLayerDescription` 的圖層（活動斷層）不印這一段：37 條斷層的卡片
         * 上那段字逐字相同，而且就是圖層抽屜那一列的說明。圖層層級的話全部留在
         * 抽屜（說明在核取方塊下面、資料限制在 ⚠️ 小視窗），卡片只講這一條斷層
         * 自己的事。見 registry/types.ts 的說明。
         */
        description: spec.hideLayerDescription || !owner ? "" : fullDescription(owner),
        sources: owner?.sources ?? [],
        schematic: owner?.schematic,
      }}
    />
  );
}

/**
 * 從已載入的圖層裡撈出「這個 `detail.type` 底下、id 相符」的那些 feature。
 *
 * 古蹟、水庫、地震、鄉鎮這四種卡片沒有內容檔，資料就在圖層的 geojson 裡，所以
 * 標題也只能從那裡拿。⚠️ 用 `detail.type` 而不是圖層 id 是必要的：古蹟是三個
 * instance（國定／直轄市定／縣市定）、地震是兩個（臺灣地震／重大地震）、鄉鎮是
 * 五個（鄉鎮界／人口／三種作物），拿單一 owner.id 去找一定會漏。
 */
function featuresIn(
  instances: GeoLayerInstance[],
  type: DetailSpec["type"],
  featureId: string,
): GeoJSON.Feature[] {
  return instances
    .filter((i) => i.detail.type === type)
    .flatMap((i) => i.data?.features ?? [])
    .filter((f) => f.properties?.id === featureId);
}

/** geojson 的 `name`，空字串當成沒有。 */
function featureName(f: GeoJSON.Feature | undefined): string | undefined {
  const v = f?.properties?.name;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * 詳情卡的標題（面板 head 用）。沒有對應內容時回 undefined。
 *
 * ⚠️ **它是 hook 不是純函式**，而且必須在 `ThemeMapPage` 的**本體**呼叫、不能寫進
 * `{detailOpen && …}` 那段 JSX 裡（條件式呼叫 hook 會壞）。
 *
 * 之所以要是 hook：地理要素的說明改成延遲載入之後（見 `content/index.ts`），第一次
 * 開某個 collection 的卡片時分片可能還沒到，同步查一定是 undefined——而純函式版本
 * **不會在分片到了之後重新算**，標題就會一直空著。這裡等分片落地再逼一次重繪。
 *
 * ⚠️ **`instances` 是必要的參數，不是可有可無的優化。** 古蹟、水庫、地震、鄉鎮四種
 * 卡片沒有內容檔，名字只存在於圖層的 geojson 裡；在補進來之前，這支對它們一律回
 * `undefined`，面板最上面那條標題列因此**一直是空白的**（卡片本體正常，所以很容易
 * 一直沒被發現）。
 */
export function useDetailTitle(
  selection: Selection,
  instances: GeoLayerInstance[],
): string | undefined {
  const collection = selection?.detail.type === "geo" ? selection.detail.collection : null;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!collection) return;
    let cancelled = false;
    void loadGeoCollection(collection).then(() => {
      if (!cancelled) bump((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  if (!selection) return undefined;
  const { detail, featureId } = selection;
  if (detail.type === "place") return getPlace(featureId)?.name.zh;
  if (detail.type === "indigenous") return getIndigenousGroup(featureId)?.name.zh;
  if (detail.type === "species") return getSpecies(featureId)?.name.zh;
  if (detail.type === "geo") {
    /**
     * ⚠️ **內容檔不存在時要退回 geojson 的 `name`**，不能直接回 undefined。
     *
     * 這一條在「只有部分圖徵寫了內容檔」的圖層上才看得出來：世界主要河流有 118 筆、
     * 目前 33 筆有說明卡，退回之前點尼羅河有標題、點隔壁的「尼羅河（艾伯特段）」
     * 標題列就是**空白**的——而卡片本體照樣走 `FeatureCard` 的 fallback 顯示得好好的
     * （名稱、圖層說明、來源都在），所以畫面上看起來只像「這一列的標題忘了畫」。
     *
     * `FeatureCard` 的標題本來就是 `feature?.name.zh ?? fallback.name`，這裡補的是
     * 同一條規則的另一半，讓面板頭與卡片標題永遠一致。
     */
    return (
      getLoadedGeoFeature(detail.collection, featureId)?.name.zh ??
      featureName(featuresIn(instances, "geo", featureId)[0])
    );
  }

  /**
   * 以下四種沒有內容檔，名字在 geojson 裡（見 `featuresIn`）。
   *
   * ⚠️ **它們不需要 hook 那一段的重繪**：這些卡片讀的就是 `instances`，而 `instances`
   * 本身是 state——資料到了 React 自然會重算，標題跟著出現。要靠 `bump()` 的只有
   * 走延遲載入分片的 `geo`。
   *
   * ⚠️ 撈不到就回 `undefined`（面板頭留白），不要塞「鄉鎮市區」這種佔位字：那會在
   * 資料還沒到的一瞬間先印一個錯的名字，比留白更糟。
   */
  if (detail.type === "township" || detail.type === "reservoir" || detail.type === "monument") {
    return featureName(featuresIn(instances, detail.type, featureId)[0]);
  }
  if (detail.type === "quake") {
    /**
     * ⚠️ 兩個地震圖層**共用同一組 featureId**（連動強調要的），而母圖層那 612 筆
     * 沒有地名。規則跟 `DetailCard` 的 quake 分支一樣：**有 `name` 的那一筆優先**，
     * 否則退回規模——標題本身直接用 `QuakeCard` 匯出的同一支 `quakeTitle()`，
     * 免得面板頭與卡片標題分歧。
     */
    const hits = featuresIn(instances, "quake", featureId);
    const best = hits.find((f) => featureName(f)) ?? hits[0];
    return best ? quakeTitle(best.properties) : undefined;
  }
  return undefined;
}
