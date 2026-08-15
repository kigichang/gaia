import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { geoLayerIds, geoSourceId } from "../registry/index.ts";
import type { ColorRamp, LayerRender } from "../registry/types.ts";
import { BELT_EDGE_COLOR, BELT_EDGE_M } from "../thematicColors";
import { DEM_SOURCE_ID, addDemSource } from "./hillshade";

/**
 * 通用主題圖層 helper（circle / line / fill）。
 *
 * 取代舊的 `layers/points.ts`——三種內容型別（地形景點、原住民族、特有種）
 * 都只是圓點，但註冊表要表達的行政區是面、水系與洋流是線，所以 helper 必須
 * 泛化到三種幾何。
 *
 * ## 一個 instance 可能對應多個 maplibre 圖層
 *
 *   circle → `${id}-points`
 *   line   → `${id}-line`（有 label 時再加 `${id}-label`）
 *   fill   → `${id}-fill` + `${id}-outline`
 *
 * fill 的外框必須是獨立的 line 圖層：maplibre 的 `fill-outline-color` 只能畫
 * 1px 髮絲線，線寬完全不可調。兩個子圖層共用同一個 source，但**分屬不同的排序
 * band**（面在下、線在上），插入位置各自決定，見 `../layerOrder.ts`。
 *
 * `addGeoLayer` 刻意**不收 `beforeId`**：排序是一個獨立且冪等的後處理，
 * 理由見 layerOrder.ts。
 */

export interface GeoLayerSpec {
  /** maplibre id 的前綴，例如 "places"、"species-mikado-pheasant" */
  instanceId: string;
  /** `kind: "elevation"` 沒有 geojson，這裡是 null（見 addGeoLayer 的說明） */
  data: GeoJSON.FeatureCollection | null;
  color: string;
  render: LayerRender;
  minzoom?: number;
  maxzoom?: number;
  /**
   * 要強調的圖徵 `properties.id`。通常只有一筆（目前選取的），但選到山脈時會連
   * 它的主峰一起帶進來——主峰是另一個圖層的點，兩層各自比對這份清單即可。
   */
  highlightIds?: readonly string[];
  /**
   * 「只顯示這一筆」：有值時這個 instance 的所有 maplibre 圖層都只畫
   * `properties.id` 落在清單裡的圖徵，其餘**不算繪**（跟 `highlightIds` 那條
   * paint 通道不同——那條是全部照畫、只把命中的加粗）。
   *
   * 目前唯一的來源是搜尋命中後的 A/B（見 ThemeMapPage 的 `solo`）。沒有值就是
   * 解除過濾，**這件事必須主動做**，見 `applySoloFilter`。
   */
  soloIds?: readonly string[];
  /** 勾選中的高程分帶 id（只有 `kind: "elevation"` 會用，見 useGeoLayers）。 */
  activeItems?: readonly string[];
}

/**
 * 「選取中」的強調。
 *
 * 同一個圖層裡所有圖徵都是同一個顏色（顏色代表的是**圖層身分**，不是個別圖徵），
 * 所以選了 16 個原住民族裡的某一族之後，根本認不出地圖上哪一顆紅點才是它。
 * 解法**不能是換顏色**——那會讓「紅點＝原住民族」這個圖例對應失效，也違反
 * 「顏色跟著實體、不跟著狀態」的規則。改用**尺寸與外框**這兩個獨立通道：
 * 選取的那一筆半徑加倍、外框加粗，色相完全不動。
 *
 * 做成 data-driven 的 `case` 表達式而不是另外加一個 highlight 圖層，有兩個好處：
 * 不會多出需要排進 `layerOrder` 那條堆疊帶的圖層 id，而且切底圖重套時
 * `addGeoLayer` 會照常帶著當下的 `highlightIds` 重建，不需要另一條狀態同步路徑。
 *
 * 比對的是一份 **id 清單**而不是單一 id：選到山脈時要連它的主峰一起強調，而主峰
 * 是另一個圖層（地形景點）的點——兩個圖層各自拿同一份清單去比對就好，不需要知道
 * 對方存不存在。
 *
 * `base` 可能本身就是表達式（地震用震級驅動半徑），所以倍率是一個**函式**
 * （`(b) => ["*", b, n]`）而不是先算好的值——下面的 zoom 特例要對每一個 stop
 * 各套一次。
 *
 * ## ⚠️ zoom 表達式只能是最外層，所以 `case` 要推到 stop 裡面
 *
 * maplibre 有兩條硬規則：`["zoom"]` 只能當**最外層** `step`／`interpolate` 的輸入，
 * 而且一個屬性裡**只能有一個** zoom 曲線。天真的做法
 * `["case", cond, ["*", ZOOM曲線, 2], ZOOM曲線]` 兩條都違反，maplibre 會在
 * `addLayer` 丟錯：
 *
 * ```
 * layers.tw-typhoons-line.paint.line-width:
 *   Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.
 * ```
 *
 * ⚠️ **失敗的樣子非常難認**：`addGeoLayer` 是一路往下加圖層的，線加不上去、
 * 但它後面的沿線標註照樣加上去了——畫面上看到名字浮在半空中、線與點都不見，
 * 而 React、詳情卡、圖例全都正常。只有 console 有一行紅字。實測踩過
 * （颱風路徑把半徑改成依 zoom 縮放的那次）。
 *
 * 所以偵測到 base 是一條**最外層的 zoom 曲線**時，改成把 `case` 套進它的每一個
 * 輸出值裡——zoom 仍然留在最外層，而且整條式子只有一個 zoom 曲線。
 * base 不是 zoom 曲線時，行為跟以前逐字相同。
 */
