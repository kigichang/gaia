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
      // 相鄰面各自簡化會在共用邊界留下次像素縫隙（見 scripts/lib/simplify.mjs）。
      // maxzoom 讓它在縫隙變得可解析之前就停止繪製——這同時也是正確的製圖判斷：
      // 縣市界的面染是小比例尺的教學裝置，不是 zoom 14 的圖層。
      maxzoom: 11,
      description:
        "直轄市與縣市界線。資料來自 Natural Earth，只有 21 個縣市，缺連江縣（馬祖）。",
      sources: ["Natural Earth"],
    },
    {
      id: "places",
      label: "地形景點",
      group: "地形",
      status: "ready",
      // places 內容同時包含臺灣與世界地點，這裡一定要切分，
      // 否則臺灣地理主題會冒出開羅、塔曼拉塞特。
      source: { type: "bundled", content: "places-taiwan" },
      // radius 不填 → 預設 6，與重構前的 places-points 完全一致
      render: { kind: "circle" },
      colorRole: "place",
      detail: { type: "place" },
      browse: { zoom: 11 },
      defaultOn: true,
      description: "課本提到的臺灣代表性地形與都市，點選看地形、氣候與人文說明。",
      sources: ["交通部中央氣象署", "內政部國土測繪中心"],
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
  ],
};
