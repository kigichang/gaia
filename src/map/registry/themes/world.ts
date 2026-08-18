// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import type { ThemeDefinition } from "../types.ts";
// value-import 只允許 thematicColors（零 import 的常數模組），見 ../types.ts 的說明
import {
  BIOME_COLORS,
  KOPPEN_COLORS,
  OCEAN_CURRENT_COLORS,
  PLATE_BOUNDARY_COLORS,
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
 * 板塊邊界的虛線（同樣要有型別註記，理由見上）。
 *
 * 實線段刻意偏長：這一層要讀得出「一條連續的邊界帶」，碎成點就看不出走向了。
 * 為什麼非虛線不可見 `plate-boundaries` 圖層的說明。
 */
const PLATE_BOUNDARY_DASH: [number, number] = [4, 1.5];

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
    // ⚠️ 目前底下還沒有圖層，`LayerPanel` 對空的分組是 `return null`，
    // 所以抽屜上暫時看不到這個標題，那是預期行為、不是漏掉。
    "世界櫥窗",
    "氣候與生物群系",
    "海洋",
    "地體構造",
    // 原本「世界地理」主題的分組接在後面
    "城市",
    "國界與大洲",
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
    // 「地表之最」是學生在世界地圖上第一個問得出口的問題（最高的山在哪裡？），
    // 所以這一組排在參考線之後、氣候帶之前：先有具體的地方可以指，後面的氣候帶、
    // 洋流、板塊才有東西可以掛上去。
    //
    // ⚠️ 「最高／最低」是**點**、「最長」是**線**，而一個圖層只能有一種幾何
    // （`LayerRender`），所以是兩個圖層而不是一個。四筆圖徵共用同一個內容
    // collection（`world-superlatives`），id 就是它在講的那個「最」。
    {
      id: "world-superlative-peaks",
      /**
       * ⚠️ 圖層 id 留著 `-peaks`，label 卻是「高山與火山」——那是刻意的：id 是
       * maplibre source/layer 的前綴，改了等於改掉所有既有的驗證指令與文件裡的
       * 圖層 id（`world-superlative-peaks-points`），而這一層的內容本來就是
       * 「點的世界之最」。
       */
      label: "世界之最・高山與火山",
      group: "世界櫥窗",
      status: "ready",
      /**
       * 五個座標都是人工轉錄的官方數字（比照臺灣海峽中線），所以放 `geo-manual/`：
       * 聖母峰取峰頂實測位置與 2020 年中尼聯合公布的 8,848.86 公尺，日和山取
       * 國土地理院地形圖上的位置與 2014 年重新確認的 3 公尺，普哈胡努取露出海面
       * 的加德納尖峰。
       *
       * ⚠️ **兩座安地斯火山的座標逐位元取自 `data/geo/volcanoes.geojson`**，
       * 所以跟「火山帶」那一層的同一顆火山**完全重合**（那是刻意的，跟聖母峰
       * 那一對相反——那邊的兩顆點差 4 公里是因為兩份資料量的不是同一個東西）。
       *
       * ⚠️ **不要改成從 `world-mountain-peaks.geojson` 切出聖母峰。** 那一份是
       * Natural Earth 的 1:10m 高程點，位置差約 4 公里、高度是 8,848（舊值）——
       * 對「畫出喜馬拉雅的最高點在哪一段」夠用，但這一層要講的正是那個數字本身。
       */
      source: { type: "remote", path: "data/geo-manual/world-superlatives-peaks.geojson" },
      render: { kind: "circle" },
      /**
       * ⚠️ 沿用 `place` 藍，不是新的顏色。POINT 色票已經是 all-pairs 全過的飽和
       * 狀態（見 thematicColors.ts），而藍在語意上本來就對——「藍點＝地圖上一個
       * 有詳情卡的地點」，這一層的兩筆正是這種東西。同框的另外兩個圓點圖層
       * （火山帶洋紅、全球地震帶中性灰）都跟它驗過。
       */
      colorRole: "place",
      /**
       * 四筆圖徵（兩個圖層）共用同一個 collection：id 在 collection 內唯一就夠，
       * 而「世界之最」本來就是一組要一起讀的卡片。
       */
      detail: { type: "geo", collection: "world-superlatives" },
      /**
       * 依 `category` 分成「山」與「火山」兩組。⚠️ `groupBy` 是**依序切、不排序**，
       * 所以那兩組在 geojson 裡必須是連續的。
       *
       * ⚠️ 這裡**刻意不填 `zoom`**：五筆的尺度差了好幾級（聖母峰要看整條喜馬拉雅、
       * 日和山是一顆 3 公尺高的沙丘、普哈胡努要退到看得見整條夏威夷島鏈），所以
       * 取景寫在 geojson 的 `properties.zoom` 上逐筆決定（`ThemeMapPage` 對點圖層
       * 是 `feature.properties.zoom || browse.zoom || 11`）。
       */
      browse: { groupBy: "category" },
      description:
        "海拔最高的山峰與最低的山（聖母峰 8,848.86 公尺、日和山 3 公尺），" +
        "以及三項火山紀錄：體積最大（普哈胡努）、海拔最高（奧霍斯－德爾薩拉多山）、" +
        "海拔最高且有史載噴發（尤耶亞科山）。" +
        "每一個「最」都要先講清楚是怎麼量、怎麼定義的，那正是這一層要教的事。",
      notes: [
        "⚠️ 「世界最低的山」沒有權威名單：怎樣才算一座山，各國的定義並不相同（日本以是否登載於國土地理院的地形圖為準，其他國家多半沒有這種制度）。這裡取的是有官方測量、又正式登載在地形圖上的最低者。",
        "⚠️ 日和山的 3 公尺是 2011 年東日本大震災的海嘯削掉山頭之後、2014 年重新確認的值；震災前是 6.05 公尺，當時「日本最低的山」是大阪的天保山（4.53 公尺）。",
        "⚠️ 聖母峰的 8,848.86 公尺是 2020 年中國與尼泊爾聯合公布的**雪面**高程；岩面高程約 8,844 公尺，兩個數字量的不是同一件事。",
          "⚠️ 這一層的聖母峰座標取自峰頂實測位置，與「世界主要山脈」那一層的最高峰（Natural Earth 1:10m 高程點）相差約 4 公里。兩層一起打開並放大之後會看到兩顆藍點，那不是重複的資料。",
        "⚠️ 「體積最大的火山」是 2020 年才換人的：在那之前課本寫的是茂納羅亞火山，而茂納羅亞至今仍是體積最大的**活**火山（普哈胡努已停止活動一千多萬年）。2013 年一度被認為最大的塔穆火山，2019 年重新分析後認定不是單一的盾狀火山。",
        "⚠️ 「海拔最高的活火山」取決於「活」怎麼定義：以有文獻記載的噴發來算是尤耶亞科山（1877 年）；若採地質學界通用的「一萬年內噴發過」，更高的奧霍斯－德爾薩拉多山（最後噴發約西元 750 年）也是活火山，本站「火山帶」那一層就是這樣列的。兩張卡都寫出了這件事。",
        "⚠️ 兩座安地斯火山的座標與「火山帶」那一層完全相同（同一份 GVP 資料），兩層一起打開時藍點與洋紅點會疊在同一個位置，那是刻意的。",
        "⚠️ 這一層只收**量得出來、講得出憑據**的紀錄。像維蘇威火山那種「有名但沒有紀錄」的地方收在同一組的「作者精選」，不放在這裡——混在一起會讓「最」這個字失去意義。",
      ],
      sources: [
        "維基百科 珠穆朗瑪峰",
        "維基百科 日和山（仙台市）",
        "日本國土地理院 地理院地圖（日和山）",
        "Garcia et al. (2020) 普哈胡努：地球上最大最熱的盾狀火山",
        "史密森尼學會 全球火山計畫（GVP）",
      ],
    },
    {
      id: "world-superlative-ranges",
      label: "世界之最・山脈",
      group: "世界櫥窗",
      status: "ready",
      /**
       * 兩條線都由 `build:geodata` 產生，而且**刻意跟既有圖層共用同一段程式**
       * （見 build-geodata.mjs 的 `world-superlatives-ranges`）：安地斯走
       * `polygonAxis()` 與 `world-mountains` 同一個 `tolerance`，所以兩層一起
       * 打開時那條線**完全重合**；中洋脊取 Bird (2003) 的 OSR 段落，跟
       * `plate-boundaries` 共用同一次 10 MB 下載。
       */
      source: { type: "remote", path: "data/geo/world-superlatives-ranges.geojson" },
      /**
       * ⚠️ `maxAngle: 150` 照抄世界主要山脈與臺灣河川那次的教訓：真實的彎曲路徑
       * 用 maplibre 預設的 60，沿線標註會被**靜默拒絕**掉大半。這一層的標註不是
       * 裝飾——兩條線同色，畫面上唯一寫出「這條是中洋脊」的東西就是它。
       */
      render: { kind: "line", width: 2.6, label: { property: "name", maxAngle: 150 } },
      /**
       * ⚠️ 沿用「世界主要山脈」那個紫（`mountain`），不是新的顏色：這兩條**就是**
       * 山脈，同一個角色本來就該同一個色（比照地形景點藍與水系藍共用同一個 hex）。
       * 安地斯疊在母圖層上時也因此看起來是同一條線，而不是兩條顏色打架的線。
       *
       * ⚠️ 中洋脊會壓在張裂型板塊邊界（橘）上——那是必然的，它們是同一條東西的
       * 兩種說法。紫對橘的分離度是 `MOUNTAIN_COLOR` 那次掃描驗過的。
       */
      colorRole: "mountain",
      detail: { type: "geo", collection: "world-superlatives" },
      /** 線走 `fitBounds`，`browse.zoom` 會被忽略（中洋脊繞地球一圈，框出來就是全球視角） */
      browse: {},
      /**
       * ⚠️ `maxzoom: 6` 與「世界主要山脈」相同，理由也相同：一個像素在 zoom 6
       * 約 0.04°，正好是產物簡化容差（0.02°）的兩倍，再放大那條中軸線就會變成
       * 一條假的精確稜線。中洋脊同樣是 0.02° 簡化過的模型幾何。
       */
      maxzoom: 6,
      /**
       * ⚠️ **圖層層級不標 `schematic`，那是刻意的**：兩筆的性質不同——安地斯是
       * 由範圍面算出來的中軸線（示意），中洋脊是 Bird (2003) 的模型幾何（跟
       * 「板塊邊界」一樣不標示意）。所以警語掛在
       * `src/content/geo/world-superlatives/longest-land-range.json` 的
       * `schematic` 上，只出現在該出現的那一張卡上。
       */
      description:
        "最長的陸上山脈（安地斯山脈，約 7,000 公里）與最長的海底山脈（中洋脊，約 65,000 公里）。" +
        "地球上最長的山脈其實有九成以上在海面下——把「板塊邊界」一起打開，就看得出它為什麼長在那裡。",
      notes: [
        "⚠️ 山脈的長度沒有統一的量法（起訖點與是否含支脈都是製圖判斷），安地斯山脈常見的數字介於 7,000 至 8,900 公里之間。這裡採常被引用的約 7,000 公里，畫出來的那條中軸線本身不代表長度。",
        "⚠️ 中洋脊畫的是 Bird (2003) 板塊模型裡的海洋擴張脊（OSR）段落，**不含大陸裂谷**（東非大裂谷、貝加爾裂谷）——那些同屬張裂型邊界，但在陸地上，不是海底山脈。",
        "⚠️ 中洋脊與「板塊邊界」的張裂型邊界畫的是同一件事，兩層一起打開時會重疊。這一層是紫色實線、板塊邊界是橘色虛線。",
      ],
      sources: [
        "美國國家海洋暨大氣總署 中洋脊",
        "Peter Bird (2003) 板塊模型",
        "Nordpil 板塊資料集",
        "Natural Earth 1:10m 自然地理區",
      ],
    },
    {
      id: "world-picks",
      label: "作者精選",
      group: "世界櫥窗",
      status: "ready",
      /**
       * ## 這一層跟「世界之最」不是同一種東西
       *
       * 「世界之最」的每一筆都要有一個**量得出來、講得出憑據**的紀錄（最高、最低、
       * 最大、最長）；這一層收的是**編者挑的地方**——沒有紀錄可言，但在地圖上指得
       * 出來、而且講得出一個具體的故事。維蘇威火山就是為此分出來的：它不是最高、
       * 最大或最活躍的火山，硬掛在「世界之最」底下會把那一層的判準稀釋掉。
       *
       * ⚠️ **收錄界線要講得出口**（比照世界主要山脈的 39 條、火山中文名那 40 幾座）：
       * 課本、新聞或科普讀物會直接叫出名字，在地圖上找得到明確的位置，而且那個
       * 地方本身就是一堂課。**不是排名、也不會補完**，這件事寫在 `notes` 裡。
       */
      source: { type: "remote", path: "data/geo-manual/world-picks.geojson" },
      render: { kind: "circle" },
      /**
       * ⚠️ 同樣沿用 `place` 藍（「藍點＝地圖上一個有詳情卡的地點」），理由與
       * 「世界之最・高山與火山」那一層相同，見上。
       */
      colorRole: "place",
      detail: { type: "geo", collection: "world-picks" },
      /**
       * 依 `category` 分組（⚠️ `groupBy` 依序切、不排序，同一類在 geojson 裡必須
       * 連續）。目前只有一類，之後補進別的主題時分組才看得出作用。
       * 取景一樣寫在 geojson 的 `properties.zoom` 上逐筆決定。
       */
      browse: { groupBy: "category" },
      description:
        "編者挑出來、值得在地圖上找一找的地方。第一個是義大利的維蘇威火山——" +
        "西元 79 年那場噴發把山腳下的龐貝城整個埋起來，也留下人類第一份詳細的" +
        "火山噴發目擊記錄。",
      notes: [
        "⚠️ 這一層是編輯選集，不是排名，也不會補完。收錄的界線是：課本、新聞或科普讀物會直接叫出名字，在地圖上指得出明確的位置，而且那個地方本身就講得出一堂課。想找「最高」「最大」這類量得出來的紀錄請看同一組的「世界之最」兩層。",
        "⚠️ 收錄的活火山座標與「火山帶」那一層完全相同（同一份 GVP 資料），兩層一起打開時藍點與洋紅點會疊在同一個位置，那是刻意的。",
      ],
      sources: ["史密森尼學會 全球火山計畫（GVP）", "維基百科 西元79年維蘇威火山爆發"],
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
              keywords: ["熱帶", "Af", "Am", "As", "Aw", "熱帶雨林", "熱帶季風", "莽原"],
            },
            {
              id: "b",
              label: "B 乾燥氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-b.geojson" },
              color: KOPPEN_COLORS.b,
              keywords: ["乾燥", "BWh", "BWk", "BSh", "BSk", "沙漠氣候", "草原氣候", "半乾燥"],
            },
            {
              id: "c",
              label: "C 溫帶氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-c.geojson" },
              color: KOPPEN_COLORS.c,
              keywords: [
                "溫帶",
                "Cfa", "Cfb", "Cfc", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc",
                "溫暖濕潤", "海洋性", "地中海型", "副熱帶季風",
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
                "副極地", "針葉林氣候", "濕潤大陸性",
              ],
            },
            {
              id: "e",
              label: "E 極地氣候",
              source: { type: "remote", path: "data/geo/koppen-zones-e.geojson" },
              color: KOPPEN_COLORS.e,
              keywords: ["極地", "ET", "EF", "苔原氣候", "冰原氣候"],
            },
          ],
        },
        maxActive: 5,
        palette: Object.values(KOPPEN_COLORS),
        // 勾圖層就五類全開：這一層看的是「全球分成哪幾種氣候」，只顯示一類看不出分區
        defaultAll: true,
      },
      /**
       * 30 個亞型各是一筆圖徵，卡片走 `FeatureCard` 的 fallback（沒有內容檔，
       * 名稱／判準／代表地點都在建置期寫進 geojson，見 lib/koppen.mjs 的 `SUBTYPES`）。
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
      // places 內容裡 region === "world" 的部分。目前只有 4 筆（開羅、塔曼拉塞特、
      // 馬薩特蘭、希洛），都是為了同緯度比較挑的；之後回補城市資料時直接加
      // src/content/places/*.json 即可，這裡不用改。
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
      ],
      sources: ["Natural Earth 1:50m 河流與湖泊中心線"],
    },
    {
      id: "world-countries",
      label: "國界",
      group: "國界與大洲",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      description: "各國國界線，用來對照政治疆界與自然地理界線的差異。",
      sources: ["Natural Earth 1:50m 國界"],
    },
    {
      id: "world-continents",
      label: "大洲分區",
      group: "國界與大洲",
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
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "主要都會區的人口規模，看世界人口為什麼集中在少數地帶。",
      sources: ["Natural Earth 1:10m 城市聚落"],
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
