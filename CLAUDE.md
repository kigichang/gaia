# Gaia — 地理課程互動地圖

## 專案定位

把國小／國中／高中的地理課程內容整理到一張帶等高線的地圖上，**以主題而不是年級來組織**，並提供「**比較同緯度、不同地區**」的互動工具。

目前三個主題：臺灣地理、世界地理、全球地理形貌（各主題底下的圖層見「主題地圖頁與圖層註冊表」）。

**部署**：GitHub Pages（repo `kigichang/gaia`），自訂網域 `https://gaia.kigi.tw`。

**最重要的架構約束**：整站必須是**純靜態、無後端、無 API key**。沒有伺服器可以代理請求或藏金鑰，任何需要簽章或私密憑證的服務都不能用。所有技術選擇都從這條約束推導。

---

## 技術棧（版本已鎖定，不要用 `latest` 或 `^`）

| 套件 | 版本 | 說明 |
|---|---|---|
| `maplibre-gl` | `6.2.0` | 地圖引擎。開源、免金鑰、WebGL 向量圖磚 |
| `maplibre-contour` | `0.1.0` | 瀏覽器端即時從 DEM 圖磚算等高線 |
| `react` / `react-dom` | `19.2.8` | |
| `react-router-dom` | `7.18.2` | `BrowserRouter` + build 後複製 404.html |
| `recharts` | `3.10.1` | 氣溫雨量圖 |
| `zod` | `4.4.3` | **只在建置期**驗證內容，不打包進前端 |
| `vite` | `8.2.1` | Rolldown 版本 |
| `typescript` | `5.9.3` | |

Node ≥ 22.12（vite 8 要求）。開發機與 CI 都用 Node 24。

### 已知的版本陷阱

- **`maplibre-gl` v6 起移除了 default export**。必須寫 `import * as maplibregl from "maplibre-gl"`，`import maplibregl from ...` 會編譯失敗。
- **v6 把 `preserveDrawingBuffer` 移進 `canvasContextAttributes`**。寫在 `MapOptions` 頂層會被靜默忽略（只有 `tsc` 會抓到），執行期不報錯。
- **Vite 的 dep 預打包會弄壞 maplibre-gl 的 worker**：`maplibre-gl-worker.mjs` 永遠 pending，結果是 dev 模式下地圖**一張圖磚都不載入而且完全不報錯**。`vite.config.ts` 的 `optimizeDeps.exclude: ["maplibre-gl"]` 必須保留。
- **Vite 8（Rolldown）不再支援 `manualChunks` 物件形式**，改用 `build.rollupOptions.output.codeSplitting.groups`。
- **production build 也有一個對應的 worker 問題，而且比 dev 那個更隱蔽**：maplibre-gl 內部用 `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 動態組出 worker 檔案路徑，預期這個檔案跟自己所在的 chunk 放在同一目錄。Vite/Rolldown 的 worker 靜態分析只認得原始碼裡字面寫出的 `new Worker(new URL(...))`，maplibre-gl 這段是在已經打包好的程式碼裡動態組字串，建置工具看不懂，所以 `maplibre-gl-worker.mjs`（以及它自己又用靜態 import 引入的 `maplibre-gl-shared.mjs`）**不會被自動複製進 `dist/`**。

  後果只在**向量類型底圖**（例如 OpenFreeMap Liberty）出現：raster 圖磚（NLSC）與 maplibre-contour 的等高線／地形（用自己內嵌的 Blob URL worker）都不受影響，因為它們不需要 maplibre-gl 自己的 tile-parsing worker。切到向量底圖後，worker 檔案 404，vector 來源永遠 `isSourceLoaded() === false`，**畫面停在 style 的 background 圖層顏色、不會拋出任何 map error 事件**——在純靜態站上是很難聯想到「worker 檔案沒被複製」的一種空白畫面。

  修法是 `vite.config.ts` 裡的 `copyMaplibreWorkerPlugin`，在 `closeBundle` 時把這兩個檔案從 `node_modules/maplibre-gl/dist/` 複製到 `dist/assets/`。**兩個檔案缺一不可**——只複製 worker 檔案，worker 腳本自己的 `import ... from "./maplibre-gl-shared.mjs"` 還是會失敗。升級 maplibre-gl 大版本後要重新確認這兩個檔名還存在、`closeBundle` 有把它們複製出來（`ls dist/assets | grep maplibre-gl-`），並且**必須實測切到向量底圖**——只做建置成功和 typecheck 過是抓不到這個問題的，一定要在瀏覽器裡用 `queryRenderedFeatures()` 或 `isSourceLoaded()` 驗證向量圖磚真的有渲染。
- `maplibre-contour` 最後發佈於 2024-12，未宣告 peer dependency。已實測與 maplibre-gl 6.2.0 相容（`AddProtocolAction` 簽章未變）。**升級 maplibre-gl 大版本前必須重驗等高線**。

---

## 資料源

**會被程式抓取的**端點全部免金鑰、支援 CORS、已實測可從瀏覽器直接存取；端點常數集中在 `src/config.ts`，不要在別處寫死。表格最後一列的維基百科是例外——它從來不被程式碰到，是人工查閱後把結論寫進內容檔的參考來源，列在這裡是為了讓「這筆數字哪來的」有地方追。

| 用途 | 端點 | 備註 |
|---|---|---|
| 全球 DEM | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | AWS Open Data，terrarium 編碼，**maxzoom 15**，`ACAO: *` |
| 世界底圖 | `tiles.openfreemap.org/styles/liberty` | 免費無金鑰無流量限制，但**無 SLA** |
| 世界底圖備援 | `basemaps.cartocdn.com/gl/positron-gl-style/style.json` | Liberty 載入失敗時自動切換 |
| 臺灣通用電子地圖 | `wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}` | 國土測繪中心 |
| 臺灣正射影像 | 同上，`EMAP` → `PHOTO2` | |
| 氣候正常值 | `archive-api.open-meteo.com/v1/archive`（ERA5） | **只在建置期呼叫** |
| 特有種觀測紀錄 | `api.gbif.org/v1/occurrence/search`（GBIF） | **只在建置期呼叫**，`ACAO: *` |
| 行政區／河流幾何 | `raw.githubusercontent.com/nvkelso/natural-earth-vector`（Natural Earth） | **只在建置期呼叫**，public domain |
| 地震目錄 | `earthquake.usgs.gov/fdsnws/event/1/query`（USGS） | **只在建置期呼叫**，免金鑰、`ACAO: *` |
| 基本地理事實（山脈走向、主峰高度、河川分界…） | `zh.wikipedia.org` 各條目 | **程式完全不呼叫**，人工查閱後寫進 `src/content/`。次級來源，用法見「內容撰寫規範」，CC BY-SA |

### ⚠️ NLSC 的路徑順序陷阱

NLSC WMTS 是 `{z}/{y}/{x}`——**y 在 x 前面**，跟絕大多數 XYZ 服務相反。寫成 `{z}/{x}/{y}` 仍然會回 HTTP 200，只是拿到位置完全錯亂的圖磚，不會有任何錯誤訊息。

### 氣候資料為什麼要預先產製

`scripts/build-climate.mjs` 在建置期抓 1991–2020 逐日資料，聚合成 12 個月的均溫與月雨量，輸出到 `public/data/climate/<place-id>.json`。網站執行期只讀本地 JSON。

理由：一個班級同時開站會對 Open-Meteo 產生大量請求而被限流（實測連抓 5 個地點就會收到 429）；而且執行期抓 30 年逐日資料再聚合會讓圖表等好幾秒。

**已知資料限制**：ERA5 是約 25 km 網格的再分析資料，會平滑掉小島與陡峭地形的地形雨。例如希洛實測年雨量約 3300 mm，ERA5 只給約 1590 mm。用於教學比較的量級關係仍然正確，但**不要把這些數字當成氣象站觀測值引用**。

### 特有種觀測資料為什麼要預先產製

`scripts/build-species.mjs` 在建置期向 GBIF 查詢每個物種在台灣（`country=TW`）的真實觀測紀錄，篩掉座標有問題的紀錄（`hasGeospatialIssue=false`），每物種最多留 200 筆，輸出到 `public/data/species/<species-id>.geojson`。理由跟氣候資料一樣：避免上課時大量學生同時開站對 GBIF 發出重複請求，也不用讓地圖疊圖等 API 回應。

**用 `gbifTaxonKey`（數字）查詢，不要用學名字串**：GBIF 同一個學名可能對應到已被降級的 synonym（例如櫻花鉤吻鮭 `Oncorhynchus masou formosanus` 是 synonym，正式 accepted 名是 `Oncorhynchus formosanus`），用字串查詢容易漏資料或撈到錯的分類單元。先用 `https://api.gbif.org/v1/species/match?name=<學名>` 查一次拿到 `usageKey`，把這個數字存進 `gbifTaxonKey`。