type Expr = unknown;

const isZoomInput = (e: Expr) => Array.isArray(e) && e.length === 1 && e[0] === "zoom";

/**
 * 把一條最外層 zoom 曲線的每個輸出值都換掉，其餘結構原封不動。
 * 不是 zoom 曲線就回 null，由呼叫端走一般路徑。
 *
 * - `["interpolate", <內插法>, ["zoom"], z1, out1, z2, out2, …]` → 輸出在偶數位（4、6…）
 * - `["step", ["zoom"], out0, z1, out1, z2, out2, …]` → 輸出在 2、4、6…
 */
function mapZoomStops(base: Expr, map: (out: Expr) => Expr): Expr[] | null {
  if (!Array.isArray(base)) return null;
  const firstOut =
    base[0] === "interpolate" && isZoomInput(base[2]) ? 4 : base[0] === "step" && isZoomInput(base[1]) ? 2 : -1;
  if (firstOut < 0) return null;
  return base.map((part, i) => (i >= firstOut && (i - firstOut) % 2 === 0 ? map(part) : part));
}

const whenSelected = <T>(
  ids: readonly string[] | undefined,
  selected: (base: Expr) => Expr,
  base: T,
): T => {
  if (!ids?.length) return base;
  const cond = ["in", ["get", "id"], ["literal", [...ids]]];
  const wrap = (b: Expr) => ["case", cond, selected(b), b];
  return (mapZoomStops(base, wrap) ?? wrap(base)) as T;
};

/** 選取狀態的倍率／固定值，集中在這裡方便一起調整。 */
/**
 * 白框的參數。加寬 2.6px（線寬 2.2 → 白框 4.8）是實測值：再窄看不出來，
 * 再寬會讓相鄰的軸線在西部走廊擠成一片白。不透明度略低於 1，避免白框在
 * 正射影像底圖上變成一條刺眼的實白線。
 */
const CASING_COLOR = "#ffffff";
const CASING_EXTRA = 2.6;
const CASING_OPACITY = 0.85;

const SELECTED = {
  radiusScale: 2,
  strokeWidth: 3,
  opacity: 1,
  lineScale: 2.2,
  outlineScale: 2.5,
  /** 面本來就半透明，選取時加深但仍要看得到底圖地名 */
  fillOpacity: 0.38,
} as const;

/**
 * 級距上色的 maplibre 表達式（目前只有水庫蓄水率用）。
 *
 * ⚠️ 外層一定要先問 `["has", prop]`。`["step"]` 拿到 null 會在執行期丟型別錯誤，
 * 而「這個 feature 沒有這個屬性」是**正常情況**——當天沒回報水情的水庫就是這樣。
 * 它們畫成 `nodata.color`：資料缺漏不是「蓄水率 0%」，兩者不能混為一談。
 *
 * 圖層沒宣告 `nodata`（人口那一層每筆都有值）時退回圖層自己的身分色。那個 case
 * 分支仍然要留著——`["step"]` 拿到 null 一樣會炸，而「保證每筆都有值」是資料的
 * 承諾、不是型別系統擋得住的事。
 */
