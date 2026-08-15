import { useCallback, useState } from "react";

/**
 * `all`：搜尋命中之後，該圖層照常畫出全部圖徵，只把命中的那一筆加粗（**現行行為**）。
 * `solo`：搜尋命中之後，該圖層**只畫那一筆**（連同它的附屬圖徵）。
 */
export type SoloSearchMode = "all" | "solo";

const STORAGE_KEY = "gaia-solo-search";

/** 讀 localStorage。沒存過、值不合法、或根本沒有 localStorage（隱私模式）一律視為現行行為。 */
function readStored(): SoloSearchMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "solo" ? "solo" : "all";
  } catch {
    return "all";
  }
}

/**
 * 「搜尋結果要不要只顯示這一筆」的使用者偏好，作法比照 `useTheme` 與 `useDrawerOpen`
 * （同樣包 try/catch，隱私模式下只是不跨次保留，不會拋錯）。
 *
 * ⚠️ **這是常設偏好，兩種呈現方式都要一直留著，不要哪天挑一個刪掉。**
 * 兩者各有適合的場合，而且那件事跟圖層本身的密度有關、不是全站二選一：
 * 搜一個颱風、一條斷層、一個古蹟時「只顯示這一筆」才看得清楚；但看重大地震或
 * 水庫時，鄰居本身就是教學內容（地震帶沿板塊排列），藏掉反而把重點弄丟。
 * 交給使用者自己選，比我們替他決定準。
 *
 * ⚠️ **預設是 `"all"`（照常全部顯示）**：那是本站一路以來的行為，換預設等於在沒有
 * 說明的情況下改變所有既有使用者的畫面。
 */
export function useSoloSearch() {
  const [soloSearch, setSoloSearchState] = useState<SoloSearchMode>(() => readStored());

  const setSoloSearch = useCallback((next: SoloSearchMode) => {
    setSoloSearchState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隱私模式或被封鎖時忽略——狀態仍會在本次 session 生效
    }
  }, []);

  return { soloSearch, setSoloSearch };
}
