import { NavLink } from "react-router-dom";
import { DEFAULT_THEME_ID, THEMES } from "../map/registry/index";
import { ThemeToggle } from "./ThemeToggle";
import { SoloSearchToggle } from "./SoloSearchToggle";
import { MapPopover } from "./MapPopover";
import type { ThemePreference } from "../useTheme";
import type { SoloSearchMode } from "../useSoloSearch";

interface AppMenuProps {
  themePref: ThemePreference;
  onThemePrefChange: (next: ThemePreference) => void;
  /**
   * 搜尋結果的呈現方式。**選填**，而且只有 `floating` 那一支會用到：
   * `inline` 是 `/compare` 的頁首，那一頁沒有搜尋框，擺一個影響不到任何東西的
   * 開關只會誤導。
   */
  soloSearch?: SoloSearchMode;
  onSoloSearchChange?: (next: SoloSearchMode) => void;
  /**
   * `floating`（預設）：主題頁右上角的 ⋮⋮⋮ 彈出層。
   * `inline`：`/compare` 的頁首，導覽與主題切換直接攤開——那裡有橫向空間，
   * 沒理由多要一次點擊。
   */
  variant?: "floating" | "inline";
}

/**
 * 主題導覽（臺灣地理／世界地理／全球地理形貌／同緯度比較）加上淺色／深色／自動切換。
 *
 * 主題頁與 `/compare` 共用同一份內容，只有外框不同，所以導覽項目永遠不會兩邊不一致。
 * 主題連結由註冊表產生：新增一個主題不必動這支檔案。
 */
export function AppMenu({
  themePref,
  onThemePrefChange,
  soloSearch,
  onSoloSearchChange,
  variant = "floating",
}: AppMenuProps) {
  // 一律用 NavLink，不能退回原生 <a href>：整頁重新載入會拆掉並重建 maplibre，
  // 丟掉整份圖磚快取，換頁變成好幾秒的白畫面。
  const nav = (onNavigate?: () => void) => (
    <nav className="app-nav">
      {THEMES.map((t) => (
        <NavLink key={t.id} to={`/theme/${t.id}`} onClick={onNavigate}>
          {t.label}
        </NavLink>
      ))}
      <NavLink to="/compare" onClick={onNavigate}>
        同緯度比較
      </NavLink>
    </nav>
  );

  if (variant === "inline") {
    return (
      <>
        {nav()}
        <ThemeToggle theme={themePref} onChange={onThemePrefChange} />
      </>
    );
  }

  return (
    <MapPopover
      label="主題與外觀"
      placement="top-right"
      triggerClassName="map-fab"
      triggerContent={<AppsIcon />}
      panelClassName="map-menu"
    >
      {(close) => (
        <>
          <NavLink to={`/theme/${DEFAULT_THEME_ID}`} className="map-menu-brand" onClick={close}>
            <span className="brand-mark">GAIA</span>
            <span className="brand-sub">人文地理互動地圖</span>
          </NavLink>
          <hr className="map-menu-sep" />
          {nav(close)}
          <hr className="map-menu-sep" />
          <ThemeToggle theme={themePref} onChange={onThemePrefChange} />
          {soloSearch && onSoloSearchChange && (
            <>
              <hr className="map-menu-sep" />
              <SoloSearchToggle mode={soloSearch} onChange={onSoloSearchChange} />
            </>
          )}
        </>
      )}
    </MapPopover>
  );
}

/** Google 那顆九宮格「應用程式」圖示。裝飾性，文字說明在按鈕的 aria-label。 */
function AppsIcon() {
  const dots = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => [col * 7 + 5, row * 7 + 5]));
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="currentColor" />
      ))}
    </svg>
  );
}
