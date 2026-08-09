import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapView, type OverlayState } from "../map/MapView";
import type { BasemapId } from "../map/basemaps";
import { LayerToggles } from "../components/LayerToggles";
import { ThematicLayerPanel } from "../components/ThematicLayerPanel";
import { MapLegend } from "../components/MapLegend";
import { PlaceCard } from "../components/PlaceCard";
import { IndigenousCard } from "../components/IndigenousCard";
import { SpeciesCard } from "../components/SpeciesCard";
import {
  getIndigenousGroup,
  getPlace,
  getSpecies,
  indigenousGroups,
  loadSpeciesOccurrence,
  places,
  speciesList,
} from "../content";
import { formatLatitude } from "../compare/LatitudeSlider";
import { toFeatureCollection } from "../map/layers/points";
import { useThematicLayers, type ActiveSpeciesLayer } from "../map/useThematicLayers";
import { SPECIES_COLORS } from "../map/thematicColors";
import type { SpeciesOccurrence } from "../lib/schema";

// 地形景點／原住民族分佈的資料是模組層級常數，不會變動，不需要每次 render 重算。
const PLACES_GEOJSON = toFeatureCollection(
  places,
  (p) => [p.coord.lng, p.coord.lat],
  (p) => p.id,
);
const INDIGENOUS_GEOJSON = toFeatureCollection(
  indigenousGroups,
  (g) => [g.representativeCoord.lng, g.representativeCoord.lat],
  (g) => g.id,
);

type Selected =
  | { kind: "place"; id: string }
  | { kind: "indigenous"; id: string }
  | { kind: "species"; id: string };

