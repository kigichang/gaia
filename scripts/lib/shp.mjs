/**
 * 最小的 ESRI Shapefile（.shp）polyline 讀取器。
 *
 * 為什麼需要它：水利地理資訊服務平台的河川圖資（RIVERLIN）只提供 SHP，沒有 KML／
 * GeoJSON（水庫蓄水範圍那份反而只給 KML）。SHP 是固定寬度的二進位格式，不像 GML／
 * KML 那樣能用正規表示式對付，但格式本身很單純——比照 lib/gml.mjs／lib/kml.mjs 的
 * 既有決定，這裡也不加 shapefile 讀取器依賴（也沒有 ogr2ogr／GDAL 可用）。
 *
 * ⚠️ 這**不是**通用 SHP 讀取器，只認得 shape type **3（PolyLine）**——RIVERLIN 的
 * header 實測就是這個型別。遇到別的型別（點、面、Z/M 變體）會直接丟例外，不會
 * 靜默地把座標讀錯。
 *
 * 格式參考：ESRI Shapefile Technical Description（白皮書），record 結構固定為
 * 「8 bytes big-endian 表頭（record number, content length in 16-bit words）
 *   + little-endian 內容」。
 */

const SHAPE_TYPE_NULL = 0;
const SHAPE_TYPE_POLYLINE = 3;

/**
 * 剖析 .shp 檔案內容，回傳每筆 record 的線段。
 *
 * 回傳順序**與 record 順序一致**，呼叫端可以直接用陣列 index 跟同一份 zip 裡的
 * .dbf 屬性資料表對應（.dbf 的第 i 筆記錄就是這裡的第 i 筆）——這正是 SHP/DBF
 * 分離儲存的既定設計，不是巧合。
 *
 * @param {Buffer} buf
 * @returns {{ parts: [number, number][][] }[]} 每筆 record 的所有線段（parts）；
 *   Null shape（沒有幾何的記錄）回傳 `{ parts: [] }`。
 */
export function parseShpPolylines(buf) {
  if (buf.readInt32BE(0) !== 9994) {
    throw new Error("不是有效的 .shp（file code 不是 9994）");
  }
  const fileShapeType = buf.readInt32LE(32);
  if (fileShapeType !== SHAPE_TYPE_POLYLINE) {
    throw new Error(`只支援 shape type 3（PolyLine），拿到 ${fileShapeType}`);
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
    } else if (shapeType === SHAPE_TYPE_POLYLINE) {
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
      throw new Error(`record 型別 ${shapeType} 不是 PolyLine（上游格式可能變了）`);
    }

    offset = contentStart + contentBytes;
  }

  return records;
}

/**
 * 最小的 .dbf 讀取器，只認 dBase III 的 Character（C）欄位。
 *
 * RIVERLIN 的屬性表只有 `NAME`／`FROM` 兩個 C 欄位，用不到 Numeric／Date 型別，
 * 所以沒有支援它們——遇到就會被當成文字讀出來，不會壞，只是沒意義。真的需要
 * 別的型別時再補，不要預先猜。
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

/** 一個 part（點序列）的總長度，單位跟座標本身一致（RIVERLIN 是公尺）。 */
export function partLength(part) {
  let sum = 0;
  for (let i = 0; i < part.length - 1; i++) {
    sum += Math.hypot(part[i + 1][0] - part[i][0], part[i + 1][1] - part[i][1]);
  }
  return sum;
}

/**
 * 把一筆 record 的多個 part 依空間鄰近程度分群（bounding box 重疊，含緩衝距離）。
 *
 * 為什麼需要這個：RIVERLIN 是「依名稱字串」分筆，不是「依實際河川」分筆——同一個
 * 河川名稱在全國各地被獨立使用（例如「頭前溪」在新竹是知名大河，但同名的小溝渠
 * 在其他鄉鎮也存在），這些互不相連、相隔數十甚至上百公里的線段全部塞進同一筆
 * record 的 parts 裡。實測「北港溪」一筆記錄裡的 parts 甚至跨越整個西半部
 * （bbox 對角線超過 200 公里），而北港溪本身只有 82 公里長。
 *
 * 分群策略：兩個 part 的 bounding box（各自外擴 `bufferMeters`）只要相交就視為
 * 同一群——真正屬於同一條河的 parts 是舊資料手動數化時在交會點附近斷開的，
 * 斷點間距通常在數百公尺內；不相關的同名小溪則相隔數公里以上，不會被誤併。
 * 呼叫端接著會挑總長度最長的那一群，視為「這個名稱底下真正的主要河川」。
 *
 * @param {[number, number][][]} parts
 * @param {number} bufferMeters
 * @returns {[number, number][][][]} 分群後的 part 陣列（群組陣列）
 */
export function clusterParts(parts, bufferMeters) {
  const boxes = parts.map((part) => {
    const xs = part.map((p) => p[0]);
    const ys = part.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });

  const parent = parts.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < parts.length; i++) {
    const [x0, y0, x1, y1] = boxes[i];
    for (let j = i + 1; j < parts.length; j++) {
      const [X0, Y0, X1, Y1] = boxes[j];
      const overlaps =
        x0 - bufferMeters <= X1 && X0 <= x1 + bufferMeters &&
        y0 - bufferMeters <= Y1 && Y0 <= y1 + bufferMeters;
      if (overlaps) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < parts.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(parts[i]);
  }
  return [...groups.values()];
}
