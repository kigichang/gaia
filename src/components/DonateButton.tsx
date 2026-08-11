const DONATE_URL = "https://official.junyiacademy.org/donate/";

/**
 * 搜尋框右邊的贊助按鈕，另開分頁連到均一的贊助頁。
 *
 * 用 `<a target="_blank">` 而不是 `window.open()`：語意上就是一個連結，
 * 鍵盤與輔助科技都能直接操作，不需要額外的 click handler。
 */
export function DonateButton() {
  return (
    <a
      className="map-fab map-donate"
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="贊助均一教育平台"
      title="贊助均一教育平台"
    >
      <HeartIcon />
    </a>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="currentColor"
      />
    </svg>
  );
}