**已知資料限制**：GBIF 觀測點反映的是「歷史觀測熱點」，受賞鳥／採集活動的地點偏好影響，不是嚴謹的族群密度普查。教學呈現與 UI 文案都不要暗示這是完整、精確的分布範圍（`SpeciesCard` 已經在來源說明裡註記這件事，新增文案時比照辦理）。

---

## 硬性禁止事項

1. **不得引入任何需要 API key、token 或付費金鑰的服務。** MapTiler、Mapbox、Google Maps 一律不用。純靜態站沒有地方藏金鑰。
2. **不得把 `vite.config.ts` 的 `base` 改成 `/gaia/`。** 掛了自訂網域之後網站是從 `gaia.kigi.tw` 的根路徑供應，`base` 必須是 `/`。
3. **不得刪除 `public/CNAME` 與 `public/.nojekyll`。** 刪掉 CNAME 會讓 GitHub Pages 解除自訂網域綁定。
4. **不得移除 `optimizeDeps.exclude: ["maplibre-gl"]`。** 見上面的版本陷阱。
5. **不得在執行期呼叫 Open-Meteo。** 氣候資料一律走 build-time 產製。
6. **不得手動編輯 `public/data/climate/*.json`。** 由 `npm run build:climate` 產生。
7. **不得使用雙 Y 軸圖表。** 兩個刻度可以任意縮放，會讓氣溫線與雨量柱的交叉看起來像有因果關係。詳見下面的圖表規範。
8. **不得在執行期呼叫 GBIF。** 特有種觀測點一律走 build-time 產製。
9. **不得手動編輯 `public/data/species/*.geojson`。** 由 `npm run build:species` 產生。
10. **不得手動編輯 `public/data/geo/*.geojson`。** 由 `npm run build:geodata` 產生。手繪的教學示意幾何放 `public/data/geo-manual/`，那個目錄腳本永遠不會碰。
11. **不得憑感覺挑主題圖層的顏色。** 改動或新增 `src/map/thematicColors.ts` 的顏色前，必須重新用 dataviz skill 的 `scripts/validate_palette.js`（`--pairs all`，因為主題圖層是可任意複選的核取方塊，不能只驗證清單裡「相鄰」的顏色）驗證明暗兩模式，理由與已驗證過的組合見該檔案的註解。

---

## 地圖圖層命名慣例

ID 常數定義在 `src/map/layers/*.ts`，**一律 import 常數，不要寫死字串**。

| 常數 | 值 | 型別 |
|---|---|---|
| `CONTOUR_SOURCE_ID` | `contour-source` | vector（maplibre-contour 產生） |
| `CONTOUR_LINE_LAYER_ID` | `contour-lines` | line |
| `CONTOUR_LABEL_LAYER_ID` | `contour-labels` | symbol |
| `DEM_SOURCE_ID` | `dem` | raster-dem（給 hillshade） |
| `TERRAIN_SOURCE_ID` | `dem-terrain` | raster-dem（給 3D 地形） |
| `HILLSHADE_LAYER_ID` | `hillshade` | hillshade |

主題圖層的 id **不是常數，是由註冊表的 `layer.id` 組合出來的**（見「圖層 id 的組合方式」），helper 在 `src/map/registry/index.ts`：`geoSourceId()` / `geoLayerIds()` / `geoHitLayerIds()`。目前實際存在的：

| id | 型別 |
|---|---|
| `places-source` / `places-points` | geojson / circle |
| `indigenous-source` / `indigenous-points` | geojson / circle |
| `species-<id>-source` / `species-<id>-points` | geojson / circle，每個物種各自一組 |
| `tw-counties-fill` / `tw-counties-outline` | fill + line（面的外框一定是獨立圖層） |
| `world-rivers-line` / `world-rivers-label` | line + symbol |
| `world-places-points` | circle |
| `latitude-lines-line` / `latitude-lines-label` | line + symbol |
| `quakes-points` | circle |

`dem` 與 `dem-terrain` 是兩個來源但都指向同一個 shared DEM protocol：maplibre 會警告 hillshade 與 terrain 共用來源會降低算繪品質，拆開可消除警告，而底層圖磚快取仍然共用、不會重複下載。

### DemSource 必須是單例

`src/map/demSource.ts` 匯出 `getDemSource()`。`setupMaplibre()` 會在 maplibre 全域註冊 protocol handler，且建構時會啟一個 web worker。比較頁有兩張地圖，各自建立就會有兩個 worker、兩份快取，同一塊 DEM 圖磚下載兩次。

maplibre-contour 把 worker 以 Blob URL 內嵌，**不需要額外部署 worker 檔案**，這是它能在 GitHub Pages 上運作的關鍵。

### 等高線標註的實測參數（不要隨手改）

`contour-labels` 用 `symbol-placement: line`，沿線放置時**字串越長就需要越平直的線段**。等高線很彎，這件事的影響比直覺大得多：

- `text-field` 用 `["get", "ele"]`，**只標數字不加單位**。加上 `" m"` 之後實測標註數從 19 掉到 **0**（同理，`["concat", ["number-format", ...], " m"]` 也是 0）。單位在圖層開關的標籤上說明。這也符合地形圖慣例。
- `symbol-spacing: 120` + `text-max-angle: 60`：玉山一帶可標出約 19 個高程，涵蓋 1500–3500 m。用 maplibre 預設的 250/45 只剩 6 個，太稀疏。

改動這些參數後，用下面「驗證方式」的 `queryRenderedFeatures` 手法實測標註數量，不要只靠肉眼。

### 等高線間距

`CONTOUR_THRESHOLDS`（`src/config.ts`）：zoom → `[次要間距, 主要間距]`，單位公尺（`multiplier` 保持預設 1）。低於 `CONTOUR_MIN_ZOOM`（9）不顯示等高線——小比例尺畫等高線既沒意義又耗效能。

`level` 屬性 = 該高程能整除的最高門檻索引：`1` 是計曲線（粗線 + 標高程），`0` 是首曲線（細線）。

---

## 主題地圖頁與圖層註冊表

內容以**主題**組織（國小／國中／高中合流，不再依年級分類）。目前三個主題，路由都是 `/theme/:themeId`，共用同一支 `src/pages/ThemeMapPage.tsx`：

| 主題 | 路由 | 內容 |
|---|---|---|
| 臺灣地理 | `/theme/taiwan` | 行政區、地形、水系、人文（原住民族）、植被生態（特有種）、農業物產 |
| 世界地理 | `/theme/world` | 世界重要城市、國界與大洲、地形水系、人文專題 |
| 全球地理形貌 | `/theme/global` | 緯度參考線、氣候與生物群系、洋流、板塊與地震帶 |

三個主題頁都是**滿版地圖 + 浮動控制**（仿 Google Map），沒有頁首也沒有側欄——版面機制見下面的「全螢幕地圖外框與浮動控制」。

`/compare`（雙地圖同緯度比較）是獨立的一頁，跟這套系統無關，版面也**沒有**被改動（它是雙地圖 + 緯度滑桿 + 兩組圖表，沒有地方掛浮動控制，所以保留一條自己的頁首 `SiteHeader`）。兩者互補：`/theme/global` 說明「為什麼緯度重要」，`/compare` 帶學生鑽進同一條緯度上的兩個地方看差異。

