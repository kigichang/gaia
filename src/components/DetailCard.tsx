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
    // 找出這個圖徵屬於哪個圖層，好在沒有內容檔時退回顯示圖層自己的說明
    const layer = theme.layers.find(
      (l) => l.detail.type === "geo" && l.detail.collection === detail.collection,
    );
    const fc = instances.find((i) => i.instanceId === layer?.id)?.data;
    const props = fc?.features.find((f) => f.properties?.id === featureId)?.properties;
    return (
      <FeatureCard
        feature={getGeoFeature(detail.collection, featureId)}
        fallback={{
          name:
            typeof props?.[detail.fallbackNameProperty ?? "name"] === "string"
              ? String(props[detail.fallbackNameProperty ?? "name"])
              : undefined,
          layerLabel: layer?.label ?? detail.collection,
          description: layer?.description ?? "",
          sources: layer?.sources ?? [],
          schematic: layer?.schematic,
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
