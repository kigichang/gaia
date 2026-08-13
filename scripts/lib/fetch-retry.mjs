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
import { connect } from "node:http2";

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

/**
 * 抓一份二進位檔（zip、shapefile…），**必要時改走 HTTP/2**。
 *
 * ⚠️ Node 的 `fetch`（undici）只講 HTTP/1.1，而有些主機的下載端點**只接受
 * HTTP/2**：連線會在還沒回任何東西之前就被關掉，錯誤是一句沒有上下文的
 * `fetch failed / other side closed`，看起來像網路不穩或網址打錯。實測
 * `data.depositar.io`（台江國家公園界線的寄存處）就是這樣——同一台主機的
 * CKAN API 走 HTTP/1.1 完全正常，只有 `/download/` 那條路徑不行。
 *
 * 所以連線層級的失敗要再用 `node:http2` 試一次。http2 是 Node 內建模組，
 * 不是新依賴（比照 lib/unzip.mjs 用 zlib 自己讀 ZIP 的既有作法）。
 * HTTP 狀態碼類的失敗**不會**走到這裡——那是 `fetchWithRetry` 的責任。
 */
export async function fetchBuffer(url, attempts = 5) {
  try {
    return Buffer.from(await (await fetchWithRetry(url, attempts)).arrayBuffer());
  } catch (err) {
    if (!/fetch failed/i.test(err.message)) throw err;
    process.stdout.write("（改走 HTTP/2）");
    return http2Get(url);
  }
}

function http2Get(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = connect(target.origin);
    const fail = (err) => {
      client.close();
      reject(new Error(`${url} → HTTP/2 ${err.message}`));
    };
    client.on("error", fail);

    const request = client.request({ ":method": "GET", ":path": target.pathname + target.search });
    const chunks = [];
    let status = 0;
    request.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", fail);
    request.on("end", () => {
      client.close();
      if (status === 200) resolve(Buffer.concat(chunks));
      else reject(new Error(`${url} → HTTP/2 ${status}`));
    });
    request.end();
  });
}
