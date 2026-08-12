import type { DataDrivenPropertyValueSpecification, FilterSpecification } from "maplibre-gl";

/**
 * 主題圖層註冊表的型別定義。
 *
 * ## 為什麼註冊表必須是「純資料」
 *
 * `scripts/validate-content.mjs` 靠 Node 24 的 type stripping 直接 import
 * `src/lib/schema.ts`（見 CLAUDE.md）。同一招可以讓它 import `registry/index.ts`，
 * 在建置期就抓到「圖層宣告了 `data/geo/x.geojson`、但那個檔案不存在」。
 *
 * 這件事值得為它扭曲型別設計，因為那個失敗模式在執行期是**完全靜默**的：
 * fetch 404 → `resolveLayerData()` 回 null → 圖層永遠不出現 → console 什麼都沒有。
 * 跟 maplibre worker 檔案沒被複製是同一類的坑，而且是在上課上到一半才會發現。
 *
 * 所以規則是：
 *
 * > `registry/themes/*.ts` 只能 `import type` 這個檔案，以及 value-import
 * > `../thematicColors`（一個沒有任何 import 的常數模組）。
 * > 不准放 closure、不准 `import.meta.glob`、不准 value-import maplibre。
 *
 * 資料來源因此一律寫成**標籤**（`LayerSource`、`LayerItemsSource`），
 * 由 `registry/resolve.ts` 在瀏覽器端解析成實際資料。這是這裡最重要的一個決定。
 */

export type GeometryKind = "circle" | "line" | "fill";

/**
 * 語意色角色。元件永遠透過角色取色，不直接寫 hex。
 *
 * 這個 union 只列出**已經用 dataviz skill 的 validate_palette.js 驗證過**的角色。
 * 要新增角色就要先跑驗證器（見 CLAUDE.md 硬性禁止事項 #10 與 thematicColors.ts
 * 的說明），不要為了讓型別過就先加一個名字進來。
 */
export type ColorRole =
  // 分類色（各自組內 all-pairs 驗證過）
  | "place"
  | "indigenous"
  | "boundary"
  | "hydrology"
  | "relief"
  | "transport"
  // 非分類的固定角色，不參與色票驗證（見 thematicColors.ts）
  | "reference"
  | "hazard";

/** `src/content` 底下用 import.meta.glob 載入、已經打包進 bundle 的內容集合。 */
export type BundledContentId =
  | "places-taiwan"
  | "places-world"
  | "indigenous";

/** 完全由程式產生的幾何，不需要任何檔案。 */
export type GeneratorId = "latitude-lines";

/**
 * 由**兩份既有資料 join 出來**的幾何，本身沒有檔案。
 *
 * `tw-range-peaks`＝五大山脈的主峰點：座標取自 `src/content/places`，
 * 「哪座山峰屬於哪條山脈」取自 `tw-ranges.geojson` 的 `peakId`。
 * 兩邊都是既有的單一事實來源，join 出來就不必把座標或對應關係抄第二份
 * ——抄第二份遲早會跟母資料漂開。
 */
export type DerivedId =
  | "tw-range-peaks"
  /**
   * 水庫＝**靜態幾何 + 即時水情**兩份資料 join 起來。
   *
   * `data/geo/tw-reservoirs.geojson` 一年才變一次（位置、容量、壩高），
   * `data/reservoirs-live.json` 每次部署重抓（蓄水量、水位、進出流量）。
   * 分成兩個檔案是刻意的：把會變的那一半混進 geojson，等於每小時都要重新
   * commit 一份 20 KB 的幾何。兩份都以**本站的水庫 id** 為 key（`zengwen`…），
   * 由 `scripts/lib/reservoirs.mjs` 的 `RESERVOIR_IDS` 對照表統一決定。
   */
  | "tw-reservoirs";

/**
 * 圖層的資料來源。
 *
 * `remote` 的 path 相對於 `import.meta.env.BASE_URL`：
 *   - `data/geo/*`        → `scripts/build-geodata.mjs` 產生，不得手動編輯
 *   - `data/geo-manual/*` → 手繪的教學示意幾何，可以手動編輯
 *   - `data/species/*`    → `scripts/build-species.mjs` 產生
 */
export type LayerSource =
  | { type: "bundled"; content: BundledContentId }
  | { type: "generated"; generator: GeneratorId }
  | { type: "remote"; path: string }
  | { type: "derived"; derived: DerivedId };

type NumberValue = DataDrivenPropertyValueSpecification<number>;

