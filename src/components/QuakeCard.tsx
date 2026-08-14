import { SourceLinks } from "./SourceLinks";
import { Stat } from "./PlaceCard";

/**
 * 單一次地震的震央卡片。
 *
 * 資料**全部來自 geojson**（比照 ReservoirCard／MonumentCard）：1,341 筆不可能逐一
 * 手寫內容檔，而每一顆點都該講得出「這是哪一次地震」。
 *
 * ## ⚠️ 給人看的字串在這裡組，不要存進 geojson
 *
 * 試過把組好的 `name`／`meta`／`detail` 三個字串寫進 properties（好讓 `FeatureCard`
 * 的 fallback 直接用），檔案從 190 KB 漲到 **400 KB**——那 210 KB 全是可以從
 * `mag`／`depth_km`／`date` 重新算出來的重複資料，而這一層是一個班 30 個學生勾下去
 * 就要各付一份的東西。
 *
 * ## ⚠️ 震央與震源是兩件事
 *
 * **震央**（epicenter）是地面上的那個點，也就是地圖上畫的位置；**震源**是它底下
 * 破裂起始的地方，`depth_km` 是震源的深度。卡片上兩者分開寫，不要混成一個「深度」
 * ——那是課本會考的區別。
 *
 * ## ⚠️ 規模不是震度
 *
 * `mag` 是**規模**（一場地震只有一個值，描述釋放的能量）。震度是各地不同的搖晃
 * 程度，這份資料沒有、也不該從規模推算。標題與欄位都寫「規模」。
 */

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/** 座標字串。⚠️ 位數要跟 geojson 的 `digits: 2` 一致，否則會暗示一個不存在的精度。 */
function formatCoord(lat: number, lng: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return `${ns} ${ew}`;
}

export function QuakeCard({
  feature,
  description,
  sources,
}: {
  feature: GeoJSON.Feature;
  description: string;
  sources: readonly string[];
}) {
  const p = feature.properties ?? {};
  const mag = num(p.mag);
  const depth = num(p.depth_km);
  const date = str(p.date);
  // 以下三個只有「重大地震」那一層有（維基百科整理的地名與災害情形）。
  // ⚠️ 欄位叫 `name` 不是 `place`——searchIndex 只認 `name`，見 build-geodata.mjs
  const place = str(p.name);
  const harm = str(p.harm);
  const magCwa = num(p.magCwa);
  const coords =
    feature.geometry?.type === "Point"
      ? (feature.geometry.coordinates as [number, number])
      : undefined;

  // 淺層／中源是課本講「隱沒帶地震由淺而深」時用得到的分類。臺灣實測 1,239 筆
  // 淺層、102 筆中源、0 筆深源（>300 km），所以只會出現前兩種。
  const depthClass =
    depth == null ? undefined : depth < 70 ? "淺層地震" : depth <= 300 ? "中源地震" : "深源地震";

  return (
    <div className="place-card">
      {/*
        有地名就用地名當標題（「高雄美濃」比「規模 6.4 地震」好認得多）。
        ⚠️ 少數幾筆的地名本身就帶了事件名（維基原文寫「南投（集集大地震）」），
        再接一個「地震」會變成「…大地震）地震」，所以已含「地震」的就原樣用。
      */}
      <h4 className="feature-title">
        {place
          ? place.includes("地震")
            ? place
            : `${place}地震`
          : mag != null
            ? `規模 ${mag.toFixed(1)} 地震`
            : "地震"}
      </h4>
      <p className="feature-subtitle">{[date, depthClass].filter(Boolean).join("・")}</p>

      <div className="detail-stats">
        {mag != null && <Stat label="規模" value={mag.toFixed(1)} />}
        {depth != null && <Stat label="震源深度" value={`${depth.toLocaleString("en-US")} km`} />}
        {coords && <Stat label="震央" value={formatCoord(coords[1], coords[0])} />}
      </div>

      {harm && (
        <ul className="detail-facts">
          <li>
            <span className="fact-label">災害情形</span>
            <span className="fact-value">{harm}</span>
          </li>
        </ul>
      )}

      {/* ⚠️ 中央氣象署與 USGS 的規模系統性地不同（921 是 7.3 對 7.7）。差距明顯時
          要標出來，否則看過課本的人會以為我們寫錯了。 */}
      {magCwa != null && (
        <p className="quake-alt-mag">中央氣象署的規模是 {magCwa.toFixed(1)}（本站點位與規模採用 USGS 目錄）</p>
      )}

      <p className="feature-fallback">{description}</p>
      <p className="detail-sources">
        資料來源：
        <SourceLinks sources={[...sources]} />
      </p>
    </div>
  );
}
