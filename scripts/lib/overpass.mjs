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
 *
 * `role` 只在**河川**用得到（傳 `"main_stream"`）：`waterway` 關聯把支流以
 * `side_stream` 角色一起收進來，全抓會畫出整個水系而不是一條幹流。交通路線的
 * 關聯沒有這種角色區分，不傳這個參數時行為與過去逐位相同。
 */
export async function fetchRouteLines(selector, { role } = {}) {
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
    if (member.type !== "way" || !(member.geometry?.length > 1)) continue;
    if (role && member.role !== role) continue;
    lines.push(member.geometry.map((p) => [p.lon, p.lat]));
  }
  return { lines, name: relations[0].tags?.name ?? "" };
}

/** 一次查詢問幾個 `ref`。太大會讓 Overpass 逾時，太小又回到「一條一次」的浪費。 */
const REF_BATCH_SIZE = 30;

/**
 * 依 `ref`（水利署河川代碼）一次取回**多條**河川關聯的幾何。
 *
 * ## 為什麼不沿用 `fetchRouteLines()` 一條一條抓
 *
 * 交通軸線只有 7 條，一條一次很合理；河川有 **118 條**，一條一次實測要跑
 * **40 分鐘**——絕大部分時間花在撞限流之後的退避等待上。Overpass 有明確的公平
 * 使用規範，發 118 次查詢去拿一次就拿得完的東西，慢只是其中一個問題。
 *
 * ## ⚠️ 不可以用 `waterway=river` 當選擇器
 *
 * 踩過：118 條裡有一大半的小溪在 OSM 上是 **`waterway=stream`**（也有 `drain`、
 * `canal`），寫死 `["waterway"="river"]` 會在第一條小溪（小坑溪，102000）就
 * 選中 0 個而讓建置失敗。**共通的標籤是 `type=waterway`**（實測 150 個帶六位
 * 河川代碼的關聯全部都有），所以選擇器用它，河川的種類交給 `ref` 去分辨。
 *
 * ## 保留「剛好一個」那道防線
 *
 * `fetchRouteLines()` 靠「選中數不等於 1 就失敗」擋住上游改名或關聯被拆開；
 * 批次查詢一樣要有，而且**要逐個 ref 檢查**，不是只看總數——總數對得上但兩個
 * ref 各自少一個多一個的情況，只看總數是看不出來的。回傳前也確認沒有任何一個
 * 要求的 ref 落空。
 */
export async function fetchWaterwaysByRef(refs, { role } = {}) {
  /** ref → { lines, name, tags } */
  const out = new Map();

  for (let i = 0; i < refs.length; i += REF_BATCH_SIZE) {
    const batch = refs.slice(i, i + REF_BATCH_SIZE);
    const pattern = `^(${batch.join("|")})$`;
    const json = await overpassQuery(
      `[out:json][timeout:300];(relation["type"="waterway"]["ref"~"${pattern}"](${TAIWAN_BBOX}););out geom;`,
    );

    /** 這一批實際回來的關聯，依 ref 分組——同一個 ref 回兩個就是上游被拆開了 */
    const byRef = new Map();
    for (const el of json.elements) {
      if (el.type !== "relation") continue;
      const ref = el.tags?.ref;
      if (!batch.includes(ref)) continue; // 正規表示式理論上不會多給，但別假設
      byRef.set(ref, [...(byRef.get(ref) ?? []), el]);
    }

    for (const ref of batch) {
      const found = byRef.get(ref) ?? [];
      if (found.length !== 1) {
        const names = found.map((r) => r.tags?.name ?? `#${r.id}`).join("、") || "（無）";
        throw new Error(
          `河川代碼 ${ref} 在 OSM 上選中 ${found.length} 個 type=waterway 關聯` +
            `（應為 1，現有：${names}），上游可能已改名、被拆開或重建，請重新確認`,
        );
      }
      const relation = found[0];
      const lines = [];
      for (const member of relation.members ?? []) {
        // 關聯裡也會有水閘之類的節點成員，只取有幾何的 way
        if (member.type !== "way" || !(member.geometry?.length > 1)) continue;
        if (role && member.role !== role) continue;
        lines.push(member.geometry.map((p) => [p.lon, p.lat]));
      }
      out.set(ref, { lines, name: relation.tags?.name ?? "" });
    }
  }

  return out;
}

const endKey = (p) => `${p[0]},${p[1]}`;

/**
 * 方位角（弧度）。只用來在岔路上比較「哪一條比較直」，所以不必是真的大地方位角，
 * 把經度依緯度壓縮一下就夠了。
 */
function bearing(a, b) {
  const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.atan2(b[1] - a[1], dx);
}