### 圖層註冊表

**加一個新圖層或新主題 = 加一筆資料，不需要寫任何元件。** 定義在 `src/map/registry/`：

```
registry/
├─ types.ts        # 型別（含 MAX_ACTIVE_BY_KIND）
├─ index.ts        # THEMES、getTheme、allLayers、id 組合 helper
├─ themes/*.ts     # 三個主題的圖層清單（純資料）
├─ generators.ts   # 程式產生的幾何（緯度參考線）
└─ resolve.ts      # 標籤 → 實際資料（瀏覽器專用）
```

**最重要的約束：`themes/*.ts` 與 `index.ts` 必須是純資料且 Node 可直接 import。**
`scripts/validate-content.mjs` 會用 Node 24 的 type stripping 載入 `registry/index.ts` 做建置期交叉檢查（remote 路徑是否存在、圖層 id 是否撞名、`maxActive` 是否超過色票長度、`group` 是否在 `theme.groups` 裡）。這件事值得為它扭曲型別設計，因為「宣告的 geojson 不存在」在執行期是**完全靜默**的：fetch 404 → `resolveLayerData()` 回 null → 圖層永遠不出現 → console 什麼都沒有。

所以規則是：`themes/*.ts` 只能 `import type` 型別 + value-import `thematicColors.ts`（一個零 import 的常數模組）；**不准放 closure、不准 `import.meta.glob`、不准 value-import maplibre**。資料來源一律寫成標籤（`LayerSource`），由 `resolve.ts` 在瀏覽器端解析。

因為 Node 的 ESM 解析器不會自己補副檔名，`registry/` 內部互相 import **必須寫 `.ts` 副檔名**（`tsconfig.json` 因此開了 `allowImportingTsExtensions`）。

`status: "planned"` 的圖層照樣列在圖層抽屜裡（停用的核取方塊 + 「資料整理中」），但**仍然必須填 `description` 與 `sources`**——一個停用又沒有文字的核取方塊什麼都沒教到。

子項目（`items`）是「一個勾選項展開成 N 個子圖層」的第一級概念，目前只有特有種用到。清單來源寫成 `{ type: "content", collection: "species" }` 而不是硬編，這樣**新增一個物種 JSON 就會自動出現在 UI**。

### 圖層 id 的組合方式

```
instanceId = item ? `${layer.id}-${item.id}` : layer.id
circle → `${instanceId}-points`
line   → `${instanceId}-line`（有 label 再加 `-label`）
fill   → `${instanceId}-fill` + `${instanceId}-outline`
```

`-points` 後綴是刻意沿用的舊命名，讓 `places-points`／`indigenous-points`／`species-<id>-points` 一個字元都不變。

**fill 一定是兩個 maplibre 圖層**：maplibre 的 `fill-outline-color` 只能畫 1px 髮絲線、線寬不可調，外框必須是同一個 source 上的獨立 line 圖層。

### 關鍵坑一：切換底圖會清掉主題圖層

`MapView.tsx` 切底圖時呼叫 `map.setStyle()`，會清空所有自訂 source/layer，然後在 `style.load` 重新加回 contour/hillshade。**主題圖層不是 `MapView` 加的，`MapView` 不知道要重新套用它們。**

解法是 `MapView` 的 `onStyleApplied` 回呼：`MapView` 在**自己把等高線與地形陰影加回去之後**才呼叫它，`useGeoLayers` 回傳的 `reapply` 接上去，重套的時序就不再是猜的。

⚠️ **不要退回成「在 useGeoLayers 裡自己也掛一個 `style.load` 監聽」的舊做法**——那樣兩個監聽會競爭：`useGeoLayers` 在 mount 就註冊、跑得早，重新加圖層並排序時等高線根本還沒加回來，排序就反了（見下面的關鍵坑二）。`styledata`、`idle`、`queueMicrotask` 這些補救式觸發全都試過，全都不夠。

互動監聽（`map.on(event, layerId, handler)`）是掛在 Map 實例上、不是掛在圖層上，所以 `setStyle` 造成的圖層重建**不需要**重綁——重綁只會讓監聽無限累積。`useGeoLayers` 因此把「互動綁定」與「圖層套用」分成不同的 effect，**改動時不要合併**。

呼叫端傳給 `useGeoLayers` 的 `instances` 陣列要用 `useMemo`。

### 關鍵坑二：切底圖後的圖層排序會反過來

兩個 `style.load` 監聽會互相競爭：`useGeoLayers` 若在 mount 就註冊，會比 `MapView` 在切底圖那一刻才註冊的更早跑，於是主題圖層被加進一個還沒有等高線的樣式，contour 才補上去——排序跟首次載入相反。

主題圖層全是圓點時，被一條細棕線壓過去沒人會發現；換成縣市界的半透明面就很明顯，而且**只有切過底圖才重現**。更陰險的是**它只在部分底圖上出現**：NLSC 的樣式只有兩個圖層、載入極快，時序跟一百多個圖層的 liberty 完全不同，所以很容易「切一種底圖測過就以為沒事」。

時序問題已經由 `onStyleApplied` 回呼從根本解掉（見上一節）；`layerOrder.ts` 負責的是「在正確的時機把順序排對」。

`src/map/layerOrder.ts` 用冪等的 `moveLayer` 後處理解決，堆疊順序（由下往上）：

```
底圖 → hillshade → 底圖地名 → contour-lines
  → 主題 fill → 主題 line/outline → 主題 points → 主題 label
  → contour-labels（錨點）
```

`enforceThemeLayerOrder()` 的 early-return 閘門**三個條件缺一不可**（相對順序正確、在 contour-labels 之下、在 contour-lines 之上）。少了「在 contour-lines 之上」那條，函式會把實測到的壞掉狀態 `[主題圖層, contour-lines, contour-labels]` 誤判成正確而直接 return，排序永遠修不好。

這個坑咬過兩次，所以有回歸測試：**`npm run test:order`**（已納入 `npm run build`）。它用假的 map 物件重現三種堆疊狀態，不需要瀏覽器——這很重要，因為背景分頁下 maplibre 不觸發 rAF，用瀏覽器手動驗會給出**假的通過**。排序邏輯要改就先改測試。

### 沿線標註很脆弱

`text-font` 只有 `"Noto Sans Bold"` 確定存在於 `basemaps.ts` 借用的 OpenFreeMap glyph 端點上，換別的字型名稱會**靜默**畫不出任何標註。

**線越彎、字串越長，放置演算法就越容易靜默拒絕。** 預設用等高線驗證過的寬鬆組合（`symbol-spacing: 120` / `text-max-angle: 60`）：實測世界主要河流用 240/45 時標註數是 **0**，改成 120/60 之後在 zoom 4 可標出 8 條。反過來，緯度參考線又直又橫跨全球，要把 `spacing` 調高到 320，否則同一條線上會重複出現一長串「赤道 赤道 赤道…」。

改動後一定要用 `queryRenderedFeatures` 實測放置數量，不要只靠肉眼。

**標註本身也要能點。** `geoHitLayerIds()` 對有標註的線會回傳 `[線, 標註]` 兩層——使用者看到的是「中央山脈」那四個字，自然會去點字，但字畫在 symbol 圖層上而線只有 2.6px 寬，只綁線的話點在字上有很高機率整個落空，而且畫面上沒有任何反應可以解釋原因。

兩層在畫面上是重疊的，所以 `bindGeoLayerInteractions()` 收**一組**圖層一起管理，不是一層一組獨立監聽：游標用 `hovered` 集合記住還停在哪幾層上（否則滑鼠從字移到線時，標註層的 `mouseleave` 會把游標重設掉，即使人還停在線上），點擊則用 `originalEvent` 的同一性擋掉第二次（點在字的正中央會同時命中兩層）。`useGeoLayers` 的互動記帳因此以 **instanceId** 為 key，不是 layerId。

### 顏色

