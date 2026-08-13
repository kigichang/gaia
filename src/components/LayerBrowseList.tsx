import type { LayerBrowse } from "../map/registry/types";

/** 巢狀在母圖徵底下的附屬圖徵清單（五大山脈 → 主峰）。 */
export interface BrowseChildren {
  data: GeoJSON.FeatureCollection;
  browse: LayerBrowse;
  /** 子圖徵身上指回母圖徵 id 的屬性名 */
  parentProperty: string;
  onSelect: (featureId: string) => void;
}

interface LayerBrowseListProps {
  data: GeoJSON.FeatureCollection;
  browse: LayerBrowse;
  selectedId?: string;
  onSelect: (featureId: string) => void;
  children?: BrowseChildren;
}

/**
 * 圖層的可點清單。
 *
 * 取代 ExplorePage 裡兩份分別寫死的清單（地形景點、原住民族）——它們只差在
 * 取哪個欄位當主標與次標，所以改由 feature.properties 驅動就能共用同一份。
 * 屬性是在 `registry/resolve.ts` 的 BUNDLED_LOADERS 裡附加上去的。
 *
 * **這裡刻意不排序：清單順序就是 `data.features` 的順序**，由資料自己決定。
 * 排序規則跟著資料集走（縣市界是由北到南、離島最後，見 `build-geodata.mjs`），
 * 這支共用元件不該知道哪個圖層該怎麼排。
 *
 * `children` 是**一層**巢狀（五大山脈 → 主峰），刻意不做任意深度：巢狀是投機設計，
 * 這裡只需要「一條稜線配一顆主峰」這一種形狀。子項目自己也可以是選取中的那一筆，
 * 所以 `selectedId` 對母子兩層一起比對。
 */
export function LayerBrowseList({
  data,
  browse,
  selectedId,
  onSelect,
  children,
}: LayerBrowseListProps) {
  const primary = browse.primary ?? "name";
  const secondary = browse.secondary ?? "meta";
  const groupBy = browse.groupBy;

  const childrenOf = (parentId: string) =>
    children?.data.features.filter(
      (f) => f.properties?.[children.parentProperty] === parentId,
    ) ?? [];

  /**
   * 依 `groupBy` 屬性把 feature 切成一段一段。
   *
   * **依序切，不排序**——feature 順序是資料集刻意排好的（鄉鎮界是縣市由北到南、
   * 離島最後），這裡重排會把那個順序毀掉。同一個值只要在資料裡是連續的就會併成
   * 一組；不連續的話會分成兩組，那是資料沒排好的徵兆，不該由這支元件補救。
   */
  const groups: { key: string; features: typeof data.features }[] = [];
  if (groupBy) {
    for (const f of data.features) {
      const value = f.properties?.[groupBy];
      const key = typeof value === "string" ? value : "";
      const last = groups.at(-1);
      if (last && last.key === key) last.features.push(f);
      else groups.push({ key, features: [f] });
    }
  }

  const renderItem = (f: GeoJSON.Feature, grouped: boolean) => {
        const props = f.properties ?? {};
        const id = typeof props.id === "string" ? props.id : null;
        if (!id) return null;

        const kids = childrenOf(id);
        // 分組時次標就是組名，每一列再印一次只是雜訊（「中正區／基隆市」）
        const showSecondary =
          props[secondary] != null && !(grouped && groupBy && props[secondary] === props[groupBy]);

        return (
          <li key={id}>
            <button
              type="button"
              className={id === selectedId ? "place-btn is-active" : "place-btn"}
              onClick={() => onSelect(id)}
            >
              <span className="place-btn-name">{String(props[primary] ?? id)}</span>
              {showSecondary && (
                <span className="place-btn-meta">{String(props[secondary])}</span>
              )}
            </button>

            {kids.length > 0 && children && (
              <ul className="place-list place-list-children">
                {kids.map((kid) => {
                  const kidProps = kid.properties ?? {};
                  const kidId = typeof kidProps.id === "string" ? kidProps.id : null;
                  if (!kidId) return null;
                  const kidPrimary = children.browse.primary ?? "name";
                  const kidSecondary = children.browse.secondary ?? "meta";
                  return (
                    <li key={kidId}>
                      <button
                        type="button"
                        className={
                          kidId === selectedId ? "place-btn is-active" : "place-btn"
                        }
                        onClick={() => children.onSelect(kidId)}
                      >
                        <span className="place-btn-name">
                          {String(kidProps[kidPrimary] ?? kidId)}
                        </span>
                        {kidProps[kidSecondary] != null && (
                          <span className="place-btn-meta">
                            {String(kidProps[kidSecondary])}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
  };

  if (groupBy) {
    return (
      <ul className="place-list">
        {groups.map((g) => (
          <li key={g.key}>
            {/* 組名不是可點的圖徵——縣市不在這一層的資料裡，做成按鈕會點了沒反應 */}
            <p className="place-group">{g.key}</p>
            <ul className="place-list place-list-children">
              {g.features.map((f) => renderItem(f, true))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }

  return <ul className="place-list">{data.features.map((f) => renderItem(f, false))}</ul>;
}
