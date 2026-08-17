import type { DataDrivenPropertyValueSpecification, ExpressionSpecification } from "maplibre-gl";

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

/**
 * ⚠️ `elevation` 不要改叫 `relief`：`ColorRole` 已經有一個 `relief`，那是**山脈稜線的
 * 洋紅**，兩個 union 雖然不會撞型別，但讀起來會以為是同一件事。
 */
export type GeometryKind = "circle" | "line" | "fill" | "elevation";

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
  | "conservation"
  | "transport"
  | "population"
  | "fault"
  // 非分類的固定角色，不參與色票驗證（見 thematicColors.ts）
  | "reference"
  | "hazard"
  | "vegetation"
  | "plate"
  /**
   * ⚠️ `volcano` 是**有驗過**的，只是驗的對象不是 POINT 色票而是板塊邊界那三個
   * 線色——火山幾乎全部長在板塊邊界上，跨幾何豁免在那一層不成立。
   * 理由與量測值見 thematicColors.ts 的 `VOLCANO_COLOR`。
   */
  | "volcano";

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
  | { type: "derived"; derived: DerivedId }
  /**
   * 共用的 DEM（`layers/ids.ts` 的 `DEM_SOURCE_ID`），給 `kind: "elevation"` 用。
   *
   * ⚠️ 這是唯一一個**不會產生任何 feature** 的來源：`resolveLayerData()` 對它一律回
   * `null`，圖層直接掛在 hillshade 已經建好的 raster-dem source 上。所以
   * `useGeoLayers` 那道「`data` 是 null 就先不要加圖層」的守衛要放它過，而
   * `removeGeoLayer` **絕對不能**順手移除這個 source——它是 hillshade 與 3D 地形
   * 共用的，移掉會讓那兩個一起消失。
   */
  | { type: "dem" };

type NumberValue = DataDrivenPropertyValueSpecification<number>;

/**
 * 數值屬性 → 級距顏色。實例定義在 `../thematicColors.ts`（那裡有驗證紀錄）。
 *
 * `steps` 由小到大，最後一段的 `below` 是 `null`（開放上界）。
 */
