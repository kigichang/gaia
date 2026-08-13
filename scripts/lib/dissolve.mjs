/**
 * 把一組**共用邊界的多邊形**合併成它們的聯集（dissolve）。
 *
 * ## 為什麼需要它
 *
 * 國家公園的官方圖資有一半不是「範圍圖」而是「土地使用分區圖」——墾丁、太魯閣、
 * 東沙環礁、澎湖南方四島、台江都只發布分區。那是一堆把園區鋪滿的分區多邊形
 * （生態保護區、特別景觀區、遊憩區…），直接畫出來，園區內部會布滿分區界線：
 * 面染是對的，但外框圖層會把每一條分區界都描出來，看起來像圖資壞掉。
 *
 * ## 為什麼可以用「有向邊相消」而不需要真正的多邊形裁剪演算法
 *
 * 一般的多邊形聯集要 Vatti／Martinez 那種掃描線裁剪器（上千行，還要處理浮點
 * 相交），但這裡的輸入不是任意多邊形：分區圖是從**同一份拓樸**切出來的，相鄰
 * 分區共用的那條邊在兩邊的檔案裡是**逐位元相同**的雙精度座標，只是繞行方向相反。
 *
 * 所以聯集的邊界＝「沒有被反向邊抵消掉的那些有向邊」。實測四份分區圖，邊的重數
 * 只有 1 與 2 兩種、沒有任何 3 以上，代表沒有部分重疊，這個前提成立。
 *
 * ⚠️ 前提不成立時（上游改成各自數化、出現 T 型接點）不會靜默產出爛結果：邊串不
 * 起來就丟例外，而且 build-geodata.mjs 會再用官方公告面積交叉比對。
 */

/** 頂點的雜湊鍵。相消靠的是逐位元相同，所以用完整精度、不做任何取位。 */
const key = (p) => `${p[0]},${p[1]}`;

/** shoelace 帶號面積的兩倍。正值＝逆時針。 */
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/** 射線法。點在環上或環內都算 true 就夠了（只用來把內環歸給外環）。 */
function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 有向邊相消。
 *
 * 回傳還活著的有向邊 `[a, b]`。同一條邊出現兩次以上同向（重疊而非相鄰）時會留下
 * 重複，交給串接階段處理。
 */
function surviveEdges(rings) {
  /** @type {Map<string, [number, number][][]>} 起點 → 由它出發的邊 */
  const outgoing = new Map();
  /** @type {Map<string, number>} 有向邊 → 還有幾條沒被抵消 */
  const counts = new Map();

  const add = (a, b) => {
    const forward = `${key(a)}|${key(b)}`;
    const backward = `${key(b)}|${key(a)}`;
    if (counts.get(backward) > 0) {
      counts.set(backward, counts.get(backward) - 1);
      return;
    }
    counts.set(forward, (counts.get(forward) ?? 0) + 1);
  };

  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      add(a, b);
    }
  }

  // counts 只留了字串，把座標找回來
  const vertices = new Map();
  for (const ring of rings) for (const p of ring) vertices.set(key(p), p);

  for (const [edge, n] of counts) {
    if (n <= 0) continue;
    const [from, to] = edge.split("|");
    const list = outgoing.get(from) ?? [];
    for (let i = 0; i < n; i++) list.push([vertices.get(from), vertices.get(to)]);
    outgoing.set(from, list);
  }
  return outgoing;
}

/**
 * 把存活的有向邊串成封閉環。
 *
 * 一個頂點可能有多條出邊（兩塊區域只在一點相接的「捏合點」）。這時**不能隨便挑**，
 * 否則會串出自相交的環。規則是取「相對於來路、逆時針方向最先遇到的那一條」，
 * 也就是沿著同一個面的邊界走——這是平面圖走面的標準作法。
 */
