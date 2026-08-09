/**
 * 全站資料源設定。
 *
 * 硬性規則：這裡列出的每一個端點都必須「免 API key、支援 CORS、可從瀏覽器直接存取」。
 * 本站部署在 GitHub Pages（純靜態），沒有後端可以代理請求或藏金鑰。
 * 新增資料源前請先用 curl 確認 `Access-Control-Allow-Origin`。
 */

/** AWS Open Data 全球 DEM（terrarium 編碼）。等高線與地形陰影都由此推導。 */
export const TERRAIN_TILES_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/** terrarium 圖磚的最高層級。超過此 zoom 時 maplibre 會自動 overzoom。 */
export const TERRAIN_MAXZOOM = 15;

/** 底圖樣式。世界地理用 OpenFreeMap，台灣專題可切到國土測繪中心。 */
export const BASEMAP_STYLES = {
  /** OpenFreeMap Liberty：免費、無金鑰、無流量限制的 OSM 向量底圖 */
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  /** 備援：OpenFreeMap 無 SLA，載入失敗時切到 Carto Positron */
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

/**
 * 國土測繪中心 WMTS。
 *
 * ⚠️ 路徑順序是 {z}/{y}/{x}——y 在 x 前面，跟大多數 XYZ 服務相反。
 * 寫成 {z}/{x}/{y} 會拿到位置錯亂的圖磚（而且仍然回 200，不會報錯）。
 */
export const NLSC_TILES = {
  /** 通用電子地圖 */
  emap: "https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}",
  /** 正射影像（空照圖） */
  photo: "https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}",
} as const;

export const ATTRIBUTION = {
  terrain:
    '地形資料 <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles</a>',
  nlsc: '<a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noreferrer">內政部國土測繪中心</a>',
} as const;

/** 等高線間距（公尺）：zoom → [次要間距, 主要間距]。 */
export const CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
  9: [200, 1000],
  11: [100, 500],
  13: [50, 200],
  14: [20, 100],
  15: [10, 50],
};

/** 低於此 zoom 不顯示等高線——太小的比例尺畫等高線既沒意義又很耗效能。 */
export const CONTOUR_MIN_ZOOM = 9;