function rampExpression(ramp: ColorRamp, fallback: string): unknown {
  // ["step", input, 第一段的色, 界線1, 第二段的色, 界線2, …]——界線來自前一段的
  // `below`，顏色是後一段的。最後一段的 below 是 null（開放上界），不參與。
  const stops = ramp.steps
    .slice(0, -1)
    .flatMap((step, i) => [step.below as number, ramp.steps[i + 1].color]);
  return [
    "case",
    ["has", ramp.property],
    ["step", ["get", ramp.property], ramp.steps[0].color, ...stops],
    ramp.nodata?.color ?? fallback,
  ];
}

/**
 * 高程分帶的 `color-relief-color` 表達式。
 *
 * ## 為什麼每一帶要「平的」，而不是相鄰兩色平滑漸變
 *
 * 最初的版本直接在兩個代表色之間內插，結果是一片糊掉的暖色調——**「分帶」這件事
 * 在畫面上根本看不出來**，而那正是整層唯一要教的東西。現在每一帶在自己的高程範圍
 * 內是同一個顏色，界線另外插一條深色。
 *
 * ## 那條界線就是一條等高線
 *
 * 界線是在界線高程前後各留 `BELT_EDGE_M` 公尺、中間插進 `BELT_EDGE_COLOR` 畫出來的，
 * 所以它天生沿著那個高程繞著山走：陡坡上細、緩坡上寬，跟真的等高線行為一模一樣。
 * 也因此**不需要（也沒辦法）另外開一個 maplibre-contour 來源**——它的
 * `contourProtocolUrl` 只吃「每隔幾公尺」的等距間隔，而植被帶的界線是
 * 500／1,500／2,500／3,100／3,600 這種不等距的高程。
 *
 * ## 只顯示某幾帶
 *
 * `activeItems` 沒列到的帶畫成全透明。界線只在**兩側至少有一帶是開的**時候才畫，
 * 否則關掉的區域會憑空浮出一條線。`undefined`（不是 items 圖層）視為全開。
 *
 * ⚠️ interpolate 的 stop 必須嚴格遞增，改動 `BELT_EDGE_M` 或界線值時要確認相鄰的
 * `hi - W` 與下一帶的 `lo + W` 不會交叉（最窄的一帶是冷杉林帶的 500 公尺）。
 */
function beltExpression(
  render: Extract<LayerRender, { kind: "elevation" }>,
  activeItems?: readonly string[],
): unknown {
  const on = (id: string) => !activeItems || activeItems.includes(id);
  const W = BELT_EDGE_M;
  const TRANSPARENT = "rgba(0,0,0,0)";

  const stops: (number | string)[] = [];
  let lo = -500;
  render.bands.forEach((band, i) => {
    const hi = band.below ?? 9000;
    const fill = on(band.id) ? band.color : TRANSPARENT;
    stops.push(lo + W, fill, hi - W, fill);
    if (band.below != null) {
      const next = render.bands[i + 1];
      const edge = on(band.id) || (next && on(next.id)) ? BELT_EDGE_COLOR : TRANSPARENT;
      stops.push(hi, edge);
    }
    lo = hi;
  });
  return ["interpolate", ["linear"], ["elevation"], ...stops];
}

/**
 * 建立（或就地更新）一個 instance 的所有 maplibre 圖層，然後套用「只顯示這一筆」的過濾。
 *
 * ⚠️ 過濾**只有這一個呼叫點**：底下 `addGeoLayerShapes` 的三個幾何分支各自 early-return，
 * 在每個分支裡各補一次呼叫，將來加第五種幾何時一定會漏掉其中一個。
 */
export function addGeoLayer(map: MapLibreMap, spec: GeoLayerSpec) {
  addGeoLayerShapes(map, spec);
  applySoloFilter(map, spec.instanceId, spec.render, spec.soloIds);
}

/**
 * 「只顯示這一筆」的過濾通道。這是站上**第二條**逐圖徵通道——第一條是
 * `whenSelected()` 那條 paint 通道（全部照畫、只改大小與外框）。
 *
 * ⚠️ **沒有 soloIds 時一定要主動 `setFilter(id, null)` 把過濾解除。**
 * `addGeoLayerShapes` 是 upsert（既有圖層走 `setPaintProperty`，從不重建），
 * 少了這一手，解除選取之後圖層會永遠停在上一次的過濾狀態、其餘圖徵再也不出現。
 *
 * ⚠️ `map.getLayer(id)` 的守衛不可以拿掉：`setFilter` 對不存在的圖層會拋錯，
 * 而切底圖的瞬間圖層是真的不存在的。（同樣的迴圈形狀見 `removeGeoLayer`。）
 */
