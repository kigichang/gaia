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
 * 山脈稜線（五大山脈、世界主要山脈）。洋紅。
 *
 * 三色一起以 `--pairs all` 驗證過**明暗兩模式**：
 *   node scripts/validate_palette.js "#2a78d6,#d95926,#c23f8f" --pairs all --mode light|dark
 *   → 兩模式各五項全數 PASS（CVD 最差 ΔE 12.3、一般視覺最差 ΔE 16.7）
 *
 * 為什麼**不能**用直覺上最像山的棕色：等高線是 `rgba(120,78,42,.55)`、地形陰影是
 * `#5a4632`，兩者都是棕色而且正好是使用者會同時打開的圖層——山脈線畫成棕色就等於
 * 畫在它自己要說明的那片地形上看不見。綠色同樣不行：NLSC 通用電子地圖的山區底色
 * 就是綠的。
 *
 * 紫色 `#7a3fa6` 其實比較接近製圖上「構造分區」的慣例，但它在 **dark 模式的對比
 * 檢查只有 2.56:1（WARN）**；比照 boundary 橘的既有決定——地圖是 WebGL 畫布只能有
 * 一組固定色，所以挑「兩個模式都乾淨通過」的值。`#6d3f9e` 與物種紫 `#4a3aa7` 更是
 * 直接在 dark 模式的亮度帶 FAIL。
 */
export const RELIEF_COLOR = "#c23f8f";

/**
 * 交通軸線（高鐵、國道、臺鐵幹線）。翠綠。
 *
 * 四色一起以 `--pairs all` 驗證過**明暗兩模式**：
 *   node scripts/validate_palette.js "#2a78d6,#d95926,#c23f8f,#2da26d" --pairs all --mode light|dark
 *   → 兩模式各五項全數 PASS（CVD 最差 ΔE 8.3、一般視覺最差 ΔE 16.7）
 *
 * ## 這個顏色是算出來的，不是挑出來的
 *
 * 前三色（藍／橘／洋紅）已經把色相空間佔掉大半，第四色的可行區間非常窄。用
 * OKLCH 掃過整個色域（色相每 2.5°、L 0.44–0.78、C 0.10–0.30，逐點丟進
 * validate_palette.js 跑明暗兩模式的 all-pairs），**零 WARN 的候選只剩 21 個**，
 * 集中在兩處：色相 150–162° 的一段綠，以及兩個彩度極低、當地圖線太虛的淡紫。
 * 直覺上會先想到的選擇全都不合格：
 *
 *   - 紫 `#7a3fa6`／`#8335c3`／`#7b43b9` —— dark 模式對比只有 2.56–2.77:1（WARN），
 *     跟當初 relief 拒絕紫色是**同一個**原因，不是新問題。
 *   - 青綠 `#00857a`、`#007a8a` —— 直接 FAIL。
 *   - 綠 `#009e73` —— 對洋紅的 deutan ΔE 只有 6.2（WARN）。
 *
 * `#2da26d` 是那段綠裡兩個 binding 條件（對洋紅的 CVD 8.3 > 8.0、淺色模式對比
 * 3.15 > 3.0）餘裕最平衡的一點。**要換色請重跑掃描，不要憑感覺往旁邊挪**——
 * 這一格四周就是 WARN。
 *
 * ## 為什麼綠色在這裡可以，在 relief 卻不行
 *
 * 山脈被禁用綠色的理由是「NLSC 通用電子地圖的山區底色就是綠的，山脈線畫成綠色
 * 等於畫在它自己要說明的那片地形上看不見」。交通軸線的處境相反：它們絕大部分
 * 路段走在西部平原與海岸走廊，NLSC 在那裡是白／灰底；而且這一層的教學重點正是
 * 「路線**繞開**山地」。少數穿山路段（國道五號雪山隧道、北迴線、南迴線）是飽和
 * 翠綠對上 NLSC 的淡黃綠山區暈渲，色相與彩度都拉得開。
 */
export const TRANSPORT_COLOR = "#2da26d";

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
 * 水庫蓄水率的級距色（ordinal ramp）。
 *
 * ## 為什麼這一層可以用「顏色跟著數值走」
 *
 * 別的圖層顏色代表**圖層身分**，選取狀態只准動尺寸與外框（見 layers/geo.ts）。
 * 水庫是這條規則的一個明確例外，理由跟地震帶用震級驅動半徑是同一個：`percent`
 * 是這個圖徵**自己的資料屬性**，不是 UI 狀態。而且這一層存在的理由就是即時水情
 * ——全部畫成同一顆藍點，「哪幾座水庫快見底了」就得一顆一顆點開才看得到，
 * 那正是這個圖層要回答的問題。
 *
 * ## 為什麼是單一色相由淺到深，不是紅→綠
 *
 * dataviz 的規則：sequential／ordinal ＝**一個色相**，由淺到深；紅綠交通號誌那種
 * 配色是 status 用的保留色，而且對紅綠色盲最不友善。單一藍色相在語意上也對：
 * 深藍＝水多，本來就是製圖上水深的畫法。它同時讓水庫留在「藍色＝水系」的家族裡，
 * 跟橘色的行政區、洋紅的山脈不會混淆。
 *
 * ## 驗證
 *
 * 級距是離散的圓點（不是連續 heatmap），所以用驗證器的 **`--ordinal`** 模式，
 * 不是分類色的 `--pairs all`——後者會把一條正確的 ramp 判 FAIL（它本來就橫跨
 * 整個亮度帶、相鄰步階刻意相近），那是設計如此，不是真的失敗。
 *
 *   node scripts/validate_palette.js "#86b6ef,#3987e5,#256abf,#184f95" --ordinal --mode light|dark
 *   → 兩模式各四項全數 PASS（單一色相、亮度單調、步階間距 ≥ 0.06、淺端 2.06:1）
 *
 * 色階直接取自 dataviz 參考色票的藍 ramp step 250／400／500／600。**不要往兩端
 * 再延伸**：step 200 `#9ec5f4` 在淺色模式只有 1.74:1、step 700 `#0d366b` 在深色
 * 模式只有 1.46:1，都低於 2:1 的下限（圖層抽屜與圖例的色塊是畫在會跟著主題
 * 變色的面板上，所以兩個模式都要過）。
 *
 * 「暫無資料」的灰刻意**不在 ramp 裡**：它是資料缺漏，不是「蓄水率很低」，
 * 混進色階等於謊報。`#7d7c76` 在明暗兩個面板上分別是 4.08:1 與 4.16:1。
 */
export const RESERVOIR_FILL_RAMP = {
  property: "percent",
  /** 由低到高。`below: null` 是最後一段（開放上界——滿庫溢流時會超過 100%）。 */
  steps: [
    { below: 20, color: "#86b6ef", label: "未滿 20%" },
    { below: 50, color: "#3987e5", label: "20–50%" },
    { below: 80, color: "#256abf", label: "50–80%" },
    { below: null, color: "#184f95", label: "80% 以上" },
  ],
  nodata: { color: "#7d7c76", label: "暫無資料" },
} as const;

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
  /** 山脈稜線（線）。洋紅——棕與綠都被地形本身佔走了，見上。 */
  relief: RELIEF_COLOR,
  /** 交通軸線（線）。翠綠——是掃過整個色域後僅存的可行區間，見上。 */
  transport: TRANSPORT_COLOR,
  /** 緯度參考線等參考幾何。中性色，非分類。 */
  reference: REFERENCE_COLOR,
  /** 地震帶等密度場。中性色，非分類。 */
  hazard: HAZARD_COLOR,
};
