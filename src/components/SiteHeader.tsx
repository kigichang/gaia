import { NavLink } from "react-router-dom";
import { DEFAULT_THEME_ID } from "../map/registry/index";
import { LayerToggles } from "./LayerToggles";
import { AppMenu } from "./AppMenu";
import type { ChromeState } from "../chrome";

/**
 * `/compare` 專用的頁首。
 *
 * 三個主題頁改成滿版地圖之後，全站頁首就從 `App` 消失了，但比較頁是「雙地圖 +
 * 緯度滑桿 + 兩組圖表」的傳統版面，沒有地方掛浮動控制，所以它保留一條自己的頁首。
 *
 * ⚠️ `LayerToggles` 必須留在這裡。除了底圖選擇，它的「3D 地形」核取方塊正是
 * `ComparePage` 的 `useElevationProbe`（游標處海拔查詢）唯一的開關，拿掉會變成
 * 一個沒有任何錯誤訊息的功能退化。
 */
export function SiteHeader({ chrome }: { chrome: ChromeState }) {
  return (
    <header className="app-header">
      <NavLink to={`/theme/${DEFAULT_THEME_ID}`} className="brand">
        <span className="brand-mark">GAIA</span>
        <span className="brand-sub">人文地理互動地圖</span>
      </NavLink>
      <div className="header-controls">
        <LayerToggles
          overlays={chrome.overlays}
          onOverlaysChange={chrome.onOverlaysChange}
          basemap={chrome.basemap}
          onBasemapChange={chrome.onBasemapChange}
        />
        <AppMenu
          variant="inline"
          themePref={chrome.themePref}
          onThemePrefChange={chrome.onThemePrefChange}
        />
      </div>
    </header>
  );
}