function applySoloFilter(
  map: MapLibreMap,
  instanceId: string,
  render: LayerRender,
  soloIds: readonly string[] | undefined,
) {
  // 高程設色沒有 geojson、沒有圖徵，filter 無從施力（也沒有 id 可以比對）
  if (render.kind === "elevation") return;
  const filter = soloIds?.length
    ? (["in", ["get", "id"], ["literal", [...soloIds]]] as FilterSpecification)
    : null;
  for (const id of geoLayerIds(instanceId, render)) {
    if (map.getLayer(id)) map.setFilter(id, filter);
  }
}

function addGeoLayerShapes(map: MapLibreMap, spec: GeoLayerSpec) {
  const { instanceId, data, color, render, minzoom, maxzoom, highlightIds, activeItems } = spec;
  const zoom = { ...(minzoom != null && { minzoom }), ...(maxzoom != null && { maxzoom }) };

  if (render.kind === "elevation") {
    /**
     * 依 DEM 高程設色（maplibre 的 `color-relief`）。跟前三種完全不同：
     * **不建 geojson source**，直接掛在 hillshade 已經建好的共用 raster-dem 上，
     * 所以這裡用 `DEM_SOURCE_ID` 而不是 `geoSourceId(instanceId)`。
     */
    const id = `${instanceId}-elevation`;
    const colorExpr = beltExpression(render, activeItems);
    const opacity = render.opacity ?? 0.45;
    addDemSource(map, DEM_SOURCE_ID);

    if (map.getLayer(id)) {
      // 勾選／取消單一帶只要換表達式，不必把圖層拆掉重加（比照 circle 的既有處理）
      map.setPaintProperty(id, "color-relief-color", colorExpr as never);
      map.setPaintProperty(id, "color-relief-opacity", opacity);
    } else {
      map.addLayer({
        id,
        type: "color-relief",
        source: DEM_SOURCE_ID,
        ...zoom,
        paint: {
          "color-relief-color": colorExpr,
          "color-relief-opacity": opacity,
        },
      } as never);
    }
    return;
  }

  // 以下三種都有 geojson source。⚠️ elevation 一定要在這之前 return：
  // 它的 data 是 null，走到這裡會建出一個空的 geojson source。
  const sourceId = geoSourceId(instanceId);
  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as GeoJSONSource).setData(data!);
  } else {
    map.addSource(sourceId, { type: "geojson", data: data! });
  }

  if (render.kind === "circle") {
    const id = `${instanceId}-points`;
    const baseRadius = render.radius ?? 6;
    const baseStroke = render.strokeWidth ?? 1.5;
    const baseOpacity = render.opacity ?? 0.85;
    const paint = {
      radius: whenSelected(highlightIds, (b) => ["*", b, SELECTED.radiusScale], baseRadius),
      stroke: whenSelected(highlightIds, () => SELECTED.strokeWidth, baseStroke),
      opacity: whenSelected(highlightIds, () => SELECTED.opacity, baseOpacity),
      // 級距上色的圖層（水庫蓄水率）用表達式取代單一色；`color` 仍然是圖層的
      // 身分色，圖例與抽屜色塊照樣用它。**選取狀態一樣不碰顏色**，見 whenSelected。
      color: (render.colorRamp ? rampExpression(render.colorRamp, color) : color) as string,
    };

    if (map.getLayer(id)) {
      // 顏色可能會變（特有種依勾選順序指派色票，取消勾選其中一個會讓後面的遞補），
      // 所以既有圖層要更新 paint，不能像舊版那樣只在不存在時才處理。
      // 選取狀態同理——換一筆選取不該把整個圖層拆掉重加。
      map.setPaintProperty(id, "circle-color", paint.color);
      map.setPaintProperty(id, "circle-radius", paint.radius);
      map.setPaintProperty(id, "circle-stroke-width", paint.stroke);
      map.setPaintProperty(id, "circle-opacity", paint.opacity);
    } else {
      map.addLayer({
        id,
        type: "circle",
        source: sourceId,
        ...zoom,
        paint: {
          "circle-radius": paint.radius,
          "circle-color": paint.color,
          // 大量點位（例如上千筆地震）要能把白框關掉，否則會糊成一片
          "circle-stroke-width": paint.stroke,
          "circle-stroke-color": "#fff",
          "circle-opacity": paint.opacity,
        },
      });
    }

    /**
     * 圓點旁邊的文字（目前只有颱風的中心定位點用，見 registry/types.ts）。
     *
     * ⚠️ `onlyWhenSelected` 時，**沒有任何圖徵被選取就把 `text-field` 設成空字串**，
     * 而不是把圖層拆掉——拆掉的話每次換選取都要重建 symbol 圖層，還得再排一次序。
     * 空字串是 maplibre 認得的「不畫任何字」，成本接近零。
     */
    if (render.label) {
      const labelId = `${instanceId}-label`;
      const field =
        typeof render.label.property === "string"
          ? ["get", render.label.property]
          : render.label.property;
      /**
       * ⚠️ 這裡跟 `whenSelected` 踩同一個坑：`property` 常常是一條依 zoom 切換的
       * `step`（颱風的定位點低縮放只標日期、放大才加時刻），把它整條包進 `case`
       * 會違反「zoom 只能在最外層」。所以一樣用 `mapZoomStops()` 把選取判斷推進
       * 每個 stop 的輸出裡。
       */
      const selectedOnly = (b: Expr) => [
        "case",
        ["in", ["get", "id"], ["literal", [...(highlightIds ?? [])]]],
        b,
        "",
      ];
      const textField = render.label.onlyWhenSelected
        ? highlightIds?.length
          ? mapZoomStops(field, selectedOnly) ?? selectedOnly(field)
          : ""
        : field;

      if (map.getLayer(labelId)) {
        map.setLayoutProperty(labelId, "text-field", textField as never);
        map.setPaintProperty(labelId, "text-color", color);
      } else {
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          ...zoom,
          layout: {
            "text-field": textField as never,
            // 只有 "Noto Sans Bold" 確定存在於借用的 glyph 端點上（見上面的線標註）
            "text-font": ["Noto Sans Bold"],
            "text-size": render.label.size ?? 10,
            // 標在圓點正上方，才不會蓋住它自己代表的那個點
            "text-offset": render.label.offset ?? [0, -1.1],
            // ⚠️ 不設 `text-allow-overlap`：定位點很密（近年颱風的警報期間是
            // 1 小時一筆），要讓 maplibre 的碰撞偵測自己把擠在一起的那些丟掉
            "text-padding": 2,
          },
          paint: {
            "text-color": color,
            "text-halo-color": "#fff",
            "text-halo-width": 1.4,
          },
        });
      }
    }
    return;
  }

  if (render.kind === "line") {
    const id = `${instanceId}-line`;
    const baseWidth = render.width ?? 1.4;
    const baseOpacity = render.opacity ?? 0.9;
    const lineWidth = whenSelected(highlightIds, (b) => ["*", b, SELECTED.lineScale], baseWidth);
    const lineOpacity = whenSelected(highlightIds, () => SELECTED.opacity, baseOpacity);

    /**
     * 白框（casing）：墊在線底下的一條白色粗線，把線從底圖裡拉出來。
     * 理由與實測值見 registry/types.ts 的 `LayerRender.casing`。
     *
     * ⚠️ **不加 `line-dasharray`**：虛線的白框要是也跟著斷，白色只會出現在
     * 有色線段的正下方，斷開處仍然直接壓在底圖上——那正是要解決的問題。
     * 連續的白框同時也讓虛線的「斷開處」讀得出來，比實心線更需要它。
     */
    if (render.casing) {
      const casingId = `${instanceId}-casing`;
      /**
       * ⚠️ `baseWidth` 本身可能是一條 zoom 曲線。直接寫 `["+", 曲線, 2.6]` 會把
       * zoom 塞進運算子裡面，違反 maplibre「zoom 只能是最外層 step／interpolate
       * 的輸入」——失敗的樣子是白框加不上去、線卻還在，只有 console 一行紅字
       * （見 CLAUDE.md 的「關鍵坑三」）。所以走 mapZoomStops 把加法推進每個輸出值。
       */
      const casingBase =
        typeof baseWidth === "number"
          ? baseWidth + CASING_EXTRA
          : ((mapZoomStops(baseWidth, (b) => ["+", b, CASING_EXTRA]) ?? [
              "+",
              baseWidth,
              CASING_EXTRA,
            ]) as typeof baseWidth);
      const casingWidth = whenSelected(
        highlightIds,
        (b) => ["*", b, SELECTED.lineScale],
        casingBase,
      );
      if (map.getLayer(casingId)) {
        map.setPaintProperty(casingId, "line-width", casingWidth);
      } else {
        map.addLayer({
          id: casingId,
          type: "line",
          source: sourceId,
          ...zoom,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": CASING_COLOR,
            "line-width": casingWidth,
            "line-opacity": CASING_OPACITY,
          },
        });
      }
    }

    if (map.getLayer(id)) {
      map.setPaintProperty(id, "line-color", color);
      map.setPaintProperty(id, "line-width", lineWidth);
      map.setPaintProperty(id, "line-opacity", lineOpacity);
    } else {
      map.addLayer({
        id,
        type: "line",
        source: sourceId,
        ...zoom,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": color,
          "line-width": lineWidth,
          "line-opacity": lineOpacity,
          ...(render.dash && { "line-dasharray": render.dash }),
        },
      });
    }

    if (render.label) {
      const labelId = `${instanceId}-label`;
      if (!map.getLayer(labelId)) {
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          ...zoom,
          layout: {
            "symbol-placement": "line",
            // 屬性名 → ["get", 名稱]；直接給表達式的話原樣採用（活動斷層依 zoom
            // 切換長短名，見註冊表）
            "text-field":
              typeof render.label.property === "string"
                ? ["get", render.label.property]
                : render.label.property,
            // 只有 "Noto Sans Bold" 確定存在於 basemaps.ts 借用的 OpenFreeMap
            // glyph 端點上。換成別的字型名稱會**靜默**畫不出任何標註。
            "text-font": ["Noto Sans Bold"],
            "text-size": render.label.size ?? 11,
            // 預設用等高線實測過的寬鬆組合：河川、洋流這類彎曲的線用 240/45
            // 會被放置演算法全數拒絕（實測世界主要河流標註數 = 0）。
            // 筆直又橫跨全球的線（緯度參考線）要自己調高 spacing。
            "symbol-spacing": render.label.spacing ?? 120,
            "text-max-angle": render.label.maxAngle ?? 60,
            "text-padding": 2,
          },
          paint: {
            "text-color": color,
            "text-halo-color": "#fff",
            "text-halo-width": 1.4,
          },
        });
      } else {
        map.setPaintProperty(labelId, "text-color", color);
      }
    }
    return;
  }

  // fill：面 + 獨立的外框線圖層
  const fillId = `${instanceId}-fill`;
  const baseFillOpacity = render.fillOpacity ?? 0.18;
  const fillOpacity = whenSelected(highlightIds, () => SELECTED.fillOpacity, baseFillOpacity);
  if (map.getLayer(fillId)) {
    map.setPaintProperty(fillId, "fill-color", color);
    map.setPaintProperty(fillId, "fill-opacity", fillOpacity);
  } else {
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      ...zoom,
      paint: {
        "fill-color": color,
        // 主題面疊在底圖地名之上，不透明會把地名整片蓋掉。上限 0.25。
        "fill-opacity": fillOpacity,
      },
    });
  }

  const outlineId = `${instanceId}-outline`;
  const baseOutline = render.outlineWidth ?? 1;
  const outlineWidth = whenSelected(
    highlightIds,
    (b) => ["*", b, SELECTED.outlineScale],
    baseOutline,
  );
  if (map.getLayer(outlineId)) {
    map.setPaintProperty(outlineId, "line-color", color);
    map.setPaintProperty(outlineId, "line-width", outlineWidth);
  } else {
    map.addLayer({
      id: outlineId,
      type: "line",
      source: sourceId,
      ...zoom,
      layout: { "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": outlineWidth,
        "line-opacity": 0.9,
      },
    });
  }
}

