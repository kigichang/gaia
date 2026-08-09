import type { Species } from "../lib/schema";
import { MAX_SIMULTANEOUS_SPECIES } from "../map/thematicColors";

interface ThematicLayerPanelProps {
  showPlaces: boolean;
  onTogglePlaces: (visible: boolean) => void;
  showIndigenous: boolean;
  onToggleIndigenous: (visible: boolean) => void;
  showSpeciesSection: boolean;
  onToggleSpeciesSection: (visible: boolean) => void;
  speciesList: Species[];
  selectedSpeciesIds: string[];
  onToggleSpecies: (id: string) => void;
  /** 點物種名稱（而非核取方塊）：飛到該物種觀測範圍 + 開啟詳情卡 */
  onSpeciesNameClick: (id: string) => void;
  /** 各物種的觀測點數，尚未載入完成時該筆是 undefined */
  occurrenceCounts: Record<string, number | undefined>;
}

/**
 * Explore 頁的主題圖層核取方塊：地形景點／原住民族分佈／特有種生態分佈，
 * 三個可複選疊加。特有種勾選後展開物種複選清單。
 */
export function ThematicLayerPanel({
  showPlaces,
  onTogglePlaces,
  showIndigenous,
  onToggleIndigenous,
  showSpeciesSection,
  onToggleSpeciesSection,
  speciesList,
  selectedSpeciesIds,
  onToggleSpecies,
  onSpeciesNameClick,
  occurrenceCounts,
}: ThematicLayerPanelProps) {
  const reachedLimit = selectedSpeciesIds.length >= MAX_SIMULTANEOUS_SPECIES;

  return (
    <div className="thematic-panel">
      <h3>主題圖層</h3>
      <label className="thematic-toggle">
        <input type="checkbox" checked={showPlaces} onChange={(e) => onTogglePlaces(e.target.checked)} />
        <span>地形景點</span>
      </label>
      <label className="thematic-toggle">
        <input
          type="checkbox"
          checked={showIndigenous}
          onChange={(e) => onToggleIndigenous(e.target.checked)}
        />
        <span>原住民族分佈</span>
      </label>
      <label className="thematic-toggle">
        <input
          type="checkbox"
          checked={showSpeciesSection}
          onChange={(e) => onToggleSpeciesSection(e.target.checked)}
        />
        <span>特有種生態分佈</span>
      </label>

      {showSpeciesSection && (
        <div className="species-select-list">
          <p className="species-select-hint">
            最多可同時比較 {MAX_SIMULTANEOUS_SPECIES} 個物種（顏色要能一眼分辨）
          </p>
          {speciesList.map((sp) => {
            const checked = selectedSpeciesIds.includes(sp.id);
            const count = occurrenceCounts[sp.id];
            return (
              <div key={sp.id} className="species-select-row">
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && reachedLimit}
                    onChange={() => onToggleSpecies(sp.id)}
                  />
                  <button
                    type="button"
                    className="species-name-btn"
                    onClick={() => onSpeciesNameClick(sp.id)}
                  >
                    {sp.name.zh}
                  </button>
                </label>
                <span className="species-count">{count != null ? `${count} 筆` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
