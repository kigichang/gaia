import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { buildSearchIndex, searchHits, type SearchHit } from "../search/searchIndex";
import type { PopoverBindings } from "../usePopover";

interface MapSearchBoxProps {
  /** 目前主題名稱，寫進 placeholder（頁首拿掉之後這是「我在哪個主題」的指示） */
  themeLabel: string;
  themeId: string;
  /** 藥丸最左邊的 ☰，由 ThemeMapPage 的 usePopover 提供 */
  menuButtonProps: PopoverBindings["triggerProps"];
  /** ☰ 的 aria-label */
  menuLabel: string;
  onSelectHit: (hit: SearchHit) => void;
}

/**
 * 左上角的搜尋藥丸（仿 Google Map）：`[☰] [輸入框] [✕] [🔍]`。
 *
 * ## 為什麼不重用 usePopover
 *
 * `usePopover` 的觸發器語意是 `aria-haspopup="dialog"` 的按鈕，而這裡是
 * combobox：輸入框自己就是觸發器，建議清單是 listbox 不是 dialog，套上去等於
 * 對輔助科技說謊。但「點外面關閉」的手法是照抄的——用 document 的
 * **`pointerdown`** 而不是 `click`，這樣清單會在 maplibre 開始處理拖曳之前就
 * 收起來，不會出現「按下去先拖了一段地圖、放開才關」的怪異手感。
 * 理由的完整版見 `src/usePopover.ts` 的說明。
 *
 * 索引是 lazy 的：第一次獲得焦點才 `buildSearchIndex()`（要抓兩份 geojson，
 * 見 searchIndex.ts）。
 */
export function MapSearchBox({
  themeLabel,
  themeId,
  menuButtonProps,
  menuLabel,
  onSelectHit,
}: MapSearchBoxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadIndex = useCallback(() => {
    if (index) return;
    void buildSearchIndex().then(setIndex);
  }, [index]);

  const hits = useMemo(
    () => (index ? searchHits(index, query, themeId) : []),
    [index, query, themeId],
  );

  // 結果變了就把高亮拉回第一筆，否則會停在一個已經不存在的位置
  useEffect(() => setActiveIndex(0), [query, index]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = useCallback(
    (hit: SearchHit) => {
      onSelectHit(hit);
      setOpen(false);
      setQuery(hit.title);
      inputRef.current?.blur();
    },
    [onSelectHit],
  );

  const clear = useCallback(() => {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // 先關清單，清單已經關了才清空輸入框——兩件事分兩次 Escape，
      // 才不會「只是想收起清單」卻連打好的字一起沒了
      e.stopPropagation();
      if (open) setOpen(false);
      else setQuery("");
      return;
    }
    if (!hits.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) choose(hit);
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="map-search-root" ref={rootRef}>
      <div className="map-search">
        <button
          {...menuButtonProps}
          className="map-search-menu"
          aria-label={menuLabel}
          title={menuLabel}
        >
          <MenuIcon />
        </button>

        <input
          ref={inputRef}
          type="text"
          className="map-search-input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && hits[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          placeholder={`在${themeLabel}中搜尋…`}
          value={query}
          onFocus={(e) => {
            loadIndex();
            // 選了結果之後輸入框留著上一個地名，再次點進來多半是要換一個搜——
            // 全選讓「直接打新的」就是預設行為，不用先手動清掉
            e.target.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            loadIndex();
          }}
          onKeyDown={onKeyDown}
        />

        {query && (
          <button type="button" className="map-search-clear" onClick={clear} aria-label="清除搜尋">
            <CloseIcon />
          </button>
        )}
        <span className="map-search-icon" aria-hidden="true">
          <SearchIcon />
        </span>
      </div>

      {showList && (
        <ul className="map-search-results" id={listId} role="listbox" aria-label="搜尋結果">
          {hits.length === 0 && (
            <li className="map-search-empty">
              {index ? "找不到符合的地點或圖層" : "載入搜尋資料中…"}
            </li>
          )}
          {hits.map((hit, i) => (
            <li key={hit.key}>
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? "search-hit is-active" : "search-hit"}
                // mousedown 早於 blur，用 pointerdown 選取才不會因為輸入框失焦
                // 先把清單收掉而讓這一下點空
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(hit);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="search-hit-name">
                  {hit.title}
                  {hit.kind === "layer" && <span className="search-hit-kind">圖層</span>}
                </span>
                <span className="search-hit-meta">
                  {hit.themeId !== themeId && (
                    <span className="search-hit-theme">{hit.themeLabel}</span>
                  )}
                  {hit.subtitle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </g>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </g>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
