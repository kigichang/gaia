import type { ThemePreference } from "../useTheme";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "淺色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "自動" },
];

interface ThemeToggleProps {
  theme: ThemePreference;
  onChange: (next: ThemePreference) => void;
}

/** 淺色／深色／跟隨系統的三段式切換。由 `AppMenu` 擺放（主題頁在 ⋮⋮⋮ 彈出層裡，
 *  `/compare` 直接攤在頁首），全站共用同一份。 */
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="外觀主題">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          className={theme === opt.value ? "theme-toggle-btn is-active" : "theme-toggle-btn"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
