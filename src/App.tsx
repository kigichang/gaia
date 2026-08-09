import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ComparePage } from "./compare/ComparePage";
import { ThemeMapPage } from "./pages/ThemeMapPage";
import { DEFAULT_THEME_ID, THEMES } from "./map/registry/index";
import { LayerToggles } from "./components/LayerToggles";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./useTheme";
import type { BasemapId } from "./map/basemaps";
import type { OverlayState } from "./map/MapView";

// 底圖／圖層開關是全站共用狀態，放在 App 層級，切換 /explore、/compare 頁面不會重置。
export function App() {
  const [overlays, setOverlays] = useState<OverlayState>({
    contour: true,
    hillshade: true,
    terrain: false,
  });
  const [basemap, setBasemap] = useState<BasemapId>("liberty");
  const { theme, setTheme } = useTheme();

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to={`/theme/${DEFAULT_THEME_ID}`} className="brand">
          <span className="brand-mark">GAIA</span>
          <span className="brand-sub">人文地理互動地圖</span>
        </NavLink>
        <div className="header-controls">
          <LayerToggles
            overlays={overlays}
            onOverlaysChange={setOverlays}
            basemap={basemap}
            onBasemapChange={setBasemap}
          />
          {/* 主題連結由註冊表產生：新增主題不必動這支檔案 */}
          <nav className="app-nav">
            {THEMES.map((t) => (
              <NavLink key={t.id} to={`/theme/${t.id}`}>
                {t.label}
              </NavLink>
            ))}
            <NavLink to="/compare">同緯度比較</NavLink>
          </nav>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
          <Route path="/compare" element={<ComparePage overlays={overlays} basemap={basemap} />} />
          <Route
            path="/theme/:themeId"
            element={<ThemeMapPage overlays={overlays} basemap={basemap} />}
          />
          {/* 舊網址相容：/explore 是重構前的探索頁，外部連結與文件都還指著它 */}
          <Route path="/explore" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
          <Route path="*" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
        </Routes>
      </main>
    </div>
  );
}
