import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { geoLayerIds, geoSourceId } from "../registry/index.ts";
import type { LayerRender } from "../registry/types.ts";

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
  data: GeoJSON.FeatureCollection;
  color: string;
  render: LayerRender;
  minzoom?: number;
  maxzoom?: number;
  /**
   * 要強調的圖徵 `properties.id`。通常只有一筆（目前選取的），但選到山脈時會連
   * 它的主峰一起帶進來——主峰是另一個圖層的點，兩層各自比對這份清單即可。
   */
  highlightIds?: readonly string[];
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
 * `base` 可能本身就是表達式（地震用震級驅動半徑），所以倍率用 `["*", base, n]`
 * 而不是先算成數字。
 */
type Expr = unknown;
const whenSelected = <T>(ids: readonly string[] | undefined, selected: Expr, base: T): T =>
  (ids?.length
    ? ["case", ["in", ["get", "id"], ["literal", [...ids]]], selected, base]
    : base) as T;

/** 選取狀態的倍率／固定值，集中在這裡方便一起調整。 */
const SELECTED = {
  radiusScale: 2,
  strokeWidth: 3,
  opacity: 1,
  lineScale: 2.2,
  outlineScale: 2.5,
  /** 面本來就半透明，選取時加深但仍要看得到底圖地名 */
  fillOpacity: 0.38,
} as const;

export function addGeoLayer(map: MapLibreMap, spec: GeoLayerSpec) {
  const { instanceId, data, color, render, minzoom, maxzoom, highlightIds } = spec;
  const sourceId = geoSourceId(instanceId);

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as GeoJSONSource).setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }

  const zoom = { ...(minzoom != null && { minzoom }), ...(maxzoom != null && { maxzoom }) };

  if (render.kind === "circle") {
    const id = `${instanceId}-points`;
    const baseRadius = render.radius ?? 6;
    const baseStroke = render.strokeWidth ?? 1.5;
    const baseOpacity = render.opacity ?? 0.85;
    const paint = {
      radius: whenSelected(highlightIds, ["*", baseRadius, SELECTED.radiusScale], baseRadius),
      stroke: whenSelected(highlightIds, SELECTED.strokeWidth, baseStroke),
      opacity: whenSelected(highlightIds, SELECTED.opacity, baseOpacity),
    };

    if (map.getLayer(id)) {
      // 顏色可能會變（特有種依勾選順序指派色票，取消勾選其中一個會讓後面的遞補），
      // 所以既有圖層要更新 paint，不能像舊版那樣只在不存在時才處理。
      // 選取狀態同理——換一筆選取不該把整個圖層拆掉重加。
      map.setPaintProperty(id, "circle-color", color);
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
          "circle-color": color,
          // 大量點位（例如上千筆地震）要能把白框關掉，否則會糊成一片
          "circle-stroke-width": paint.stroke,
          "circle-stroke-color": "#fff",
          "circle-opacity": paint.opacity,
        },
      });
    }
    return;
  }

  if (render.kind === "line") {
    const id = `${instanceId}-line`;
    const baseWidth = render.width ?? 1.4;
    const baseOpacity = render.opacity ?? 0.9;
    const lineWidth = whenSelected(highlightIds, ["*", baseWidth, SELECTED.lineScale], baseWidth);
    const lineOpacity = whenSelected(highlightIds, SELECTED.opacity, baseOpacity);

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
            "text-field": ["get", render.label.property],
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
  const fillOpacity = whenSelected(highlightIds, SELECTED.fillOpacity, baseFillOpacity);
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
    ["*", baseOutline, SELECTED.outlineScale],
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
 */
export function bindGeoLayerInteractions(
  map: MapLibreMap,
  layerIds: string[],
  onClick: (id: string) => void,
) {
  const hovered = new Set<string>();
  let handledEvent: unknown = null;
  const offs: (() => void)[] = [];

  for (const layerId of layerIds) {
    const handleClick = (e: MapLayerMouseEvent) => {
      if (e.originalEvent === handledEvent) return; // 同一下點擊已經被另一層處理過
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
