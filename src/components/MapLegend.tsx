import type { ColorRamp, GeometryKind } from "../map/registry/types";

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  kind: GeometryKind;
  schematic?: boolean;
  /**
   * 這個圖層是依數值分級上色的（水庫蓄水率）。有 ramp 就必須把級距畫出來——
   * 只給一個代表色的圖例，等於告訴讀者「顏色代表圖層身分」，那正好是這一層
   * 唯一的例外，會讓深淺不同的圓點變成看不懂的雜訊。
   */
  ramp?: ColorRamp;
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
        <div key={e.key}>
          <div className="map-legend-row">
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
          {e.ramp && (
            <div className="map-legend-ramp">
              {[...e.ramp.steps, e.ramp.nodata].map((s) => (
                <span key={s.label} className="map-legend-ramp-step">
                  <span
                    className="layer-swatch layer-swatch-circle"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