/** 算出一組觀測點的地理範圍，供 fitBounds 使用。 */
function boundsOf(fc: GeoJSON.FeatureCollection<GeoJSON.Point>): [[number, number], [number, number]] | null {
  if (!fc.features.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const f of fc.features) {
    const [lng, lat] = f.geometry.coordinates;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** 單張地圖的地形探索頁，可複選疊加地形景點／原住民族分佈／特有種生態分佈。 */
export function ExplorePage() {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [overlays, setOverlays] = useState<OverlayState>({
    contour: true,
    hillshade: true,
    terrain: false,
  });
  const [basemap, setBasemap] = useState<BasemapId>("nlsc-emap");

  const [selected, setSelected] = useState<Selected>(() => ({
    kind: "place",
    id: places.find((p) => p.id === "yushan")?.id ?? places[0].id,
  }));

  const [showPlaces, setShowPlaces] = useState(true);
  const [showIndigenous, setShowIndigenous] = useState(false);
  const [showSpeciesSection, setShowSpeciesSection] = useState(false);
  const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<string[]>([]);
  const [speciesOccurrence, setSpeciesOccurrence] = useState<
    Record<string, SpeciesOccurrence | null>
  >({});

  // 勾選一個物種就載入它的觀測點（build:species 產生的靜態 geojson，只抓一次並快取）
  useEffect(() => {
    for (const id of selectedSpeciesIds) {
      if (speciesOccurrence[id] !== undefined) continue;
      void loadSpeciesOccurrence(id).then((data) => {
        setSpeciesOccurrence((prev) => ({ ...prev, [id]: data }));
      });
    }
  }, [selectedSpeciesIds, speciesOccurrence]);

  const activeSpecies = useMemo<ActiveSpeciesLayer[]>(
    () =>
      selectedSpeciesIds.map((id, i) => ({
        id,
        color: SPECIES_COLORS[i % SPECIES_COLORS.length],
        data: speciesOccurrence[id] ?? null,
      })),
    [selectedSpeciesIds, speciesOccurrence],
  );

  const thematicConfig = useMemo(
    () => ({
      showPlaces,
      placesData: PLACES_GEOJSON,
      showIndigenous,
      indigenousData: INDIGENOUS_GEOJSON,
      activeSpecies,
    }),
    [showPlaces, showIndigenous, activeSpecies],
  );

  const handleMapSelect = useCallback((kind: "place" | "indigenous" | "species", id: string) => {
    setSelected({ kind, id } as Selected);
  }, []);

  useThematicLayers(map, thematicConfig, handleMapSelect);

  const flyToPlace = useCallback(
    (id: string) => {
      setSelected({ kind: "place", id });
      const next = getPlace(id);
      if (next && map) {
        map.flyTo({ center: [next.coord.lng, next.coord.lat], zoom: next.defaultZoom ?? 11, duration: 1200 });
      }
    },
    [map],
  );

  const flyToIndigenous = useCallback(
    (id: string) => {
      setSelected({ kind: "indigenous", id });
      const group = getIndigenousGroup(id);
      if (group && map) {
        map.flyTo({
          center: [group.representativeCoord.lng, group.representativeCoord.lat],
          zoom: 10,
          duration: 1200,
        });
      }
    },
    [map],
  );

  const handleSpeciesNameClick = useCallback(
    (id: string) => {
      setSelected({ kind: "species", id });
      const occurrence = speciesOccurrence[id];
      if (occurrence && map) {
        const bounds = boundsOf(occurrence);
        if (bounds) map.fitBounds(bounds, { padding: 48, duration: 1200, maxZoom: 12 });
      }
    },
    [map, speciesOccurrence],
  );

  const handleToggleSpecies = useCallback((id: string) => {
    setSelectedSpeciesIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const initialPlace = getPlace(selected.kind === "place" ? selected.id : "yushan") ?? places[0];

  return (
    <div className="explore">
      <aside className="explore-side">
        <h2>地形探索</h2>

        <ThematicLayerPanel
          showPlaces={showPlaces}
          onTogglePlaces={setShowPlaces}
          showIndigenous={showIndigenous}
          onToggleIndigenous={setShowIndigenous}
          showSpeciesSection={showSpeciesSection}
          onToggleSpeciesSection={setShowSpeciesSection}
          speciesList={speciesList}
          selectedSpeciesIds={selectedSpeciesIds}
          onToggleSpecies={handleToggleSpecies}
          onSpeciesNameClick={handleSpeciesNameClick}
          occurrenceCounts={Object.fromEntries(
            speciesList.map((s) => [s.id, speciesOccurrence[s.id]?.features.length]),
          )}
        />

        {showPlaces && (
          <ul className="place-list">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={
                    selected.kind === "place" && selected.id === p.id
                      ? "place-btn is-active"
                      : "place-btn"
                  }
                  onClick={() => flyToPlace(p.id)}
                >
                  <span className="place-btn-name">{p.name.zh}</span>
                  <span className="place-btn-meta">
                    {formatLatitude(p.coord.lat)}・{p.landform}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showIndigenous && (
          <ul className="place-list">
            {indigenousGroups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className={
                    selected.kind === "indigenous" && selected.id === g.id
                      ? "place-btn is-active"
                      : "place-btn"
                  }
                  onClick={() => flyToIndigenous(g.id)}
                >
                  <span className="place-btn-name">{g.name.zh}</span>
                  <span className="place-btn-meta">{g.mainDistribution.join("、")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DetailCard selected={selected} speciesOccurrence={speciesOccurrence} />
      </aside>

      <div className="explore-main">
        <LayerToggles
          overlays={overlays}
          onOverlaysChange={setOverlays}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />
        <div className="map-canvas-wrap">
          <MapView
            className="map-canvas explore-canvas"
            initialCenter={[initialPlace.coord.lng, initialPlace.coord.lat]}
            initialZoom={initialPlace.defaultZoom ?? 11}
            basemap={basemap}
            overlays={overlays}
            onReady={setMap}
          />
          <MapLegend
            showPlaces={showPlaces}
            showIndigenous={showIndigenous}
            activeSpecies={activeSpecies
              .filter((s) => s.data)
              .map((s) => ({ id: s.id, color: s.color, name: getSpecies(s.id)?.name.zh ?? s.id }))}
          />
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  selected,
  speciesOccurrence,
}: {
  selected: Selected;
  speciesOccurrence: Record<string, SpeciesOccurrence | null>;
}) {
  if (selected.kind === "place") {
    const place = getPlace(selected.id);
    return place ? <PlaceCard place={place} /> : null;
  }
  if (selected.kind === "indigenous") {
    const group = getIndigenousGroup(selected.id);
    return group ? <IndigenousCard group={group} /> : null;
  }
  const species = getSpecies(selected.id);
  if (!species) return null;
  return (
    <SpeciesCard species={species} occurrenceCount={speciesOccurrence[selected.id]?.features.length} />
  );
}
