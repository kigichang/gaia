// 這裡的 .ts 副檔名是必要的，不是筆誤：Node 的 ESM 解析器不會自己補副檔名，
// 而 validate-content.mjs 要用 Node 直接載入這支模組。見下方說明。
import { taiwanTheme } from "./themes/taiwan.ts";
import { worldTheme } from "./themes/world.ts";
import { globalTheme } from "./themes/global.ts";
import type {
  DerivedId,
  GeometryKind,
  LayerDefinition,
  LayerRender,
  ThemeDefinition,
} from "./types.ts";

/**
 * 主題圖層註冊表的入口。
 *
 * ⚠️ **這個模組必須維持 Node 可直接 import**（`scripts/validate-content.mjs`
 * 用 Node 24 的 type stripping 載入它做建置期交叉檢查）。所以這裡只能相依
 * `./themes/*` 與 `./types`，**不准** import `src/content`（裡面有
 * `import.meta.glob`）或任何 maplibre 的值。
 *
 * 需要內容資料才能算出來的東西（例如把特有種展開成 N 個子圖層）一律放
 * `./resolve.ts`，那支是瀏覽器專用的。這條界線請不要跨過去。
 */

export const THEMES: ThemeDefinition[] = [taiwanTheme, worldTheme, globalTheme];

export const DEFAULT_THEME_ID = THEMES[0].id;

export function getTheme(id: string | undefined): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id);
}

/**
 * `derived` 來源實際會去抓的靜態檔案（相對於 `import.meta.env.BASE_URL`）。
 *
 * 放在這裡而不是 `resolve.ts`，是為了讓 `validate-content.mjs`（Node，載入不了
 * resolve.ts）也能檢查這些檔案存不存在。`remote` 來源本來就有這個檢查，derived
 * 少了它就會漏掉同一個坑：檔案不在 → fetch 404 → 圖層靜默消失。
 *
 * ⚠️ 這是**單一事實來源**：`resolve.ts` 的 derived loader 一律從這裡取路徑，
 * 不要在那邊另外寫一份字串。
 */
export const DERIVED_FILES: Record<DerivedId, readonly string[]> = {
  "tw-range-peaks": ["data/geo-manual/tw-ranges.geojson"],
  "tw-reservoirs": ["data/geo/tw-reservoirs.geojson", "data/reservoirs-live.json"],
};

/** 全站所有圖層（含 planned），給驗證器與圖層 id 唯一性檢查用。 */
export function allLayers(): { theme: ThemeDefinition; layer: LayerDefinition }[] {
  return THEMES.flatMap((theme) => theme.layers.map((layer) => ({ theme, layer })));
}

/**
 * maplibre id 的前綴。
 *
 * `"species"` + `"mikado-pheasant"` → `"species-mikado-pheasant"`
 *   → source `species-mikado-pheasant-source`、layer `species-mikado-pheasant-points`
 * 這與重構前 `speciesLayerId()` 產生的字串完全相同，既有的驗證指令不必改。
 */
export function layerInstanceId(layerId: string, itemId?: string): string {
  return itemId ? `${layerId}-${itemId}` : layerId;
}

/** 一個 instance 的 geojson source id。 */
export const geoSourceId = (instanceId: string) => `${instanceId}-source`;

const SUFFIXES: Record<GeometryKind, readonly string[]> = {
  // "-points" 是刻意保留的舊後綴，見 types.ts 的說明
  circle: ["points"],
  line: ["line"],
  fill: ["fill", "outline"],
  // 沒有幾何、也沒有外框：一整個 color-relief 圖層就是它的全部
  elevation: ["elevation"],
};

/** 一個 instance 展開出來的所有 maplibre 圖層 id（由下往上排）。 */
export function geoLayerIds(instanceId: string, render: LayerRender): string[] {
  const ids = SUFFIXES[render.kind].map((s) => `${instanceId}-${s}`);
  if (render.kind === "line" && render.label) ids.push(`${instanceId}-label`);
  return ids;
}

/**
 * 綁點擊／hover 互動的圖層。
 *
 * - fill 綁的是面而不是外框，否則點在邊界上會觸發兩次。
 * - **有沿線標註的 line 要連標註一起綁**：使用者看到的是「中央山脈」那四個字，
 *   自然會去點字，但字是畫在 symbol 圖層上、而線只有 2.6px 寬——只綁線的話，
 *   點在字上有很高機率整個落空，而且畫面上完全沒有反應可以解釋為什麼。
 *   標註與線來自同一個 source、同一個 feature，所以兩邊拿到的 id 一定相同。
 */
export function geoHitLayerIds(instanceId: string, render: LayerRender): string[] {
  // 高程設色沒有 feature，點不到也不該綁互動（綁了 maplibre 會直接報錯）
  if (render.kind === "elevation") return [];
  if (render.kind === "fill") return [`${instanceId}-fill`];
  if (render.kind === "circle") return [`${instanceId}-points`];
  return render.label
    ? [`${instanceId}-line`, `${instanceId}-label`]
    : [`${instanceId}-line`];
}
