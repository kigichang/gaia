import { layerItems } from "../map/registry/resolve";
import { colorOf } from "../map/registry/resolve";
import { MAX_ACTIVE_BY_KIND } from "../map/registry/types";
import type { GeometryKind, LayerDefinition, ThemeDefinition } from "../map/registry/types";

interface LayerPanelProps {
  theme: ThemeDefinition;
  activeLayerIds: Set<string>;
  onToggleLayer: (layerId: string) => void;
  /** 圖層 id → 勾選的子項目 id（順序決定色票指派） */
  activeItemIds: Record<string, string[]>;
  onToggleItem: (layerId: string, itemId: string) => void;
  /** 點子項目名稱（而不是核取方塊）：飛到它的範圍並開詳情卡 */
  onItemNameClick: (layerId: string, itemId: string) => void;
  /** 每個子項目已載入的圖徵數，未載入完成是 undefined */
  itemCounts: Record<string, number | undefined>;
  /**
   * 在已勾選圖層那一列的最後插入額外內容，回 null 就不插。
   * 可點圖徵清單走這裡（見 `ThemeBrowse.tsx` 的 `browseLayerExtra`）。
   */
  renderLayerExtra?: (layer: LayerDefinition) => React.ReactNode;
}

/**
 * 主題圖層面板：依註冊表的分組列出核取方塊。
 *
 * 取代舊的 ThematicLayerPanel（三個寫死的核取方塊）。`planned` 的圖層一樣要列出來
 * 並顯示說明——一個停用又沒有文字的核取方塊什麼都沒教到，那就失去列出它的意義。
 */
export function LayerPanel({
  theme,
  activeLayerIds,
  onToggleLayer,
  activeItemIds,
  onToggleItem,
  onItemNameClick,
  itemCounts,
  renderLayerExtra,
}: LayerPanelProps) {
  // 每種幾何同時開啟的數量上限，用來 disable 其餘核取方塊。
  // 這是「三組獨立色票」策略的執行面，見 thematicColors.ts。
  const activeCountByKind = countActiveByKind(theme, activeLayerIds);

  return (
    <div className="thematic-panel">
      <h3>主題圖層</h3>
      {theme.groups.map((group) => {
        const layers = theme.layers.filter((l) => l.group === group);
        if (layers.length === 0) return null;

        return (
          <section key={group} className="layer-group">
            <h4 className="layer-group-title">{group}</h4>
            {layers.map((layer) => {
              const checked = activeLayerIds.has(layer.id);
              const kind = layer.render.kind;
              const atCap = !checked && activeCountByKind[kind] >= MAX_ACTIVE_BY_KIND[kind];
              const planned = layer.status === "planned";

              return (
                <div key={layer.id} className="layer-row">
                  <label className={planned ? "thematic-toggle is-planned" : "thematic-toggle"}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={planned || atCap}
                      onChange={() => onToggleLayer(layer.id)}
                    />
                    <Swatch layer={layer} />
                    <span>{layer.label}</span>
                    {planned && <span className="layer-planned">資料整理中</span>}
                  </label>
                  <p className="layer-description">
                    {layer.description}
                    {layer.schematic && (
                      <span className="layer-schematic">（教學示意圖，非精確界線）</span>
                    )}
                  </p>
                  {atCap && (
                    <p className="layer-cap-hint">
                      同時最多開啟 {MAX_ACTIVE_BY_KIND[kind]} 個{KIND_LABELS[kind]}圖層
                    </p>
                  )}

                  {checked && layer.items && (
                    <ItemList
                      layer={layer}
                      selectedIds={activeItemIds[layer.id] ?? []}
                      onToggle={(itemId) => onToggleItem(layer.id, itemId)}
                      onNameClick={(itemId) => onItemNameClick(layer.id, itemId)}
                      counts={itemCounts}
                    />
                  )}

                  {checked && renderLayerExtra && (
                    <div className="layer-row-extra">{renderLayerExtra(layer)}</div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {theme.recommendedBasemap && (
        <p className="layer-basemap-hint">
          建議底圖：{BASEMAP_HINTS[theme.recommendedBasemap]}
        </p>
      )}
    </div>
  );
}

/**
 * 子項目複選清單（目前只有特有種用到）。
 * 沿用舊 ThematicLayerPanel 的互動：核取方塊控制圖層，名稱是另一個按鈕，
 * 點名稱會飛到該項目的範圍並開詳情卡。
 */
function ItemList({
  layer,
  selectedIds,
  onToggle,
  onNameClick,
  counts,
}: {
  layer: LayerDefinition;
  selectedIds: string[];
  onToggle: (itemId: string) => void;
  onNameClick: (itemId: string) => void;
  counts: Record<string, number | undefined>;
}) {
  const items = layerItems(layer);
  const max = layer.items!.maxActive;
  const reachedLimit = selectedIds.length >= max;

  return (
    <div className="species-select-list">
      <p className="species-select-hint">最多可同時比較 {max} 項（顏色要能一眼分辨）</p>
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        const count = counts[item.id];
        const color = checked
          ? layer.items!.palette[selectedIds.indexOf(item.id) % layer.items!.palette.length]
          : undefined;

        return (
          <div key={item.id} className="species-select-row">
            <label>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && reachedLimit}
                onChange={() => onToggle(item.id)}
              />
              {color && (
                <span
                  className="layer-swatch layer-swatch-circle"
                  style={{ backgroundColor: color }}
                />
              )}
              <button type="button" className="species-name-btn" onClick={() => onNameClick(item.id)}>
                {item.label}
              </button>
            </label>
            <span className="species-count">{count != null ? `${count} 筆` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 色塊的形狀要跟該圖層的幾何一致（點／短線／半透明方塊）。
 * 一個形狀說謊的圖例比沒有圖例更糟——學生會以為地圖上要找的是圓點。
 */
function Swatch({ layer }: { layer: LayerDefinition }) {
  // planned 圖層還沒有指派顏色（也還沒經過色票驗證），不畫色塊
  if (layer.status !== "ready" || !layer.colorRole) return null;
  const color = colorOf(layer.colorRole);
  const kind = layer.render.kind;
  return (
    <span
      className={`layer-swatch layer-swatch-${kind}`}
      style={kind === "fill" ? { backgroundColor: color, borderColor: color } : { backgroundColor: color }}
    />
  );
}

const KIND_LABELS: Record<GeometryKind, string> = {
  circle: "點",
  line: "線",
  fill: "面",
  // 高程設色不是一種幾何，是蓋滿全島的連續場
  elevation: "高程",
};

const BASEMAP_HINTS: Record<string, string> = {
  liberty: "世界地圖",
  "nlsc-emap": "臺灣通用電子地圖",
  "nlsc-photo": "臺灣正射影像",
};

function countActiveByKind(theme: ThemeDefinition, activeLayerIds: Set<string>) {
  const counts: Record<GeometryKind, number> = { circle: 0, line: 0, fill: 0, elevation: 0 };
  for (const layer of theme.layers) {
    if (activeLayerIds.has(layer.id)) counts[layer.render.kind] += 1;
  }
  return counts;
}
