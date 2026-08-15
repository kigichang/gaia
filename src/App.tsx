import { useEffect, useMemo, useState } from "react";
import { matchPath, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ComparePage } from "./compare/ComparePage";
import { ThemeMapPage } from "./pages/ThemeMapPage";
import { DEFAULT_THEME_ID, getTheme } from "./map/registry/index";
import { useTheme } from "./useTheme";
import { useSoloSearch } from "./useSoloSearch";
import type { ChromeState } from "./chrome";
import type { BasemapId } from "./map/basemaps";
import type { OverlayState } from "./map/MapView";

// 圖層開關（等高線／地形陰影）是全站共用狀態，放在 App 層級，切換主題頁與 /compare 不會重置。
//
// 這裡**不再**渲染任何頁面外框：主題頁是滿版地圖，控制項浮在地圖上（見
// ThemeMapPage 的 .map-shell）；/compare 自己用 SiteHeader 產生頁首。
// App 只負責共用狀態與路由。
export function App() {
  const location = useLocation();
  // 目前所在主題（compare 頁不屬於任何主題，會是 undefined）
  const geoThemeId = matchPath("/theme/:themeId", location.pathname)?.params.themeId;

  const [overlays, setOverlays] = useState<OverlayState>({
    contour: true,
    hillshade: true,
    terrain: false,
  });
  // 底圖預設值依主題決定（見下面的 effect）；每個主題各自記住使用者手動選過的底圖，
  // 同一主題內不會被自動套用的建議底圖覆蓋掉。compare 頁沿用進入前的最後一個值。
  const [basemap, setBasemap] = useState<BasemapId>(
    () => getTheme(geoThemeId ?? DEFAULT_THEME_ID)?.recommendedBasemap ?? "liberty",
  );
  const [themeBasemapOverrides, setThemeBasemapOverrides] = useState<Record<string, BasemapId>>(
    {},
  );

  useEffect(() => {
    if (!geoThemeId) return;
    const override = themeBasemapOverrides[geoThemeId];
    if (override) {
      setBasemap(override);
      return;
    }
    const recommended = getTheme(geoThemeId)?.recommendedBasemap;
    if (recommended) setBasemap(recommended);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoThemeId]);

  const { theme, setTheme } = useTheme();
  const { soloSearch, setSoloSearch } = useSoloSearch();

  const chrome = useMemo<ChromeState>(
    () => ({
      overlays,
      onOverlaysChange: setOverlays,
      basemap,
      onBasemapChange: (next: BasemapId) => {
        setBasemap(next);
        if (geoThemeId) {
          setThemeBasemapOverrides((prev) => ({ ...prev, [geoThemeId]: next }));
        }
      },
      themePref: theme,
      onThemePrefChange: setTheme,
      soloSearch,
      onSoloSearchChange: setSoloSearch,
    }),
    [overlays, basemap, geoThemeId, theme, setTheme, soloSearch, setSoloSearch],
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
      <Route path="/compare" element={<ComparePage chrome={chrome} />} />
      <Route path="/theme/:themeId" element={<ThemeMapPage chrome={chrome} />} />
      {/* 舊網址相容：/explore 是重構前的探索頁，外部連結與文件都還指著它 */}
      <Route path="/explore" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
      <Route path="*" element={<Navigate to={`/theme/${DEFAULT_THEME_ID}`} replace />} />
    </Routes>
  );
}