`src/map/thematicColors.ts` 是唯一的顏色來源。策略是**三組獨立色票**（`POINT` / `LINE` / `FILL`），各自**組內** all-pairs 驗證即可——形狀本身就在區辨（18% 透明度的面染跟 6px 圓點是不同的視覺通道），跨幾何的配對不需要驗證。每組再用 `MAX_ACTIVE_BY_KIND`（circle 4 / line 3 / fill 2）封頂，需求才維持在可解範圍。

已驗證：地形景點藍 `#2a78d6` + 原住民族紅 `#e34948`；物種三色青／黃／紫；線／面三色 水系藍 `#2a78d6` + 行政區橘 `#d95926` + 山脈洋紅 `#c23f8f`（`--pairs all`，明暗兩模式全數 PASS，CVD 最差 ΔE 12.3、一般視覺最差 ΔE 16.7）。

行政區橘刻意用 `#d95926` 而不是色票的 light step `#eb6834`：後者在 **dark 模式的亮度帶檢查會 FAIL**。地圖是 WebGL 畫布只能有一組固定色，所以必須挑「兩個模式都過」的值。

山脈（`relief`）同理選 `#c23f8f` 而不是製圖上更常見的紫 `#7a3fa6`——紫在 **dark 模式的對比只有 2.56:1（WARN）**，`#6d3f9e` 與物種紫 `#4a3aa7` 則直接在 dark 模式亮度帶 FAIL。**棕色與綠色是被排除的**，不是沒想到：等高線 `rgba(120,78,42,.55)` 與地形陰影 `#5a4632` 都是棕的，而 NLSC 通用電子地圖的山區底色是綠的——山脈線畫成那兩種顏色，等於畫在它自己要說明的那片地形上看不見。

`reference`（緯度參考線）與 `hazard`（地震帶）是**非分類的固定角色**，比照 hillshade 的棕色，刻意排除在色票驗證之外。地震帶尤其不該給分類色相：2800 個依震級縮放的點是**密度場**，教學內容是「地震帶沿板塊邊緣浮現」，不是「這個色相代表地震」；給它色相不但擠爆色票驗證，2800 個不透明白框圓點在投影機上也只是一坨糊的（所以 `strokeWidth: 0` 必須是可設定的）。

### 新增資料

**手動整理的內容**（地點、原住民族、物種介紹）：建 `src/content/<type>/<id>.json`，**檔名必須等於 `id`**，跑 `npm run validate`。

**註冊表驅動的地理要素**（縣市、河流、山脈、洋流…）：
1. 幾何進 `public/data/geo/`（`npm run build:geodata` 產生）或 `public/data/geo-manual/`（手繪示意幾何）
2. 在 `registry/themes/*.ts` 加一筆圖層定義
3. 說明文字**選填**：`src/content/geo/<collection>/<id>.json`。**沒有內容檔時 `FeatureCard` 會退回顯示 geojson 的 `name` + 圖層自己的 `description`/`sources`**，所以 21 個縣市可以先上線再逐一補寫

手繪示意幾何（洋流、氣候帶、風系）一定要標 `schematic: true`，UI 才會顯示「教學示意圖，非精確界線」的警語——這是內容誠信的承諾，比照 GBIF 觀測點與 ERA5 氣候值的既有做法。

### 已知資料限制

- **臺灣縣市界只有 21 個，缺連江縣（馬祖）。** 已確認 Natural Earth 10m 整份資料集裡都沒有它，不是篩選寫錯。要補齊 22 個縣市得改用政府資料開放平臺的 shapefile（需要 `ogr2ogr`）。圖層的 `description` 有向使用者明講。
- **Natural Earth 的河流沒有中文名欄位**，中文名靠 `build-geodata.mjs` 裡的 `RIVER_NAMES_ZH` 對照表。對不到就沿用原名。注意 NE 把黃河的 name 寫成 `"Huang"`（不是 `"Huang He"`）。
- **相鄰的面各自簡化會在共用邊界開出次像素縫隙**（Douglas–Peucker 不保拓樸）。免依賴的緩解方式是設 `maxzoom`（縣市界設 11），讓它在縫隙變得可解析之前就停止繪製。
- **五大山脈的稜線是手繪示意幾何**（`public/data/geo-manual/tw-ranges.geojson`）。山脈沒有像行政區那樣的官方界線圖資，Natural Earth 也沒收錄，所以走向與端點是依維基百科各條目與地形圖描繪的。圖層與五份內容檔都標了 `schematic: true`，UI 會顯示警語。**不要把它當成精確稜線**；要真的精確得改用 DEM 推導分水嶺。
## 全螢幕地圖外框與浮動控制

三個主題頁的版面是 `ThemeMapPage` 組出來的 `.map-shell`（`position: fixed; inset: 0`）：

```
.map-shell  [data-detail-open] [data-drawer-open]
├─ MapView            ← 永遠是第一個、無條件的子節點
├─ .map-top-left      MapSearchBox 搜尋藥丸（[☰][輸入框][✕][🔍]）+ 建議清單，右邊接 DonateButton
├─ .map-top-right     ⋮⋮⋮ AppMenu（主題導覽 + 淺／深色）
├─ .map-bottom-left   MapLegend + 「圖層」磚（底圖與等高線／地形陰影／3D 地形）
├─ MapDetailPanel     左側詳情面板（top: var(--search-h)，接在搜尋框正下方）
└─ LayerDrawer        左側圖層抽屜（刻意蓋在詳情面板之上，比照 Google Map）
```

左上角是一整欄：搜尋藥丸在上、詳情面板接在它下面。`--search-h` = 藥丸高度 + 上下留白，藥丸自己有明確的 `height: var(--search-pill-h)`，兩個值不可能分歧，所以面板的 `top` 直接用 token，不必量測 DOM。

`.map-top-left` **刻意不讀 `--left-panel-w`**：詳情面板現在排在它正下方而不是旁邊，本來就沒有要閃避的東西。它的 `z-index` 是 `--z-popover`（不是 `--z-map-ui`），否則建議清單會被 `--z-panel` 的詳情面板蓋掉——`.map-top-left` 自己有 z-index，子節點爬不出這個堆疊脈絡。它因此也高過抽屜，但抽屜開著時整欄是 `visibility: hidden`，兩者不會同時出現。

`.map-top-left` 是 `display: flex` 的一列，`MapSearchBox` 用 `flex: 1; min-width: 0` 佔滿剩下的寬度，`DonateButton`（`src/components/DonateButton.tsx`）用 `flex: none` 排在右邊——這是唯一一個心型固定用暖紅色（不是 `.map-fab` 預設的中性灰）的浮動按鈕，因為它要引導點擊而不是單純導覽，是 `<a target="_blank">` 連到均一的贊助頁，不是 React Router 內部連結。抽屜開著時整欄一起 `visibility: hidden`，贊助按鈕也會跟著收起。

### `<MapView>` 必須是 shell 的第一個、無條件的子節點

不准把它移進條件分支、加 key 的包裝層、或抽屜／面板擁有的子樹。任何一種都會讓 React 重建那個節點，於是 maplibre remount：整份圖磚快取丟掉，`window.__gaiaMaps` 累積殘骸（檢查清單第 11 項就是在抓這個）。面板一律是**排在地圖後面**的條件式兄弟節點，地圖的 reconciliation 位置永遠是 index 0。

### 為什麼不需要 `map.resize()`

`.map-shell` 是 `fixed; inset: 0`，`.map-shell-canvas` 是 `absolute; inset: 0`，canvas 的邊框盒等於視窗，**與抽屜／面板的開關完全無關**——面板是疊上去的絕對定位兄弟節點，不是把地圖擠小的欄位。所以整份程式碼裡沒有、也不該有任何 `map.resize()`。

⚠️ 維持這件事成立的規則只有一條：**面板永遠不可以改成會縮短地圖的 grid／flex 欄位**（那是重構前 `.explore` 的作法）。真要改，`resize()` 必須掛在面板的 `transitionend` 而不是狀態變更，否則動畫期間 canvas 是髒的。

