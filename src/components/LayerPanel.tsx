import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { colorOf, itemColorOf, layerItems } from "../map/registry/resolve";
import { MAX_ACTIVE_BY_KIND } from "../map/registry/types";
import type { GeometryKind, LayerDefinition, ThemeDefinition } from "../map/registry/types";
import { usePopover } from "../usePopover";

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
              const atCap =
                !checked &&
                !layer.exemptFromMaxActive &&
                activeCountByKind[kind] >= MAX_ACTIVE_BY_KIND[kind];
              const planned = layer.status === "planned";

              return (
                <div key={layer.id} className="layer-row">
                  <div className="layer-row-head">
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
                    {/* 資料限制收進小視窗，抽屜才捲得動（見 LayerNotes 的說明） */}
                    {layer.notes?.length ? (
                      <LayerNotes label={layer.label} notes={layer.notes} />
                    ) : null}
                  </div>
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
 * 圖層名稱旁邊的 ⚠️ 按鈕：點開一個小視窗，列出這個圖層的資料限制（`layer.notes`）。
 *
 * ## 為什麼要把警語搬離抽屜
 *
 * 這些警語是內容誠信的承諾，不能省略（見 types.ts 的 `notes`），但臺灣主題有 20 幾個
 * 圖層、其中 12 個帶警語，全部展開在核取方塊底下的話，光是捲到「農業物產」那一組就
 * 要滑過好幾個畫面高。收進小視窗之後，說明留在原地、警語一鍵可得。
 *
 * ## 為什麼要 portal 出去
 *
 * 抽屜的 `.layer-drawer-body` 是 `overflow-y: auto`（於是 overflow-x 也計算成 auto），
 * 面板留在原地會被裁掉；而抽屜自己有 `z-index: var(--z-drawer)`，是一個堆疊脈絡——
 * 面板即使寫 `--z-popover` 也只會疊在抽屜那一層裡，被詳情面板（`--z-panel`）蓋住。
 * 窄螢幕的詳情是佔掉 62dvh 的底部抽拉卡，那個蓋法會直接把小視窗吃掉一半。
 *
 * portal 的目標是 **React 的 root container**（`#root`），不是 `document.body`：
 * 事件委派就跟一般節點完全一樣，下面那個 Escape 的 `stopPropagation` 才確定攔得住
 * `ThemeMapPage` 掛在 document 上的那一個（那是全站唯一的 document Escape，它會
 * 關掉抽屜——見那裡的說明）。
 */
function LayerNotes({ label, notes }: { label: string; notes: string[] }) {
  const [open, setOpen] = useState(false);
  const title = `${label}・資料限制`;
  const { triggerProps, panelProps } = usePopover({
    open,
    onOpenChange: setOpen,
    label: title,
    /**
     * 面板 portal 出去之後跟觸發器不在同一個 `rootRef` 子樹裡，`usePopover` 那條
     * 「點外面關閉」（比對 rootRef）會把面板自己也算成外面。改用下面這個監聽，
     * 它同時把觸發器算成自己人——否則按下去會先關再開，變成點了沒反應。
     */
    dismissOnOutsideClick: false,
  });
  const panelRef = panelProps.ref;
  const triggerRef = triggerProps.ref;

  // 比照 usePopover：用 pointerdown 而不是 click，這樣視窗會在 maplibre 開始處理
  // 拖曳之前就關掉。點另一個圖層的 ⚠️ 也走這條路，所以同時只會有一個視窗開著。
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, panelRef, triggerRef]);

  /**
   * 貼著抽屜右緣、對齊按下的那一列。
   *
   * 位置只能用量的：視窗 portal 出去了，抽屜寬度又跟著 `--panel-w` 與媒體查詢走，
   * 沒有純 CSS 的辦法把它接在「那一列的右邊」。
   *
   * - `left` 取**抽屜的右緣**而不是按鈕的右緣，這樣不同長度的圖層名稱不會讓視窗
   *   左右跳動；抽屜找不到時（理論上不會）退回按鈕右緣。
   * - `top` 對齊按鈕那一列，再夾回視窗內——最底下那幾個圖層的按鈕離下緣很近，
   *   不夾的話視窗會有一半在畫面外。
   * - 窄螢幕的抽屜是滿版的，右邊沒有空間，夾回去之後會蓋在抽屜上。那是刻意的：
   *   蓋住總比推出畫面外好，而且它仍然貼著按下的那一列。
   * - 抽屜捲動與視窗縮放都要重算，否則視窗會留在原地、指著一列已經捲走的圖層。
   *   捲動用 capture 監聽，因為捲的是 `.layer-drawer-body`，事件不會冒泡到 window。
   */
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const t = trigger.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const drawer = trigger.closest(".layer-drawer")?.getBoundingClientRect();
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
      setPos({
        left: clamp((drawer?.right ?? t.right) + GAP, GAP, window.innerWidth - p.width - GAP),
        top: clamp(t.top - GAP, GAP, window.innerHeight - p.height - GAP),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, panelRef, triggerRef]);

  return (
    <>
      <button
        {...triggerProps}
        className="layer-notes-btn"
        aria-label={title}
        title={title}
        /**
         * ⚠️ 焦點沒進到面板時的保險。`usePopover` 的 Escape 掛在面板上，靠的是「開啟
         * 時焦點已經在面板裡」；萬一那次 `focus()` 沒生效（面板還在定位、或使用者按
         * 完就把焦點移回按鈕），Escape 會直接冒到 document，被 `ThemeMapPage` 那個
         * 全站唯一的 document Escape 收走——關掉的是**抽屜**，而抽屜一關，這個小視窗
         * 就跟著 `LayerPanel` 一起 unmount。畫面上看起來像「Escape 一次關掉兩層」。
         */
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !open) return;
          e.stopPropagation();
          setOpen(false);
        }}
      >
        <span aria-hidden="true">⚠️</span>
      </button>
      {open &&
        createPortal(
          <div
            {...panelProps}
            className="layer-notes-window"
            /**
             * 第一次算繪還沒量到位置（`pos` 是 null），但 `useLayoutEffect` 會在
             * **paint 之前**補上，所以畫面不會閃到左上角。
             *
             * ⚠️ 這裡刻意**不用 `visibility: hidden`** 去遮那一幀：隱藏的元素
             * `focus()` 不生效，`usePopover` 開啟時那次對焦會靜靜失敗，焦點留在
             * 觸發器上，於是 Escape 冒到 document 去關抽屜（實測過）。
             */
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
          >
            <div className="layer-notes-head">
              <h3 className="layer-notes-title">{title}</h3>
              <button
                type="button"
                className="panel-close"
                onClick={() => setOpen(false)}
                aria-label="關閉資料限制說明"
              >
                關閉
                <CloseIcon />
              </button>
            </div>
            <ul className="layer-notes-list">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>,
          document.getElementById("root") ?? document.body,
        )}
    </>
  );
}

