import { useCallback, useEffect, useId, useRef } from "react";
import type { KeyboardEventHandler, RefObject } from "react";

/**
 * 浮在地圖上的彈出層／抽屜共用的開關機制。
 *
 * ## 為什麼不用 <dialog>，也不用原生 Popover API
 *
 * - `dialog.showModal()` 會鎖住焦點並加上 backdrop，等於在選單開著的時候把地圖
 *   的拖曳、縮放全部擋掉。這些東西是疊在一張**還能繼續操作**的地圖上的浮動控制，
 *   不是 modal。
 * - `dialog.show()` 與 `popover=""` 都會把元素升到 top layer，於是它**跳出我們的
 *   z-index 階梯，也跳出 `--left-panel-w` 所在的定位脈絡**——而整個 `.map-shell`
 *   的設計重點就是這幾層彼此的相對順序與互相閃避。
 * - CSS anchor positioning 目前在學校電腦常見的瀏覽器組合上還不可靠，這個專案也
 *   刻意不引入任何定位函式庫。
 *
 * 所以就是一般的絕對定位 div，只把「怎麼關」與無障礙屬性集中在這裡，避免三個
 * 彈出層各寫一份不一樣的實作。
 */
export interface PopoverOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 面板的 aria-label */
  label: string;
  /**
   * 點面板外面是否要關閉。
   * ⋮⋮⋮ 選單與「圖層」磚是 true；圖層抽屜是 false——它在桌機上是常駐面板，
   * 窄螢幕才靠遮罩關閉。
   */
  dismissOnOutsideClick?: boolean;
  /**
   * 按 Escape 是否要由這裡關掉。
   * ⋮⋮⋮ 選單與「圖層」磚是 true；圖層抽屜是 false——它跟詳情面板可以同時開著，
   * 關的順序要由 `ThemeMapPage` 統一仲裁（詳情優先），見那裡的說明。
   */
  dismissOnEscape?: boolean;
}

export interface PopoverBindings {
  /** 包住觸發器與面板的容器，用來判斷「點到的是不是自己人」 */
  rootRef: RefObject<HTMLDivElement | null>;
  triggerProps: {
    ref: RefObject<HTMLButtonElement | null>;
    type: "button";
    "aria-haspopup": "dialog";
    "aria-expanded": boolean;
    "aria-controls": string;
    onClick: () => void;
  };
  panelProps: {
    ref: RefObject<HTMLDivElement | null>;
    id: string;
    role: "dialog";
    "aria-label": string;
    tabIndex: -1;
    onKeyDown?: KeyboardEventHandler;
  };
}

export function usePopover({
  open,
  onOpenChange,
  label,
  dismissOnOutsideClick = true,
  dismissOnEscape = true,
}: PopoverOptions): PopoverBindings {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 只有「這一輪真的從關變開」才把焦點搬進面板。
  // 少了這個旗標，抽屜從 localStorage 還原成開啟時會在首次 render 就搶走文件焦點。
  const didOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      if (didOpenRef.current) panelRef.current?.focus();
      return;
    }
    if (didOpenRef.current) triggerRef.current?.focus();
  }, [open]);

  // 點面板外面關閉。用 pointerdown 而不是 click，這樣彈出層會在 maplibre 開始
  // 處理拖曳之前就關掉，不會出現「按下去先拖了一段地圖、放開才關」的怪異手感。
  //
  // 原生 <select> 展開的選項清單不會派發頁面層級的 pointerdown，所以「圖層」
  // 彈出層裡的底圖 <select> 不會把自己關掉。
  useEffect(() => {
    if (!open || !dismissOnOutsideClick) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, dismissOnOutsideClick, onOpenChange]);

  const toggle = useCallback(() => {
    didOpenRef.current = true;
    onOpenChange(!open);
  }, [open, onOpenChange]);

  // Escape 掛在面板上（靠 React 的合成事件冒泡），不是掛在 document。
  // 開啟時焦點已經在面板裡，所以 Escape 自然只關掉最上層的那一個；
  // document 監聽會把抽屜與選單一起關掉。
  const onKeyDown = useCallback<KeyboardEventHandler>(
    (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      didOpenRef.current = true;
      onOpenChange(false);
    },
    [onOpenChange],
  );

  return {
    rootRef,
    triggerProps: {
      ref: triggerRef,
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "aria-controls": id,
      onClick: toggle,
    },
    // 刻意不加 aria-modal、不做 focus trap：底下的地圖仍然可以操作，
    // 宣告成 modal 是對輔助科技說謊。
    panelProps: {
      ref: panelRef,
      id,
      role: "dialog",
      "aria-label": label,
      tabIndex: -1,
      onKeyDown: dismissOnEscape ? onKeyDown : undefined,
    },
  };
}
