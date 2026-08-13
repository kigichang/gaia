/**
 * Esri Shapefile（.shp + .dbf + .prj + .cpg）的最小讀取器。
 *
 * 為什麼需要它：國家公園範圍、自然保留區、野生動物保護區這些圖資，官方**只發布
 * SHP**（少數幾份另有 KML）。既有的兩支剖析器都接不上——lib/gml.mjs 只認得 NLSC
 * 的 GML、lib/kml.mjs 只認得水利署那份 KML——而 SHP 是二進位格式。
 *
 * 刻意不裝 GDAL／shapefile 套件：比照 lib/unzip.mjs 與 lib/simplify.mjs 的既有決定。
 * 這裡真正需要的只有「多邊形」一種圖形類型，格式又是公開規格裡最單純的那部分
 * （固定長度的表頭 + 一連串定長記錄），一百多行就讀得完。裝 GDAL 反而會讓
 * `npm run build:geodata` 從「clone 完就能跑」變成「先去裝一個 C++ 工具鏈」。
 *
 * ⚠️ **只支援多邊形**（shape type 5／15／25，即 Polygon 與它的 Z／M 變體）。
 * 遇到點或線會直接丟例外而不是回空陣列——靜默地產出 0 筆是這個專案踩過好幾次的
 * 失敗模式（見 build-geodata.mjs 對「轉換後 0 筆」的處理）。
 *
 * ## 兩個會咬人的地方
 *
 * 1. **座標不是經緯度**。臺灣的政府 SHP 一律是 TWD97 TM2 公尺座標，而且中央
 *    子午線有 121／119／117 三種（見 lib/twd97.mjs）。本模組一律讀 .prj 決定，
 *    輸出已經是 WGS84 經緯度。
 * 2. **繞行方向就是外環／內環的唯一線索**。SHP 沒有「這是洞」的欄位，規格是
 *    「外環順時針、內環逆時針」。本模組在讀取時**整份反轉**成 GeoJSON 的慣例
 *    （外環逆時針／帶號面積為正、內環順時針），之後整條管線就只有一種慣例。
 */
import { readZip } from "./unzip.mjs";
import { TM2_TAIWAN, tm2ToWgs84 } from "./twd97.mjs";

/** Polygon、PolygonZ、PolygonM。三者的座標段落起頭完全一樣，Z／M 值接在後面。 */
const POLYGON_TYPES = new Set([5, 15, 25]);
const NULL_SHAPE = 0;

/**
 * 從 .prj 的 WKT 取出 TM2 參數。
 *
 * 只做字串比對而不寫完整的 WKT 剖析器：這裡要的四個參數在 WKT 裡都是
 * `PARAMETER["名稱",數值]` 的固定形狀。⚠️ 但**投影名稱一定要檢查**——若上游哪天
 * 改發 UTM 或經緯度版本，同樣的四個參數名可能還在，卻是完全不同的意思。
 */
function parsePrj(wkt) {
  if (!wkt) return TM2_TAIWAN;
  // 已經是經緯度（GEOGCS 開頭、沒有 PROJCS）就不需要換算
  if (!/PROJCS/i.test(wkt)) return null;
  if (!/Transverse_Mercator/i.test(wkt)) {
    throw new Error(`.prj 不是橫麥卡托投影，本讀取器只認得 TWD97 TM2：${wkt.slice(0, 120)}`);
  }
  const param = (name, fallback) => {
    const m = new RegExp(`PARAMETER\\["${name}",\\s*(-?[\\d.]+)`, "i").exec(wkt);
    return m ? Number(m[1]) : fallback;
  };
  return {
    centralMeridian: param("Central_Meridian", TM2_TAIWAN.centralMeridian),
    scaleFactor: param("Scale_Factor", TM2_TAIWAN.scaleFactor),
    falseEasting: param("False_Easting", TM2_TAIWAN.falseEasting),
    falseNorthing: param("False_Northing", TM2_TAIWAN.falseNorthing),
  };
}