/** 小視窗與抽屜／視窗邊緣的留白（跟 `--fab-gap` 同一個手感） */
const GAP = 10;

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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
        /**
         * ⚠️ **一定要走 `itemColorOf()`，不可以自己算 `palette[index % len]`。**
         *
         * 那支會讓固定色優先（`LayerItem.color`）。抽屜自己算的話，古蹟、作物、垂直
         * 植被帶這些「顏色綁在子項目上」的圖層會**跟地圖與圖例對不起來**：實測先勾
         * 「國定古蹟」時，抽屜畫的是 palette[0]（#aa604e，其實是縣(市)定的顏色），
         * 地圖與圖例畫的是固定色 #7d3827，於是抽屜裡「越深＝級別越高」當場失效。
         *
         * 索引仍然是**勾選順序**，那是 palette 圖層（特有種）分辨物種的唯一線索。
         */
        const color = checked ? itemColorOf(layer, item.id, selectedIds.indexOf(item.id)) : undefined;

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
                /* 色塊形狀要跟該圖層的幾何一致——形狀說謊的色塊比沒有色塊更糟，
                   學生會照著圓點去找一條線（比照 MapLegend.tsx 的同一條規則）。
                   虛線是交通軸線用來區分公路／鐵路的語意通道，也要畫出來。 */
                <span
                  className={`layer-swatch layer-swatch-${layer.render.kind}${
                    item.dash ? " is-dashed" : ""
                  }`}
                  style={
                    item.dash
                      ? {
                          backgroundImage: `linear-gradient(90deg, ${color} 60%, transparent 60%)`,
                        }
                      : { backgroundColor: color }
                  }
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
    // 用固定角色色的圖層不佔名額，判準見 types.ts 的 exemptFromMaxActive
    if (layer.exemptFromMaxActive) continue;
    if (activeLayerIds.has(layer.id)) counts[layer.render.kind] += 1;
  }
  return counts;
}
