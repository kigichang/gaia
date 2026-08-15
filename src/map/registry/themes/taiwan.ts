// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import {
  CROP_COLORS,
  MAX_SIMULTANEOUS_SPECIES,
  MONUMENT_LEVEL_COLORS,
  POPULATION_DENSITY_RAMP,
  RESERVOIR_FILL_RAMP,
  SPECIES_COLORS,
  TRANSPORT_COLORS,
  TRANSPORT_DASH,
  TYPHOON_INTENSITY_RAMP,
  VEGETATION_BELTS,
} from "../../thematicColors.ts";
import type { ThemeDefinition } from "../types.ts";

/**
 * 臺灣地理。
 *
 * ⚠️ 這個檔案必須是**純資料**——只能 `import type` 型別，以及 value-import
 * `thematicColors`（無 import 的常數模組）。理由見 `registry/types.ts` 的說明：
 * `scripts/validate-content.mjs` 要用 Node type stripping 直接 import 註冊表，
 * 才能在建置期抓到「宣告的 geojson 檔案不存在」這種在執行期完全靜默的錯誤。
 */
export const taiwanTheme: ThemeDefinition = {
  id: "taiwan",
  label: "臺灣地理",
  subtitle: "從行政區、山系水系到原住民族與特有種，看臺灣這座島的組成。",
  /**
   * 進站第一眼：全島視角 + 臺灣地理中心碑的詳情卡。
   *
   * ⚠️ **三件事必須一起改，不然第一眼就是壞的**（曾經開在玉山 zoom 12 + 玉山主峰的
   * 詳情卡，那時 `defaultOn` 是五大山脈）：
   *
   * 1. `camera` 要看得到 `initialSelection` 指的那個圖徵——這裡用 zoom 7，跟該筆
   *    feature 自己的 `properties.zoom` 一致（全島剛好填滿畫面）。
   * 2. `initialSelection` 指到的圖層必須 `defaultOn`，否則卡片在講一個地圖上不存在
   *    的東西（`tw-territory` 因此要標 defaultOn）。
   * 3. ⚠️ **zoom 7 看不到等高線**（`CONTOUR_MIN_ZOOM` 是 9）。這是刻意的取捨：這個
   *    主題現在的開場是「臺灣有多大、範圍到哪裡」，等高線在使用者放大之後就會出現。
   *    要改回以地形為開場，就得把上面三件事一起換回去。
   */
  camera: { center: [120.9797, 23.9739], zoom: 7 },
  recommendedBasemap: "nlsc-emap",
  /**
   * ⚠️ 「天然災害」是後來從「地形」拆出來的：活動斷層、臺灣地震、重大地震
   * 原本都掛在地形底下，但它們講的不是地貌而是**災害**——加了颱風之後，
   * 「地形」會變成一個什麼都放的雜物櫃，而颱風更是連地形都不算。
   * 拆完「地形」剩地形景點與五大山脈，兩邊的語意都乾淨了。
   *
   * 排在「水系」之後、「人文」之前：前面三組是這座島的自然骨架，
   * 災害是發生在那副骨架上的事，之後才輪到人。
   */
  groups: ["臺灣123", "行政區", "地形", "水系", "天然災害", "人文", "植被生態", "農業物產"],
  initialSelection: {
    detail: { type: "geo", collection: "tw-territory" },
    featureId: "taiwan-main-island",
  },
  layers: [
    {
      id: "tw-territory",
      label: "土地與島群",
      group: "臺灣123",
      status: "ready",
      // 手繪示意幾何（六個代表點），所以放 geo-manual——那個目錄 build:geodata 永遠
      // 不會碰。⚠️ 每個點是「這個島群在哪裡」，不是島群的範圍，所以 schematic。
      source: { type: "remote", path: "data/geo-manual/tw-territory.geojson" },
      render: { kind: "circle" },
      /**
       * 沿用 `place` 藍，跟五大山脈的主峰、縣市政府同一個理由：POINT 色票已經飽和
       * （見 thematicColors.ts），而藍在語意上是一致的——「藍點＝地圖上一個有詳情卡
       * 的地點」。要換色請先重跑 `validate_palette.js --pairs all` 明暗兩模式。
       */
      colorRole: "place",
      detail: { type: "geo", collection: "tw-territory" },
      /**
       * 清單分成「臺灣本島及附屬島嶼」與「離島」兩組（`groupBy: "category"` 依序切、
       * **不排序**，所以 geojson 的 feature 必須讓同一組連續）。
       *
       * 12 個點散布在北緯 10–26 度、東經 114–123 度，一次框不進同一個畫面（框了就
       * 只剩一片海）。所以**每個 feature 自己帶 `zoom`**（geojson 的 properties.zoom，
       * `flyToFeature` 會優先讀它）：本島 7、中沙 8、澎湖與馬祖 10、金門 11、東沙 12、
       * 其餘小島 13。這裡的 10 只是沒帶 zoom 時的預設。
       */
      browse: { groupBy: "category", zoom: 10 },
      // 進站就開著：`initialSelection` 指的是這一層的臺灣本島，圖層沒開的話卡片會在
      // 講一個地圖上不存在的東西（見上面 camera 那段的三件事）
      defaultOn: true,
      schematic: true,
      description:
        "臺灣本島與它的四個極點，五座主要附屬島嶼（蘭嶼、綠島、琉球嶼、釣魚臺、龜山島），" +
        "加上澎湖、金門、馬祖與南海的東沙、中沙、南沙六個離島群。面積、島嶼數與經緯度" +
        "範圍取自行政院《國情簡介》「土地」一章——把「我國領土有多大、南北跨多遠」這件事" +
        "從課本的數字變成地圖上的距離：點極北點與極南點，兩次取景之間跨過的就是 394 公里。",
      notes: [
        "⚠️ 圓點是**代表位置，不是島嶼或島群的範圍**。南沙群島跨了 8 個緯度、澎湖有 64 " +
          "個島，一個點畫不出來。蘭嶼、綠島、琉球嶼、釣魚臺、龜山島五個點是用內政部國土" +
          "測繪中心的鄉鎮界幾何算形心；東沙用行政院該頁給的北緯 20°42′、東經 116°43′；" +
          "其餘標在主島上的知名地點（埔里地理中心碑、馬公、金城、南竿、太平島）。",
        "⚠️ **面積的來源不只一個**：六個島群與本島的數字出自行政院《國情簡介》（該頁" +
          "標的資料來源是內政部），五座附屬島嶼的面積官方那頁沒有列，取自維基百科的" +
          "島嶼列表（次級來源），所以寫成「約」。兩者不要混為一談。",
        "⚠️ 中沙群島**除黃岩島外全在海面下**，圓點標的是中沙大環礁中央，那裡沒有陸地" +
          "——地圖與衛星影像上都看不到島，這不是資料缺漏。",
        "⚠️ 四個極點是**臺灣本島**的極點，不是我國領土的極點：把附屬島嶼算進來，最北是" +
          "基隆市的彭佳嶼、最東是宜蘭縣的釣魚臺、最南是南沙的太平島。座標由內政部國土" +
          "測繪中心的縣市界幾何取極值算出，誤差約 90 公尺（該圖資的簡化容差）。",
      ],
      sources: ["行政院 國情簡介－土地", "內政部", "維基百科", "內政部國土測繪中心"],
    },
    {
      id: "tw-counties",
      label: "縣市界",
      group: "行政區",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-counties.geojson" },
      render: { kind: "fill", fillOpacity: 0.16, outlineWidth: 1.2 },
      colorRole: "boundary",
      /**
       * ⚠️ `hideLayerDescription`：卡片不印圖層說明——那段字對每一個縣市都逐字相同，
       * 而且就是抽屜那一列的內容（見 registry/types.ts）。
       *
       * 22 個縣市**都有內容檔**，所以今天它其實是 no-op（`FeatureCard` 只有在沒有
       * 內容檔時才走 fallback）。掛著是為了規則一致：哪天新增一個縣市而內容檔還沒
       * 寫，卡片會是「名稱＋來源」而不是整片圖層說明。
       */
      detail: { type: "geo", collection: "tw-counties", hideLayerDescription: true },
      browse: {},
      /**
       * 縣市政府所在地，跟著縣市界一起開關、在可點清單裡巢狀排在各縣市底下。
       * 比照五大山脈 → 主峰的做法（見 registry/types.ts 的 LayerAttachment）。
       *
       * 顏色同樣沿用 `place` 藍：POINT 色票已經飽和，實測把縣市界橘 `#d95926` 加進去，
       * 它跟原住民族紅 `#e34948` 的一般視覺 ΔE 只有 **5.1**（CVD 更只有 2.7），比洋紅
       * 那次還糟。藍在語意上是一致的——「藍點＝地圖上一個有詳情卡的地點」。
       *
       * `browse.zoom` 是 **10**：這一層的教學重點是「政府設在這個縣市的哪裡」，所以
       * 取景必須讓政府點**與所屬縣市的面同時看得見**，而縣市面的 `maxzoom` 是 11。
       * 曾經設成 14（街廓尺度），結果飛過去兩者都在 maxzoom 之外，畫面完全空白。
       *
       * 這個附屬圖層**不設 maxzoom**：一個點沒有縣市面那種簡化縫隙的問題，使用者
       * 手動再放大時政府點應該還在（消失的只有縣市面，那是它自己的設計）。
       */
      attach: {
        id: "tw-county-halls",
        label: "縣市政府",
        source: { type: "remote", path: "data/geo-manual/tw-county-halls.geojson" },
        render: { kind: "circle" },
        colorRole: "place",
        // 同上：22 處縣市政府都有內容檔，掛著是為了規則一致
        detail: { type: "geo", collection: "tw-county-halls", hideLayerDescription: true },
        parentProperty: "countyId",
        browse: { zoom: 10 },
        description:
          "各縣市政府的辦公廳舍位置。臺南、高雄、臺中、苗栗有兩處辦公中心，這裡標的是主要那一處，另一處寫在說明裡。",
        sources: ["維基百科"],
      },
      // 相鄰面各自簡化會在共用邊界留下次像素縫隙（見 scripts/lib/simplify.mjs）。
      // maxzoom 讓它在縫隙變得可解析之前就停止繪製——這同時也是正確的製圖判斷：
      // 縣市界的面染是小比例尺的教學裝置，不是 zoom 14 的圖層。
      maxzoom: 11,
      description:
        "六個直轄市與十六個縣市，共 22 個。界線取自內政部國土測繪中心的實測圖資，" +
        "離島依行政歸屬繪出：東沙群島與南沙太平島屬高雄市、烏坵屬金門縣、釣魚臺列嶼屬宜蘭縣。" +
        "面積小於 0.1 平方公里的礁岩已略去。點選任一縣市可看面積、人口、地形與區域特色。",
      sources: ["內政部國土測繪中心", "內政部戶政司 114年各鄉鎮市區人口密度"],
    },
    {
      id: "places",
      label: "地形景點",
      group: "地形",
      status: "ready",
      /**
       * 五座主峰**不在**這一層——它們是「五大山脈」的附屬圖徵。排除的邏輯在
       * `resolve.ts` 的 `places-taiwan` loader，理由見那裡的說明。
       *
       * ⚠️ **`src/content/places/taipei.json` 不可以刪。** 它同時被 `/compare` 的
       * 「臺北 ↔ 開羅」預設組合使用，刪掉會讓比較頁那一組壞掉。
       */
      source: { type: "bundled", content: "places-taiwan" },
      // radius 不填 → 預設 6，與重構前的 places-points 完全一致
      render: { kind: "circle" },
      colorRole: "place",
      detail: { type: "place" },
      /**
       * `browse.zoom` 只是 fallback：每個地點的 `defaultZoom` 會覆寫它
       * （`placesCollection()` 把它寫進 feature 的 `zoom` 屬性）。這一層的尺度差距
       * 很大——嘉南平原要 zoom 10 才框得住，桶盤嶼要 15 才看得到石柱——所以取景
       * 交給各筆資料自己決定，這裡只留一個中間值。
       */
      browse: { zoom: 11 },
      description:
        "課本提到的臺灣代表性地形：平原、盆地、台地、惡地、峽谷、火山，以及岩岸、沙洲潟湖、斷層海岸、珊瑚礁海岸四種海岸。五座主峰改列在「五大山脈」各山脈底下。",
      sources: ["內政部國土測繪中心", "交通部觀光署", "農業部林業及自然保育署"],
    },
    {
      id: "indigenous",
      label: "原住民族分佈",
      group: "人文",
      status: "ready",
      source: { type: "bundled", content: "indigenous" },
      render: { kind: "circle", radius: 7 },
      colorRole: "indigenous",
      detail: { type: "indigenous" },
      browse: { zoom: 10 },
      description:
        "16 族的代表點。標記位置是文化園區或行政中心，不是精確的分布邊界。",
      sources: ["原住民族委員會全球資訊網"],
    },
    {
      id: "species",
      label: "特有種生態分佈",
      group: "植被生態",
      status: "ready",
      render: { kind: "circle", radius: 4 },
      detail: { type: "species" },
      items: {
        // 清單從 src/content/species/*.json 推導，不硬編在這裡：
        // 新增一個物種 JSON 就會自動出現在 UI，不必同時改註冊表。
        from: { type: "content", collection: "species" },
        maxActive: MAX_SIMULTANEOUS_SPECIES,
        palette: SPECIES_COLORS,
      },
      description:
        "GBIF 的歷史觀測紀錄。反映的是賞鳥與採集活動的熱點，不是族群密度普查。",
      sources: ["GBIF Global Biodiversity Information Facility"],
    },
    {
      id: "tw-monuments",
      label: "古蹟",
      group: "人文",
      status: "ready",
      // 半徑 4（比照特有種）而不是預設的 6：全臺 1,064 處，在市區會非常密集，
      // 6px 的點在臺北、臺南舊城區會糊成一片連不出個別位置。
      render: { kind: "circle", radius: 4 },
      detail: { type: "monument" },
      items: {
        /**
         * 三級各一個檔，不是一個檔加 filter。**只勾「國定古蹟」就只抓 50 KB**，
         * 而不是整包 477 KB——一個班 30 個學生同時開站時，這就是這一層開不開得起來
         * 的差別。（`LayerItem.filter` 那條路目前全站沒有實作，見 types.ts。）
         *
         * 順序＝級別由高到低，勾選清單第一個就是課本最常提到的國定古蹟。
         */
        from: {
          type: "inline",
          list: [
            {
              id: "national",
              label: "國定古蹟",
              source: { type: "remote", path: "data/geo/tw-monuments-national.geojson" },
              color: MONUMENT_LEVEL_COLORS["國定古蹟"],
            },
            {
              id: "municipal",
              label: "直轄市定古蹟",
              source: { type: "remote", path: "data/geo/tw-monuments-municipal.geojson" },
              color: MONUMENT_LEVEL_COLORS["直轄市定古蹟"],
            },
            {
              id: "county",
              label: "縣(市)定古蹟",
              source: { type: "remote", path: "data/geo/tw-monuments-county.geojson" },
              color: MONUMENT_LEVEL_COLORS["縣(市)定古蹟"],
            },
          ],
        },
        maxActive: 3,
        // 三級都有固定色（見 MONUMENT_LEVEL_COLORS），palette 只是型別上的備援，
        // 實際不會被用到——勾選順序不該影響哪一級是哪個顏色。
        palette: Object.values(MONUMENT_LEVEL_COLORS),
        // items 圖層沒有可點清單，搜尋是這一層唯一的檢索入口（見 types.ts）
        indexFeatures: true,
      },
      // 1,064 處大多在市區，縮到全島尺度只會是一團色點。zoom 9 大約是一個縣市
      // 填滿畫面的尺度，也是「古蹟聚在舊城區」這件事開始看得出來的地方。
      minzoom: 9,
      /**
       * ⚠️ `items` 圖層**不會**長出可點清單（ThemeMapPage 的 `!l.items`），這裡宣告
       * `browse` 只為了 `zoom`——搜尋選到一處古蹟時要飛到的縮放。不宣告的話會落回
       * 預設的 11，那個尺度看一棟單體建築太遠。16 大約是一個街廓。
       */
      browse: { zoom: 16 },
      description:
        "文化部文化資產局公告的 1,064 處古蹟，依指定級別分成三層。" +
        "顏色越深代表級別越高（國定 > 直轄市定 > 縣(市)定），這是《文化資產保存法》的三級指定制度。" +
        "點選可看指定年份、類別與官方的歷史沿革。",
      notes: ["⚠️ 臺東縣沒有任何古蹟——當地的文化資產是「歷史建築」，屬於另一個類別。"],
      sources: ["文化部文化資產局"],
    },

    // ── 以下是後來陸續補上的圖層 ────────────────────────────────────
    // `status: "planned"` 會顯示成停用的核取方塊，但 description 仍然要寫清楚
    // ——一個沒有文字的停用選項什麼都沒教到。**目前已經沒有 planned 的圖層了**，
    // 這條規則留著給下一個佔位用。
    {
      id: "tw-townships",
      label: "鄉鎮市區界",
      group: "行政區",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-townships.geojson" },
      render: { kind: "fill" },
      /**
       * 沿用縣市界的橘，不挑新色。這是既有的「同家族共用色」判例——`tw-basins`
       * （面）與 `tw-rivers`（線）就刻意同為 `hydrology` 藍。鄉鎮與縣市是同一個
       * 行政區家族的兩個層級，比水系那組更適用；而線／面色票已經是驗過的五色
       * 飽和狀態，為同一個家族再挑第六色要重跑完整色域掃描，不划算。
       */
      colorRole: "boundary",
      // 三層（鄉鎮市區界／人口/都市體系／主要作物分布）共用同一張詳情卡與同一組
      // featureId（官方 TOWNCODE），見 registry/types.ts 的 township 說明
      detail: { type: "township" },
      // 368 筆平鋪很難看出縣市層級，改成「縣市名 + 底下縮排的鄉鎮」（見 LayerBrowse.groupBy）
      browse: { groupBy: "county" },
      /**
       * 理由與縣市界相同：相鄰的面各自簡化會在共用邊界開出次像素縫隙
       * （Douglas–Peucker 不保拓樸），所以要在縫隙變得可解析之前停止繪製。
       * 縣市設 11；鄉鎮的容差比較粗（133 公尺）但本來就是要放大來看的層級，
       * 設 12（在 zoom 12 約 3.8 px）。
       */
      maxzoom: 12,
      description: "全臺 368 個鄉鎮市區的實測界線，是縣市底下的下一個行政層級。",
      notes: [
        "⚠️ 鄉鎮名不唯一——中正區、信義區、中山區、東區等 8 個名稱散在不同縣市，" +
          "所以清單依縣市分組，搜尋結果則在副標標出縣市。",
      ],
      sources: ["內政部國土測繪中心"],
    },
    {
      id: "tw-ranges",
      label: "五大山脈",
      group: "地形",
      status: "ready",
      // 手繪示意稜線：山脈沒有像行政區那樣的官方界線圖資，Natural Earth 也沒有
      // 收錄。畫的是「走向與分界」，不是精確稜線，所以一定要標 schematic。
      source: { type: "remote", path: "data/geo-manual/tw-ranges.geojson" },
      render: { kind: "line", width: 2.6, label: { property: "name" } },
      colorRole: "relief",
      detail: { type: "geo", collection: "tw-ranges" },
      browse: {},
      /**
       * 主峰跟著這個核取方塊一起出現，並在可點清單裡巢狀排在各自的山脈底下。
       *
       * 顏色沿用 `place` 藍而不是山脈的洋紅，**這是被色票驗證逼出來的**，不是隨手選：
       * POINT 色票（藍／紅／青／黃／紫）已經是 all-pairs 全過的飽和狀態，把洋紅
       * `#c23f8f` 加進去，它跟原住民族紅 `#e34948` 的一般視覺 ΔE 只有 13.0，直接
       * FAIL（驗證器明講這一項不能用次要編碼豁免）。紫、棕、青綠等候選也全部 FAIL。
       * 藍在語意上也站得住：主峰開的是 `PlaceCard`（有海拔與氣候圖表），本來就是地點。
       */
      attach: {
        id: "tw-range-peaks",
        label: "主峰",
        source: { type: "derived", derived: "tw-range-peaks" },
        render: { kind: "circle" },
        colorRole: "place",
        detail: { type: "place" },
        parentProperty: "rangeId",
        browse: { zoom: 12 },
      },
      schematic: true,
      /**
       * 接手「地形景點」原本的預設開啟。
       *
       * 這個主題的 `initialSelection` 是玉山主峰、`camera` 也開在玉山，主峰又已經
       * 移到這個圖層底下——不預設開啟的話，進站第一眼會是「詳情卡在講玉山主峰，
       * 地圖上卻沒有任何圖徵」。
       */
      defaultOn: true,
      description:
        "中央、雪山、玉山、阿里山、海岸五大山脈的走向與分界，以及各自的主峰。搭配等高線一起看，可以對照稜線位置與高程分布。",
      sources: ["維基百科", "內政部國土測繪中心"],
    },
    {
      id: "tw-rivers",
      label: "臺灣河川",
      group: "水系",
      status: "ready",
      // 河道幾何來自 OpenStreetMap 的 waterway 關聯，用 ref（水利署河川代碼）選取。
      // 水利署自己的 RIVERLIN SHP 依「名稱字串」分筆而非依實際河川分筆，上游改名的
      // 河段會斷成另一筆；OSM 的關聯是依實際河川建立的，改名的上游河段收在同一個
      // 關聯裡（見 scripts/lib/rivers.mjs 的 RIVER_OSM_REFS）。
      source: { type: "remote", path: "data/geo/tw-rivers.geojson" },
      // ⚠️ maxAngle 150（預設 60）：真實河道比手繪示意線彎得多，`symbol-placement: line`
      // 在急彎上會**靜默拒絕**放置。實測全島視角（zoom 7.3、1512×772）預設值只標得出
      // 1 條，其中不含濁水溪這種課本必講的河；150 標出 9 條、涵蓋所有主要河川。
      // 140／160 的結果完全相同，180 再多兩條但等於完全不設限，留一點防護比較安全。
      // 放大到 zoom 10 也不會讓同一條河重複冒出來（spacing 維持預設 120 即可）。
      render: { kind: "line", width: 2, label: { property: "name", maxAngle: 150 } },
      colorRole: "hydrology",
      /**
       * ⚠️ `hideLayerDescription`：**147 條現在全部都有內容檔，所以這個旗標今天是
       * no-op**（比照 `tw-protected-areas`），掛著是為了規則一致——之後新增一條河
       * 而內容檔還沒寫時，卡片會是「名稱＋管理等級＋來源」，而不是整片跟抽屜那一列
       * 完全重複的圖層說明。
       */
      detail: { type: "geo", collection: "tw-rivers", hideLayerDescription: true },
      // 118 筆平鋪太長，改成依公告的管理等級分組（見 LayerBrowse.groupBy）：
      // 課本會點名的 24 條中央管河川排在最前面，65 條縣(市)管的排在最後。
      browse: { groupBy: "category" },
      description:
        "經濟部公告的全部 118 個列管水系，加上 29 條主要支流。" +
        "前四組是公告的管理等級：中央管 24、跨省市 2（淡水河、磺溪）、" +
        "直轄市管 27、縣(市)管 65。等級代表的是「由哪一級政府管理」，" +
        "大致也對應河川的規模——濁水溪、高屏溪、淡水河這些大河可以看出中央山脈" +
        "如何分開東西水系，而北海岸與東海岸那一長串短促的小溪，本身就是" +
        "「分水嶺偏東、河川東短西長」的例子。" +
        "第五組「主要支流」不是管理等級——支流依公告定義屬於母水系（基隆河、新店溪都" +
        "屬於淡水河水系），但課本一定會講，所以另外挑了 29 條收進來；" +
        "冬山河已改列區域排水、不在公告的 118 個水系內，也收在這一組。",
      notes: [
        "⚠️ 公告明訂「排水」不屬於河川，所以愛河、東螺溪這類已改列排水的水道不在" +
          "前四組裡。唯一的例外是冬山河——它同樣已改列區域排水，但童玩節與親水公園" +
          "都在這條河上，而且水文上與蘭陽溪在入海口附近匯流，所以收在第五組「主要支流」，" +
          "卡片上也註明了它的管理分類。",
        "⚠️ 大漢溪、荖濃溪、虎尾溪、南庄溪、油羅溪沒有單獨列出：它們是母幹流上游" +
          "改名的河段，河道本來就畫在淡水河、高屏溪、北港溪、中港溪、頭前溪那幾條線上了，" +
          "搜這幾個名字會找到對應的幹流。",
        "⚠️ 河道線位來自 OpenStreetMap（以水利署河川代碼比對）。" +
          "幹流長度與流域面積有兩種出處：47 條是水利署的官方數字，" +
          "其餘的官方沒有發布，改用維基百科——每張卡片的「資料來源」都會標明是哪一種，" +
          "兩者的量測基準不同，不要直接相加比較。" +
          "河川界點由各級主管機關各自訂定，沒有全國一致的長度表；" +
          "少數河川的最上游河段在 OSM 尚未收錄，線會比標示的長度短一些。",
      ],
      sources: ["OpenStreetMap", "經濟部水利署"],
    },
    {
      id: "tw-basins",
      label: "流域分區",
      group: "水系",
      status: "ready",
      // 跟「臺灣河川」共用 scripts/lib/rivers.mjs 的同一份 118 條官方清單，但
      // **產物只有 72 筆**：上游 BASIN 圖資只給其中 72 個水系個別的流域代碼。
      // 幾何也來自另一份 SHP（BASIN，面），不是從河川線推導出來的——集水區範圍
      // 需要真正的水文測繪，不是幾何運算。
      source: { type: "remote", path: "data/geo/tw-basins.geojson" },
      render: { kind: "fill" },
      // 面／線共用同一組已驗證色票（水系藍／行政區橘／山脈洋紅），fill 目前只有
      // 縣市界（boundary 橘）用掉一個名額，這裡用 hydrology 藍——跟河川線同色，
      // 是刻意的：形狀（半透明面 vs 線）已經足夠區辨，藍色維持「水系」的視覺家族。
      colorRole: "hydrology",
      detail: { type: "geo", collection: "tw-basins" },
      // 比照「臺灣河川」依公告等級分組（見 LayerBrowse.groupBy）
      browse: { groupBy: "category" },
      description:
        "72 個水系的集水區範圍，說明分水嶺與流域的概念——山脈稜線兩側的雨水，" +
        "會分別匯集到不同的流域裡。搭配「臺灣河川」一起勾選，可以看出" +
        "「一條河」與「它收集雨水的那片山坡」是兩件不同的事。" +
        "這裡的面是另一份水利署圖資，不是從河川線推算出來的。",
      notes: [
        "⚠️ 比「臺灣河川」少了 46 條：水利署只發布其中 72 個水系的個別流域範圍，" +
          "其餘小水系被歸在同一個群組代碼底下，沒辦法拆出來對應到單一河川。",
        "⚠️ 流域面積只有中央管與跨省市河川有官方數字。",
      ],
      sources: ["經濟部水利署"],
    },
    {
      id: "tw-reservoirs",
      label: "主要水庫與即時水情",
      group: "水系",
      status: "ready",
      // 靜態幾何 + 即時水情兩份資料 join（見 registry/types.ts 的 DerivedId）
      source: { type: "derived", derived: "tw-reservoirs" },
      /**
       * 兩個量各佔一個視覺通道：**半徑＝有效容量**（固定的規模），
       * **顏色＝目前蓄水率**（每小時在變的水情）。
       *
       * 半徑刻意**不是**嚴格的面積正比。真的照 `14/√50479 × √c` 畫，小池水庫
       * （17.9 萬 m³）會是 0.26 px——等於看不見，而它是澎湖唯一的水庫，課本講
       * 離島缺水時會用到。所以改成「√容量 線性內插到 3.5–14 px」：大小關係仍然
       * 單調（曾文最大、澎湖那幾座最小），但最小的那幾座保有可點擊的下限。
       * 讀者要精確數字時卡片上就有，圓點負責的是「一眼看出量級差距」。
       */
      render: {
        kind: "circle",
        radius: [
          "interpolate",
          ["linear"],
          ["sqrt", ["coalesce", ["get", "capacity"], 0]],
          0,
          3.5,
          225,
          14,
        ],
        colorRamp: RESERVOIR_FILL_RAMP,
      },
      // 顏色雖然由 ramp 決定，圖層身分色仍然是水系藍——圖例與抽屜色塊要用它，
      // 而且水庫本來就該留在「藍色＝水」這個家族裡
      colorRole: "hydrology",
      detail: { type: "reservoir" },
      browse: { zoom: 12 },
      // 全臺 40 座水庫擠在一座島上，小比例尺會糊成一團藍點。zoom 6 大約是
      // 整個臺灣剛好填滿畫面的尺度。
      minzoom: 6,
      description:
        "經濟部水利署公告的 40 座水庫。圓點大小是有效容量、顏色是目前蓄水率，" +
        "點選可看水位、進出流量與集水區降雨。",
      notes: [
        "⚠️ 集集攔河堰、石岡壩、直潭壩是引水與調節設施，不是蓄水設施，蓄水率天生偏低；" +
          "阿公店水庫等水庫在排砂或清淤期間也會刻意維持低水位——低不一定代表缺水。",
      ],
      sources: ["經濟部水利署"],
    },
    {
      id: "tw-population",
      label: "人口與都市體系",
      group: "人文",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-population.geojson" },
      /**
       * 兩個量各佔一個視覺通道：**半徑＝年底人口數**（這裡住了幾個人），
       * **顏色＝人口密度**（擠得多擠）。這一層的教學重點就是那兩件事會分開——
       * 人口最多的板橋區 55.0 萬密度是 23,761，而密度最高的永和區 37,022 只有
       * 21.2 萬人；新店區 30.7 萬人但密度只有 2,553，因為轄區大半是山。
       *
       * 半徑跟水庫一樣**不是**嚴格的面積正比：真的照比例畫，烏坵鄉（593 人）
       * 會小到看不見也點不到。改成「√人口 線性內插到 2.5–11 px」——大小關係
       * 仍然單調，最小的那幾個保有可點擊的下限。上限比水庫的 14 px 小，是因為
       * 這一層有 368 個點而水庫只有 40 個，14 px 在新北會糊成一整片。
       */
      render: {
        kind: "circle",
        radius: [
          "interpolate",
          ["linear"],
          ["sqrt", ["coalesce", ["get", "population"], 0]],
          0,
          2.5,
          750,
          11,
        ],
        colorRamp: POPULATION_DENSITY_RAMP,
      },
      // 顏色由 ramp 決定，但圖例與抽屜的色塊要有一個身分色（見 thematicColors.ts）
      colorRole: "population",
      // 三層（鄉鎮市區界／人口/都市體系／主要作物分布）共用同一張詳情卡與同一組
      // featureId（官方 TOWNCODE），見 registry/types.ts 的 township 說明
      detail: { type: "township" },
      /**
       * 清單依**行政層級**分組（區／縣轄市／鎮／鄉），層級之內依人口由多到少。
       * 這就是圖層名稱裡「都市體系」那一半：《地方制度法》的層級本身就是官方的
       * 都市階層，而且從鄉鎮名末字就讀得出來，不必另外找一份資料。
       *
       * ⚠️ `groupBy` 依序切、不排序，所以 geojson 的 feature 必須讓同一層級連續
       * ——排序在 build-geodata.mjs 的 transform 裡做掉了。
       */
      browse: { groupBy: "level", zoom: 11 },
      // 368 個點擠在一座島上，小比例尺會糊成一團。zoom 6 大約是整個臺灣剛好
      // 填滿畫面的尺度，比照水庫。
      minzoom: 6,
      description:
        "內政部戶政司 114 年底統計，368 個鄉鎮市區的人口。" +
        "圓點大小是年底人口數、顏色是人口密度——兩個量會分開：板橋區人口最多（55.0 萬），" +
        "但密度最高的是永和區（37,022 人/km²，人口只有 21.2 萬）。" +
        "清單依《地方制度法》的行政層級（區／縣轄市／鎮／鄉）分組，那是官方的都市階層。",
      notes: [
        "⚠️ 行政層級不等於主計總處定義的「都會區」——「區」只代表它隸屬直轄市或市，" +
          "不代表那裡就是都會中心。",
      ],
      sources: ["內政部戶政司 114年各鄉鎮市區人口密度", "內政部國土測繪中心"],
    },
    {
      id: "tw-transport",
      label: "主要交通軸線",
      group: "人文",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-transport.geojson" },
      /**
       * 沿線標註用 `shortName`（「國道1」「西部幹線」）而不是 `name`。
       *
       * 這不是排版偏好：`name` 是「國道一號（中山高速公路）」這種 11 個字的字串，
       * 而放置演算法要求越長的字串就要越平直的線段，長字串配上交流道一帶的彎道
       * 會被**整個靜默拒絕**、標註數直接歸零（見 CLAUDE.md「沿線標註很脆弱」）。
       * 詳情卡與可點清單顯示的仍然是全名。
       *
       * `spacing` 調到 400（預設 120）：臺鐵幹線在 OSM 裡是十幾條平行或分段的
       * 折線，而 maplibre 是**逐一 LineString** 放置標註的，沿用等高線那組密集
       * 參數會讓「西部幹線」四個字在同一段路上重複好幾次。這跟緯度參考線要調高
       * spacing 是同一類問題（見 CLAUDE.md）。
       */
      render: {
        kind: "line",
        /**
         * ⚠️ **3.2 而不是一般線圖層的寬度，是為了扛住深色描邊。** 描邊的光暈會透過
         * 反鋸齒滲進線裡，2.2px 時高鐵的朱紅（L 0.72，很亮）會被壓成深褐色，
         * 而「七條各自一色」正是這一層的重點。加粗讓核心色的像素佔比提高。
         * 改線寬或改描邊顏色之後要重看實際畫面，見 layers/geo.ts 的 CASING_COLOR。
         */
        width: 3.2,
        /**
         * ⚠️ 描邊不是裝飾。NLSC 通用電子地圖把國道與省道畫成淡粉紅
         * （`#f8c0c0`／`#f8b8b8`），而高鐵的朱紅離它們只有 ΔE 14.0——實測在全島
         * zoom 8 單獨開高鐵時**找不到那條線**（其他六條離底圖是 25–48）。
         * 暖色端已被行政區橘與斷層磚紅夾住，掃過整個色域也沒有可用的紅系替代色，
         * 所以改用與色相無關的描邊把線拉出來，高鐵才得以維持官方識別色。
         */
        casing: true,
        label: { property: "shortName", spacing: 400 },
      },
      /**
       * 七條軸線各自一色、各自一個核取方塊。
       *
       * ⚠️ 子項目**沒有自己的 source**，是用 `featureIds` 從母圖層那一份切出來的
       * （見 types.ts 的 `LayerItem.featureIds`）——這一層的七條本來就在同一個
       * geojson 裡，拆成七個檔案只會讓學生多付七次請求。
       *
       * ⚠️ 三個 id 是**同一個字串**：geojson 的 `properties.id`、這裡的 item id、
       * 以及 `src/content/geo/tw-transport/<id>.json` 的檔名。三者一致，點子項目
       * 名稱才會開出那條軸線的內容檔（`handleItemNameClick` → `flyToFeature` 的
       * `targetsItemItself` 分支會 fitBounds 到那條線）。
       *
       * ⚠️ 顏色是**固定色**不是依勾選順序指派的（比照古蹟三級）：先勾南迴線再勾
       * 高鐵時，高鐵仍然必須是朱紅，否則「綠＝公路、靛＝鐵路」的圖例當場失效。
       * `palette` 只是型別上的備援。
       *
       * ⚠️ 鐵路的 `dash` 是**無障礙的第二通道，不是裝飾**：高鐵朱紅與國道綠橫跨
       * 紅綠軸，色盲下必然分不出來，理由與量測值見 thematicColors.ts 的
       * `TRANSPORT_COLORS`。拿掉它等於讓色盲使用者分不出公路與鐵路。
       */
      items: {
        from: {
          type: "inline",
          list: [
            {
              id: "thsr",
              label: "臺灣高速鐵路",
              featureIds: ["thsr"],
              // keywords 逐字取自 geojson 的 shortName 與 meta——那是改成子項目
              // 之前搜得到的字串，不補這一份等於讓既有的搜尋行為悄悄退步
              keywords: ["高鐵", "南港—左營・西部走廊"],
              color: TRANSPORT_COLORS.thsr,
              dash: TRANSPORT_DASH,
            },
            {
              id: "freeway-1",
              label: "國道一號",
              featureIds: ["freeway-1"],
              keywords: ["國道1", "中山高速公路", "基隆—高雄・臺灣第一條高速公路"],
              color: TRANSPORT_COLORS["freeway-1"],
            },
            {
              id: "freeway-3",
              label: "國道三號",
              featureIds: ["freeway-3"],
              keywords: ["國道3", "福爾摩沙高速公路", "基隆—林邊・沿西部丘陵臺地"],
              color: TRANSPORT_COLORS["freeway-3"],
            },
            {
              id: "freeway-5",
              label: "國道五號",
              featureIds: ["freeway-5"],
              keywords: ["國道5", "蔣渭水高速公路", "南港—蘇澳・雪山隧道穿越雪山山脈"],
              color: TRANSPORT_COLORS["freeway-5"],
            },
            {
              id: "tra-west",
              label: "臺鐵西部幹線",
              featureIds: ["tra-west"],
              keywords: ["西部幹線", "基隆—枋寮・縱貫線＋山線＋海線＋屏東線"],
              color: TRANSPORT_COLORS["tra-west"],
              dash: TRANSPORT_DASH,
            },
            {
              id: "tra-east",
              label: "臺鐵東部幹線",
              featureIds: ["tra-east"],
              keywords: ["東部幹線", "八堵—臺東・宜蘭線＋北迴線＋臺東線"],
              color: TRANSPORT_COLORS["tra-east"],
              dash: TRANSPORT_DASH,
            },
            {
              id: "tra-south-link",
              label: "臺鐵南迴線",
              featureIds: ["tra-south-link"],
              keywords: ["南迴線", "枋寮—臺東・唯一連接西部與東部的鐵路"],
              color: TRANSPORT_COLORS["tra-south-link"],
              dash: TRANSPORT_DASH,
            },
          ],
        },
        maxActive: 7,
        palette: Object.values(TRANSPORT_COLORS),
        defaultAll: true,
      },
      detail: { type: "geo", collection: "tw-transport" },
      description:
        "高鐵、三條主要國道與臺鐵三大幹線，七條各自一色：綠色是公路、靛色是鐵路、朱紅是高鐵，" +
        "鐵路畫成虛線。這一層要對照的是地形：西部走廊上五條路線幾乎重疊，" +
        "而東部只有一條鐵路沿海岸擠在山與海之間，南迴線是唯一從南端把兩側接起來的鐵路。" +
        "線位取自 OpenStreetMap 的路線關聯，上下行只取單一方向。",
      notes: [
        "⚠️ 鐵路畫成虛線不只是好看：高鐵的朱紅與國道的綠正好橫跨紅綠軸，紅綠色盲" +
          "無法分辨這兩個顏色（這是色彩空間的限制，換任何一組橘綠都一樣）。線型是" +
          "「公路／鐵路」在色盲下唯一分得出來的線索。",
        "⚠️ 這一層的七個顏色是全站唯一不與其他線圖層一起做分離度驗證的一組，" +
          "為的是讓高鐵、國道、臺鐵各自對應到接近官方識別色的色相。代價是同時開啟" +
          "「活動斷層」時，國道一號的深綠與斷層的磚紅在色盲下不易分辨。",
      ],
      sources: ["OpenStreetMap"],
    },
    {
      id: "tw-faults",
      label: "活動斷層",
      group: "天然災害",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-faults.geojson" },
      /**
       * 第一類／第二類**不用兩個顏色**，用**線寬**當第二通道。
       *
       * 那是序位（全新世 vs 更新世晚期），不是兩個平等的類別；而且實測沒有任何一組
       * 「深紅／淺紅」兩階能讓兩階都通過色票驗證——淺的那階對行政區橘的一般視覺
       * ΔE 一定掉到 15 以下（見 thematicColors.ts 的 FAULT_COLOR）。
       *
       * 線寬比一般線圖層粗（2.4／1.2 對預設 1.4）：斷層是這一層唯一的內容，
       * 而且要跟同時可能勾選的河川、山脈稜線分得開。
       */
      /**
       * ⚠️ **沿線標註是這一層點得到的關鍵，不是裝飾。** 斷層只有線、沒有點，最粗的
       * 也才 2.4px——使用者要點的其實是那條線上的名字。加了標註之後
       * `geoHitLayerIds()` 會回傳 [線, 標註] 兩層，點字或點線都開得了卡片。
       *
       * 參數是實測調出來的（1440×663 畫布），不要照抄別層的預設：
       *
       * - **文字依 zoom 換長短名**。全名太長會被放置演算法大量拒絕：實測全島視角
       *   （zoom 7.4）用全名只放得出 **3** 個標註，用去掉「斷層」兩字的 `shortName`
       *   是 **13** 個；zoom 8.5 的南部是 8 → 16。但短名有另一個問題——「彰化」
       *   「新竹」「池上」「玉里」本身都是地名，在底圖上會跟真的地名混淆。所以
       *   **zoom < 10 用短名（先看得到哪裡有斷層），zoom ≥ 10 換回全名**（那時線在
       *   畫面上夠長，全名放得出來，也不會有人把「車籠埔斷層」讀成地名）。
       * - `spacing: 400`（預設 120）：**斷層的幾何是 MultiLineString，一條斷層被上游
       *   切成好幾段**（三義斷層 6 段），用預設值會讓同一個名字沿著同一條斷層連續
       *   冒出好幾次。這跟臺鐵幹線那次是同一個坑。
       * - `maxAngle: 150`（預設 60）：斷層線沿麓山帶蜿蜒，跟臺灣河川同一類，60 度
       *   會讓放置演算法拒絕掉大半。
       * - `size: 10`：比預設小一級，33 條斷層擠在西部麓山帶，字大了互相碰撞。
       */
      render: {
        kind: "line",
        width: ["match", ["get", "classRank"], 1, 2.4, 1.2],
        label: {
          property: ["step", ["zoom"], ["get", "shortName"], 10, ["get", "name"]],
          size: 10,
          spacing: 400,
          maxAngle: 150,
        },
      },
      colorRole: "fault",
      /**
       * ⚠️ `hideLayerDescription`：33 條**現在都有內容檔**了（2026-08 逐條取自官方
       * 詳細說明頁），所以這個旗標今天是 no-op——`FeatureCard` 只在沒有內容檔時才走
       * fallback。掛著是為了規則一致，比照 `tw-protected-areas`／`tw-counties`：
       * 上游哪天新增一條斷層而內容檔還沒寫時，卡片會是「名稱＋類別＋線形＋來源」，
       * 而不是整片跟抽屜逐字相同的圖層說明。
       */
      detail: { type: "geo", collection: "tw-faults", hideLayerDescription: true },
      /**
       * 可點清單依類別分組（第一類 22 條、第二類 11 條）。
       * ⚠️ `groupBy` 依序切、不排序，所以 geojson 的 feature 必須讓同一類連續
       * ——排序在 build-geodata.mjs 的 transform 裡做掉了。
       */
      browse: { groupBy: "faultClass" },
      // 33 條斷層線在全島尺度就看得出「集中在西部麓山帶與花東縱谷」這件事
      minzoom: 6,
      description:
        "經濟部地質調查及礦業管理中心公告的 33 條活動斷層。" +
        "第一類（22 條，線較粗）是全新世、也就是一萬年以來曾經活動過的；" +
        "第二類（11 條，線較細）是更新世晚期、十萬年以來曾經活動過的。" +
        "打開「臺灣地震」一起看，會發現地震並不是隨機散布，而是沿著這些構造線與板塊聚合帶排列。",
      notes: [
        "⚠️ 這是 33 條的版本，官方現行的分布圖是 36 條：多了初鄉、九芎坑、口宵里、" +
          "車瓜林四條，而「三義斷層之分支斷層」已併回三義斷層、不再單列。" +
          "目前能取得向量圖資的是改版前那一版——課本會點名的斷層都在裡面。",
        "⚠️ 斷層線位本身也有數化誤差，不要當成地籍尺度的精確位置。",
        "⚠️ 每一條的詳細說明取自官方各斷層的說明頁（卡片最下面的連結）。" +
          "官方原文用改制前的縣市名（臺中縣豐原市、臺南縣新化鎮…），卡片改寫成現行行政區名。",
      ],
      sources: ["經濟部地質調查及礦業管理中心 臺灣活動斷層分布圖"],
    },
    {
      id: "tw-quakes",
      label: "臺灣地震",
      group: "天然災害",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-quakes.geojson" },
      /**
       * 比照「全球地震帶」：半徑由規模驅動、**不畫白色外框**（1,341 個點會糊成
       * 一片）、半透明讓重疊處自然變深。這一層是密度場不是清單。
       *
       * 半徑上限比全球那層大（3.5→11 對 2.6→7）：這裡只有臺灣一座島，點少得多，
       * 而且規模區間窄（5.0–8.2），不放大就分不出 M5 與 M7。
       */
      render: {
        kind: "circle",
        /**
         * 下限 3.5：這一層點得開卡片，太小的點難點中。上限 11 讓 M5.5 與 M8 在
         * 只有臺灣一座島的視野裡分得出來。
         *
         * ⚠️ **不透明度 0.65 且要畫白框**，跟「全球地震帶」那一層相反。
         * 那一層 2,831 個點鋪滿全球，白框會糊成一片、半透明才看得出密度；這一層
         * 只有 612 筆而且大多疊在**本島**上——NLSC 底圖在那裡有等高線、地形陰影
         * 與大量地名，0.32 的灰點會整個沉進背景裡看不見。白框是把點從忙碌底圖上
         * 拉出來的關鍵，不是裝飾。
         */
        radius: ["interpolate", ["linear"], ["get", "mag"], 5.5, 3.5, 8.2, 11],
        strokeWidth: 0.8,
        opacity: 0.65,
      },
      colorRole: "hazard",
      /**
       * ⚠️ 跟「全球地震帶」不同：**這一層點得開卡片**。那一層 2,831 筆是純密度場，
       * 逐一點選沒有教學意義；這一層是臺灣自己的地震史，「1999 那次的震央在哪、
       * 多深」是學生會問的問題。
       *
       * 但**刻意不宣告 `browse`**：有 browse 才會進搜尋索引，而 1,341 筆「規模 5.2
       * 地震」這種同質標題會把搜尋結果洗掉，還要每個人多付 201 KB（比照全球地震帶
       * 不進索引的既有理由）。
       */
      detail: { type: "quake" },
      minzoom: 6,
      description:
        "USGS 目錄裡 1900 年以來、臺灣周邊規模 5.5 以上的地震，共 612 筆。" +
        "圓點大小是規模（不是震度）。跟「活動斷層」一起看：西部的淺層地震沿著麓山帶的斷層排列，" +
        "而東部外海密集的一片是菲律賓海板塊與歐亞板塊聚合的結果。",
      notes: [
        "⚠️ 1973 年以前的紀錄並不完整——實測每十年只有 8–67 筆，1970 年代之後跳到 140–190。" +
          "那是全球地震目錄的完整度變化，不是地震變多了。" +
          "仍然收到 1900 年，是因為 1920 花蓮（規模 8.2）、1935 新竹－臺中、1951 縱谷這些課本會提到的大地震都在那之前。",
        "⚠️ 中央氣象署的地震目錄對臺灣更完整，但它需要申請 API key，純靜態站沒有地方藏金鑰。",
      ],
      sources: ["USGS"],
    },
    {
      id: "tw-quakes-major",
      label: "重大地震",
      group: "天然災害",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-quakes-major.geojson" },
      /**
       * **同一個 `hazard` 中性色，但畫得「更深」**：不透明度從 0.32 拉到 0.9、
       * 半徑加大、加一圈白框。使用者要的是「把這幾次標出來」，不是另一個類別，
       * 所以刻意不給新色相——那也省下一次色票驗證。
       */
      render: {
        kind: "circle",
        radius: ["interpolate", ["linear"], ["get", "mag"], 5, 5, 8.2, 14],
        strokeWidth: 1.5,
        opacity: 0.9,
      },
      colorRole: "hazard",
      // 跟「臺灣地震」共用同一張卡（同一個 detail 型別、同一份 id）
      detail: { type: "quake" },
      /**
       * 這一層**有**可點清單（母圖層刻意沒有）：92 筆、每筆都有地名與日期，
       * 是一份讀得懂的清單，也讓搜尋找得到「集集」「美濃」「白河」。
       * 依日期由新到舊，學生想找的多半是近年那幾次。
       */
      // primary 用預設的 `name`（那個欄位名是 searchIndex 要求的，見 build-geodata.mjs）
      browse: { zoom: 9 },
      minzoom: 6,
      description:
        "中央氣象署〈災害地震〉表收錄的災害地震，共 150 次。" +
        "點位、震源深度與規模都是氣象署的官方值——課本與新聞講的「規模」就是這裡的芮氏規模，" +
        "跟「臺灣地震」那一層採用的 USGS 值不是同一套。",
      notes: [
        "⚠️ 官方那份表只收到 2022 年 9 月，2023 年以後的 11 次（含 0403 花蓮）是另外補錄的，" +
          "每一筆卡片上都標了資料來源。",
        "⚠️ 也因為兩層來自不同目錄，同一次地震在兩層的震央會差幾公里到二十幾公里——" +
          "那是兩個地震目錄的真實差異，不是畫錯了。",
      ],
      sources: ["交通部中央氣象署", "維基百科", "USGS"],
    },
    {
      id: "tw-typhoons",
      label: "颱風路徑與災損",
      group: "天然災害",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-typhoons.geojson" },
      /**
       * ⚠️ **沿線標註的參數是實測調出來的，不要套預設值。**
       *
       * - `spacing: 900`（預設 120，交通軸線與斷層用 400）：颱風路徑是幾千公里長的
       *   **單一條線**，比站上任何其他線都長好幾倍。實測 1920×873 畫布，同一個名字
       *   最多重複幾次／不重複的颱風數／標註總數：
       *
       *   | spacing | zoom 4.2 | zoom 6 | zoom 8 |
       *   |---|---|---|---|
       *   | 400 | 32 個／14 條／重複 3 | 31／13／5 | 34／13／5 |
       *   | **900** | **19／14／3** | **28／14／3** | **21／13／4** |
       *   | 1400 | 14／14／1 | 4／4／1 | 2／2／1 |
       *
       *   1400 在全域視角是完美的（每條剛好一個），但**放大到臺灣就只剩 2–4 個標註**
       *   ——那正是最需要分辨哪條線是哪個颱風的尺度。900 是唯一在三個尺度都讓 13–14
       *   條全部標得到名字的值。
       * - `maxAngle: 150`（預設 60）：路徑在轉向點會急彎（納莉在琉球外海打轉、
       *   柯羅莎在花蓮外海打轉），60 度會讓放置演算法把整條線拒絕掉。
       * - 文字用 `name`（「莫拉克」），不是「莫拉克（2009）」——`symbol-placement: line`
       *   對字串長度極度敏感（見 CLAUDE.md「沿線標註很脆弱」）。年份在清單與搜尋的
       *   副標裡看得到。
       *
       * 線寬與不透明度都壓得比其他線圖層低（0.9–2.4px／0.55 對預設 1.4／0.9）：
       * 這一層真正要看的是**上面那串依強度上色的定位點**，線只是把它們串起來。
       */
      render: {
        kind: "line",
        width: ["interpolate", ["linear"], ["zoom"], 3, 0.9, 6, 1.6, 9, 2.4],
        opacity: 0.55,
        label: { property: "name", size: 12, spacing: 900, maxAngle: 150 },
      },
      /**
       * 路徑線用 `hazard` 中性色，**不佔分類線色票**。
       *
       * 這是「臺灣地震／重大地震」那條既有判例的延伸：災害家族一律中性色，
       * 由尺寸或級距色去承載「多強」。線／面色票已經是六色、餘裕只剩 ΔE 15.8
       * （見 thematicColors.ts），第七個色相沒有位置；而且路徑線本來就該退到背景，
       * 讓底下的附屬定位點（依強度分級上色）成為讀圖的主角。
       */
      colorRole: "hazard",
      detail: { type: "geo", collection: "tw-typhoons" },
      /**
       * 可點清單依**侵臺路徑分類**分組（氣象署的九類＋特殊）。
       * ⚠️ `groupBy` 依序切、不排序，所以 geojson 的 feature 必須讓同一類連續
       * ——排序在 build-geodata.mjs 的 transform 裡做掉了（分類 → 年份）。
       */
      browse: { groupBy: "category" },
      /**
       * 每 6 小時一筆的中心定位點，跟路徑一起開關（比照五大山脈 → 主峰）。
       *
       * **這才是這一層真正在教的東西**：半徑與顏色都由近中心最大風速驅動，
       * 所以「在洋面上一路增強、掃過中央山脈之後迅速減弱」是看得見的，而不是
       * 只能在卡片上讀一個數字。
       *
       * ⚠️ **定位點跟路徑共用同一個 `properties.id`**（757 個點只有 14 個不重複的
       * id），所以點任何一個定位點開出來的就是那個颱風的卡片，選取時整條路徑連同
       * 它所有的定位點一起加粗——那是 CLAUDE.md「三層共用 id」的同一條規則：
       * 同一個實體就該是同一個 id。也因此 `parentProperty` 退化成 `"id"`：
       * 母子關係已經由 id 本身表達，不需要再存 757 筆 `typhoonId`。
       *
       * ⚠️ 早期版本給每個點唯一 id ＋ `detail: { type: "none" }`，想讓點擊穿透到
       * 底下的線。**實測那條路是壞的**：圓點半徑比線寬大得多，點在圓點的外圈上會
       * 落在線的命中範圍之外，於是**什麼都不會發生**——沒有卡片、沒有錯誤、
       * 畫面毫無反應。
       *
       * ⚠️ **min/maxzoom 不會從母圖層繼承**（縣市政府那次踩過），這裡跟著母圖層一起
       * 從 zoom 3 起——路徑本來就要拉遠才看得全。
       */
      attach: {
        id: "tw-typhoon-centers",
        label: "颱風中心定位點",
        source: { type: "remote", path: "data/geo/tw-typhoon-centers.geojson" },
        render: {
          kind: "circle",
          /**
           * ⚠️ **半徑必須同時吃 zoom 與風速，只吃風速會把臺灣整個蓋住。**
           *
           * 實測踩過：固定「8→58 m/s 對應 2.5→8 px」的話，全域視角（zoom 4.2）下
           * 14 條路徑在臺灣與呂宋島之間收斂成一團不透明的橘色，**底圖上的臺灣完全
           * 看不見**——而這一層的重點正是「這些颱風都往臺灣來」。
           *
           * 現在是巢狀 interpolate：zoom 3 時最大只有 3.2px（強度梯度還讀得出來，
           * 但不糊成一片），zoom 10 回到 9px（單一颱風的逐筆定位看得清楚）。
           */
          radius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, ["interpolate", ["linear"], ["get", "wind"], 8, 1.0, 58, 3.2],
            5, ["interpolate", ["linear"], ["get", "wind"], 8, 1.6, 58, 4.6],
            7, ["interpolate", ["linear"], ["get", "wind"], 8, 2.2, 58, 6.5],
            10, ["interpolate", ["linear"], ["get", "wind"], 8, 2.8, 58, 9],
          ],
          /**
           * 細白框把相鄰的點分開，也讓點從忙碌的底圖上浮出來（比照臺灣地震那一層）。
           * ⚠️ 但 zoom 3–4 時點本身只有 1–3px，白框會比點還粗、把顏色整個吃掉，
           * 所以低縮放直接關掉。
           */
          strokeWidth: ["interpolate", ["linear"], ["zoom"], 3, 0, 6, 0.5, 9, 0.8],
          opacity: 0.95,
          colorRamp: TYPHOON_INTENSITY_RAMP,
          /**
           * **選了某個颱風之後，才在它的定位點旁邊標出臺灣時間。**
           *
           * 這是讀「走向」唯一的辦法：一條線本身沒有方向，而 1986 韋恩在同一張圖上
           * 來回三次，不標時間根本分不出先後。⚠️ `onlyWhenSelected` 不能拿掉——
           * 757 個點同時標會蓋滿整個西北太平洋。
           *
           * 文字依 zoom 分兩段：
           * - **zoom < 7 只標「日標」**（臺灣時間每天 08:00 那一筆，每個颱風 6–21 個），
           *   而且只印日期。全域視角要的是「幾號到哪裡」，時刻是雜訊。
           * - **zoom ≥ 7 每一筆都標日期＋時刻**。那是看颱風怎麼掃過臺灣的尺度，
           *   近年的颱風在警報期間是 1 小時一筆，時刻才是重點。
           *
           * ⚠️ 這條 `step` 的輸入是 `["zoom"]`，所以它必須留在最外層——`addGeoLayer`
           * 會用 `mapZoomStops()` 把「有沒有被選取」的判斷推進每個 stop 的輸出裡，
           * 不要改成在外面再包一層（見 layers/geo.ts 的說明）。
           */
          label: {
            property: [
              "step",
              ["zoom"],
              ["case", ["has", "day"], ["get", "date"], ""],
              7,
              ["concat", ["get", "date"], " ", ["get", "hour"], "時"],
            ],
            size: 10,
            onlyWhenSelected: true,
          },
        },
        colorRole: "hazard",
        // 共用 id，所以開出來的就是母圖層那張颱風卡（見上）
        detail: { type: "geo", collection: "tw-typhoons" },
        parentProperty: "id",
        minzoom: 3,
        description:
          "中央氣象署最佳路徑資料裡每一筆颱風中心定位，圓點的大小與顏色都是當時的近中心最大風速。",
        sources: ["交通部中央氣象署 颱風資料庫"],
      },
      // 路徑跨越整個西北太平洋，拉遠才看得出「從哪裡生成、被什麼導引過來」
      minzoom: 3,
      description:
        "1986 年以來 14 個對臺灣造成重大災害的颱風，路徑取自中央氣象署的官方最佳路徑資料。" +
        "清單依氣象署的「侵臺颱風路徑分類」分組——同樣是侵臺，第 1 類從北部海面擦過、" +
        "第 3 類從中部橫越、特殊路徑則連方向都不固定，登陸地點與致災範圍完全不同。" +
        "點選任一個颱風可看它的登陸地段、行進過程與官方災情統計。",
      notes: [
        "⚠️ 這 14 個是**編者依課綱與災損量級挑選的**，不是官方排名。中央氣象署自 1958 年" +
          "以來共列了 454 個發布過警報的颱風。",
        "⚠️ 災情文字節錄自中央氣象署颱風資料庫的「颱風概況表」，該表自己註明是取自" +
          "**內政部消防署與行政院農業委員會**的資料。各次統計的截止時間不同——近年那幾筆" +
          "官方原文就寫著「截至 8 月 5 日統計」。",
        "⚠️ **1990 年以前的災情只有定性描述**（「損失慘重，有人員傷亡、失蹤」），沒有死亡" +
          "人數與農損金額。那是當年的統計制度，不是資料漏抓；1994 年提姆以後每一筆都有數字。",
        "⚠️ **定位點的時間解析度不一致**：平時 6 小時一筆，2002 年以後海上警報期間 3 小時，" +
          "2019 年以後陸上警報期間 1 小時。近年的颱風路徑點明顯比早年密，那是取樣變密，" +
          "不是路徑比較曲折。早年的颱風也有不少中心氣壓是缺值的。",
        "⚠️ 一個颱風可能**多次侵臺**（1986 韋恩三次、2001 納莉兩次）。地圖上是完整的一條" +
          "路徑，而登陸地段與路徑分類取的是主要那一次。",
      ],
      sources: ["交通部中央氣象署 颱風資料庫", "內政部消防署", "農業部"],
    },
    {
      id: "tw-vegetation-belts",
      label: "垂直植被帶",
      group: "植被生態",
      status: "ready",
      render: { kind: "elevation", bands: VEGETATION_BELTS, opacity: 0.5 },
      /**
       * 六帶做成子項目，所以可以**只顯示單一種植被**——取消其他五個核取方塊，
       * 畫面上就只剩那一帶，一眼看出它在山上分佈到哪裡。
       *
       * ⚠️ 跟其他子項目圖層不同，這六個**沒有 `source`**：它們不是六份資料，而是
       * 同一個 DEM 上的六個高程區段。`expandActive` 因此對 `kind: "elevation"` 走
       * 特例——只產生**一個** instance，把勾選的帶帶在 `activeItems` 上，由
       * `addGeoLayer` 在同一條 color-relief 表達式裡把沒勾的畫成透明。六個各自成層
       * 的話界線會被相鄰兩帶各畫一次而變深，而且要多跑五次 shader。
       */
      items: {
        from: {
          type: "inline",
          list: VEGETATION_BELTS.map((b) => ({
            id: b.id,
            // 海拔範圍寫進 label：圖例與抽屜都直接用它，不必另外做一套 note 排版
            label: `${b.label}（${b.note}）`,
            color: b.color,
          })),
        },
        maxActive: VEGETATION_BELTS.length,
        palette: VEGETATION_BELTS.map((b) => b.color),
        // 勾了圖層就六帶全開，見 types.ts 的說明
        defaultAll: true,
      },
      /**
       * ⚠️ 這一層**畫面上點不到任何東西**（color-relief 沒有圖徵，`geoHitLayerIds()`
       * 對 `kind: "elevation"` 回空陣列），詳情卡唯一的入口是**在抽屜點帶名**或搜尋。
       * 但那不代表可以留 `type: "none"`——那樣點下去只會開出一張**空白面板**
       * （`DetailCard` 回 null 而 `data-detail-open` 仍然是 true），六帶各自是什麼森林
       * 就完全沒有地方講了。
       *
       * 內容檔在 `src/content/geo/tw-vegetation-belts/`，**檔名＝上面 items 的 id**
       * （`VEGETATION_BELTS[].id`）；`handleItemNameClick` 傳的 featureId 就是那個 id。
       * 這一層沒有 geojson，所以 `FeatureCard` 的 fallback 在這裡等於沒有退路：
       * 少一個檔案就是一張只有圖層說明的卡。
       */
      detail: { type: "geo", collection: "tw-vegetation-belts" },
      /**
       * 勾了就自動打開 3D 地形：正射俯視下這一層只是一片色塊，要斜角看才看得出
       * 「顏色隨高度分帶」——那正是它要教的東西。見 types.ts 的 requiresTerrain。
       */
      requiresTerrain: true,
      // 等高線是 zoom 9 才畫，但這一層在全島尺度就有意義（一眼看出中央山脈是
      // 一條由綠轉黃再轉白的脊）。6 大約是整個臺灣填滿畫面。
      minzoom: 6,
      /**
       * ⚠️ 這一層是**依海拔推導的示意分帶，不是實測植群圖**，所以一定要標
       * schematic。帶界原本是依氣溫與林相轉變切的，海拔只是代用值，而官方那組數字
       * 本身也只是概略高度（該頁在榕楠林帶那段舉例說南部可達 700 公尺）。
       * 三處自己加工的地方見 thematicColors.ts 的 VEGETATION_BELTS 註解。
       */
      schematic: true,
      description:
        "依海拔劃分的六個植群帶。顏色由地形高程直接算出來，帶與帶之間畫一條界線" +
        "——那條線就是該高程的等高線，所以它會沿著山勢繞。勾選時會自動打開 3D 地形，" +
        "斜角看才看得出「同一條山脈從山腳到山頂換過四五種森林」。" +
        "取消其他幾帶的勾選，就能只看單一種植被分佈到哪裡；點帶名可以看各帶的代表樹種。",
      notes: [
        "⚠️ 這張圖畫的是「這個高度**原本**會長什麼森林」，不是地表現在真正長什麼——" +
          "西部平原被畫成榕楠林帶，但那裡現在是農田與城市。",
        "⚠️ 高度界線是概略值。植群帶原本是依氣溫與林相轉變劃分的，海拔只是代用值，" +
          "同一個帶在南部會升高、在北部會降低——官方頁面就舉了榕楠林帶的例子：" +
          "以中部為例是 500 公尺以下，南部受北回歸線影響可達 700 公尺一帶。",
        "⚠️ 這六帶是農業部頁面的版本。蘇鴻傑的原始分類是 8 帶——楠櫧林帶與櫟林帶" +
          "各再分成上部與下部，合併成六帶是科普簡化。",
        "⚠️ 第六帶站上寫「高山寒原」（課本用語），官方頁面的名稱是「高山植群帶」。",
      ],
      sources: [
        "農業部農業兒童網 山地植群帶分布",
        "農業部林業及自然保育署",
        "國立臺灣大學生物多樣性研究中心",
      ],
    },
    {
      id: "tw-protected-areas",
      label: "國家公園與保護區",
      group: "植被生態",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-protected-areas.geojson" },
      /**
       * 外框比縣市界粗（1.6 對 1.2）：這一層有 53 個圖徵，其中一半小於 200 公頃，
       * 在教學會用的縮放範圍下面染本身只有幾個像素寬，看得見的其實是外框。
       */
      render: { kind: "fill", fillOpacity: 0.18, outlineWidth: 1.6 },
      colorRole: "conservation",
      /**
       * ⚠️ `hideLayerDescription`：53 處裡有 **43 處沒有內容檔**（十座國家公園
       * 以外的保留區／保護區），它們的卡片走 `FeatureCard` fallback，整片說明
       * 都是跟抽屜那一列逐字相同的圖層說明。退掉之後卡片剩
       * 「名稱／類別・約 N 公頃／資料來源」——逐筆不同的東西。
       * 有內容檔的十座國家公園完全不受影響（fallback 根本不會走到）。
       */
      detail: { type: "geo", collection: "tw-protected-areas", hideLayerDescription: true },
      browse: {},
      /**
       * ⚠️ **不設 maxzoom**（縣市界設 11 是因為相鄰面各自簡化會開出次像素縫隙）。
       * 保護區彼此不相鄰，沒有共用邊界，所以沒有那個問題；而且這一層放大來看
       * 「保護區的界線切在哪」本來就是有意義的操作。簡化容差因此也調細成
       * 0.0003°（≈33 公尺），見 build-geodata.mjs。
       */
      description:
        "九座國家公園、壽山國家自然公園，加上 22 處自然保留區、16 處陸域野生動物保護區與 5 處自然保護區，共 53 處。" +
        "四類的法源與主管機關都不同：國家公園依國家公園法由內政部國家公園署管理，其餘三類分別依文化資產保存法、" +
        "野生動物保育法與森林法相關規定，由農業部林業及自然保育署管理。",
      notes: [
        "⚠️ 面積最大的「野生動物重要棲息環境」未收錄——它與前四類大量重疊，一起畫上去會看不出保護區的位置；" +
          "海域的野生動物保護區已改由海洋委員會主管，也不在這份陸域資料裡。",
        "⚠️ 圖上的面積是由圖形範圍計算，與公告面積可能有小幅出入。",
      ],
      sources: ["內政部國家公園署", "農業部林業及自然保育署"],
    },
    {
      id: "tw-crops",
      label: "主要作物分布",
      group: "農業物產",
      status: "ready",
      /**
       * 半徑＝年種植面積的平方根線性內插，比照水庫的容量。不用嚴格面積正比：
       * 雲林二崙 1.6 萬公頃對上澎湖幾十公頃，正比之下小的那些會小到看不見，
       * 而「哪裡種得多」本來就是靠量級差距讀的，精確數字卡片上有。
       */
      render: {
        kind: "circle",
        radius: [
          "interpolate",
          ["linear"],
          ["sqrt", ["coalesce", ["get", "area_ha"], 0]],
          0,
          3,
          130,
          16,
        ],
        // 300 多個鄉鎮的點會大量重疊，白外框糊成一片，降低不透明度讓疊加處看得出深淺
        opacity: 0.72,
        strokeWidth: 0.8,
      },
      // 三層（鄉鎮市區界／人口/都市體系／主要作物分布）共用同一張詳情卡與同一組
      // featureId（官方 TOWNCODE），見 registry/types.ts 的 township 說明
      detail: { type: "township" },
      items: {
        /**
         * 三種作物各一個檔，比照古蹟：只勾「茶」就只抓 27 KB，不是整包 250 KB。
         *
         * ⚠️ **沒有稻米**，這不是漏掉——農情調查（本層唯一的鄉鎮級來源）**不含
         * 水稻**，實測彰化縣的水稻是 0 筆。水稻另有官方統計但**只到縣市**，跟這
         * 一層的鄉鎮尺度混不起來。詳見 scripts/lib/crops.mjs 的說明。
         */
        from: {
          type: "inline",
          list: [
            {
              id: "fruit",
              label: "果樹",
              source: { type: "remote", path: "data/geo/tw-crops-fruit.geojson" },
              color: CROP_COLORS.fruit,
            },
            {
              id: "vegetable",
              label: "蔬菜",
              source: { type: "remote", path: "data/geo/tw-crops-vegetable.geojson" },
              color: CROP_COLORS.vegetable,
            },
            {
              id: "tea",
              label: "茶",
              source: { type: "remote", path: "data/geo/tw-crops-tea.geojson" },
              color: CROP_COLORS.tea,
            },
          ],
        },
        maxActive: 3,
        palette: Object.values(CROP_COLORS),
        // 鄉鎮全部有名字，而 items 圖層沒有可點清單——搜尋是唯一的檢索入口
        indexFeatures: true,
      },
      browse: { zoom: 11 },
      description:
        "農業部農糧署農情調查的鄉鎮別種植面積，圓點大小是年種植面積。" +
        "對照地形看：蔬菜集中在濁水溪沖積扇（西螺、二崙），茶在山麓丘陵（名間、鹿谷、梅山），" +
        "果樹則從嘉南丘陵一路排到臺中和平的高山溫帶果園。",
      notes: [
        "⚠️ **不含稻米**——農情調查這份鄉鎮級統計不收水稻，官方的稻作統計只到縣市，" +
          "兩種尺度混在一起會讀錯。",
        "⚠️ 面積是**年種植面積**（一塊地一年種兩期就算兩次），不是耕地面積。",
      ],
      sources: ["農業部農糧署"],
    },
  ],
};
