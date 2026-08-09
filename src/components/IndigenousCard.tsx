import type { IndigenousGroup } from "../lib/schema";
import { Stat } from "./PlaceCard";

interface IndigenousCardProps {
  group: IndigenousGroup;
}

export function IndigenousCard({ group }: IndigenousCardProps) {
  return (
    <div className="place-card">
      <div className="detail-stats">
        <Stat label="主要分布" value={group.mainDistribution.join("、")} />
        {group.language && <Stat label="語言" value={group.language} />}
        {group.populationEstimate != null && (
          <Stat
            label="人口概數"
            value={`約 ${group.populationEstimate.toLocaleString("zh-TW")} 人`}
            note={group.populationYear ? `${group.populationYear} 統計` : undefined}
          />
        )}
      </div>

      <p className="detail-probe">
        地圖上的標記位置為文化園區或行政中心等代表點，不代表精確的分布邊界。
      </p>

      <ul className="detail-facts">
        {group.facts.map((f) => (
          <li key={f.label}>
            <span className="fact-label">{f.label}</span>
            <span className="fact-value">{f.value}</span>
          </li>
        ))}
      </ul>

      <p className="detail-sources">資料來源：{group.sources.join("、")}</p>
    </div>
  );
}