export interface ColorRamp {
  property: string;
  steps: readonly { readonly below: number | null; readonly color: string; readonly label: string }[];
  /**
   * 沒有這個屬性的 feature（例如當天沒回報水情的水庫）。
   *
   * **只在真的會有缺值時才宣告**：它會在圖例上多畫一列。人口那一層 368 個鄉鎮
   * 每一個都有統計（沒有的兩筆在取得層就濾掉了、不會變成 feature），宣告它等於
   * 在圖例上放一個永遠不會出現的類別。省略時缺值的 feature 畫成圖層的身分色。
   */
  nodata?: { readonly color: string; readonly label: string };
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
      /**
       * 圓點旁邊的文字標註（另外開一個 `${instanceId}-label` symbol 圖層）。
       *
       * ⚠️ **`onlyWhenSelected` 幾乎一定要開。** 點圖層的圖徵數通常是三位數以上
       * （颱風的中心定位點有 757 個），全部標出來只會蓋滿畫面；而真正需要文字的
       * 時機是「使用者已經挑了一個圖徵、想讀出它的順序或數值」。沒有任何圖徵被
       * 選取時，`text-field` 會是空字串（圖層仍然存在，只是不畫任何字）。
       *
       * 目前只有颱風的中心定位點用：選了某個颱風之後，路徑上的圓點會標出臺灣
       * 時間的日期與時刻——那是「這條路徑往哪個方向走」唯一讀得出來的方式，
       * 尤其 1986 韋恩在同一張圖上來回三次。
       */
      label?: {
        /** 屬性名，或直接給一段 maplibre 表達式（比照 line 的 label） */
        property: string | ExpressionSpecification;
        size?: number;
        /** 文字相對於圓點的偏移，單位是 em（預設 `[0, -1.1]`，標在點的正上方） */
        offset?: [number, number];
        onlyWhenSelected?: boolean;
      };
    }
  | {
      kind: "line";
      /**
       * 在線底下再墊一條深色粗線（製圖上的 casing／halo），讓線不會沒入底圖。
       *
       * ⚠️ **這不是裝飾，是實測逼出來的。** 交通軸線的高鐵朱紅 `#ff7360` 疊在
       * NLSC 通用電子地圖上時，離底圖自己的公路色（淡粉紅 `#f8c0c0`／`#f8b8b8`）
       * 只有 **ΔE 14.0**，而其他六條軸線是 25–48——實測在全島 zoom 8 單獨開高鐵
       * 時**根本找不到那條線**。而暖色端已經被行政區橘（L 0.62）與斷層磚紅
       * （L 0.48）夾住兩個亮度層，掃過整個色域也找不到可用的紅／橘紅替代色。
       *
       * 描邊把線從底圖裡拉出來，與色相無關，所以高鐵得以維持「官方識別色」的語意。
       * 色票驗證器測不到這件事（它只比較色票內部與面板底色），**改動交通軸線的
       * 顏色之後一定要在 NLSC 底圖上重新目視確認**。
       *
       * ⚠️ 描邊色是**深色**不是白色：交通軸線走的西部平原在 NLSC 上本來就是白底，
       * 白色描邊等於沒加東西（實測中位數 ΔE 18.1 對深色的 29.4）。深色描邊的代價是
       * 會把線的顏色壓濁，所以用它的圖層要把線加粗——完整的量測與取捨見
       * `layers/geo.ts` 的 `CASING_COLOR`。
       */
      casing?: boolean;
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
      label?: {
        /**
         * 標註文字的來源屬性名。
         *
         * 也可以直接給一段 maplibre 表達式（純陣列字面值，`themes/*.ts` 因此仍然
         * 是純資料，Node 讀得動）。活動斷層用它依 zoom 切換長短名：
         * 遠看用短名才排得下，近看換回全名才不會跟底圖的地名混淆。
         */
        property: string | ExpressionSpecification;
        size?: number;
        spacing?: number;
        maxAngle?: number;
      };
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
      /**
       * 外框的不透明度，預設 0.9（面是半透明的，外框一向是實色的那條界線）。
       *
       * ⚠️ 會需要調低它的情境只有一個，但很重要：**用外框去補相鄰面之間的縫**。
       * 生物群系那一層的六類彼此相鄰，而幾何是上游逐一化簡出來的（不保拓樸），
       * 共用邊界因此對不齊，會在畫面上露出一條一條的白縫。畫一圈**跟面同色、
       * 同樣半透明**的外框剛好把縫蓋掉，而且不會像 0.9 那樣在 1,900 塊多邊形上
       * 織出一張線網（0.6 寬 × 0.9 不透明度實測就是那個樣子）。
       */
      outlineOpacity?: number;
      outlineColorRole?: ColorRole;
      /**
       * 面的名稱標註（另外開一個 `${instanceId}-label` symbol 圖層，
       * `symbol-placement: point`）。
       *
       * ⚠️ 跟線的標註**放置方式完全不同**：maplibre 對多邊形會自己算一個錨點
       * （每個 polygon 一個），所以不需要 `spacing`／`maxAngle`，也不需要在建置期
       * 算形心。代價是 **MultiPolygon 的每一塊都會拿到一個標註**——太平洋板塊在
       * ±180 被切成三塊，就會在畫面兩側各出現一次。那在世界地圖上是對的
       * （那塊板塊本來就橫跨圖幅兩端），但換資料前要先想過這件事。
       *
       * 目前只有板塊用：那一層的重點就是「哪一塊是什麼板塊」，沒有名字等於沒做。
       */
      label?: {
        /** 屬性名，或直接給一段 maplibre 表達式（比照 line／circle 的 label） */
        property: string | ExpressionSpecification;
        size?: number;
        /**
         * 低於這個 zoom 不畫標註。板塊名在 zoom 1 的全球視角會互相碰撞到只剩
         * 幾個，而那時使用者本來就還在看整體形狀。
         */
        minzoom?: number;
      };
    }
  | {
      /**
       * 依 DEM 高程直接設色的連續場（maplibre 的 `color-relief` 圖層）。
       *
       * 跟前三種**根本不同**：它沒有 geojson、沒有 feature、點不到也搜不到，
       * 顏色由每個像素的高程決定而不是由資料屬性決定。目前只有垂直植被帶用。
       *
       * 教學上它幾乎一定要配 3D 地形才看得出意義（平面上只是一片色塊），
       * 所以圖層要一起宣告 `requiresTerrain`。
       */
      kind: "elevation";
      /** 由低到高的分帶，最後一段的 `below` 是 null（開放上界）。 */
      bands: readonly {
        /** 對應 `items` 的子項目 id：勾了哪幾個就只畫哪幾帶 */
        readonly id: string;
        readonly below: number | null;
        readonly color: string;
        readonly label: string;
        readonly note: string;
      }[];
      /** 預設 0.45。太高會把底圖的地名與等高線一起蓋掉。 */
      opacity?: number;
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
  | {
      type: "geo";
      collection: string;
      fallbackNameProperty?: string;
      /**
       * 沒有內容檔時**不要**在卡片上印圖層說明。
       *
       * ⚠️ 預設是印的，那條路徑是刻意的：22 個縣市、92 條河川這種「還沒寫內容檔」的
       * 圖徵，卡片上唯一講得出東西的就是圖層說明。
       *
       * 只有在「圖徵很多、而且每一張卡上那段字逐字相同」時才設 true——目前只有
       * 活動斷層（33 條共用同一段說明，跟圖層抽屜那一列完全重複，卡片有大半高度在
       * 講「這個圖層是什麼」而不是「這條斷層是什麼」）。跟 `QuakeCard` 不吃
       * `fullDescription()` 是同一個判斷。
       *
       * 設了它就等於把圖層層級的話全部交給抽屜：說明在核取方塊下面，資料限制在
       * 圖層名稱旁邊那顆 ⚠️ 按鈕的小視窗裡。
       */
      hideLayerDescription?: boolean;
    }
  /**
   * 水庫。卡片的內容**全部來自 geojson 的 properties**（基本資料 + join 進來的
   * 即時水情），不是 `src/content/` 底下的手寫檔案——水情每小時都在變，寫成
   * 內容檔一定會過期。所以它不能走 `geo`，那條路徑找的是內容檔。
   */
  | { type: "reservoir" }
  /**
   * 古蹟。同樣**全部來自 geojson 的 properties**，理由跟水庫是同一類但不同因：
   * 1,064 處不可能逐一手寫內容檔，而每一處都該有一張講得出東西的卡片，
   * 不是 FeatureCard 的 fallback 空卡。官方的歷史沿革太大（全部 2 MB），
   * 另外按縣市分片、點開卡片才抓（見 components/MonumentCard.tsx）。
   */
  | { type: "monument" }
  /**
   * 鄉鎮市區。**三個圖層共用這一個型別**：鄉鎮市區界（面）、人口與都市體系（點）、
   * 主要作物分布（點）講的是同一個實體，所以它們的 featureId 都是官方 TOWNCODE，
   * 點哪一層都開同一張 `TownshipCard`（見 CLAUDE_TW.md「三層共用 id」）。
   *
   * ⚠️ **不能用 `geo` + 同一個 collection 代替**，那條路有兩個坑：
   * `DetailCard` 的 `findGeoOwner()` 只回傳 `theme.layers` 裡**第一個**符合的圖層，
   * 三層共用 collection 會讓人口卡與作物卡的署名全部變成「鄉鎮市區界」那一份，
   * 而且不會報錯；`FeatureCard` 的內容檔分支與 fallback 分支又是互斥的，哪天替
   * 某個鄉鎮寫了內容檔，人口與作物數字會整段消失。
   *
   * 卡片自己用 `resolveLayerData()` 把五份資料抓齊（跟圖層與搜尋索引共用快取），
   * 所以**沒勾人口或作物也看得到那些數字**。
   */
  | { type: "township" }
  /**
   * 單一次地震的震央。同樣**全部來自 geojson**（1,341 筆不可能逐一手寫內容檔）。
   *
   * ⚠️ 它跟水庫／古蹟／鄉鎮不同的是**卡片需要幾何**：震央的經緯度就是那個點本身，
   * 不在 properties 裡（存進去等於把座標寫兩份）。所以 `DetailCard` 的這個分支傳的是
   * **整個 feature**，不是只有 properties。
   */
  | { type: "quake" }
  | { type: "none" };

/** 為這個圖層列出可點清單（點了飛過去並開詳情卡），長在圖層抽屜裡（見 components/ThemeBrowse.tsx）。 */
export interface LayerBrowse {
  /** 清單主標取自 feature.properties 的哪個欄位，預設 "name" */
  primary?: string;
  /** 次標，預設 "meta" */
  secondary?: string;
  /** 點的圖層飛過去用的 zoom；線／面改用 fitBounds，會忽略這個值 */
  zoom?: number;
  /**
   * 依這個 properties 欄位把清單分組，每組前面加一個不可點的組名。
   *
   * 鄉鎮市區界（368 筆）用 `county`：一長串平鋪的鄉鎮名裡，縣市層級只出現在每一列
   * 的次標上，很難看出「這幾個是同一個縣市的」。分組之後縣市名只出現一次、底下的
   * 鄉鎮縮排，層級一眼就看得出來。
   *
   * ⚠️ **依序切、不排序**：feature 順序是資料集刻意排好的（見 build-geodata.mjs），
   * 這裡重排會毀掉它。所以同一個值必須在資料裡是**連續**的才會併成一組。
   */
  groupBy?: string;
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
  /**
   * 有宣告才會在母圖徵底下列出巢狀的可點清單（跟一般圖層的規則一致：沒有 `browse`
   * 就代表這些圖徵不是一份可以逐一點選的清單）。
   *
   * ⚠️ 颱風的中心定位點刻意**不宣告**：757 個沒有名字、`detail` 又是 `none` 的點
   * 灌進抽屜會把那一層的清單變成 771 列。
   */
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
  /** 子項目各自有一份資料（特有種、古蹟、作物）。與 `featureIds` 二擇一。 */
  source?: LayerSource;
  /**
   * 從**母圖層的 source** 切出屬於這個子項目的圖徵（交通軸線的七條）。
   * 與 `source` 二擇一，兩個都沒有的話 `expandActive` 會直接跳過這個子項目。
   *
   * ⚠️ **這是在 `resolve.ts` 切資料，不是下 maplibre 的 filter。** 全站唯一寫
   * `map.setFilter` 的地方是 `layers/geo.ts` 的 `applySoloFilter()`，「只顯示這一筆」
   * 整個功能靠它；子項目再下一道 filter 就得用 `["all", …]` 合併兩者，從此兩個功能
   * 互相糾纏。切資料則是 `geo.ts` 一行都不用改。
   *
   * ⚠️ 早期版本這裡宣告的是 `filter?: FilterSpecification`，**宣告了但全站零實作**
   * ——而 `expandActive` 對沒有 source 的子項目是靜默跳過的，所以寫了 filter 的圖層
   * 會什麼都不顯示也不報錯。改成 `featureIds` 同時解掉這件事：它是宣告式的、Node
   * 讀得懂，`validate-content.mjs` 因此能在建置期交叉檢查每個 id 真的存在於母圖層的
   * geojson（打錯一個字的後果是那個子項目從地圖上靜默消失）。
   */
  featureIds?: readonly string[];
  /**
   * 這個子項目的線型，覆蓋掉母圖層 `render.dash`。
   *
   * ⚠️ 交通軸線用它當**無障礙的第二通道**（軌道虛線／公路實線），不是裝飾：
   * 高鐵朱紅與國道綠橫跨紅綠軸，色盲下的 ΔE 必然低於門檻，見 thematicColors.ts
   * 的 `TRANSPORT_COLORS`。
   */
  dash?: [number, number];
  /**
   * 額外進搜尋 haystack 的字串。
   *
   * ⚠️ 靠 `featureIds` 切分的子項目**必須填**：那種圖層的圖徵不會被索引
   * （`items.indexFeatures` 是給有自己 source 的子項目用的），所以圖徵的
   * `shortName`／`name`／`meta` 一個都進不了搜尋。而 `shortName` 正是地圖上沿線
   * 印出來的字——「高鐵」不是子項目 label「臺灣高速鐵路」的子字串，少了它，
   * 使用者搜自己在畫面上看到的那兩個字會什麼都搜不到。
   */
  keywords?: readonly string[];
  /**
   * 固定顏色，覆蓋掉「依勾選順序從 `items.palette` 指派」的預設行為。
   *
   * ⚠️ 只有**子項目之間有序位**的圖層才該用它。特有種沒有序位（三個物種誰先誰後
   * 都無所謂），依勾選順序給色是對的；古蹟三級有序位（國定 > 直轄市定 > 縣市定），
   * 先勾哪一級都必須是同一個顏色，否則「顏色越深＝級別越高」這個圖例當場失效。
   */
  color?: string;
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
  /**
   * 把子項目的**圖徵**也建進搜尋索引，而不是只索引子項目本身。
   *
   * ⚠️ **必須明確開啟，不能預設 true。** 索引圖徵代表建索引時就要把每個子項目的
   * geojson 抓下來——特有種那五份觀測點合計 262 KB，而它們的 properties 只有日期
   * 與紀錄類型、**沒有名字**，抓下來也產不出任何搜尋結果。搜尋索引是 lazy 的
   * （見 search/searchIndex.ts 的檔頭），預設展開等於讓每個學生白付那 262 KB。
   *
   * 古蹟要開，因為它的 1,064 個圖徵全部有名字，而 items 圖層又沒有可點清單
   * （ThemeMapPage 的 `!l.items`），搜尋是這一層唯一的檢索入口。
   */
  indexFeatures?: boolean;
  /**
   * 勾選母圖層時**自動把所有子項目一起勾起來**（目前只有垂直植被帶）。
   *
   * 一般的子項目圖層（特有種、古蹟、作物）預設全不勾是對的：那些子項目各自要抓
   * 一份資料，一次全開既慢又看不清楚。植被帶相反——六帶是同一張圖的六個區段，
   * 勾了圖層卻什麼都不顯示只會讓人以為壞了，而且它們共用同一個 DEM，全開不多花
   * 任何成本。取消勾選單一帶才是「只看某一種植被」那個用法。
   */
  defaultAll?: boolean;
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
  /**
   * 資料限制與容易讀錯的地方（收錄範圍、目錄完整度、量測基準…）。
   *
   * 每一則**必須以 `⚠️ ` 開頭**（驗證器會擋），而 `description` 裡**不可以**再出現
   * ⚠️——圖層抽屜靠這件事把兩者分開：說明留在核取方塊下面，注意事項收進圖層名稱
   * 旁邊那顆 ⚠️ 按鈕開出來的小視窗。抽屜要能一路捲到底找圖層，長篇警語擋在路上
   * 會讓那件事變得很難做。
   *
   * ⚠️ **收進小視窗不等於可以省略。** 這些警語是內容誠信的承諾（比照 GBIF 觀測點
   * 與 ERA5 氣候值的既有做法），詳情卡的 fallback 仍然把它們接在說明後面一起顯示，
   * 見 `DetailCard` 的 `fullDescription()`。
   */
  notes?: string[];
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
  /**
   * 勾選這個圖層時**自動打開 3D 地形**。
   *
   * 目前只有垂直植被帶用：它在正射俯視下只是一片色塊，要斜角看才看得出「顏色隨
   * 高度分帶」這件事——而那正是整層要教的東西。
   *
   * ⚠️ 這是本站唯一一個「勾圖層會動到 ChromeState」的旗標，刻意做成宣告式的，
   * 不要在 `ThemeMapPage` 裡寫死圖層 id。取消勾選時**不會**把 3D 關回去：那時
   * 使用者可能已經自己在用 3D 看別的東西了，替他關掉比替他打開更冒犯。
   */
  requiresTerrain?: boolean;
}

/**
 * `planned` 不需要資料，也還不需要顏色。
 * 用 union 在型別層面就擋掉寫錯的組合，不必等到執行期才發現。
 *
 * ⚠️ **`items` 變體的 `source` 是選填的，那兩者不再互斥。** 子項目有兩種切法：
 * 各自一份資料（特有種、古蹟、作物 → 子項目自己的 `source`），或從母圖層那一份
 * 切出來（交通軸線 → 母圖層 `source` ＋ 子項目的 `featureIds`）。後者的母圖層
 * 仍然**沒有** `colorRole`：顏色在子項目身上，母圖層那一個色塊解釋不了畫面。
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
      /** 子項目靠 `featureIds` 從母圖層切分時才需要；各自有資料的圖層不填 */
      source?: LayerSource;
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
  // 蓋滿全島的高程設色，兩層疊起來沒有任何意義（後畫的整片蓋掉先畫的）
  elevation: 1,
};
