import type { ReactNode } from "react";
import type { PopoverBindings } from "../usePopover";

interface LayerDrawerProps {
  open: boolean;
  /** usePopover 的面板繫結，由 ThemeMapPage 傳進來（見下方說明） */
  panelProps: PopoverBindings["panelProps"];
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * 左側圖層抽屜的外框。
 *
 * 只負責遮罩、面板與標題，內容由呼叫端用 children 傳進來，這樣「圖層清單怎麼
 * 組出來」仍然完全由註冊表驅動，抽屜不需要知道任何圖層的事。
 *
 * ## 觸發器為什麼不在這裡
 *
 * ☰ 現在住在左上角的搜尋藥丸裡（`MapSearchBox`），所以 `usePopover` 被上提到
 * `ThemeMapPage`：`triggerProps` 給搜尋框、`panelProps` 給這裡。
 *
 * 觸發器與面板因此不再共用一個 `rootRef` 子樹，但這對抽屜沒有影響——
 * `usePopover` 的 `rootRef` **只**用在「點面板外面關閉」那個 effect 裡，而抽屜
 * 是 `dismissOnOutsideClick: false`（桌機上它是常駐面板，點地圖不該把它收掉；
 * 窄螢幕改成全螢幕覆蓋，靠遮罩關閉），那個 effect 直接 early return。焦點的
 * 進出靠的是 `triggerRef`／`panelRef`，與 DOM 結構無關。
 */
export function LayerDrawer({
  open,
  panelProps,
  onClose,
  title,
  subtitle,
  children,
}: LayerDrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* 遮罩只在窄螢幕顯示（CSS 控制），桌機上抽屜是常駐面板 */}
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />

      <aside {...panelProps} className="layer-drawer">
        <div className="layer-drawer-head">
          <div>
            <h2 className="layer-drawer-title">{title}</h2>
            <p className="theme-subtitle">{subtitle}</p>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="關閉圖層選單">
            <CloseIcon />
          </button>
        </div>
        <div className="layer-drawer-body">{children}</div>
      </aside>
    </>
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
