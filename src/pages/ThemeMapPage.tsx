import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView, type OverlayState } from "../map/MapView";
import type { BasemapId } from "../map/basemaps";
import { LayerPanel } from "../components/LayerPanel";
import { LayerBrowseList } from "../components/LayerBrowseList";
import { MapLegend } from "../components/MapLegend";
import { PlaceCard } from "../components/PlaceCard";
import { IndigenousCard } from "../components/IndigenousCard";
import { SpeciesCard } from "../components/SpeciesCard";
import { FeatureCard } from "../components/FeatureCard";
import { DEFAULT_THEME_ID, getTheme, layerInstanceId } from "../map/registry/index";
import {
  colorOf,
  expandActive,
  layerItems,
  resolveLayerData,
  type ActiveState,
} from "../map/registry/resolve";
import type { DetailSpec, LayerDefinition, ThemeDefinition } from "../map/registry/types";
import { useGeoLayers, type GeoLayerInstance } from "../map/useGeoLayers";
import { bboxOf } from "../map/layers/geo";
import { getGeoFeature, getIndigenousGroup, getPlace, getSpecies } from "../content";

interface ThemeMapPageProps {
  overlays: OverlayState;
  basemap: BasemapId;
}

type Selection = { detail: DetailSpec; featureId: string } | null;

/**
 * 主題地圖頁：`/theme/:themeId`。
 *
 * 取代舊的 ExplorePage。整頁由 `src/map/registry` 的圖層註冊表驅動，
 * 加一個新主題或新圖層只要加一筆註冊表資料，不需要動這支元件。
 */
export function ThemeMapPage({ overlays, basemap }: ThemeMapPageProps) {
  const { themeId } = useParams();
  const theme = getTheme(themeId);
  if (!theme) return <Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />;
  return <ThemeMapView key="theme-map" theme={theme} overlays={overlays} basemap={basemap} />;
}