### 面板閃避只有一個機制

`--left-panel-w` 與 `--bottom-sheet-h` 由 shell 上的 `data-*` 屬性決定，所有靠左／靠下的浮動控制（含 maplibre 自己的角落容器）都用 `calc()` 讀它們。**不准再出現第二條硬寫 `left`／`bottom` 的規則。** 窄螢幕的媒體查詢也只是重設這兩個屬性，浮動控制不需要任何額外規則。

### z-index 階梯與 maplibre 的堆疊脈絡

`--z-map-ui: 5` → `--z-panel: 10` → `--z-scrim: 15` → `--z-drawer: 20` → `--z-popover: 30`。抽屜在詳情面板**之上**是刻意的設計決定；因此**選取任何圖徵（點地圖或選搜尋結果）都會自動收起抽屜**（`useDrawerOpen` 的 `closeTransient`），否則剛開出來的詳情卡會被整片蓋住。`closeTransient` 不寫 localStorage——那是系統替使用者做的決定，不能覆寫他自己記住的偏好（`setOpen` 才會寫）。

抽屜**首次造訪預設收起**：它蓋住的正好是左上角的搜尋框與詳情面板，預設開著會讓人第一眼看不到這次的主要入口。圖層仍然找得到——☰ 就在搜尋藥丸最左邊，而且搜尋本身也搜得到圖層名稱。

maplibre 的四個角落容器是 map container 內的 `position: absolute; z-index: 2`，所以 `.map-shell-canvas` 要 `isolation: isolate` 把它關進自己的堆疊脈絡。浮動控制的容器一律 `pointer-events: none`，只有按鈕與面板本身 `auto`，否則會吃掉地圖手勢。

### 內建控制的位置

主題頁把 `NavigationControl` 與 `ScaleControl` 都移到 `bottom-right`（`MapView` 的 `navPosition` / `scalePosition` prop，預設值維持 top-right／bottom-left 給 `/compare`），因為右上角讓給 ⋮⋮⋮、左下角讓給「圖層」磚。`MapLegend` 也從絕對定位改成 `.map-bottom-left` 這個 flex 欄位的普通子節點，白拿面板閃避。

**maplibre 自己的控制維持預設淺色外觀**：它的圖示是內嵌的深色 SVG data URI，把 `.maplibregl-ctrl-group` 換成 `var(--surface)` 會讓深色模式下的圖示直接消失。它們疊在圖磚上，而圖磚本來就不隨主題變色。

### 彈出層機制（`src/usePopover.ts`）

**不用 `<dialog>`、不用原生 Popover API。** `showModal()` 會鎖焦點並擋住地圖拖曳；`show()` / `popover=""` 會升到 top layer，於是跳出上面那道 z-index 階梯與 `--left-panel-w` 的定位脈絡——而整個 shell 的重點就是這幾層彼此的相對順序。

- Escape 掛在**面板層級**的 `onKeyDown`，不是 document 監聽：開啟時焦點已在面板裡，Escape 自然只關掉最上層；document 監聽會把抽屜跟選單一起關掉。
- 點外面關閉用 `pointerdown` 而不是 `click`，這樣彈出層會在 maplibre 開始拖曳前就關掉。原生 `<select>` 的選項清單不派發頁面層級的 `pointerdown`，所以「圖層」彈出層裡的底圖 `<select>` 不會把自己關掉。
- `didOpenRef` 擋住「抽屜從 localStorage 還原成開啟」時在首次算繪就搶走文件焦點。
- 不做 focus trap、不加 `aria-modal`：底下的地圖仍然可以操作，宣告成 modal 是對輔助科技說謊。

`usePopover` 由 `ThemeMapPage` 呼叫（不是 `LayerDrawer` 自己），因為 ☰ 現在住在搜尋藥丸裡、面板是抽屜，兩者不再共用一個 DOM 子樹。這樣拆是安全的：`rootRef` **只**用在「點外面關閉」那個 effect，而抽屜是 `dismissOnOutsideClick: false`，那個 effect 直接 early return；焦點的進出靠 `triggerRef`／`panelRef`，與 DOM 結構無關。

`MapSearchBox` 的建議清單**不重用 `usePopover`**：它的觸發器語意是 `aria-haspopup="dialog"` 的按鈕，而搜尋框是 combobox（輸入框自己是觸發器、清單是 listbox），套上去是對輔助科技說謊。但「點外面用 `pointerdown` 關閉」的手法是照抄的，理由相同。

---

## 主題頁搜尋（`src/search/searchIndex.ts` + `MapSearchBox`）

三個主題頁共用同一個搜尋框，索引跨全部三個主題。

### 索引哪些東西（規則要照著走，不要臨時擴充）

`allLayers()` 裡 `status === "ready"` 的圖層：

- **地物**：只索引「有 `browse` 設定」「有 `items`」或「來源是 `generated`」的圖層。
  `browse` 本來就代表「這個圖層的圖徵是一份可以逐一點選的清單」，所以新圖層照常宣告 `browse` 就會自動進索引。
  ⚠️ 這條規則同時把 `quakes` 擋在外面，這是刻意的：那份 geojson 有 **400 KB**、2831 筆**沒有名稱**的點，它是密度場不是清單。索引它只會多抓一份大檔案再產生 2831 筆搜不到的項目。
- **圖層本身**：所有 ready 圖層的名稱（搜「河流」要找得到「世界主要河流」這個圖層）。`planned` 的不列，因為勾不動。
- 沒有 `properties.id` 或沒有 `properties.name` 的圖徵一律跳過——前者選不了、後者搜不到。

索引是 **lazy 的**：搜尋框第一次獲得焦點才 `buildSearchIndex()`，因為它要抓 `tw-counties.geojson`(35 KB) 與 `world-rivers.geojson`(146 KB)。一個班 30 個學生同時開站時，這 181 KB 不該是每個人無條件付的成本。資料一律走 `resolveLayerData()`，與圖層顯示共用同一份快取，不會抓兩次。

### 選了一筆結果之後（`ThemeMapPage` 的 `pendingHit` 狀態機）

不能同步飛過去：圖層可能還沒勾選、資料可能還沒抓回來，甚至可能要先換主題。所以只記下 `pendingHit`，由一個 effect 分批消化——每一輪只做當下做得到的事，做不到就 return，等 `instances` 變了再來。三個容易踩的點：

- **`enableLayer()` 要自己守 `MAX_ACTIVE_BY_KIND`。** 平常那個上限是靠 `LayerPanel` 把核取方塊 disable 掉來落實的，搜尋自動勾選繞過那個 UI。超過就踢掉同幾何、`Set` 迭代順序最前面（最早勾）的那一個。
- **跨主題時要抑制換主題 effect 的 `flyTo`**（用 `pendingHitRef`，不是 state——導覽發生在 setState 生效之前），否則會先飛到主題預設相機再飛第二次。但**詳情卡一定要清成 `null`**：目標若是 `detail.type === "none"` 的圖層（緯度參考線），pendingHit effect 永遠不會 `setSelected`，上一個主題的詳情卡就會留在畫面上（實測踩過）。
- **`detail.type === "none"` 只飛不開卡**；圖層本身的結果只勾選 + `fitBounds`，也不開卡。一張沒有內容的詳情卡什麼都沒教到。
- 抓資料失敗時 instance 的 `data` 永遠是 null、effect 不會再被觸發，所以 `pendingHit` 有一條 8 秒死線，否則它會一直卡著並讓下一次換主題誤判。

---

## 雙地圖同步規則

`src/map/useMapSync.ts`。

| 屬性 | 行為 |
|---|---|
| `center.lat` | **鎖定相同** |
| `zoom` / `bearing` / `pitch` | **鎖定相同** |
| `center.lng` | **各自獨立** |

用 `syncingRef` 旗標防止回饋迴圈：同步過程中對方觸發的 `move` 事件必須忽略，否則兩張地圖會互相推擠。

### 為什麼是鎖緯度而不是鎖經度