/**
 * 數值屬性 → 級距顏色。實例定義在 `../thematicColors.ts`（那裡有驗證紀錄）。
 *
 * `steps` 由小到大，最後一段的 `below` 是 `null`（開放上界）。
 */
export interface ColorRamp {
  property: string;
  steps: readonly { readonly below: number | null; readonly color: string; readonly label: string }[];
  /** 沒有這個屬性的 feature（例如當天沒回報水情的水庫） */
  nodata: { readonly color: string; readonly label: string };
}

/**
 * 幾何種類與該種類的算繪參數。
 *
 * 所有預設值都刻意設成「維持既有三個圓點圖層的外觀完全不變」——
 * circle 的 6 / 1.5 / 0.85 是從舊的 `layers/points.ts` 逐字搬過來的。
 */
export type LayerRender =
  | {
      kind: "circle";
      /** 預設 6。可用 maplibre 表達式（例如地震用震級驅動半徑） */
      radius?: NumberValue;
      /** 預設 1.5。設 0 可關掉白色外框——大量點位時外框會糊成一片 */
      strokeWidth?: NumberValue;
      /** 預設 0.85 */
      opacity?: number;
      /**
       * 依 feature 的某個數值屬性分級上色，取代圖層的單一 `colorRole` 顏色。
       *
       * ⚠️ 這是**例外**，不是通則。一般圖層的顏色代表圖層身分（見 layers/geo.ts
       * 開頭的說明），只有「圖層本身就是為了呈現某個量」的時候才用得上——目前
       * 只有水庫蓄水率。色階必須是通過 `validate_palette.js --ordinal` 的單一
       * 色相 ramp，定義寫在 thematicColors.ts，這裡只放引用。
       *
       * 沒有這個屬性的 feature 畫成 `nodata.color`（資料缺漏 ≠ 數值很低）。
       */
      colorRamp?: ColorRamp;
    }
  | {
      kind: "line";
      /** 預設 1.4 */
      width?: NumberValue;
      dash?: [number, number];
      /** 預設 0.9 */
      opacity?: number;
      /**
       * 沿線標註。
       *
       * ⚠️ 實測教訓（跟 CLAUDE.md 等高線標註那節同一個坑）：**線越彎、字串越長，
       * 放置演算法就越容易靜默拒絕，標註數直接變 0**，而且不會有任何錯誤訊息。
       *
       * 預設值用等高線驗證過的寬鬆組合（spacing 120 / maxAngle 60），因為多數
       * 地理線（河川、洋流、山脈）都很彎。緯度參考線那種筆直又橫跨整個地球的線
       * 反而要**調高** spacing，否則同一條線上會重複出現一堆標註。
       *
       * 改動之後一定要用 queryRenderedFeatures 實測放置數量，不要只靠肉眼看。
       */
      label?: { property: string; size?: number; spacing?: number; maxAngle?: number };
    }
  | {
      kind: "fill";
      /**
       * 預設 0.18，**上限 0.25**。主題面會疊在底圖的地名 symbol 之上
       * （見 layerOrder.ts 的排序表），不透明的面會把地名整片蓋掉。
       */
      fillOpacity?: number;
      /**
       * maplibre 的 `fill-outline-color` 只能畫 1px 髮絲線、線寬不可調，
       * 所以外框一定要在同一個 source 上另外開一個 line 圖層。
       * 這就是「一個 LayerDefinition 可能對應多個 maplibre 圖層」的來源。
       */
      outlineWidth?: number;
      outlineColorRole?: ColorRole;
    };

/** 點擊圖徵之後開哪一種詳情卡。 */
export type DetailSpec =
  | { type: "place" }
  | { type: "indigenous" }
  | { type: "species" }
  /**
   * 泛用地理要素。featureId 對到 `src/content/geo/<collection>/<id>.json`；
   * 找不到內容檔時 FeatureCard 會退回顯示 geojson 的 name 屬性 + 圖層自己的
   * description/sources——22 個縣市不必每個都先寫好內容檔才能上線。
   */
  | { type: "geo"; collection: string; fallbackNameProperty?: string }
  /**
   * 水庫。卡片的內容**全部來自 geojson 的 properties**（基本資料 + join 進來的
   * 即時水情），不是 `src/content/` 底下的手寫檔案——水情每小時都在變，寫成
   * 內容檔一定會過期。所以它不能走 `geo`，那條路徑找的是內容檔。
   */
  | { type: "reservoir" }
  | { type: "none" };

