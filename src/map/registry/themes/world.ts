// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import type { ThemeDefinition } from "../types.ts";
// value-import 只允許 thematicColors（零 import 的常數模組），見 ../types.ts 的說明
import {
  BIOME_COLORS,
  CYCLONE_INTENSITY_RAMP,
  KOPPEN_COLORS,
  OCEAN_CURRENT_COLORS,
  PLATE_BOUNDARY_COLORS,
  PLATE_BOUNDARY_DASH,
  WIND_COLOR,
} from "../../thematicColors.ts";

/**
 * 氣壓帶的點線樣式（風帶的箭頭是實線）。
 *
 * ⚠️ 寫成有型別註記的常數而不是在 `items` 裡直接寫字面值：`dash` 的型別是
 * `[number, number]`，而陣列字面值在那個位置會被推論成 `number[]`（比照
 * `TRANSPORT_DASH` 的既有做法）。
 */
const PRESSURE_DASH: [number, number] = [1, 2.5];

/**
 * 世界地理。純資料——限制見 ../types.ts。
 *
 * ## 這個主題是「全球地理形貌」併進來之後的樣子（2026-08）
 *
 * 原本是兩個主題：`/theme/global`（全球地理形貌：緯度骨架、氣候與生物群系、洋流、
 * 板塊）與 `/theme/world`（世界地理：城市與大尺度地形水系）。兩者講的是同一張世界
 * 地圖的不同層次——「為什麼這一帶是沙漠」與「這一帶有哪些城市」本來就該疊在一起看
 * ——所以合併成一個主題，**全球尺度的圖層排在前面**（它們是骨架），世界地理原本的
 * 圖層接在後面。`/theme/global` 由 `App.tsx` 重導到這裡。
 *
 * 這個主題的骨架是**緯度**：先有赤道、南北回歸線、南北緯 30°／60° 這些參考線，
 * 才講得清楚為什麼沙漠帶落在南北緯 30° 附近（副熱帶高壓帶）、為什麼針葉林帶
 * 落在 60° 附近。
 *
 * 這一頁跟 /compare 的同緯度比較是互補的：這裡說明「為什麼緯度重要」，
 * /compare 則帶學生鑽進同一條緯度上的兩個地方看差異。
 *
 * ⚠️ **相機沿用原本「全球地理形貌」的 `[0, 10] / zoom 1.8`，不是舊世界地理的
 * `[30, 20] / zoom 2`。** 這不是隨手選的：火山帶的半徑與不透明度、全球地震帶的
 * 半徑下限、生物群系的外框、行星風系的標註間隔**全都是對著這個視角實測調出來的**
 * （見 CLAUDE.md 各節與驗證清單第 31–35 項）。換掉它等於讓那一整批實測值失效，
 * 而且會重演「勾了圖層但畫面上看不到東西」那個坑。
 *
 * ⚠️ **合併帶來一組新的同框色，其中一對是真的撞在一起的**：世界主要河流的水系藍
 * `#2a78d6` 與板塊邊界的聚合藍 `#2f74c9` 一般視覺 ΔE 只有 **2.1**（＝同一個顏色），
 * 而喜馬拉雅、安地斯、阿爾卑斯、札格洛斯這些聚合帶正好是大河的源頭。掃過整個
 * OKLCH 色域確認**換色救不了**（見 thematicColors.ts 的 `PLATE_BOUNDARY_COLORS`），
 * 所以改用本站既有的第二通道：板塊邊界改畫**虛線**。見那個圖層的說明。
 */