Web Mercator 投影的面積放大率只跟緯度有關（放大倍率 = 1 / cos(緯度)）。**只有在同緯度、同 zoom 時，兩張地圖的實際比例尺才相同**，面積與距離的目視比較才成立。

這不是實作細節，是整個比較功能在教學上能成立的前提，UI 上也必須向學生說明（見 `ComparePage` 的 `.latitude-note`）。改動同步邏輯前先確認沒有破壞這個前提。

---

## 資料 Schema 與內容撰寫

Schema 定義在 `src/lib/schema.ts`（zod）。`scripts/validate-content.mjs` 在每次 `npm run build` 前執行，格式錯誤直接中斷建置。

Node 24 原生支援 TypeScript type stripping，所以 `.mjs` 腳本可以直接 `import` `schema.ts`，不需要另外編譯或維護第二份 schema。

新增原住民族／特有種資料的步驟在上面「Explore 頁的主題圖層系統 → 資料整理方式」，這裡只講地點。

### 新增地點

1. 建立 `src/content/places/<id>.json`，**檔名必須等於 `id`**（validator 會檢查）
2. 執行 `npm run build:climate` 產生氣候 JSON（已存在的會跳過，`--force` 可重抓）
3. `npm run validate` 確認通過

```jsonc
{
  "id": "taipei",                    // 小寫英數與連字號
  "name": { "zh": "臺北", "en": "Taipei" },
  "coord": { "lat": 25.033, "lng": 121.565 },
  "elevation_m": 18,                 // 單位一律公制
  "region": "taiwan",                // taiwan | world
  "topics": ["landform", "climate", "human"],  // landform|climate|hydrology|human
  "koppen": "Cfa",                   // 柯本氣候分類代碼
  "landform": "盆地",
  "defaultZoom": 11,                 // 選填
  "facts": [{ "label": "地形", "value": "臺北盆地……" }],
  "curriculum": { "level": "junior", "unit": "臺灣的地形與都市" },  // junior | senior
  "sources": ["交通部中央氣象署"]     // 必填，每筆資料都要標來源
}
```

### 內容撰寫規範

- **繁體中文**，使用臺灣國高中地理課綱的既有詞彙（「北回歸線」「副熱帶高壓」「地形雨」），不要自創術語
- **單位一律公制**：公尺、公釐、°C
- 每個地點都必須填 `sources`，資料要能追溯出處
- **維基百科可以當來源，但它是次級來源**：適合查山脈走向、主峰高度這類已有共識的基本地理事實；凡是數值型的權威資料（氣候正常值、人口統計、保育等級）一律仍以主管機關的原始資料為準。並列時官方來源寫在維基百科後面（`["維基百科", "內政部國土測繪中心"]`），讀者才看得出哪一筆追得到原始出處
- `facts` 控制在 4 筆左右，每筆一行講完；長篇說明放課文
- 比較用的地點，`facts` 裡建議放一筆「對照重點」，明講這組配對要讓學生看見什麼

### 預設比較組合

`src/compare/presets.ts`。每一組都要挑「緯度接近、地理條件差很多」的配對，並在 `hint` 寫清楚教學意圖。例如臺北與塔曼拉塞特年均溫都是 22.3 °C，年雨量卻是 2078 mm 對 24 mm。

---

## 圖表規範

顏色 token 定義在 `src/styles.css` 的 `:root`，深色模式在 `@media (prefers-color-scheme: dark)` 與 `:root[data-theme="dark"]` **兩個 scope 各重新定義一次**。不要把任何顏色的唯一定義寫在 media query 裡。

- `--series-precip`（雨量，藍）與 `--series-temp`（氣溫，橘）已通過色盲區辨度與對比檢核（明暗兩模式六項檢查全數 PASS）。**要換色必須重跑驗證器**。
- **不用雙 Y 軸。** `ClimateChart` 刻意拆成上下兩個各自單一 Y 軸的面板，共用月份軸。課本常見的雙軸雨溫圖，兩條刻度可以任意縮放，會讓「氣溫線與雨量柱交叉」看起來像有因果關係，其實只是刻度選擇的產物。
  *（若之後老師需要與課本完全一致的雙軸雨溫圖，應該做成可切換的顯示模式，而不是把現在這個換掉。）*
- **兩地的 Y 軸範圍必須共用**（`sharedDomains()`）。不共用的話兩張圖的柱高無法互相比較，整個比較功能就失去意義。
- 每個面板只有單一系列，所以不需要圖例，由 `figcaption` 標題說明。
- 一定要提供資料表（`<details>` 內的 `<table>`），這既是無障礙需求，課堂上也用得到。
- 數字欄位用 `font-variant-numeric: tabular-nums`。

---

## 開發指令

```bash
npm run dev             # http://localhost:5173
npm run typecheck       # tsc --noEmit
npm run validate        # zod 驗證內容 + 圖層註冊表交叉檢查
npm run test:order      # 圖層堆疊順序的回歸測試（不需瀏覽器）
npm run build           # validate → test:order → typecheck → vite build → postbuild
npm run build:debug     # 帶地圖除錯掛勾的 production build（驗證用，見下）
npm run preview         # 預覽 production build
npm run build:climate   # 產生氣候 JSON（已存在會跳過）
npm run build:climate -- --force   # 全部重抓
npm run build:species   # 產生特有種觀測點 geojson（已存在會跳過）
npm run build:species -- --force   # 全部重抓
npm run build:geodata   # 產生行政區/河流/地震 geojson（已存在會跳過）
npm run build:geodata -- --force --only=quakes   # 只重抓一個資料集
```

`build:climate` 對 Open-Meteo、`build:species` 對 GBIF、`build:geodata` 對 Natural Earth 與 USGS 都有指數退避重試（429/5xx 時等 5s/10s/20s…），連抓多筆被限流是正常的，重跑一次即可補齊。

`build:geodata` 有**大小預算**：單一圖層超過 1 MB 直接 `exit 1`（不是印警告），超過 500 KB 印提醒。真正的限制不是 GitHub Pages，是一個班 30 個學生同時用學校 wifi 開站。

---

## 驗證方式

### ⚠️ 用瀏覽器自動化驗證時，分頁一定要在前景

maplibre 的 `Style.loadJSON()` 會先 `await` 一個 `requestAnimationFrame` 才真正套用樣式。**背景分頁不會觸發 rAF**，所以在沒有被選取的分頁裡開站，會停在：`map.style.stylesheet` 是 undefined、`load` 事件永遠不觸發（`window.__gaiaMaps` 因此是空的）、一張圖磚都不抓、畫面全白，而且**完全沒有任何 console 錯誤或失敗的網路請求**——症狀跟「worker 檔案沒被複製」幾乎一模一樣，很容易誤判成程式壞了。

先確認 `document.visibilityState === 'visible'`（背景分頁下所有地圖驗證都不算數），需要時用
`osascript -e 'tell application "Google Chrome" to set active tab index of window 1 to N'` 把分頁切到前景再等幾秒。
同理，在背景載入、之後才切到前景的分頁，相機狀態可能跟網址參數對不上（`_constrain` 會在尺寸還沒定案時調整 zoom／緯度），要重新整理後再驗一次比較頁的 URL 還原。

**分頁在測試中途才掉到背景也算數，而且症狀更難認。** 這時地圖已經載好了（`__gaiaMaps` 有東西、DOM 一切正常、React 也照常算繪），只有靠 rAF 的東西會靜靜地不動——尤其 `flyTo`。實測過的誤判：用 ⋮⋮⋮ 選單切主題時，路由、☰ 上的主題名、抽屜內容全都正確更新了，只有相機沒飛、zoom 停在切換前的值，看起來活像「換主題的 effect 壞了」。**每一段驗證腳本的開頭都印一次 `document.visibilityState`**，不要只在最開始確認一次。

### 地圖除錯掛勾（`npm run preview` 要用 `build:debug`）

`MapView` 會把地圖實例掛到 `window.__gaiaMaps`，並透過 `canvasContextAttributes.preserveDrawingBuffer` 保留繪圖緩衝區。

