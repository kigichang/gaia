import { PlaceCard } from "./PlaceCard";
import { IndigenousCard } from "./IndigenousCard";
import { SpeciesCard } from "./SpeciesCard";
import { FeatureCard } from "./FeatureCard";
import { getGeoFeature, getIndigenousGroup, getPlace, getSpecies } from "../content";
import type { DetailSpec, ThemeDefinition } from "../map/registry/types";
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
    const fc = instances.find((i) => i.instanceId === owner?.id)?.data;
    const props = fc?.features.find((f) => f.properties?.id === featureId)?.properties;
    return (
      <FeatureCard
        feature={getGeoFeature(detail.collection, featureId)}
        fallback={{
          name:
            typeof props?.[detail.fallbackNameProperty ?? "name"] === "string"
              ? String(props[detail.fallbackNameProperty ?? "name"])
              : undefined,
          meta: typeof props?.meta === "string" ? props.meta : undefined,
          layerLabel: owner?.label ?? detail.collection,
          description: owner?.description ?? "",
          sources: owner?.sources ?? [],
          schematic: owner?.schematic,
        }}
      />
    );
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
        description: l.description,
        sources: l.sources,
        schematic: l.schematic,
      };
    }
    const a = l.attach;
    if (a?.detail.type === "geo" && a.detail.collection === collection) {
      return {
        id: a.id,
        label: a.label,
        description: a.description ?? l.description,
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
