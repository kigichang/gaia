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

### ⚠️ NLSC 的路徑順序陷阱

NLSC WMTS 是 `{z}/{y}/{x}`——**y 在 x 前面**，跟絕大多數 XYZ 服務相反。寫成 `{z}/{x}/{y}` 仍然會回 HTTP 200，只是拿到位置完全錯亂的圖磚，不會有任何錯誤訊息。

### 氣候資料為什麼要預先產製

`scripts/build-climate.mjs` 在建置期抓 1991–2020 逐日資料，聚合成 12 個月的均溫與月雨量，輸出到 `public/data/climate/<place-id>.json`。網站執行期只讀本地 JSON。

理由：一個班級同時開站會對 Open-Meteo 產生大量請求而被限流（實測連抓 5 個地點就會收到 429）；而且執行期抓 30 年逐日資料再聚合會讓圖表等好幾秒。

**已知資料限制**：ERA5 是約 25 km 網格的再分析資料，會平滑掉小島與陡峭地形的地形雨。例如希洛實測年雨量約 3300 mm，ERA5 只給約 1590 mm。用於教學比較的量級關係仍然正確，但**不要把這些數字當成氣象站觀測值引用**。

---

## 硬性禁止事項

1. **不得引入任何需要 API key、token 或付費金鑰的服務。** MapTiler、Mapbox、Google Maps 一律不用。純靜態站沒有地方藏金鑰。
2. **不得把 `vite.config.ts` 的 `base` 改成 `/gaia/`。** 掛了自訂網域之後網站是從 `gaia.kigi.tw` 的根路徑供應，`base` 必須是 `/`。
3. **不得刪除 `public/CNAME` 與 `public/.nojekyll`。** 刪掉 CNAME 會讓 GitHub Pages 解除自訂網域綁定。
4. **不得移除 `optimizeDeps.exclude: ["maplibre-gl"]`。** 見上面的版本陷阱。
5. **不得在執行期呼叫 Open-Meteo。** 氣候資料一律走 build-time 產製。
6. **不得手動編輯 `public/data/climate/*.json`。** 由 `npm run build:climate` 產生。
7. **不得使用雙 Y 軸圖表。** 兩個刻度可以任意縮放，會讓氣溫線與雨量柱的交叉看起來像有因果關係。詳見下面的圖表規範。

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
```

`build:climate` 對 Open-Meteo 有指數退避重試（429 時等 5s/10s/20s…），連抓多個地點被限流是正常的，重跑一次即可補齊。

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
│  ├─ index.ts            # import.meta.glob 載入地點；氣候 JSON 用 fetch
│  └─ places/*.json
├─ map/
│  ├─ demSource.ts        # 單例 DemSource
│  ├─ basemaps.ts         # 底圖樣式組裝 + OpenFreeMap 失敗時的備援
│  ├─ layers/{contour,hillshade,terrain}.ts
│  ├─ MapView.tsx         # 單張地圖元件
│  └─ useMapSync.ts       # 緯度／zoom 同步
├─ compare/               # 同緯度比較頁
├─ pages/ExplorePage.tsx  # 單張地圖的地形探索頁
└─ components/
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ validate-content.mjs   # 建置前 schema 驗證
└─ postbuild.mjs          # 404.html + CNAME 確認
```

`src/content/index.ts` 直接把 JSON 當成 `Place` 使用而不在瀏覽器端跑 zod——建置期已經驗過，不必把 zod 打包進前端。