⚠️ **這個掛勾的開關不是只有 `import.meta.env.DEV`。** DEV 在 production build 會被 Vite 靜態替換成 `false`，所以只認 DEV 的話，下面所有「production build 下驗證」的指令**根本跑不起來**（`__gaiaMaps` 是 undefined、`toDataURL()` 回空白），而且症狀跟「地圖真的壞了」一模一樣。

因此另外有一個 `VITE_DEBUG_MAPS` 旗標（`.env.debug`）。驗證流程是：

```bash
npm run build:debug && npm run preview     # 帶掛勾
npm run build                              # 正式部署，掛勾會被 DCE 掉（可用 grep -c __gaiaMaps dist/assets/*.js 確認為 0）
```

換頁時 `MapView` 會把自己從 `__gaiaMaps` 移除，所以陣列長度永遠等於畫面上實際存在的地圖數（探索頁 1、比較頁 2）。要拿最新的一張用 `window.__gaiaMaps.at(-1)`。

**要取得地圖畫面**（一般截圖工具只會拍到空白 canvas），把 canvas 轉成已解碼的 `<img>` 再截圖：

```js
const img = new Image();
img.src = map.getCanvas().toDataURL('image/png');
await img.decode();          // 一定要等 decode，否則截到空白
document.body.appendChild(img);
```

這只在 `preserveDrawingBuffer` 真的生效時才有用。v6 把該選項移進 `canvasContextAttributes`，寫在頂層會被**靜默忽略**，症狀就是畫面看起來正常但 `toDataURL()` 拿到空白——很容易誤判成地圖沒算繪。

**驗證圖層時優先用程式查詢，不要只靠肉眼看圖：**

```js
const m = window.__gaiaMaps.at(-1);
m.queryRenderedFeatures({ layers: ['contour-lines'] }).length   // 等高線條數
m.queryRenderedFeatures({ layers: ['contour-labels'] }).length  // 標註數（易被放置演算法拒絕）
m.isSourceLoaded('contour-source')
[m.getCenter().lat, m.getZoom()]                                // 確認雙圖同步
```

`queryRenderedFeatures` 對 symbol 圖層只會回傳**實際被放置**的標註，所以它是驗證等高線標註參數的唯一可靠方法。

### 檢查清單

1. 等高線在 zoom 9–15 隨縮放正確加密／變疏；線上數字是海拔公尺數
2. 比較頁：拖動任一地圖 → 另一張的緯度與 zoom 跟著變、經度不變；緯度滑桿雙向同步
3. 比較頁 URL 帶 `?lat=&z=&a=&b=` 重新整理後狀態還原
4. 兩側氣候圖表的 Y 軸範圍相同
5. DevTools Network：**不得有任何帶 API key 的請求**；圖磚全部回 200
6. Console 無 CORS、WebGL 或 maplibre 錯誤
7. **切到每一種向量底圖（目前是「世界地圖」）並確認地物真的渲染出來**，不能只看 `npm run build` 成功。這一項只在 production build 才驗得出來——`npm run dev` 用的是原始 ESM，不會踩到 worker 檔案沒被複製的問題，`npm run preview` 或實際部署才會踩到
8. 主題頁（滿版版面）：
   - 搜尋藥丸左邊的 ☰ 開圖層抽屜 → 核取方塊可任意複選疊加；`planned` 的是停用狀態但仍有說明文字
   - 點地圖圖徵 → **搜尋框下方的詳情面板**開卡，且**抽屜會自動收起**（否則詳情被蓋住），但 `localStorage.getItem('gaia-layer-drawer')` **不變**
   - `localStorage.removeItem('gaia-layer-drawer')` 後重整 → 抽屜是**收起的**，搜尋框與詳情卡直接可見
   - 手動開抽屜 → 重新整理後仍是開的；模擬封鎖 localStorage 不得拋錯
   - 搜尋（見下面第 12 項）
   - 勾選縣市界／世界主要河流後，可點清單長在圖層抽屜裡該圖層那一列底下：
     ```js
     document.querySelectorAll('.layer-drawer .place-list').length      // > 0
     document.querySelectorAll('.map-detail-panel .place-list').length  // 0（詳情面板不放清單）
     ```
   - 鍵盤：Tab 到 ☰ → Enter 開啟 → Escape 關閉且焦點回到 ☰；⋮⋮⋮ 同理；⋮⋮⋮ 開著時點「圖層」磚會關掉 ⋮⋮⋮ 但**不會**關掉抽屜
     （⚠️ `MapView` 是第一個子節點，所以 Tab 會先走過 canvas 與 maplibre 自己的縮放鈕才輪到 ☰）
   - 面板閃避：抽屜或詳情開啟時 `document.querySelector('.map-bottom-left').getBoundingClientRect().left >= 360`
   - 面板開關**不得**改變 canvas 尺寸（證明不需要 `resize()`）：
     ```js
     const before = [m.getCanvas().width, m.getCanvas().height];
     // 開抽屜、開詳情面板後
     JSON.stringify(before) === JSON.stringify([m.getCanvas().width, m.getCanvas().height])  // true
     ```
9. **切底圖之後把所有主題圖層的存在與排序全部重驗一次。** 這是最容易回歸的地方，也是「排序反過來」那個坑唯一會現形的路徑（見上面的關鍵坑二）。⚠️ **主題頁要先點開左下角「圖層」磚**（`document.querySelector('.map-tile').click()`）才找得到底圖 `<select>`：
   ```js
   const ids = m.getStyle().layers.map(l => l.id), at = id => ids.indexOf(id);
   at('contour-lines') < at('tw-counties-fill')      // 面在等高線之上
   at('tw-counties-fill') < at('places-points')      // 面在點之下
   at('places-points')   < at('contour-labels')      // 全部在高程數字之下
   m._listeners.click.length                          // 切 3 次底圖前後應相同（監聽沒累積）
   ```
10. 沿線標註要用 `queryRenderedFeatures` 數，**不能只看有沒有圖層**。⚠️ 這些數字**跟視窗大小相依**（放置演算法看的是實際畫布），改版面之後一定要重新實測並更新這裡的期望值。下列數字實測於 **1440×723 的 CSS 視窗**（滿版版面）：
   ```js
   m.queryRenderedFeatures({ layers: ['latitude-lines-label'] }).length  // 全球主題預設視角（zoom 1.8）為 6
   m.queryRenderedFeatures({ layers: ['world-rivers-label'] }).length    // jumpTo([20,5], zoom 4) 為 7（線 32 條）
   m.queryRenderedFeatures({ layers: ['contour-labels'] }).length        // 臺灣主題預設視角（zoom 12）為 28
   ```
   五大山脈的標註沿用等高線那組寬鬆參數，實測**五條線都標得出來**（`jumpTo([121,23.7], zoom 7.2)`，1920×873 畫布下 7 個標註——中央與雪山兩條夠長，各拿到兩個）。改動 `render.label` 之後要重數，不能只確認圖層存在。
11. `window.__gaiaMaps.length` 不變（證明沒有 remount 重建地圖）：用**右上角 ⋮⋮⋮ 選單**走完三個主題與 `/compare` 再回來（主題頁應為 1、`/compare` 為 2），以及開關抽屜／詳情面板／兩個彈出層各五次、跨主題搜尋數次之後。
12. **搜尋**（四種結果各驗一次，全部都要在前景分頁做——`flyTo` 靠 rAF）：
    ```js
    // 用 React 認得的方式填字（直接指派 .value 會被 _valueTracker 吃掉）
    const inp = document.querySelector('.map-search-input');
    inp.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp, '桃園');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    // 建議清單的選取是 pointerdown（早於 blur），不是 click
    document.querySelector('.search-hit').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    ```
    - 同主題、圖層原本沒勾（搜「桃園市」）→ `m.getLayer('tw-counties-fill')` 存在、相機飛過去、詳情開卡
    - 跨主題（在世界地理搜「阿美族」）→ 路由變 `/theme/taiwan`、圖層勾上、詳情開卡，而且**只飛一次**（掛 `movestart` 數，應為 1）
    - `detail.type === "none"`（搜「北回歸線」）→ 飛到 lat 23.44、圖層勾上，`data-detail-open` 是 **false**（不開空卡，也不能殘留上一個主題的詳情卡）
    - 圖層本身（搜「河流」）→ 勾選 + fitBounds，`data-detail-open` 是 **false**
    - Network 只多抓 `tw-counties.geojson` 與 `world-rivers.geojson`，**沒有 `quakes.geojson`**：
      ```js
      performance.getEntriesByType('resource').filter(r => /geojson/.test(r.name)).map(r => r.name.split('/').pop())
      ```
    - 鍵盤：打字 → ↓↑ 移動 `.search-hit.is-active` → Enter 選取；Escape 第一次關清單、第二次清空輸入框

