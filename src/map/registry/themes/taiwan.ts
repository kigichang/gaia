// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import {
  MAX_SIMULTANEOUS_SPECIES,
  MONUMENT_LEVEL_COLORS,
  RESERVOIR_FILL_RAMP,
  SPECIES_COLORS,
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
  // 開在玉山、zoom 12：等高線要 zoom ≥ 9 才畫得出來（CONTOUR_MIN_ZOOM），
  // 開在全島尺度會讓進站第一眼看不到本站的招牌功能。
  // TODO(縣市界)：縣市界那類小比例尺面圖層上線後要重新評估這個預設視角，
  //   它們的合理 zoom 範圍跟等高線是相反的。
  camera: { center: [120.957, 23.47], zoom: 12 },
  recommendedBasemap: "nlsc-emap",
  groups: ["行政區", "地形", "水系", "人文", "植被生態", "農業物產"],
  initialSelection: { detail: { type: "place" }, featureId: "yushan" },
  layers: [
    {
      id: "tw-counties",
      label: "縣市界",
      group: "行政區",
      status: "ready",
      source: { type: "remote", path: "data/geo/tw-counties.geojson" },
      render: { kind: "fill", fillOpacity: 0.16, outlineWidth: 1.2 },
      colorRole: "boundary",
      detail: { type: "geo", collection: "tw-counties" },
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
        detail: { type: "geo", collection: "tw-county-halls" },
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
        "點選可看指定年份、類別與官方的歷史沿革。" +
        "⚠️ 臺東縣沒有任何古蹟——當地的文化資產是「歷史建築」，屬於另一個類別。",
      sources: ["文化部文化資產局"],
    },

    // ── 以下是還沒有資料的圖層 ────────────────────────────────────────
    // 先把分類骨架擺出來，資料再逐一回補。UI 會顯示成停用的核取方塊，
    // 但 description 仍然要寫清楚——一個沒有文字的停用選項什麼都沒教到。
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
      detail: { type: "geo", collection: "tw-townships" },
      browse: {},
      /**
       * 理由與縣市界相同：相鄰的面各自簡化會在共用邊界開出次像素縫隙
       * （Douglas–Peucker 不保拓樸），所以要在縫隙變得可解析之前停止繪製。
       * 縣市設 11；鄉鎮的容差比較粗（133 公尺）但本來就是要放大來看的層級，
       * 設 12（在 zoom 12 約 3.8 px）。
       */
      maxzoom: 12,
      description:
        "全臺 368 個鄉鎮市區的實測界線，是縣市底下的下一個行政層級。" +
        "⚠️ 鄉鎮名不唯一——中正區、信義區、中山區、東區等 8 個名稱散在不同縣市，" +
        "清單與搜尋結果要看副標的縣市名才分得出是哪一個。",
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
      label: "主要河川",
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
      detail: { type: "geo", collection: "tw-rivers" },
      browse: {},
      description:
        "24 條中央管河川與 2 條跨省市河川（淡水河、磺溪），水利署官方認定的主要河川。" +
        "濁水溪、高屏溪、淡水河等大河，可以看出中央山脈如何分東西水系。" +
        "河道線位來自 OpenStreetMap（以水利署河川代碼比對），幹流長度與流域面積則是" +
        "水利署的官方數字；少數河川的最上游河段在 OSM 尚未收錄，線會比官方長度短一些。",
      sources: ["OpenStreetMap", "經濟部水利署"],
    },
    {
      id: "tw-basins",
      label: "流域分區",
      group: "水系",
      status: "ready",
      // 跟「主要河川」是同一組官方河川清單（見 scripts/lib/rivers.mjs 的
      // RIVER_FACTS／BASIN_IDS），但幾何來自另一份 SHP（BASIN，面），不是從
      // 河川線推導出來的——集水區範圍需要真正的水文測繪，不是幾何運算。
      source: { type: "remote", path: "data/geo/tw-basins.geojson" },
      render: { kind: "fill" },
      // 面／線共用同一組已驗證色票（水系藍／行政區橘／山脈洋紅），fill 目前只有
      // 縣市界（boundary 橘）用掉一個名額，這裡用 hydrology 藍——跟河川線同色，
      // 是刻意的：形狀（半透明面 vs 線）已經足夠區辨，藍色維持「水系」的視覺家族。
      colorRole: "hydrology",
      detail: { type: "geo", collection: "tw-basins" },
      browse: {},
      description:
        "24 條中央管河川與 2 條跨省市河川的集水區範圍，說明分水嶺與流域的概念——" +
        "山脈稜線兩側的雨水，會分別匯集到不同的流域裡。跟「主要河川」是同一份官方清單，" +
        "但這裡的面是另一份水利署圖資，不是從河川線推算出來的。",
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
        "點選可看水位、進出流量與集水區降雨。" +
        "⚠️ 集集攔河堰、石岡壩、直潭壩是引水與調節設施，不是蓄水設施，蓄水率天生偏低；" +
        "阿公店水庫等水庫在排砂或清淤期間也會刻意維持低水位——低不一定代表缺水。",
      sources: ["經濟部水利署"],
    },
    {
      id: "tw-population",
      label: "人口與都市體系",
      group: "人文",
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "各縣市人口規模與都市層級，看西部走廊的人口集中。",
      sources: ["內政部戶政司"],
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
        width: 2.2,
        label: { property: "shortName", spacing: 400 },
      },
      colorRole: "transport",
      detail: { type: "geo", collection: "tw-transport" },
      browse: {},
      description:
        "高鐵、三條主要國道與臺鐵三大幹線。這一層要對照的是地形：西部走廊上五條路線幾乎重疊，" +
        "而東部只有一條鐵路沿海岸擠在山與海之間，南迴線是唯一從南端把兩側接起來的鐵路。" +
        "線位取自 OpenStreetMap 的路線關聯，上下行只取單一方向。",
      sources: ["OpenStreetMap"],
    },
    {
      id: "tw-vegetation-belts",
      label: "垂直植被帶",
      group: "植被生態",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "由海拔決定的植被垂直分帶，與等高線圖層一起看最清楚。",
      sources: ["農業部林業及自然保育署"],
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
      detail: { type: "geo", collection: "tw-protected-areas" },
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
        "野生動物保育法與森林法相關規定，由農業部林業及自然保育署管理。" +
        "⚠️ 面積最大的「野生動物重要棲息環境」未收錄——它與前四類大量重疊，一起畫上去會看不出保護區的位置；" +
        "海域的野生動物保護區已改由海洋委員會主管，也不在這份陸域資料裡。" +
        "圖上的面積是由圖形範圍計算，與公告面積可能有小幅出入。",
      sources: ["內政部國家公園署", "農業部林業及自然保育署"],
    },
    {
      id: "tw-crops",
      label: "主要作物分布",
      group: "農業物產",
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "稻米、茶、水果等主要作物的產地分布。",
      sources: ["農業部"],
    },
    {
      id: "tw-agri-zones",
      label: "農業分區",
      group: "農業物產",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "依氣候與地形劃分的農業經營型態分區。",
      sources: ["農業部"],
    },
  ],
};
