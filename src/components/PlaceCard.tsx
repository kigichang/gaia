import type { Place } from "../lib/schema";
import { formatLatitude } from "../compare/LatitudeSlider";
import { SourceLinks } from "./SourceLinks";

/** 柯本氣候分類第一碼的中文說明，用來把代碼變成學生看得懂的字。 */
const KOPPEN_GROUPS: Record<string, string> = {
  A: "熱帶",
  B: "乾燥",
  C: "溫帶",
  D: "冷溫帶",
  E: "極地／高地",
};

interface PlaceCardProps {
  place: Place;
  /** 由地圖即時查得的海拔（公尺）。需開啟 3D 地形才有值。 */
  queriedElevation?: number | null;
}

export function PlaceCard({ place, queriedElevation }: PlaceCardProps) {
  return (
    <div className="place-card">
      <div className="detail-stats">
        <Stat label="緯度" value={formatLatitude(place.coord.lat)} />
        <Stat label="海拔" value={`${place.elevation_m.toLocaleString("zh-TW")} m`} />
        <Stat label="地形" value={place.landform} />
        <Stat
          label="氣候型"
          value={place.koppen}
          note={KOPPEN_GROUPS[place.koppen[0]] ?? undefined}
        />
      </div>

      {queriedElevation != null && (
        <p className="detail-probe">
          地圖游標處海拔約 <strong>{Math.round(queriedElevation).toLocaleString("zh-TW")} m</strong>
        </p>
      )}

      <ul className="detail-facts">
        {place.facts.map((f) => (
          <li key={f.label}>
            <span className="fact-label">{f.label}</span>
            <span className="fact-value">{f.value}</span>
          </li>
        ))}
      </ul>

      <p className="detail-sources">
        資料來源：<SourceLinks sources={place.sources} />
      </p>
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
