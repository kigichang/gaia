/**
 * 指數退避的 fetch。
 *
 * 從 `build-geodata.mjs` 抽出來的（行為逐字不變），因為 `build-reservoirs.mjs`
 * 也要打同一批水利署端點，而那兩支腳本各自是可執行檔、不能互相 import
 * ——build-geodata 一被 import 就會開始下載。比照 lib/simplify.mjs 的既有作法：
 * 共用的東西放 lib，執行檔只負責組裝。
 *
 * 上游是 CDN 與公家服務，偶爾會 429 或 5xx。等待 5s／10s／20s…
 */
export async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || i === attempts - 1) throw new Error(`${url} → HTTP ${res.status}`);
    const waitMs = 5000 * 2 ** i;
    process.stdout.write(`（${res.status}，${waitMs / 1000}s 後重試）`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("unreachable");
}