/** 兩個方位角之間的夾角，0（完全同向）到 π（原路折返）。 */
function turnAngle(from, to) {
  const d = Math.abs(to - from) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/**
 * 接下去的轉角超過這個角度就不接（120°）。
 *
 * 這是「寧可斷成兩條，也不要接出折返」的取捨：折返的線畫得出來、長度卻是假的，
 * 而斷開只是多一條獨立的線（本來就允許，見下）。這幾條軸線的 way 粒度下沒有
 * 任何真實彎道會在**單一節點**上轉超過 120°——會的是阿里山線那種之字形登山鐵路，
 * 而那不在這個圖層裡。
 */
const MAX_TURN = (120 * Math.PI) / 180;

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
 *
 * ## ⚠️ 兩件讓幾何「畫得出來但長度是假的」的事
 *
 * 兩者的症狀一模一樣——線照樣渲染、標註照樣放，只有公里數對不上官方數字，
 * 所以**驗證方式是核對建置日誌印出來的長度**，不是看畫面。
 *
 * 1. **同一條 way 會出現在多個關聯裡。** 西部幹線是四個關聯併起來的，而
 *    海岸線的關聯把竹南以北、彰化以南跟縱貫線共用的路段整段收了進來（實測
 *    121 條重複、99.5 公里）；甚至同一個關聯自己也會重複收同一條 way。
 *    不去重的話貪婪串接會沿著 way 走出去、再沿它的分身走回來。
 * 2. **雙軌區間的兩條軌道都是關聯成員。** 兩條平行的 way 在交會處共用節點，
 *    走到底之後「接下一段」的候選裡就有一條是原路折返的另一條軌道。
 *    這個不是去重能解的——那兩條 way 是不同的實體。
 *
 * 所以這裡做兩件事：入口先去重（方向無關），接的時候在岔路上**挑最直的那條**
 * 並拒絕超過 `MAX_TURN` 的轉角。實測西部幹線 839.5 → 734.4 公里、
 * 自我折返的線從 5 條降到 0 條。
 */
export function stitchWays(lines) {
  // 去重：同一條 way 反過來寫也是同一條實體軌道，所以用「正向與反向取較小者」
  // 當 key。真的走兩趟同一段路的環狀路線會被併成一趟——這幾條軸線沒有這種東西，
  // 而把重複的軌道畫兩遍的代價（見上）遠大於這個假設出錯的風險。
  const seen = new Map();
  for (const line of lines) {
    const a = JSON.stringify(line);
    const b = JSON.stringify(line.slice().reverse());
    const key = a < b ? a : b;
    if (!seen.has(key)) seen.set(key, line);
  }
  const remaining = [...seen.values()].map((l) => l.slice());

  /** 端點座標 → 還沒用掉的線在 remaining 裡的索引 */
  const index = new Map();
  const add = (key, i) => index.set(key, [...(index.get(key) ?? []), i]);
  remaining.forEach((line, i) => {
    add(endKey(line[0]), i);
    add(endKey(line[line.length - 1]), i);
  });

  const used = new Array(remaining.length).fill(false);

  /**
   * 在接點上挑一條要接的線：**轉角最小的優先**，超過 `MAX_TURN` 的一律不接。
   *
   * `heading` 是目前這條鏈在接點上的行進方向；回傳的 `piece` 已經轉好方向
   * （往後接時以接點開頭、往前接時以接點結尾），呼叫端直接串上去就好。
   */
  const pickNext = (tip, heading, forward) => {
    let best = -1;
    let bestPiece = null;
    let bestTurn = Infinity;
    for (const i of index.get(tip) ?? []) {
      if (used[i]) continue;
      let piece = remaining[i];
      // ⚠️ 往後接與往前接的「要不要反轉」條件是**相反**的，共用同一個條件式
      // 會靜默地接出鋸齒狀的錯誤幾何（實測國道三號 431 km 變成 560 km、
      // 716 段只串成 358 條）。
      if (forward) {
        if (endKey(piece[piece.length - 1]) === tip) piece = piece.slice().reverse();
      } else {
        if (endKey(piece[0]) === tip) piece = piece.slice().reverse();
      }
      // 接上去之後，行進方向在接點上會變成什麼
      const outgoing = forward
        ? bearing(piece[0], piece[1])
        : bearing(piece[piece.length - 2], piece[piece.length - 1]);
      const turn = forward ? turnAngle(heading, outgoing) : turnAngle(outgoing, heading);
      if (turn < bestTurn) {
        bestTurn = turn;
        best = i;
        bestPiece = piece;
      }
    }
    if (best === -1 || bestTurn > MAX_TURN) return null;
    used[best] = true;
    return bestPiece;
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
        const heading = forward
          ? bearing(chain[chain.length - 2], chain[chain.length - 1])
          : bearing(chain[0], chain[1]);
        const piece = pickNext(tip, heading, forward);
        if (!piece) break;
        // slice 去掉重複的接點
        chain = forward ? chain.concat(piece.slice(1)) : piece.slice(0, -1).concat(chain);
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