export const worldTheme: ThemeDefinition = {
  id: "world",
  label: "世界地理",
  subtitle: "用緯度帶當骨架，看氣候、洋流、板塊與地震帶如何分布，再鑽進世界重要城市的人文與地理條件。",
  camera: { center: [0, 10], zoom: 1.8 },
  recommendedBasemap: "liberty",
  groups: [
    // 全球尺度的骨架排前面
    "參考線",
    // 緊接在參考線後面、氣候帶之前：先讓學生在地圖上找到世界著名的地理景點，
    // 有了具體的地方可以指，後面的氣候帶、洋流、板塊才有東西可以掛上去。
    // 底下是九個圖層（海峽、運河、海角、湖泊…），2026-08 從原本的「作者精選」
    // 一層拆出來的，見下面那一段區塊註解。
    "世界櫥窗",
    "氣候與生物群系",
    "海洋",
    "地體構造",
    // 原本「世界地理」主題的分組接在後面
    "城市",
    // ⚠️ 這一組原本叫「國界與大洲」，底下掛著一個 `status: "planned"` 的「國界」圖層。
    // 2026-08 拿掉了：**兩種建議底圖本身就畫著國界**（OpenFreeMap Liberty 與 Positron
    // 都有 `boundary` 圖層），再疊一條自己的國界線只是把同一條線畫兩次，而且會多吃一個
    // 線圖層名額（`MAX_ACTIVE_BY_KIND.line` 是 3，這個主題已經有七個線圖層在搶）。
    // 「政治疆界 vs 自然地理界線」那個教學點由「大洲分區」的洲界負責——那才是底圖畫
    // 不出來的線。**不要把它加回來。**
    "大洲",
    "地形水系",
    "人文專題",
  ],
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
      // 幾何是算出來的，唯一的「資料」是回歸線與極圈用的轉軸傾角實際值（約 23.436°）
      sources: ["維基百科 轉軸傾角"],
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
      sources: ["Natural Earth 1:10m 地理線"],
    },

    // ── 世界櫥窗 ──────────────────────────────────────────────────────────
    //
    // 學生在世界地圖上第一個問得出口的是「那個最⋯⋯的地方在哪裡」，所以這一組排在
    // 參考線之後、氣候帶之前：先有具體的地方可以指，後面的氣候帶、洋流、板塊才有
    // 東西可以掛上去。
    //
    // ⚠️ **「世界之最」那兩層 2026-08 起暫時下架，等待重新設計**——是下架不是刪除：
    //   - `world-superlative-peaks`（圓點 5 筆）與 `world-superlative-ranges`
    //     （線 2 筆）的圖層定義在 git 裡（本檔更早的版本），要復原就是把那兩個物件
    //     貼回這個位置。
    //   - 內容檔 `src/content/geo/world-superlatives/`（7 份）與幾何
    //     `public/data/geo-manual/world-superlatives-peaks.geojson`、
    //     `public/data/geo/world-superlatives-ranges.geojson` 全部原封不動留著；
    //     後者仍由 `npm run build:geodata -- --only=world-superlatives-ranges`
    //     產生（那個資料集刻意沒動）。
    //   - 重新設計前請先讀 CLAUDE_WORLD.md 的「世界櫥窗」那幾節：為什麼是兩個圖層而
    //     不是一個、三座火山為什麼併進點圖層、以及「講不出憑據的『最』不收」這條
    //     判準，結論都記在那裡。
    //
    // ⚠️ **「作者精選」那一層 2026-08 拆掉了，改成底下這九個圖層。** 原本是
    // `world-picks`（17 個點）＋ `world-picks-areas`（2 條線）兩個核取方塊，類別
    // 只是 `browse.groupBy` 切出來的清單分組——要看海峽就得連湖泊、火山一起打開，
    // 而那一大段 `description` 從維蘇威一路講到貝加爾湖，勾任何一類都得讀完整段。
    // 現在每個類別自己就是一個核取方塊，說明與 `notes` 也各自歸位。
    //
    // 三件事跟著這個拆法綁在一起，改動前請一起看：
    //   1. **幾何仍然只有兩份**（`world-picks.geojson`、`world-picks-areas.geojson`），
    //      九層靠**圖層層級的 `featureIds`** 從那兩份切出來（見 types.ts）。九層共用
    //      `resolveLayerData` 的同一個快取項目，全開也只抓兩次。
    //   2. **內容 collection 九層共用 `world-picks`**：`src/content/geo/world-picks/`
    //      那 19 份與它的分片一個字都沒動，圖徵 id 在 collection 內唯一就夠。
    //   3. **九層全部 `exemptFromMaxActive`**：它們用的是固定角色色（點 `place` 藍、
    //      線 `reference` 中性灰），多開一層一個新色相都沒有增加，`MAX_ACTIVE_BY_KIND`
    //      那條「同時顯示幾個分類色還讀得動」的論證對它們不成立；而硬套上限就等於
    //      「想看海峽就不能看運河」，比拆之前更難用。判準寫在 types.ts，
    //      **不要拿它去豁免吃分類色票的圖層**，也不要因此去調高上限。
    //
    // ⚠️ 九層的顏色一律沿用既有角色，不要給它們新色相：POINT 色票已經是 all-pairs
    // 全過的飽和狀態（見 thematicColors.ts），而「藍點＝地圖上一個有詳情卡的地點」
    // 與「灰虛線＝示意／參考的線」都是本站記錄在案的規則。
    //
    // ⚠️ 圖徵在 geojson 裡的**檔案順序決定抽屜清單的順序**（`featureIds` 是過濾、
    // 不重排），七條海峽由西往東那條規則因此原封不動有效。
    {
      id: "world-picks-volcanoes",
      label: "火山與災害",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["vesuvius"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      /** 逐筆取景寫在 geojson 的 `properties.zoom` 上，所以這裡不設 `browse.zoom` */
      browse: {},
      description:
        "編者挑出來、值得在地圖上找一找的火山與災害現場。義大利的維蘇威火山——" +
        "西元 79 年那場噴發把山腳下的龐貝城整個埋起來，也留下人類第一份詳細的" +
        "火山噴發目擊記錄。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 收錄的活火山座標與「火山帶」那一層完全相同（同一份 GVP 資料），兩層一起打開時藍點與洋紅點會疊在同一個位置，那是刻意的。",
      ],
      sources: ["史密森尼學會 全球火山計畫（GVP）", "維基百科 西元79年維蘇威火山爆發"],
    },
    {
      id: "world-picks-landforms",
      label: "地形與地質",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["richat-structure"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來、值得在地圖上找一找的地形與地質現場。撒哈拉沙漠裡的理查特結構" +
        "（「撒哈拉之眼」）——那圈四十公里寬的靶心不是隕石坑，是被侵蝕削平的巨大穹丘。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 理查特結構直徑四、五十公里，這一層畫的那個點是它的中心，不是一個可以指認的地物；那圈同心圓要放大到 zoom 9 以上、並打開地形陰影才看得出來（本站的世界底圖是向量圖磚，不是衛星影像）。",
      ],
      sources: [
        "維基百科 理查特結構",
        "IUGS 全球地質遺產 理查特結構",
        "NASA 地球觀測站 理查特結構",
      ],
    },
    {
      id: "world-picks-ocean",
      label: "海洋",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["point-nemo"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來、值得在地圖上找一找的海上地點。南太平洋的尼莫點——離所有陸地" +
        "最遠的一點，退役的太空船都往那裡送。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 尼莫點是 1992 年用數位海岸線資料算出來的「海洋難達極」，海面上沒有任何地物，也沒有國際機構公告過它的官方座標；換一份海岸線資料重算，位置會有幾公里的出入。這一層畫的是常被引用的那組座標。",
      ],
      sources: ["維基百科 尼莫點", "美國國家海洋暨大氣總署 Bloop 聲響"],
    },
    {
      id: "world-picks-straits",
      label: "海峽",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      /**
       * ⚠️ 順序在這裡只是可讀性，真正決定抽屜清單順序的是 geojson 的檔案順序
       * （`featureIds` 是過濾、不重排）。再加一條海峽時**兩邊都要插在經度對的
       * 位置**，不能往尾巴丟。
       */
      featureIds: [
        "strait-of-gibraltar",
        "bosphorus",
        "bab-el-mandeb",
        "strait-of-hormuz",
        "strait-of-malacca",
        "taiwan-strait",
        "dobuchi-strait",
      ],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來的七條海峽。直布羅陀、博斯普魯斯、曼德、荷姆茲、麻六甲、臺灣海峽" +
        "由西往東一路扣住全球的海運航線（臺灣海峽是其中最繁忙的一條）；外加日本小豆島的" +
        "土渕海峽，只有 9.93 公尺寬，而「世界最窄的海峽」這個頭銜不是量出來的、" +
        "是官方登記出來的。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 七條海峽在可點清單裡是**由西往東依經度排**的（直布羅陀、博斯普魯斯、曼德、荷姆茲、麻六甲、臺灣海峽、土渕），那是刻意的：前六條剛好串成從大西洋到東亞的那條海運航線。",
        "⚠️ 荷姆茲海峽畫的是最窄處航道中間的一個點，不是整條海峽的範圍；那條水道長約 167 公里，要看清楚它多窄請放大到 zoom 7 以上。",
        "⚠️ 荷姆茲海峽那張卡裡有一段是**有時效**的（2026 年 8 月的通行量與滯留船數，已在內文寫明日期與出處）。這個站是純靜態的、不會自己更新，讀到時請以卡片上的日期為準。",
        "⚠️ 臺灣海峽畫的是維基百科條目所載座標處的一個點，落在海峽中段的水面上，**不是最窄處**（最窄的那一段在新竹南寮與福建平潭島之間，約 126 公里）。",
        "⚠️ 臺灣海峽那張卡裡有一段是**有時效**的（引用 IMF PortWatch 的每日通行艘次與 28 個咽喉點的排名，統計截到 2026 年 8 月 23 日，已在內文寫明），跟曼德海峽那張卡同一份資料、同一個更新問題。",
        "⚠️ 直布羅陀海峽與曼德海峽畫的是維基百科條目所載座標處的一個點，落在各自的主航道上（曼德那一筆在丕林島西側、比較深的馬雲海峽裡），不是整條海峽的範圍。",
        "⚠️ 博斯普魯斯海峽畫的是最窄處（約 700 公尺，魯梅利堡與安納托利亞堡之間）水道中間的一點，不是維基百科條目所載的北口座標——那張卡講的就是那 700 公尺。在這一筆的預設視角（zoom 10.5，實測每像素約 41 公尺）橫向掃過去大約 20 個像素寬，而整條 31 公里的海峽剛好整條進得了畫面。",
        "⚠️ 曼德海峽那張卡裡有一段是**有時效**的（引用 IMF PortWatch 的每日通行艘次，統計截到 2026 年 8 月 23 日，已在內文寫明）。那份資料每天都在更新，這個站是純靜態的、不會跟著動；讀到時請以卡片上的日期為準。",
        "⚠️ 麻六甲海峽畫的是海峽本身最窄處（約 38 公里）主航道中間的一個點，不是整條海峽——它全長約 930 公里、西北口寬達 250 公里。⚠️ 它也**不是**那個常被引用的 2.8 公里瓶頸：菲利普水道在更東南邊的新加坡海峽裡（美國能源資訊署把它算成麻六甲咽喉點的最窄處，嚴格說已經是另一條海峽了），卡片有把這件事講清楚。",
        "⚠️ 麻六甲海峽的石油流量是美國能源資訊署 **2016 年**的數字（每天 1,600 萬桶），跟荷姆茲那張卡引的 2022 年不是同一年——那是 EIA 專講麻六甲的最新一篇。比較兩條海峽時要連年份一起看。",
        "⚠️ 土渕海峽最窄處只有 9.93 公尺，而本站的地圖最多只能放大到 zoom 16（實測每像素約 1 公尺）。畫面上那條水道橫向只掃得到 5 個像素——比真實的 9.93 公尺還窄，因為向量圖磚的海岸線是化簡過的；再加上最窄處正好架著橋、上面還壓著這一層自己的圓點，看起來會像水道在那裡斷掉。底圖不是空拍影像，要看清楚請往兩側找那條藍色細線。",
        "⚠️ 土渕海峽畫的是最窄處（永代橋一帶）的一個點，不是整條海峽——它全長約 2.5 公里、最寬處約 400 公尺。國土地理院地名檢索回傳的那個座標是整條海峽的標註錨點，位置往北約 1 公里，跟這一層畫的不是同一個點。",
      ],
      sources: [
        "土庄町 土渕海峽",
        "日本國土地理院 地理院地圖（土渕海峽）",
        "美國能源資訊署 麻六甲海峽石油流量",
        "美國能源資訊署 曼德海峽石油與天然氣流量",
        "國際貨幣基金組織 PortWatch 每日咽喉點通行量",
      ],
    },
    {
      id: "world-picks-canals",
      label: "運河",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["panama-canal", "suez-canal"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來的兩條運河：巴拿馬與蘇伊士，人類自己挖出來的咽喉點，一條要把船" +
        "抬高 26 公尺、另一條一道船閘都不用。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 運河跟「海峽」刻意分成兩層，不是漏分：兩者是同一個主題（咽喉點）的兩種來源——一個是地形逼出來的、一個是人挖出來的，分開才講得出這件事，而兩張卡的「對照重點」都靠它。畫的都是運河中段水道上的一個點，不是任何一端的港口。",
        "⚠️ 巴拿馬運河與蘇伊士運河那兩張卡裡各有一段是**有時效**的（引用 IMF PortWatch 的每日通行艘次，統計截到 2026 年 8 月 23 日，已在內文寫明），跟曼德海峽、臺灣海峽、合恩角、好望角同一份資料、同一個更新問題——**要更新就六張卡一起更新**，它們互相引用對方的數字。",
      ],
      sources: [
        "維基百科 巴拿馬運河",
        "維基百科 蘇伊士運河",
        "國際貨幣基金組織 PortWatch 每日咽喉點通行量",
      ],
    },
    {
      id: "world-picks-capes",
      label: "海角",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["cape-horn", "cape-of-good-hope"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來的兩個海角：合恩角與好望角，運河出現之前繞過整塊大陸的那兩個轉角，" +
        "而它們的名字都比實際的位置有名（好望角不是非洲最南端，兩個大洋的分界其實是" +
        "從海角拉出去的一條經線）。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 海角跟「海峽」「運河」刻意分成不同層，不是漏分：海峽與運河是主要航線上的咽喉點，海角是那些航線走不通時剩下的那條路——兩張卡的「對照重點」都靠這個分工。組內依經度由西往東排（合恩角 −67.3°、好望角 18.5°）。",
        "⚠️ 合恩角畫的是智利合恩島南端岬頭上的一個點，不是德雷克海峽整條水道，也不是南美洲大陸的最南端——大陸最南端是麥哲倫海峽北岸的弗羅厄德角（53.93°S），比合恩角北了兩個緯度；比合恩角更南的還有迪亞哥·拉米雷斯群島。它被當成南美洲的南端是航海上的定義。",
        "⚠️ 好望角畫的是海角本身的岬頭（取自英文維基百科條目所載的座標）；中文維基百科條目所載的那組座標偏東約 1.4 公里，已經靠近東邊 1.2 公里處的開普角（Cape Point）——燈塔與觀景台在開普角，兩個岬頭常被混為一談。",
        "⚠️ 好望角不是非洲最南端（厄加勒斯角才是，在東南方約 150 公里），大西洋與印度洋的官方界線也是通過厄加勒斯角的東經 20 度經線。這一層收它正是為了講清楚這件事，不是把它當成兩大洋的分界點。",
      ],
      sources: [
        "維基百科 合恩角",
        "維基百科 好望角",
        "維基百科（英文） 海洋的界線",
        "國際貨幣基金組織 PortWatch 每日咽喉點通行量",
      ],
    },
    {
      id: "world-picks-lakes",
      label: "湖泊",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      featureIds: ["dead-sea", "caspian-sea", "lake-baikal"],
      render: { kind: "circle" },
      colorRole: "place",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      description:
        "編者挑出來的三個湖——死海、裏海與貝加爾湖，各自把「湖」這件事推到一個極端：" +
        "最低的湖面、最大的面積、最深也最古老。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 三個湖畫的都是湖體中央的一點，不是湖的範圍——本站沒有世界湖泊的面圖層，湖的形狀請看底圖。",
        "⚠️ 死海的水位每年還在下降一公尺以上，卡片上的 −440 公尺標的是 2026 年的值；任何一份資料寫的「陸地最低點」數字都要連年份一起看。",
      ],
      sources: ["維基百科 死海", "維基百科 裏海", "維基百科 貝加爾湖"],
    },
    {
      id: "world-picks-rift",
      label: "板塊與地形",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks-areas.geojson" },
      featureIds: ["east-african-rift"],
      /**
       * ⚠️ **虛線是必要的，不是裝飾。** 東非大裂谷是真實的地形，但它不是一條線——
       * 真正的裂谷是一組數十公里寬的地塹與斷層帶，畫成一條線就已經是示意了
       * （比照世界主要山脈的中軸線）。實線會讓它看起來像一條可以照著量的界線。
       *
       * 樣式沿用本站既有的參考線那一套（緯度參考線、國際換日線、海峽中線）。
       */
      render: { kind: "line", width: 1.4, dash: [3, 3], label: { property: "name", spacing: 200 } },
      /**
       * ⚠️ `reference` 中性灰，不是分類色——理由就是上一段：本站的「虛線＋中性灰」
       * 一直是「這是參考／示意的線，不是實體地物」的意思。它是非分類的固定角色，
       * 不參與三組色票的 all-pairs（比照緯度參考線與地震帶）。
       *
       * ⚠️ 因此它跟同主題的緯度參考線、國際換日線**長得一樣**。那是刻意的：它們
       * 確實是同一類東西。區辨靠沿線標註（這一層的 `label` 因此也是必要條件）。
       */
      colorRole: "reference",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      /**
       * ⚠️ `maxzoom: 8`：這條線再放大也只是一條線，而這一層畫的是一個**範圍**的
       * 示意。讓它在區域尺度就收掉，避免看起來像一條可以逐段追下去的界線。
       */
      maxzoom: 8,
      description:
        "編者挑出來、有範圍而不是一個點的地方：東非大裂谷——一塊大陸正在裂開，" +
        "而且看得到過程。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 這一層畫的線是示意的，但理由跟「傳說中的地方」那一層不同：東非大裂谷**是真實的地形**，只是真正的裂谷是一組數十公里寬的地塹與斷層帶，畫成一條線本身就已經是示意（比照世界主要山脈的中軸線）。",
        "⚠️ 東非大裂谷的東支（肯亞那一支）在「板塊邊界」那一層上**看不到任何線**，那不是漏畫：本站採用的 Bird (2003) 板塊模型把努比亞／索馬利亞的界線放在西支。兩層要一起看才是完整的裂谷。",
        "⚠️ 虛線與灰色跟「緯度參考線」「國際換日線」相同，那是刻意的（同一類東西：參考用的線，不是實體地物）。請以沿線的名稱判讀。",
      ],
      sources: ["USGS 認識板塊運動", "維基百科 東非大裂谷"],
    },
    {
      id: "world-picks-legend",
      label: "傳說中的地方",
      group: "世界櫥窗",
      status: "ready",
      source: { type: "remote", path: "data/geo-manual/world-picks-areas.geojson" },
      featureIds: ["bermuda-triangle"],
      /**
       * ⚠️ **虛線同樣是必要的，但理由跟「板塊與地形」那一層相反**：百慕達三角根本
       * 沒有官方界線（美國海軍與海岸防衛隊明講它不在任何官方海圖上），畫成實線正好
       * 會坐實那張卡要拆穿的東西。
       *
       * ⚠️ **不要把這兩層的語意收斂成「這裡畫的東西都不存在」**——那對東非大裂谷
       * 是錯的。兩層各自把自己的理由寫在 `notes` 裡。
       */
      render: { kind: "line", width: 1.4, dash: [3, 3], label: { property: "name", spacing: 200 } },
      /** `reference` 中性灰的理由與「板塊與地形」那一層相同，見那一層的說明 */
      colorRole: "reference",
      exemptFromMaxActive: true,
      detail: { type: "geo", collection: "world-picks" },
      browse: {},
      maxzoom: 8,
      description:
        "編者挑出來、有範圍而不是一個點的地方：百慕達三角——一個沒有官方界線的" +
        "「地方」，拿來練習怎麼查證一個聽起來很像真的說法。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。",
        "⚠️ 百慕達三角**沒有官方界線**，不存在於任何官方海圖上，各家畫法不同、面積從 130 萬到 390 萬平方公里都有。這一層畫的那個三角形是示意的，而理由跟「板塊與地形」那一層不同：那一層畫的是真實地形的簡化，這一層畫的東西本身就沒有界線。",
        "⚠️ 虛線與灰色跟「緯度參考線」「國際換日線」相同，那是刻意的（同一類東西：參考用的線，不是實體地物）。請以沿線的名稱判讀。",
      ],
      sources: ["美國國家海洋暨大氣總署 百慕達三角", "維基百科 百慕達三角"],
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
      sources: ["USGS 地震目錄"],
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
      /**
       * 52 塊板塊各有一份內容檔（`src/content/geo/plates/`，2026-08 補齊）。
       *
       * ⚠️ `hideLayerDescription` 因此**今天是 no-op**（有內容檔的圖徵不走 fallback），
       * 比照 `world-mountains` 與 `tw-rivers`：留著是為了規則一致——上游哪天多出一塊
       * 板塊而內容檔還沒寫時，卡片會是「名稱＋分類＋面積＋來源」，而不是把這段
       * 52 張卡逐字相同的圖層說明整片印上去。
       */
      detail: { type: "geo", collection: "plates", hideLayerDescription: true },
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
      /**
       * ⚠️ **虛線是合併主題之後被逼出來的第二通道，不是裝飾。**
       *
       * 「全球地理形貌」併進「世界地理」之後，這一層第一次跟**世界主要河流**同框，
       * 而聚合型邊界的藍 `#2f74c9` 對水系藍 `#2a78d6` 的一般視覺 ΔE 只有 **2.1**
       * ——那不是相近，是同一個顏色。而且它們真的會疊在一起：喜馬拉雅、安地斯、
       * 阿爾卑斯、札格洛斯這些聚合帶正好是大河的源頭。
       *
       * 換色救不了，這是掃出來的（見 thematicColors.ts 的 `PLATE_BOUNDARY_COLORS`）：
       * 水系藍是臺灣主題那組已驗證六色的一員、動不得，而在固定張裂橘＋錯動綠＋
       * 水系藍＋火山洋紅之後掃遍整個 OKLCH 色域，能替代聚合藍的候選**不是離洋流
       * 更近（h 280 一帶，對寒流藍掉到 9.5），就是淡到畫在藍色海面上看不見**
       * （h 200／L 0.82）。
       *
       * 所以改用本站既有的第二通道——**線型**（比照交通軸線的軌道虛線／公路實線，
       * 那裡也是「色相在色盲下必然不可分，只能靠線型補償」）。`[4, 1.5]` 是刻意
       * 偏長的實線段：邊界要讀得出「一條連續的帶」，不能碎成點。
       *
       * ⚠️ 這**不代表**這一層變成示意圖（它仍然 `schematic` 未標，幾何是 Bird 2003
       * 的實測模型）。虛線在這裡的語意是「這是模型化的界線」，跟圖層 notes 早就寫著
       * 的「真實的變形區可以寬達數百公里，圖上那條線是模型的簡化」一致。
       *
       * ⚠️ `dash` 的單位是**線寬的倍數**，所以選取強調把線寬 ×2.2 之後虛線比例不變。
       */
      render: { kind: "line", width: 1.6, dash: PLATE_BOUNDARY_DASH },
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
        "⚠️ 板塊邊界不是一條線而是一個帶：真實的變形區可以寬達數百公里（例如喜馬拉雅、加州），圖上那條線是模型的簡化——畫成虛線就是這個意思。",
        "⚠️ 聚合型邊界的藍跟「世界主要河流」的藍幾乎一樣，而喜馬拉雅、安地斯、阿爾卑斯正好是大河的源頭。兩層一起打開時請以線型判讀：板塊邊界是虛線、河流是實線且沿線標著河名。",
      ],
      sources: ["Peter Bird (2003) 板塊模型", "Nordpil 板塊資料集"],
    },
    {
      id: "volcanoes",
      label: "火山帶",
      group: "地體構造",
      status: "ready",
      source: { type: "remote", path: "data/geo/volcanoes.geojson" },
      /**
       * ⚠️ **半徑 3.2／不透明度 0.9／不畫外框，三個值都是被「主題預設視角」逼出來
       * 的，不要往回調。** 這一層第一眼看到的是 `center [0,10]、zoom 1.8`——正中央
       * 是全球最沒有火山的非洲與大西洋，環太平洋被推到畫面兩側。全球地震帶那次
       * 踩過同一個坑（1.5 px + 0.35 的灰點等於「勾了圖層但什麼都沒有」），
       * 這裡直接沿用它修好之後的量級。
       *
       * ⚠️ 半徑**不隨 zoom 變**：1,214 座火山裡有幾百座擠在日本、印尼與中美洲，
       * 放大時靠的是點與點之間拉開，不是點變大。
       *
       * ⚠️ **不畫白色外框**，理由同地震帶：1,214 個亮外框在教室投影機上會糊成一片
       * 白雜訊，而且這一層常常跟地震帶疊著看。要提高可讀性請動不透明度與半徑。
       */
      render: { kind: "circle", radius: 3.2, strokeWidth: 0, opacity: 0.9 },
      colorRole: "volcano",
      /**
       * ⚠️ **有卡片但沒有 `browse`**，這兩件事是分開的決定：
       *
       * - 有卡片：跟地震帶不同，每一座火山**都有名字**，還有類型、海拔與最後
       *   噴發年代——點下去讀得到具體的東西（比照 `tw-quakes` 的 612 個震央）。
       * - 沒有清單：1,214 列不是一份人能掃過去的清單。既有的判準就在這裡：
       *   `tw-quakes-major`（92 筆）有 browse、`tw-quakes`（612 筆）沒有。
       *
       * ⚠️ 沒有 `browse` 的連帶後果是**搜尋也找不到**（`searchIndex` 的
       * `indexesFeatures()` 看的就是這個旗標），所以搜「富士山」不會有結果。
       * 那是刻意的取捨：進索引代表每個學生一聚焦搜尋框就多付 285 KB。
       */
      detail: { type: "geo", collection: "volcanoes", hideLayerDescription: true },
      description:
        "全新世（約一萬年）以來噴發過的 1,214 座活火山。跟「板塊邊界」與「全球地震帶」疊在一起看，環太平洋火環就是聚合型邊界的那一圈。點任一座可以看它的類型、海拔與最後噴發年代。",
      notes: [
        "⚠️ 這裡的「活火山」是國際通用的定義：全新世（約一萬年）以來噴發過。所以富士山（最後噴發 1708 年）與大屯火山群（最後噴發 648 年）都算，而黃石、多巴這類「超級火山」反而不在名單裡——它們上次噴發是 7 萬年前，早於全新世。",
        "⚠️ 有 366 座（三成）標示「最後噴發年代不詳」：它們由地層或碳定年判定為全新世噴發過，但定不出年份，不是資料漏填。",
        "⚠️ 一個點代表的是**整座火山（或一整片火山區）的代表位置**，不是噴發口的精確座標；「火山區」「火山口列」這類條目本身就涵蓋數十公里。",
        "⚠️ 海底火山只收錄已知的部分（本層最深的一座在海面下 5,700 公尺）。洋底大部分區域沒有被詳細調查過，所以中洋脊沿線的點比實際稀疏。",
        "⚠️ 中文名只給臺灣的兩座與課本、新聞會叫出名字的知名火山（40 幾座），其餘沿用 GVP 的原名——1,214 座逐一翻譯既無法完成也無法查證。",
      ],
      sources: ["史密森尼學會 全球火山計畫（GVP）", "維基百科 火山列表"],
    },
    {
      id: "biomes",
      label: "森林與沙漠帶",
      group: "氣候與生物群系",
      status: "ready",
      /**
       * ⚠️ **這一層不是手繪示意圖，所以沒有 `schematic`。** 原本的規劃是畫幾條緯度
       * 長方形，但那只是把結論畫出來——這一層要教的是「為什麼沙漠帶在南北緯 30°」，
       * 而真實的分布正好會露出反例：同樣在 30° 附近，撒哈拉與阿拉伯連成一氣，
       * 東亞卻是森林（季風）。幾何取自 RESOLVE Ecoregions 2017，見 lib/biomes.mjs。
       */
      render: {
        /**
         * ⚠️ `fillOpacity` 取上限 0.25（見 types.ts：面疊在底圖地名之上）。這一層
         * 蓋滿所有陸地，再深一階就會把國名與河流全部悶掉。
         *
         * ⚠️ **外框在這一層的用途是「補縫」，不是畫界線**，所以是「寬一點、
         * 但跟面一樣半透明」這個組合。六類的幾何是上游逐一化簡出來的（不保拓樸），
         * 共用邊界對不齊，撒哈拉／薩赫爾之間會露出一條一條的白縫；畫一圈同色同
         * 不透明度的外框剛好蓋掉。⚠️ **不要改回預設的 0.9 不透明度**——1,900 多塊
         * 多邊形在中亞、安地斯與北極群島會織成一張線網，色帶本身反而讀不出來
         * （0.6 寬 × 0.9 實測就是那個樣子，比對過截圖；現在這組 1.0 × 0.15 是在 zoom 1.8 的
         * 全球視角與 zoom 3.6 的撒哈拉／薩赫爾交界兩邊都看過才定的）。
         */
        kind: "fill",
        fillOpacity: 0.25,
        outlineWidth: 1.0,
        outlineOpacity: 0.15,
      },
      /**
       * 六類各一個檔（比照古蹟與作物）：只勾「沙漠與乾旱地」就只抓 77 KB，
       * 不是整包 730 KB。顏色**固定綁在類別上**，不是依勾選順序指派——先勾苔原
       * 再勾沙漠時，沙漠仍然必須是紅褐色，否則圖例當場失效（比照古蹟三級）。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "tropical-forest",
              label: "熱帶雨林與季風林",
              source: { type: "remote", path: "data/geo/biomes-tropical-forest.geojson" },
              color: BIOME_COLORS["tropical-forest"],
              keywords: ["熱帶雨林", "季風林", "雨林", "紅樹林", "rainforest"],
            },
            {
              id: "savanna",
              label: "莽原與草原",
              source: { type: "remote", path: "data/geo/biomes-savanna.geojson" },
              color: BIOME_COLORS.savanna,
              keywords: ["莽原", "草原", "疏林", "大草原", "savanna", "grassland"],
            },
            {
              id: "desert",
              label: "沙漠與乾旱地",
              source: { type: "remote", path: "data/geo/biomes-desert.geojson" },
              color: BIOME_COLORS.desert,
              keywords: ["沙漠", "乾旱", "半乾燥", "desert"],
            },
            {
              id: "temperate-forest",
              label: "溫帶林",
              source: { type: "remote", path: "data/geo/biomes-temperate-forest.geojson" },
              color: BIOME_COLORS["temperate-forest"],
              keywords: ["溫帶林", "落葉林", "混合林", "地中海型", "temperate forest"],
            },
            {
              id: "boreal",
              label: "針葉林（泰加林）",
              source: { type: "remote", path: "data/geo/biomes-boreal.geojson" },
              color: BIOME_COLORS.boreal,
              keywords: ["針葉林", "泰加林", "寒帶林", "taiga", "boreal"],
            },
            {
              id: "tundra",
              label: "苔原與高山寒原",
              source: { type: "remote", path: "data/geo/biomes-tundra.geojson" },
              color: BIOME_COLORS.tundra,
              keywords: ["苔原", "凍原", "高山寒原", "高山草原", "tundra"],
            },
          ],
        },
        maxActive: 6,
        palette: Object.values(BIOME_COLORS),
        /**
         * 勾圖層時六類一起打開——這一層的重點是**帶狀分布**，只顯示一類就看不出
         * 「一條一條排下來」。⚠️ 代價是六份檔案一次抓（合計約 730 KB），這是這一層
         * 最貴的地方；取消不想看的那幾類之後不會重抓（`resolveLayerData` 有快取）。
         */
        defaultAll: true,
      },
      /**
       * 六類各有一張說明卡（`src/content/geo/biomes/<id>.json`，檔名＝上面的 item id
       * ＝geojson 的 `properties.id`，三者必須一致，理由見 plate-boundaries）。
       * 點地圖上的面或點抽屜裡的類名，開的都是同一張。
       */
      detail: { type: "geo", collection: "biomes" },
      /**
       * ⚠️ 世界尺度專用。上游幾何在建置期已經用 0.4°（約 44 公里）綜合過，
       * 放大之後邊界會變成一段一段的折線，而且相鄰兩類各自簡化會露出縫隙
       * （比照縣市界設 maxzoom 的既有理由）。
       */
      maxzoom: 5,
      description:
        "地球的陸地依氣候長出六種主要植被：熱帶雨林、莽原與草原、沙漠、溫帶林、針葉林、苔原。橫著看就是一條一條的緯度帶，跟「緯度參考線」疊在一起特別清楚——沙漠帶落在南北緯 30° 附近，針葉林在 60° 附近。",
      notes: [
        "⚠️ 這是**現況的自然植被分區**，不是「地表現在真的長什麼」：溫帶林那一類裡的西歐、華北平原與美國中西部，今天大多是農田與城市。",
        "⚠️ 上游有 14 個生物群系，本站併成六類才畫得出來（十四個分類色沒有人分得出來）。併法：紅樹林併入熱帶林、溫帶草原與熱帶莽原合成「莽原與草原」、地中海型併入溫帶林、高山草原併入苔原。",
        "⚠️ 界線是概略的。真實的植被是漸變的過渡帶而不是一條線，而且幾何在建置期已經化簡到約 44 公里的精度——所以這一層只在世界尺度顯示，放大會自動關掉。",
        "⚠️ 小於約 1,850 平方公里的碎塊（小島、湖心島、狹長的紅樹林海岸）已經濾掉，否則光是北極群島與湖泊就佔掉整份檔案的八成。",
      ],
      sources: ["RESOLVE 生態區 2017（Dinerstein et al.）", "Esri Living Atlas"],
    },
    {
      id: "koppen-zones",
      label: "柯本氣候分區",
      group: "氣候與生物群系",
      status: "ready",
      /**
       * ⚠️ **這一層不需要「補縫」的外框**（生物群系那一層需要）。它是 0.5° 網格
       * dissolve 出來的，相鄰兩類的邊界是**逐位元相同**的格線、而且建置期的容差是 0，
       * 所以兩邊永遠對得齊，不會裂縫。外框設 0 也讓同一大類裡的亞型界線不會被畫成
       * 一堆內部線條——亞型是點下去才看的東西。
       */
      render: { kind: "fill", fillOpacity: 0.25, outlineWidth: 0 },
      /**
       * 五大類各一個檔（各 51–83 KB）。⚠️ **顏色是大類、圖徵是亞型**：30 個代碼
       * 不可能各給一個顏色（本站掃出來的分類色上限是六色），但「這一塊到底是
       * Cfa 還是 Cwa」正是這一層存在的理由，所以那件事交給點擊後的卡片。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "a",
              label: "A 熱帶氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-a.geojson" },
              color: KOPPEN_COLORS.a,
              /**
               * ⚠️ 亞型代碼**一定要進 keywords**。這一層沒有可點清單、也沒有開
               * `indexFeatures`（開了等於讓每個學生一聚焦搜尋框就多付 332 KB），
               * 所以 30 個代碼唯一的搜尋入口就是這裡——而「Cfa」正是學生在地點卡上
               * 看到、會直接打進搜尋框的字串。
               */
              keywords: [
                "熱帶", "Af", "Am", "As", "Aw",
                "熱帶雨林氣候", "熱帶季風氣候", "熱帶莽原氣候", "莽原", "疏林草原",
              ],
            },
            {
              id: "b",
              label: "B 乾燥氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-b.geojson" },
              color: KOPPEN_COLORS.b,
              keywords: [
                "乾燥", "BWh", "BWk", "BSh", "BSk",
                "熱帶沙漠氣候", "溫帶沙漠氣候", "熱帶草原氣候", "溫帶草原氣候",
                "半乾燥", "沙漠化",
              ],
            },
            {
              id: "c",
              label: "C 溫帶氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-c.geojson" },
              color: KOPPEN_COLORS.c,
              keywords: [
                "溫帶",
                "Cfa", "Cfb", "Cfc", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc",
                "溫暖濕潤氣候", "西岸海洋性氣候", "副極地海洋性氣候",
                "地中海型氣候", "副熱帶季風氣候", "高地副熱帶氣候", "夏乾冬雨",
              ],
            },
            {
              id: "d",
              label: "D 大陸性氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-d.geojson" },
              color: KOPPEN_COLORS.d,
              keywords: [
                "大陸性",
                "Dfa", "Dfb", "Dfc", "Dfd", "Dsa", "Dsb", "Dsc", "Dwa", "Dwb", "Dwc", "Dwd",
                "濕潤大陸性氣候", "副極地氣候", "針葉林氣候", "泰加林",
                "冬乾大陸性氣候", "夏乾大陸性氣候", "極端大陸性",
              ],
            },
            {
              id: "e",
              label: "E 極地氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-e.geojson" },
              color: KOPPEN_COLORS.e,
              keywords: ["極地", "ET", "EF", "苔原氣候", "冰原氣候", "凍原", "永凍土", "冰蓋"],
            },
          ],
        },
        maxActive: 5,
        palette: Object.values(KOPPEN_COLORS),
        // 勾圖層就五類全開：這一層看的是「全球分成哪幾種氣候」，只顯示一類看不出分區
        defaultAll: true,
        /**
         * ⚠️ **點抽屜裡「A 熱帶氣候」那五個字要開的是「大類的定義」，不是某一塊
         * 圖徵**——判準跟古蹟三級、主要作物三類一樣：子項目名稱回答的問題
         * （「A 類是什麼」）跟圖徵回答的問題（「我腳下這一格是 Af 還是 Aw」）不同。
         *
         * ⚠️ 不宣告的後果是**一張幾乎空白的卡**，而且完全靜默：item id（`a`）拿去
         * 母圖層那一支查，`koppen-zones` 裡只有 `af`／`am`／…，永遠查不到。實測
         * 在補這一段之前，點「A 熱帶氣候」開出來的整張卡只有「柯本氣候分區」五個字
         * 加一行資料來源（`hideLayerDescription` 又把圖層說明擋掉了，所以比一般的
         * fallback 更空）。
         *
         * 內容在 `src/content/geo/koppen-groups/{a,b,c,d,e}.json`，`validate-content.mjs`
         * 兩個方向都會擋：少一份內容檔會失敗，多一份對不到 item 的也會失敗。
         */
        detail: { type: "geo", collection: "koppen-groups" },
      },
      /**
       * 30 個亞型各是一筆圖徵，每一個都有自己的說明卡
       * （`src/content/geo/koppen-zones/<代碼>.json`，⚠️ `stats` 第四格必須是
       * 「代表地點」——有內容檔之後 `FeatureCard` 就不再畫 geojson 的 `meta` 與
       * `detail` 了，而那兩行原本就是判準與代表地點）。
       * `hideLayerDescription`：30 張卡上那段圖層說明逐字相同，而且就是抽屜那一列。
       */
      detail: { type: "geo", collection: "koppen-zones", hideLayerDescription: true },
      // 0.5° 的網格，再放大只會看到一格一格的階梯（比照生物群系）
      maxzoom: 5,
      description:
        "柯本用「最冷月、最暖月的氣溫」與「雨量的季節分配」把全球氣候分成 A 熱帶、B 乾燥、C 溫帶、D 大陸性、E 極地五大類。地圖上畫的是這五類，點任何一塊會告訴你它的完整代碼（例如臺北是 Cfa 溫暖濕潤氣候）——那就是每一張地點卡上 koppen 欄位的意思。",
      notes: [
        "⚠️ 這份分區是 1951–2000 年的統計（Kottek et al. 2006）。氣候分區會隨暖化移動，新版的分區圖（1991–2020）在乾燥帶與副極地帶都有可見的位移。",
        "⚠️ 解析度是 0.5°（赤道附近約 55 公里）。臺灣整座島只有三、四格，所以島上的分區只能看大勢：這份網格在臺北是 Cfa（與本站地點資料一致），但高雄一帶算成 Am，而本站的地點卡採用中央氣象署的臺灣氣候分區、寫的是 Aw。兩者不一定逐格相同。",
        "⚠️ 邊界是網格的階梯狀，不是平滑曲線——那是資料本身的形狀，不是簡化造成的。放大到 zoom 5 以上這一層會自動關掉。",
        "⚠️ 柯本分類看的是氣溫與雨量，不是植被。它跟「森林與沙漠帶」高度相關但不會完全重疊：同一個 Cfa 裡可能是森林也可能是農田或城市。",
        "⚠️ 這一層與「森林與沙漠帶」蓋的是同一片陸地，兩層一起打開會互相蓋住，建議一次只看一層。",
      ],
      sources: ["柯本－蓋格氣候分類圖（Kottek et al. 2006）"],
    },
    {
      id: "wind-belts",
      label: "行星風系",
      group: "氣候與生物群系",
      status: "ready",
      /**
       * ⚠️ **完全由程式產生，而且應該是這樣。** 行星風系不是測出來的界線而是理想化
       * 的模型（氣壓帶在 0°／±30°／±60°，風帶夾在中間），實際大氣還會隨季節南北
       * 移動好幾度。所以沒有「權威資料檔」可抓，只有課本的示意圖——而示意圖的參數
       * （帶的緯度、箭頭間隔、畫面上的斜度）該寫成程式碼裡的常數，不是一份手抄的
       * 幾千個座標。幾何與參數見 registry/generators.ts 的 `windBelts()`。
       */
      source: { type: "generated", generator: "wind-belts" },
      render: {
        kind: "line",
        width: 1.6,
        /**
         * ⚠️ 標註是這一層的必要條件，不是裝飾：四個部位共用同一個顏色（見
         * thematicColors.ts 的 `WIND_COLOR`），畫面上唯一寫出「這是西風」的東西
         * 就是沿線標註。
         *
         * `spacing: 250` 是實測調的（1512×772 畫布）：氣壓帶那三條是 6 段 34° 的
         * 短線，spacing 60 時同一段上會重複放兩次（zoom 1.1 實測 20 個標註，
         * 250 之後是 16 個）。**不可以照抄緯度參考線的 320**——箭頭在 zoom 1.8 下
         * 只有約 50 px，再高就一個都放不出來。`size: 10` 同理：11 時「極地東風」
         * 四個字排不進箭頭。
         */
        label: { property: "name", size: 10, spacing: 250, maxAngle: 60 },
      },
      /**
       * 四個核取方塊。⚠️ 氣壓帶那一個用 `featureIds` **一次切三筆**（赤道低壓、
       * 副熱帶高壓、副極地低壓）——它們必須是三個獨立圖徵才有各自的標註與卡片，
       * 但在 UI 上是同一件事（「氣壓帶」），沒有理由拆成三個核取方塊。
       *
       * ⚠️ 顏色全部相同是刻意的，不是漏填（見 thematicColors.ts）；`dash` 才是
       * 氣壓帶與風帶的區辨通道——點線 vs 實線箭頭。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "pressure-belts",
              label: "氣壓帶",
              featureIds: ["pressure-equatorial", "pressure-subtropical", "pressure-subpolar"],
              color: WIND_COLOR,
              dash: PRESSURE_DASH,
              keywords: [
                "氣壓帶", "赤道低壓帶", "副熱帶高壓帶", "副極地低壓帶",
                "間熱帶輻合區", "ITCZ", "馬緯度", "無風帶",
              ],
            },
            {
              id: "trades",
              label: "信風",
              featureIds: ["trades"],
              color: WIND_COLOR,
              keywords: ["信風", "貿易風", "東北信風", "東南信風", "trade winds"],
            },
            {
              id: "westerlies",
              label: "西風",
              featureIds: ["westerlies"],
              color: WIND_COLOR,
              keywords: ["西風", "西風帶", "咆哮西風帶", "westerlies"],
            },
            {
              id: "polar-easterlies",
              label: "極地東風",
              featureIds: ["polar-easterlies"],
              color: WIND_COLOR,
              keywords: ["極地東風", "極東風", "polar easterlies"],
            },
          ],
        },
        maxActive: 4,
        /**
         * ⚠️ 四個都是同一個顏色，所以這份色票是**四個重複值**——比照三條橫貫公路
         * 共用一色的既有做法：`palette` 在這種圖層只是型別與 `maxActive` 檢查用的
         * 備援，真正決定顏色的是每個子項目自己的 `color`。
         */
        palette: [WIND_COLOR, WIND_COLOR, WIND_COLOR, WIND_COLOR],
        // 勾圖層就四個一起打開：這一層要教的是「一整套環流」，只顯示一條風帶看不出
        // 它為什麼往那個方向吹
        defaultAll: true,
      },
      /**
       * 六筆圖徵各有一張說明卡（`src/content/geo/wind-belts/<id>.json`，檔名＝
       * geojson 的 `properties.id`＝上面 `featureIds` 裡的字串，三者一致，
       * 比照板塊邊界）。點箭頭或點抽屜裡的名稱開的都是同一張。
       */
      detail: { type: "geo", collection: "wind-belts" },
      /**
       * ⚠️ 世界尺度專用，而且理由跟資料精度無關（這一層沒有精度可言）：箭頭的長度
       * 是**固定的 20° 經度**，放大之後一支箭頭就會比整個畫面還寬，看起來只是一條
       * 莫名其妙的斜線。zoom 4 大約是「一支箭頭佔畫面三分之一」的尺度。
       */
      maxzoom: 4,
      /**
       * ⚠️ 這一層**必須**標 schematic：它是理想模型，不是測得的風場。
       * UI 會顯示「教學示意圖，非精確界線」。
       */
      schematic: true,
      description:
        "赤道的空氣受熱上升（赤道低壓帶），到高空往兩極流、在南北緯 30° 附近下沉（副熱帶高壓帶），再從高壓帶吹回赤道與吹向極區——被地球自轉偏轉之後，就成了信風、西風與極地東風。這一層是沙漠帶為什麼落在 30° 的答案：跟「森林與沙漠帶」或「柯本氣候分區」疊起來看最清楚。",
      notes: [
        "⚠️ 這是理想化的模型：真實的氣壓帶與風帶會隨太陽直射點南北移動（夏季北移、冬季南移），而且會被海陸分布、季風與高山打斷——南亞的夏季季風就是最大的例外。",
        "⚠️ 箭頭的位置與間隔是畫出來讓人看方向的示意圖，不是測得的風場；帶與帶之間也沒有一條真正的界線。",
        "⚠️ 風的命名慣例是「從哪裡吹來」：西風是從西邊吹來、往東邊去；東北信風從東北吹來、往西南去。箭頭畫的是**去向**。",
        "⚠️ 極地東風那一帶（南北緯 65–85°）在 Web Mercator 上被縱向拉得很長，箭頭的斜度是依緯度校正過的，看起來才跟其他帶一樣。",
      ],
      // 三胞環流是模型不是測量值，幾何完全由程式產生；模型本身的出處
      sources: ["維基百科 大氣環流"],
    },
    {
      id: "ocean-currents",
      label: "洋流（暖流／寒流）",
      group: "海洋",
      status: "ready",
      /**
       * ⚠️ 幾何**完全由程式產生**（見 registry/generators.ts 的 `oceanCurrents()`）。
       * 路徑的控制點是手訂的示意曲線，但箭頭、平滑與「不跨越 ±180」這三件事交給
       * 程式——洋流的方向就是這一層的教學內容，而北太平洋暖流、兩條赤道暖流與
       * 西風漂流一定會跨過換日線。
       */
      source: { type: "generated", generator: "ocean-currents" },
      render: {
        kind: "line",
        width: 2,
        /**
         * ⚠️ **標註是必要條件，不是裝飾。** 這一層有兩個已知的顏色衝突（暖流紅 ↔
         * 張裂型邊界橘、寒流藍 ↔ 聚合型邊界藍，一般視覺 ΔE 都只有 14，見
         * thematicColors.ts 的 `OCEAN_CURRENT_COLORS`），而洋流有名字、板塊邊界沒有
         * ——沿線印出來的「黑潮」「祕魯寒流」就是唯一的次要編碼。
         *
         * `maxAngle: 150` 照抄臺灣河川那次的教訓：真實的彎曲路徑用預設的 60 會讓
         * 放置演算法**靜默拒絕**掉大半標註（那次濁水溪整條標不出來）。實測見
         * CLAUDE.md 第 35 項。
         */
        label: { property: "name", size: 10, spacing: 200, maxAngle: 150 },
      },
      /**
       * 兩個核取方塊，用 `featureIds` 從同一份產物切出來（比照板塊邊界）。
       *
       * ⚠️ 顏色**固定綁在暖／寒上**，不是依勾選順序指派——先勾寒流再勾暖流時，
       * 暖流仍然必須是紅的，否則「紅暖藍寒」這個唯一的教學內容當場失效
       * （比照古蹟三級與板塊邊界）。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "warm",
              label: "暖流",
              featureIds: [
                "kuroshio", "north-pacific-drift", "alaska", "north-equatorial",
                "south-equatorial", "gulf-stream", "north-atlantic-drift",
                "brazil", "east-australian", "agulhas",
              ],
              color: OCEAN_CURRENT_COLORS.warm,
              keywords: ["暖流", "黑潮", "灣流", "墨西哥灣流", "warm current", "kuroshio", "gulf stream"],
            },
            {
              id: "cold",
              label: "寒流",
              featureIds: [
                "oyashio", "california", "labrador", "canary",
                "peru", "benguela", "west-australian", "west-wind-drift",
              ],
              color: OCEAN_CURRENT_COLORS.cold,
              keywords: ["寒流", "涼流", "親潮", "洪堡", "湧升流", "cold current", "oyashio", "humboldt"],
            },
          ],
        },
        maxActive: 2,
        palette: [OCEAN_CURRENT_COLORS.warm, OCEAN_CURRENT_COLORS.cold],
        /**
         * 勾圖層就兩個一起打開：這一層唯一要教的事情是「暖流與寒流分別在哪裡」，
         * 只顯示一種就看不出環流，而且兩者共用同一份程式產物，全開不多花任何成本。
         */
        defaultAll: true,
        /**
         * ⚠️ 展開成 18 條洋流的搜尋結果。這一層是**全站唯一一個開了它又不用付
         * 任何流量**的圖層——資料是程式產生的，`resolveLayerData()` 連 fetch 都不會
         * 發（比照 types.ts 的說明：那個旗標防的是「抓一份大檔案卻產不出結果」）。
         * 而它是必要的：`items` 圖層沒有可點清單（ThemeMapPage 的 `!l.items`），
         * 搜尋是「黑潮」「祕魯寒流」唯一的檢索入口。
         */
        indexFeatures: true,
      },
      /**
       * 18 條各有一張說明卡（`src/content/geo/ocean-currents/<id>.json`，檔名＝
       * generators.ts 產物的 `properties.id`＝上面 `featureIds` 裡的字串，三者一致，
       * 比照板塊邊界與行星風系）。
       */
      detail: { type: "geo", collection: "ocean-currents" },
      /**
       * ⚠️ 世界尺度專用。控制點只有幾十個，放大之後那條「流軸」會變成一條假的
       * 精確曲線——而真實的洋流是幾百公里寬、隨季節擺動的水團。zoom 6 大約是
       * 「還看得出黑潮貼著臺灣東岸」的尺度。
       */
      maxzoom: 6,
      /** ⚠️ 必須標：這是示意路徑，不是實測的流軸。 */
      schematic: true,
      description:
        "洋流是海面上長期固定方向的水流，由行星風系推動、再被陸地與地球自轉導成一個個環流。暖流把低緯的熱帶回高緯（黑潮、墨西哥灣流），寒流把高緯的冷水送到低緯（親潮、祕魯寒流）——這就是同緯度的兩個海岸可以差好幾度的原因。跟「行星風系」疊起來看，環流的方向就是風吹出來的。",
      notes: [
        "⚠️ 路徑是示意曲線，不是實測流軸。真實的洋流是幾百公里寬的水團，位置與強度隨季節擺動（例如黑潮的流軸每年會東西擺動上百公里），而且只畫得出主要的表層洋流——深層的溫鹽環流不在這一層。",
        "⚠️ 這 18 條是課本會點名的主要洋流，不是完整名單。赤道逆流、對馬暖流、東格陵蘭寒流這類次要洋流沒有畫出來。",
        "⚠️ 「暖流／寒流」是相對於**流經海域**的水溫而言，不是絕對溫度。北大西洋暖流到了挪威外海只有攝氏七、八度，仍然是暖流——因為同緯度別的海面已經結冰了。",
        "⚠️ 這一層與「板塊邊界」的顏色會互相干擾：寒流藍與聚合型邊界的藍、暖流紅與張裂型邊界的橘都很接近，而祕魯寒流正好貼著祕魯－智利海溝、親潮正好貼著千島海溝。兩層一起打開時請以線型（洋流是實線、板塊邊界是虛線）與洋流的沿線名稱判讀。",
        "⚠️ 寒流藍與「世界主要河流」的藍也很接近，但兩者不會疊在一起——洋流全部在海上、河流全部在陸上。",
      ],
      sources: ["維基百科 洋流", "美國國家海洋暨大氣總署（NOAA）"],
    },
    {
      id: "world-cyclones",
      label: "世界紀錄熱帶氣旋路徑",
      group: "海洋",
      status: "ready",
      source: { type: "remote", path: "data/geo/world-cyclones.geojson" },
      /**
       * 維基百科〈熱帶氣旋〉「紀錄」那張表裡的 33 個氣旋，路徑取自 IBTrACS
       * （取得邏輯與踩過的坑見 scripts/lib/cyclones.mjs 的檔頭）。
       *
       * ## 為什麼掛在「海洋」而不是自成一個「天然災害」組
       *
       * 熱帶氣旋是**海洋餵出來的**：海面水溫要 26.5 °C 以上、暖水層要夠深，
       * 所以這 33 條路徑的起點全部落在低緯的暖洋面上，而且沒有一條生成於南大西洋
       * 以外的冷水域（卡塔琳娜就是因為那一次例外才成為紀錄）。跟同組的「洋流」
       * 疊起來看，暖流經過的海域正是氣旋走廊——這是這一層放在這裡才講得出來的事。
       *
       * ⚠️ 臺灣主題那一層（`tw-typhoons`）是**不同的東西**，不要合併也不要互相
       * 照抄參數：那 14 個是「侵臺並造成重大災害」的颱風、依氣象署的侵臺路徑分類
       * 分組、時間換算成臺灣時間；這 33 個是全球紀錄保持者、依生成洋盆分組、
       * 時間是 UTC。兩層的資料來源、分級單位（公尺/秒 vs 節）與教學問題都不同。
       */
      render: {
        kind: "line",
        /**
         * ⚠️ 線寬與不透明度刻意壓得比其他線圖層低（0.8–2.4px／0.55 對預設
         * 1.4／0.9），比照臺灣的颱風路徑：這一層真正要看的是**上面那串依強度
         * 上色的定位點**，線只負責把它們串起來、看出走向。
         */
        width: ["interpolate", ["linear"], ["zoom"], 1.5, 0.8, 4, 1.6, 8, 2.4],
        opacity: 0.55,
        /**
         * ⚠️ **沿線標註的參數是實測調出來的，不要套預設值也不要照抄臺灣那一層。**
         *
         * `maxAngle: 150` 是照抄的——路徑在轉向點會急彎（約翰在換日線附近打轉、
         * 溫斯頓在斐濟外海繞了一整圈），預設的 60 會讓放置演算法靜默拒絕整條線。
         *
         * `spacing` 掃過四個值，實測 1920×859 的 CSS 視窗（畫布 3840×1718），
         * 五個視角各數「標到名字的線／畫面上的線」與「同一個名字最多重複幾次」：
         *
         * | spacing | z1.8 全球 | z4 西北太平洋 | z5 加勒比海 | z4 孟加拉灣 | z4 南太平洋 |
         * |---|---|---|---|---|---|
         * | 400 | 24/33・重複 3 | 11/11・重複 4 | 7/7・重複 3 | 14/14・重複 2 | 6/6・重複 3 |
         * | **600** | **24/33・重複 2** | **11/11・重複 3** | **7/7・重複 3** | **12/14・重複 2** | **6/6・重複 2** |
         * | 900 | 24/33・重複 2 | 10/11 | 7/7 | 9/14 | 6/6 |
         * | 1200 | 24/33・重複 2 | 9/11 | 4/7 | 5/14 | 6/6 |
         *
         * 900 以上開始掉線（孟加拉灣從 14 條掉到 9 條、加勒比海從 7 掉到 4），
         * 400 則在放大之後同一個名字會重複四次。600 是唯一在五個視角都幾乎全標到、
         * 重複又壓在 2–3 次的值。
         *
         * ⚠️ **z1.8 的 24/33 不是參數調得不好，四個值全都是 24。** 全球視角下有
         * 九條路徑在畫面上太短（馬可只有 577 公里、卡塔琳娜 856 公里），放不下
         * 三個字。要看到它們的名字就放大，或用抽屜的可點清單。
         */
        label: { property: "name", size: 11, spacing: 600, maxAngle: 150 },
      },
      /**
       * 路徑線用 `hazard` 中性色，**不佔分類線色票**。
       *
       * 這是「臺灣地震／重大地震／颱風路徑」那條既有判例的延伸：災害家族一律
       * 中性色，由尺寸或級距色去承載「多強」。線／面色票已經是六色、餘裕只剩
       * ΔE 15.8（見 thematicColors.ts），第七個色相沒有位置；而且路徑線本來就
       * 該退到背景，讓底下依強度分級上色的定位點成為讀圖的主角。
       */
      colorRole: "hazard",
      detail: { type: "geo", collection: "world-cyclones" },
      /**
       * 可點清單依**生成洋盆**分組（七組，見 lib/cyclones.mjs 的 `BASIN_ORDER`）。
       * ⚠️ `groupBy` 依序切、不排序，所以 geojson 的 feature 必須讓同一個洋盆連續
       * ——排序在 build-geodata.mjs 的 transform 裡做掉了（洋盆 → 年份）。
       */
      browse: { groupBy: "category" },
      /**
       * ⚠️ **這一層不計入 `MAX_ACTIVE_BY_KIND.line`（上限 3）。**
       *
       * 判準是 types.ts 寫的那一條：**它用的是「非分類的固定角色色」**
       * （`hazard` 中性灰，跟地震帶、臺灣的颱風路徑同一個角色），多開一層，
       * 畫面上一個新的色相都沒有增加。世界主題已經有七個線圖層在搶那三個名額，
       * 而這一層最該疊的兩個對象——同組的「洋流」與「板塊邊界」——正好都是
       * 吃色票的線圖層；不豁免的話「暖流餵出氣旋」這件事就永遠看不到。
       *
       * ⚠️ 它跟世界櫥窗那九層的豁免**不完全同型**：那九層跟同組其他層本來就同色，
       * 這一層是它那一組裡唯一的 `hazard`。差別在於「同色」不是判準的目的，
       * **「不新增分類色相」才是**——中性灰本來就不參與 LINE_PALETTE 的
       * all-pairs，把它算進名額等於用一個它不屬於的預算去限制它。
       * ⚠️ **不要因此把 `MAX_ACTIVE_BY_KIND.line` 調高**：那個數字等於色票長度，
       * 是 all-pairs 驗證的前提。
       */
      exemptFromMaxActive: true,
      /**
       * 每 6 小時一筆的中心定位點，跟路徑一起開關（比照五大山脈 → 主峰、
       * 臺灣的颱風 → 中心定位點）。
       *
       * **這才是這一層真正在教的東西**：顏色由一分鐘平均風速驅動，所以看得到
       * 佛瑞特 24 小時內從熱帶風暴衝到五級（「增強最快」）、看得到海燕整段登陸
       * 前都是最深的那一階、也看得到波拉與馬希納整條路徑都是「無風速紀錄」的灰
       * ——1899 年本來就沒有這種觀測。
       *
       * ⚠️ **定位點跟路徑共用同一個 `properties.id`**（1,729 個點只有 33 個
       * 不重複的 id），所以 `parentProperty` 退化成 `"id"`。臺灣那一層已經驗證過
       * 「唯一 id ＋ `detail: none` 讓點擊穿透」那條路是壞的，不要再試。
       *
       * ⚠️ **min/maxzoom 不會從母圖層繼承**（縣市政府那次踩過）。這一層兩邊都
       * 不設限：主題相機是 zoom 1.8，路徑本來就要拉遠才看得全。
       */
      attach: {
        id: "world-cyclone-centers",
        label: "氣旋中心定位點",
        source: { type: "remote", path: "data/geo/world-cyclone-centers.geojson" },
        render: {
          kind: "circle",
          /**
           * ⚠️ **半徑必須同時吃 zoom 與風速，只吃風速會在世界視角糊成一片。**
           * 臺灣那一層踩過：固定半徑讓 14 條路徑在呂宋島外海收斂成一團，底圖
           * 完全看不見。這一層的預設視角比它更遠（zoom 1.8 對 4.2），所以最小的
           * 那一階再壓低一點。
           * 風速的定義域是 25–160 節（實測 33 條的範圍是 10–185，兩端夾住即可）。
           */
          radius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.5, ["interpolate", ["linear"], ["get", "wind"], 25, 0.9, 160, 3.0],
            3, ["interpolate", ["linear"], ["get", "wind"], 25, 1.4, 160, 4.2],
            5, ["interpolate", ["linear"], ["get", "wind"], 25, 2.0, 160, 6.0],
            8, ["interpolate", ["linear"], ["get", "wind"], 25, 2.6, 160, 8.5],
          ],
          /**
           * 細白框把相鄰的點分開，但低縮放時點本身只有 1–3px、白框會比點還粗，
           * 所以 zoom 3 以下直接關掉（比照臺灣的颱風定位點）。
           */
          strokeWidth: ["interpolate", ["linear"], ["zoom"], 3, 0, 5, 0.5, 8, 0.8],
          opacity: 0.95,
          colorRamp: CYCLONE_INTENSITY_RAMP,
          /**
           * **選了某個氣旋之後，才在它的定位點旁邊標出日期。**
           * ⚠️ `onlyWhenSelected` 不能拿掉——1,729 個點同時標會蓋滿整張世界地圖。
           *
           * 文字依 zoom 分兩段：zoom < 4 只標「日標」（UTC 00:00 那一筆），
           * zoom ≥ 4 每一筆都標日期＋時刻。
           * ⚠️ 這條 `step` 的輸入是 `["zoom"]`，所以它必須留在最外層——
           * `addGeoLayer` 會用 `mapZoomStops()` 把「有沒有被選取」的判斷推進
           * 每個 stop 的輸出裡（見 CLAUDE.md 關鍵坑三）。
           */
          label: {
            property: [
              "step",
              ["zoom"],
              ["case", ["has", "day"], ["get", "date"], ""],
              4,
              ["concat", ["get", "date"], " ", ["get", "hour"], "時"],
            ],
            size: 10,
            onlyWhenSelected: true,
          },
        },
        colorRole: "hazard",
        // 共用 id，所以開出來的就是母圖層那張氣旋卡（見上）
        detail: { type: "geo", collection: "world-cyclones" },
        parentProperty: "id",
        description:
          "IBTrACS 最佳路徑裡每一筆氣旋中心定位，圓點的大小與顏色都是當時的一分鐘平均風速（節）。時間是世界時（UTC）。",
        sources: ["IBTrACS 全球熱帶氣旋最佳路徑"],
      },
      description:
        "維基百科〈熱帶氣旋〉「紀錄」那張表上的 33 個氣旋，每一個都保持著一項世界或洋盆紀錄——" +
        "氣壓最低的狄普、風速最高的帕翠莎、致死最多的波拉、持續最久的弗雷迪、行進最遠的約翰。" +
        "清單依生成洋盆分組：同一種天氣系統在西北太平洋叫颱風、在北大西洋與東太平洋叫颶風、" +
        "在印度洋與南太平洋叫氣旋，而它們一律生成於低緯的暖洋面、再被行星風系與洋流帶往高緯。" +
        "跟同組的「洋流」疊起來看，暖流流過的海域正是氣旋走廊。",
      notes: [
        "⚠️ 這 33 個是**維基百科〈熱帶氣旋〉「紀錄」表的完整名單**，不是「史上最強的 33 個」，也不是官方排名。全球每年生成八十幾個熱帶氣旋，1842 年以來 IBTrACS 收錄了一萬三千多個。",
        "⚠️ **紀錄本身會被打破，也會被重新分析改寫。** 卡片上的數字是各洋盆負責機構公布的值，而地圖的顏色用的是 IBTrACS 裡美系機構（JTWC／NHC）的重新分析——同一個氣旋兩邊會差最多 37 百帕（莫妮卡：澳洲氣象局 916、JTWC 879）。這不是誰錯了，是兩套獨立的重新分析。",
        "⚠️ **圓點的顏色是一分鐘平均風速，不能拿去跟臺灣主題的颱風路徑比。** 中央氣象署與日本氣象廳用的是十分鐘平均，同一個颱風會比一分鐘平均低 10–15%；印度氣象局用三分鐘平均。這一層全部統一取美系機構的一分鐘平均，才有可比性。",
        "⚠️ **1970 年的波拉與 1899 年的馬希納整條路徑都沒有風速紀錄**，畫成灰色。那個年代沒有衛星也沒有飛機偵察，路徑本身是事後從船舶回報與災情重建的，位置的不確定性比現代氣旋大得多。",
        "⚠️ 路徑畫的是**整個生命史**，包含它變性成溫帶氣旋之後的那一段——所以卡門會一路走到北緯 54 度、約翰走了 31 天。強度色階在那一段已經不是熱帶氣旋的強度了。",
        "⚠️ 定位點的時間是**世界時（UTC）**，不是當地時間，也不是臺灣時間。",
      ],
      sources: ["IBTrACS 全球熱帶氣旋最佳路徑", "維基百科 熱帶氣旋"],
    },

    // ── 以下是「全球地理形貌」併進來之前，世界地理主題原本的圖層 ──────────
    //
    // 順序刻意接在全球尺度的圖層後面：那幾層是骨架（緯度、氣候帶、洋流、板塊），
    // 這幾層是長在骨架上的東西（城市、河流、國界）。抽屜的分組順序由 `groups`
    // 決定，這個陣列的順序只影響同一組內部。
    {
      id: "world-places",
      label: "世界重要城市",
      group: "城市",
      status: "ready",
      // places 內容裡 region === "world" 的部分。目前 5 筆：開羅、塔曼拉塞特、
      // 馬薩特蘭、希洛（都是為了同緯度比較挑的），加上雅庫茨克——那一筆是為了
      // 「世界最冷的大城市」本身收的，不是為了配對。之後回補城市資料時直接加
      // src/content/places/*.json 即可，這裡不用改。
      //
      // ⚠️ 這一層的卡片是 `PlaceCard`，而 **`PlaceCard` 沒有氣候圖表**——ClimateChart
      // 只用在 `/compare`。內容檔裡不要寫「下面那張氣溫圖」，那句話在主題頁是假的
      // （踩過，已改成請讀者到同緯度比較頁去看）。
      source: { type: "bundled", content: "places-world" },
      render: { kind: "circle" },
      /**
       * ⚠️ 合併之後這一層的藍圓點會跟火山帶的洋紅圓點同框（`MAX_ACTIVE_BY_KIND.circle`
       * 是 4，兩層加上全球地震帶都開得起來）。已重驗，兩模式五項全數 PASS：
       *
       *   node <dataviz-skill>/scripts/validate_palette.js "#2a78d6,#c0259c" --pairs all --mode light|dark
       *   → CVD 11.3（deutan）、一般視覺 26.0
       *
       * 全球地震帶是 `hazard` 中性色，本來就不參與色票驗證。
       */
      colorRole: "place",
      detail: { type: "place" },
      browse: { zoom: 9 },
      defaultOn: true,
      description: "課本提到的世界代表性都市與地點，點選看氣候型與人地關係。",
      sources: ["Open-Meteo ERA5 再分析資料"],
    },
    {
      id: "world-rivers",
      label: "世界主要河流",
      group: "地形水系",
      status: "ready",
      source: { type: "remote", path: "data/geo/world-rivers.geojson" },
      render: { kind: "line", width: 1.3, label: { property: "name" } },
      /**
       * ⚠️ **這一層的水系藍 `#2a78d6` 跟板塊邊界的聚合藍 `#2f74c9` 的一般視覺
       * ΔE 只有 2.1**——那不是「相近」，是同一個顏色。合併主題之前兩層分屬不同
       * 主題、`ThemeMapPage` 只算繪當前主題，所以碰不到；現在碰得到了。
       *
       * 掃過整個 OKLCH 色域確認**兩邊都換不了色**（見 thematicColors.ts 的
       * `PLATE_BOUNDARY_COLORS`），所以解法是板塊邊界改畫**虛線**，河流維持實線。
       * ⚠️ 不要把河流也改成虛線，也不要動 `hydrology` 這個角色——它同時是臺灣
       * 主題那組已驗證的六色線／面色票的一員，改它會連帶推翻另一個主題。
       */
      colorRole: "hydrology",
      detail: { type: "geo", collection: "world-rivers" },
      browse: {},
      description: "尼羅河、亞馬遜河、長江等世界主要水系的主流線。",
      notes: [
        "⚠️ 河流是實線、板塊邊界是虛線，兩者的藍色非常接近——喜馬拉雅、安地斯、阿爾卑斯這些聚合帶正好是大河的源頭，兩層一起打開時請以線型（實線／虛線）與河流的沿線名稱判讀。",
        "⚠️ 上游是依「河段名稱」收錄的，所以同一條河在圖上常常是好幾筆：尼羅河分成青尼羅河、白尼羅河與艾伯特段、傑貝勒段等，長江上游另外叫金沙江、通天河、沱沱河，湄公河的中國段叫瀾滄江。點到哪一段就開哪一段的卡片，而卡片講的是整條河。",
        "⚠️ 118 筆裡目前有 33 筆寫了說明卡（課本會點名的那些），其餘的點下去會顯示名稱與這一層的說明。",
      ],
      sources: ["Natural Earth 1:50m 河流與湖泊中心線"],
    },
    {
      id: "world-continents",
      label: "大洲分區",
      group: "大洲",
      status: "ready",
      source: { type: "remote", path: "data/geo/world-continents.geojson" },
      /**
       * ⚠️ **`fillOpacity: 0` 不是忘了設**，理由同板塊那一層：七大洲同色，均勻的
       * 面染分不出「這是哪一洲」（那是名字的工作），只會把整片陸地壓暗一階，而且
       * 會跟底下那條海岸線打架。這一層畫出來的是**外框與名字**；面留給「選取時
       * 0.38」那個互動——點一下，整個亞洲浮出來，那才是「亞洲有多大」讀得出來的
       * 唯一方式。`fill-opacity: 0` 不影響點擊命中（maplibre 的 hit test 不看
       * 不透明度）。
       *
       * 外框比板塊粗（1.8 vs 1）：這一層的線大半疊在底圖自己的海岸線上，1.4 實測
       * 還是會沒入那條線裡；而真正要讀的烏拉山、蘇伊士那幾條洲界也是同一個粗細。
       */
      render: {
        kind: "fill",
        fillOpacity: 0,
        outlineWidth: 1.8,
      },
      colorRole: "continent",
      /**
       * 洲名是**另外一層點**，不是面的標註。
       *
       * ⚠️ 這不是設計潔癖，是實測逼出來的：maplibre 對多邊形是逐塊、逐圖磚算標註
       * 錨點的（見 types.ts 的 `LayerRender.fill.label`），而這一層的亞洲有 240 塊
       * ——把 `label` 掛在面上，全球視角會在菲律賓、印尼、日本、千島群島上各印一次
       * 「亞洲」，整張圖鋪滿重複的洲名（實測一個畫面上六十幾個）。板塊那一層沒踩到
       * 只是因為一塊板塊通常就是一塊多邊形。
       *
       * 錨點與名字怎麼來的見 resolve.ts 的 `world-continent-labels`。
       *
       * ⚠️ `radius: 0` 是刻意的——這一層要的只有那幾個字，錨點本身沒有任何地理
       * 意義（它不是首都、也不是形心）。`parentProperty` 讓「點洲名」與「點那一洲」
       * 互相連動，兩邊開出來的也是同一張卡（`detail` 與母圖層相同、id 也相同）。
       */
      attach: {
        id: "world-continent-labels",
        label: "洲名",
        source: { type: "derived", derived: "world-continent-labels" },
        render: {
          kind: "circle",
          radius: 0,
          strokeWidth: 0,
          // 錨點沒有實體，字要壓在錨點上而不是像一般圓點那樣浮在上方
          label: { property: "name", size: 14, offset: [0, 0] },
        },
        colorRole: "continent",
        detail: { type: "geo", collection: "world-continents" },
        parentProperty: "continentId",
        /**
         * ⚠️ 縮放範圍不繼承母圖層（見 types.ts）。這裡比母圖層早一級收掉：
         * 放大到 zoom 4 之後洲名早就讀過了，而底圖自己的國名與城市名開始變多，
         * 一個橫在畫面中央的「亞洲」只是擋路。
         */
        maxzoom: 4,
      },
      detail: { type: "geo", collection: "world-continents" },
      // 七筆、依面積由大到小（那正好是課本列七大洲的順序），不需要分組
      browse: {},
      /**
       * ⚠️ `maxzoom: 5` 跟生物群系、柯本氣候分區同一個判斷：幾何是 0.05° 簡化過的
       * （≈5.5 公里），再放大就會露出折線，而海岸線本來就該讀底圖那一條。
       */
      maxzoom: 5,
      description:
        "七大洲的範圍。點一下任何一洲會標出它的範圍與面積，也看得出歐亞、亞非、南北美洲之間的界線畫在哪裡。",
      notes: [
        "⚠️ 洲與洲的界線沒有國際公認的畫法。本層依課本講的那幾條：歐亞以烏拉山、烏拉河、裏海、高加索山、黑海與土耳其海峽為界，亞非以蘇伊士運河為界，南北美洲以巴拿馬為界——其中烏拉山、烏拉河、土耳其海峽與蘇伊士運河在圖上都是簡化過的直線。",
        "⚠️ 跨洲國家依上面那幾條線切開，所以俄羅斯、哈薩克、土耳其、埃及會同時出現在兩洲；其餘國家一律整個算一洲——高加索三國（喬治亞、亞美尼亞、亞塞拜然）在這裡全部算亞洲，印尼全部算亞洲（新幾內亞島西半部在地理上屬大洋洲），這些都有不同的分法。",
        "⚠️ 面積由幾何算出來，跟課本數字有小幅差距。南極洲差最多（本層 1,226 萬 km²、課本多寫 1,400 萬）：這份界線畫的是岩床海岸線，不含周圍的冰棚。",
        "⚠️ 小於約 250 km² 的島嶼在圖上省略（世界尺度下不到一個像素），但面積仍然算進所屬的洲。",
      ],
      sources: ["Natural Earth 1:50m 國界"],
    },
    {
      id: "world-mountains",
      label: "世界主要山脈",
      group: "地形水系",
      status: "ready",
      /**
       * ## 上游是「面」，這一層畫的是「線」
       *
       * Natural Earth 的自然地理區把山脈收成**範圍面**，但這一層要教的是**走向**
       * ——安地斯山脈從委內瑞拉一路拉到火地島、洛磯山脈與海岸山脈平行排列、
       * 喜馬拉雅山脈沿著板塊聚合帶橫過。`build-geodata.mjs` 因此把每一塊範圍面
       * 化成一條中軸線（做法與實測長度見 scripts/lib/mountains.mjs）。
       *
       * ⚠️ 面還有兩個硬問題，都在那份檔頭裡：**第 14 個面色不存在**（本站的分類色
       * 上限是六色，大洲＋生物群系＋柯本＋板塊已經把面色票用滿），而且面會吃掉
       * `MAX_ACTIVE_BY_KIND.fill` 的兩個名額之一，而「山脈擋住水氣 → 背風側是沙漠」
       * 正好要跟柯本氣候分區或生物群系疊著看。畫成線就不用搶。
       */
      source: { type: "remote", path: "data/geo/world-mountains.geojson" },
      /**
       * ⚠️ `maxAngle: 150` 照抄臺灣河川那次的教訓：真實（而不是手繪）的曲線用
       * maplibre 預設的 60 會讓沿線標註被**靜默拒絕**掉大半。這一層的標註不是
       * 裝飾——39 條山脈同色，畫面上唯一寫出「這是安地斯山脈」的東西就是它，
       * 而且它同時是 `MOUNTAIN_COLOR` 那個 CVD WARN 的補償（見 thematicColors.ts）。
       */
      render: { kind: "line", width: 2.6, label: { property: "name", maxAngle: 150 } },
      /**
       * ⚠️ **不是臺灣五大山脈的 `relief` 洋紅。** 洋紅對火山帶的洋紅一般視覺
       * ΔE 只有 4.6，而環太平洋那一段的山脈上滿是火山（安地斯、喀斯開、巴里桑、
       * 新幾內亞高地），兩層一起打開會變成「洋紅的點壓在洋紅的線上」。從前兩層
       * 分屬不同主題碰不到，山脈進了世界主題之後就碰得到了。完整的掃描結論見
       * thematicColors.ts 的 `MOUNTAIN_COLOR`。
       */
      colorRole: "mountain",
      /**
       * 39 條都有內容檔（`src/content/geo/world-mountains/`），所以卡片是完整的那一版：
       * 四格數據（最高峰＋高度／主要國家／長度或走向）＋三到五條 `facts`，最後一條
       * 一律是「對照重點」，明講該跟哪一個圖層疊著看。
       *
       * ⚠️ `hideLayerDescription` 因此**今天是 no-op**（有內容檔的圖徵不走 fallback），
       * 比照 `tw-rivers` 與 `tw-protected-areas` 留著是為了規則一致：之後補收一條山脈
       * 而內容檔還沒寫時，卡片會退回「名稱＋洲＋最高峰＋成因」而不是整片跟抽屜那一列
       * 逐字相同的圖層說明。
       */
      detail: { type: "geo", collection: "world-mountains", hideLayerDescription: true },
      /**
       * 39 筆平鋪太長，依洲分組（`properties.category`，順序由 `build-geodata.mjs`
       * 的 feature 順序決定：亞、歐、非、北美、南美、大洋、南極，洲內依主峰高度
       * 由高到低）。⚠️ `groupBy` 是**依序切、不排序**，所以那個順序不能在這裡改。
       */
      browse: { groupBy: "category" },
      /**
       * 主峰跟著這個核取方塊一起出現，比照臺灣五大山脈的 `tw-range-peaks`。
       *
       * ⚠️ 顏色沿用 `place` 藍而不是山脈的紫，那是 CLAUDE.md 記錄的既有規則
       * （POINT 色票已經飽和，附屬點一律用藍；語意上也對——藍點＝地圖上一個
       * 有詳情卡的地點）。
       *
       * ⚠️ `schematic: false` 不是多餘的：母圖層的中軸線是**算出來的**示意幾何，
       * 主峰卻是 Natural Earth 高程點的真實座標與高度。不覆蓋的話聖母峰的卡片
       * 底下會印一行「這是簡化的教學示意幾何」，那是對讀者說謊。
       */
      attach: {
        id: "world-mountain-peaks",
        label: "最高峰",
        source: { type: "remote", path: "data/geo/world-mountain-peaks.geojson" },
        render: { kind: "circle" },
        colorRole: "place",
        detail: {
          type: "geo",
          collection: "world-mountain-peaks",
          hideLayerDescription: true,
        },
        parentProperty: "rangeId",
        /**
         * ⚠️ 縮放範圍不繼承母圖層（見 types.ts），所以主峰本身在任何尺度都畫得出來
         * ——「一座山峰的座標」沒有中軸線那種「再放大就是假精確」的問題。
         *
         * ⚠️ **但取景要讓母圖徵留在畫面上**，這一條是實測改回來的：`zoom: 8` 時
         * 點「聖母峰」會飛到 zoom 8，而山脈線的 `maxzoom` 是 6——詳情卡、相機、
         * 強調表達式全都正常，只有喜馬拉雅山脈**整條消失**（`queryRenderedFeatures`
         * 回 0），畫面上只剩一顆藍點。判準同縣市政府那一層（見 types.ts）：這一層
         * 的教學重點是「這條山脈的最高點在哪一段」，取景必須讓山峰與山脈同時在。
         * 5.5 是母圖層 `maxzoom` 之下留半級餘裕，跟 `fitMaxZoom()` 給線／面的上限
         * 是同一個值。
         */
        browse: { zoom: 5.5 },
        schematic: false,
        description:
          "各山脈的最高峰。高度取自 Natural Earth 的高程點，與各國最新公告值可能差幾公尺。",
      },
      /**
       * 中軸線是從一份 1:10m、而且本來就是製圖判斷的範圍面算出來的，不是實測稜線
       * ——比照臺灣五大山脈與洋流，一定要標。
       */
      schematic: true,
      /**
       * ⚠️ `maxzoom: 6`：一個像素在 zoom 6 約 0.04°，正好是產物的簡化容差
       * （0.02°）的兩倍。再放大，那條線就會變成一條假的精確稜線，而山地地形
       * 本來就該讀等高線與地形陰影（那兩層在 zoom 9 以上才有意義，剛好接得上）。
       */
      maxzoom: 6,
      description:
        "喜馬拉雅、安地斯、洛磯等 39 條主要山脈的走向與最高峰。" +
        "跟「板塊邊界」疊著看，可以看出年輕的褶曲山脈幾乎都長在聚合型邊界上；" +
        "跟「柯本氣候分區」或「森林與沙漠帶」疊著看，則看得出山脈如何把水氣擋在" +
        "迎風坡（安地斯山脈西側的阿他加馬沙漠、西高止山脈背風的德干高原）。",
      notes: [
        "⚠️ 這 39 條是課本會點名的主要山脈，不是完整名單；上游收錄的 222 條山地裡，" +
          "課本不會提到的那些沒有畫出來。",
        "⚠️ 線是**中軸線**，由上游的山脈範圍面算出來的示意走向，不是實測稜線，" +
          "也不代表山脈的寬度。山脈的界線本來就沒有官方定義——「阿爾卑斯山脈到哪裡為止」" +
          "是製圖上的判斷，不同地圖畫得不一樣。",
        "⚠️ 帕米爾高原、衣索比亞高原與新幾內亞高地嚴格說是高原而不是山脈，" +
          "但課本都會提到，而且在上游的資料裡歸在同一類，所以一起收進來。",
        "⚠️ 最高峰的高度取自 Natural Earth 的高程點，與各國最新測量值可能差幾公尺" +
          "（例如聖母峰現行的官方值是 8,848.86 公尺）。庫克山已改用 1991 年山頂崩落後" +
          "重測的 3,724 公尺。",
        "⚠️ 這一層的紫與世界重要城市、最高峰的藍在紅綠色盲下比較接近，" +
          "兩者一起打開時請以形狀（線與圓點）與山脈的沿線名稱判讀。",
      ],
      sources: [
        "Natural Earth 1:10m 自然地理區",
        "Natural Earth 1:10m 高程點",
        "維基百科 山脈列表",
      ],
    },
    {
      id: "world-population",
      label: "世界人口分布",
      group: "城市",
      status: "ready",
      source: { type: "remote", path: "data/geo/world-population.geojson" },
      /**
       * ## 半徑＝都會區人口，顏色是單一的圖層身分色
       *
       * 跟臺灣的「人口與都市體系」刻意**不一樣**：那一層有兩個量要放（人口數與
       * 人口密度），所以半徑與顏色各佔一個通道；這一層只有一個量，把顏色也拿去
       * 編碼只會多一條要解釋的規則。⚠️ 顏色為什麼不能沿用那一層的紫，見
       * thematicColors.ts 的 `WORLD_POPULATION_COLOR`（對火山洋紅是 hard FAIL）。
       *
       * 半徑用 `sqrt(人口)` 線性內插到 2.2–12 px，比照水庫與臺灣人口的既有做法：
       * 嚴格照面積正比的話，一百萬人的城市會小到看不見也點不到。上限 12 px 是對著
       * **主題預設視角（zoom 1.8）**調的——東京 3,568 萬拿到滿格。
       *
       * ⚠️ **那個尺度下有 35 個點被鄰點完全蓋住，這是預期行為不是缺陷**（用產物的
       * 座標算 Web Mercator 投影量的，見 CLAUDE_WORLD.md 的驗證清單第 46 項）：
       * 被蓋住的**全部是巨型都會旁邊的衛星市**——新北市在臺北底下、橫濱在東京底下、
       * 吉薩在開羅底下、豪拉在加爾各答底下。在「世界人口分布」這個尺度上，它們本來
       * 就屬於同一團；放大到 zoom 4 只剩 10 個，點得到也讀得到。
       *
       * ⚠️ **不要為了那 35 個點把上限壓到 8 px**：實測只換回 12 個（23 個仍然被蓋），
       * 代價卻是「圓點大小＝人口規模」這個唯一的編碼變弱——三千萬與一千萬的差別
       * 會從 5.5 px 縮到 3 px。
       */
      render: {
        kind: "circle",
        radius: [
          "interpolate",
          ["linear"],
          ["sqrt", ["coalesce", ["get", "population"], 0]],
          1000,
          2.2,
          6000,
          12,
        ],
      },
      colorRole: "worldPopulation",
      /**
       * 沒有內容檔（505 個點），卡片走 `FeatureCard` 的 fallback：名稱＋原名＋
       * `meta`（首都・國家・都會區人口）＋`detail`（市轄區人口）。那三行都是在
       * `lib/world-population.mjs` 裡組好寫進 geojson 的。
       *
       * `hideLayerDescription`：505 張卡上那段圖層說明逐字相同，而且就是抽屜那一列
       * （比照火山帶與柯本氣候分區的既有決定）。
       */
      detail: { type: "geo", collection: "world-population", hideLayerDescription: true },
      /**
       * ⚠️ **刻意不宣告 `browse`**，這是兩個決定合起來的結果（比照火山帶）：
       *
       * 1. **抽屜的可點清單**：505 列會把那一層的清單撐成全站最長的一份，而這一層
       *    要讀的是**分布的形狀**（哪裡密、哪裡空），不是逐一點名。
       * 2. **搜尋索引**：沒有 `browse` 就不進索引（既有規則），因此聚焦搜尋框不會
       *    多抓這 146 KB。更重要的是**「世界重要城市」那 31 個才是可檢索的清單**
       *    ——兩層都進索引的話，搜「東京」會出現兩筆同名結果（副標一個是地形、
       *    一個是人口），而其中只有一筆開得出寫過的卡片。
       *
       * ⚠️ 要改成可搜尋之前，先想清楚那 31 個重複名怎麼辦。
       */
      /**
       * ⚠️ `minzoom: 1` 讓它在主題預設視角（zoom 1.8）就畫得出來——這一層的教學
       * 內容正是「一眼看出人口分布不均」，那件事只有在整張世界地圖上才成立。
       * 不設 `maxzoom`：點位是真實座標，放大之後仍然正確（跟中軸線那種示意幾何不同）。
       */
      description:
        "全世界都會區人口 100 萬以上的 505 個城市，圓點大小就是人口規模。" +
        "打開之後最先看到的其實是空白的那幾塊：撒哈拉、阿拉伯半島、西伯利亞、澳洲內陸與亞馬遜幾乎沒有點，" +
        "而東亞、南亞、歐洲與北美東北部擠成一片——這就是「世界人口分布不均」。" +
        "跟「柯本氣候分區」疊著看，人口集中的地方多半是溫帶與季風區；" +
        "跟「世界主要河流」疊著看，大河的中下游與三角洲又是其中最密的一條線。",
      notes: [
        "⚠️ 這是**都會區人口的點資料，不是人口密度**。它畫得出「哪裡有大城市」，畫不出「鄉村人口有多密」——恆河平原、爪哇島與尼羅河谷的鄉村密度是全球最高的幾處，在這一層上只會看到幾顆點。",
        "⚠️ 「都會區人口」（圓點大小與 meta 那一行）含衛星市鎮，跟課本常寫的「市轄區人口」不是同一個數字：東京都會區 3,568 萬、市轄區只有 880 萬。卡片上兩個都會列出來。",
        "⚠️ 人口數是 Natural Earth 彙整的估計值，年份不一（多為 2010 年代前期），不適合拿來比較兩個城市之間的細微差距，只適合看量級與分布。",
        "⚠️ 只收 100 萬以上，所以非洲與中亞看起來比實際更空——那裡有大量幾十萬人的城市沒有畫出來。",
      ],
      sources: ["Natural Earth 1:10m 城市聚落"],
    },
    {
      id: "world-civilizations",
      label: "古文明發源地",
      group: "人文專題",
      status: "ready",
      /**
       * ## 為什麼是六個，而不是課本講的「四大」
       *
       * 「四大文明古國」是梁啟超等人提出、盛行於東亞的說法，**未被學術界或國際
       * 社會採納**（中文維基〈文明的搖籃〉那一條就是這麼寫的）。學界普遍承認的
       * 獨立起源地至少有六處：中部美洲（奧爾梅克）與祕魯中北部（小北／卡拉爾）
       * 並不依賴舊大陸的文明而各自出現。**那兩個新大陸的例子正是這一層的教學
       * 重點**——把它們拿掉，這一層就只剩下課本已經講過的四個名字，也講不出
       * 「大河＋灌溉」這個公式在新大陸兩個都不成立這件事。
       *
       * ⚠️ **它 2026-08 從當時還叫「作者精選」的編者選集搬出來自成一層。** 那六筆
       * 原本掛在 `world-picks` 底下當一個 `category`，但那一層的定位是「編者挑的
       * 地方，沒有共同的主題」；這六筆相反——它們是**同一個問題的六個答案**，彼此要
       * 對著看才有意義（見下面的 `notes`）。內容 collection 也跟著搬到
       * `src/content/geo/world-civilizations/`。
       */
      source: { type: "remote", path: "data/geo-manual/world-civilizations.geojson" },
      render: { kind: "circle" },
      /**
       * ⚠️ 沿用 `place` 藍，**不是沒想過要給它一個自己的顏色**：POINT 色票已經是
       * all-pairs 全過的飽和狀態，而「藍點＝地圖上一個有詳情卡的地點」是本站
       * 記錄在案的規則（世界重要城市與世界櫥窗那七個點圖層共用同一個 hex 就是
       * 這條規則）。
       *
       * ⚠️ 代價是**它跟「世界重要城市」同色**，而這兩層很可能一起打開（孟菲斯與
       * 開羅只差 23 公里、二里頭與洛陽市只差 20 公里，那正是這一層的教學點之一）。
       * 要換成專屬色的話，必須先跑 dataviz skill 的 `validate_palette.js`，用
       * `--pairs all` 對同框的三個點色驗明暗兩模式（地形景點藍 #2a78d6、火山洋紅
       * #c0259c、世界人口 #80610d），不要憑感覺挑（CLAUDE.md 硬性禁止事項第 15 條）。
       */
      colorRole: "place",
      detail: { type: "geo", collection: "world-civilizations" },
      /**
       * ⚠️ `groupBy` 分的是**舊大陸／新大陸**，不是經度——這一層的整個論證就靠
       * 那條線（課本的「四大」剛好是舊大陸那一半）。⚠️ `groupBy` 依序切、不排序，
       * 所以 geojson 裡舊大陸那四筆必須連續排在前面，各組內再由西往東。
       *
       * 取景一樣寫在 geojson 的 `properties.zoom` 上逐筆決定（8.0 到 5.9 之間差了
       * 四級），而且每一筆的值都是為了讓那張卡的「對照重點」在畫面上兌現得了：
       * 聖羅倫索要框得到石材產地的火山、卡拉爾必須小於 6（洋流那一層的 maxzoom）、
       * 烏魯克要框得到札格洛斯山前的聚合型邊界。**改 zoom 之前先確認那幾層還畫得出來。**
       */
      browse: { groupBy: "category" },
      description:
        "人類在六個彼此不知道對方存在的地方，各自從農村長成了城市。" +
        "兩河流域的烏魯克——世界最早的城市之一，而最早的文字泥板是一批帳本；" +
        "尼羅河的孟菲斯——卡在上下埃及的接縫上，金字塔是它的墓地，「埃及」這個名字" +
        "還是從城裡那座神廟的名字轉過來的；印度河的摩亨佐-達羅——格狀街道與磚砌下水道" +
        "規劃得極整齊，它的文字卻至今沒有人讀得懂；黃河中游的二里頭——最早的宮殿與" +
        "鑄銅作坊，很多學者認為是夏都，但沒有出土能自證的文字；墨西哥灣岸的聖羅倫索" +
        "——中美洲最早的文明，一顆十七公噸的玄武岩人頭要從一百公里外運過來；" +
        "祕魯海岸的卡拉爾——跟埃及金字塔同時代，卻沒有陶器也沒有文字，靠魚與棉花的" +
        "交換撐起來。",
      notes: [
        "⚠️ 這一層收六個而不是課本常講的「四大文明古國」：那個說法是梁啟超等人提出、盛行於東亞，並未被學術界或國際社會採納。學界目前普遍承認的獨立起源地至少有六處，中美洲（奧爾梅克）與祕魯中北部（小北／卡拉爾）並未依賴舊大陸的文明而各自出現。",
        "⚠️ 畫的是**遺址**的位置，不是那個文明的範圍——文明本身是一整條河谷或一整片低地（印度河流域文明目前已知的聚落就有一千多處），本站沒有那種面圖層。每一筆取的是該文明最早、而且位置指得出來的核心遺址。",
        "⚠️ 可點清單分成「舊大陸」與「新大陸」兩組，**不是依經度**：課本的「四大」剛好就是舊大陸那一半，這一層要講的正是那條線。各組內才是由西往東（孟菲斯、烏魯克、摩亨佐-達羅、二里頭／聖羅倫索、卡拉爾）。",
        "⚠️ 年代一律是考古定年的區間，不同資料寫的數字會有幾百年的出入（碳十四校正、採樣位置與「這座城從哪一層算起」都會影響），卡片上寫的是目前常見的一組。",
        "⚠️ 二里頭是不是夏朝的都城**目前仍是推論**：位置與年代都對得上文獻裡的夏，但遺址沒有出土能自證朝代與王名的文字（中國最早被確認的成熟文字是三百多年後殷墟的甲骨文）。卡片把這件事寫出來，那是它的教學價值，不是模糊其詞。",
        "⚠️ 孟菲斯是埃及那一座，跟美國田納西州的曼非斯無關——後者在本站「世界人口分布」那一層上，所以這一筆的圖徵 id 是 `memphis-egypt`。",
        "⚠️ 這一層的圓點與「世界重要城市」以及「世界櫥窗」底下那幾層同色（藍＝地圖上一個有詳情卡的地點）。孟菲斯與開羅只差 23 公里、二里頭與洛陽市只差 20 公里，兩層一起打開時請以圖例與點選後的卡片判讀。",
      ],
      sources: [
        "維基百科 文明的搖籃",
        "維基百科 烏魯克",
        "維基百科 孟菲斯（埃及）",
        "維基百科 摩亨佐-達羅",
        "維基百科 二里頭遺址",
        "維基百科 奧爾梅克文明",
        "維基百科 小北文明",
        "UNESCO 世界遺產 孟菲斯及其墓地",
        "UNESCO 世界遺產 摩亨佐-達羅考古遺址",
        "UNESCO 世界遺產 卡拉爾-蘇沛聖城",
      ],
    },
    {
      id: "world-agriculture",
      label: "主要農業帶",
      group: "人文專題",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "小麥帶、稻作區、放牧區等主要農業型態的分布。",
      /**
       * ⚠️ 這一層原本掛著「Natural Earth」，那是照抄隔壁圖層填的——**NE 沒有任何
       * 農業資料**。改成真正做得出這一層的公開資料集（FAO 的全球農業生態區）。
       */
      sources: ["聯合國糧農組織 全球農業生態區（GAEZ）"],
    },
  ],
};
