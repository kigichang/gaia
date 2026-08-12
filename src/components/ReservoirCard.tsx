import { RESERVOIR_FILL_RAMP } from "../map/thematicColors";
import { SourceLinks } from "./SourceLinks";
import { Stat } from "./PlaceCard";

/**
 * 水庫詳情卡。
 *
 * 內容**全部來自 geojson 的 properties**（`build-geodata.mjs` 的基本資料 +
 * `resolve.ts` join 進來的即時水情），沒有 `src/content/` 底下的手寫檔案——
 * 蓄水率每小時都在變，寫成內容檔一定會過期。這也是它不能走 `FeatureCard`
 * 那條路徑的原因（那支找的是內容檔）。
 *
 * ⚠️ **觀測時間一定要顯示出來。** 這份水情是建置期抓的快照（純靜態站不能在
 * 執行期打水利署 API，見 content/index.ts），上游掛掉時 CI 會沿用 repo 裡的
 * 舊檔案。把時間寫在卡片上，使用者才看得出自己在看多舊的東西——這是內容誠信的
 * 承諾，比照 GBIF 觀測點與 ERA5 氣候值的既有做法，不要為了版面把它收起來。
 */

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * `2026-08-12T19:00:00` → `08/12 19:00`。
 *
 * ⚠️ 刻意**用字串切**，不要 `new Date(...)`。上游給的是不帶時區的臺灣時間，
 * 丟進 Date 會被當成瀏覽器所在時區，在國外開站就會顯示成錯的時刻。
 */
function formatObservedAt(iso: string | undefined): string | undefined {
  const m = iso?.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}/${m[2]} ${m[3]}:${m[4]}` : iso;
}

/** 蓄水率落在哪一個級距——顏色要跟地圖上那顆圓點一致。 */
function rampColor(percent: number): string {
  const step = RESERVOIR_FILL_RAMP.steps.find((s) => s.below == null || percent < s.below);
  return (step ?? RESERVOIR_FILL_RAMP.steps.at(-1)!).color;
}

/**
 * 攔河堰／壩：引水與調節設施，不是蓄水設施。
 *
 * 名稱結尾就是官方的分類線索（集集攔河堰、石岡壩、直潭壩），比自己另外維護一份
 * 清單可靠。它們的蓄水率天生偏低又波動很大，跟曾文、翡翠並排比較會得到錯誤結論，
 * 所以卡片上要講清楚。
 */
const isBarrage = (name: string | undefined) => /[壩堰]$/.test(name ?? "");

export function ReservoirCard({ properties }: { properties: Record<string, unknown> }) {
  const p = properties;
  const name = str(p.name) ?? "水庫";
  const percent = num(p.percent);
  const observedAt = formatObservedAt(str(p.observedAt));
  const capacity = num(p.capacity);
  const storage = num(p.storage);

  return (
    <div className="place-card">
      <h4 className="feature-title">{name}</h4>
      <p className="feature-subtitle">
        {[str(p.river), str(p.town)].filter(Boolean).join("・")}
      </p>

      <section className="reservoir-live" aria-label="即時水情">
        {percent != null ? (
          <>
            <div className="reservoir-meter">
              <div
                className="reservoir-meter-track"
                role="meter"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="蓄水百分比"
              >
                {/* 超過 100%（滿庫溢流）時長條停在滿格，但數字照實顯示 */}
                <div
                  className="reservoir-meter-fill"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: rampColor(percent),
                  }}
                />
              </div>
              <span className="reservoir-percent">{percent}%</span>
            </div>
            {/* 蓄水量與容量刻意排成一行分數，不塞進 stat 格子——四位數的「萬立方
                公尺」在 90px 寬的格子裡會斷成兩行，而這兩個數字要並排才讀得出比例 */}
            <p className="reservoir-volume">
              有效蓄水量 <strong>{storage?.toLocaleString("zh-TW") ?? "—"}</strong>
              {/* JSX 會把換行縮排變成一個空格，所以斜線前後不能斷行 */}
              {`／有效容量 ${capacity?.toLocaleString("zh-TW") ?? "—"} 萬立方公尺`}
            </p>
            <div className="detail-stats">
              <Stat label="水位" value={num(p.waterLevel_m) != null ? `${num(p.waterLevel_m)} m` : "—"} />
              <Stat
                label="進流量"
                value={num(p.inflow_cms) != null ? `${num(p.inflow_cms)} m³/s` : "—"}
              />
              <Stat
                label="出流量"
                value={num(p.outflow_cms) != null ? `${num(p.outflow_cms)} m³/s` : "—"}
              />
            </div>
            <p className="reservoir-observed">
              集水區降雨 {num(p.rainfall_mm) ?? "—"} mm・觀測時間 {observedAt}（臺灣時間）
            </p>
          </>
        ) : (
          <p className="reservoir-nodata">
            這座水庫目前沒有即時水情資料。水利署的水情資料集不是每座水庫都逐時回報，
            白河、虎頭埤、谷關等水庫經常缺漏——<strong>沒有資料不代表沒有水</strong>。
          </p>
        )}
      </section>

      <ul className="detail-facts">
        <li>
          <span className="fact-label">壩型</span>
          <span className="fact-value">
            {str(p.damType) ?? "不詳"}
            {num(p.damHeight_m) != null && `，壩高 ${num(p.damHeight_m)} 公尺`}
          </span>
        </li>
        <li>
          <span className="fact-label">集水面積</span>
          <span className="fact-value">
            {num(p.catchment_ha) != null
              ? `${(num(p.catchment_ha)! / 100).toLocaleString("zh-TW")} 平方公里`
              : "不詳"}
            {num(p.surface_ha) != null &&
              `（滿水位面積 ${(num(p.surface_ha)! / 100).toFixed(2)} 平方公里）`}
          </span>
        </li>
        <li>
          <span className="fact-label">主要功能</span>
          <span className="fact-value">{str(p.purpose) ?? "不詳"}</span>
        </li>
        <li>
          <span className="fact-label">管理機關</span>
          <span className="fact-value">{str(p.authority) ?? "不詳"}</span>
        </li>
      </ul>

      {isBarrage(name) && (
        <p className="feature-schematic">
          這是<strong>攔河堰／壩</strong>，主要功能是引水與調節流量，不是長期蓄水。
          它的蓄水率天生偏低、變動也快，不適合直接拿來跟曾文、翡翠這類蓄水型水庫比較。
        </p>
      )}

      <p className="detail-sources">
        資料來源：
        <SourceLinks sources={["經濟部水利署"]} />
        （水庫基本資料 + 水庫水情資料）
      </p>
    </div>
  );
}