export function removeGeoLayer(map: MapLibreMap, instanceId: string, render: LayerRender) {
  for (const id of geoLayerIds(instanceId, render)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  // ⚠️ 高程設色掛的是 **hillshade 與 3D 地形共用的** raster-dem source，
  // 順手移除會讓那兩個一起消失。它沒有自己的 geojson source，什麼都不用清。
  if (render.kind === "elevation") return;
  const sourceId = geoSourceId(instanceId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

export function setGeoLayerVisible(
  map: MapLibreMap,
  instanceId: string,
  render: LayerRender,
  visible: boolean,
) {
  for (const id of geoLayerIds(instanceId, render)) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

/** 把任意陣列轉成點位 GeoJSON。 */
export function toFeatureCollection<T>(
  items: T[],
  getCoord: (item: T) => [number, number],
  getId: (item: T) => string,
  /** 可點清單與詳情卡 fallback 要用的欄位（name／meta／zoom…） */
  getProperties?: (item: T) => Record<string, unknown>,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: getCoord(item) },
      properties: { ...getProperties?.(item), id: getId(item) },
    })),
  };
}

/**
 * 幫**同一個 instance 的一組圖層**掛上點擊（回呼收到該圖徵的 `id` 屬性）與滑鼠
 * 游標樣式切換。回傳的 cleanup 要在圖層被移除或 effect 卸載時呼叫。
 *
 * ⚠️ `map.on(event, layerId, handler)` 的監聽是掛在 **Map 實例**上、不是掛在
 * 圖層上，所以 `setStyle()` 造成的圖層重建**不需要**重綁；重綁只會讓監聽無限累積。
 *
 * ## 為什麼收一組圖層而不是一個
 *
 * 有沿線標註的線圖層要把「線」與「標註」都綁起來（見 `geoHitLayerIds`），而這兩層
 * 在畫面上是**重疊**的——字就畫在線上。一層一組獨立監聽會壞掉兩件事，所以這裡
 * 統一管理：
 *
 * - **游標**：滑鼠從字移到線時，標註層的 `mouseleave` 會把游標重設掉，即使人還停在
 *   線上。所以用 `hovered` 集合記住「目前還停在哪幾層上」，全空了才還原游標。
 * - **點擊**：點在字的正中央會同時命中兩層，兩個 handler 都會收到**同一個**
 *   `click` 事件。用 `originalEvent` 的同一性擋掉第二次，避免同一下點擊觸發兩次
 *   選取（結果一樣，但會多一次算繪與一次抽屜收合）。
 *
 * ## 跨 instance 的命中仲裁（`competingLayerIds`）
 *
 * 上面那個 `originalEvent` 去重只在**同一組**圖層內有效。**不同 instance 之間**
 * 也會互相蓋到：山峰的圓點畫在縣市面之上，點主峰時兩層都命中，而 maplibre 的
 * `map.on(type, layerId, …)` 是依**監聽註冊順序**派送的——註冊順序只是「使用者
 * 先勾了哪個圖層」的意外結果。地形景點預設開啟、縣市界後來才勾，於是縣市的
 * handler 最後跑、它的 `setSelected` 蓋掉山峰的：**實測點玉山主峰會開出南投縣的
 * 卡片，五大山脈的主峰等於完全點不到。**
 *
 * 所以必須依**算繪順序**仲裁，見 `isTopmostHit`。
 */