### ⚠️ 用瀏覽器自動化點 UI 的三個陷阱

- **主題頁的底圖選單藏在左下角「圖層」彈出層裡**，必須先 `document.querySelector('.map-tile').click()` 才找得到 `<select>`；`/compare` 的仍然直接在頁首。
- **底圖下拉選單的 CSS class 在 `<label>` 上，不是 `<select>` 上。** 選擇器要寫 `.basemap-select select`，寫成 `.basemap-select` 會拿到 label，`.value = …` 只是加了一個沒人看的屬性，**切底圖根本不會發生**，而測試看起來還是「通過」。
- **React 會用 `_valueTracker` 記住上次的值**，直接指派 `.value` 再 `dispatchEvent(new Event('change'))` 會被忽略。要先 `sel._valueTracker?.setValue('__force__')` 再指派。

### 部署後

```bash
curl -I  https://gaia.kigi.tw            # 200 + HTTPS
curl -s  https://gaia.kigi.tw/CNAME      # gaia.kigi.tw
dig +short gaia.kigi.tw                  # 應指向 kigichang.github.io / 185.199.x.153

# 深層連結：狀態碼會是 404（見下），要檢查的是「內容為 app shell」
curl -s https://gaia.kigi.tw/compare | grep -c '<div id="root">'   # 應為 1
```

**關於深層連結的 404 狀態碼**：GitHub Pages 沒有 SPA rewrite，`/compare` 這類路徑一定會走 404.html，所以 **HTTP 狀態碼就是 404**，這無法用 `postbuild` 的複製手法消除。使用者在瀏覽器開啟時完全正常（回傳的是 app shell，React Router 會接手算繪），但爬蟲與 SEO 會把它視為不存在。

若之後需要真正的 200，唯一的靜態解法是改用 `HashRouter`（網址變成 `gaia.kigi.tw/#/compare`）。目前選擇保留乾淨網址，接受 404 狀態碼。

---

## 部署

`.github/workflows/deploy.yml`：push 到 `main` → `npm ci` → `npm run build` → `upload-pages-artifact`（`dist`）→ `deploy-pages`。

`scripts/postbuild.mjs` 會把 `dist/index.html` 複製成 `dist/404.html`。GitHub Pages 沒有 SPA rewrite，直接開 `gaia.kigi.tw/compare` 會 404；Pages 找不到路徑時會回站台根目錄的 404.html，React Router 就能接手。同一支腳本也會確認 `CNAME` 與 `.nojekyll` 有被複製到 `dist/`。

### 一次性設定（人工）

1. GitHub repo → Settings → Pages → **Source 設為 "GitHub Actions"**
2. Custom domain 填 `gaia.kigi.tw`，憑證簽發後勾 **Enforce HTTPS**
3. DNS（`kigi.tw` 託管於 cyberdns.tw）新增：
   ```
   gaia.kigi.tw.   CNAME   kigichang.github.io.
   ```
   子網域用 CNAME，不要用 A record。

---

## 目錄結構

```
src/
├─ config.ts              # 所有資料源端點與等高線參數
├─ chrome.ts              # ChromeState 型別（底圖／疊圖／淺深色，兩種外框共用）
├─ useTheme.ts            # 淺色／深色／自動（localStorage: gaia-theme）
├─ useDrawerOpen.ts       # 圖層抽屜開關記憶（localStorage: gaia-layer-drawer）
├─ usePopover.ts          # 彈出層／抽屜共用的開關、Escape 與焦點處理
├─ lib/schema.ts          # zod schema（建置期驗證用）
├─ search/searchIndex.ts  # 主題頁搜尋索引（跨三個主題，lazy 建立）
├─ content/
│  ├─ index.ts            # import.meta.glob 載入地點/原住民族/物種；氣候與物種觀測點 JSON 用 fetch
│  ├─ places/*.json
│  ├─ indigenous/*.json   # 16 族代表點
│  └─ species/*.json      # 物種介紹文字（不含座標）
│  └─ geo/<collection>/*.json  # 地理要素說明（選填，沒有就走 FeatureCard fallback）
├─ map/
│  ├─ demSource.ts        # 單例 DemSource
│  ├─ basemaps.ts         # 底圖樣式組裝 + OpenFreeMap 失敗時的備援
│  ├─ layers/{contour,hillshade,terrain}.ts
│  ├─ layers/geo.ts       # 通用圖層 helper（circle/line/fill）
│  ├─ MapView.tsx         # 單張地圖元件
│  ├─ useMapSync.ts       # 緯度／zoom 同步（比較頁）
│  ├─ useGeoLayers.ts     # 主題圖層管理（主題頁）
│  ├─ layerOrder.ts       # 冪等的堆疊順序後處理
│  ├─ registry/           # 圖層註冊表（純資料，Node 可 import）
│  └─ thematicColors.ts   # 主題圖層顏色（已用 dataviz 驗證器驗證）
├─ compare/               # 同緯度比較頁（獨立，未被註冊表系統改動）
├─ pages/ThemeMapPage.tsx # 主題地圖頁 /theme/:themeId，同時負責組裝 .map-shell
└─ components/
   ├─ SiteHeader.tsx      # /compare 專用頁首（主題頁沒有頁首）
   ├─ AppMenu.tsx         # 主題導覽 + 淺深色（floating=⋮⋮⋮ 彈出層／inline=頁首）
   ├─ MapPopover.tsx      # ⋮⋮⋮ 與「圖層」磚共用的泡泡容器
   ├─ MapLayersPopover.tsx# 左下「圖層」磚（內容重用 LayerToggles）
   ├─ MapSearchBox.tsx    # 左上搜尋藥丸（含開抽屜的 ☰）與建議清單
   ├─ DonateButton.tsx    # 搜尋藥丸右邊的贊助按鈕，另開分頁連到均一
   ├─ LayerDrawer.tsx     # 圖層抽屜外框（觸發器在搜尋藥丸裡，見上）
   ├─ MapDetailPanel.tsx  # 左側詳情面板外框（≤860px 變底部卡）
   ├─ DetailCard.tsx      # 選取 → 對應詳情卡的分派
   ├─ ThemeBrowse.tsx     # 圖層抽屜裡的可點清單（browseLayerExtra）
   └─ PlaceCard/IndigenousCard/SpeciesCard/FeatureCard/LayerPanel/MapLegend…
public/data/
├─ climate/*.json         # build:climate 產生
├─ species/*.geojson      # build:species 產生
├─ geo/*.geojson          # build:geodata 產生（禁止手改）
└─ geo-manual/*.geojson   # 手繪教學示意幾何（可以手改）
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ build-species.mjs      # GBIF → public/data/species
├─ build-geodata.mjs      # Natural Earth / USGS → public/data/geo
├─ lib/simplify.mjs       # 自帶的 Douglas–Peucker（刻意不加依賴）
├─ validate-content.mjs   # 建置前 schema 驗證 + 註冊表交叉檢查
└─ postbuild.mjs          # 404.html + CNAME 確認
```

`src/content/index.ts` 直接把 JSON 當成對應型別使用而不在瀏覽器端跑 zod——建置期已經驗過，不必把 zod 打包進前端。
