import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "gaia-theme";

/** 讀 localStorage，值不合法（或無 localStorage，如隱私模式）一律視為跟隨系統。 */
function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** 把偏好反映到 <html data-theme>：styles.css 的 `:root[data-theme="dark"]` 與
 * `:root:not([data-theme="light"])` 選擇器就是為了配合這個屬性而寫的。 */
function applyToDocument(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
}

/** 淺色／深色／跟隨系統的主題切換，選擇會存進 localStorage，跨頁與重新整理都保留。 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStored());

  useEffect(() => {
    applyToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // 隱私模式或被封鎖時忽略——狀態仍會在本次 session 生效，只是不會跨次保留
    }
  }, []);

  return { theme, setTheme };
}
