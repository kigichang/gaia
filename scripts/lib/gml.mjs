/**
 * 內政部國土測繪中心（NLSC）行政區界線 GML 的剖析器。
 *
 * 為什麼需要它：政府資料開放平臺的行政區界線只提供 **SHP 與 GML** 兩種格式，沒有
 * GeoJSON。SHP 要 ogr2ogr（外部二進位相依，開發機得先裝 GDAL）；GML 是純文字 XML，
 * 而 NLSC 用的是很老派的 GML 2 寫法——幾何全部塞在 `<gml:coordinates>` 的
 * 「lon,lat lon,lat …」字串裡，結構固定且淺，正規表示式就夠了。比照 lib/simplify.mjs
 * 與 lib/unzip.mjs，這裡也不加 XML parser 依賴。
 *
 * ⚠️ 這**不是**通用 GML 剖析器，只認得 NLSC 這一份的形狀：
 *   <gml:featureMember><PUB_行政區域>
 *     <名稱>…</名稱>
 *     <涵蓋範圍><gml:MultiPolygon>
 *       <gml:polygonMember><gml:Polygon>
 *         <gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>…
 *         <gml:innerBoundaryIs>…（可有可無）
 * 上游若改用 GML 3 的 `<gml:posList>`（座標以空白分隔、不再有逗號），下面的
 * PAIR 檢查會讓它直接失敗，不會靜默地產生空幾何。
 *
 * 座標參考系統是 EPSG:3824（TWD97 地理坐標）。與 WGS84 的差異在公尺以下，
 * 遠小於本站的簡化容差，直接當成 GeoJSON 要求的 WGS84 使用。
 */

const FEATURE_SPLIT = "<gml:featureMember>";
const POLYGON_SPLIT = "<gml:polygonMember>";
const OUTER_RE = /<gml:outerBoundaryIs>[\s\S]*?<gml:coordinates>([\s\S]*?)<\/gml:coordinates>/;
const INNER_RE = /<gml:innerBoundaryIs>[\s\S]*?<gml:coordinates>([\s\S]*?)<\/gml:coordinates>/g;
const PAIR = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

/** 「lon,lat lon,lat …」→ [[lon, lat], …] */
function parseCoordinates(text) {
  const tokens = text.trim().split(/\s+/);
  return tokens.map((token) => {
    if (!PAIR.test(token)) {
      throw new Error(`座標字串不是「lon,lat」格式：${token.slice(0, 40)}`);
    }
    const [lon, lat] = token.split(",");
    return [Number(lon), Number(lat)];
  });
}

/**
 * 把 NLSC 行政區界線 GML 轉成 GeoJSON Feature 陣列。
 *
 * @param {string} xml
 * @param {string} nameTag 屬性欄位的標籤名（縣市界與鄉鎮界都是「名稱」）
 * @returns {{ properties: Record<string, string>, geometry: GeoJSON.MultiPolygon }[]}
 */
export function parseNlscGml(xml, nameTag = "名稱") {
  const nameRe = new RegExp(`<${nameTag}>(.*?)</${nameTag}>`);
  const members = xml.split(FEATURE_SPLIT).slice(1);
  if (members.length === 0) throw new Error("GML 裡找不到任何 gml:featureMember");

  return members.map((member, i) => {
    const name = nameRe.exec(member)?.[1];
    if (!name) throw new Error(`第 ${i} 筆 featureMember 沒有 <${nameTag}>`);

    const polygons = member
      .split(POLYGON_SPLIT)
      .slice(1)
      .map((chunk) => {
        const outer = OUTER_RE.exec(chunk);
        if (!outer) throw new Error(`${name}：polygonMember 缺 outerBoundaryIs`);
        // 每個 polygonMember 只含一個 Polygon，但 innerBoundaryIs 可以有多個
        const inners = [...chunk.matchAll(INNER_RE)].map((m) => parseCoordinates(m[1]));
        return [parseCoordinates(outer[1]), ...inners];
      });

    if (polygons.length === 0) throw new Error(`${name}：沒有任何 polygonMember`);
    return {
      properties: { [nameTag]: name },
      geometry: { type: "MultiPolygon", coordinates: polygons },
    };
  });
}

/**
 * 環的面積（度²，shoelace）。用於濾掉在圖層可見的縮放範圍內小於一個像素的離島。
 *
 * 度² 而不是平方公里是刻意的：這個門檻要跟 simplifyGeometry 的容差（也是度）用同一個
 * 尺度來想，而臺灣的緯度帶裡 1 度² ≈ 11,300 km²，換算是常數倍，不影響相對比較。
 */
export function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}
