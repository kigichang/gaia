import { useEffect, useState } from "react";
import { SourceLinks } from "./SourceLinks";

/**
 * 古蹟詳情卡。
 *
 * 基本資料**全部來自 geojson 的 properties**（比照 ReservoirCard），沒有
 * `src/content/` 底下的手寫檔案——全臺 1,064 處不可能逐一手寫，而每一處都該有一張
 * 講得出東西的卡片，不是 FeatureCard 那種只有名字加圖層說明的 fallback。
 *
 * ## 歷史沿革為什麼要延遲載入
 *
 * 官方的 `pastHistory` 品質很好（中位數 409 字、100% 完整、沒有 HTML），是這一層
 * 最有教學價值的部分。但 1,064 筆全部塞進 geojson 會到 **1.9 MB**，直接爆掉
 * build-geodata.mjs 的 1 MB 硬上限。所以它按縣市切成 21 份分片
 * （`public/data/monuments/<countyId>.json`，14–290 KB），**點開卡片才抓那一份**。
 *
 * 分片走 module-level 快取：同一個縣市的第二處古蹟不會重抓。抓失敗時只是不顯示
 * 沿革，卡片其餘部分照常——沿革是加值，不該擋住基本資料。
 */

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

interface HistoryEntry {
  history?: string;
  reason?: string;
}

/** countyId → 該縣市所有古蹟的沿革。存 Promise 讓並發的呼叫共用同一次請求。 */
const shardCache = new Map<string, Promise<Record<string, HistoryEntry> | null>>();

function loadShard(countyId: string): Promise<Record<string, HistoryEntry> | null> {
  let promise = shardCache.get(countyId);
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}data/monuments/${countyId}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, HistoryEntry>>) : null))
      .catch(() => null);
    shardCache.set(countyId, promise);
  }
  return promise;
}

function useHistory(countyId: string | undefined, id: string | undefined) {
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!countyId || !id) return;
    // 換古蹟時先清空，否則切換的瞬間會看到上一處的沿革配新的標題
    setEntry(null);
    setLoading(true);
    let cancelled = false;
    void loadShard(countyId).then((shard) => {
      if (cancelled) return;
      setEntry(shard?.[id] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [countyId, id]);

  return { entry, loading };
}

export function MonumentCard({ properties }: { properties: Record<string, unknown> }) {
  const p = properties;
  const name = str(p.name) ?? "古蹟";
  const level = str(p.level);
  const url = str(p.url);
  const { entry, loading } = useHistory(str(p.countyId), str(p.id));

  return (
    <div className="place-card">
      <h4 className="feature-title">{name}</h4>
      <p className="feature-subtitle">
        {[level, str(p.county), str(p.kind)].filter(Boolean).join("・")}
      </p>

      <ul className="detail-facts">
        <li>
          <span className="fact-label">指定年份</span>
          <span className="fact-value">
            {num(p.year) != null ? `${num(p.year)} 年公告指定` : "不詳"}
          </span>
        </li>
        <li>
          <span className="fact-label">所在地</span>
          <span className="fact-value">
            {[str(p.county), str(p.district)].filter(Boolean).join("")}
            {str(p.address) && `　${str(p.address)}`}
          </span>
        </li>
        <li>
          <span className="fact-label">主管機關</span>
          <span className="fact-value">{str(p.authority) ?? "不詳"}</span>
        </li>
      </ul>

      <section className="monument-history" aria-label="歷史沿革">
        {loading && <p className="monument-history-loading">歷史沿革載入中…</p>}
        {entry?.history && (
          <>
            <h5 className="monument-history-title">歷史沿革</h5>
            <p className="monument-history-text">{entry.history}</p>
          </>
        )}
        {entry?.reason && (
          <>
            <h5 className="monument-history-title">指定理由</h5>
            <p className="monument-history-text">{entry.reason}</p>
          </>
        )}
      </section>

      <p className="detail-sources">
        資料來源：
        <SourceLinks sources={["文化部文化資產局"]} />
        {url && (
          <>
            （
            <a href={url} target="_blank" rel="noreferrer">
              國家文化資產網個案頁
            </a>
            ）
          </>
        )}
      </p>
    </div>
  );
}
