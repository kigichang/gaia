import { INDIGENOUS_COLOR, PLACES_COLOR } from "../map/thematicColors";

interface MapLegendProps {
  showPlaces: boolean;
  showIndigenous: boolean;
  /** 目前有勾選、且資料已載入的物種（順序要跟指派顏色時一致） */
  activeSpecies: Array<{ id: string; name: string; color: string }>;
}

/** 任一主題圖層開啟時顯示的地圖圖例，疊在地圖右下角。 */
export function MapLegend({ showPlaces, showIndigenous, activeSpecies }: MapLegendProps) {
  if (!showPlaces && !showIndigenous && activeSpecies.length === 0) return null;

  return (
    <div className="map-legend">
      {showPlaces && <LegendRow color={PLACES_COLOR} label="地形景點" />}
      {showIndigenous && <LegendRow color={INDIGENOUS_COLOR} label="原住民族分佈" />}
      {activeSpecies.map((s) => (
        <LegendRow key={s.id} color={s.color} label={s.name} />
      ))}
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="map-legend-row">
      <span className="map-legend-swatch" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
