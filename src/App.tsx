import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ComparePage } from "./compare/ComparePage";
import { ExplorePage } from "./pages/ExplorePage";

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/compare" className="brand">
          <span className="brand-mark">GAIA</span>
          <span className="brand-sub">地理課互動地圖</span>
        </NavLink>
        <nav className="app-nav">
          <NavLink to="/compare">同緯度比較</NavLink>
          <NavLink to="/explore">地形探索</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/compare" replace />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="*" element={<Navigate to="/compare" replace />} />
        </Routes>
      </main>
    </div>
  );
}
