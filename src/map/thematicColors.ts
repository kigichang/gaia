/**
 * Explore 頁三種主題圖層的顏色。
 *
 * 地形景點／原住民族分佈是固定單一色（清單靠點擊瀏覽，不靠顏色分類比較），
 * 特有種是唯一需要「依類別上色以便一眼比較」的圖層——多個物種疊圖時，
 * 顏色是分辨「這是哪個物種」的主要方式。
 *
 * 這裡的顏色組合已用 dataviz skill 的 scripts/validate_palette.js 驗證過
 * 明暗兩模式的色盲區辨度（--pairs all，因為核取方塊可以任意複選組合，
 * 不能只驗證清單裡「相鄰」的顏色）：
 *   - 地形景點藍 + 原住民族紅：兩色 all-pairs 全數 PASS
 *   - 物種三色（青／黃／紫）：三色 all-pairs 全數 PASS
 * 混色測試（例如把橘色也加進物種色票、或把物種色跟藍/紅混在一起做 5–6 色
 * all-pairs）都會失敗（橘配黃、青配洋紅在其中一種色盲模式下 ΔE 會掉到
 * 2–7，遠低於安全門檻），所以刻意只留這 5 個顏色、且物種色刻意跟兩個固定色
 * 錯開，不是隨手選的。**要改動或新增顏色，必須重新用 validate_palette.js
 * 驗證，不要憑感覺挑色。**
 *
 * 地圖圖層是 WebGL 畫布，深色模式不會跟著切換色票（比照 contour/hillshade
 * 既有做法固定寫死），所以這裡只有一組顏色，不分 light/dark。
 */
export const PLACES_COLOR = "#2a78d6";
export const INDIGENOUS_COLOR = "#e34948";

/** 物種比較色，依序指派。同時勾選超過這個數量時，UI 要限制不能再選。 */
export const SPECIES_COLORS = ["#1baf7a", "#eda100", "#4a3aa7"];

export const MAX_SIMULTANEOUS_SPECIES = SPECIES_COLORS.length;
