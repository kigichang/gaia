import type { GeoFeature } from "../lib/schema";
import { SourceLinks } from "./SourceLinks";
import { Stat } from "./PlaceCard";

interface FeatureCardProps {
  /** 對應的內容檔。沒有就走 fallback。 */
  feature?: GeoFeature;
  /**
   * 內容檔還在抓（見 `content/index.ts` 的分片說明）。
   *
   * ⚠️ **不能把載入中當成「沒有內容檔」**：那會先畫一整段圖層說明、幾百毫秒後
   * 再整個換掉，而那兩種畫面長得完全不一樣。載入中只顯示 geojson 那邊就有的
   * 名稱與 `meta`，加一行「說明載入中…」——標題不跳，內容補上來。
   */
  loading?: boolean;
  /** fallback：geojson 的 name 屬性 + 圖層自己的說明與來源 */
  fallback: {
    name?: string;
    /**
     * geojson 的 `en` 屬性（原始的外文名）。
     *
     * ⚠️ 沒有內容檔的圖層本來讀不到英文名——`feature.name.en` 只存在於內容檔裡，
     * 而世界主要河流 118 條、全球活火山 1,214 座**一份內容檔都沒有**。中文名是
     * 對照表翻出來的，原名不顯示的話，學生就沒辦法拿它去查資料或對照新聞。
     */
    en?: string;
    /**
     * geojson 的 `meta` 屬性（清單裡的次標，例如縣市政府的地址）。
     * 沒有內容檔時它常常是這個圖徵**唯一**的具體資訊，不顯示就浪費掉了。
     */
    meta?: string;
    /**
     * 比 `meta` 更具體的一行。有內容檔的圖層走 `facts`，這是沒有內容檔時的對應物。
     *
     * 來源是 geojson 的 `detail` 屬性（臺灣河川用它放公告的管理等級），或舊名
     * `top`（主要作物分布用它列出這個鄉鎮種最多的前三種作物）——兩個名字並存的
     * 理由見 `DetailCard`，新圖層一律用 `detail`。
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
export function FeatureCard({ feature, loading, fallback }: FeatureCardProps) {
  const title = feature?.name.zh ?? fallback.name ?? fallback.layerLabel;
  const schematic = feature?.schematic ?? fallback.schematic;

  return (
    <div className="place-card">
      <h4 className="feature-title">
        {title}
        {(feature?.name.en ?? fallback.en) && (
          <span className="detail-en">{feature?.name.en ?? fallback.en}</span>
        )}
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
      ) : loading ? (
        // 分片還在路上：只給 geojson 那邊已經有的東西，不要先畫一段等一下會被換掉的字
        <>
          {fallback.meta && <p className="feature-subtitle">{fallback.meta}</p>}
          <p className="feature-loading">說明載入中…</p>
        </>
      ) : (
        // 還沒寫內容檔：至少把圖層自己的說明交代清楚，不要給一張空卡
        <>
          {fallback.meta && <p className="feature-subtitle">{fallback.meta}</p>}
          {fallback.detail && <p className="feature-detail-line">{fallback.detail}</p>}
          {/* 空字串＝圖層宣告了 hideLayerDescription（見 DetailCard）：不要留一個空的 <p> */}
          {fallback.description && <p className="feature-fallback">{fallback.description}</p>}
        </>
      )}

      {/* ⚠️ 載入中不畫這一段：`attach.schematic: false`（世界主要山脈的最高峰）會讓
          它「先出現再消失」——那等於對讀者說了一句幾百毫秒的假話。 */}
      {!loading && schematic && (
        <p className="feature-schematic">
          這是簡化的教學示意幾何，用來說明分布趨勢，<strong>不是</strong>精確的測繪界線。
        </p>
      )}

      {/* ⚠️ 載入中不畫來源：內容檔有自己的 `sources`（板塊那 52 張多了維基百科條目），
          先畫圖層的那一組會在幾百毫秒後整行換掉。 */}
      {!loading && (
        <p className="detail-sources">
          資料來源：<SourceLinks sources={feature?.sources ?? fallback.sources} />
        </p>
      )}
    </div>
  );
}
