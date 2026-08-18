import { MapPopover } from "./MapPopover";
import { ContactNote, CONTACT_TITLE } from "./ContactNote";

/**
 * 搜尋框右邊的心型按鈕：點下去先開一張小卡，說明「怎麼回報問題」與「怎麼贊助」。
 *
 * ## 為什麼不是直接連到贊助頁
 *
 * 心型原本是一個 `<a target="_blank">`，按下去就跳到均一的贊助頁。問題是這顆按鈕
 * 其實承擔兩件事——**回報問題／建議**與**贊助**——而前者在整個站上沒有別的入口
 * （沒有頁首、沒有頁尾，主題頁是滿版地圖）。直接外跳等於把回報那條路徹底藏起來，
 * 而且使用者在按下去之前也不知道自己會被帶去哪裡。
 *
 * 所以改成先開一張小卡，三條路徑（GitHub Issue、Email、贊助）各自是一個連結。
 *
 * ⚠️ **內文在 `ContactNote`，不要在這裡再寫一份**：窄螢幕的心型是 `display: none`，
 * 同一段內容會改由 ⋮⋮⋮ 選單顯示（見那支檔案）。
 *
 * ## 為什麼重用 MapPopover
 *
 * 開關、Escape、點外面關閉、焦點還給觸發器全部在 `usePopover` 裡（見那裡的說明），
 * 這裡不該再寫一份。**尤其是 Escape**：`usePopover` 的 Escape 掛在面板上並且
 * `stopPropagation()`，所以它不會冒到 `ThemeMapPage` 那個 document 層級的三段式
 * Escape——按 Escape 只會關掉這張小卡，不會順手把詳情面板或抽屜一起關掉。
 */
export function DonateButton() {
  return (
    <MapPopover
      rootClassName="map-donate-root"
      label={CONTACT_TITLE}
      placement="top-right"
      triggerClassName="map-fab map-donate"
      triggerContent={<HeartIcon />}
      panelClassName="map-donate-panel"
    >
      {(close) => (
        <>
          <div className="map-donate-head">
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
