import type { StyleSpecification } from "maplibre-gl";
import { ATTRIBUTION, BASEMAP_STYLES, NLSC_TILES } from "../config";

export type BasemapId = "liberty" | "nlsc-emap" | "nlsc-photo";

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  liberty: "世界地圖",
  "nlsc-emap": "臺灣通用電子地圖",
  "nlsc-photo": "臺灣正射影像",
};

/** 由 NLSC WMTS 組出一份最小的 raster 樣式。 */
function nlscStyle(tiles: string): StyleSpecification {
  return {
    version: 8,
    // 等高線標註是 symbol 圖層，需要 glyphs 才畫得出來；借用 OpenFreeMap 的字型端點
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      nlsc: {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
        maxzoom: 20,
        attribution: ATTRIBUTION.nlsc,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e8e4dc" } },
      { id: "nlsc", type: "raster", source: "nlsc" },
    ],
  };
}

/**
 * 取得底圖樣式。
 *
 * OpenFreeMap 是免費且無 SLA 的服務，這裡先 fetch 樣式 JSON 確認可用，
 * 失敗才回退到 Carto Positron，避免整張地圖開天窗。
 */
export async function loadBasemapStyle(id: BasemapId): Promise<string | StyleSpecification> {
  if (id === "nlsc-emap") return nlscStyle(NLSC_TILES.emap);
  if (id === "nlsc-photo") return nlscStyle(NLSC_TILES.photo);

  try {
    const res = await fetch(BASEMAP_STYLES.liberty);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as StyleSpecification;
  } catch (err) {
    console.warn("[gaia] OpenFreeMap 無法載入，改用 Carto Positron 備援底圖", err);
    return BASEMAP_STYLES.positron;
  }
}

/** 找出樣式中第一個 symbol 圖層，用來當作 hillshade 的 beforeId（讓地名壓在陰影之上）。 */
export function firstSymbolLayerId(style: StyleSpecification | undefined): string | undefined {
  return style?.layers?.find((l) => l.type === "symbol")?.id;
}
