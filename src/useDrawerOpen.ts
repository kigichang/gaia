import { useCallback, useState } from "react";

const STORAGE_KEY = "gaia-layer-drawer";

/** 讀 localStorage。沒存過、值不合法、或根本沒有 localStorage（隱私模式）一律視為收起。 */
function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "open";
  } catch {
    return false;
  }
}

/**
 * 圖層抽屜的開關，會記住使用者上次的選擇。作法比照 `useTheme`（同樣包 try/catch，
 * 隱私模式下只是不跨次保留，不會拋錯）。**首次到訪預設收起**——抽屜蓋住左上角的
 * 搜尋框，預設開著會讓人第一眼看不到這次的主要入口。圖層仍然找得到：☰ 就在搜尋
 * 藥丸的最左邊，而且搜尋本身也搜得到圖層名稱。
 *
 * 開關只有這一個 setter，而且每次都寫進 localStorage：選取圖徵時**不會**再自動
 * 收起抽屜（詳情面板現在疊在抽屜之上，見 styles.css 的 --z-panel／--z-drawer），
 * 所以不存在「系統替使用者收起、但不可以覆寫他的偏好」那種第二種收起方式了。
 */
export function useDrawerOpen() {
  const [open, setOpenState] = useState<boolean>(() => readStored());

  /** 使用者主動切換（點 ☰、關閉鈕或按 Escape）：寫進 localStorage。 */
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // 隱私模式或被封鎖時忽略——狀態仍會在本次 session 生效
    }
  }, []);

  return { open, setOpen };
}
