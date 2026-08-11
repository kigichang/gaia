import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView } from "../map/MapView";
import { LayerPanel } from "../components/LayerPanel";
import { MapLegend } from "../components/MapLegend";
import { AppMenu } from "../components/AppMenu";
import { MapLayersPopover } from "../components/MapLayersPopover";
import { LayerDrawer } from "../components/LayerDrawer";
import { MapDetailPanel } from "../components/MapDetailPanel";
import { DetailCard, detailTitle, type Selection } from "../components/DetailCard";
import { browseSlots, useBrowseMode } from "../components/ThemeBrowse";
import { DEFAULT_THEME_ID, getTheme, layerInstanceId } from "../map/registry/index";
import {
  colorOf,
  expandActive,
  layerItems,
  resolveLayerData,
  type ActiveState,
} from "../map/registry/resolve";
import type { DetailSpec, LayerDefinition, ThemeDefinition } from "../map/registry/types";
import { useGeoLayers } from "../map/useGeoLayers";
import { useDrawerOpen } from "../useDrawerOpen";
import { bboxOf } from "../map/layers/geo";
import type { ChromeState } from "../chrome";

interface ThemeMapPageProps {
  chrome: ChromeState;
}

/**
 * 主題地圖頁：`/theme/:themeId`。
 *
 * 整頁由 `src/map/registry` 的圖層註冊表驅動，加一個新主題或新圖層只要加一筆
 * 註冊表資料，不需要動這支元件。
 *
 * 版面是滿版地圖 + 浮動控制（仿 Google Map）：左上 ☰ 圖層抽屜、右上 ⋮⋮⋮ 主題與
 * 外觀選單、左下圖例與「圖層」磚、點圖徵從左側開詳情面板。細節與那幾條硬規則
 * 見 CLAUDE.md 的「全螢幕地圖外框與浮動控制」。
 */
export function ThemeMapPage({ chrome }: ThemeMapPageProps) {
  const { themeId } = useParams();
  const theme = getTheme(themeId);
  if (!theme) return <Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />;
  return <ThemeMapView key="theme-map" theme={theme} chrome={chrome} />;
}

function ThemeMapView({ theme, chrome }: { theme: ThemeDefinition; chrome: ChromeState }) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(() => defaultOnIds(theme));
  const [activeItemIds, setActiveItemIds] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Selection>(() => theme.initialSelection ?? null);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection | null>>({});
  const { open: drawerOpen, setOpen: setDrawerOpen, closeTransient } = useDrawerOpen();
  const browseMode = useBrowseMode();

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

  // 抽屜疊在詳情面板之上，所以一旦選了圖徵就得把抽屜收起來，否則剛開出來的
  // 詳情卡會被整片蓋住。用 closeTransient 而不是 setOpen(false)：這是系統替
  // 使用者做的決定，不可以覆寫他自己記在 localStorage 裡的偏好。
  const handleSelect = useCallback(
    (detail: DetailSpec, featureId: string) => {
      setSelected({ detail, featureId });
      closeTransient();
    },
    [closeTransient],
  );

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
      closeTransient();
      flyToFeature(layer, featureId);
    },
    [flyToFeature, closeTransient],
  );

  const handleItemNameClick = useCallback(
    (layerId: string, itemId: string) => {
      const layer = theme.layers.find((l) => l.id === layerId);
      if (!layer) return;
      setSelected({ detail: layer.detail, featureId: itemId });
      closeTransient();
      flyToFeature(layer, itemId);
    },
    [theme, flyToFeature, closeTransient],
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

  // 可點清單的兩種擺法（A/B 測試中），見 ThemeBrowse.tsx
  const dataOf = useCallback(
    (layerId: string) => instances.find((i) => i.instanceId === layerId)?.data ?? null,
    [instances],
  );
  const slots = browseSlots({
    mode: browseMode,
    layers: browseLayers,
    dataOf,
    selected,
    onSelect: handleBrowseSelect,
    onBackToList: () => setSelected(null),
  });

  const detailOpen = Boolean(selected) || slots.panelOpenWithoutSelection;

  return (
    // data-* 驅動 --left-panel-w／--bottom-sheet-h，浮動控制靠這兩個屬性讓開，
    // 不准有第二條硬寫 left/bottom 的規則（見 styles.css 的說明）。
    <div className="map-shell" data-detail-open={detailOpen} data-drawer-open={drawerOpen}>
      {/*
        ⚠️ MapView 必須是 shell 的第一個、無條件的子節點。
        永遠不要把它移進條件分支、加 key 的包裝層、或抽屜／面板擁有的子樹——
        任何一種都會讓 React 重建這個節點，於是 maplibre remount：整份圖磚快取
        丟掉，window.__gaiaMaps 累積殘骸。面板一律是「排在地圖後面」的兄弟節點，
        地圖的 reconciliation 位置永遠是 index 0。

        也因為面板是絕對定位的疊層而不是把地圖擠小的欄位，canvas 尺寸與面板開關
        完全無關，所以這裡不需要（也不該有）任何 map.resize()。
      */}
      <MapView
        className="map-shell-canvas"
        initialCenter={theme.camera.center}
        initialZoom={theme.camera.zoom}
        basemap={chrome.basemap}
        overlays={chrome.overlays}
        onReady={setMap}
        onStyleApplied={reapplyLayers}
        navPosition="bottom-right"
        scalePosition="bottom-right"
      />

      <div className="map-top-right">
        <AppMenu themePref={chrome.themePref} onThemePrefChange={chrome.onThemePrefChange} />
      </div>

      <div className="map-bottom-left">
        <MapLegend entries={legendEntries} />
        <MapLayersPopover chrome={chrome} />
      </div>

      {detailOpen && (
        <MapDetailPanel
          onClose={() => setSelected(null)}
          onBack={slots.panelBack}
          title={detailTitle(selected)}
        >
          {slots.panelList ?? (
            <DetailCard
              selection={selected}
              itemCounts={itemCounts}
              theme={theme}
              instances={instances}
            />
          )}
        </MapDetailPanel>
      )}

      <LayerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={theme.label}
        subtitle={theme.subtitle}
      >
        <LayerPanel
          theme={theme}
          activeLayerIds={activeLayerIds}
          onToggleLayer={toggleLayer}
          activeItemIds={activeItemIds}
          onToggleItem={toggleItem}
          onItemNameClick={handleItemNameClick}
          itemCounts={itemCounts}
          renderLayerExtra={slots.drawerExtra}
        />
      </LayerDrawer>
    </div>
  );
}

function defaultOnIds(theme: ThemeDefinition): Set<string> {
  return new Set(
    theme.layers.filter((l) => l.status === "ready" && l.defaultOn).map((l) => l.id),
  );
}