/**
 * .dbf（dBase III）屬性表。
 *
 * 編碼由 .cpg 決定；沒有 .cpg 就當 Big5——這份猜測對臺灣的政府圖資幾乎總是對的，
 * 而且猜錯只會讓中文欄位變亂碼，不會讓幾何出錯。
 */
function readDbf(buf, encoding) {
  const decoder = new TextDecoder(encoding);
  const text = (start, end) => decoder.decode(buf.subarray(start, end)).replace(/\0/g, "").trim();

  const recordCount = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);

  const fields = [];
  for (let p = 32; buf[p] !== 0x0d && p < headerLength; p += 32) {
    fields.push({
      name: text(p, p + 11),
      type: String.fromCharCode(buf[p + 11]),
      length: buf[p + 16],
    });
  }

  const records = [];
  for (let i = 0; i < recordCount; i++) {
    // 每筆記錄的第 1 個 byte 是刪除旗標
    let p = headerLength + i * recordLength + 1;
    const row = {};
    for (const field of fields) {
      const value = text(p, p + field.length);
      row[field.name] =
        (field.type === "N" || field.type === "F") && value !== "" && Number.isFinite(Number(value))
          ? Number(value)
          : value;
      p += field.length;
    }
    records.push(row);
  }
  return records;
}

/** shoelace 帶號面積的兩倍。正值＝逆時針。 */
export function signedRingArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

/** .shp 主檔：回傳每筆記錄的環（尚未分外環／內環）。 */
function readShp(buf, project) {
  const shapes = [];
  let offset = 100; // 主表頭固定 100 bytes
  while (offset + 8 <= buf.length) {
    const contentLength = buf.readInt32BE(offset + 4); // 以 16-bit word 計
    const end = offset + 8 + contentLength * 2;
    const type = buf.readInt32LE(offset + 8);

    if (type === NULL_SHAPE) {
      shapes.push([]);
    } else if (POLYGON_TYPES.has(type)) {
      // 8 bytes 記錄表頭 + 4 bytes 類型 + 32 bytes bbox
      let p = offset + 8 + 4 + 32;
      const partCount = buf.readInt32LE(p);
      const pointCount = buf.readInt32LE(p + 4);
      p += 8;
      const parts = [];
      for (let i = 0; i < partCount; i++) parts.push(buf.readInt32LE(p + i * 4));
      p += partCount * 4;

      const rings = [];
      for (let i = 0; i < partCount; i++) {
        const from = parts[i];
        const to = i + 1 < partCount ? parts[i + 1] : pointCount;
        const ring = [];
        for (let j = from; j < to; j++) {
          const q = p + j * 16;
          ring.push(project(buf.readDoubleLE(q), buf.readDoubleLE(q + 8)));
        }
        // ⚠️ 整份反轉成 GeoJSON 慣例（外環逆時針），見檔頭說明
        ring.reverse();
        rings.push(ring);
      }
      shapes.push(rings);
    } else {
      throw new Error(`shapefile 圖形類型 ${type} 不是多邊形，本讀取器只支援多邊形`);
    }
    offset = end;
  }
  return shapes;
}

/**
 * 把一筆記錄的環群組成 GeoJSON 的 polygon 陣列。
 *
 * 規格是「新的外環開始一個新的多邊形，之後的內環都屬於它」。反轉之後
 * 外環的帶號面積為正、內環為負，所以判斷條件就是面積的正負號。
 *
 * ⚠️ 內環出現在第一個外環之前（檔案壞掉或非標準寫出器）時**不能默默丟掉**：
 * 那多半代表繞行方向的假設不成立，靜默忽略會產出少了一塊的面。
 */
