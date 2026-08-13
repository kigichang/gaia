/**
 * 最小的 ZIP 讀取器。
 *
 * 刻意自己寫而不是加 adm-zip／yauzl 依賴：比照 lib/simplify.mjs 的理由——這裡需要的
 * 只是「從一個政府網站給的 zip 裡把唯一那個檔案拿出來」，Node 內建的 zlib 已經有
 * inflateRaw，剩下的只是讀 ZIP 的目錄結構。
 *
 * 也刻意不用 `unzip` 指令：那會讓腳本相依於作業系統裝了什麼，而且得先把 zip 落地
 * 成暫存檔。這裡全程在記憶體裡做完。
 *
 * ⚠️ 只支援 store(0) 與 deflate(8)，不支援 ZIP64、不支援加密。政府資料開放平臺的
 * 圖資 zip 都在數 MB 等級，不會踩到 ZIP64（4 GB／65535 個檔案）的門檻；真的踩到了
 * 會在讀中央目錄時就丟例外，不會靜默地拿到壞資料。
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
/** general purpose bit 11：檔名是 UTF-8。沒設就是「作業系統預設編碼」。 */
const UTF8_NAME_FLAG = 0x0800;

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

/**
 * 解出 zip 目錄裡的檔名。
 *
 * ⚠️ 臺灣的政府圖資 zip 幾乎都是 Windows 上用中文檔名打包的，**沒有**設 UTF-8 旗標，
 * 檔名是 Big5 位元組。一律當 UTF-8 解會得到一串替換字元，於是像「這個 zip 裡有
 * 主要計畫圖與細部計畫圖兩份 shapefile，我要前者」這種挑選就完全做不到——而且
 * 失敗的樣子是「挑到了另一份圖資」，不會報錯。
 *
 * 判斷順序刻意是「旗標 → 嚴格 UTF-8 → Big5」而不是直接看旗標：有些打包工具會寫
 * UTF-8 檔名卻忘了設旗標，先試嚴格 UTF-8 就不會把它們誤解成 Big5。ASCII 檔名在
 * 兩種編碼下完全相同，所以既有的資料源不受影響。
 */
function decodeName(bytes, flags) {
  if (flags & UTF8_NAME_FLAG) return Buffer.from(bytes).toString("utf8");
  try {
    return utf8Strict.decode(bytes);
  } catch {
    return new TextDecoder("big5").decode(bytes);
  }
}

/**
 * 列出 zip 內的所有檔案（不解壓）。
 * @param {Buffer} buf
 * @returns {{ name: string, read: () => Buffer }[]}
 */
export function readZip(buf) {
  // End of Central Directory 在檔尾，前面可能還有註解，所以要往回掃。
  // 註解最長 65535 bytes，加上 EOCD 自己的 22 bytes 就是掃描上限。
  let eocd = buf.length - 22;
  const floor = Math.max(0, buf.length - 22 - 0xffff);
  while (eocd >= floor && buf.readUInt32LE(eocd) !== EOCD_SIGNATURE) eocd--;
  if (eocd < floor) throw new Error("不是有效的 zip（找不到 End of Central Directory）");

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`zip 中央目錄第 ${i} 筆的簽章不正確（可能是 ZIP64，本讀取器不支援）`);
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeader = buf.readUInt32LE(offset + 42);
    const flags = buf.readUInt16LE(offset + 8);
    const name = decodeName(buf.subarray(offset + 46, offset + 46 + nameLen), flags);

    entries.push({
      name,
      read() {
        // local header 的 extra field 長度**可以跟中央目錄那份不一樣**，
        // 所以資料起點一定要從 local header 自己讀，不能沿用上面的 extraLen。
        const localNameLen = buf.readUInt16LE(localHeader + 26);
        const localExtraLen = buf.readUInt16LE(localHeader + 28);
        const start = localHeader + 30 + localNameLen + localExtraLen;
        const raw = buf.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(raw);
        if (method !== 8) throw new Error(`${name}：不支援的壓縮方法 ${method}`);
        const out = inflateRawSync(raw);
        if (out.length !== uncompressedSize) {
          throw new Error(`${name}：解壓後 ${out.length} bytes，與目錄記載的 ${uncompressedSize} 不符`);
        }
        return out;
      },
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * 取出 zip 裡唯一符合條件的檔案內容（UTF-8 字串）。
 * 找不到或找到多個都視為上游改版，直接丟例外而不是猜。
 */
export function readZipText(buf, predicate) {
  const matches = readZip(buf).filter((e) => predicate(e.name));
  if (matches.length !== 1) {
    const names = readZip(buf).map((e) => e.name).join("、");
    throw new Error(`zip 內符合條件的檔案有 ${matches.length} 個（內容：${names}）`);
  }
  return matches[0].read().toString("utf8");
}
