import { MapPopover } from "./MapPopover";
import { LayerToggles } from "./LayerToggles";
import type { ChromeState } from "../chrome";

/**
 * 左下角的「圖層」磚（仿 Google Map 那塊底圖縮圖），點開是底圖選擇與
 * 等高線／地形陰影／3D 地形的開關。
 *
 * 內容直接重用 `LayerToggles`（`/compare` 的頁首用的是同一支元件），只用 CSS 改成直排。
 * 這件事有一個具體好處：底圖控制仍然是 `.basemap-select` 這個 `<label>` 裡的原生
 * `<select>`，CLAUDE.md 裡那條瀏覽器自動化的選擇器（`.basemap-select select` +
 * `_valueTracker`）不必改寫，只要多一步先點開這個彈出層。
 *
 * 沒有底圖縮圖是刻意的：我們不能引入任何需要金鑰的圖磚服務，自己畫的假縮圖
 * 只會誤導人以為那就是底圖長相。
 */
export function MapLayersPopover({ chrome }: { chrome: ChromeState }) {
  return (
    <MapPopover
      label="底圖與地形圖層"
      placement="bottom-left"
      triggerClassName="map-tile"
      triggerContent={
        <>
          <LayersIcon />
          <span className="map-tile-label">圖層</span>
        </>
      }
      panelClassName="map-layers-panel"
    >
      {() => (
        <LayerToggles
          overlays={chrome.overlays}
          onOverlaysChange={chrome.onOverlaysChange}
          basemap={chrome.basemap}
          onBasemapChange={chrome.onBasemapChange}
        />
      )}
    </MapPopover>
  );
}

/** 疊起來的三張圖層。裝飾性，文字說明在按鈕上與 aria-label。 */
function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </g>
    </svg>
  );
}
