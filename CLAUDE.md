# Gaia — 國/高中地理課程互動地圖

## 專案定位

把國中／高中地理課程內容整理到一張帶等高線的地圖上，並提供「**比較同緯度、不同地區**」的互動工具。內容涵蓋四個主題：臺灣地理、世界地理、氣候與自然地理專題、人文地理。

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

全部免金鑰、支援 CORS、已實測可從瀏覽器直接存取。端點常數集中在 `src/config.ts`，不要在別處寫死。

| 用途 | 端點 | 備註 |
|---|---|---|
| 全球 DEM | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | AWS Open Data，terrarium 編碼，**maxzoom 15**，`ACAO: *` |
| 世界底圖 | `tiles.openfreemap.org/styles/liberty` | 免費無金鑰無流量限制，但**無 SLA** |
| 世界底圖備援 | `basemaps.cartocdn.com/gl/positron-gl-style/style.json` | Liberty 載入失敗時自動切換 |
| 臺灣通用電子地圖 | `wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}` | 國土測繪中心 |
| 臺灣正射影像 | 同上，`EMAP` → `PHOTO2` | |
| 氣候正常值 | `archive-api.open-meteo.com/v1/archive`（ERA5） | **只在建置期呼叫** |
| 特有種觀測紀錄 | `api.gbif.org/v1/occurrence/search`（GBIF） | **只在建置期呼叫**，`ACAO: *` |

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
10. **不得憑感覺挑主題圖層的顏色。** 改動或新增 `src/map/thematicColors.ts` 的顏色前，必須重新用 dataviz skill 的 `scripts/validate_palette.js`（`--pairs all`，因為主題圖層是可任意複選的核取方塊，不能只驗證清單裡「相鄰」的顏色）驗證明暗兩模式，理由與已驗證過的組合見該檔案的註解。

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
| `PLACES_SOURCE_ID` / `PLACES_LAYER_ID` | `places-source` / `places-points` | geojson / circle（Explore 頁主題圖層） |
| `INDIGENOUS_SOURCE_ID` / `INDIGENOUS_LAYER_ID` | `indigenous-source` / `indigenous-points` | geojson / circle |
| `speciesSourceId(id)` / `speciesLayerId(id)` | `species-<id>-source` / `species-<id>-points` | geojson / circle，每個物種各自一組 |

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

## Explore 頁的主題圖層系統

Explore 頁（`src/pages/ExplorePage.tsx`）可複選疊加三種主題：地形景點、原住民族分佈、特有種生態分佈。三種都用同一組 `src/map/layers/points.ts` 的通用 helper（`addPointLayer`/`removePointLayer`/`toFeatureCollection`），差別只在資料來源與顏色。

### 關鍵坑：切換底圖會清掉主題圖層

`MapView.tsx` 切換底圖時呼叫 `map.setStyle()`，會清空所有自訂 source/layer，然後在 `style.load` 事件重新加回 contour/hillshade（見上面等高線那節）。**主題圖層不是 `MapView` 加的，`MapView` 不知道要重新套用它們。**

解法是 `src/map/useThematicLayers.ts`：不修改 `MapView`，改為直接對外部拿到的 `map` 實例額外掛一個 `style.load` 監聽，每次都重新套用主題圖層。`map.on(event, layerId, handler)` 的點擊/hover 監聽是掛在 Map 實例上、不是掛在圖層上，所以那些監聽只需要在圖層第一次建立時綁一次，`setStyle` 造成的圖層重建不需要重綁——`useThematicLayers.ts` 用兩層 `useEffect` 分開處理這兩件事（互動綁定 vs. 圖層新增/移除），改動時不要合併成一個。

呼叫端（`ExplorePage.tsx`）傳給 `useThematicLayers` 的 `config` 物件要用 `useMemo`：這個 hook 的 effect 依賴整個 `config` 物件參照，每次拿到新物件就會重跑一次套用邏輯。

**改動這個系統後必須實測「切底圖時主題圖層是否還在」**（不只測初始渲染），這是最容易回歸的地方：

```js
// production build (npm run preview) 下驗證，不能只測 dev
m.getLayer('indigenous-points')
m.queryRenderedFeatures({ layers: ['species-mikado-pheasant-points'] }).length
```

### 顏色

`src/map/thematicColors.ts` 是唯一的顏色來源，不要在元件裡另外寫顏色：

- 地形景點（藍 `#2a78d6`）、原住民族分佈（紅 `#e34948`）是固定單一色——清單靠點擊瀏覽，不靠顏色分類比較。
- 特有種是唯一需要「依類別上色以便一眼比較」的圖層，因為多物種疊圖時顏色是分辨「這是哪個物種」的主要方式。目前是青／黃／紫三色（`SPECIES_COLORS`），對應 `MAX_SIMULTANEOUS_SPECIES = 3`——UI 會在達到這個數量後停用其餘物種的核取方塊。

這五個顏色不是隨手選的：用 dataviz skill 的 `validate_palette.js` 以 `--pairs all` 驗證過（核取方塊可以任意複選組合，不能只驗證清單裡相鄰的顏色）。混更多顏色進去大機率會失敗——實測過橘配黃、青配洋紅在其中一種色盲模式下 ΔE 會掉到 2–7（遠低於安全門檻 15），這也是為什麼原住民族分佈選了「紅」而不是調色盤順位第二的「橘」（橘要留給物種色票，紅跟藍、紅跟青黃紫都驗證過安全）。**要調色或加物種顏色，先跑驗證器，不要憑感覺挑。**

### 資料整理方式

兩種新內容型別分別沿用專案既有的兩種資料模式，沒有發明新架構：