/** 為這個圖層列出可點清單（點了飛過去並開詳情卡），長在圖層抽屜裡（見 components/ThemeBrowse.tsx）。 */
export interface LayerBrowse {
  /** 清單主標取自 feature.properties 的哪個欄位，預設 "name" */
  primary?: string;
  /** 次標，預設 "meta" */
  secondary?: string;
  /** 點的圖層飛過去用的 zoom；線／面改用 fitBounds，會忽略這個值 */
  zoom?: number;
}

/**
 * 附屬圖層：**沒有自己的核取方塊**，跟著母圖層一起開關、一起移除。
 *
 * 跟 `items` 不一樣，不要混淆：`items` 是「一個勾選項展開成 N 個**平行的**子圖層」
 * （特有種，各自有色票與 `maxActive` 上限）；`attach` 是「這個圖層還有一種**不同
 * 幾何**的附屬圖徵」——五大山脈的稜線是線，主峰是點，一條線配一顆點。
 *
 * 為什麼不是兩個獨立圖層：主峰離開稜線就沒有意義，分成兩個核取方塊會讓人勾了
 * 山脈卻看不到最高點在哪（那正是當初加 `peakId` 連動強調的理由）。也不是把點塞進
 * `tw-ranges.geojson` 混合幾何：`LayerRender` 一個圖層只能一種幾何，而且主峰的詳情卡
 * 是 `PlaceCard`（有海拔與氣候圖表），跟山脈的 `FeatureCard` 不同，`detail` 必須分開。
 *
 * `parentProperty` 指的是**附屬圖徵**身上那個指回母圖徵 id 的屬性；清單巢狀與
 * 「選子類等於也選父類」的連動強調都靠它。
 */
export interface LayerAttachment {
  /** maplibre id 前綴，全站唯一（驗證器會連同一般圖層一起檢查撞名） */
  id: string;
  label: string;
  source: LayerSource;
  render: LayerRender;
  colorRole: ColorRole;
  detail: DetailSpec;
  parentProperty: string;
  browse?: LayerBrowse;
  /**
   * ⚠️ 縮放範圍**不會**從母圖層繼承，附屬圖層要自己宣告。
   *
   * 母圖層的 min/maxzoom 講的是**母圖層那份幾何**的限制，跟附屬圖徵無關。縣市界的
   * `maxzoom: 11` 是因為相鄰的面各自簡化會開出次像素縫隙——那條理由對「政府大樓的
   * 一個點」完全不成立，繼承下來只會讓點在 zoom 11 以上憑空消失。
   *
   * 這裡踩過：政府點繼承了 maxzoom 11，而清單的 `browse.zoom` 是 14，於是點一下
   * 縣市政府就飛到一片**完全空白**的畫面（政府點與縣市面同時都在 maxzoom 之外），
   * 而詳情卡、相機、paint 表達式全都正常——只驗 `getPaintProperty` 是抓不到的，
   * 一定要在**飛完之後**用 `queryRenderedFeatures` 數實際算繪的數量。
   * 驗證器現在會擋住 `browse.zoom` 落在圖層畫不出來的範圍這件事。
   */
  minzoom?: number;
  maxzoom?: number;
  /** 沒填就沿用母圖層的——同一個勾選項底下的東西，說明與來源多半一致 */
  description?: string;
  sources?: string[];
}

export interface LayerItem {
  id: string;
  label: string;
  /** 子項目各自有一份資料（特有種）；沒填就用母圖層的 source 加 filter 切分 */
  source?: LayerSource;
  filter?: FilterSpecification;
}

/**
 * 子項目清單的來源。
 *
 * `content` 是刻意的：特有種清單來自 `src/content/species/*.json` 的 glob，
 * 寫成標籤之後「新增一個物種 JSON 就會自動出現在 UI」這件事才成立——
 * 把 5 個物種硬編在註冊表裡會退化成「加資料還要同時改註冊表」，
 * 正好違背整個註冊表的目的。
 */
export type LayerItemsSource =
  | { type: "content"; collection: "species" }
  | { type: "inline"; list: LayerItem[] };

/**
 * 「一個勾選項展開成 N 個子圖層」的第一級概念。
 *
 * 目前只有特有種用到，但這是可預期會重複的形狀（洋流的暖流／寒流、
 * 農業物產依作物分類都是同一件事）。刻意只做**一層、有上限、有色票**，
 * 不做任意巢狀——巢狀是投機設計，這裡不需要。
 */
export interface LayerItems {
  from: LayerItemsSource;
  /** 同時可勾選的上限。色票用完 UI 就要 disable 其餘核取方塊 */
  maxActive: number;
  /** 依勾選順序指派的顏色，必須通過 validate_palette.js --pairs all */
  palette: readonly string[];
}

