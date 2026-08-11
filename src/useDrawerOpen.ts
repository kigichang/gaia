import { useCallback, useState } from "react";

const STORAGE_KEY = "gaia-layer-drawer";

/** 讀 localStorage。沒存過、值不合法、或根本沒有 localStorage（隱私模式）一律視為開啟。 */
function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "closed";
  } catch {
    return true;
  }
}

/**
 * 圖層抽屜的開關，會記住使用者上次的選擇。作法比照 `useTheme`（同樣包 try/catch，
 * 隱私模式下只是不跨次保留，不會拋錯）。**首次到訪預設開啟**——圖層勾選是這個
 * 網站的核心操作，藏在一顆按鈕後面會讓人發現不了。
 *
 * 分成兩個 setter 是有原因的：抽屜疊在詳情面板之上，所以只要選取了任何圖徵就得
 * 自動把抽屜收起來，否則剛開出來的詳情卡會被抽屜整個蓋住。但那次收起是系統替
 * 使用者做的決定，**不可以**覆寫掉他自己記住的偏好——下次進站還是要照他上次
 * 手動設定的狀態。
 */
export function useDrawerOpen() {
  const [open, setOpenState] = useState<boolean>(() => readStored());

  /** 使用者主動切換（點 ☰ 或關閉鈕）：寫進 localStorage。 */
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // 隱私模式或被封鎖時忽略——狀態仍會在本次 session 生效
    }
  }, []);

  /** 因為選取圖徵而自動收起：只改畫面，不動記憶值。 */
  const closeTransient = useCallback(() => setOpenState(false), []);

  return { open, setOpen, closeTransient };
}