function ThemeMapView({
  theme,
  overlays,
  basemap,
}: {
  theme: ThemeDefinition;
  overlays: OverlayState;
  basemap: BasemapId;
}) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(() => defaultOnIds(theme));
  const [activeItemIds, setActiveItemIds] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Selection>(() => theme.initialSelection ?? null);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection | null>>({});

  const active = useMemo<ActiveState>(
    () => ({ layerIds: activeLayerIds, itemIds: activeItemIds }),
    [activeLayerIds, activeItemIds],
  );

  const { instances, pending } = useMemo(
    () => expandActive(theme, active, data),
    [theme, active, data],
  );

  // 缺哪些資料就去解析。key 已經寫進 data（即使結果是 null）之後就不會再要求，
  // 所以這裡不會無限循環。
  const pendingKey = pending.map((p) => p.key).join("|");
  useEffect(() => {
    for (const p of pending) {
      void resolveLayerData(p.source).then((fc) => {
        setData((prev) => (p.key in prev ? prev : { ...prev, [p.key]: fc }));
      });
    }
    // pending 每次算繪都是新陣列，只在「缺的東西變了」時才重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const handleSelect = useCallback((detail: DetailSpec, featureId: string) => {
    setSelected({ detail, featureId });
  }, []);

  // 切底圖之後由 MapView 明確回呼重套主題圖層（見 useGeoLayers 的說明）
  const reapplyLayers = useGeoLayers(map, instances, handleSelect);

  // 換主題：重設圖層開關與詳情卡，並把相機飛過去。
  //
  // ⚠️ 刻意**不用** key={themeId} 強制 remount：remount 會拆掉並重建 maplibre
  // 地圖，丟掉整份圖磚快取，而且每次導覽都會在 window.__gaiaMaps 累積一個新實例，
  // 讓文件裡的驗證指令拿到已經 remove() 掉的地圖。
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setActiveLayerIds(defaultOnIds(theme));
    setActiveItemIds({});
    setSelected(theme.initialSelection ?? null);
    map?.flyTo({ center: theme.camera.center, zoom: theme.camera.zoom, duration: 1200 });
  }, [theme, map]);

  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const toggleItem = useCallback((layerId: string, itemId: string) => {
    setActiveItemIds((prev) => {
      const current = prev[layerId] ?? [];
      const next = current.includes(itemId)
        ? current.filter((x) => x !== itemId)
        : [...current, itemId];
      return { ...prev, [layerId]: next };
    });
  }, []);

  /** 飛到某個圖徵：點的用 flyTo，線／面用 fitBounds。 */
  const flyToFeature = useCallback(
    (layer: LayerDefinition, featureId: string) => {
      if (!map) return;
      const instanceId = layer.items ? layerInstanceId(layer.id, featureId) : layer.id;
      const inst = instances.find((i) => i.instanceId === instanceId);
      const fc = inst?.data;
      if (!fc) return;

      if (layer.items) {
        // 子項目整份就是一個圖層（例如一個物種的所有觀測點），框住全部
        const bounds = bboxOf(fc);
        if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
        return;
      }

      const feature = fc.features.find((f) => f.properties?.id === featureId);
      if (!feature) return;

      if (feature.geometry.type === "Point") {
        const [lng, lat] = feature.geometry.coordinates;
        const zoom = Number(feature.properties?.zoom) || layer.browse?.zoom || 11;
        map.flyTo({ center: [lng, lat], zoom, duration: 1200 });
      } else {
        const bounds = bboxOf({ type: "FeatureCollection", features: [feature] });
        if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
      }
    },
    [map, instances],
  );

  const handleBrowseSelect = useCallback(
    (layer: LayerDefinition, featureId: string) => {
      setSelected({ detail: layer.detail, featureId });
      flyToFeature(layer, featureId);
    },
    [flyToFeature],
  );

  const handleItemNameClick = useCallback(
    (layerId: string, itemId: string) => {
      const layer = theme.layers.find((l) => l.id === layerId);
      if (!layer) return;
      setSelected({ detail: layer.detail, featureId: itemId });
      flyToFeature(layer, itemId);
    },
    [theme, flyToFeature],
  );

  // 子項目的圖徵數（特有種的觀測點筆數）
  const itemCounts = useMemo(() => {
    const counts: Record<string, number | undefined> = {};
    for (const layer of theme.layers) {
      if (!layer.items) continue;
      for (const item of layerItems(layer)) {
        if (!item.source) continue;
        const inst = instances.find(
          (i) => i.instanceId === layerInstanceId(layer.id, item.id),
        );
        counts[item.id] = inst?.data?.features.length;
      }
    }
    return counts;
  }, [theme, instances]);

  const legendEntries = useMemo(
    () =>
      theme.layers
        .filter((l) => l.status === "ready" && activeLayerIds.has(l.id))
        .flatMap((layer) => {
          if (layer.items) {
            const items = layerItems(layer);
            return (activeItemIds[layer.id] ?? [])
              .filter((id) => instances.some((i) => i.instanceId === layerInstanceId(layer.id, id) && i.data))
              .map((id, index) => ({
                key: `${layer.id}-${id}`,
                label: items.find((it) => it.id === id)?.label ?? id,
                color: layer.items!.palette[index % layer.items!.palette.length],
                kind: layer.render.kind,
                schematic: layer.schematic,
              }));
          }
          if (!layer.colorRole) return [];
          return [
            {
              key: layer.id,
              label: layer.label,
              color: colorOf(layer.colorRole),
              kind: layer.render.kind,
              schematic: layer.schematic,
            },
          ];
        }),
    [theme, activeLayerIds, activeItemIds, instances],
  );

  // 有 browse 設定、已勾選、資料已載入的圖層 → 顯示可點清單
  const browseLayers = theme.layers.filter(
    (l) => l.status === "ready" && l.browse && !l.items && activeLayerIds.has(l.id),
  );

  return (
    <div className="explore">
      <aside className="explore-side">
        <h2>{theme.label}</h2>
        <p className="theme-subtitle">{theme.subtitle}</p>

        <LayerPanel
          theme={theme}
          activeLayerIds={activeLayerIds}
          onToggleLayer={toggleLayer}
          activeItemIds={activeItemIds}
          onToggleItem={toggleItem}
          onItemNameClick={handleItemNameClick}
          itemCounts={itemCounts}
        />

        {browseLayers.map((layer) => {
          const fc = instances.find((i) => i.instanceId === layer.id)?.data;
          if (!fc) return null;
          return (
            <LayerBrowseList
              key={layer.id}
              data={fc}
              browse={layer.browse!}
              selectedId={
                selected && selected.detail.type === layer.detail.type
                  ? selected.featureId
                  : undefined
              }
              onSelect={(featureId) => handleBrowseSelect(layer, featureId)}
            />
          );
        })}

        <DetailCard
          selection={selected}
          itemCounts={itemCounts}
          theme={theme}
          instances={instances}
        />
      </aside>

      <div className="explore-main">
        <div className="map-canvas-wrap">
          <MapView
            className="map-canvas explore-canvas"
            initialCenter={theme.camera.center}
            initialZoom={theme.camera.zoom}
            basemap={basemap}
            overlays={overlays}
            onReady={setMap}
            onStyleApplied={reapplyLayers}
          />
          <MapLegend entries={legendEntries} />
        </div>
      </div>
    </div>
  );
}

function DetailCard({
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
    return <p className="detail-empty">點地圖上的圖徵或左側清單查看說明。</p>;
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
          name: typeof props?.[detail.fallbackNameProperty ?? "name"] === "string"
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

function defaultOnIds(theme: ThemeDefinition): Set<string> {
  return new Set(
    theme.layers.filter((l) => l.status === "ready" && l.defaultOn).map((l) => l.id),
  );
}
