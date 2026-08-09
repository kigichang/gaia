import { BASEMAP_LABELS, type BasemapId } from "../map/basemaps";
import type { OverlayState } from "../map/MapView";

interface LayerTogglesProps {
  overlays: OverlayState;
  onOverlaysChange: (next: OverlayState) => void;
  basemap: BasemapId;
  onBasemapChange: (next: BasemapId) => void;
}

const OVERLAY_LABELS: Array<{ key: keyof OverlayState; label: string; hint: string }> = [
  { key: "contour", label: "等高線（公尺）", hint: "縮放到 zoom 9 以上才會顯示；線上數字為海拔公尺數" },
  { key: "hillshade", label: "地形陰影", hint: "用光影表現坡度起伏" },
  { key: "terrain", label: "3D 地形", hint: "傾斜視角，並可查詢游標處海拔" },
];

export function LayerToggles({
  overlays,
  onOverlaysChange,
  basemap,
  onBasemapChange,
}: LayerTogglesProps) {
  return (
    <div className="layer-toggles">
      <label className="basemap-select">
        <span>底圖</span>
        <select value={basemap} onChange={(e) => onBasemapChange(e.target.value as BasemapId)}>
          {Object.entries(BASEMAP_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="overlay-checks">
        {OVERLAY_LABELS.map(({ key, label, hint }) => (
          <label key={key} title={hint}>
            <input
              type="checkbox"
              checked={overlays[key]}
              onChange={(e) => onOverlaysChange({ ...overlays, [key]: e.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
