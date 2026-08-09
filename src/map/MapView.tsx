import { useEffect, useRef, useState } from "react";
// maplibre-gl v6 起不再提供 default export，必須用 namespace import
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type BasemapId, firstSymbolLayerId, loadBasemapStyle } from "./basemaps";
import { addContourLayers, setContourVisibility } from "./layers/contour";
import { addHillshadeLayer, setHillshadeVisibility } from "./layers/hillshade";
import { setTerrainEnabled } from "./layers/terrain";

export interface OverlayState {
  contour: boolean;
  hillshade: boolean;
  terrain: boolean;
}

export interface MapViewProps {
  initialCenter: [number, number];
  initialZoom: number;
  basemap: BasemapId;
  overlays: OverlayState;
  /** 地圖建立且首次樣式載入完成後呼叫，用來接上相機同步或事件監聽。 */
  onReady?: (map: MapLibreMap) => void;
  className?: string;
}

export function MapView({
  initialCenter,
  initialZoom,
  basemap,
  overlays,
  onReady,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  // 這些值只在建立地圖／樣式重載時讀取，用 ref 保存最新值即可，
  // 不要放進 effect 相依，否則每次切換圖層都會重建地圖。
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // 建立地圖（整個生命週期只做一次）
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void (async () => {
      const style = await loadBasemapStyle(basemap);
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: initialCenter,
        zoom: initialZoom,
        maxZoom: 16,
        // 中文地名的 glyph 圖磚太大，改用瀏覽器本機字型即時排版
        localIdeographFontFamily:
          "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        attributionControl: { compact: true },
        // 開發模式保留繪圖緩衝區，才能用 canvas.toDataURL() 取得地圖畫面來驗證算繪。
        // 注意 maplibre-gl v6 把這個選項移進 canvasContextAttributes；寫在頂層
        // 會被靜默忽略（型別檢查才會抓到）。正式版關閉以免影響效能。
        canvasContextAttributes: { preserveDrawingBuffer: import.meta.env.DEV },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

      map.on("load", () => {
        if (cancelled) return;
        applyOverlayLayers(map);
        syncOverlayVisibility(map, overlaysRef.current);
        setReady(true);
        onReadyRef.current?.(map);

        // 開發模式把地圖實例掛到 window，方便在 DevTools 或自動化中檢查圖層狀態
        if (import.meta.env.DEV) {
          const w = window as unknown as { __gaiaMaps?: MapLibreMap[] };
          (w.__gaiaMaps ??= []).push(map);
        }
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // initialCenter/initialZoom/basemap 只作為初始值，改變它們不應重建地圖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切換底圖。setStyle 會清空所有自訂來源與圖層，必須在新樣式就緒後重新加回。
  // 記住目前已套用的底圖。用「比對 id」而不是「第一次就跳過」的旗標，
  // 否則 StrictMode 重跑 effect 時會誤判成換底圖，白白多抓一次樣式。
  const appliedBasemap = useRef<BasemapId | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedBasemap.current === basemap) return;
    if (appliedBasemap.current === null) {
      appliedBasemap.current = basemap; // 初始底圖已在建立地圖時套用
      return;
    }
    appliedBasemap.current = basemap;
    let cancelled = false;
    void (async () => {
      const style = await loadBasemapStyle(basemap);
      if (cancelled) return;
      map.once("style.load", () => {
        if (cancelled) return;
        applyOverlayLayers(map);
        syncOverlayVisibility(map, overlaysRef.current);
      });
      map.setStyle(style);
    })();
    return () => {
      cancelled = true;
    };
  }, [basemap, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncOverlayVisibility(map, overlays);
  }, [overlays, ready]);

  return <div ref={containerRef} className={className} />;
}

function applyOverlayLayers(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification | undefined;
  addHillshadeLayer(map, firstSymbolLayerId(style));
  addContourLayers(map);
}

function syncOverlayVisibility(map: MapLibreMap, overlays: OverlayState) {
  setContourVisibility(map, overlays.contour);
  setHillshadeVisibility(map, overlays.hillshade);
  setTerrainEnabled(map, overlays.terrain);
}
