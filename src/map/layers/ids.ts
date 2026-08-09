/**
 * 內建疊加圖層的 source／layer ID 常數。
 *
 * 刻意獨立成一個**沒有任何 import** 的模組：`layerOrder.ts` 需要等高線的圖層 id
 * 來決定堆疊順序，但 `contour.ts` 會 value-import `demSource`（進而載入 maplibre
 * 與 web worker），所以只要引用它就再也無法在 Node 底下測試排序邏輯。
 *
 * 全站一律 import 這些常數，不要在別處寫死字串。
 */
export const CONTOUR_SOURCE_ID = "contour-source";
export const CONTOUR_LINE_LAYER_ID = "contour-lines";
export const CONTOUR_LABEL_LAYER_ID = "contour-labels";

export const DEM_SOURCE_ID = "dem";
/** 3D 地形用的 DEM 來源。與 hillshade 拆開可消除 maplibre 的共用來源警告，
 *  底層圖磚快取仍然共用，不會重複下載。 */
export const TERRAIN_SOURCE_ID = "dem-terrain";
export const HILLSHADE_LAYER_ID = "hillshade";
