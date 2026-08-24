/**
 * 把 `src/content/geo/<collection>/<id>.json` 打包成
 * `public/data/geo-content/<collection>.json`（一個 collection 一份，key 是圖徵 id）。
 *
 * ## 為什麼要有這一層
 *
 * `src/content/index.ts` 對 `./geo/*​/*.json` 原本是 `import.meta.glob({ eager: true })`，
 * 所以 500 多份地理要素說明**全部**被打包進主 bundle：實測原始檔 680 KB，主 chunk
 * 的 gzip 因此多了一百多 KB，而那是**每一個進站的人**都要付的——即使他只打開一個
 * 圖層、只點一張卡。一個班 30 個學生同時開站時，這正是本站一路在避免的那種成本
 * （比照搜尋索引的 lazy 化與古蹟歷史沿革的縣市分片）。
 *
 * 分片之後，說明只在**真的點開那個 collection 的卡片時**才抓一次，而且與圖層資料
 * 一樣走 module-level 快取。
 *
 * ## 為什麼分片單位是 collection，不是逐筆
 *
 * 逐筆會變成 536 個請求；而一張卡打開之後，同一層的其他圖徵幾乎一定會被點到
 * （抽屜的可點清單就擺在旁邊）。這跟古蹟按縣市切成 21 份是同一個判斷：切到
 * 「使用者接下來很可能會用到的那一批」為止就好。最大的一份是 tw-rivers
 * （147 條、約 110 KB），仍然遠低於本站的單檔預算。
 *
 * ## ⚠️ 單一事實來源仍然在 `src/content/geo/`
 *
 * 這裡的產物是**衍生檔**，跟 `public/data/geo/` 一樣禁止手改：改內容要改
 * `src/content/geo/` 底下那一份，再跑 `npm run build:geo-content`。
 * `validate-content.mjs` 會逐 byte 比對兩邊，不同步就讓建置失敗——不然「編輯了
 * 內容卻忘了重新產生」在執行期是**完全靜默**的（卡片顯示的是上一版的文字）。
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
// 註冊表是刻意設計成純資料、Node 可直接載入的（見 registry/types.ts）。這裡需要它
// 是為了找出「圖層宣告了、但一份內容檔都沒有」的 collection，見 emptyCollections()。
import { allLayers } from "../../src/map/registry/index.ts";

export const GEO_CONTENT_SRC = "src/content/geo";
export const GEO_CONTENT_OUT = "public/data/geo-content";

/**
 * 讀 `src/content/geo/` 底下所有內容檔，回傳 `collection → { json, count }`。
 *
 * `json` 是**最終要寫進檔案的字串**（compact、結尾換行），兩個呼叫端——產生器與
 * 驗證器——比對的是同一個字串，所以不可能出現「格式不同但內容相同」的假警報。
 *
 * key 依檔名排序，確保產物是決定性的（重跑不會製造無意義的 diff）。
 */
export async function buildGeoContentShards(root) {
  const srcDir = join(root, GEO_CONTENT_SRC);
  const shards = new Map();
  let collections;
  try {
    collections = (await readdir(srcDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return shards;
  }
  for (const collection of [...new Set([...collections, ...emptyCollections()])].sort()) {
    const dir = join(srcDir, collection);
    const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
    const entries = {};
    for (const file of files) {
      const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
      entries[basename(file, ".json")] = raw;
    }
    shards.set(collection, { json: JSON.stringify(entries) + "\n", count: files.length });
  }
  return shards;
}

/**
 * 註冊表裡宣告了 `detail: { type: "geo", … }`、但 `src/content/geo/` 底下沒有對應
 * 目錄的 collection。理由見上面那一節。
 *
 * ⚠️ 三個位置都要看：圖層自己的 `detail`、`items.detail`（岩石分布的圖例單位、
 * 古蹟的級別）與 `attach.detail`（世界主要山脈的最高峰）。漏掉哪一個，那一層就
 * 會回到「每開一張卡撞一個 404」。
 */
function emptyCollections() {
  const cols = new Set();
  for (const { layer } of allLayers()) {
    if (layer.detail?.type === "geo") cols.add(layer.detail.collection);
    if (layer.items?.detail?.type === "geo") cols.add(layer.items.detail.collection);
    if (layer.attach?.detail?.type === "geo") cols.add(layer.attach.detail.collection);
  }
  return cols;
}
