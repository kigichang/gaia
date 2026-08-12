/**
 * OpenStreetMap Overpass API 的共用存取層（**只在建置期使用**）。
 *
 * ## 為什麼交通路線只能走 OSM
 *
 * 其他圖層的順序是「先找官方開放資料，找不到才手繪」，交通軸線兩條路都走不通：
 *
 * - **Natural Earth**：10m 的 roads／railroads 確實涵蓋臺灣（實測 79 條路、
 *   數十條鐵路），但**每一條的 `name` 都是 null**，而且被切成互不相連的碎段。
 *   一個「點了要開詳情卡」的教學圖層，圖徵沒有名字就等於不能用。
 * - **交通部 TDX**（運輸資料流通服務）有完整的路線圖資，但**要申請 API key**，
 *   直接撞上 CLAUDE.md 的硬性禁止事項 #1。政府資料開放平臺上的公路圖資多半是
 *   SHP，且沒有「國道一號是哪一條線」這種可直接取用的路線級幾何。
 * - **手繪**（比照五大山脈）在這裡特別不誠實：山脈的走向本來就沒有官方界線圖資，
 *   而高鐵與國道的線位是精確且公開的事實，畫成示意線等於把可查證的東西降級。
 *
 * OSM 免金鑰、有 CORS、路線關聯（route relation）原生就帶中文名，是唯一同時
 * 滿足「精確」「有名字」「不需要金鑰」的來源。授權是 ODbL 1.0，要求標示
 * 「© OpenStreetMap 貢獻者」——本站的世界底圖 OpenFreeMap 本來就是 OSM 衍生的，
 * 所以這個署名義務不是新的。
 *
 * ⚠️ **這支模組永遠不會在瀏覽器裡執行**（比照 lib/reservoirs.mjs）。Overpass 有
 * 明確的公平使用規範，一個班 30 個學生同時開站去打它是濫用；產物一律 commit
 * 進 repo，CI 也不會重跑（見 CLAUDE.md 的「部署」）。
 */

/**
 * 依序嘗試的端點。主站流量最大也最常 504，鏡像站反而穩定，
 * 所以**失敗就換下一個**而不是死等同一台。
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const LICENSE = "ODbL 1.0（© OpenStreetMap 貢獻者）";
export const SOURCE_LABEL = "OpenStreetMap";

/** 臺灣本島與離島的查詢範圍（南北緯、東西經）。 */
export const TAIWAN_BBOX = "21.8,119.9,25.4,122.2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 送一次 Overpass 查詢。
 *
 * ⚠️ **User-Agent 是必要的，不是禮貌**：Overpass 對沒有識別的 client 直接回
 * **HTTP 406**（實測 Node 的 fetch 預設 UA 每一次都被擋）。406 不是暫時性錯誤，
 * 退避重試永遠救不回來，所以這裡一定要帶。
 */
export async function overpassQuery(body, { attempts = 3 } = {}) {
  let lastError = "（沒有嘗試）";
  for (let round = 0; round < attempts; round++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": "gaia-geodata-build/1.0 (https://gaia.kigi.tw)" },
          body: new URLSearchParams({ data: body }),
          signal: AbortSignal.timeout(180_000),
        });
        if (res.ok) {
          const json = await res.json();
          if (!Array.isArray(json.elements)) throw new Error("回應沒有 elements");
          return json;
        }
        // 429（限流）與 504（查詢逾時）都是這個服務的日常，換一台就好
        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err.message;
      }
      await sleep(2000);
    }
    await sleep(5000 * (round + 1));
  }
  throw new Error(`Overpass 連續失敗（最後一次：${lastError}）`);
}

/**
 * 取一條路線關聯的所有 way 幾何。
 *
 * `selector` 必須**剛好**選中一個關聯，否則丟例外——比照
 * `resolveDataGovTwUrl()` 的既有作法。OSM 是眾人編輯的資料庫，關聯被拆開、
 * 改名或重建都可能發生；靜默地少抓一段（或把兩個方向都抓進來畫成雙線）
 * 遠比建置失敗難發現。
 */
