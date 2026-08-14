import type { Map as MapLibreMap } from "maplibre-gl";
// 從 ids.ts 而不是 contour.ts 取常數：contour.ts 會載入 maplibre 與 DEM worker，
// 引用它就無法在 Node 底下測試排序邏輯（scripts/test-layer-order.mjs）。
import { CONTOUR_LABEL_LAYER_ID, CONTOUR_LINE_LAYER_ID } from "./layers/ids.ts";
import { geoLayerIds } from "./registry/index.ts";
import type { LayerRender } from "./registry/types.ts";

/**
 * 主題圖層的堆疊順序。
 *
 * ## 為什麼是冪等的後處理，而不是插入時給 beforeId
 *
 * 插入時指定 `beforeId` 在這裡很脆弱：
 *
 * 1. 正確的錨點取決於「當下還有哪些主題圖層存在」，而那是動態的。
 * 2. 主題圖層是一個一個加上去的，插入時各自算 beforeId 很容易互相打架。
 *
 * 後處理與插入順序無關、可自我修復，而且很便宜（有 early-return 閘門），
 * 所以每次套用圖層之後都跑一次。
 *
 * 排序正確的另一半條件是「等高線已經加回去了」，那是由
 * `MapView` 的 `onStyleApplied` 回呼保證的——見 useGeoLayers.ts 的說明。
 *
 * 這個坑實測過：主題圖層都是圓點時，被一條細棕線壓過去沒人發現；換成縣市界的
 * 半透明面就很明顯，而且**只有切過底圖才重現**。
 * 回歸測試在 `scripts/test-layer-order.mjs`（`npm run test:order`）。
 *
 * ## 目標堆疊（由下往上）
 *
 *   底圖填色／raster
 *   hillshade                （MapView 已用 firstSymbolLayerId 插在第一個 symbol 之前）
 *   底圖 symbol（地名）
 *   contour-lines
 *   主題 fill                 ← 面在最下面，才不會蓋掉線與點
 *   主題 line / outline
 *   主題 points
 *   主題 label
 *   contour-labels            ← 錨點；高程數字永遠壓在最上面才讀得到
 *
 * 兩個要記住的後果：主題面會蓋在底圖地名之上（所以 fill-opacity 上限 0.25），
 * 而整個主題區塊在 contour-lines 之上——河川與界線壓在地形之上是教學上正確的。
 */

const BAND: Record<string, number> = {
  // 依 DEM 高程設色的連續場（垂直植被帶）。它是**地形的著色**而不是疊在地形上的
  // 資料，所以排在所有主題圖層最下面——不然縣市界的外框、河川、圓點會被一整片
  // 半透明色蓋住。它仍然在 contour-lines 之上（整個主題區塊都是），但 45% 的
  // 不透明度讓等高線照樣透得出來，跟主題面的處境相同。
  elevation: -1,
  fill: 0,
  outline: 1,
  line: 1,
  points: 2,
  label: 3,
};

export interface OrderedInstance {
  instanceId: string;
  render: LayerRender;
}

export function enforceThemeLayerOrder(map: MapLibreMap, instances: OrderedInstance[]) {
  const ordered = instances
    .flatMap((i) => geoLayerIds(i.instanceId, i.render))
    .filter((id) => map.getLayer(id))
    .sort((a, b) => bandOf(a) - bandOf(b));

  if (ordered.length === 0) return;

  // 等高線標註即使被關掉（visibility: none）仍然存在於 style 裡，
  // getLayer() 照樣拿得到，所以關掉等高線不會讓排序失效。
  const anchor = map.getLayer(CONTOUR_LABEL_LAYER_ID) ? CONTOUR_LABEL_LAYER_ID : undefined;

  // 先便宜地檢查順序是否已經正確。這個 early return 是**必要的**，不是最佳化：
  // moveLayer 會觸發 styledata，styledata 又會呼叫這個函式，沒有這道閘門就會抖動。
  //
  // ⚠️ 三個條件缺一不可。只檢查「在 contour-labels 之下」是不夠的——切底圖後
  // 實測到的壞掉狀態正是 [主題圖層, contour-lines, contour-labels]：主題圖層確實
  // 在標註之下，但等高線壓在它們**上面**，而那正是要修的問題。少了 aboveContourLines
  // 這道檢查，函式會誤判成已經正確而直接 return，排序永遠修不好。
  const styleIds = map.getStyle().layers.map((l) => l.id);
  const positions = ordered.map((id) => styleIds.indexOf(id));
  const inOrder = positions.every((p, k) => k === 0 || p > positions[k - 1]);

  const anchorAt = anchor ? styleIds.indexOf(anchor) : -1;
  const belowAnchor = anchorAt < 0 || positions.every((p) => p < anchorAt);

  const contourAt = styleIds.indexOf(CONTOUR_LINE_LAYER_ID);
  const aboveContourLines = contourAt < 0 || positions.every((p) => p > contourAt);

  if (inOrder && belowAnchor && aboveContourLines) return;

  // 依序把每個圖層移到同一個錨點之前，跑完一輪之後它們的相對順序就等於陣列順序。
  // anchor 是 undefined 時 moveLayer 會移到最上層，結果一樣正確。
  for (const id of ordered) map.moveLayer(id, anchor);
}

function bandOf(layerId: string): number {
  const suffix = layerId.slice(layerId.lastIndexOf("-") + 1);
  return BAND[suffix] ?? 2;
}
