import type { BasemapId } from "./map/basemaps";
import type { OverlayState } from "./map/MapView";
import type { ThemePreference } from "./useTheme";

/**
 * 全站共用的外框狀態（底圖、疊圖開關、淺／深色偏好）。
 *
 * 這些狀態住在 `App`，但實際的控制項散在兩種完全不同的外框裡：主題頁是浮在
 * 地圖上的按鈕，`/compare` 是自己的一條頁首。與其讓兩個頁面各收六個 prop，
 * 統一收一包——加一個新的共用控制項時只要動這個型別。
 *
 * 只有型別，沒有實作，所以不會產生任何執行期相依。
 */
export interface ChromeState {
  overlays: OverlayState;
  onOverlaysChange: (next: OverlayState) => void;
  basemap: BasemapId;
  onBasemapChange: (next: BasemapId) => void;
  themePref: ThemePreference;
  onThemePrefChange: (next: ThemePreference) => void;
}