export function ringsToPolygons(rings, label = "") {
  const polygons = [];
  for (const ring of rings) {
    if (ring.length < 4) continue;
    if (signedRingArea(ring) > 0 || polygons.length === 0) {
      if (signedRingArea(ring) <= 0 && polygons.length === 0) {
        throw new Error(`${label}：第一個環是內環，繞行方向的假設不成立`);
      }
      polygons.push([ring]);
    } else {
      polygons[polygons.length - 1].push(ring);
    }
  }
  return polygons;
}

/**
 * 從一個 zip 裡讀出 shapefile。
 *
 * @param {Buffer} zipBuffer
 * @param {(name: string) => boolean} [pick] zip 內有多份 shapefile 時用來挑（比對主檔名）
 * @returns {{ features: { rings: [number, number][][], properties: Record<string, unknown> }[], projection: object|null }}
 */
export function readShapefileZip(zipBuffer, pick) {
  const entries = readZip(zipBuffer);
  const base = (name) => name.replace(/\.[^.]+$/, "");
  const shpEntries = entries.filter(
    (e) => e.name.toLowerCase().endsWith(".shp") && (!pick || pick(e.name)),
  );
  if (shpEntries.length !== 1) {
    const listed = entries.map((e) => e.name).join("、");
    throw new Error(`zip 內符合條件的 .shp 有 ${shpEntries.length} 個（內容：${listed}）`);
  }
  const stem = base(shpEntries[0].name);
  const sibling = (ext) => entries.find((e) => e.name === `${stem}${ext}`);

  const prj = sibling(".prj");
  const projection = parsePrj(prj?.read().toString("utf8"));
  const project = projection
    ? (x, y) => tm2ToWgs84(x, y, projection)
    : (x, y) => [x, y];

  const cpg = sibling(".cpg")?.read().toString("ascii").trim().toLowerCase();
  const encoding = cpg && cpg.replace(/[^a-z0-9]/g, "").startsWith("utf8") ? "utf-8" : "big5";

  const shapes = readShp(shpEntries[0].read(), project);
  const dbf = sibling(".dbf");
  const records = dbf ? readDbf(dbf.read(), encoding) : [];

  return {
    projection,
    features: shapes.map((rings, i) => ({ rings, properties: records[i] ?? {} })),
  };
}

/* ------------------------------------------------------------------------ *
 * 以下是 tw-basins（河川流域範圍圖 BASIN）專用的低階讀取器。
 *
 * ⚠️ 它跟上面的 `readShapefileZip` **慣例不同，不要混用**：這一組回傳的是
 * **未反轉、未投影**的原始 record（座標仍是 TM2 公尺），由呼叫端自己套
 * `tm2ToWgs84`；上面那組則已經反轉成 GeoJSON 慣例並轉成 WGS84 經緯度。
 *
 * 兩組並存是刻意的：`public/data/geo/tw-basins.geojson` 是照這一組的繞行方向
 * 產出並 commit 進 repo 的，改走 `readShapefileZip` 會讓每個環的座標順序整份
 * 反過來——那是一份產物資料的無謂改動，不是修正。新的 SHP 資料源一律用
 * `readShapefileZip`，這一組只留給 BASIN。
 * ------------------------------------------------------------------------ */

const SHAPE_TYPE_POLYGON = 5;

/**
 * 剖析 .shp 檔案內容，回傳每筆 record 的環。
 *
 * 回傳順序**與 record 順序一致**，呼叫端可以直接用陣列 index 跟同一份 zip 裡的
 * .dbf 屬性資料表對應（.dbf 的第 i 筆記錄就是這裡的第 i 筆）——這正是 SHP/DBF
 * 分離儲存的既定設計，不是巧合。
 *
 * ⚠️ 只處理**單一環、無孔洞**的多邊形（呼叫端應該自行檢查 `parts.length === 1`）
 * ——BASIN 圖資裡 26 個官方河川流域實測全部是這個形狀，沒有需要判斷外環／內環
 * （洞）纏繞方向的案例，所以沒有實作那段邏輯，遇到多環的 record 應該讓呼叫端
 * 丟例外，不要猜哪個環是洞。
 *
 * @param {Buffer} buf
 * @returns {{ parts: [number, number][][] }[]} 每筆 record 的所有環（parts）；
 *   Null shape（沒有幾何的記錄）回傳 `{ parts: [] }`。
 */
