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

  // 地圖目前實際套用的底圖。在建立地圖時就記下當下用的那一份樣式，
  // 下面的切換 effect 才能單純比對 id，不必猜「這次是不是初次渲染」。
  const appliedBasemap = useRef<BasemapId | null>(null);

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
      // 記下這張地圖是用哪個底圖建立的。若使用者在樣式抓取／首次載入期間就換了底圖，
      // 下面的 effect 會在 ready 之後比對出差異並補上 setStyle。
      appliedBasemap.current = basemap;
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
  //
  // 只比對「地圖實際套用的底圖 id」與目前選擇，不能用「第一次就跳過」的旗標：
  // 底圖選單在 header 裡、從第一次繪製就能點，使用者很可能在地圖還沒 load 完
  // （ready 還是 false）就換底圖。那次 effect 會在上面提早 return，等 ready 變 true
  // 再跑一次時，若把它當成初次渲染跳過，地圖就會一直停在建立時的舊底圖，
  // 而選單顯示的是新的——要再切換兩次才會恢復同步。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (appliedBasemap.current === basemap) return;
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
