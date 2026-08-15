// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import type { ThemeDefinition } from "../types.ts";

/**
 * 全球地理形貌。純資料——限制見 ../types.ts。
 *
 * 這個主題的骨架是**緯度**：先有赤道、南北回歸線、南北緯 30°／60° 這些參考線，
 * 才講得清楚為什麼沙漠帶落在南北緯 30° 附近（副熱帶高壓帶）、為什麼針葉林帶
 * 落在 60° 附近。所以緯度參考線預設打開，而且是唯一預設打開的圖層。
 *
 * 這一頁跟 /compare 的同緯度比較是互補的：這裡說明「為什麼緯度重要」，
 * /compare 則帶學生鑽進同一條緯度上的兩個地方看差異。
 */
export const globalTheme: ThemeDefinition = {
  id: "global",
  label: "全球地理形貌",
  subtitle: "用緯度帶當骨架，看森林與沙漠、洋流、板塊與地震帶如何分布。",
  camera: { center: [0, 10], zoom: 1.8 },
  recommendedBasemap: "liberty",
  groups: ["參考線", "氣候與生物群系", "海洋", "地體構造"],
  layers: [
    {
      id: "latitude-lines",
      label: "緯度參考線",
      group: "參考線",
      status: "ready",
      // 完全由程式產生，不需要檔案也不需要網路
      source: { type: "generated", generator: "latitude-lines" },
      render: {
        kind: "line",
        width: 1.2,
        // 虛線是製圖上「這是參考線、不是實體地物」的慣例
        dash: [3, 3],
        // 緯度線橫跨整個地球又筆直，用預設的 spacing 120 會在同一條線上
        // 重複放出一長串「赤道 赤道 赤道…」。這裡刻意調高。
        label: { property: "name", spacing: 320 },
      },
      colorRole: "reference",
      detail: { type: "none" },
      defaultOn: true,
      description: "赤道、南北回歸線、南北緯 30°／60° 與南北極圈。",
      sources: [],
    },
    {
      id: "date-line",
      label: "國際換日線",
      group: "參考線",
      status: "ready",
      /**
       * 這一條**不能**併進「緯度參考線」那個圖層：那一層是由緯度數值算出來的橫線，
       * 換日線是一條折線經線，兩者連幾何的產生方式都不同（見 generators.ts 與
       * build-geodata.mjs 的 `date-line`）。
       *
       * 樣式刻意跟緯度參考線**一模一樣**（同色、同虛線、同線寬）：兩者是同一類東西
       * ——製圖上的參考線，不是地表上的實體。畫面上它是唯一的直立線，本來就分得出來，
       * 不需要再給它一個顏色（`reference` 是非分類的固定角色，見 thematicColors.ts）。
       */
      source: { type: "remote", path: "data/geo/date-line.geojson" },
      render: {
        kind: "line",
        width: 1.2,
        dash: [3, 3],
        /**
         * ⚠️ **不要照抄緯度參考線的 320**。那是給九條各自很長的橫線用的；換日線
         * 被上游切成 5 段，單段在畫面上經常短於 320px——實測主題預設視角（zoom 1.8）
         * 用 320 是 **0 個標註**、240 是 1 個，200 才穩定拿到 2 個。
         * 1500×940 畫布實測 spacing 200：z1.8/2.6/3/4.5 各 2 個、z5 是 4 個
         * （那時折線段與 180° 段同時在畫面上，各自拿到標註）、z6 是 2 個，
         * 沒有出現同一個名字沿線連續重複的情形。
         */
        label: { property: "name", spacing: 200 },
      },
      colorRole: "reference",
      detail: { type: "none" },
      description:
        "往東越過減一天、往西越過加一天。它大致沿著 180° 經線，但為了不讓同一個國家跨在兩個日期上，繞開了俄羅斯楚科奇、阿留申群島、吉里巴斯與薩摩亞。",
      notes: [
        "⚠️ 這條線沒有國際條約規定，是各國各自公告時區的結果，所以它會變動：吉里巴斯在 1995 年把最東邊的萊恩群島改到線的西側，才形成現在往東凸出到西經 150° 的那一大塊。",
        "⚠️ 幾何取自 Natural Earth 的製圖用線，是世界尺度的標準畫法，不是條約界線；白令海峽兩座小島之間那一段這類細部已經簡化掉了。",
      ],
      sources: ["Natural Earth"],
    },
    {
      id: "quakes",
      label: "全球地震帶",
      group: "地體構造",
      status: "ready",
      source: { type: "remote", path: "data/geo/quakes.geojson" },
      /**
       * 半徑由震級驅動、**不畫白色外框**、半透明讓重疊處自然變深——這一層是密度場，
       * 教學內容是「地震帶沿板塊邊緣浮現」，不是逐一點選某一次地震。
       *
       * ⚠️ **下限 2.6 與不透明度 0.55 是這一層能不能被看見的門檻，不要往回調。**
       * 初版是 `1.5→6 / 0.35`，實測在**主題預設視角**（center [0,10]、zoom 1.8，
       * 也就是勾起這一層之後看到的第一眼）幾乎什麼都看不見：那個視角正中央是非洲
       * 與大西洋——全球最沒有地震的地方——而環太平洋全被推到畫面兩側，加上絕大多數
       * 圖徵落在 M6.5–7（半徑只有 1.5–2 px）、0.35 的灰點在淺色底圖上根本讀不出來。
       * `queryRenderedFeatures` 照樣回 1,829 筆，所以**只數圖徵是驗不到這件事的**，
       * 使用者看到的是「勾了圖層但地圖上沒有任何資料」。
       *
       * 現在的值實測在 zoom 1.8 就讀得出安地斯、中美洲、印尼、日本、喜馬拉雅與
       * 地中海－伊朗各條地震帶，zoom 4 的印尼一帶仍然是一顆顆分得開的點、不是糊塊。
       *
       * ⚠️ **不要為了「更清楚」加白框。** 同一個視角實測過 `strokeWidth: 0.6`：
       * 日本海溝與印尼一帶變成一片白色雜訊，連底圖的地名都被吃掉——那正是這一層
       * 一開始就決定不畫外框的原因（「臺灣地震」那一層相反，它只有 612 筆而且疊在
       * 忙碌的 NLSC 底圖上，白框才是把點拉出來的關鍵）。
       */
      render: {
        kind: "circle",
        radius: ["interpolate", ["linear"], ["get", "mag"], 6.5, 2.6, 9, 7],
        strokeWidth: 0,
        opacity: 0.55,
      },
      colorRole: "hazard",
      // 這是密度場不是清單，逐一點選單一地震沒有教學意義
      detail: { type: "none" },
      description:
        "1960 年以來規模 6.5 以上的地震。點會自己沿著板塊邊緣浮現出地震帶。",
      sources: ["USGS"],
    },
    {
      id: "plate-boundaries",
      label: "板塊邊界",
      group: "地體構造",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      description: "聚合、張裂與錯動三種板塊邊界，對照地震帶與火山帶的位置。",
      sources: ["USGS"],
    },
    {
      id: "volcanoes",
      label: "火山帶",
      group: "地體構造",
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "全球活火山分布，看環太平洋火環與地震帶的重疊。",
      sources: ["USGS"],
    },
    {
      id: "biomes",
      label: "森林與沙漠帶",
      group: "氣候與生物群系",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      schematic: true,
      description:
        "熱帶雨林、莽原、沙漠、溫帶林、針葉林的緯度帶狀分布，對照行星風系。",
      sources: [],
    },
    {
      id: "koppen-zones",
      label: "柯本氣候分區",
      group: "氣候與生物群系",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "柯本氣候分類的全球分區，與地點資料的 koppen 代碼互相對照。",
      sources: [],
    },
    {
      id: "wind-belts",
      label: "行星風系",
      group: "氣候與生物群系",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      schematic: true,
      description: "信風、西風、極地東風與副熱帶高壓帶——沙漠帶為什麼在 30° 的答案。",
      sources: [],
    },
    {
      id: "ocean-currents",
      label: "洋流（暖流／寒流）",
      group: "海洋",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      schematic: true,
      description: "黑潮、灣流、祕魯寒流等主要洋流，解釋同緯度海岸的冷暖差異。",
      sources: [],
    },
  ],
};
