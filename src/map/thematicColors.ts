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
 * 既有做法固定寫死），所以地圖上只有一組顏色，不分 light/dark。
 * **但驗證時仍然要驗明暗兩模式**——理由不是地圖，是圖例與圖層抽屜的色塊：
 * 那些色塊用的是同樣的 hex，卻畫在會跟著主題切換的面板裡。
 * （不要把這一句「最佳化」掉，它解釋了為什麼規則 #10 要求驗兩個模式。）
 *
 * ## 圖層變多之後的策略：三組獨立色票
 *
 * 現有 5 色是當成**一組**做 all-pairs 驗證的，而註冊表會長到 ~20 個圖層，
 * 把同一個約束擴張上去不可能成立。出路是**形狀本身就在區辨**：18% 透明度的
 * 面染跟 6px 圓點是不同的視覺通道，沒有人會混淆。所以維持
 * `POINT_PALETTE` / `LINE_PALETTE` / `FILL_PALETTE` 三組，各自**組內**
 * all-pairs 驗證即可，跨幾何的配對不驗證也不需要驗證。
 * 每組再用 `MAX_ACTIVE_BY_KIND`（registry/types.ts）封頂，需求才維持在可解範圍。
 *
 * ⚠️ 這個模組刻意保持**零 import**：它被 Node 可讀的註冊表檔案 value-import，
 * 多一個 import 就可能讓 validate-content.mjs 的載入鏈斷掉。
 */
export const PLACES_COLOR = "#2a78d6";
export const INDIGENOUS_COLOR = "#e34948";

/** 物種比較色，依序指派。同時勾選超過這個數量時，UI 要限制不能再選。 */
export const SPECIES_COLORS = ["#1baf7a", "#eda100", "#4a3aa7"];

export const MAX_SIMULTANEOUS_SPECIES = SPECIES_COLORS.length;

/**
 * 線／面圖層的分類色。
 *
 * 已用 validate_palette.js 以 `--pairs all` 驗證過**明暗兩模式**：
 *   node scripts/validate_palette.js "#2a78d6,#d95926" --pairs all --mode light|dark
 *   → 六項檢查兩模式全數 PASS（CVD 最差 ΔE 25.4、一般視覺 ΔE 32.3，遠高於門檻）
 *
 * 行政區橘刻意用 `#d95926`（色票的 dark step）而不是 light step `#eb6834`：
 * 後者在 **dark 模式的亮度帶檢查會 FAIL**（L 0.671 超出 0.48–0.67）。地圖是
 * WebGL 畫布、只能有一組固定色，所以必須挑一個「兩個模式都過」的值，
 * 而不是各模式一個。這也是為什麼抽屜裡的色塊在深色主題下不會過亮。
 */
export const BOUNDARY_COLOR = "#d95926";
export const HYDROLOGY_COLOR = "#2a78d6";

/**
 * 非分類的固定色角色——比照 hillshade 的棕色與等高線的棕色，
 * **刻意排除在分類色票之外**，也不參與 all-pairs 驗證。
 *
 * `reference`（緯度參考線）是地圖的參考家具，不是一個要跟圖例比對色相的類別，
 * 所以用中性灰＋虛線；虛線本身就是製圖上「這是參考線不是實體」的慣例。
 *
 * `hazard`（地震帶）是**密度場**而不是分類圖層：教學內容是「地震帶沿板塊邊緣
 * 浮現」，不是「這個色相代表地震」。給它一個分類色相不但會擠爆色票驗證，
 * 2800 個不透明白框圓點在教室投影機上也只會是一坨看不懂的東西。
 * 所以用半透明中性色 + 依震級驅動半徑 + 不畫外框。
 */
export const REFERENCE_COLOR = "#5a5852";
export const HAZARD_COLOR = "#3a3a3a";

/**
 * 語意色角色 → 色碼。元件一律透過角色取色，不直接寫 hex。
 *
 * 只列**已驗證**的角色。要新增角色（boundary／hydrology／reference…）
 * 必須先跑 dataviz skill 的 validate_palette.js，並把通過與失敗的組合
 * 像上面那樣記錄下來——那段散文是至今沒有人弄壞色票的原因。
 */
export const LAYER_COLORS = {
  place: PLACES_COLOR,
  indigenous: INDIGENOUS_COLOR,
  /** 行政區（面＋外框）。橘。 */
  boundary: BOUNDARY_COLOR,
  /** 水系（線）。藍——河川用藍是製圖慣例。 */
  hydrology: HYDROLOGY_COLOR,
  /** 緯度參考線等參考幾何。中性色，非分類。 */
  reference: REFERENCE_COLOR,
  /** 地震帶等密度場。中性色，非分類。 */
  hazard: HAZARD_COLOR,
};