export function parseShpPolygons(buf) {
  if (buf.readInt32BE(0) !== 9994) {
    throw new Error("不是有效的 .shp（file code 不是 9994）");
  }
  const fileShapeType = buf.readInt32LE(32);
  if (fileShapeType !== SHAPE_TYPE_POLYGON) {
    throw new Error(`只支援 shape type 5（Polygon），拿到 ${fileShapeType}`);
  }

  const records = [];
  // header 固定 100 bytes；之後是逐筆 record
  let offset = 100;
  while (offset < buf.length) {
    // record header：record number（1-based，不使用）+ content length（16-bit words）
    const contentWords = buf.readInt32BE(offset + 4);
    const contentStart = offset + 8;
    const contentBytes = contentWords * 2;

    const shapeType = buf.readInt32LE(contentStart);
    if (shapeType === NULL_SHAPE) {
      records.push({ parts: [] });
    } else if (shapeType === SHAPE_TYPE_POLYGON) {
      // box(4 doubles=32B) 之後：NumParts(4B) NumPoints(4B) Parts[NumParts](4B each) Points[NumPoints](16B each)
      const numParts = buf.readInt32LE(contentStart + 36);
      const numPoints = buf.readInt32LE(contentStart + 40);
      const partsStart = contentStart + 44;
      const pointsStart = partsStart + numParts * 4;

      const partIndices = [];
      for (let i = 0; i < numParts; i++) {
        partIndices.push(buf.readInt32LE(partsStart + i * 4));
      }

      const points = [];
      for (let i = 0; i < numPoints; i++) {
        const p = pointsStart + i * 16;
        points.push([buf.readDoubleLE(p), buf.readDoubleLE(p + 8)]);
      }

      const parts = partIndices.map((start, i) => {
        const end = i + 1 < partIndices.length ? partIndices[i + 1] : numPoints;
        return points.slice(start, end);
      });
      records.push({ parts });
    } else {
      throw new Error(`record 型別 ${shapeType} 不是 Polygon（上游格式可能變了）`);
    }

    offset = contentStart + contentBytes;
  }

  return records;
}

/**
 * 最小的 .dbf 讀取器，只認 dBase III 的 Character（C）欄位。
 *
 * BASIN 的屬性表用到的欄位（`BASIN_NAME`…）都是文字，用不到 Numeric／Date 型別，
 * 所以沒有支援它們——遇到就會被當成文字讀出來，不會壞，只是沒意義（`AREA` 目前
 * 也是當文字讀出來再自己 `Number()`）。真的需要別的型別時再補，不要預先猜。
 *
 * @param {Buffer} buf
 * @returns {Record<string, string>[]} 每筆 record 一個物件，順序與 .shp 一致
 */
export function parseDbf(buf) {
  const numRecords = buf.readInt32LE(4);
  const headerSize = buf.readInt16LE(8);
  const recordSize = buf.readInt16LE(10);

  const fields = [];
  let offset = 32;
  while (buf[offset] !== 0x0d) {
    const name = buf.toString("ascii", offset, offset + 11).split("\0")[0];
    const length = buf[offset + 16];
    fields.push({ name, length });
    offset += 32;
  }

  const rows = [];
  let recordStart = headerSize;
  for (let i = 0; i < numRecords; i++) {
    const record = buf.subarray(recordStart, recordStart + recordSize);
    let pos = 1; // 第 0 byte 是刪除旗標
    const row = {};
    for (const field of fields) {
      row[field.name] = record.toString("utf8", pos, pos + field.length).trim();
      pos += field.length;
    }
    rows.push(row);
    recordStart += recordSize;
  }
  return rows;
}