**原住民族分佈**（比照地點資料的手動整理模式）：
1. 建立 `src/content/indigenous/<id>.json`，**檔名必須等於 `id`**
2. `representativeCoord` 選文化園區、部落大會地點或行政中心，**不是**正式的分布邊界，UI 文案與資料撰寫都要避免暗示這是精確的地理範圍
3. `npm run validate` 確認通過

```jsonc
{
  "id": "amis",
  "name": { "zh": "阿美族", "en": "Amis (Pangcah)" },
  "representativeCoord": { "lat": 23.9871, "lng": 121.6015 },
  "mainDistribution": ["花蓮縣", "台東縣"],   // 文字列表，不是邊界資料
  "populationEstimate": 228000,               // 選填，要填就要填 populationYear
  "populationYear": "2024",
  "language": "阿美語（Pangcah / Amis）",
  "facts": [{ "label": "族群規模", "value": "……" }],
  "curriculum": { "level": "junior", "unit": "台灣的原住民族" },
  "sources": ["內政部 114年第6週內政統計通報（113年底原住民人口數）"]
}
```

目前 16 族的骨架（id／中英文名／代表座標／主要分布）都已建好；`facts` 與完整人口統計目前只有 5 族（阿美、排灣、泰雅、布農、達悟）做了完整示範，其餘 11 族先放最小可行的 facts（分布地區、語言等不需要外部查證的穩定事實）。要補完剩下的族，照上面的格式加 `facts`／`sources` 即可，不需要改任何程式碼。

**特有種生態分佈**（比照氣候資料的 build-time fetch 模式）：
1. 建立 `src/content/species/<id>.json`（物種介紹文字，不含座標）
2. 用 `https://api.gbif.org/v1/species/match?name=<學名>` 查 `gbifTaxonKey`
3. 執行 `npm run build:species` 產生 `public/data/species/<id>.geojson`（已存在的會跳過，`--force` 可重抓）
4. `npm run validate` 確認通過，且 geojson 的 `speciesId` 都能對應到 species 內容檔

```jsonc
{
  "id": "mikado-pheasant",
  "name": { "zh": "帝雉", "en": "Mikado Pheasant", "latin": "Syrmaticus mikado" },
  "gbifTaxonKey": 2473482,
  "category": "bird",                // mammal|bird|fish|amphibian|reptile|insect
  "conservationStatus": "瀕臨絕種保育類野生動物",  // 選填
  "habitat": "海拔 2000–3800 公尺的中高海拔針闊葉混合林與箭竹草原",
  "facts": [{ "label": "特徵", "value": "……" }],
  "curriculum": { "level": "senior", "unit": "台灣的自然地理與生態" },
  "sources": ["GBIF Global Biodiversity Information Facility"]
}
```

目前收錄 5 種示範（台灣黑熊、帝雉、台灣獼猴、櫻花鉤吻鮭、台灣穿山甲）。要新增物種，先用 `species/match` 確認 GBIF 有足夠觀測量（幾十筆以上比較有意義），再照上面步驟加資料。

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
npm run validate        # zod 驗證 src/content 與 public/data/climate
npm run build           # validate → typecheck → vite build → postbuild
npm run preview         # 預覽 production build
npm run build:climate   # 產生氣候 JSON（已存在會跳過）
npm run build:climate -- --force   # 全部重抓
npm run build:species   # 產生特有種觀測點 geojson（已存在會跳過）
npm run build:species -- --force   # 全部重抓
```

`build:climate` 對 Open-Meteo、`build:species` 對 GBIF 都有指數退避重試（429 時等 5s/10s/20s…），連抓多筆被限流是正常的，重跑一次即可補齊。

---

## 驗證方式

### 開發模式的地圖除錯掛勾

`import.meta.env.DEV` 為真時，`MapView` 會把地圖實例掛到 `window.__gaiaMaps`，並透過 `canvasContextAttributes.preserveDrawingBuffer` 保留繪圖緩衝區。

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
const m = window.__gaiaMaps[0];
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
8. Explore 頁：三個主題圖層核取方塊可任意複選疊加；複選多個物種後**切換底圖**，確認圖層都還在（見「Explore 頁的主題圖層系統」的關鍵坑）；點地圖上的標記跟點側欄清單都能開啟對應詳情卡且互相 highlight

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
├─ lib/schema.ts          # zod schema（建置期驗證用）
├─ content/
│  ├─ index.ts            # import.meta.glob 載入地點/原住民族/物種；氣候與物種觀測點 JSON 用 fetch
│  ├─ places/*.json
│  ├─ indigenous/*.json   # 16 族代表點
│  └─ species/*.json      # 物種介紹文字（不含座標）
├─ map/
│  ├─ demSource.ts        # 單例 DemSource
│  ├─ basemaps.ts         # 底圖樣式組裝 + OpenFreeMap 失敗時的備援
│  ├─ layers/{contour,hillshade,terrain,points}.ts
│  ├─ MapView.tsx         # 單張地圖元件
│  ├─ useMapSync.ts       # 緯度／zoom 同步（比較頁）
│  ├─ useThematicLayers.ts # 主題圖層管理（探索頁）
│  └─ thematicColors.ts   # 主題圖層顏色（已用 dataviz 驗證器驗證）
├─ compare/               # 同緯度比較頁
├─ pages/ExplorePage.tsx  # 探索頁：可複選疊加地形景點/原住民族/特有種
└─ components/            # PlaceCard/IndigenousCard/SpeciesCard/MapLegend/ThematicLayerPanel…
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ build-species.mjs      # GBIF → public/data/species
├─ validate-content.mjs   # 建置前 schema 驗證
└─ postbuild.mjs          # 404.html + CNAME 確認
```

`src/content/index.ts` 直接把 JSON 當成對應型別使用而不在瀏覽器端跑 zod——建置期已經驗過，不必把 zod 打包進前端。