/**
 * 這一下點擊該不該由 `layerIds` 這一組處理。
 *
 * 規則是「**小目標優先，其餘照算繪順序**」：
 *
 * 1. **命中的圓點優先。** 圓點半徑只有 6–7 px，沿線標註的命中範圍卻是整個文字方塊，
 *    面更是一整個縣。重疊時使用者瞄的一定是那顆點——線、標註與面在別的地方都還有
 *    一大片可以點，那顆點沒有別的地方可以點。實測「阿里山山脈」的標註剛好蓋住大塔山，
 *    純照算繪順序會讓那座山峰點不到（標註依設計就是畫在點之上，見 layerOrder.ts）。
 * 2. 否則取 `queryRenderedFeatures` 的第一筆，也就是**畫在最上面**的那一個。這符合
 *    使用者眼睛看到的堆疊關係，而且完全不受監聽註冊順序影響（見上面的說明）。
 *
 * ⚠️ `layers` 裡若混進已經被移除的圖層 id，maplibre 會報錯，所以先用 `getLayer`
 * 濾一次——切底圖的瞬間圖層是真的不存在的。
 */
function isTopmostHit(
  map: MapLibreMap,
  e: MapLayerMouseEvent,
  layerIds: string[],
  competing: string[],
): boolean {
  const layers = competing.filter((id) => map.getLayer(id));
  if (layers.length === 0) return true;

  const hits = map.queryRenderedFeatures(e.point, { layers });
  if (hits.length === 0) return true;

  const smallest = hits.find((f) => map.getLayer(f.layer.id)?.type === "circle");
  return layerIds.includes((smallest ?? hits[0]).layer.id);
}

