#!/usr/bin/env node
/**
 * `enforceThemeLayerOrder` 的回歸測試。
 *
 * 這個坑咬過兩次，而且**只在切底圖之後、而且只在部分底圖上重現**，用瀏覽器手動
 * 驗很容易漏掉（背景分頁下 maplibre 根本不觸發 rAF，測起來還會給出假的通過）。
 * 所以把排序邏輯本身抽出來用假的 map 物件測，不需要瀏覽器也不需要 maplibre。
 *
 * 用法：npm run test:order
 */
import { enforceThemeLayerOrder } from "../src/map/layerOrder.ts";

let failures = 0;
const check = (label, cond) => {
  console.log(cond ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (!cond) failures++;
};

/** 只實作 enforceThemeLayerOrder 會用到的那幾個 maplibre API。 */
function fakeMap(ids) {
  return {
    ids,
    getLayer(id) {
      return this.ids.includes(id) ? { id } : undefined;
    },
    getStyle() {
      return { layers: this.ids.map((id) => ({ id })) };
    },
    moveLayer(id, before) {
      const i = this.ids.indexOf(id);
      if (i < 0) return;
      this.ids.splice(i, 1);
      if (before == null) this.ids.push(id);
      else this.ids.splice(this.ids.indexOf(before), 0, id);
    },
  };
}

const INSTANCES = [
  // 高程設色（垂直植被帶）：整片半透明的地形著色，必須排在所有主題圖層**最下面**，
  // 否則縣市界的外框、河川與圓點會被它整片蓋掉
  { instanceId: "tw-vegetation-belts", render: { kind: "elevation" } },
  { instanceId: "tw-counties", render: { kind: "fill" } },
  { instanceId: "latitude-lines", render: { kind: "line", label: { property: "name" } } },
  // 帶白框的線（交通軸線）：白框必須夾在面與線之間——壓在面之下會被面染蓋掉，
  // 壓在線之上則會把線本身整條蓋成白色
  {
    instanceId: "tw-transport-thsr",
    render: { kind: "line", casing: true, label: { property: "shortName" } },
  },
  { instanceId: "places", render: { kind: "circle" } },
  { instanceId: "indigenous", render: { kind: "circle" } },
];

const THEME_IDS = [
  "tw-vegetation-belts-elevation",
  "tw-counties-fill",
  "tw-counties-outline",
  "latitude-lines-line",
  "latitude-lines-label",
  "tw-transport-thsr-casing",
  "tw-transport-thsr-line",
  "tw-transport-thsr-label",
  "places-points",
  "indigenous-points",
];

function assertStack(map, label) {
  const at = (id) => map.ids.indexOf(id);
  console.log(`\n${label}\n  → ${map.ids.join(" · ")}`);
  check("高程設色在等高線之上", at("contour-lines") < at("tw-vegetation-belts-elevation"));
  check("高程設色在面之下", at("tw-vegetation-belts-elevation") < at("tw-counties-fill"));
  check("面在等高線之上", at("contour-lines") < at("tw-counties-fill"));
  check("面在線之下", at("tw-counties-fill") < at("latitude-lines-line"));
  check("白框在面之上", at("tw-counties-fill") < at("tw-transport-thsr-casing"));
  check("白框在線之下", at("tw-transport-thsr-casing") < at("tw-transport-thsr-line"));
  check("線在點之下", at("latitude-lines-line") < at("places-points"));
  check("點在沿線標註之下", at("places-points") < at("latitude-lines-label"));
  check("全部在等高線標註之下", at("latitude-lines-label") < at("contour-labels"));
}

// ── 情境 1：實測到的壞掉狀態（切底圖後主題圖層被壓在 hillshade/contour 之下）──
{
  const map = fakeMap([
    "background",
    "nlsc",
    ...THEME_IDS,
    "hillshade",
    "contour-lines",
    "contour-labels",
  ]);
  enforceThemeLayerOrder(map, INSTANCES);
  assertStack(map, "情境 1：主題圖層原本被壓在等高線之下（切底圖後的實測狀態）");

  const before = map.ids.join();
  enforceThemeLayerOrder(map, INSTANCES);
  check("冪等：重複呼叫不再變動", before === map.ids.join());
}

// ── 情境 2：首次載入（主題圖層加在最上層，等高線已存在）──────────────────
{
  const map = fakeMap([
    "background",
    "water",
    "hillshade",
    "place-labels",
    "contour-lines",
    "contour-labels",
    ...THEME_IDS,
  ]);
  enforceThemeLayerOrder(map, INSTANCES);
  assertStack(map, "情境 2：主題圖層原本在最上層（蓋住高程數字）");
}

// ── 情境 3：等高線圖層還不存在（樣式剛換、MapView 尚未加回）────────────────
{
  const map = fakeMap(["background", "nlsc", ...THEME_IDS]);
  enforceThemeLayerOrder(map, INSTANCES);
  const at = (id) => map.ids.indexOf(id);
  console.log("\n情境 3：等高線尚未加回（不能爆掉，且主題圖層彼此順序要正確）");
  console.log(`  → ${map.ids.join(" · ")}`);
  check("面在線之下", at("tw-counties-fill") < at("latitude-lines-line"));
  check("白框在線之下", at("tw-transport-thsr-casing") < at("tw-transport-thsr-line"));
  check("線在點之下", at("latitude-lines-line") < at("places-points"));
  check("點在沿線標註之下", at("places-points") < at("latitude-lines-label"));
}

console.log(failures === 0 ? "\n圖層排序測試通過 ✓" : `\n圖層排序測試失敗（${failures} 項）`);
process.exit(failures === 0 ? 0 : 1);
