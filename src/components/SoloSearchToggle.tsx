import type { SoloSearchMode } from "../useSoloSearch";

const OPTIONS: Array<{ value: SoloSearchMode; label: string; hint: string }> = [
  {
    value: "all",
    label: "顯示全部",
    hint: "搜尋命中之後，該圖層照常畫出全部圖徵，只把命中的那一筆加粗（現行）",
  },
  {
    value: "solo",
    label: "只顯示這一筆",
    hint: "搜尋命中之後，該圖層只畫那一筆；其他勾選中的圖層不受影響",
  },
];

interface SoloSearchToggleProps {
  mode: SoloSearchMode;
  onChange: (next: SoloSearchMode) => void;
}

/**
 * 搜尋命中之後要怎麼呈現的兩段式切換，由 `AppMenu` 擺在主題頁右上角的 ⋮⋮⋮ 彈出層裡。
 *
 * 外觀直接重用 `ThemeToggle` 那組 `.theme-toggle` CSS——這是站上既有的分段控制樣式，
 * 兩者並排在同一個選單裡，長得一樣才讀得出「這兩個都是偏好設定」。
 *
 * ⚠️ `/compare` 沒有搜尋框，所以 `AppMenu` 的 `inline` 那一支**刻意不渲染這個**。
 *
 * ⚠️ 兩個選項都是常設的（見 `useSoloSearch`），`hint` 是使用者判斷該選哪個的唯一
 * 線索，改文案時要保留「其他勾選中的圖層不受影響」那句——那是最容易被誤解的地方。
 */
export function SoloSearchToggle({ mode, onChange }: SoloSearchToggleProps) {
  return (
    <div className="solo-search-toggle">
      <span className="solo-search-toggle-label">搜尋結果</span>
      <div className="theme-toggle" role="radiogroup" aria-label="搜尋結果的呈現方式">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={mode === opt.value}
            title={opt.hint}
            className={mode === opt.value ? "theme-toggle-btn is-active" : "theme-toggle-btn"}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