export function bindGeoLayerInteractions(
  map: MapLibreMap,
  layerIds: string[],
  onClick: (id: string) => void,
  /** 目前所有可點主題圖層的 id（跨 instance）。每次點擊現查，不要快照。 */
  competingLayerIds: () => string[],
) {
  const hovered = new Set<string>();
  let handledEvent: unknown = null;
  const offs: (() => void)[] = [];

  for (const layerId of layerIds) {
    const handleClick = (e: MapLayerMouseEvent) => {
      if (e.originalEvent === handledEvent) return; // 同一下點擊已經被另一層處理過
      if (!isTopmostHit(map, e, layerIds, competingLayerIds())) return;
      const id = e.features?.[0]?.properties?.id;
      if (typeof id !== "string") return;
      handledEvent = e.originalEvent;
      onClick(id);
    };
    const setPointer = () => {
      hovered.add(layerId);
      map.getCanvas().style.cursor = "pointer";
    };
    const resetCursor = () => {
      hovered.delete(layerId);
      if (hovered.size === 0) map.getCanvas().style.cursor = "";
    };

    map.on("click", layerId, handleClick);
    map.on("mouseenter", layerId, setPointer);
    map.on("mouseleave", layerId, resetCursor);

    offs.push(() => {
      map.off("click", layerId, handleClick);
      map.off("mouseenter", layerId, setPointer);
      map.off("mouseleave", layerId, resetCursor);
      hovered.delete(layerId);
    });
  }

  return () => {
    for (const off of offs) off();
    map.getCanvas().style.cursor = "";
  };
}

