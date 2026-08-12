import type { ReactNode } from "react";
import { LayerBrowseList } from "./LayerBrowseList";
import type { LayerDefinition } from "../map/registry/types";
import type { Selection } from "./DetailCard";

/**
 * 勾選縣市界／世界主要河流之類的圖層之後出現的可點清單，長在圖層抽屜裡、
 * 該圖層核取方塊那一列底下（跟特有種的子項目清單同一種手感）。
 *
 * 曾經有第二種擺法（清單放進詳情面板，沒選東西時顯示清單，選了換成詳情 +
 * 「返回清單」）用 `?browse=drawer|panel` 網址參數 A/B 比較過，已經決定拿掉、
 * 只留這一版。
 */
export interface BrowseExtraArgs {
  /** 已篩選過的圖層：status ready、有 browse 設定、已勾選、非 items 型 */
  layers: LayerDefinition[];
  /** 取得某圖層已載入的資料，還沒載入完成回 null */
  dataOf: (layerId: string) => GeoJSON.FeatureCollection | null;
  selected: Selection;
  onSelect: (layer: LayerDefinition, featureId: string) => void;
  /** 點的是附屬圖徵（五大山脈底下的主峰），詳情與強調的規則跟母圖徵不同 */
  onSelectAttached: (layer: LayerDefinition, featureId: string) => void;
}

/** 交給 `LayerPanel` 的 `renderLayerExtra`：在已勾選圖層那一列底下插入可點清單。 */
export function browseLayerExtra({
  layers,
  dataOf,
  selected,
  onSelect,
  onSelectAttached,
}: BrowseExtraArgs): (layer: LayerDefinition) => ReactNode {
  /**
   * 同一個圖層的清單要標出目前選取的那一筆。
   *
   * 附屬圖徵的 detail.type 跟母圖層不同（主峰是 place、山脈是 geo），所以兩種都比對，
   * 選了主峰時那一列子項目才會亮起來。
   */
  const selectedIdFor = (layer: LayerDefinition) => {
    if (!selected) return undefined;
    const attach = layer.attach;
    const matches =
      selected.detail.type === layer.detail.type ||
      selected.detail.type === attach?.detail.type;
    return matches ? selected.featureId : undefined;
  };

  return (layer) => {
    if (!layers.includes(layer)) return null;
    const fc = dataOf(layer.id);
    if (!fc) return null;

    // 附屬圖徵（五大山脈 → 主峰）巢狀排在各自的母圖徵底下。資料還沒到就先不巢狀，
    // 清單本身照常顯示——這跟母圖層資料未到時整個不畫是一致的處理。
    const attach = layer.attach;
    const attachData = attach ? dataOf(attach.id) : null;

    return (
      <LayerBrowseList
        key={layer.id}
        data={fc}
        browse={layer.browse!}
        selectedId={selectedIdFor(layer)}
        onSelect={(featureId) => onSelect(layer, featureId)}
        children={
          attach && attachData
            ? {
                data: attachData,
                browse: attach.browse ?? {},
                parentProperty: attach.parentProperty,
                onSelect: (featureId) => onSelectAttached(layer, featureId),
              }
            : undefined
        }
      />
    );
  };
}
