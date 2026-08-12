/**
 * 水利署「水庫蓄水範圍」KML 的剖析器。
 *
 * 為什麼需要它：水庫的官方位置只在這份圖資裡（`水庫基本資料` 那份 CSV 有容量、
 * 壩高、集水面積，就是**沒有座標**）。水利地理資訊服務平台只提供 SHP 與 KML，
 * SHP 要 ogr2ogr（外部二進位相依），KML 是純文字 XML，結構固定且淺——比照
 * lib/gml.mjs 與 lib/unzip.mjs，這裡同樣不加 XML parser 依賴。
 *
 * ⚠️ 這**不是**通用 KML 剖析器，只認得這一份的形狀：
 *   <Placemark>
 *     <name>曾文水庫</name>
 *     <description><![CDATA[ …HTML 表格，這裡不讀… ]]></description>
 *     <MultiGeometry>?<Polygon>
 *       <outerBoundaryIs><LinearRing><coordinates>lon,lat,alt lon,lat,alt …
 *
 * 兩個跟 GML 那支不一樣的地方，都會咬人：
 *   1. KML 的座標是**三元組**（lon,lat,alt），不是 GML 的二元組。
 *   2. `<description>` 裡是整段 CDATA HTML，內含大量 `<td>` 與屬性名稱。
 *      **一定要先把 description 切掉再找 `<coordinates>`**，否則遇到描述文字裡
 *      剛好出現的標籤會剖析出垃圾。
 *
 * 上游若改用 `<gx:Track>` 或把座標改成別的分隔方式，TRIPLE 檢查會讓它直接失敗，
 * 不會靜默產生空幾何。
 *
 * 座標參考系統：KML 規格固定為 WGS84，可直接當 GeoJSON 用。
 */

const PLACEMARK_RE = /<Placemark\b[\s\S]*?<\/Placemark>/g;
const NAME_RE = /<name>([\s\S]*?)<\/name>/;
const DESCRIPTION_RE = /<description>[\s\S]*?<\/description>/g;
const COORDS_RE = /<coordinates>([\s\S]*?)<\/coordinates>/g;
/**
 * lon,lat 或 lon,lat,alt——高度可有可無，但分隔一定是逗號。
 *
 * ⚠️ 數字要允許**科學記號**。這份 KML 的高度欄位長這樣：
 *   `120.8383494222414,24.18797379778662,-1.599837560206652e-005`
 * 少了 `[eE][-+]?\d+` 這一段，**每一個** token 都會被判成格式錯誤（實測 491/491），
 * 而錯誤訊息若又把 token 截斷在 40 字元，剛好會把 `e-005` 切掉，看起來就像
 * 一個完全正常的座標被莫名其妙地拒絕。所以下面的訊息保留 80 字元。
 */
const NUMBER = String.raw`-?\d+(\.\d+)?([eE][-+]?\d+)?`;
const TRIPLE = new RegExp(`^${NUMBER},${NUMBER}(,${NUMBER})?$`);

/** 「lon,lat,alt lon,lat,alt …」→ [[lon, lat], …]（丟掉高度） */
function parseRing(text) {
  const ring = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    if (!TRIPLE.test(token)) {
      throw new Error(`KML 座標格式不符（拿到「${token.slice(0, 40)}」），上游格式可能變了`);
    }
    const [lon, lat] = token.split(",");
    ring.push([Number(lon), Number(lat)]);
  }
  return ring;
}

/**
 * 剖析出 `[{ name, rings }]`。
 *
 * `rings` 是這個 Placemark 底下**所有**環（外環與內環一視同仁）。呼叫端只拿它
 * 算面積加權形心，不需要區分內外環——內環（島）的 shoelace 面積是反號的，
 * 用帶號面積加權剛好會把它從形心裡扣掉，這正是想要的行為。
 */
export function parseReservoirKml(xml) {
  const out = [];
  for (const placemark of xml.match(PLACEMARK_RE) ?? []) {
    const name = NAME_RE.exec(placemark)?.[1]?.trim();
    if (!name) continue;
    // ⚠️ description 的 CDATA 裡是整張 HTML 表格，先切掉再找座標（見上面說明）
    const body = placemark.replace(DESCRIPTION_RE, "");
    const rings = [];
    for (const match of body.matchAll(COORDS_RE)) {
      const ring = parseRing(match[1]);
      if (ring.length >= 3) rings.push(ring);
    }
    if (rings.length) out.push({ name, rings });
  }
  return out;
}

/**
 * 面積加權形心（shoelace）。
 *
 * 為什麼不用外接矩形中心：水庫是狹長的樹枝狀，bbox 中心經常會落在**水體外面**
 * 的山坡上（實測石門、曾文都是），而這個點會被拿去當「點一下飛過去」的目標。
 * 面積加權形心至少會落在水體的主體上。
 */
export function ringsCentroid(rings) {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (const ring of rings) {
    let a = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      a += cross;
      sx += (x0 + x1) * cross;
      sy += (y0 + y1) * cross;
    }
    if (Math.abs(a) < 1e-12) continue;
    area2 += a;
    cx += sx / 3;
    cy += sy / 3;
  }
  if (Math.abs(area2) < 1e-12) return null;
  return [cx / area2, cy / area2];
}