/**
 * 取景時要忽略的離散小塊：面積小於同一個圖徵最大那一塊 1% 的 polygon。
 *
 * 為什麼需要這條規則：官方行政區界線是**忠實的**，高雄市含東沙島與南沙太平島、
 * 宜蘭縣含釣魚臺列嶼、金門縣含烏坵、基隆市含彭佳嶼。這些島在圖層可見的縮放範圍
 * 全都小於一個像素（畫面上幾乎看不到），卻會把 fitBounds 的外接矩形撐開——高雄市
 * 實測從 1.0° 變成 **13.1°**，點一下「高雄市」相機會飛到整個南海，高雄本身縮成
 * 角落一小塊。取景排除它們，**幾何本身完整保留**（那是課綱會提到的行政事實）。
 *
 * 用「相對於最大塊的比例」而不是絕對面積，才不會把本來就由許多小島組成的縣市
 * 拆掉：實測 1% 之下澎湖 21 島、連江 11 島、雲林外傘頂洲、臺東蘭嶼全數保留，
 * 而 2% 就會開始吃掉外傘頂洲與蘭嶼。只對 polygon 生效，線與點不受影響。
 */
const MIN_FRAMED_PART_RATIO = 0.01;

/** 環的面積（度²，shoelace）。只用於相對比較，不需要投影修正。 */
function ringArea(ring: GeoJSON.Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/** MultiPolygon 只留下值得取景的那幾塊；其他幾何原樣回傳。 */
function framedCoordinates(geometry: GeoJSON.Geometry): unknown {
  if (!("coordinates" in geometry)) return null;
  if (geometry.type !== "MultiPolygon") return geometry.coordinates;

  const areas = geometry.coordinates.map((polygon) => ringArea(polygon[0]));
  const largest = Math.max(...areas);
  return geometry.coordinates.filter((_, i) => areas[i] >= largest * MIN_FRAMED_PART_RATIO);
}

/** 整份 FeatureCollection 的外接矩形，給 fitBounds 用。空集合回 null。 */
export function bboxOf(
  data: GeoJSON.FeatureCollection,
): [[number, number], [number, number]] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords as [number, number];
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) visit(c);
  };

  for (const f of data.features) {
    if (f.geometry) visit(framedCoordinates(f.geometry));
  }

  return Number.isFinite(minLng)
    ? [
        [minLng, minLat],
        [maxLng, maxLat],
      ]
    : null;
}