export async function fetchRouteLines(selector) {
  const json = await overpassQuery(
    `[out:json][timeout:180];(${selector}(${TAIWAN_BBOX}););out geom;`,
  );
  const relations = json.elements.filter((e) => e.type === "relation");
  if (relations.length !== 1) {
    const names = relations.map((r) => r.tags?.name ?? `#${r.id}`).join("、") || "（無）";
    throw new Error(
      `選擇器 ${selector} 選中 ${relations.length} 個關聯（應為 1，現有：${names}），` +
        `上游可能已改名或重建，請重新確認`,
    );
  }
  const lines = [];
  for (const member of relations[0].members ?? []) {
    // 路線關聯裡也會有車站節點之類的成員，只取有幾何的 way
    if (member.type === "way" && member.geometry?.length > 1) {
      lines.push(member.geometry.map((p) => [p.lon, p.lat]));
    }
  }
  return { lines, name: relations[0].tags?.name ?? "" };
}

const endKey = (p) => `${p[0]},${p[1]}`;

/**
 * 把首尾相接的 way 串成連續的長折線。
 *
 * **這不是為了省檔案大小而已，是沿線標註的前提。** Overpass 回來的是 OSM 的
 * way，一條國道會被切成好幾百段（實測國道三號 708 段），而 maplibre 的
 * `symbol-placement: line` 是**逐一 LineString** 放置標註的：幾百段各長數百公尺
 * 的碎線，要嘛每一段都擠一個「國道3」、要嘛因為線段太短而一個都放不下
 * （見 CLAUDE.md「沿線標註很脆弱」）。串成幾條長線之後，放置演算法才有
 * 足夠平直的長線段可用。
 *
 * Douglas–Peucker 也一樣：它永遠保留每條線的頭尾兩點，所以對著 708 條
 * 六個點的碎線做簡化幾乎砍不掉任何東西。
 *
 * 用貪婪串接而不是求歐拉路徑：路線上有匝道、側線與雙線區間，本來就不保證
 * 是單一連通路徑，串不起來的段落各自留成獨立的線就好。
 */
export function stitchWays(lines) {
  const remaining = lines.map((l) => l.slice());
  /** 端點座標 → 還沒用掉的線在 remaining 裡的索引 */
  const index = new Map();
  const add = (key, i) => index.set(key, [...(index.get(key) ?? []), i]);
  remaining.forEach((line, i) => {
    add(endKey(line[0]), i);
    add(endKey(line[line.length - 1]), i);
  });

  const used = new Array(remaining.length).fill(false);
  /** 從 index 裡找一條還沒用掉、且某一端等於 key 的線 */
  const takeAt = (key) => {
    for (const i of index.get(key) ?? []) if (!used[i]) return i;
    return -1;
  };

  const out = [];
  for (let start = 0; start < remaining.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    let chain = remaining[start];

    // 先往尾端接，再往頭端接。起點 way 可能落在路線中段，所以**兩個方向都要走**
    // ——只往一個方向接的話，起點以前的那半條路線會全部散成碎段。
    for (const forward of [true, false]) {
      for (;;) {
        const tip = endKey(forward ? chain[chain.length - 1] : chain[0]);
        const next = takeAt(tip);
        if (next === -1) break;
        used[next] = true;
        let piece = remaining[next];
        if (forward) {
          // 往後接：piece 要以接點「開頭」，所以只有在它以接點結尾時才反轉
          if (endKey(piece[piece.length - 1]) === tip) piece = piece.slice().reverse();
          chain = chain.concat(piece.slice(1)); // slice(1) 去掉重複的接點
        } else {
          // 往前接：方向相反，piece 要以接點「結尾」——反轉的條件因此也相反。
          // ⚠️ 這裡兩個方向共用同一個條件式會靜默地接出鋸齒狀的錯誤幾何：
          // 線還是畫得出來、長度卻會膨脹（實測國道三號 431 km 變成 560 km），
          // 而且大部分 way 接不起來（716 段只串成 358 條）。
          if (endKey(piece[0]) === tip) piece = piece.slice().reverse();
          chain = piece.slice(0, -1).concat(chain);
        }
      }
    }
    out.push(chain);
  }
  // 長的線排前面：標註放置與可讀性都以主線為主
  return out.sort((a, b) => b.length - a.length);
}

/** 折線總長（公里）。只用來在建置日誌上核對串接結果，不寫進產物。 */
export function totalLengthKm(lines) {
  const R = 6371;
  let km = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [x1, y1] = line[i - 1];
      const [x2, y2] = line[i];
      const dx = ((x2 - x1) * Math.PI * Math.cos(((y1 + y2) / 2) * (Math.PI / 180))) / 180;
      const dy = ((y2 - y1) * Math.PI) / 180;
      km += Math.hypot(dx, dy) * R;
    }
  }
  return km;
}
