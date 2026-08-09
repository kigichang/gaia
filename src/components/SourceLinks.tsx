import { SOURCE_LINKS } from "../content/sourceLinks";

/** 把資料來源清單接成一行，有登記官網連結的來源會變成可點連結，其餘照舊顯示純文字。 */
export function SourceLinks({ sources }: { sources: string[] }) {
  return (
    <>
      {sources.map((s, i) => {
        const url = SOURCE_LINKS[s];
        return (
          <span key={s}>
            {i > 0 && "、"}
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {s}
              </a>
            ) : (
              s
            )}
          </span>
        );
      })}
    </>
  );
}
