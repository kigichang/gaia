/**
 * 幾何簡化與座標取位。
 *
 * 刻意自己寫而不是加 mapshaper／turf 依賴：CLAUDE.md 把所有版本鎖死，依賴面
 * 是刻意維持極小的，而這裡需要的只是 Douglas–Peucker 加四捨五入，四十行就夠。
 *
 * ⚠️ **已知限制：Douglas–Peucker 不保拓樸。** 相鄰的面（例如兩個縣市）各自簡化
 * 時，共用邊界會被簡化成兩條略有差異的線，放大後看得到次像素的縫隙。要保拓樸
 * 就得引入 mapshaper。免依賴的緩解方式是給那類圖層設 maxzoom，讓它在縫隙變得
 * 可解析之前就停止繪製——那同時也是正確的製圖判斷（縣市界的面染是小比例尺的
 * 教學裝置，不是 zoom 14 的圖層）。
 */

/** 點到線段的垂直距離平方（度數空間，用於相對比較已足夠）。 */
function sqSegDist(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas–Peucker（遞迴版本，改成明確堆疊避免深度過大時爆堆疊）。 */
function douglasPeucker(points, sqTolerance) {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > sqTolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

const round = (n, digits) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function simplifyRing(ring, sqTolerance, digits, minPoints) {
  let out = douglasPeucker(ring, sqTolerance);
  // 環（面）簡化過頭會退化成不成立的多邊形，至少要留 4 個點（含閉合點）
  if (out.length < minPoints) out = ring.slice();
  out = out.map((p) => [round(p[0], digits), round(p[1], digits)]);
  // 取位有可能讓首尾不再完全相等，面一定要閉合
  if (minPoints === 4) {
    const a = out[0];
    const b = out[out.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  }
  return out;
}

/**
 * 簡化單一 geometry。
 * @param {number} tolerance 度數（0.001° ≈ 111 公尺）
 * @param {number} digits 座標保留的小數位數
 */
export function simplifyGeometry(geometry, tolerance, digits) {
  const sq = tolerance * tolerance;
  const line = (coords) => simplifyRing(coords, sq, digits, 2);
  const ring = (coords) => simplifyRing(coords, sq, digits, 4);

  switch (geometry.type) {
    case "Point":
      return {
        ...geometry,
        coordinates: [round(geometry.coordinates[0], digits), round(geometry.coordinates[1], digits)],
      };
    case "LineString":
      return { ...geometry, coordinates: line(geometry.coordinates) };
    case "MultiLineString":
      return { ...geometry, coordinates: geometry.coordinates.map(line) };
    case "Polygon":
      return { ...geometry, coordinates: geometry.coordinates.map(ring) };
    case "MultiPolygon":
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((poly) => poly.map(ring)),
      };
    default:
      return geometry;
  }
}

/** 把字串轉成穩定的 kebab-case id（只留小寫英數與連字號）。 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
