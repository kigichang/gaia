import { useEffect, useState } from "react";
import { loadGeoCollection } from "./index";
import type { GeoFeature } from "../lib/schema";

/**
 * 取一筆地理要素的說明。分片還沒到就回 `loading: true`。
 *
 * 說明改成延遲載入的理由見 `content/index.ts`；這裡只負責把那件事包成一個
 * 卡片用得動的 hook。
 *
 * ⚠️ **換圖徵時要先把上一筆清掉**（`setFeature(null)`），否則切到同一層的另一個
 * 圖徵、而分片已經在快取裡時，會有一瞬間看到**新標題配舊內容**。比照
 * `MonumentCard` 的 `useHistory`。
 *
 * ⚠️ `cancelled` 那條守衛也不能省：使用者連點兩個不同 collection 的圖徵時，
 * 先發的請求可能後到，沒有守衛就會把後來那一筆蓋掉。
 */
export function useGeoFeature(
  collection: string,
  id: string,
): { feature: GeoFeature | undefined; loading: boolean } {
  const [state, setState] = useState<{
    key: string;
    feature: GeoFeature | undefined;
  } | null>(null);

  const key = `${collection}/${id}`;

  useEffect(() => {
    let cancelled = false;
    void loadGeoCollection(collection).then((shard) => {
      if (cancelled) return;
      setState({ key, feature: shard?.[id] });
    });
    return () => {
      cancelled = true;
    };
  }, [collection, id, key]);

  // key 不符＝這一筆還在載入（含「剛換到另一個圖徵」的那一瞬間）
  if (state?.key !== key) return { feature: undefined, loading: true };
  return { feature: state.feature, loading: false };
}
