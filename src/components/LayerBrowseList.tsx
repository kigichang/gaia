import type { LayerBrowse } from "../map/registry/types";

interface LayerBrowseListProps {
  data: GeoJSON.FeatureCollection;
  browse: LayerBrowse;
  selectedId?: string;
  onSelect: (featureId: string) => void;
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
 */
export function LayerBrowseList({ data, browse, selectedId, onSelect }: LayerBrowseListProps) {
  const primary = browse.primary ?? "name";
  const secondary = browse.secondary ?? "meta";

  return (
    <ul className="place-list">
      {data.features.map((f) => {
        const props = f.properties ?? {};
        const id = typeof props.id === "string" ? props.id : null;
        if (!id) return null;

        return (
          <li key={id}>
            <button
              type="button"
              className={id === selectedId ? "place-btn is-active" : "place-btn"}
              onClick={() => onSelect(id)}
            >
              <span className="place-btn-name">{String(props[primary] ?? id)}</span>
              {props[secondary] != null && (
                <span className="place-btn-meta">{String(props[secondary])}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
