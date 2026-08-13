/**
 * 夠用的 CSV 剖析器（引號、跳脫引號、欄位內逗號與換行）。
 *
 * 不能用 `split(",")`：水庫的 `集水面積` 這類欄位的值是 `"48,100.00"`，千分位逗號
 * 在引號裡面；國家公園圖層彙整那份 CSV 的 `Description` 欄位同樣含逗號。
 * 比照 lib/simplify.mjs 與 lib/unzip.mjs 的既有作法，不加依賴。
 *
 * 本來寫在 lib/reservoirs.mjs 裡，國家公園的圖層索引也是 CSV 之後才搬出來——
 * 那支模組是「水利署開放資料的存取層」，放一個通用剖析器在裡面，別的地方要用
 * 就得 import 一個名字完全不相干的模組。reservoirs.mjs 仍然 re-export 它，
 * 既有的 import 路徑不受影響。
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  // 去掉 BOM——上游的 CSV 一律帶 BOM（JSON 才沒有），不去掉的話第一個欄位名
  // 會變成 "﻿民國年"，對不到任何欄位而且完全不報錯。
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r") { /* 忽略，交給 \n 收尾 */ }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()])),
  );
}
