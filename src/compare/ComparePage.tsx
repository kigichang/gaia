import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView, type OverlayState } from "../map/MapView";
import { useMapSync, type CameraState } from "../map/useMapSync";
import type { BasemapId } from "../map/basemaps";
import type { ChromeState } from "../chrome";
import { PlaceCard } from "../components/PlaceCard";
import { SiteHeader } from "../components/SiteHeader";
import { LatitudeSlider, formatLatitude } from "./LatitudeSlider";
import { ClimateChart, sharedDomains } from "./ClimateChart";
import { COMPARE_PRESETS, DEFAULT_PRESET } from "./presets";
import { getPlace, loadClimate, places } from "../content";
import type { Climate, Place } from "../lib/schema";

type Side = "a" | "b";

interface ComparePageProps {
  chrome: ChromeState;
}

export function ComparePage({ chrome }: ComparePageProps) {
  const { overlays, basemap } = chrome;
  const [params, setParams] = useSearchParams();

  const placeA = getPlace(params.get("a") ?? DEFAULT_PRESET.a) ?? places[0];
  const placeB = getPlace(params.get("b") ?? DEFAULT_PRESET.b) ?? places[1];
  const initialLat = numberParam(params.get("lat"), DEFAULT_PRESET.lat);
  const initialZoom = numberParam(params.get("z"), DEFAULT_PRESET.zoom);

  const [mapA, setMapA] = useState<MapLibreMap | null>(null);
  const [mapB, setMapB] = useState<MapLibreMap | null>(null);
  const [camera, setCamera] = useState<CameraState>({
    lat: initialLat,
    zoom: initialZoom,
    lngA: placeA.coord.lng,
    lngB: placeB.coord.lng,
  });

  // 相機狀態寫回網址，讓老師可以把一組比較直接貼給學生。
  // replace 避免每次拖動地圖都塞一筆瀏覽紀錄。
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;

  const handleCamera = useCallback((next: CameraState) => {
    setCamera(next);
    setParamsRef.current(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("lat", next.lat.toFixed(2));
        p.set("z", next.zoom.toFixed(1));
        return p;
      },
      { replace: true },
    );
  }, []);

  const { setLatitude } = useMapSync(mapA, mapB, handleCamera);

  const climateA = useClimate(placeA.id);
  const climateB = useClimate(placeB.id);
  const domains = useMemo(() => sharedDomains(climateA, climateB), [climateA, climateB]);

  const [elevationA, setElevationA] = useState<number | null>(null);
  const [elevationB, setElevationB] = useState<number | null>(null);
  useElevationProbe(mapA, overlays.terrain, setElevationA);
  useElevationProbe(mapB, overlays.terrain, setElevationB);

  /** 選地點：把該側移到該地點，並把共用緯度也帶過去（否則會看不到選的地方）。 */
  const selectPlace = useCallback(
    (side: Side, id: string) => {
      const place = getPlace(id);
      const map = side === "a" ? mapA : mapB;
      if (!place || !map) return;
      // 先飛再寫網址，理由與 applyPreset 相同（見下面那段說明）
      map.jumpTo({ center: [place.coord.lng, place.coord.lat] });
      setParamsRef.current(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(side, id);
          return p;
        },
        { replace: true },
      );
    },
    [mapA, mapB],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = COMPARE_PRESETS.find((p) => p.id === presetId);
      const a = preset && getPlace(preset.a);
      const b = preset && getPlace(preset.b);
      if (!preset || !a || !b || !mapA || !mapB) return;

      // ⚠️ 順序不能反過來：先飛，網址最後才寫。
      //
      // `jumpTo` 會**同步**派送 move 事件 → useMapSync → handleCamera，而
      // handleCamera 也會寫網址（只寫 lat/z）。React Router 的
      // `setSearchParams(prev => …)` 拿到的 `prev` 是**目前已提交**的網址，不是
      // 前一次呼叫排隊中的結果，所以如果先寫 a/b 再 jumpTo，handleCamera 那次
      // 寫入會用還沒有 a/b 的快照覆蓋掉，a/b 就消失了。
      //
      // 症狀很像「預設組合壞掉」但其實更陰險：兩張地圖**確實**飛到正確位置，
      // 只有下面的地點選單、氣候圖表與 hint 還停在舊的那一組——也就是圖表跟
      // 地圖對不起來，而比較頁的全部意義就在那個對照。
      mapA.jumpTo({ center: [a.coord.lng, preset.lat], zoom: preset.zoom });
      mapB.jumpTo({ center: [b.coord.lng, preset.lat], zoom: preset.zoom });

      setParamsRef.current(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("a", preset.a);
          p.set("b", preset.b);
          p.set("lat", preset.lat.toFixed(2));
          p.set("z", preset.zoom.toFixed(1));
          return p;
        },
        { replace: true },
      );
    },
    [mapA, mapB],
  );

  const activePreset = COMPARE_PRESETS.find((p) => p.a === placeA.id && p.b === placeB.id);

  return (
    <div className="app">
      <SiteHeader chrome={chrome} />
      <main className="app-main">
        <div className="compare">
          <section className="compare-controls">
            <div className="preset-row">
              <span className="preset-label">預設比較</span>
              {COMPARE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={p.id === activePreset?.id ? "preset is-active" : "preset"}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {activePreset && <p className="preset-hint">{activePreset.hint}</p>}

          <section className="compare-maps">
            <MapPanel
              side="a"
              place={placeA}
              onSelect={selectPlace}
              initialCenter={[placeA.coord.lng, initialLat]}
              initialZoom={initialZoom}
              basemap={basemap}
              overlays={overlays}
              onReady={setMapA}
            />
            <MapPanel
              side="b"
              place={placeB}
              onSelect={selectPlace}
              initialCenter={[placeB.coord.lng, initialLat]}
              initialZoom={initialZoom}
              basemap={basemap}
              overlays={overlays}
              onReady={setMapB}
            />
          </section>

          <section className="compare-latitude">
            <LatitudeSlider lat={camera.lat} onChange={setLatitude} />
            <p className="latitude-note">
              兩張地圖鎖定在 <strong>{formatLatitude(camera.lat)}</strong>，縮放層級也相同。
              Web Mercator 的放大倍率只跟緯度有關，所以唯有同緯度、同縮放時，兩張地圖的比例尺才真正一致，
              面積與距離才能直接互相比較。左右各自的經度可以獨立平移。
            </p>
          </section>

          <section className="compare-details">
            <DetailPanel place={placeA} climate={climateA} domains={domains} elevation={elevationA} />
            <DetailPanel place={placeB} climate={climateB} domains={domains} elevation={elevationB} />
          </section>
        </div>
      </main>
    </div>
  );
}

