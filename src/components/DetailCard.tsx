import { PlaceCard } from "./PlaceCard";
import { IndigenousCard } from "./IndigenousCard";
import { SpeciesCard } from "./SpeciesCard";
import { FeatureCard } from "./FeatureCard";
import { ReservoirCard } from "./ReservoirCard";
import { MonumentCard } from "./MonumentCard";
import { TownshipCard } from "./TownshipCard";
import { QuakeCard } from "./QuakeCard";
import { getGeoFeature, getIndigenousGroup, getPlace, getSpecies } from "../content";
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
    // 找出這個圖徵屬於哪個圖層，好在沒有內容檔時退回顯示圖層自己的說明。
    // **附屬圖層也要找**（縣市界 → 縣市政府）：它不在 theme.layers 裡，漏掉的話
    // fallback 會拿不到名稱與說明，卡片標題會退化成 collection 這個內部字串。
    const owner = findGeoOwner(theme, detail.collection);
    /**
     * ⚠️ **不能只找 `instanceId === owner.id`。** 子項目圖層的 instance id 是
     * `<圖層 id>-<子項目 id>`（主要作物分布是 tw-crops-fruit／-vegetable／-tea），
     * 只比對圖層 id 會一個都對不到 → props 是 undefined → 卡片退化成「只有圖層
     * 標題與說明」，看起來像 fallback 正常運作，其實是查錯了地方。
     * 改成掃過所有指向同一個 collection 的 instance。
     */
    const props = instances
      .filter((i) => i.detail.type === "geo" && i.detail.collection === detail.collection)
      .flatMap((i) => i.data?.features ?? [])
      .find((f) => f.properties?.id === featureId)?.properties;
    return (
      <FeatureCard
        feature={getGeoFeature(detail.collection, featureId)}
        fallback={{
          name:
            typeof props?.[detail.fallbackNameProperty ?? "name"] === "string"
              ? String(props[detail.fallbackNameProperty ?? "name"])
              : undefined,
          meta: typeof props?.meta === "string" ? props.meta : undefined,
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
          layerLabel: owner?.label ?? detail.collection,
          /**
           * ⚠️ `hideLayerDescription` 的圖層（活動斷層）不印這一段：33 條斷層的卡片
           * 上那段字逐字相同，而且就是圖層抽屜那一列的說明。圖層層級的話全部留在
           * 抽屜（說明在核取方塊下面、資料限制在 ⚠️ 小視窗），卡片只講這一條斷層
           * 自己的事。見 registry/types.ts 的說明。
           */
          description: detail.hideLayerDescription || !owner ? "" : fullDescription(owner),
          sources: owner?.sources ?? [],
          schematic: owner?.schematic,
        }}
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
     * ⚠️ featureId 不是鄉鎮時要退回圖層說明，**不能回 `null`**。
     * `handleItemNameClick`（ThemeMapPage）在使用者點「果樹」這個**子項目名稱**時，
     * 傳的 featureId 是 `"fruit"`——那不是 TOWNCODE。回 null 的話畫面會是一張
     * 空白面板，而 `data-detail-open` 仍然是 true。
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
    const a = l.attach;
    if (a?.detail.type === "geo" && a.detail.collection === collection) {
      return {
        id: a.id,
        label: a.label,
        description: a.description ?? fullDescription(l),
        sources: a.sources ?? l.sources,
        schematic: l.schematic,
      };
    }
  }
  return undefined;
}

/** 詳情卡的標題（面板 head 用）。沒有對應內容時回 undefined。 */
export function detailTitle(selection: Selection): string | undefined {
  if (!selection) return undefined;
  const { detail, featureId } = selection;
  if (detail.type === "place") return getPlace(featureId)?.name.zh;
  if (detail.type === "indigenous") return getIndigenousGroup(featureId)?.name.zh;
  if (detail.type === "species") return getSpecies(featureId)?.name.zh;
  if (detail.type === "geo") return getGeoFeature(detail.collection, featureId)?.name.zh;
  return undefined;
}
