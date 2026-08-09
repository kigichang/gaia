import { useCallback, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView, type OverlayState } from "../map/MapView";
import type { BasemapId } from "../map/basemaps";
import { LayerToggles } from "../components/LayerToggles";
import { PlaceCard } from "../components/PlaceCard";
import { places } from "../content";
import { formatLatitude } from "../compare/LatitudeSlider";

/** 單張地圖的地形探索頁：專心看等高線與地勢，不做比較。 */
export function ExplorePage() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [placeId, setPlaceId] = useState(places.find((p) => p.id === "yushan")?.id ?? places[0].id);
  const [overlays, setOverlays] = useState<OverlayState>({
    contour: true,
    hillshade: true,
    terrain: false,
  });
  const [basemap, setBasemap] = useState<BasemapId>("nlsc-emap");

  const place = places.find((p) => p.id === placeId) ?? places[0];

  const flyTo = useCallback(
    (id: string) => {
      setPlaceId(id);
      const next = places.find((p) => p.id === id);
      if (next && map) {
        map.flyTo({
          center: [next.coord.lng, next.coord.lat],
          zoom: next.defaultZoom ?? 11,
          duration: 1200,
        });
      }
    },
    [map],
  );

  return (
    <div className="explore">
      <aside className="explore-side">
        <h2>地形探索</h2>
        <ul className="place-list">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={p.id === placeId ? "place-btn is-active" : "place-btn"}
                onClick={() => flyTo(p.id)}
              >
                <span className="place-btn-name">{p.name.zh}</span>
                <span className="place-btn-meta">
                  {formatLatitude(p.coord.lat)}・{p.landform}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <PlaceCard place={place} />
      </aside>

      <div className="explore-main">
        <LayerToggles
          overlays={overlays}
          onOverlaysChange={setOverlays}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
        <MapView
          className="map-canvas explore-canvas"
          initialCenter={[place.coord.lng, place.coord.lat]}
          initialZoom={place.defaultZoom ?? 11}
          basemap={basemap}
          overlays={overlays}
          onReady={setMap}
        />
      </div>
    </div>
  );
}
