import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ComparePage } from "./compare/ComparePage";
import { ExplorePage } from "./pages/ExplorePage";
import { LayerToggles } from "./components/LayerToggles";
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

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/explore" className="brand">
          <span className="brand-mark">GAIA</span>
          <span className="brand-sub">地理課互動地圖</span>
        </NavLink>
        <div className="header-controls">
          <LayerToggles
            overlays={overlays}
            onOverlaysChange={setOverlays}
            basemap={basemap}
            onBasemapChange={setBasemap}
          />
          <nav className="app-nav">
            <NavLink to="/explore">地形探索</NavLink>
            <NavLink to="/compare">同緯度比較</NavLink>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/explore" replace />} />
          <Route path="/compare" element={<ComparePage overlays={overlays} basemap={basemap} />} />
          <Route path="/explore" element={<ExplorePage overlays={overlays} basemap={basemap} />} />
          <Route path="*" element={<Navigate to="/explore" replace />} />
        </Routes>
      </main>
    </div>
  );
}
