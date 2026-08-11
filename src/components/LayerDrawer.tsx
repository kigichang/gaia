import { useCallback } from "react";
import type { ReactNode } from "react";
import { usePopover } from "../usePopover";

interface LayerDrawerProps {
  open: boolean;
  /** 使用者主動切換（會被 useDrawerOpen 寫進 localStorage） */
  onOpenChange: (open: boolean) => void;
  /** 主題名稱，同時也是 ☰ 藥丸上的文字 */
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * 左上角 ☰ 開啟的圖層抽屜。
 *
 * 只負責外框（觸發器、遮罩、面板與標題），內容由呼叫端用 children 傳進來，
 * 這樣「圖層清單怎麼組出來」仍然完全由註冊表驅動，抽屜不需要知道任何圖層的事。
 *
 * ☰ 做成帶主題名的藥丸（`☰ 臺灣地理`）：全站頁首被拿掉之後，這是畫面上唯一
 * 隨時看得到「現在在哪個主題」的地方，而按鈕本身也因此自我說明。
 *
 * `dismissOnOutsideClick` 是 false：桌機上它是常駐面板（比照 Google 的側欄），
 * 點地圖不該把它收掉；窄螢幕改成全螢幕覆蓋，靠遮罩關閉。
 */
export function LayerDrawer({ open, onOpenChange, title, subtitle, children }: LayerDrawerProps) {
  const { rootRef, triggerProps, panelProps } = usePopover({
    open,
    onOpenChange,
    label: `圖層選單：${title}`,
    dismissOnOutsideClick: false,
  });
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <div ref={rootRef}>
      <div className="map-top-left">
        <button
          {...triggerProps}
          className="map-fab map-fab-drawer"
          aria-label={`圖層選單：${title}`}
        >
          <MenuIcon />
          <span className="map-fab-label">{title}</span>
        </button>
      </div>

      {/* 遮罩只在窄螢幕顯示（CSS 控制），桌機上抽屜是常駐面板 */}
      {open && <div className="drawer-scrim" onClick={close} aria-hidden="true" />}

      {open && (
        <aside {...panelProps} className="layer-drawer">
          <div className="layer-drawer-head">
            <div>
              <h2 className="layer-drawer-title">{title}</h2>
              <p className="theme-subtitle">{subtitle}</p>
            </div>
            <button type="button" className="panel-close" onClick={close} aria-label="關閉圖層選單">
              <CloseIcon />
            </button>
          </div>
          <div className="layer-drawer-body">{children}</div>
        </aside>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </g>
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
