import type { GeometryKind } from "../map/registry/types";

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  kind: GeometryKind;
  schematic?: boolean;
}

interface MapLegendProps {
  entries: LegendEntry[];
}

/**
 * 疊在地圖右下角的圖例，由目前開啟的圖層驅動。
 *
 * 色塊形狀必須跟該圖層的幾何一致（點／線／面）——形狀說謊的圖例比沒有圖例更糟，
 * 學生會照著圓點去找一條線。
 */
export function MapLegend({ entries }: MapLegendProps) {
  if (entries.length === 0) return null;

  return (
    <div className="map-legend">
      {entries.map((e) => (
        <div key={e.key} className="map-legend-row">
          <span
            className={`layer-swatch layer-swatch-${e.kind}`}
            style={
              e.kind === "fill"
                ? { backgroundColor: e.color, borderColor: e.color }
                : { backgroundColor: e.color }
            }
          />
          <span>
            {e.label}
            {e.schematic && <span className="layer-schematic">（示意）</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