function chainRings(outgoing, label) {
  const rings = [];
  const angle = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);

  for (const [start, list] of outgoing) {
    while (list.length) {
      const first = list.shift();
      const ring = [first[0], first[1]];
      let previous = first[0];
      let current = first[1];

      while (key(current) !== start) {
        const candidates = outgoing.get(key(current));
        if (!candidates?.length) {
          throw new Error(
            `${label}：邊串不起來（斷在 ${current}），上游分區圖可能不再共用拓樸`,
          );
        }
        // 來路的反方向為基準，取逆時針方向角度最小的出邊
        const base = angle(current, previous);
        let best = 0;
        let bestTurn = Infinity;
        for (let i = 0; i < candidates.length; i++) {
          let turn = base - angle(current, candidates[i][1]);
          while (turn <= 0) turn += 2 * Math.PI;
          while (turn > 2 * Math.PI) turn -= 2 * Math.PI;
          if (turn < bestTurn) {
            bestTurn = turn;
            best = i;
          }
        }
        const [edge] = candidates.splice(best, 1);
        previous = current;
        current = edge[1];
        ring.push(current);
        if (ring.length > 1e6) throw new Error(`${label}：串接沒有收斂，資料可能有環路`);
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
}

/**
 * 合併共用邊界的多邊形。
 *
 * @param {[number, number][][]} rings 所有環（GeoJSON 慣例：外環逆時針、內環順時針）
 * @param {string} label 錯誤訊息用
 * @param {number} minArea 小於這個面積（座標單位²）的環一律丟掉，見下
 * @returns {[number, number][][][]} GeoJSON MultiPolygon 的 coordinates
 */
export function dissolveRings(rings, label = "dissolve", minArea = 0) {
  /**
   * ⚠️ **零面積的「來回線」一定要在這裡丟掉。**
   *
   * 上游的分區圖偶爾會有懸空的邊（兩個分區之間多描了一條線、或 T 型接點沒對齊）。
   * 相消之後它們不屬於任何一個面，串接時就會走出去再原路走回來，串出一個
   * **面積為零、但點數很多**的環。
   *
   * 它們不是無害的：帶號面積約等於 0 而略小於零，於是被判成「內環」、被指派給
   * 某個外環當洞，接著**外框圖層會把每一條來回線都畫出來**——園區裡憑空多出幾十
   * 條毛刺。實測墾丁那一份就是這樣，827 個退化環佔掉整個檔案將近三成的座標。
   * 面積計算完全正確（零面積不影響），所以只看面積對不對是抓不到的。
   */
  const chained = chainRings(surviveEdges(rings), label).filter(
    (ring) => Math.abs(signedArea(ring)) >= minArea,
  );
  const outers = [];
  const holes = [];
  for (const ring of chained) (signedArea(ring) > 0 ? outers : holes).push(ring);
  if (outers.length === 0) throw new Error(`${label}：合併後沒有任何外環`);

  const polygons = outers
    .map((ring) => ({ ring, area: Math.abs(signedArea(ring)), rings: [ring] }))
    // 由小到大找容器，內環才會歸給最貼身的那個外環（而不是最外面那個）
    .sort((a, b) => a.area - b.area);

  for (const hole of holes) {
    const owner = polygons.find((p) => pointInRing(hole[0], p.ring));
    // 找不到容器代表它其實是獨立的一塊、只是繞行方向反了，補正成外環比丟掉安全
    if (owner) owner.rings.push(hole);
    else polygons.push({ ring: hole, area: Math.abs(signedArea(hole)), rings: [hole.slice().reverse()] });
  }

  return polygons.sort((a, b) => b.area - a.area).map((p) => p.rings);
}

/**
 * 球面多邊形面積（平方公尺）。
 *
 * 只用來跟官方公告面積交叉比對——「dissolve 出來的東西是不是真的等於那座公園」
 * 這件事沒有別的檢查方式。用球面近似（誤差 < 0.5%）就夠了，公告面積本身也常常
 * 是不同年份、不同量法的數字。
 */
export function geodesicArea(polygons) {
  const R = 6378137;
  const rad = Math.PI / 180;
  let total = 0;
  for (const rings of polygons) {
    rings.forEach((ring, index) => {
      let sum = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
      }
      const area = Math.abs((sum * R * R) / 2);
      total += index === 0 ? area : -area;
    });
  }
  return total;
}
