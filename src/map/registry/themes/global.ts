// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import type { ThemeDefinition } from "../types.ts";
// value-import 只允許 thematicColors（零 import 的常數模組），見 ../types.ts 的說明
import { PLATE_BOUNDARY_COLORS } from "../../thematicColors.ts";

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
      id: "plates",
      label: "板塊",
      group: "地體構造",
      status: "ready",
      source: { type: "remote", path: "data/geo/plates.geojson" },
      /**
       * ⚠️ **`fillOpacity: 0` 不是忘了設。** 52 塊板塊鋪滿整個地球，任何均勻的面染
       * 都只是把整張圖壓暗一階，資訊量是零（跟縣市界那種「面染標出範圍」的處境
       * 完全相反）。這一層畫出來的是**外框（板塊界線）與名字**；面本身留給
       * 「選取時 0.38」那個互動——點一下才看得出這塊板塊有多大，那才是重點。
       */
      render: {
        kind: "fill",
        fillOpacity: 0,
        outlineWidth: 1,
        /**
         * ⚠️ 面的標註是新加的算繪能力（見 types.ts 的 `LayerRender.fill.label`）。
         * `minzoom: 2` 是實測調的：zoom 1 的全球視角上 52 個板塊名互相碰撞，
         * 放得出來的只剩幾個，而那個尺度使用者本來就還在看整體形狀。
         */
        label: { property: "name", size: 12, minzoom: 2 },
      },
      colorRole: "plate",
      detail: { type: "geo", collection: "plates" },
      // 清單依分類分三組（主要 8／次要 14／微板塊 30），組內依面積由大到小
      browse: { groupBy: "category" },
      maxzoom: 8,
      description:
        "地球表面分成 52 塊板塊。點一下任何一塊會標出它的範圍與面積，配合「板塊邊界」就看得出來它跟鄰居是相撞、分開還是錯開。",
      notes: [
        "⚠️ 主要板塊在這裡是 8 塊而不是課本說的 7 塊：本站採用的 Bird (2003) 模型把課本合稱的「印澳板塊」分成印度板塊與澳洲板塊兩塊。",
        "⚠️ 面積由幾何算出來，跟課本或維基百科上的數字對不起來是正常的——那些數字多半把子板塊算進母板塊（例如北美板塊 7,590 萬 km² 含鄂霍次克與格陵蘭，本站分開算是 5,543 萬）。52 塊的面積總和實測 5.101 億 km²，正好是地球表面積。",
        "⚠️ 微板塊要不要算成獨立板塊，學界沒有共識，不同模型的數量從 20 幾塊到 100 多塊都有。",
      ],
      sources: ["Peter Bird (2003) 板塊模型", "Nordpil 板塊資料集", "維基百科 板塊列表"],
    },
    {
      id: "plate-boundaries",
      label: "板塊邊界",
      group: "地體構造",
      status: "ready",
      source: { type: "remote", path: "data/geo/plate-boundaries.geojson" },
      render: { kind: "line", width: 1.6 },
      /**
       * 三種邊界各一個核取方塊，用 `featureIds` 從母圖層那一份資料切出來
       * （交通軸線的既有作法）。
       *
       * ⚠️ 產物**刻意只有三筆圖徵**——每一種邊界是一個 MultiLineString，裡面有
       * 幾百段。`featureIds` 是寫在這個檔案裡的 id 清單，一段一筆的話那份清單會
       * 有 1,582 行；而逐段點選也沒有教學意義（要點開的是「這是哪一種邊界」）。
       *
       * ⚠️ 三個 id 是**同一個字串**（比照交通軸線）：geojson 的 `properties.id`、
       * 這裡的 item id、以及 `src/content/geo/plate-boundaries/<id>.json` 的檔名。
       * 三者一致，「點子項目名稱」與「點地圖上的線」才會開出同一張卡，
       * 「只顯示這一筆」的 filter 也才比對得到。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "divergent",
              label: "張裂型邊界",
              featureIds: ["divergent"],
              color: PLATE_BOUNDARY_COLORS[0],
              keywords: ["張裂", "分離", "中洋脊", "裂谷", "divergent"],
            },
            {
              id: "convergent",
              label: "聚合型邊界",
              featureIds: ["convergent"],
              color: PLATE_BOUNDARY_COLORS[1],
              keywords: ["聚合", "碰撞", "隱沒", "海溝", "convergent", "subduction"],
            },
            {
              id: "transform",
              label: "錯動型邊界",
              featureIds: ["transform"],
              color: PLATE_BOUNDARY_COLORS[2],
              keywords: ["錯動", "轉形", "平移", "transform"],
            },
          ],
        },
        maxActive: 3,
        palette: PLATE_BOUNDARY_COLORS,
        /**
         * 勾圖層時三種一起打開。理由同垂直植被帶：三種是同一份資料的三個切面，
         * 勾了圖層卻什麼都不顯示只會讓人以為壞了，而且它們共用同一個檔案，
         * 全開不多花任何成本。
         */
        defaultAll: true,
      },
      /**
       * ⚠️ **不可以退回 `type: "none"`。** 這一層只有三筆圖徵，而那三筆正好就是
       * 課本要講的三種邊界——「這一種是怎麼動的、造出什麼地形、哪裡看得到」
       * 沒有別的地方講得完（圖層說明只塞得下一句話）。內容檔在
       * `src/content/geo/plate-boundaries/`，三個 id 見上面 items 的說明。
       *
       * 留 `"none"` 還會壞掉一件事：`handleItemNameClick` 照樣會 setSelected，
       * 而 `DetailCard` 對 `none` 回 null——點抽屜裡的「張裂型邊界」會開出一張
       * **空白面板**（`data-detail-open` 仍是 true），完全靜默。垂直植被帶那一層
       * 也踩過同一個坑，見 themes/taiwan.ts 的說明。
       */
      detail: { type: "geo", collection: "plate-boundaries" },
      maxzoom: 8,
      description:
        "張裂型（板塊分開，中洋脊與裂谷）、聚合型（板塊相撞，海溝與造山帶）、錯動型（板塊錯開，轉形斷層）。點線或點名稱可以看各種邊界怎麼動、造出什麼地形；跟「全球地震帶」一起打開，就看得出地震沿著哪一種邊界排列。",
      notes: [
        "⚠️ 三種分類直接取自 Bird (2003) 對每一小段邊界的判定（中洋脊、大陸裂谷歸張裂；隱沒帶、海洋與大陸聚合帶歸聚合；海洋與大陸轉形斷層歸錯動），不是本站自己歸的。",
        "⚠️ 板塊邊界不是一條線而是一個帶：真實的變形區可以寬達數百公里（例如喜馬拉雅、加州），圖上那條線是模型的簡化。",
      ],
      sources: ["Peter Bird (2003) 板塊模型", "Nordpil 板塊資料集"],
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
