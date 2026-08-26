import { MapPopover } from "./MapPopover";
import { ContactNote, CONTACT_TITLE } from "./ContactNote";

/**
 * 搜尋框右邊的「問題回報」按鈕：點下去開一張小卡，說明怎麼回報問題與建議。
 *
 * ## 為什麼是一張小卡而不是直接外跳
 *
 * 回報問題在整個站上**沒有別的入口**（沒有頁首、沒有頁尾，主題頁是滿版地圖），
 * 而回報有兩條路（GitHub Issue 與 Email），一顆按鈕沒辦法同時直連兩個地方；
 * 直接外跳到其中一個，使用者在按下去之前也不知道自己會被帶去哪裡。
 *
 * ⚠️ **內文在 `ContactNote`，不要在這裡再寫一份**：窄螢幕的這顆按鈕是
 * `display: none`，同一段內容會改由 ⋮⋮⋮ 選單顯示（見那支檔案）。
 *
 * ## 為什麼重用 MapPopover
 *
 * 開關、Escape、點外面關閉、焦點還給觸發器全部在 `usePopover` 裡（見那裡的說明），
 * 這裡不該再寫一份。**尤其是 Escape**：`usePopover` 的 Escape 掛在面板上並且
 * `stopPropagation()`，所以它不會冒到 `ThemeMapPage` 那個 document 層級的三段式
 * Escape——按 Escape 只會關掉這張小卡，不會順手把詳情面板或抽屜一起關掉。
 */
export function FeedbackButton() {
  return (
    <MapPopover
      rootClassName="map-feedback-root"
      label={CONTACT_TITLE}
      placement="top-right"
      triggerClassName="map-fab map-feedback"
      triggerContent={<FeedbackIcon />}
      panelClassName="map-feedback-panel"
    >
      {(close) => (
        <>
          <div className="map-feedback-head">
            <h2 className="contact-note-title">{CONTACT_TITLE}</h2>
            <button type="button" className="panel-close" onClick={close} aria-label="關閉">
              <CloseIcon />
            </button>
          </div>
          <ContactNote />
        </>
      )}
    </MapPopover>
  );
}

/** 對話框加一個驚嘆號。裝飾性，文字說明在按鈕的 aria-label。 */
function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 4h16v12H8l-4 4V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.5v4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="13.2" r="1" fill="currentColor" />
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
