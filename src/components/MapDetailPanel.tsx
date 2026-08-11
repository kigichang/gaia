import type { ReactNode } from "react";

interface MapDetailPanelProps {
  onClose: () => void;
  /** 只有 `?browse=panel` 模式在用：從詳情退回可點清單 */
  onBack?: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * 點地圖圖徵後從左側滑出的詳情面板。
 *
 * 名稱刻意不叫 `DetailPanel`：`ComparePage` 已經有一個同名的內部元件，而且
 * 佔用了 `.detail-panel` 這個 class。
 *
 * 內容區塊自己捲動（`.map-detail-body`），面板本身高度固定，所以再長的說明
 * 也不會把版面撐出視窗外。
 */
export function MapDetailPanel({ onClose, onBack, title, children }: MapDetailPanelProps) {
  return (
    <aside className="map-detail-panel" aria-label={title ?? "圖徵詳情"}>
      <div className="map-detail-head">
        {onBack ? (
          <button type="button" className="panel-back" onClick={onBack}>
            <BackIcon />
            <span>返回清單</span>
          </button>
        ) : (
          <span className="map-detail-head-title">{title}</span>
        )}
        <button type="button" className="panel-close" onClick={onClose} aria-label="關閉詳情">
          <CloseIcon />
        </button>
      </div>
      <div className="map-detail-body">{children}</div>
    </aside>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M14 5 7 12l7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
