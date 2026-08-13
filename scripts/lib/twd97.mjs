/**
 * TWD97 橫麥卡托二度分帶（TM2）→ WGS84 經緯度。
 *
 * 為什麼需要它：臺灣的政府圖資（國家公園範圍、自然保留區、野生動物保護區）
 * **一律以 TM2 公尺座標發布**，不是經緯度。GeoJSON 規格要求 WGS84 經緯度，
 * 所以這一步不能省。既有的資料源剛好都躲掉了——NLSC 的縣市界 GML 是
 * 「TWD97經緯度」版本、KML 規格本身就固定 WGS84——這是第一份非得換算的。
 *
 * 刻意不加 proj4 依賴：比照 lib/simplify.mjs 與 lib/unzip.mjs 的既有作法。
 * 這裡需要的只是**一個**投影的逆算式，而且是教科書上就有的橫麥卡托級數展開。
 *
 * TWD97 的橢球是 GRS80，與 WGS84 的差異在公分等級（兩者半長軸相同，扁率差
 * 1e-10），對一份簡化到 89 公尺容差的教學圖資完全無關，所以**不做基準面轉換**。
 *
 * ## ⚠️ 中央子午線不是只有 121
 *
 * 臺灣本島用 121°E（EPSG:3826），**澎湖、金門、馬祖用 119°E**（EPSG:3825），
 * 而東沙環礁的官方圖資用的是 **117°E**。三者的 .prj 都寫成同一個
 * `TWD_1997_TM_Taiwan` 投影名稱，只有 `Central_Meridian` 參數不同——
 * 寫死 121 的話，金門會被畫到福建內陸、東沙會掉進南海中央，而且**不會有任何
 * 錯誤訊息**，只是圖層出現在錯的地方。所以參數一律從 .prj 讀出來（見 shp.mjs
 * 的 `parsePrj`），不要在呼叫端寫死。
 */

/** GRS80。TWD97 與 WGS84 共用同一個半長軸，扁率差在公分等級（見上）。 */
const A = 6378137.0;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);

/**
 * @typedef {{ centralMeridian: number, scaleFactor: number, falseEasting: number, falseNorthing: number }} Tm2Params
 */

/** 臺灣本島的標準參數，也是 .prj 缺項時的預設值。 */
export const TM2_TAIWAN = {
  centralMeridian: 121,
  scaleFactor: 0.9999,
  falseEasting: 250000,
  falseNorthing: 0,
};

/**
 * TM2 公尺 → `[經度, 緯度]`（度）。
 *
 * 標準的橫麥卡托逆算式（Snyder, Map Projections – A Working Manual, 8-17～8-25）。
 * 級數展開到六次項，在本島的東西向範圍（距中央子午線 < 150 km）誤差遠小於公釐。
 *
 * 已用 round-trip 驗證過：把已知經緯度用對應的正算式投影成 x,y，再用這裡的反算式
 * 轉回經緯度，四個測試點（台北 101、玉山，以及 BASIN.shp 圖資本身的 bbox 四角）
 * 誤差都在 1e-8 度以下（浮點噪訊等級）。bbox 四角反算出來的範圍是北緯 21.9°–25.3°、
 * 東經 120.0°–122.0°，與臺灣本島＋周邊離島的實際地理範圍相符——這是數學自我一致
 * 之外的額外合理性檢查。
 *
 * @param {number} x 東距（公尺）
 * @param {number} y 北距（公尺）
 * @param {Tm2Params} params
 * @returns {[number, number]}
 */
export function tm2ToWgs84(x, y, params) {
  const { centralMeridian, scaleFactor: k0, falseEasting, falseNorthing } = params;
  const ep2 = E2 / (1 - E2);
  const dx = x - falseEasting;
  const m = (y - falseNorthing) / k0;

  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = A / Math.sqrt(1 - E2 * sin1 * sin1);
  const r1 = (A * (1 - E2)) / (1 - E2 * sin1 * sin1) ** 1.5;
  const d = dx / (n1 * k0);

  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
    cos1;

  return [(lon * 180) / Math.PI + centralMeridian, (lat * 180) / Math.PI];
}
