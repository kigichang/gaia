import type { GeoFeature } from "../lib/schema";
import { SourceLinks } from "./SourceLinks";
import { Stat } from "./PlaceCard";

interface FeatureCardProps {
  /** 對應的內容檔。沒有就走 fallback。 */
  feature?: GeoFeature;
  /** fallback：geojson 的 name 屬性 + 圖層自己的說明與來源 */
  fallback: {
    name?: string;
    /**
     * geojson 的 `meta` 屬性（清單裡的次標，例如縣市政府的地址）。
     * 沒有內容檔時它常常是這個圖徵**唯一**的具體資訊，不顯示就浪費掉了。
     */
    meta?: string;
    /**
     * geojson 的 `detail` 屬性：比 `meta` 更具體的一行（主要作物分布用它列出這個
     * 鄉鎮種最多的前三種作物）。有內容檔的圖層走 `facts`，這是沒有內容檔時的對應物。
     */
    detail?: string;
    layerLabel: string;
    description: string;
    sources: string[];
    schematic?: boolean;
  };
}

/**
 * 泛用地理要素卡（縣市、河流、山脈、洋流、板塊…）。
 *
 * 結構比照 PlaceCard 並重用它匯出的 `Stat`。
 *
 * **沒有內容檔時退回顯示 geojson 的 name + 圖層的 description/sources。**
 * 這個 fallback 是刻意設計的：21 個縣市不必先手寫 21 份 JSON 才能上線，
 * 之後可以一個一個補。點下去有反應、看得到名稱與出處，就已經有教學價值。
 *
 * 跟 PlaceCard 不同，這裡一定要有 `<h4>` 標題——被點到的縣市不像地點那樣
 * 在清單裡有一個 active 的按鈕、或詳情面板的標題在提供上下文。
 */
export function FeatureCard({ feature, fallback }: FeatureCardProps) {
  const title = feature?.name.zh ?? fallback.name ?? fallback.layerLabel;
  const schematic = feature?.schematic ?? fallback.schematic;

  return (
    <div className="place-card">
      <h4 className="feature-title">
        {title}
        {feature?.name.en && <span className="detail-en">{feature.name.en}</span>}
      </h4>
      {feature?.subtitle && <p className="feature-subtitle">{feature.subtitle}</p>}

      {feature?.stats && feature.stats.length > 0 && (
        <div className="detail-stats">
          {feature.stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {feature ? (
        <ul className="detail-facts">
          {feature.facts.map((f) => (
            <li key={f.label}>
              <span className="fact-label">{f.label}</span>
              <span className="fact-value">{f.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        // 還沒寫內容檔：至少把圖層自己的說明交代清楚，不要給一張空卡
        <>
          {fallback.meta && <p className="feature-subtitle">{fallback.meta}</p>}
          {fallback.detail && <p className="feature-detail-line">{fallback.detail}</p>}
          <p className="feature-fallback">{fallback.description}</p>
        </>
      )}

      {schematic && (
        <p className="feature-schematic">
          這是簡化的教學示意幾何，用來說明分布趨勢，<strong>不是</strong>精確的測繪界線。
        </p>
      )}

      <p className="detail-sources">
        資料來源：<SourceLinks sources={feature?.sources ?? fallback.sources} />
      </p>
    </div>
  );
}
