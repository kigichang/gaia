const GITHUB_URL = "https://github.com/kigichang/gaia";
const CONTACT_EMAIL = "me@kigi.tw";

/**
 * ⚠️ 標題要帶站名。使用者的預設信件軟體開起來之後，畫面上已經看不到這個網站了，
 * 收信的人也需要一眼認出這封信是從哪裡來的。
 */
const MAIL_SUBJECT = "[GAIA] 問題或建議標題";
const MAILTO_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}`;

/** 兩個入口共用的標題，兩邊不會漂開 */
export const CONTACT_TITLE = "問題回報";

/**
 * 「問題回報」的內文：GitHub Issue 與 Email 兩個連結。
 *
 * ## 為什麼是共用元件而不是各寫一份
 *
 * 它同時出現在**兩個**地方，而兩者在畫面上**永遠只會有一個**（見 styles.css 的
 * `.map-menu-contact`）：
 *
 * - 寬螢幕：搜尋框右邊的按鈕（`FeedbackButton`）。
 * - 窄螢幕（≤860px）：右上角 ⋮⋮⋮ 選單裡的一段——那個寬度按鈕整顆是 `display: none`
 *   的（要讓出 ⋮⋮⋮ 的位置與打字空間，見 CLAUDE.md），少了這一段，**手機上就完全
 *   沒有回報問題的入口**。
 *
 * 網址原樣印出來、不寫成「這裡」：使用者要看得到自己會被帶去哪裡。
 */
export function ContactNote() {
  return (
    <div className="contact-note">
      <p>
        如果有任何問題與建議，歡迎到{" "}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          {GITHUB_URL}
        </a>{" "}
        發 Issue 或 Email 給{" "}
        {/* mailto 交給瀏覽器叫起預設的信件軟體，主旨由 MAIL_SUBJECT 帶入 */}
        <a href={MAILTO_URL}>{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