interface LayerBase {
  /**
   * kebab-case，全站唯一。同時是 maplibre id 的前綴：
   *   source = `${id}-source`
   *   circle → `${id}-points`
   *   line   → `${id}-line`（有 label 時再加 `${id}-label`）
   *   fill   → `${id}-fill` + `${id}-outline`
   *
   * `-points` 後綴是刻意沿用的，讓 `places-points`／`indigenous-points`／
   * `species-<id>-points` 這三組既有 id 一個字元都不變——CLAUDE.md 的驗證指令
   * 直接寫死了這些字串，保住它們就等於保住既有的回歸測試。
   */
  id: string;
  label: string;
  /** 圖層抽屜裡的分組標題，必須出現在所屬 ThemeDefinition 的 `groups` 裡 */
  group: string;
  render: LayerRender;
  detail: DetailSpec;
  /**
   * 核取方塊下方的一行說明。
   * **`planned` 的圖層也必填**——一個停用又沒有文字的核取方塊什麼都沒教到，
   * 那就失去把未完成圖層列出來的意義了。
   */
  description: string;
  /** 對應 `src/content/sourceLinks.ts` 的 key；對不到就顯示純文字 */
  sources: string[];
  minzoom?: number;
  maxzoom?: number;
  defaultOn?: boolean;
  browse?: LayerBrowse;
  /**
   * 這是簡化的教學示意幾何（洋流、氣候帶、風系），不是精確測繪資料。
   * 比照 GBIF 觀測點與 ERA5 氣候值的既有做法，UI 必須顯示警語，
   * 不得暗示精確性。這是內容誠信的承諾，不是裝飾用的旗標。
   */
  schematic?: boolean;
}

/**
 * `source` 與 `items` 互斥；`planned` 兩者都不需要，也還不需要顏色。
 * 用 union 在型別層面就擋掉寫錯的組合，不必等到執行期才發現。
 */
export type LayerDefinition =
  | (LayerBase & {
      status: "planned";
      colorRole?: ColorRole;
      source?: never;
      items?: never;
      attach?: never;
    })
  | (LayerBase & {
      status: "ready";
      colorRole: ColorRole;
      source: LayerSource;
      items?: never;
      /** 跟著這個圖層一起開關的附屬圖徵（五大山脈 → 主峰） */
      attach?: LayerAttachment;
    })
  | (LayerBase & {
      status: "ready";
      /** items 有自己的 palette，母圖層不需要 colorRole */
      colorRole?: never;
      source?: never;
      /** items 與 attach 是兩種不同的展開方式，不同時使用（見 LayerAttachment） */
      attach?: never;
      items: LayerItems;
    });

export interface ThemeDefinition {
  /** 路由 `/theme/:themeId` */
  id: string;
  label: string;
  /** 圖層抽屜標題底下的一行說明 */
  subtitle: string;
  camera: { center: [number, number]; zoom: number };
  /**
   * 建議底圖。進入這個主題、且使用者在本次瀏覽還沒手動選過這個主題的底圖時，
   * 會自動套用（見 `App.tsx` 的 effect）；圖層抽屜也會顯示同一個值當提示。
   * 使用者手動切換底圖後，該選擇只在同一主題內被記住、不會被這個預設值蓋掉；
   * 切到別的主題不受影響（NLSC 只涵蓋臺灣，不能整站共用同一個底圖狀態）。
   */
  recommendedBasemap?: "liberty" | "nlsc-emap" | "nlsc-photo";
  /** 圖層抽屜裡分組的顯示順序 */
  groups: string[];
  /** 進入主題時預設打開的詳情卡；不填就顯示「點地圖或清單」的提示 */
  initialSelection?: { detail: DetailSpec; featureId: string };
  layers: LayerDefinition[];
}

/**
 * 每種幾何同時可開啟的圖層數上限（＝該種類色票的長度）。
 *
 * 這是「三組獨立色票」策略的執行面：形狀本身就在區辨（18% 透明度的面染跟
 * 6px 圓點是不同的視覺通道），所以只需要**組內** all-pairs 驗證，
 * 不需要跨幾何驗證。封頂則讓每組色票的需求維持在可解的範圍。
 * 超過 4 個同時顯示的分類色本來就讀不動，這個上限順便也是 UX 改善。
 */
export const MAX_ACTIVE_BY_KIND: Record<GeometryKind, number> = {
  circle: 4,
  line: 3,
  fill: 2,
};
