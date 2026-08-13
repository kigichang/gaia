/**
 * 最小的 ESRI Shapefile（.shp）Polygon 讀取器。
 *
 * 為什麼需要它：水利地理資訊服務平台的「河川流域範圍圖」（BASIN）只提供 SHP，
 * 沒有 KML／GeoJSON（水庫蓄水範圍那份反而只給 KML）。SHP 是固定寬度的二進位格式，
 * 不像 GML／KML 那樣能用正規表示式對付，但格式本身很單純——比照 lib/gml.mjs／
 * lib/kml.mjs 的既有決定，這裡也不加 shapefile 讀取器依賴（也沒有 ogr2ogr／GDAL 可用）。
 *
 * ⚠️ 這**不是**通用 SHP 讀取器，只認得 shape type **5（Polygon，BASIN）**。遇到
 * 別的型別（點、線、Z/M 變體）會直接丟例外，不會靜默地把座標讀錯。
 *
 * 格式參考：ESRI Shapefile Technical Description（白皮書），record 結構固定為
 * 「8 bytes big-endian 表頭（record number, content length in 16-bit words）
 *   + little-endian 內容」。
 *
 * （這個檔案曾經也支援 PolyLine，用來剖析河川線圖資 RIVERLIN；「主要河川」現在改用
 * 手繪示意路徑，不再抓那份 SHP，PolyLine 支援與同名不同河的空間分群邏輯已隨之移除
 * ——見 CLAUDE.md「河川路徑」那節。真的需要 PolyLine 時，二進位版面跟 Polygon
 * 完全相同（Box + NumParts + NumPoints + Parts[] + Points[]），只是把下面的
 * shape type 從 5 換成 3，加回來很便宜。）
 */

const SHAPE_TYPE_NULL = 0;
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
    if (shapeType === SHAPE_TYPE_NULL) {
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
