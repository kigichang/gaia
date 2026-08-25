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
 *
 * ## ⚠️ 這張卡**不重複圖層說明**
 *
 * 早期版本在卡片底部印一段 `description`（＝圖層說明 + 全部 `notes`）。但這一層有
 * 612＋150 個點，那段字**每一筆都逐字相同**，於是卡片有大半的高度在講「這個圖層是
 * 什麼」而不是「這一次地震是什麼」，而且跟圖層抽屜那一列的說明重複。
 *
 * 圖層層級的話現在各有各的位置：說明在抽屜的核取方塊下面，資料限制在圖層名稱旁邊
 * 那顆 ⚠️ 按鈕的小視窗裡（見 `LayerPanel` 的 `LayerNotes`）。
 *
 * ⚠️ 但**逐筆不同**的東西一定要留在卡片上：`source`（混合來源，官方表只到 2022）
 * 與 `magMoment`（ML 與 Mw 分歧）都是這一筆自己的事實，不是圖層的性質。
 * 底部的 `資料來源` 連結也一樣不能拿掉——那是全站每張卡片都有的署名。
 */

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/**
 * 這一次地震的標題。
 *
 * 有地名就用地名（「高雄美濃」比「規模 6.4 地震」好認得多）；沒有地名的（臺灣地震
 * 那一層的 612 筆震央）退回規模。
 * ⚠️ 少數幾筆的地名本身就帶了事件名（維基原文寫「南投（集集大地震）」），再接一個
 * 「地震」會變成「…大地震）地震」，所以已含「地震」的就原樣用。
 *
 * ⚠️ **抽出來是因為詳情面板的標題列也要用它**（`useDetailTitle()`）。兩邊各寫一份
 * 的話，面板頭與卡片標題會在「已含地震」「沒有地名」這兩種邊角上悄悄分歧。
 */
export function quakeTitle(p: GeoJSON.GeoJsonProperties): string {
  const place = str(p?.name);
  const mag = num(p?.mag);
  if (place) return place.includes("地震") ? place : `${place}地震`;
  return mag != null ? `規模 ${mag.toFixed(1)} 地震` : "地震";
}

/** 座標字串。⚠️ 位數要跟 geojson 的 `digits: 2` 一致，否則會暗示一個不存在的精度。 */
function formatCoord(lat: number, lng: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const ew = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return `${ns} ${ew}`;
}

export function QuakeCard({
  feature,
  sources,
}: {
  feature: GeoJSON.Feature;
  sources: readonly string[];
}) {
  const p = feature.properties ?? {};
  const mag = num(p.mag);
  const depth = num(p.depth_km);
  const date = str(p.date);
  // 以下只有「重大地震」那一層有（中央氣象署〈災害地震〉表）。
  // ⚠️ 欄位叫 `name` 不是 `place`——searchIndex 只認 `name`，見 build-geodata.mjs
  //    地名本身只有標題用得到，而標題已經抽成 quakeTitle()（面板頭共用同一份）。
  const harm = str(p.harm);
  /** 地震矩規模 Mw。只有跟 ML 差 0.3 以上時才會出現在資料裡。 */
  const magMoment = num(p.magMoment);
  /** ⚠️ 混合來源（官方表只到 2022），每一筆都要標得出來自哪裡。 */
  const source = str(p.source);
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
      <h4 className="feature-title">{quakeTitle(p)}</h4>
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

      {/* ⚠️ 芮氏規模 ML 與地震矩規模 Mw 是兩套量法，大地震尤其會分歧。
          課本與新聞講的是 ML，所以主要欄位用它，Mw 差得多時另外標。 */}
      {magMoment != null && (
        <p className="quake-alt-mag">地震矩規模 M_w 是 {magMoment.toFixed(1)}（上面的規模是芮氏規模 M_L）</p>
      )}

      {/* ⚠️ 這一層是混合來源：官方〈災害地震〉表只收到 2022 年，之後的另外補錄 */}
      {source && <p className="quake-alt-mag">本筆資料來源：{source}</p>}

      <p className="detail-sources">
        資料來源：
        <SourceLinks sources={[...sources]} />
      </p>
    </div>
  );
}
