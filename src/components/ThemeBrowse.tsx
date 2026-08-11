import { useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { LayerBrowseList } from "./LayerBrowseList";
import type { LayerDefinition } from "../map/registry/types";
import type { Selection } from "./DetailCard";

/**
 * ⚠️ 這整支檔案是暫時的 A/B 比較裝置。
 *
 * 「勾選縣市界／世界主要河流之後出現的可點清單」有兩種放法還沒決定：
 *
 * - `drawer`：清單長在圖層抽屜裡、該圖層那一列的底下（跟特有種的子項目清單一樣）
 * - `panel`：清單放進左側詳情面板，沒選任何東西時顯示清單，選了之後換成詳情 +「返回清單」
 *
 * 兩版同時實作，用網址參數 `?browse=drawer|panel` 切換，實際操作過再決定留哪一版。
 * `browseSlots()` 裡只有**一個 if/else** 分支，所以兩版在結構上不可能同時出現在畫面上。
 *
 * **決定之後要刪掉輸家：只動這一個檔案。** 拿掉 `mode` 參數與敗方分支，回傳型別
 * 跟著縮小；接著把已經永遠是 undefined 的那個 prop 從 `LayerPanel`（`renderLayerExtra`）
 * 或 `MapDetailPanel`（`onBack`）移除，並刪掉 CLAUDE.md 裡 `?browse=` 的說明。
 * `ThemeMapPage` 本身不含任何 `mode ===` 的比較，不需要改。
 */
export type BrowseMode = "drawer" | "panel";

/** 唯一的模組級預設值。網址參數只是當場覆寫，不會改到這裡。 */
export const DEFAULT_BROWSE_MODE: BrowseMode = "drawer";

export function resolveBrowseMode(search: string): BrowseMode {
  const raw = new URLSearchParams(search).get("browse");
  return raw === "drawer" || raw === "panel" ? raw : DEFAULT_BROWSE_MODE;
}

export function useBrowseMode(): BrowseMode {
  const [params] = useSearchParams();
  const raw = params.get("browse");
  return raw === "drawer" || raw === "panel" ? raw : DEFAULT_BROWSE_MODE;
}

export interface BrowseSlotsArgs {
  mode: BrowseMode;
  /** 已篩選過的圖層：status ready、有 browse 設定、已勾選、非 items 型 */
  layers: LayerDefinition[];
  /** 取得某圖層已載入的資料，還沒載入完成回 null */
  dataOf: (layerId: string) => GeoJSON.FeatureCollection | null;
  selected: Selection;
  onSelect: (layer: LayerDefinition, featureId: string) => void;
  onBackToList: () => void;
}

export interface BrowseSlots {
  /** version A：交給 `LayerPanel` 的 `renderLayerExtra`；panel 模式是 undefined */
  drawerExtra?: (layer: LayerDefinition) => ReactNode;
  /** version B：交給詳情面板當清單內容；drawer 模式是 null */
  panelList: ReactNode | null;
  /** version B：有清單可看時，即使還沒選任何圖徵也要把面板打開 */
  panelOpenWithoutSelection: boolean;
  /** version B：目前在看詳情時的「返回清單」；沒有清單可返回時是 undefined */
  panelBack?: () => void;
}

export function browseSlots({
  mode,
  layers,
  dataOf,
  selected,
  onSelect,
  onBackToList,
}: BrowseSlotsArgs): BrowseSlots {
  /** 同一個圖層的清單要標出目前選取的那一筆 */
  const selectedIdFor = (layer: LayerDefinition) =>
    selected && selected.detail.type === layer.detail.type ? selected.featureId : undefined;

  const listFor = (layer: LayerDefinition) => {
    const fc = dataOf(layer.id);
    if (!fc) return null;
    return (
      <LayerBrowseList
        key={layer.id}
        data={fc}
        browse={layer.browse!}
        selectedId={selectedIdFor(layer)}
        onSelect={(featureId) => onSelect(layer, featureId)}
      />
    );
  };

  if (mode === "drawer") {
    return {
      drawerExtra: (layer) => (layers.includes(layer) ? listFor(layer) : null),
      panelList: null,
      panelOpenWithoutSelection: false,
    };
  }

  const lists = layers.map((layer) => {
    const list = listFor(layer);
    if (!list) return null;
    return (
      <section key={layer.id} className="browse-section">
        <h3 className="browse-section-title">{layer.label}</h3>
        {list}
      </section>
    );
  });
  const hasList = lists.some(Boolean);

  return {
    drawerExtra: undefined,
    // 沒選東西時面板顯示清單；選了東西時由呼叫端改放 DetailCard
    panelList: selected ? null : hasList ? <>{lists}</> : null,
    panelOpenWithoutSelection: hasList,
    panelBack: selected && hasList ? onBackToList : undefined,
  };
}
