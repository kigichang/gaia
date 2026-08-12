// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import { MAX_SIMULTANEOUS_SPECIES, SPECIES_COLORS } from "../../thematicColors.ts";
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

    // ── 以下是還沒有資料的圖層 ────────────────────────────────────────
    // 先把分類骨架擺出來，資料再逐一回補。UI 會顯示成停用的核取方塊，
    // 但 description 仍然要寫清楚——一個沒有文字的停用選項什麼都沒教到。
    {
      id: "tw-townships",
      label: "鄉鎮市區界",
      group: "行政區",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "鄉鎮市區層級的界線，看縣市底下更細的行政分區。",
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
      id: "tw-landform-zones",
      label: "平原／盆地／台地分區",
      group: "地形",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "西部平原、台地與盆地的範圍，對照人口與農業分布。",
      sources: ["內政部國土測繪中心"],
    },
    {
      id: "tw-rivers",
      label: "主要河川",
      group: "水系",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      // Natural Earth 10m 的臺灣河川覆蓋太薄，不能拿世界資料集充數，
      // 要走水利署或國土測繪中心的開放資料。
      description: "濁水溪、高屏溪、淡水河等主要河川，看中央山脈如何分東西水系。",
      sources: ["經濟部水利署"],
    },
    {
      id: "tw-basins",
      label: "流域分區",
      group: "水系",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "各主要河川的集水區範圍，說明分水嶺與流域的概念。",
      sources: ["經濟部水利署"],
    },
    {
      id: "tw-reservoirs",
      label: "主要水庫",
      group: "水系",
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "石門、曾文、翡翠等主要水庫的位置與蓄水規模。",
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
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      description: "高鐵、國道與東部幹線，對照地形如何決定交通路線。",
      sources: ["交通部"],
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
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "國家公園、自然保留區與野生動物保護區的範圍。",
      sources: ["農業部林業及自然保育署"],
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
