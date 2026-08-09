import type { Species } from "../lib/schema";
import { Stat } from "./PlaceCard";

const CATEGORY_LABELS: Record<Species["category"], string> = {
  mammal: "哺乳類",
  bird: "鳥類",
  fish: "魚類",
  amphibian: "兩棲類",
  reptile: "爬蟲類",
  insect: "昆蟲",
};

interface SpeciesCardProps {
  species: Species;
  /** 該物種的 GBIF 觀測點數量；尚未載入完成時傳 undefined */
  occurrenceCount?: number;
}

export function SpeciesCard({ species, occurrenceCount }: SpeciesCardProps) {
  return (
    <div className="place-card">
      <p className="species-latin">{species.name.latin}</p>

      <div className="detail-stats">
        <Stat label="分類" value={CATEGORY_LABELS[species.category]} />
        {species.conservationStatus && (
          <Stat label="保育等級" value={species.conservationStatus} />
        )}
        <Stat
          label="觀測點"
          value={occurrenceCount != null ? `${occurrenceCount} 筆` : "載入中…"}
        />
      </div>

      <p className="detail-probe">
        棲地：{species.habitat}
      </p>

      <ul className="detail-facts">
        {species.facts.map((f) => (
          <li key={f.label}>
            <span className="fact-label">{f.label}</span>
            <span className="fact-value">{f.value}</span>
          </li>
        ))}
      </ul>

      <p className="detail-sources">
        資料來源：{species.sources.join("、")}
        ，觀測點資料反映歷史觀測熱點，不是精確的族群密度普查
      </p>
    </div>
  );
}
