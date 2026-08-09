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
      id: "quakes",
      label: "全球地震帶",
      group: "地體構造",
      status: "ready",
      source: { type: "remote", path: "data/geo/quakes.geojson" },
      render: {
        kind: "circle",
        // 半徑由震級驅動；不畫白色外框，否則 2800 個點會糊成一片
        radius: ["interpolate", ["linear"], ["get", "mag"], 6.5, 1.5, 9, 6],
        strokeWidth: 0,
        opacity: 0.35,
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
