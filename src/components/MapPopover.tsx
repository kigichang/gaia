import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { usePopover } from "../usePopover";

interface MapPopoverProps {
  /** 觸發器的 aria-label 與 title，也是面板的 aria-label */
  label: string;
  /** 決定面板從哪一角展開（只影響 CSS class） */
  placement: "top-right" | "bottom-left";
  triggerClassName: string;
  /**
   * 加在根節點上的 class。⚠️ 版面上的必要條件，不是裝飾：根節點才是 flex 子元素，
   * 所以「不要被壓縮」與「窄螢幕整個收起來」這種規則只能掛在它身上（贊助按鈕）。
   */
  rootClassName?: string;
  triggerContent: ReactNode;
  panelClassName?: string;
  /** 用 render prop 拿到 close，讓面板裡的導覽連結按下去可以順手收起來 */
  children: (close: () => void) => ReactNode;
}

/**
 * 浮在地圖上的泡泡彈出層（右上角 ⋮⋮⋮ 選單與左下角「圖層」磚共用）。
 *
 * 開關狀態放在自己身上——這兩個彈出層沒有任何人需要從外面控制它們。
 * 圖層抽屜不走這裡，因為它的開關要被記進 localStorage，狀態必須提到頁面層級。
 */
export function MapPopover({
  label,
  placement,
  triggerClassName,
  rootClassName,
  triggerContent,
  panelClassName,
  children,
}: MapPopoverProps) {
  const [open, setOpen] = useState(false);
  const { rootRef, triggerProps, panelProps } = usePopover({ open, onOpenChange: setOpen, label });
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={"map-popover" + (rootClassName ? ` ${rootClassName}` : "")} ref={rootRef}>
      <button {...triggerProps} className={triggerClassName} aria-label={label} title={label}>
        {triggerContent}
      </button>
      {open && (
        <div
          {...panelProps}
          className={
            `map-popover-panel is-${placement}` + (panelClassName ? ` ${panelClassName}` : "")
          }
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
