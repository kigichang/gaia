import { useCallback, useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

export interface CameraState {
  /** 兩張地圖共用的緯度 */
  lat: number;
  /** 兩張地圖共用的縮放層級 */
  zoom: number;
  /** 左圖經度（各自獨立） */
  lngA: number;
  /** 右圖經度（各自獨立） */
  lngB: number;
}

/**
 * 同緯度比較的相機同步。
 *
 * 同步規則：
 *   - 緯度 lat、縮放 zoom、方位 bearing、俯角 pitch → 兩張地圖鎖定相同
 *   - 經度 lng → 各自獨立，這樣才能把兩個不同地區擺在一起看
 *
 * 為什麼是鎖緯度而不是鎖經度：Web Mercator 的面積放大率只跟緯度有關
 * （放大倍率 = 1/cos(緯度)）。只有在「同緯度 + 同 zoom」時，兩張地圖的
 * 實際比例尺才相同，面積與距離的目視比較才成立。這是本站比較功能的前提。
 */
export function useMapSync(
  mapA: MapLibreMap | null,
  mapB: MapLibreMap | null,
  onCameraChange?: (camera: CameraState) => void,
) {
  // 防回饋迴圈：同步過程中對方觸發的 move 事件要忽略，否則兩張地圖會互相推擠
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onCameraChange);
  onChangeRef.current = onCameraChange;

  const report = useCallback(() => {
    if (!mapA || !mapB) return;
    onChangeRef.current?.({
      lat: mapA.getCenter().lat,
      zoom: mapA.getZoom(),
      lngA: mapA.getCenter().lng,
      lngB: mapB.getCenter().lng,
    });
  }, [mapA, mapB]);

  useEffect(() => {
    if (!mapA || !mapB) return;

    const sync = (from: MapLibreMap, to: MapLibreMap) => () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const { lat } = from.getCenter();
        to.jumpTo({
          // 只接管緯度，經度維持對方原本的位置
          center: [to.getCenter().lng, lat],
          zoom: from.getZoom(),
          bearing: from.getBearing(),
          pitch: from.getPitch(),
        });
      } finally {
        syncingRef.current = false;
      }
    };

    const aToB = sync(mapA, mapB);
    const bToA = sync(mapB, mapA);

    mapA.on("move", aToB);
    mapB.on("move", bToA);
    mapA.on("moveend", report);
    mapB.on("moveend", report);

    // 掛上時先對齊一次，避免兩張地圖初始緯度不同
    aToB();
    report();

    return () => {
      mapA.off("move", aToB);
      mapB.off("move", bToA);
      mapA.off("moveend", report);
      mapB.off("moveend", report);
    };
  }, [mapA, mapB, report]);

  /** 由緯度滑桿等外部控制項呼叫：同時把兩張地圖移到指定緯度。 */
  const setLatitude = useCallback(
    (lat: number) => {
      if (!mapA || !mapB) return;
      syncingRef.current = true;
      try {
        for (const map of [mapA, mapB]) {
          map.jumpTo({ center: [map.getCenter().lng, lat] });
        }
      } finally {
        syncingRef.current = false;
      }
      report();
    },
    [mapA, mapB, report],
  );

  return { setLatitude };
}
