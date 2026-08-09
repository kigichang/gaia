// .ts 副檔名是必要的：Node 直接載入註冊表時不會自己補副檔名（見 ../types.ts）
import type { ThemeDefinition } from "../types.ts";

/**
 * 世界地理。純資料——限制見 ../types.ts。
 */
export const worldTheme: ThemeDefinition = {
  id: "world",
  label: "世界地理",
  subtitle: "世界重要城市的人文與地理條件，以及大尺度的地形與水系。",
  camera: { center: [30, 20], zoom: 2 },
  recommendedBasemap: "liberty",
  groups: ["城市", "國界與大洲", "地形水系", "人文專題"],
  layers: [
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
      colorRole: "hydrology",
      detail: { type: "geo", collection: "world-rivers" },
      browse: {},
      description: "尼羅河、亞馬遜河、長江等世界主要水系的主流線。",
      sources: ["Natural Earth"],
    },
    {
      id: "world-countries",
      label: "國界",
      group: "國界與大洲",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      description: "各國國界線，用來對照政治疆界與自然地理界線的差異。",
      sources: ["Natural Earth"],
    },
    {
      id: "world-continents",
      label: "大洲分區",
      group: "國界與大洲",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "七大洲的範圍分區。",
      sources: ["Natural Earth"],
    },
    {
      id: "world-mountains",
      label: "世界主要山脈",
      group: "地形水系",
      status: "planned",
      render: { kind: "line" },
      detail: { type: "none" },
      description: "喜馬拉雅、安地斯、洛磯等主要山脈的走向，對照板塊聚合帶。",
      sources: ["Natural Earth"],
    },
    {
      id: "world-population",
      label: "世界人口分布",
      group: "城市",
      status: "planned",
      render: { kind: "circle" },
      detail: { type: "none" },
      description: "主要都會區的人口規模，看世界人口為什麼集中在少數地帶。",
      sources: ["Natural Earth"],
    },
    {
      id: "world-agriculture",
      label: "主要農業帶",
      group: "人文專題",
      status: "planned",
      render: { kind: "fill" },
      detail: { type: "none" },
      description: "小麥帶、稻作區、放牧區等主要農業型態的分布。",
      sources: ["Natural Earth"],
    },
  ],
};