interface MapPanelProps {
  side: Side;
  place: Place;
  onSelect: (side: Side, id: string) => void;
  initialCenter: [number, number];
  initialZoom: number;
  basemap: BasemapId;
  overlays: OverlayState;
  onReady: (map: MapLibreMap) => void;
}

function MapPanel({
  side,
  place,
  onSelect,
  initialCenter,
  initialZoom,
  basemap,
  overlays,
  onReady,
}: MapPanelProps) {
  return (
    <div className="map-panel">
      <div className="map-panel-head">
        <label>
          <span className="visually-hidden">選擇{side === "a" ? "左" : "右"}側地點</span>
          <select value={place.id} onChange={(e) => onSelect(side, e.target.value)}>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.zh}（{formatLatitude(p.coord.lat)}）
              </option>
            ))}
          </select>
        </label>
      </div>
      <MapView
        className="map-canvas"
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        basemap={basemap}
        overlays={overlays}
        onReady={onReady}
      />
    </div>
  );
}

function DetailPanel({
  place,
  climate,
  domains,
  elevation,
}: {
  place: Place;
  climate: Climate | null;
  domains: ReturnType<typeof sharedDomains>;
  elevation: number | null;
}) {
  return (
    <article className="detail-panel">
      <h2>
        {place.name.zh}
        <span className="detail-en">{place.name.en}</span>
      </h2>
      <PlaceCard place={place} queriedElevation={elevation} />
      {climate ? (
        <ClimateChart climate={climate} domains={domains} />
      ) : (
        <p className="climate-missing">尚無氣候資料（執行 npm run build:climate 產生）</p>
      )}
    </article>
  );
}

function useClimate(placeId: string) {
  const [climate, setClimate] = useState<Climate | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadClimate(placeId).then((c) => {
      if (!cancelled) setClimate(c);
    });
    return () => {
      cancelled = true;
    };
  }, [placeId]);
  return climate;
}

/** 游標處海拔查詢。queryTerrainElevation 只有在啟用 3D 地形時才有值。 */
function useElevationProbe(
  map: MapLibreMap | null,
  terrainEnabled: boolean,
  onElevation: (value: number | null) => void,
) {
  useEffect(() => {
    if (!map) return;
    if (!terrainEnabled) {
      onElevation(null);
      return;
    }
    const handler = (e: { lngLat: { lng: number; lat: number } }) => {
      onElevation(map.queryTerrainElevation(e.lngLat) ?? null);
    };
    const leave = () => onElevation(null);
    map.on("mousemove", handler);
    map.on("mouseout", leave);
    return () => {
      map.off("mousemove", handler);
      map.off("mouseout", leave);
    };
  }, [map, terrainEnabled, onElevation]);
}

function numberParam(raw: string | null, fallback: number) {
  const n = Number(raw);
  return raw !== null && Number.isFinite(n) ? n : fallback;
}
