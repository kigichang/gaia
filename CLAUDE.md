# Gaia — 地理課程互動地圖

## 專案定位

把國小／國中／高中的地理課程內容整理到一張帶等高線的地圖上，**以主題而不是年級來組織**，並提供「**比較同緯度、不同地區**」的互動工具。

目前兩個主題：臺灣地理、世界地理（各主題底下的圖層見「主題地圖頁與圖層註冊表」）。

> 「全球地理形貌」在 2026-08 併進「世界地理」，全球尺度的圖層排在前面當骨架。
> 舊網址 `/theme/global` 由 `App.tsx` 重導，**那條路由不要拿掉**。

**部署**：GitHub Pages（repo `kigichang/gaia`），自訂網域 `https://gaia.kigi.tw`。

**最重要的架構約束**：整站必須是**純靜態、無後端、無 API key**。沒有伺服器可以代理請求或藏金鑰，任何需要簽章或私密憑證的服務都不能用。所有技術選擇都從這條約束推導。

---

> ⚠️ **臺灣地理主題的圖層文件在 `CLAUDE_TW.md`，那份不會自動載入。**
> 要動 `/theme/taiwan` 的任何圖層——`src/map/registry/themes/taiwan.ts`、
> `scripts/lib/` 底下對應的存取層、`public/data/geo/tw-*`、`src/content/geo/tw-*`
> ——**請先把 `CLAUDE_TW.md` 讀完再開始**。那裡有各圖層的資料來源、取得邏輯、
> 踩過的坑與第 15–27 項驗證清單。本檔案只留跨主題的部分。

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
| 臺灣縣市界線 | `data.gov.tw/api/v2/rest/dataset/7442` → TGOS 的 GML zip（內政部國土測繪中心） | **只在建置期呼叫**，政府資料開放授權條款第 1 版 |
| 鄉鎮別人口與人口密度 | `data.gov.tw` 資料集 **8410**「各鄉鎮市區人口密度」→ `opdadm.moi.gov.tw` 的年度 CSV | **只在建置期呼叫**，內政部戶政司。⚠️ **前兩列都是標頭**，年份寫死不自動取最新，見下 |
| 鄉鎮別作物種植面積 | `data.gov.tw` 資料集 **7302**「農情調查」→ `data.moa.gov.tw/Service/OpenData/FromM/TownCropData.aspx` | **只在建置期呼叫**（有 CORS 但 43,538 筆不該讓瀏覽器自己聚合）。⚠️ **不帶篩選只回 9999 筆**，且**不含水稻**，見下 |
| 臺灣鄉鎮市區界線 | `data.gov.tw/api/v2/rest/dataset/**7441**` → TGOS 的 **SHP** zip（同一個單位） | **只在建置期呼叫**。⚠️ 這份**沒有 GML 只有 SHP**，而且 zip 裡有兩份 shapefile，見下 |
| 世界行政區／河流幾何、國際換日線、大洲分區、主要山脈與最高峰 | `raw.githubusercontent.com/nvkelso/natural-earth-vector`（Natural Earth） | **只在建置期呼叫**，public domain。換日線在 `ne_10m_geographic_lines`；大洲是 `ne_50m_admin_0_countries` 依 `CONTINENT` 併起來的；山脈是 `ne_10m_geography_regions_polys` 裡 `FEATURECLA === "Range/mtn"` 的**面**、最高峰是 `ne_10m_geography_regions_elevation_points`，見下 |
| 板塊與板塊邊界 | `raw.githubusercontent.com/fraxen/tectonicplates`（Bird 2003／Nordpil 轉製） | **只在建置期呼叫**，ODC-BY 1.0（**必須標示出處**）。邊界的三分類在 10 MB 的 `PB2002_steps.json` 裡，見下 |
| 臺灣與鄰國專屬經濟海域 | `geo.vliz.be/geoserver/MarineRegions/wfs`（Marine Regions／Flanders Marine Institute，Maritime Boundaries v12） | **只在建置期呼叫**，免金鑰的公開 WFS，CC-BY（**必須標示出處**）。⚠️ 我國從未公告經濟海域外界線，官方那份 12／24 浬向量在 NODASS 要登入，見 `CLAUDE_TW.md` |
| 地震目錄 | `earthquake.usgs.gov/fdsnws/event/1/query`（USGS） | **只在建置期呼叫**，免金鑰、`ACAO: *`。全球與臺灣兩層共用這一個端點 |
| 全球活火山 | `webservices.volcano.si.edu/geoserver/GVP-VOTW/ows`（史密森尼學會 全球火山計畫 GVP） | **只在建置期呼叫**，WFS 一次回 2.4 MB 的 GeoJSON。免金鑰、不需要 User-Agent；授權是「引用即可自由使用」，見下 |
| 陸域生物群系 | `services.arcgis.com/…/Resolve_Ecoregions/FeatureServer`（RESOLVE Ecoregions 2017，Esri Living Atlas 代管） | **只在建置期呼叫**，用伺服器端的 `maxAllowableOffset` 取已化簡的幾何。⚠️ 授權 CC-BY 4.0（**必須標示出處**）；⚠️ 連發會回一個指著參數的假 400，見下 |
| 柯本氣候分區 | `koeppen-geiger.vu-wien.ac.at/data/Koeppen-Geiger-ASCII.zip`（Kottek et al. 2006） | **只在建置期呼叫**，zip 裡是一個 `Lat Lon Cls` 三欄的 0.5° 網格文字檔（92,416 格）。⚠️ 期距是 1951–2000；新版與 Esri 那份都只有點陣，見下 |
| 臺灣活動斷層 | `geologycloud.tw/data/zh-tw/ActiveFault`（經濟部地質調查及礦業管理中心「地質雲」） | **只在建置期呼叫**。⚠️ data.gov.tw 那份**只有 WMS 影像**，拿不到向量；而且這是 **33 條的舊版**，見下 |
| 交通軸線幾何（高鐵／國道／橫貫公路／臺鐵幹線）、河川幹流河道 | `overpass-api.de/api/interpreter`（OpenStreetMap Overpass） | **只在建置期呼叫**，ODbL 1.0。⚠️ **沒有 User-Agent 一律回 HTTP 406**；河川的選擇器**不能寫 `waterway=river`**（一半以上是 `stream`），要用 `type=waterway`＋`ref`，見下 |
| 水庫基本資料／水庫水情 | `opendata.wra.gov.tw/api/v2/…?format=CSV`（經濟部水利署） | **只在建置期呼叫**。⚠️ **沒有 CORS 標頭**（瀏覽器一定抓不到），而且掛著 bot 防護，見下 |
| 水庫蓄水範圍 | `gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=ressub&filetype=KML` | **只在建置期呼叫**，約 38 MB 的 KML，只用來算形心 |
| 河川流域範圍圖 | `gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=BASIN&filetype=SHP` | **只在建置期呼叫**，SHP（面），座標系統 TWD97/TM2 zone 121。⚠️ join 用 `BASIN_NO`（＝河川代碼去掉末位）**不要用名稱**，且只涵蓋 118 個水系裡的 72 個，見下 |
| 河川長度／流域面積 | `www.wra.gov.tw/cp.aspx?n=3163&dn=3164`（經濟部水利署） | 沒有開放資料 API，人工抄錄進 `scripts/lib/rivers.mjs` 的 `RIVERS`。⚠️ **只有 24 條中央管與 2 條跨省市河川有**，其餘 92 條的界點由地方政府各自公告 |
| 各河的發源地／入海口／主要支流／坡降／流經行政區 | `www.wra.gov.tw/cl.aspx?n=3259｜3270｜3285｜3306`（讓我們看河去(中央管河川)）與 `?n=3328`（縣市管河川） | 沒有開放資料 API，人工抄錄進 47 份內容檔。⚠️ **縣市管那 21 條連幹線長度與流域面積都有**，已寫進 `RIVERS`（`lengthSource: "看河去"`），是〈河川長度〉總表以外的第二份官方數字 |
| 國家公園範圍 | `data.gov.tw/api/v2/rest/dataset/174421` →（索引 CSV）→ `tgos.tw` 各處的 SHP／KML；陽明山另走 `ogcmap.tgos.tw/…/Ymsnp3PlanBorder/SimpleWFS.aspx` | **只在建置期呼叫**，內政部國家公園署。座標是 **TWD97 TM2 公尺**，見下 |
| 台江國家公園範圍 | `data.depositar.io`（中研院研究資料寄存所） | **只在建置期呼叫**。官方那兩份包在 7z 裡，見下；**這台主機只講 HTTP/2** |
| 自然保留區／野生動物保護區／自然保護區 | `data.moa.gov.tw/api/FileToJson.ashx?DataId=157｜162｜350` → SHP zip | **只在建置期呼叫**，農業部林業及自然保育署 |
| 古蹟（國定／直轄市定／縣市定） | `data.gov.tw` 資料集 **6246** → `data.boch.gov.tw/opendata/v2/assetsCase/1.1.json` | **只在建置期呼叫**（8.1 MB、**沒有 CORS 標頭**），文化部文化資產局。⚠️ 座標有 5 筆經緯度顛倒，見下 |
| 颱風最佳路徑／災情 | `rdc28.cwa.gov.tw/TDB/`（交通部中央氣象署颱風資料庫） | **只在建置期呼叫**。免金鑰、免登入，但是**沒有文件的內部端點**；災情欄轉載自內政部消防署與農業部，見下 |
| 災害地震（官方清單） | `scweb.cwa.gov.tw/zh-tw/page/disaster/5`（交通部中央氣象署地震測報中心） | **只在建置期呼叫**。⚠️ 沒有開放資料 API（那邊要金鑰），只能剖析 HTML 表格；⚠️ **只收到 2022-09-18**，見下 |
| 臺灣海峽中線的座標 | 國防部 2019-07-30 記者會公布的「北緯 27 度、東經 122 度至北緯 23 度、東經 118 度」 | **程式完全不呼叫**。⚠️ 國防部**沒有把它放成可連結的公告或開放資料**，只能人工轉錄進 `public/data/geo-manual/tw-strait-median-line.geojson`，見 `CLAUDE_TW.md` |
| 基本地理事實（山脈走向、主峰高度、河川路徑、河川分界…） | `zh.wikipedia.org` 各條目 | **程式完全不呼叫**，人工查閱後寫進 `src/content/` 與 `public/data/geo-manual/`。次級來源，用法見「內容撰寫規範」，CC BY-SA |

### ⚠️ NLSC 的路徑順序陷阱

NLSC WMTS 是 `{z}/{y}/{x}`——**y 在 x 前面**，跟絕大多數 XYZ 服務相反。寫成 `{z}/{x}/{y}` 仍然會回 HTTP 200，只是拿到位置完全錯亂的圖磚，不會有任何錯誤訊息。

### 板塊與板塊邊界：全站第一個「面帶名字」的圖層

「地體構造」群組底下的 `plates`（52 塊板塊，面）與 `plate-boundaries`（三種邊界，線）
是同一份資料的兩層，取得邏輯關在 `scripts/lib/plates.mjs`。

#### 為什麼是 Bird (2003) 而不是 USGS 或 Natural Earth

`plate-boundaries` 原本掛著 `status: "planned"`、`sources: ["USGS"]`，但 USGS 只有靜態
圖片、Natural Earth 沒有板塊。**Bird (2003) 的 PB2002 是唯一一份公開、帶完整幾何、
而且每一小段邊界都標了種類的全球模型**——課本講的「聚合、張裂、錯動三種板塊邊界」
要畫得出來就得有那個分類欄位。幾何取自 Hugo Ahlenius / Nordpil 轉製的 GeoJSON 版。

⚠️ **授權是 ODC-BY 1.0，要求標示出處**，所以兩層的 `sources` 都必須同時列
`Peter Bird (2003) 板塊模型` 與 `Nordpil 板塊資料集`，少一個就違反授權（比照
`tw-rivers` 對 OpenStreetMap 的 ODbL 署名義務）。

#### ⚠️ 不要改用 `PB2002_boundaries.json`，那份分不出三種邊界

同一個資料夾裡的 `PB2002_boundaries.json` 只有 241 條乾淨的線、檔案也小得多，很容易
以為它才是對的來源。但它的 `Type` 欄位**只分得出 subduction（65 條）與空字串
（176 條）**，畫不出三分類。三分類在 10 MB 的 `PB2002_steps.json` 裡（5,824 段，
每段帶 `STEPCLASS`：OSR／CRB → 張裂、SUB／OCB／CCB → 聚合、OTF／CTF → 錯動）。
10 MB 只在建置期下載，產物是 87 KB。

#### ⚠️ 邊界的產物**刻意只有三筆圖徵**

每一種邊界是一個 MultiLineString，裡面有幾百段（張裂 661、聚合 205、錯動 716）。
一段一筆會壞掉一件事：註冊表用 `LayerItem.featureIds` 把子項目從母圖層切出來，而那是
一份**寫在 `themes/global.ts` 裡的 id 清單**——1,582 行 id 是不能接受的。而逐段點選也
沒有教學意義（要點開的是「這是哪一種邊界」不是「這是哪一小段」），所以三筆剛剛好。

#### 三種邊界各有一張說明卡，而三個 id 必須是同一個字串

課本講的「三種板塊邊界」要講的是**各自怎麼動、造出什麼地形、哪裡看得到**，圖層說明
只塞得下一句話，所以三種各有一份內容檔：`src/content/geo/plate-boundaries/{divergent,
convergent,transform}.json`，圖層的 `detail` 因此是 `{ type: "geo", collection:
"plate-boundaries" }`。點地圖上的線、或點抽屜裡的子項目名稱，開的是同一張卡。

⚠️ **`detail` 不可以退回 `"none"`。** 除了說明沒地方放之外還會壞掉一件事：
`handleItemNameClick` 照樣會 `setSelected`，而 `DetailCard` 對 `none` 回 `null`——
點抽屜裡的「張裂型邊界」會開出一張**空白面板**（`data-detail-open` 仍是 true），
完全靜默。垂直植被帶那一層也踩過同一個坑。

⚠️ **geojson 的 `properties.id` 不帶 `boundary-` 前綴**（早期版本帶，2026-08 拿掉並
重跑了 `build:geodata`）。比照交通軸線的既有規則：**geojson 的 id、註冊表的 item id、
內容檔的檔名必須是同一個字串**。不一致的話點子項目名稱傳的是 item id、點地圖上的線
傳的是圖徵 id，兩條路徑會開出不同的卡；而且「只顯示這一筆」的 `setFilter` 會一筆都
比對不到、整層消失。

串接規則：相同 `PLATEBOUND`、相同分類、而且前一段的終點等於後一段的起點，就併成一條線
（實測 5,613 對接得上、只有 8 對接不上）。不併的話會得到 5,824 條各三十幾個點的碎線，
Douglas–Peucker 幾乎砍不掉任何東西。

⚠️ 跟國際換日線同一個坑：**每一段都不可以跨越 ±180**，跨了 maplibre 會畫一條繞過整個
地球的橫線而且不報錯。transform 逐段檢查經度跨距（實測最長的一段只跨 57.5°）。

#### ⚠️ 面積一定要用球面公式，而且總和就是自我檢查

`geometryAreaKm2()` 用的是球面多邊形面積（standard spherical excess）。**不可以用平面
shoelace**：那算出來的單位是「平方度」，高緯度會嚴重高估，南極板塊會變得比太平洋板塊
還大。

**52 塊板塊鋪滿整個地球，所以面積總和必須等於地球表面積**——實測 510.1 百萬 km²，
誤差 -0.01%。build 時對不上就直接失敗。那是唯一能抓到「投影或幾何弄錯」的檢查，
比照國家公園的 `officialHa` 交叉比對。

⚠️ **算出來的面積跟課本／維基百科的數字對不起來是正常的**，不要「修正」它：那些數字
多半把子板塊算進母板塊（北美板塊 7,590 萬 km² 含鄂霍次克與格陵蘭，Bird 分開算是
5,543 萬；歐亞 6,780 萬 vs 4,856 萬）。圖層的 `notes` 有交代。

#### ⚠️ 主要板塊是 8 塊，不是課本說的 7 塊

Bird 把課本合稱的「印澳板塊」分成印度板塊與澳洲板塊兩塊。**不要為了湊 7 塊把其中一塊
降級**——那會讓清單跟地圖上的界線對不起來。這件事寫在 `notes` 裡。

中文名與「主要／次要／微板塊」的分類逐筆取自維基百科〈板塊列表〉（zh-tw），對照表在
`lib/plates.mjs` 的 `PLATES`（52 筆，代碼對不到就讓建置失敗）。比照五大山脈與颱風的
既有做法：維基百科是次級來源，只拿來查名稱，數值一律自己算。

⚠️ 分類是**依維基百科的傳統分法**，不是依面積——索馬利亞板塊（次要，1,915 萬 km²）比
印度板塊（主要，1,243 萬）還大。那不是排序錯了。

#### 面圖層的標註是新加的算繪能力

`LayerRender` 的 fill 變體多了 `label`，`geo.ts` 的 fill 分支因此會多開一個
`${instanceId}-label` 的 symbol 圖層（`symbol-placement: point`）。板塊是第一個
用到它的圖層——「標出各板塊」如果沒有名字就等於沒做；第二個是臺灣主題的
`tw-eez`（四片專屬經濟海域）。

- **不需要在建置期算形心**：maplibre 對多邊形會自己算錨點。
- ⚠️ **但那個錨點是逐圖磚算的，所以同一塊面放大之後會被重複標註。** 實測 `tw-eez`
  沒設上限時 zoom 5 每片 1 個、zoom 6 變 4 個、**zoom 8 的臺灣那一片有 6 個「臺灣」
  散在海上**。板塊沒踩到只是因為它 `maxzoom: 8` 而且實際只在 zoom 1–3 看。
  `label.maxzoom` 就是為此加的（**只擋標註、不擋面**）；不要改成在建置期算形心去繞過它。
- ⚠️ **MultiPolygon 的每一塊都會拿到一個標註。** 實測只有 4 塊板塊是 MultiPolygon
  （太平洋 3 塊、澳洲 2 塊、克馬德克與巴爾莫勒爾礁各 2 塊），其中太平洋的兩大塊是
  ±180 兩側的真實兩半、標兩次是對的，真正多餘的只有兩個小碎塊。**這是已知行為，
  不是 bug。**
- ⚠️ **文字色刻意不用圖層色**（`geo.ts` 的 `FILL_LABEL_COLOR`）：面已經是那個色相的
  半透明色塊，字再同色就糊進自己的底色裡。線與圓點沒有這個問題。
- `label.minzoom: 2` 是實測調的：zoom 1 的全球視角上 52 個板塊名互相碰撞到只剩幾個。
- ⚠️ `geoHitLayerIds()` **要把面的標註一起綁**：標註的文字方塊會溢出到鄰接板塊上，
  不綁的話點在字上會開到旁邊那一塊的卡片。

#### ⚠️ `plates` 的 `fillOpacity` 是 0，那不是忘了設

52 塊板塊**鋪滿每一個像素**，任何均勻的面染都只是把整張圖壓暗一階，資訊量是零
（跟縣市界那種「面染標出範圍」的處境完全相反）。這一層畫出來的是**外框與名字**；
面留給「選取時 0.38」那個互動——點一下才看得出這塊板塊有多大，那才是重點。
`fill-opacity: 0` 不影響點擊命中（maplibre 的 hit test 不看不透明度，實測過）。

⚠️ 兩層的簡化容差**必須一致**（都是 0.02）：不一致的話兩層一起打開時，板塊外框與
彩色的邊界線會被各自簡化到差幾個像素，沿線露出一圈暖褐色毛邊。

#### 顏色

`plates` 用 `PLATE_COLOR`（暖褐 `#7d6b4f`），跟 reference／hazard 同屬**非分類的固定
角色**，不參與色票驗證——52 塊板塊全同色，它不是一個要跟別人比色相的類別。

三種邊界用 `PLATE_BOUNDARY_COLORS`（橘 `#c95c1c`／藍 `#2f74c9`／綠 `#159c6b`），
**比照交通軸線宣告不參與線／面色票的 all-pairs**。組內 all-pairs 實測明暗兩
模式**五項全數 PASS、零 WARN**：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#c95c1c,#2f74c9,#159c6b" --pairs all --mode light|dark
# → CVD 最差 8.8（綠↔橘，deutan）、一般視覺最差 21.2（綠↔藍）
```

⚠️ 綠色在臺灣主題是禁忌（NLSC 底圖的山區底色就是綠的），這裡可以，理由與交通軸線相同
——**地理分佈相反**：板塊邊界絕大多數在洋底，而世界底圖在海上是藍的。

#### ⚠️ 這一層是虛線，那是被「世界主要河流」逼出來的

當初宣告豁免的理由是「同框對象一個彩色分類色都沒有」。**2026-08 把全球地理形貌併進
世界地理之後，那句話不成立了**：這一層第一次跟世界主要河流同框，而**聚合藍 `#2f74c9`
對水系藍 `#2a78d6` 的一般視覺 ΔE 只有 2.1**——同一個顏色，而且喜馬拉雅、安地斯、
阿爾卑斯正好是大河的源頭。換色救不了（掃描結論見上面「全球地理形貌併進世界地理」
那一節），所以改用線型當第二通道：`render.dash = [4, 1.5]`。

⚠️ **不要「順手」改回實線**，也不要因為畫了虛線就以為這一層變成示意圖——它沒有標
`schematic`，幾何是 Bird (2003) 的實測模型；虛線在這裡的語意是「模型化的界線」，
跟 `notes` 早就寫著的「真實的變形區可以寬達數百公里」一致。

### 大洲分區：把國界併成七大洲

取得邏輯在 `scripts/lib/continents.mjs`，產物是 `public/data/geo/world-continents.geojson`
（7 筆、326 KB）。

#### 沒有可用的「大洲多邊形」，所以自己併

公開又可自由使用的大洲圖資其實不存在（Esri Living Atlas 的 World Continents 不是
開放資料），Natural Earth 只有國界，每個國家帶一個 `CONTINENT` 欄位。而「把同一洲的
國家併起來」正好是本站已經有工具的事——`lib/dissolve.mjs` 的有向邊相消（當初為國家
公園的分區圖寫的）。實測 Natural Earth 的國界**確實共用逐位元相同的邊**，七大洲一次
就併起來了。

⚠️ **但 NE 的環是順時針**（shapefile 老慣例，跟 GeoJSON 相反），不先反轉的話
`dissolveRings` 會把每一個環都判成內環，然後丟「合併後沒有任何外環」——那個錯誤訊息
完全不會讓人想到繞行方向。

#### ⚠️ 上游「整個國家算一洲」，所以跨洲國家一定要自己切開

Natural Earth 把**整個俄羅斯算成歐洲**。照單全收的話歐洲會變成 2,290 萬 km²、亞洲
剩 3,120 萬——課本寫的是歐洲 1,018 萬、亞洲 4,458 萬，那不是「定義不同」而是錯的。

所以 `DIVIDES` 依課本講的洲界把四個國家切開（烏拉山＝東經 60°、烏拉河、土耳其海峽、
蘇伊士運河與蘇伊士灣），切完的數字對得上：歐洲 1,023 萬（歐俄 392 萬）、亞洲 4,386 萬、
土耳其歐洲部分 2.5 萬（東色雷斯 2.4 萬）、西奈半島 5.6 萬（約 6 萬）。夏威夷另外依
位置改判大洋洲（玻里尼西亞）。

⚠️ **每一條分界線只切它該切的那一個國家（`countries`）。** 這一條踩過，症狀很好認：
**地圖上冒出幾條橫貫大陸的直線**。半平面裁切（Sutherland–Hodgman）把環切兩半時會沿
切線補「連接邊」；環只跨切線兩次時兩半的連接邊剛好相消，但跨**四次以上**時左半補的是
X1→X2、X3→X4、右半補的是 X2→X3、X4→X1，**消不掉**，整條切線就被畫出來。實測把土耳其
海峽那條線套用到全部國家時，它延伸出去橫掃俄羅斯，畫出一條從土耳其拉到西伯利亞的紫線。

⚠️ 代價是切線與國界的交會處會留下一小片雙重覆蓋的三角形（被切的那一國多了一個交點、
鄰國沒有）。它遠小於一個像素，而且 dissolve 仍然串得起來——比整條假線好得多。

#### 面積總和就是自我檢查

比照板塊那一層：七大洲的面積總和必須接近陸地總面積（1.49 億 km²），實測 1.466 億、
誤差 -1.7%，超過 5% 就讓建置失敗。⚠️ 面積要在**切開之後、簡化與濾島之前**算。

⚠️ 南極洲會少 12%（本層 1,226 萬 vs 常見的 1,400 萬）：NE 那份畫的是**岩床海岸線、
不含冰棚**。這件事寫在圖層的 `notes` 與內容卡上，不要「修正」它。

⚠️ 小於 0.02 度²（≈250 km²）的島在**簡化之前**濾掉（1,450 → 871 塊），但面積仍然算
進所屬的洲。門檻不要再往上調：0.15 度²（生物群系那一層的值）會開始咬到新加坡、馬爾他、
澎湖與大半個太平洋島群。

#### ⚠️ 洲名是另外一層點，不是面的標註

maplibre 對多邊形是**逐塊、逐圖磚**算標註錨點的，而這一層的亞洲有 240 塊——把 `label`
掛在面上，實測全球視角會在菲律賓、印尼、日本、千島群島上各印一次「亞洲」，一個畫面
六十幾個洲名。板塊那一層沒踩到只是因為一塊板塊通常就是一塊多邊形。

修法是把洲名做成 `attach` 的一層點（`world-continent-labels`，`radius: 0` ＋ 標註）：
名稱與 id 讀自母圖層那份 geojson（**共用 `resolveLayerData` 的快取，不會多抓一次**），
七個錨點座標寫在 `resolve.ts`。⚠️ 錨點**刻意不用形心**——形心會把「北美洲」丟進加拿大
北部、「大洋洲」丟進太平洋、「南極洲」丟到麥卡托投影上的無限遠。

id 跟母圖徵**是同一個字串**（比照颱風的中心定位點），所以點洲名與點那一洲開的是同一
張卡，`parentProperty` 讓兩邊互相連動強調。

#### 顏色：掃描選色相、實測定明暗

`CONTINENT_COLOR`（梅紫 `#a05a80`）是**非分類的固定角色**，比照板塊的暖褐——七大洲
同色，畫出來的是外框與名字，「這一洲有多大」交給選取時那層 0.38 的面染（所以
`fillOpacity` 是 0，跟板塊同一個理由）。七個分類色本來就不存在（本站掃出來的上限是六色）。

掃遍 OKLCH 之後，能同時離世界主題所有同框色（板塊暖褐、參考線灰、風系板岩藍、面色票
11 色、線點色）都遠的**只剩色相 320–350° 的紫紅那一族**。⚠️ **亮度不是取掃描最佳值**：
最佳解在 L≈0.67（`#b581b0`，最差 ΔE 15.3），但那個亮度實際疊在 Liberty 上**讀不出來**
——外框看起來只是「海岸線被染了一點粉紅」，烏拉山與蘇伊士那幾條洲界幾乎看不見。取
L≈0.56 之後最差值掉到 11.5（針葉林），那是**刻意的**，判例是 `WIND_COLOR`（對參考線灰
11.1）與保護區紫。詳細量測與補償見 `thematicColors.ts` 的 `CONTINENT_COLOR`。

⚠️ 要改色的話兩件事都要做：整份同框名單重掃，**而且**在 Liberty 底圖的世界視角實際
疊一次。

### 火山帶：1,214 座全新世活火山

取得邏輯在 `scripts/lib/volcanoes.mjs`（端點、19 個火山區與 17 種火山類型的中文對照、
40 幾座知名火山的中文名）。

#### 為什麼是 GVP 的「全新世火山」

課本說的活火山＝**全新世（約一萬年）以來噴發過**，而史密森尼學會全球火山計畫的
Volcanoes of the World 就是那份權威名單。USGS 只有靜態圖、Natural Earth 沒有火山圖層，
所以這是唯一一份公開、帶座標與最後噴發年代的全球資料。WFS 一次回 2.4 MB，產物 285 KB。

⚠️ **黃石與多巴這類「超級火山」不在名單裡，那不是漏掉**——它們上次噴發在 7 萬年前，
早於全新世，按定義不算活火山。這件事寫在圖層的 `notes` 裡。

⚠️ 三成（366 座）的最後噴發年代是「不詳」：靠地層或碳定年判定為全新世噴發，但定不出
年份。`formatEruption()` 因此把 `null` 寫成「最後噴發年代不詳」而不是留白。

⚠️ 海拔**可以是負的**（最深 -5,700 公尺的海底火山），所以 `formatElevation()` 對負值
寫「海面下 N 公尺」——寫成「海拔 -5700 公尺」是讀不懂的。

#### ⚠️ 產物只留卡片會用到的四個欄位

上游每筆還帶著幾百字的英文地質沿革（`Geological_Summary`）、照片網址與岩性。全帶著的
話產物會從 285 KB 膨脹到 2 MB 以上、直接撞穿大小預算，而卡片一個字都用不到。留下的是
`id`／`name`／`meta`／`detail`，後兩者是建置期就組好的字串（比照水庫與河川的既有做法）。

中文名的收錄界線是「**臺灣的兩座（龜山島、大屯火山群），加上課本、新聞與科普讀物會
直接叫出名字的知名火山**」，40 幾座；其餘沿用 GVP 原名。⚠️ 這份表**不可能補完**，
理由與 `ZH_HANT_OVERRIDES`、`RIVER_NAMES_ZH` 相同。key 用 `Volcano_Number` 不用名稱
——GVP 會修訂拼寫（`Fuji` → `Fujisan`、`White Island` → `Whakaari/White Island`），
編號則穩定；表裡的編號在上游找不到就讓建置失敗。

#### ⚠️ 有卡片但沒有 `browse`，這是兩個分開的決定

- **有卡片**：跟地震帶不同，每一座火山都有名字、類型、海拔與最後噴發年代，點下去讀得到
  具體的東西（比照 `tw-quakes` 那 612 個震央）。
- **沒有清單**：1,214 列不是人掃得完的清單。既有判準就擺在那裡——`tw-quakes-major`
  （92 筆）有 browse、`tw-quakes`（612 筆）沒有。
- **連帶後果是搜尋也找不到**（`searchIndex` 的 `indexesFeatures()` 看的就是 `browse`），
  所以**搜「富士山」不會有結果**。那是刻意的取捨：進索引等於每個學生一聚焦搜尋框就多付
  285 KB。搜「火山」仍然找得到**圖層本身**。

#### ⚠️ 顏色不能用紅色，而且這一層的跨幾何豁免不成立

`VOLCANO_COLOR` 是洋紅 `#c0259c`。本站的規則是「三組獨立色票、跨幾何不驗」（古蹟赭紅的
圓點與斷層磚紅的線就是這樣共存的），但那條豁免的前提是**地理分佈相反**。火山正好相反
——它們幾乎全部長在板塊邊界上，那是這一層要教的第一件事，所以必須跟三種邊界一起驗：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#c95c1c,#2f74c9,#159c6b,#c0259c" --pairs all --mode light|dark
# → 兩模式五項全數 PASS、零 WARN；CVD 最差仍是既有的綠↔橘 8.8、一般視覺最差 21.2
```

紅色（製圖慣例）**過不了**：`#d1352b` 對張裂型邊界的橘 `#c95c1c` 一般視覺 ΔE 只有
**7.3（hard FAIL，下限 15）**、deutan 3.2——冰島與東非大裂谷那一帶的紅點會直接融進橘線。
掃過整個 OKLCH 色域（色相每 2.5°、L 0.48–0.67＝明暗兩模式亮度帶的交集、彩度 0.10–0.26）
之後，零 WARN 的候選**只剩色相 285–355° 的紫／洋紅那一族**。深紅 `#ba054a` 過得了
all-pairs 但深色模式對比只有 2.66，而這裡有乾淨的替代品可選（比照保護區紫那次的判準：
有乾淨替代品就不要帶 WARN 上線）。顏色與「火山」的對應靠圖例文字，比照茶葉配藍。

⚠️ 它跟山脈洋紅 `#c23f8f` 同一族是**刻意可以**的（不同幾何、不同主題，比照地形景點藍與
水系藍共用同一個 hex）；但 `#c23f8f` 本身在這裡**不夠好**——它對錯動型邊界的綠只有
deutan 6.7，落在「只有搭配次要編碼才合法」的 6–8 band。

#### ⚠️ 半徑 3.2／不透明度 0.9／不畫外框，三個值都是被主題預設視角逼出來的

這一層第一眼看到的是 `center [0,10]、zoom 1.8`——正中央是全球最沒有火山的非洲與大西洋。
全球地震帶踩過那個坑（1.5 px + 0.35 的灰點＝「勾了圖層但什麼都沒有」），這裡直接沿用它
修好之後的量級。半徑**不隨 zoom 變**：放大時靠點與點拉開，不是點變大。**不畫白色外框**
——1,214 個亮外框在投影機上會糊成一片白雜訊，而這一層常常跟地震帶疊著看。

### 世界主要山脈：從「面」算出來的中軸線，配一座最高峰

取得邏輯在 `scripts/lib/mountains.mjs`，產物是 `public/data/geo/world-mountains.geojson`
（39 條線、30 KB）與 `public/data/geo/world-mountain-peaks.geojson`（39 個點、10 KB）。

#### 上游是「面」，這一層畫的是「線」——中軸線是算出來的

山脈沒有像國界那樣的官方界線圖資（「阿爾卑斯山脈到哪裡為止」本來就是製圖判斷）。
公開、免金鑰、涵蓋全球又逐筆標了種類的只有 Natural Earth 的
`ne_10m_geography_regions_polys`（`FEATURECLA === "Range/mtn"`，222 筆），而它收的是
**範圍面**。這一層要教的是**走向**，而且面在這個站上還有兩個硬問題：

1. **第 14 個面色不存在。** 掃遍 OKLCH（做法同大洲那次），要跟大洲梅紫、生物群系
   六色、柯本五色、板塊暖褐都分得開的面色**一組都沒有**——本站的分類色上限是六色，
   面色票早就滿了。實測最好的候選（玫瑰 `#c47581`、青綠 `#1aa67a`）一般視覺最差值
   只有 9.1／10.7，而且分別撞上「B 乾燥氣候」與「溫帶林」——雨影沙漠與森林正好是
   山脈旁邊那一格。
2. **面會吃掉 `MAX_ACTIVE_BY_KIND.fill` 的兩個名額之一**，而「山脈擋住水氣 → 背風側
   是沙漠」正好要跟柯本氣候分區或生物群系疊著看。

所以 `polygonAxis()` 把每一塊範圍面化成一條**中軸線**：掃描線點陣化 → chamfer 距離
變換 → 每個連通分量做兩次 BFS 找出兩端 → Dijkstra（離邊界越近越貴，路徑因此貼著中軸
而不是抄捷徑貼著邊）→ 移動平均 → Douglas–Peucker。

⚠️ **經緯度要先做 cos(緯度) 校正再進網格**，否則高緯度的山脈（烏拉、斯堪地那維亞）
在網格上會被縱向拉長，中軸線會偏。

⚠️ **移動平均那一步不能省。** Douglas–Peucker 只會**刪點**，而階梯狀的轉角剛好是它
認定「不能刪」的那種點——不先平滑，簡化完仍然是一條鋸齒線，點數也降不下來。

實測長度對得上常識（喜馬拉雅 2,165 km／常見值約 2,400、阿爾卑斯 1,006／約 1,200、
安地斯 8,907／7,000–8,900、大分水嶺 3,498／約 3,500），但**產物刻意不放長度**：
那是這一層最容易產生假精確的地方。圖層與 39 條全部標 `schematic`。

#### ⚠️ 收錄名單是人工挑的，`SCALERANK` 篩不出來

39 條的界線是「臺灣課本、新聞與科普讀物會直接叫出名字的山脈，七大洲都要有」。
機械篩選會同時出兩種錯：`SCALERANK <= 3` 漏掉**秦嶺**（rank 4，中國南北的自然界線）
與**托魯斯山脈**（rank 5），卻收進雅布羅諾維嶺、塔爾巴哈台山這種課本不會提的。

⚠️ **上游的 `NAME_ZHT` 不能用**：欄位名字叫 zht，內容卻簡繁混雜（阿爾卑斯寫
「阿尔卑斯山」、烏拉寫「乌拉尔山脉」、喜馬拉雅寫「喜马拉雅山脉」），跟世界底圖
`name:zh-Hant` 是同一個坑。中文名、洲別、成因說明與最高峰全部人工整理在 `RANGES`，
key 用 **`NE_ID`**（上游會改拼寫，數值 id 穩定；橫貫南極山脈上游拆成兩筆但共用同一個
NE_ID，正好自動併回一條，產物是 2 段的 MultiLineString）。

#### ⚠️ 最高峰不可以用「面內海拔最高的那個高程點」自動決定

那個做法實測會出兩種錯，而且都不會報錯：

- **上游的興都庫什面蓋到了南迦帕爾巴特峰**（那是喜馬拉雅的西端），自動選會選到
  8,125 公尺的它，而不是興都庫什真正的最高峰蒂里奇米爾峰 7,708。
- **西高止山脈真正的最高峰阿奈穆迪山落在面的外面**，自動選會退而選到多達貝塔山。

所以 39 座逐條指名（`RANGES[].peak.en`，必須對得到上游 `featurecla === "mountain"`
的某一筆，對不到就讓建置失敗），面內面外都不管。**高度取自上游、不自己抄數字**，
只有庫克山例外（`ELEVATION_OVERRIDES`：上游仍是 1991 年山頂崩落前的 3,754，
現行公告值是 3,724）。聖母峰 8,848 → 8,848.86 這種小數位差異不列，`notes` 有交代。

#### ⚠️ 顏色不是臺灣五大山脈的 `relief` 洋紅

直覺上兩層都是山脈該共用同一個角色，**實測不行**：洋紅 `#c23f8f` 對火山帶的洋紅
`#c0259c` 一般視覺 ΔE 只有 **4.6**——同一個顏色。「跨幾何不驗」那條豁免在這裡不成立，
因為它的前提是**地理分佈相反**，而這兩層正好相同：安地斯、喀斯開、巴里桑、新幾內亞
高地全都是火山密集的山脈。從前兩層分屬不同主題碰不到，山脈進了世界主題就碰得到了。

`MOUNTAIN_COLOR`（紫 `#8e26ff`）是**非分類的固定角色**（39 條同色），比照板塊暖褐與
大洲梅紫。條件是「跟山脈在**陸地上**同框的每一個顏色都分得開」：三種板塊邊界、火山
洋紅、水系藍（＝世界城市與本層最高峰的 `place` 藍）、地震灰、參考線灰、風系板岩藍。
洋流的紅與藍**不列**——洋流全在海上、山脈全在陸上，一個像素都不會疊（比照已記錄的
寒流藍↔水系藍豁免）。

```bash
node <dataviz-skill>/scripts/validate_palette.js "#8e26ff,#c95c1c,#2f74c9,#159c6b" --pairs all --mode light|dark
# → 兩模式五項全數 PASS、零 WARN（CVD 最差 8.3、一般視覺最差 19.7，都對聚合型邊界藍）
node <dataviz-skill>/scripts/validate_palette.js "#8e26ff,#c0259c,#2a78d6" --pairs all --mode light|dark
# → 兩模式五項 PASS，一個 WARN：對藍的 CVD 6.6（deutan）
```

⚠️ 掃遍 OKLCH 之後，能讓一般視覺最差值站上 15 的**只剩色相 295–302° 的紫**，而且
**彩度必須拉到 0.28**（同色相降到 0.20，對藍的 CVD 就從 6.6 掉到 2.8）。看起來偏鮮豔
是掃描的結果，不是隨手挑的。那個 CVD WARN 依驗證器的規則「只有搭配次要編碼才合法」，
補償有兩層：每一條山脈都有**沿線標註**（畫面上寫著「安地斯山脈」），而藍色的對象是
**圓點**——線與點的形狀差異本身就是區辨通道（判例是洋流那一組）。

#### 最高峰是附屬圖層，而且它**不是**示意的

比照臺灣五大山脈的 `tw-range-peaks`：一條山脈配一座最高峰、跟母圖層同一個核取方塊、
在可點清單裡巢狀排在各自的山脈底下、母子雙向連動強調（`parentProperty: "rangeId"`）。
顏色沿用 `place` 藍（附屬點一律用藍，見「附屬圖層」那節）。

⚠️ 這一層是 `remote` 而不是 `derived`（臺灣那層是在 `resolve.ts` join 的）：這裡的
join 需要 NE 的高程點，那是一份 843 KB、只在建置期該碰的檔案。

⚠️ **`attach.schematic: false` 不是多餘的，那個欄位就是為它加的。** `findGeoOwner()`
本來一律把母圖層的 `schematic` 傳給附屬圖徵，而母圖層的中軸線是**算出來的**、最高峰
卻是上游的真實座標與高度——不覆蓋的話，聖母峰的卡片底下會印一行「這是簡化的教學示意
幾何」，那是對讀者說謊。

⚠️ **`attach.browse.zoom` 是 5.5，不是 8，這是實測改回來的。** 母圖層的 `maxzoom`
是 6，所以 `zoom: 8` 時點「聖母峰」會飛到一個**看不到喜馬拉雅山脈**的畫面：詳情卡、
相機、強調表達式全都正常，只有那條線 `queryRenderedFeatures` 回 0，畫面上只剩一顆
藍點。判準同縣市政府那一層——取景必須讓山峰與山脈同時在畫面上。

#### 其餘幾個實測值

- **39 條都有內容檔**（`src/content/geo/world-mountains/`）：主標與副標之外，卡片上是
  「最高峰＋高度／主要國家／長度或走向」四格數據，加上三到五條 `facts`（成因、對氣候
  或水系的影響、人文，最後一條一律是「**對照重點**」——明講該跟哪一個圖層疊著看）。
  每一份的 `sources` 都指名那條山脈的維基百科條目（39 條實測全部 200），幾何與高度
  的來源接在後面。⚠️ 條目名要用維基百科**實際的**標題：`海岸山脈 (北美)` 與
  `內華達山脈 (美國)` 那兩個括號是消歧義後綴，少了會連到臺灣的海岸山脈與西班牙的
  內華達山脈。
- ⚠️ 圖層仍然掛著 `hideLayerDescription`，但**今天是 no-op**（有內容檔的圖徵根本不走
  fallback），比照 `tw-rivers` 與 `tw-protected-areas`：留著是為了規則一致，之後補收
  一條山脈而內容檔還沒寫時，卡片會是「名稱＋洲＋最高峰＋成因」而不是整片圖層說明。
- `maxzoom: 6`：一個像素在 zoom 6 約 0.04°，正好是產物簡化容差（0.02°）的兩倍。
  再放大，中軸線就會變成一條假的精確稜線。
- **標註的 `maxAngle: 150`** 照抄臺灣河川那次的教訓（真實曲線用預設的 60 會被靜默
  拒絕大半）。實測主題預設視角（`[0,10]`、zoom 1.8、1920×873）38 條畫得出來、12 個
  標註，沒有同一條線重複出現名字。
- `browse.groupBy: "category"` 依**洲**分組。⚠️ 不依「新褶曲／古老褶曲」是刻意的：
  後者在教學上更有力，但對半數的山脈說不清楚（衣索比亞高原是熔岩高原、西高止山脈是
  斷層崖、帕米爾是山結），硬分等於製造一堆查不到出處的斷言。成因逐條寫在 `formation`
  裡，那是講得出來也標得出來源的層級。
- **搜尋索引多抓 40 KB**（30 + 10），兩層都有 `browse` 所以都會進索引。實測搜「安地斯」
  會同時命中山脈、阿空加瓜山（它的 `meta` 裡有「安地斯山脈主峰」）與板塊；搜「Andes」
  「聖母峰」「庫克山」都找得到。

### 森林與沙漠帶：六個生物群系大類

取得邏輯在 `scripts/lib/biomes.mjs`；六類各一個檔（`public/data/geo/biomes-<class>.geojson`，
合計 731 KB）。

#### 為什麼不是手繪示意圖

這一層原本掛著 `schematic: true`，打算畫幾條橫的緯度帶。**現在是真實資料，所以不標
schematic。** 理由是這一層要教的不是「有哪幾種植被」而是「**為什麼**沙漠帶落在南北緯 30°」
——手繪長方形只是把結論畫出來，而真實分布會露出反例：同樣在 30° 附近，撒哈拉與阿拉伯連成
一氣，東亞卻是森林（季風）。那個對比才是這一層的價值。

資料是 RESOLVE Ecoregions 2017（Dinerstein et al.，WWF 陸域生態區的現行版本），847 個
生態區各自標了 14 個生物群系之一。⚠️ **授權 CC-BY 4.0，要求標示出處**，所以 `sources`
必須同時列原始資料集與取得管道（比照板塊那份 ODC-BY）。

#### ⚠️ 走 Esri Living Atlas，不要去抓官方那份 149 MB 的 shapefile

官方 `Ecoregions2017.zip` 是 149 MB，解開更大——`lib/shp.mjs` 是自己寫的純 JS 讀取器，
不該讓它扛那個量級。Living Atlas 代管的同一份資料支援伺服器端的 `maxAllowableOffset`
（幾何綜合）與 `geometryPrecision`（小數位），一次要求就拿到化簡過的 GeoJSON。

⚠️ **連續打會收到一個會騙人的 400**：第二輪之後開始回
`'maxAllowableOffset' parameter is invalid`，**但同一個網址單獨打是好的、參數也沒錯**
（0.2／0.4／0.8 都出現過同一句話）。看起來是流量控管，錯誤訊息卻指著參數，很容易讓人
跑去改 offset。`fetchBiomeClass()` 因此自己做間隔與退避重試——`fetchWithRetry` 只認
429／5xx，這裡是 HTTP 400 帶著一個 JSON 錯誤物件。**六類不要連著跑。**

#### 14 類併成 6 類是色票逼出來的，併法要說得出口

十四個分類色不可能通過驗證（本站掃過整個色域，六色已經是 all-pairs 全過的上限），而課本
講的本來就是「熱帶雨林、莽原、沙漠、溫帶林、針葉林、苔原」這幾條帶。併法寫在
`BIOME_CLASSES`，四個判斷值得記住：紅樹林併入熱帶林（窄帶，世界尺度下幾乎全被面積門檻
濾掉）、**溫帶草原與熱帶莽原合成「莽原與草原」**（所以類名不叫「莽原」——不能說謊）、
地中海型併入溫帶林、高山草原併入苔原（同一個低溫限制，只是換成用海拔達成）。
⚠️ `BIOME_CLASSES` 有一道建置期檢查：`BIOME_NUM` 1–14 少涵蓋一個就直接拋錯。

#### ⚠️ 小碎塊過濾是這一層塞得進預算的關鍵

上游把每個小島與湖心島都收了進來：**光是苔原那一類就有 50,680 個環**，全留下來那一類
自己就 3.5 MB。`MIN_POLYGON_AREA = 0.15` 度²（≈1,850 km²）之後是 169 KB。
⚠️ **門檻不能再往上調**：0.3 度² 會開始咬到峇里島、宿霧這種島，而熱帶雨林這一類的教學
重點正好在印尼與菲律賓的群島上。⚠️ 跟離島那條規則一樣，**必須在簡化之前**做。

#### ⚠️ 外框是拿來「補縫」的，不是畫界線

六類彼此相鄰，而幾何是上游**逐一**化簡的（不保拓樸），共用邊界因此對不齊，撒哈拉／薩赫爾
之間會露出一條一條的白縫（zoom 3.6 就看得到）。修法是畫一圈**跟面同色、同樣半透明**的
外框把縫蓋掉——這就是 `LayerRender.fill` 新增 `outlineOpacity` 的唯一理由（預設仍是 0.9，
既有圖層行為不變）。

⚠️ **不要改回預設的 0.9**：1,900 多塊多邊形在中亞、安地斯與北極群島會織成一張線網，
色帶本身反而讀不出來（0.6 寬 × 0.9 實測就是那個樣子）。現在這組 **1.0 寬 × 0.15**
是在 zoom 1.8 的全球視角與 zoom 3.6 的撒哈拉交界**兩邊都看過**才定的。

`maxzoom: 5` 同理：0.4° 的綜合精度在更近的尺度會露出折線與縫。

#### 六色是在語意色相窗內最佳化出來的

`BIOME_COLORS`（熱帶林 `#25744c`／莽原 `#989401`／沙漠 `#b4410d`／溫帶林 `#369db8`／
針葉林 `#695ba9`／苔原 `#c754f4`），明暗兩模式 `--pairs all` **五項全數 PASS、零 WARN**：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#25744c,#989401,#b4410d,#369db8,#695ba9,#c754f4" --pairs all --mode light|dark
# → CVD 最差 8.6（沙漠↔熱帶林，protan）、一般視覺最差 18.1（溫帶林↔熱帶林）
```

方法：每一類先框一段語意色相窗，亮度限制在明暗兩模式亮度帶的交集 L 0.48–0.67，再以
「CVD ≥ 8.5 的前提下**最大化一般視覺最差值**」跑爬山法。⚠️ 目標函數把餘裕留在一般視覺
那一項是刻意的——15 是不能用次要編碼豁免的硬下限（另一組解是 CVD 10.0／一般視覺 15.4，
就卡在下限旁邊）。

⚠️ **溫帶林是藍綠、針葉林是靛紫，那不是配錯**：三種森林的慣例色都是綠，但綠只夠給一個，
三個綠的 CVD 分離度不可能同時達標。比照茶葉配藍——對應靠圖例文字，不是靠「像不像」。

### 柯本氣候分區：五個顏色、30 個亞型

取得邏輯在 `scripts/lib/koppen.mjs`；五大類各一個檔（`public/data/geo/koppen-zones-<a–e>.geojson`，
合計 336 KB）。

#### 為什麼是維也納那份 0.5° ASCII 網格

柯本分類是**用氣溫與雨量的門檻算出來的**，沒有官方界線圖，能拿到的都是別人算好的網格。
維也納獸醫大學（Kottek et al. 2006）那份是課本與百科用得最多的一版，而且它提供
**純文字的 `Lat Lon Cls` 三欄網格**（92,416 個陸地格、2.6 MB），不必寫 GeoTIFF 解碼器。

⚠️ 另外兩條路都被否掉了：Beck et al.（2018／2023）的新版**只發布 GeoTIFF**；Esri Living
Atlas 上的柯本圖層是 **Image Service（點陣）**。同一個網站的 1986–2010 版**只有 KMZ，
而 KMZ 裡是一張 720×360 的 PNG 疊圖**（實測解開來確認過），不是向量。

⚠️ 所以期距是 **1951–2000**，寫在 `notes` 裡。

#### 網格 dissolve 的兩條硬規則

同一個亞型的格子用 `lib/dissolve.mjs`（有向邊相消）併成一個 MultiPolygon——網格的邊
逐位元相同，正好是那支模組的前提（它本來是為國家公園的分區圖寫的）。

⚠️ **`tolerance` 必須是 0。** 容差 0 的 Douglas–Peucker 只刪掉**完全共線**的點（無損），
而座標都是 0.5 的倍數，所以 `digits: 1` 也是無損的。容差一旦大於 0，階梯狀邊界會被切角，
而相鄰兩類是**各自**簡化的、切完就對不齊——那正是生物群系那一層要用半透明外框補縫的
原因。這一層**不需要補縫**，所以 `outlineWidth: 0`（順帶讓同一大類裡的亞型界線不會被
畫成一堆內部線條）。

⚠️ 產物是 **5 個檔**但只下載**一次**：五大類吃的是同一份 2.6 MB 文字檔，`fetchKoppenGrid()`
有 module-level 快取（比照古蹟三級與作物三種）。

#### 顏色是大類，圖徵是亞型

30 個亞型不可能各給一個顏色（本站掃出來的分類色上限是六色），但「這一塊到底是 Cfa 還是
Cwa」正是這一層存在的理由——每一張地點卡上都有 `koppen` 欄位。所以：**五個核取方塊＝
五個顏色**，30 個亞型各是一筆圖徵，名稱／判準／代表地點在建置期就寫進 geojson
（`SUBTYPES`，30 筆一個都不能少），卡片走 `FeatureCard` 的 fallback ＋
`hideLayerDescription`。

⚠️ **亞型代碼一定要放進 `items[].keywords`**：這一層沒有可點清單，也**刻意沒有開
`indexFeatures`**（開了等於讓每個學生一聚焦搜尋框就多付 336 KB），所以搜「Cfa」能不能
找到東西，完全靠那份 keywords。實測搜「Cfa」會同時出現「C 溫帶氣候」與 koppen 欄位是
Cfa 的那些地點（後者是 `contentKeywords` 本來就有的行為）。

五色 `KOPPEN_COLORS` 明暗兩模式 `--pairs all` **五項全數 PASS、零 WARN**：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#1d9dc8,#d8783d,#147811,#ba229e,#5e42fe" --pairs all --mode light|dark
# → CVD 最差 8.4（C 綠↔B 橙，protan）、一般視覺最差 23.3（E↔D）
```

色相窗刻意貼近 Kottek 原圖的慣例（A 藍、B 橙黃、C 綠、D 紫、E 冷色），選法同生物群系。

#### ⚠️ 這一層與「森林與沙漠帶」會互相蓋住

兩層都是 fill、都蓋滿陸地，而 `MAX_ACTIVE_BY_KIND.fill` 是 2 ——所以它們**可以**同時
打開，但兩片 0.25 的半透明面疊起來就是一團糊。這件事寫在 `notes` 裡提醒使用者一次看
一層；**不要為了讓兩層「能一起看」去調亮度或不透明度**，那只會讓兩層都變難讀。
兩組色票也不可能一起驗（11 個分類色）。

#### 0.5° 對臺灣意味著什麼

臺灣整座島只有三、四格。實測臺北是 Cfa（跟本站地點資料一致）、東京 Cfa、倫敦 Cfb、
開羅 BWh 都對得上，但**高雄一帶算成 Am**，而本站地點卡採中央氣象署的分區寫 Aw。
兩者不一定逐格相同，這件事寫在 `notes` 裡——不要為了「一致」去改任何一邊。

### 行星風系：全站第二個「程式產生」的圖層

幾何在 `src/map/registry/generators.ts` 的 `windBelts()`，**沒有任何資料檔**。

#### 為什麼是程式產生，而且應該是

行星風系不是測出來的界線，而是**理想化的模型**（氣壓帶在 0°／±30°／±60°，風帶夾在
中間），實際大氣還會隨季節南北移動好幾度。所以沒有「權威資料檔」可抓，只有課本的
示意圖——而示意圖的參數（帶的緯度、箭頭間隔、畫面上的斜度）該寫成程式碼裡的常數，
不是一份手抄的幾千個座標。**這一層因此必須標 `schematic: true`**（`geo-manual/` 那條
路也可以走，但參數會變成一堆改不動的座標）。

#### ⚠️ 箭頭的斜度要依緯度校正，否則極地東風會變成垂直的

Web Mercator 的縱向拉伸是 1/cos(緯度)：同樣 10° 的緯度差在 70°N 看起來比赤道長將近
三倍。所以緯度差是由「畫面上要幾度斜」反推的——`tan(30°) × 經度長度 × cos(緯度)`，
六條帶的箭頭在畫面上才會是同一個斜度。

⚠️ 極地東風的箭頭放在 **70°** 而不是 60–90 帶的正中央（75°）：主題預設視角
（zoom 1.8）的上緣只到約 66°N，往北每 5° 就要多縮小一級才看得到。**即使放在 70°，
預設視角仍然看不到極地東風**（實測 0 個標註）——要縮到 zoom 1.2 左右整套環流才會
同時出現，這件事寫在 `notes` 裡。

⚠️ 每一支箭頭與每一段氣壓帶線都**不跨越 ±180**（中心經度留了半個長度的餘裕），
理由同國際換日線。

#### 氣壓帶畫成「間斷的短線段」，不是橫貫全圖的長線

三條氣壓帶的緯度（0°／±30°／±60°）跟「緯度參考線」**完全重疊**。畫成長線就會變成
兩條疊在一起、只差顏色的線；短線段配上自己的標註（「副熱帶高壓帶」）才看得出是兩種
不同的東西。同理，這一層的顏色**必須跟參考線灰分得開**（實測 ΔE 11.1，見下）。

#### ⚠️ 整層只有一個顏色，那不是漏填

四個核取方塊（氣壓帶／信風／西風／極地東風）共用 `WIND_COLOR`（板岩藍 `#5a6f96`）
——它們是**同一個系統的四個部位**，不是四個要互相比較的類別。區辨靠形狀（點線 vs
箭頭）、位置（各自的緯度帶）與沿線標註，比照三條橫貫公路共用一個青的既有判例。
`items.palette` 因此是四個重複值。

⚠️ **為什麼不用課本的紅（高壓）／藍（低壓）**：`MAX_ACTIVE_BY_KIND.line` 是 3，
這一層可以跟緯度參考線＋板塊邊界（橘／藍／綠）同時打開；掃過整個 OKLCH 色域，能跟
那三個邊界色一起 all-pairs 全過又零 WARN 的**只剩色相 290–360° 的紫／洋紅**，而那一
族已經被火山帶的洋紅 `#c0259c` 佔走。所以改走「非分類固定角色」那條路（比照板塊的
暖褐與地震帶的中性灰）：彩度只有 0.066、**低於分類色下限 0.10**，本來就不是拿來跟人
比色相的顏色。明暗兩模式對面板底色是 4.93:1 與 3.44:1（都過 3:1，不必欠 relief）。

⚠️ 這一層是 `items` 變體，所以**不能有 `colorRole`**（型別擋著：`colorRole?: never`），
顏色寫在每個子項目的 `color` 上。

#### ⚠️ 標註是必要條件，而參數是實測出來的

四個部位同色，畫面上唯一寫出「這是西風」的東西就是沿線標註。實測（1512×772）：
`spacing: 60` 會讓氣壓帶的同一段短線重複放兩次（zoom 1.1 共 20 個），250 之後是 16 個；
`size: 11` 時「極地東風」四個字排不進箭頭，10 才進得去。**不可以照抄緯度參考線的
320**——箭頭在 zoom 1.8 下只有約 50 px，再高就一個都放不出來。

#### 驗證器也跟著補了一條：程式產生的圖層現在會被交叉檢查

`validate-content.mjs` 以前只對 `source.type === "remote"` 檢查 `featureIds`，而內容檔
的「id 必須在 geojson 裡找得到」對沒有 geojson 的圖層一律報錯。現在它會**直接跑一次
`generateLayer()`** 拿真正的圖徵 id 來比對（跟垂直植被帶那個 elevation 例外同一個形狀），
兩個方向都擋住：`featureIds` 打錯字 → 子項目變空圖層；內容檔檔名打錯 → 卡片退回只有
圖層說明。兩者在執行期都是**完全靜默**的。

### 洋流：全站第三個「程式產生」的圖層，也是唯一為了語意而放棄 all-pairs 的一組

幾何在 `generators.ts` 的 `oceanCurrents()`（18 條，控制點寫在 `OCEAN_CURRENTS`），
**沒有任何資料檔**。

#### 為什麼是 generator 而不是 `geo-manual/` 的一份手繪 geojson

CLAUDE.md 原本把洋流歸在「手繪教學示意幾何」，而它的**路徑**確實是手訂的（洋流沿著
海岸與海盆走，推不出來）。改走 generator 的理由是另外三件**手抄座標一定會出事**的事：

1. **箭頭。** 方向就是這一層的教學內容（北半球順時針、南半球逆時針的環流），而箭羽
   要在 Web Mercator 上看起來一樣大就得依緯度校正（同 `windBelts()`）。
2. **跨 ±180。** 北太平洋暖流、兩條赤道暖流與西風漂流**一定**會跨越換日線，跨了
   maplibre 會畫一條繞過整個地球的橫線**而且不報錯**（見國際換日線那節）。
   `splitAntimeridian()` 負責切段並在換日線上補端點——不補的話線會在畫面邊緣前幾度
   就停住，看起來像資料缺了一塊。
3. **控制點旁邊寫得下「這條是什麼」。** geojson 沒有註解，而 18 條每一條都有一句話
   要交代（黑潮怎麼繞過臺灣、祕魯寒流為什麼要貼著海岸）。

⚠️ 路徑仍然是**示意**的，所以圖層與 18 份內容檔都標 `schematic: true`。

⚠️ **控制點的經度刻意寫成「連續、可以超過 ±180」的形式**（北太平洋暖流從 145 寫到
232、西風漂流從 20 寫到 380），先在連續空間裡平滑與算箭頭，最後才一次 wrap＋切段。
反過來寫是踩過的坑：北赤道暖流原本寫成 wrap 過的 `…, -160, 190, 165, 143`，連續空間
裡那是一個 **+350° 的跳躍**，平滑與切段全部失效，產出 **29 段碎線與一條 44° 的橫線**。
往西流的洋流經度必須**一路遞減**（`-166 → -196 → -217`）。

#### ⚠️ 這一組色是全站唯一「為了保住語意而宣告不參與 all-pairs」的分類色

`MAX_ACTIVE_BY_KIND.line` 是 3，所以洋流**可以**跟板塊邊界同時打開，照理該把五個線色
一起驗。問題是**那樣就畫不出暖流／寒流**——掃過整個 OKLCH 色域（色相每 2.5°、
L 0.48–0.67、彩度 0.10–0.32，10,046 × 7,691 組），固定 `#c95c1c,#2f74c9,#159c6b` 之後
能讓五色 all-pairs 全過的只剩一族：**暖 = 洋紅／緋紅（h 0–10）、寒 = 藍紫（h 275–280）**，
而且每一組都還帶著對比 WARN。也就是暖流不能是紅的、寒流不能是藍的——而「紅暖藍寒」
正是這一層唯一要教的事（圖層名字就叫「洋流（暖流／寒流）」）。

所以走**柯本氣候分區 ↔ 森林與沙漠帶**那條既有判例：兩層可以同開，但兩組色票不可能
一起驗，於是把事實寫進 `notes` 請使用者一次看一層。組內驗證本身是全站最寬鬆的一組：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#b00a1d,#133eec" --pairs all --mode light|dark
# → 兩模式五項全數 PASS、零 WARN；一般視覺 ΔE 39.1、CVD 32.9
# 對真的會一起讀的兩個中性線色（參考線灰、風系板岩藍）最小 ΔE 18.8
```

⚠️ **已知且接受的兩對衝突**（換色時要重量的就是這兩個數字）：寒流藍 ↔ 聚合型邊界藍
**ΔE 14.0**（CVD 10.0）、暖流紅 ↔ 張裂型邊界橘 **ΔE 14.1**（CVD 12.1），都低於 15 的
硬下限。而且是真的會碰到：**祕魯寒流貼著祕魯－智利海溝、親潮貼著千島海溝**，兩段都是
「藍線平行壓在藍線上」（已實測截圖確認）。⚠️ 但**色盲下反而不是問題**（CVD 都 ≥10），
短的是一般色覺那一項，補償是**洋流有沿線標註寫出自己的名字、板塊邊界沒有**——所以
`render.label` 在這一層是必要條件，不是裝飾。

⚠️ **不要把寒流改成更「正統」的藍**（h 245–255）：那正是聚合型邊界的色相，ΔE 會從
14.0 掉到 7.7。`#133eec` 的 h 265 是「還讀得出是藍、又離得最遠」的位置。

#### `indexFeatures` 在這一層是零成本的，而且是唯一的檢索入口

`items` 圖層沒有可點清單（`ThemeMapPage` 的 `!l.items`），所以搜「黑潮」「祕魯寒流」
只能靠搜尋索引。開 `indexFeatures` 在別的圖層要付一份 geojson 的流量（那正是它必須
明確開啟的原因），這一層**連 fetch 都不會發**——資料是程式產生的。

⚠️ 為此補了 `searchIndex.ts` 一個洞：它原本只認得「子項目自己有 `source`」那一種
（`if (!item.source) continue`），用 `featureIds` 從母圖層切分的圖層**即使宣告了
`indexFeatures` 也一條都索引不到**，而且完全靜默——搜「黑潮」只會靠 keywords 命中
「暖流」那個子項目，看起來像「本來就只索引到這一層」。

#### 其餘幾個實測值

- **18 條在主題預設視角（zoom 1.8）全部畫得出來，而且 18 個名字全部標得出來**
  （1800×953 實測 warm 11 + cold 9 = 20 個標註，長線會拿到兩個）。
  `maxAngle: 150` 是照抄臺灣河川那次的教訓——真實的彎曲路徑用預設的 60 會讓放置
  演算法**靜默拒絕**掉大半標註。
- `maxzoom: 6`：控制點只有幾十個，再放大那條「流軸」會變成一條假的精確曲線。
- 顏色**固定綁在暖／寒上**（`LayerItem.color`），不是依勾選順序指派：先勾寒流再勾
  暖流時暖流仍然必須是紅的，否則「紅暖藍寒」當場失效（比照古蹟三級與板塊邊界）。

### 世界底圖的地名一律改成繁體中文（只換表達式，不換資料源）

「世界地圖」（OpenFreeMap Liberty）原本的 `text-field` 是 `拉丁名\n當地文字`，於是德國寫
`Deutschland`、埃及寫 `مصر`——一張給國中小學生看的地圖上有一半的地名讀不出來。

修法**不需要另一份資料**：OpenMapTiles schema（OpenFreeMap 與 Carto 都是這個 schema）
本來就把 OSM 的 `name:*` 多語名稱原樣放進圖磚，包含 `name:zh-Hant`／`name:zh`／
`name:zh-Hans`。所以 `basemaps.ts` 的 `localizeStyle()` 在樣式套用前，把每一個「用地名
當文字」的 symbol 圖層換成一條繁體中文優先的表達式（判準是原本的 `text-field` 有沒有
提到 `name`——公路盾牌用 `ref`、門牌用 `{housenumber}`，兩者都不該被改寫）。

⚠️ **順序不能改成先 `name:zh`**：那一欄在 OSM 上簡繁混雜，只有 `name:zh-Hant` 保證是
繁體。實測世界尺度的 171 個國家有 154 個帶 `name:zh-Hant`。

⚠️ **`index-of` 的參數順序是 `[要找的東西, 被搜尋的字串]`**，跟 `slice` 與 JS 的
`indexOf` 相反。寫反了 `index-of` 一律回 -1，而 `slice` 的 end 吃到負數是**從尾巴倒數**
——結果是**每一個地名都少掉最後一個字**（德國→德、埃及→埃），`tsc` 抓不到（表達式是
斷言進型別的）、console 也一個字都不會印。實測踩過，只有把地圖畫出來看才發現得了。

⚠️ **多值名稱要切掉第二段以後**。`name:zh-Hant` 會出現「德拉瓦州;特拉華州」
「斯威士兰 / 史瓦蒂尼」這種一格塞好幾個譯名的寫法（世界尺度約 1.5% 的標籤）。
`NAME_SEPARATORS` 把帶空白的 `" ;"`／`" /"` 排在前面一起比，否則會留下尾隨空白。

⚠️ **`ZH_HANT_OVERRIDES` 是逐筆改寫，不是簡繁轉換器**——maplibre 的表達式沒有辦法逐字
換字形，所以這份表**不可能補完**，收錄範圍必須是一條講得出來的界線。現在的界線是機械掃
出來的：`place` 圖層的 `country`／`continent` 加上整個 `water_name` 圖層，在 **zoom 2–5**
（攤開整個世界時字最大的那一層標籤）的所有圖磚裡，逐筆看過選出來的名稱。實測 171 國 +
9 大洲 + 116 個水體，其中 47 筆要改（簡體殘留，外加危地馬拉→瓜地馬拉這種非臺灣譯名）。

⚠️ **省、州與城市刻意不收**：那個尺度有上萬筆、長尾沒有盡頭（悉尼／孟买／奥克兰……），
硬編一份維護不起來。**放大到單一國家之後仍會看到簡體城市名，那是已知限制，不是漏掉。**

⚠️ 備援底圖（Carto Positron）**也要改寫，所以它不能再只回網址字串**——`loadBasemapStyle`
現在兩份向量樣式都先抓成 JSON。Positron 用的是舊式的 `"{name_en}"` 字串樣板（甚至有
stops 物件），JSON 化之後一樣比對得到 `name`。實測它的 28 個 symbol 圖層改寫了 26 個，
沒被動到的是門牌與本站自己的 `contour-labels`。

⚠️ 中文字形靠 `MapView` 既有的 `localIdeographFontFamily`（OpenFreeMap 的 glyph 端點沒有
中日韓字）。**那個選項不能拿掉**，拿掉之後標註會整片變成空白方塊。

三種 NLSC 底圖是 raster 的臺灣官方地圖，本來就是中文，不經過這條路徑。

### 氣候資料為什麼要預先產製

`scripts/build-climate.mjs` 在建置期抓 1991–2020 逐日資料，聚合成 12 個月的均溫與月雨量，輸出到 `public/data/climate/<place-id>.json`。網站執行期只讀本地 JSON。

理由：一個班級同時開站會對 Open-Meteo 產生大量請求而被限流（實測連抓 5 個地點就會收到 429）；而且執行期抓 30 年逐日資料再聚合會讓圖表等好幾秒。

**已知資料限制**：ERA5 是約 25 km 網格的再分析資料，會平滑掉小島與陡峭地形的地形雨。例如希洛實測年雨量約 3300 mm，ERA5 只給約 1590 mm。用於教學比較的量級關係仍然正確，但**不要把這些數字當成氣象站觀測值引用**。

### 臺灣各圖層的資料來源與坑 → 見 `CLAUDE_TW.md`

水庫、國家公園與保護區、河川與流域、交通軸線、古蹟、作物、人口、垂直植被帶、
活動斷層與地震、颱風、特有種觀測點——這些圖層的來源、取得邏輯與實測踩過的坑
全部搬到 **`CLAUDE_TW.md`** 了（上面那張端點總表仍然是完整的）。
**要動臺灣主題的圖層就先讀那一份。**

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
11. **不得在執行期呼叫水利署的 API。** 那個端點沒有 CORS 標頭，瀏覽器一定抓不到；水庫資料一律走 build-time 產製。
12. **不得手動編輯 `public/data/reservoirs-live.json` 與 `public/data/geo/tw-reservoirs.geojson`。** 由 `npm run build:reservoirs` 與 `npm run build:geodata` 產生。
13. **不得手動編輯 `public/data/monuments/*.json`。** 古蹟的歷史沿革分片，由 `npm run build:geodata` 產生（跟著三個 `tw-monuments-*` 資料集一起寫出）。
14. **不得憑感覺挑主題圖層的顏色。** 改動或新增 `src/map/thematicColors.ts` 的顏色前，必須重新用 dataviz skill 的 `scripts/validate_palette.js`（`--pairs all`，因為主題圖層是可任意複選的核取方塊，不能只驗證清單裡「相鄰」的顏色）驗證明暗兩模式，理由與已驗證過的組合見該檔案的註解。序位型的色階（水庫蓄水率、古蹟級別）改用 `--ordinal`。

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
| `tw-protected-areas-fill` / `tw-protected-areas-outline` | fill + line |
| `indigenous-source` / `indigenous-points` | geojson / circle |
| `species-<id>-source` / `species-<id>-points` | geojson / circle，每個物種各自一組 |
| `tw-counties-fill` / `tw-counties-outline` | fill + line（面的外框一定是獨立圖層） |
| `tw-townships-fill` / `tw-townships-outline` | fill + line |
| `world-rivers-line` / `world-rivers-label` | line + symbol |
| `world-mountains-line` / `world-mountains-label` | line + symbol（39 條山脈的**中軸線**，由上游的範圍面算出來，見下） |
| `world-mountain-peaks-points` | circle（附屬圖層；一條山脈配一座最高峰，沿用 `place` 藍） |
| `world-places-points` | circle |
| `world-continents-fill` / `-outline` | fill + line（七大洲；`fillOpacity: 0`，畫出來的是外框與名字）。⚠️ 洲名**不是**面的標註，見下 |
| `world-continent-labels-points` / `-label` | circle + symbol（附屬圖層；`radius: 0`，整層只是七個洲名的錨點） |
| `latitude-lines-line` / `latitude-lines-label` | line + symbol |
| `quakes-points` | circle |
| `volcanoes-points` | circle（1,214 座活火山，`strokeWidth: 0`；半徑固定不隨 zoom 變） |
| `biomes-<class>-fill` / `-outline` | fill + line，**六類各自一組**（`tropical-forest`／`savanna`／`desert`／`temperate-forest`／`boreal`／`tundra`）。外框是拿來**補相鄰面之間的縫**的，所以是 1.0 寬 × 0.15 不透明度，見下 |
| `koppen-zones-<group>-fill` / `-outline` | fill + line，**五大類各自一組**（`a`／`b`／`c`／`d`／`e`）。⚠️ 顏色是大類、**圖徵是 30 個亞型**（點下去才知道是 Cfa 還是 Cwa）；外框寬度 0，見下 |
| `wind-belts-<item>-line` / `-label` | line + symbol，**四個部位各自一組**（`pressure-belts`／`trades`／`westerlies`／`polar-easterlies`）。⚠️ 幾何**完全由程式產生**（generators.ts），四個共用同一個顏色，靠點線／箭頭與標註區辨，見下 |
| `ocean-currents-<item>-line` / `-label` | line + symbol，**暖流／寒流各一組**（`warm`／`cold`，18 條洋流）。⚠️ 幾何**完全由程式產生**（generators.ts），箭頭與 ±180 切段都由程式保證；⚠️ 這一組色**刻意不參與板塊邊界的 all-pairs**，見下 |
| `tw-reservoirs-points` | circle（顏色是**依蓄水率分級的表達式**，不是單一色，見下） |
| `tw-transport-<axis>-casing` / `-line` / `-label` | line + line + symbol，**十條軸線各自一組**（`thsr`／`freeway-1`／`freeway-3`／`freeway-5`／`provincial-7`／`provincial-8`／`provincial-20`／`tra-west`／`tra-east`／`tra-south-link`）。`-casing` 是墊在線底下的白框，全站只有這一層用；標註用 `shortName`，不是 `name` |
| `tw-rivers-line` / `tw-rivers-label` | line + symbol |
| `tw-basins-fill` / `tw-basins-outline` | fill + line |
| `tw-monuments-<level>-points` | circle，三個級別各自一組（`national`／`municipal`／`county`） |
| `tw-crops-<crop>-points` | circle，三種作物各自一組（`fruit`／`vegetable`／`tea`） |
| `tw-population-points` | circle（半徑＝人口、顏色＝依人口密度分級的 ramp） |
| `tw-vegetation-belts-elevation` | **color-relief**（不是幾何圖層，見「垂直植被帶」） |
| `tw-faults-line` / `tw-faults-label` | line + symbol（線寬依 `classRank` 分第一類／第二類；標註**依 zoom 換長短名**） |
| `tw-quakes-points` | circle（半徑依規模，`strokeWidth: 0`） |
| `tw-quakes-major-points` | circle（同一個 hazard 色但更深、更大、有白框） |
| `tw-typhoons-line` / `tw-typhoons-label` | line + symbol（`hazard` 中性色，標註用 `name`） |
| `tw-typhoon-centers-points` / `tw-typhoon-centers-label` | circle + symbol（附屬圖層；半徑與顏色都由 `wind` 驅動；**標註只在該颱風被選取時才出現**） |
| `tw-eez-<zone>-fill` / `-outline` / `-label` | fill + line + symbol，**四片海域各自一組**（`taiwan`／`japan`／`philippines`／`senkaku`）。標註用 `shortName`，而且是**面的標註**（`symbol-placement: point`，全站只有它與 `plates` 用） |
| `tw-strait-median-line-line` / `-label` | line + symbol（虛線，`reference` 中性灰——跟世界地理主題的緯度參考線、國際換日線同一套樣式） |
| `tw-tropic-of-cancer-line` / `-label` | line + symbol（同上那一套樣式；幾何由 `generators.ts` 產生，緯度值從 `latitude-lines` 那張表撈） |
| `tw-tropic-markers-points` | circle（附屬圖層；四處北回歸線標誌碑，沿用 `place` 藍） |

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

內容以**主題**組織（國小／國中／高中合流，不再依年級分類）。目前兩個主題，路由都是 `/theme/:themeId`，共用同一支 `src/pages/ThemeMapPage.tsx`：

| 主題 | 路由 | 內容 |
|---|---|---|
| 臺灣地理 | `/theme/taiwan` | 臺灣123（土地與島群、專屬經濟海域、海峽中線、北回歸線）、行政區（縣市、鄉鎮市區）、地形、天然災害（活動斷層、地震、颱風路徑與災損）、水系（118 個列管水系、水庫即時水情、河川流域分區）、人文（原住民族、交通軸線、古蹟、人口與都市體系）、植被生態（特有種、國家公園與保護區、垂直植被帶）、農業物產（主要作物分布） |
| 世界地理 | `/theme/world` | **全球尺度（骨架，排在前面）**：參考線（緯度參考線、國際換日線）、氣候與生物群系（森林與沙漠帶、柯本氣候分區、行星風系）、海洋（洋流：18 條暖流／寒流）、地體構造（板塊、板塊邊界、地震帶、火山帶）。**世界地理原有**：城市、國界與大洲（大洲分區）、地形水系（世界主要河流、世界主要山脈）、人文專題 |

兩個主題頁都是**滿版地圖 + 浮動控制**（仿 Google Map），沒有頁首也沒有側欄——版面機制見下面的「全螢幕地圖外框與浮動控制」。

### ⚠️ 「全球地理形貌」在 2026-08 併進「世界地理」

兩者講的是同一張世界地圖的不同層次——「為什麼這一帶是沙漠」與「這一帶有哪些城市」
本來就該疊在一起看。**全球尺度的圖層排在前面**（它們是骨架），世界地理原本的圖層
接在後面；`groups` 的順序同理。檔案上是 `themes/global.ts` 改名成 `themes/world.ts`
（舊的 world.ts 併進去），`THEMES` 從三個變兩個。

⚠️ **舊網址 `/theme/global` 由 `App.tsx` 重導到 `/theme/world`，那條路由不要拿掉。**
它必須排在 `/theme/:themeId` **前面**，否則會被萬用路由吃掉——而 `ThemeMapPage`
對不認得的 themeId 是重導到**臺灣主題**，等於安靜地跑錯地方。

⚠️ **相機沿用原本全球地理形貌的 `[0, 10] / zoom 1.8`，不是舊世界地理的
`[30, 20] / zoom 2`。** 火山帶的半徑與不透明度、全球地震帶的半徑下限、生物群系的
外框、行星風系的標註間隔**全都是對著那個視角實測調出來的**（見下面各節與驗證清單
第 31–35 項）。換掉它等於讓那一整批實測值失效。

#### ⚠️ 合併帶來一組新的同框色，其中一對是真的撞在一起的

合併之前 `ThemeMapPage` 只算繪當前主題，所以「世界地理」的圖層與「全球地理形貌」的
圖層不可能同框。現在可以了，於是多出三組要驗的配對：

| 配對 | 幾何 | 一般視覺 ΔE | 處置 |
|---|---|---|---|
| 世界城市藍 `#2a78d6` ↔ 火山洋紅 `#c0259c` | circle | 26.0（CVD 11.3） | 重驗**兩模式五項全數 PASS**，不必動 |
| 寒流藍 `#133eec` ↔ 水系藍 `#2a78d6` | line | 14.0（CVD 9.6） | 豁免：**洋流全在海上、世界主要河流全在陸上**，一個像素都不會疊 |
| **聚合藍 `#2f74c9` ↔ 水系藍 `#2a78d6`** | line | **2.1** | ⚠️ 同一個顏色，而且真的會疊 → **板塊邊界改畫虛線** |

最後那一對不能靠文件帶過（ΔE 2.1 不是「相近」，是同一個顏色），而喜馬拉雅、安地斯、
阿爾卑斯、札格洛斯這些聚合帶正好是大河的源頭。**換色救不了，這是掃出來的**：水系藍
動不得（它同時是臺灣主題那組已驗證六色的一員，也是點色票的 `place`），而在固定
張裂橘＋錯動綠＋水系藍＋火山洋紅之後掃遍整個 OKLCH 色域，能替代聚合藍的候選不是
離洋流更近（h 277–285 的藍紫，對寒流藍掉到 9.5），就是淡到畫在藍色海面上看不見
（h 200／L 0.82）。所以改用本站既有的第二通道——**線型**（比照交通軸線的軌道虛線／
公路實線）：板塊邊界 `[4, 1.5]` 虛線、河流維持實線。實線段刻意偏長，邊界要讀得出
「一條連續的帶」，不能碎成點。

⚠️ **要把板塊邊界改回實線，就得先解掉那個 ΔE 2.1。**

#### ⚠️ 合併之後線圖層變成七個，而上限仍然是 3

合併前「全球地理形貌」有五個 ready 的線圖層、「世界地理」只有一個；再加上 2026-08
補上線的世界主要山脈，現在**七個**擠在同一個主題裡搶 `MAX_ACTIVE_BY_KIND.line` 的三個
名額（緯度參考線、國際換日線、行星風系、洋流、板塊邊界、世界主要河流、世界主要山脈）。
**這是預期行為，不是 bug**——實測「緯度參考線（`defaultOn`）＋板塊邊界＋世界主要河流」
勾滿之後，洋流的核取方塊就是 `disabled`。

⚠️ **不要為了「東西變多了」就把上限調到 4。** 那個 3 是三組色票策略的執行面，而且
上面整段色彩分析都是在「最多三條線同時出現」的前提下做的——調高等於讓那份分析失效。
要一次看更多層，正確的做法是取消不需要的那一層（緯度參考線是最常被讓出來的一個）。

`/compare`（雙地圖同緯度比較）是獨立的一頁，跟這套系統無關，版面也**沒有**被改動（它是雙地圖 + 緯度滑桿 + 兩組圖表，沒有地方掛浮動控制，所以保留一條自己的頁首 `SiteHeader`）。兩者互補：`/theme/world` 說明「為什麼緯度重要」，`/compare` 帶學生鑽進同一條緯度上的兩個地方看差異。

### 圖層註冊表

**加一個新圖層或新主題 = 加一筆資料，不需要寫任何元件。** 定義在 `src/map/registry/`：

```
registry/
├─ types.ts        # 型別（含 MAX_ACTIVE_BY_KIND）
├─ index.ts        # THEMES、getTheme、allLayers、id 組合 helper
├─ themes/*.ts     # 兩個主題的圖層清單（純資料）
├─ generators.ts   # 程式產生的幾何（緯度參考線、行星風系、洋流）
└─ resolve.ts      # 標籤 → 實際資料（瀏覽器專用）
```

**最重要的約束：`themes/*.ts` 與 `index.ts` 必須是純資料且 Node 可直接 import。**
`scripts/validate-content.mjs` 會用 Node 24 的 type stripping 載入 `registry/index.ts` 做建置期交叉檢查（remote 路徑是否存在、圖層 id 是否撞名、`maxActive` 是否超過色票長度、`group` 是否在 `theme.groups` 裡）。這件事值得為它扭曲型別設計，因為「宣告的 geojson 不存在」在執行期是**完全靜默**的：fetch 404 → `resolveLayerData()` 回 null → 圖層永遠不出現 → console 什麼都沒有。

所以規則是：`themes/*.ts` 只能 `import type` 型別 + value-import `thematicColors.ts`（一個零 import 的常數模組）；**不准放 closure、不准 `import.meta.glob`、不准 value-import maplibre**。資料來源一律寫成標籤（`LayerSource`），由 `resolve.ts` 在瀏覽器端解析。

因為 Node 的 ESM 解析器不會自己補副檔名，`registry/` 內部互相 import **必須寫 `.ts` 副檔名**（`tsconfig.json` 因此開了 `allowImportingTsExtensions`）。

`status: "planned"` 的圖層照樣列在圖層抽屜裡（停用的核取方塊 + 「資料整理中」），但**仍然必須填 `description` 與 `sources`**——一個停用又沒有文字的核取方塊什麼都沒教到。

子項目（`items`）是「一個勾選項展開成 N 個子圖層」的第一級概念，目前只有特有種用到。清單來源寫成 `{ type: "content", collection: "species" }` 而不是硬編，這樣**新增一個物種 JSON 就會自動出現在 UI**。

⚠️ **子項目本身也可能是一個要解釋的概念，那時要宣告 `items.detail`。** 點抽屜裡的子項目名稱（以及搜到子項目本身時）預設開的是**母圖層的** `detail`，而那不一定講得通：古蹟母圖層的 `detail` 是 `monument`（點圓點要開的是那一處古蹟的卡），但點「國定古蹟」四個字要開的是**那個級別的定義**。`items.detail`（目前只支援 `type: "geo"`）就是覆蓋這條路徑用的，內容檔放 `src/content/geo/<collection>/<item id>.json`，`validate-content.mjs` 兩個方向都會擋。判準是**「子項目名稱回答的問題」跟「圖徵回答的問題」不同**：古蹟（級別的定義 vs 那一處古蹟）與主要作物分布（那一類作物 vs 那個鄉鎮）都成立，特有種與垂直植被帶不成立、不必宣告。⚠️ **不宣告的後果是一張完全靜默的空白面板**（item id 拿去母圖層那一支查 geojson 一定查不到 → 卡片回 `null`），詳見 `CLAUDE_TW.md` 的古蹟那一節。

### 資料限制寫 `notes`，不寫進 `description`

圖層的資料限制（收錄範圍、目錄完整度、量測基準…）一律放 `layer.notes`，**每一則必須以 `⚠️ ` 開頭**，而 `description` 裡**不可以**再出現 ⚠️——`validate-content.mjs` 兩件事都會擋。

抽屜靠這件事把兩者分開：`description` 留在核取方塊下面，`notes` 收進**圖層名稱旁邊那顆 ⚠️ 按鈕**開出來的小視窗（`LayerPanel` 的 `LayerNotes`）。臺灣主題 20 幾個圖層裡有 12 個帶警語，全部展開時抽屜的可捲高度是 2,989 px，收進小視窗之後是 2,213 px（**少 26%**）——這一層是「捲下去找圖層」的體驗，長篇警語擋在路上就等於把清單埋掉。

⚠️ **收進小視窗不等於可以省略。** 這些警語是內容誠信的承諾（比照 GBIF 觀測點與 ERA5 氣候值），所以 `FeatureCard` 的 fallback **不分**：`DetailCard` 的 `fullDescription()` 把 `description` + 全部 `notes` 接起來給它——沒有內容檔的圖徵（97 條河川、保護區、流域…）只有那張卡看得到說明。加新圖層時如果把警語漏回 `description`，畫面上只會顯示成「這個圖層的說明比較長」、按鈕不會出現，所以那兩條檢查不要拿掉。

⚠️ **但 `QuakeCard` 刻意不吃這一段。** 兩個地震圖層合計 762 個震央，圖層說明在每一張卡上**逐字相同**，卡片有大半高度在講「這個圖層是什麼」而不是「這一次地震是什麼」，而且跟抽屜那一列重複。圖層層級的話全部留在抽屜（說明在核取方塊下面、資料限制在 ⚠️ 小視窗），卡片只留**逐筆不同**的東西：`本筆資料來源`（混合來源，官方表只到 2022）與 `地震矩規模 Mw`（與 ML 分歧時）。底部的 `資料來源` 連結是全站每張卡都有的署名，不在移除範圍內。

⚠️ **走 `FeatureCard` fallback 的圖層用 `detail.hideLayerDescription` 退掉這一段。** 判準跟 `QuakeCard` 一樣：**圖徵很多、而且那段字在每一張卡上逐字相同**。目前掛著的有五個：

| 圖層 | 效果 |
|---|---|
| `tw-faults` | 33 條都沒有內容檔，卡片本來整片都是圖層說明；現在是「車籠埔斷層／第一類・全新世（一萬年內）曾活動／觀察／資料來源」 |
| `tw-rivers`、`tw-protected-areas`、`tw-counties`、`tw-county-halls`、`world-mountains` | 147／53／22／22／39 筆**都有內容檔**，所以**今天都是 no-op**；掛著是為了規則一致——新公告一條河或一處保留區而內容檔還沒寫時，卡片會是「名稱＋類別＋來源」而不是整片圖層說明。（保護區那 43 份是 2026-08 補的，見下一節；河川最後那 97 份是用維基百科補的，見「另外 97 條沒有官方詳細資料」） |

⚠️ **有內容檔的圖徵完全不受影響**（`FeatureCard` 只在沒有內容檔時才走 fallback）：實測濁水溪、嘉義縣的卡片逐字未變。ODbL 要求的 `OpenStreetMap` 署名也還在——那是 `sources`，不是 description。

⚠️ **剩下兩個同型的圖層目前沒掛**（`tw-basins` 72 筆／46 筆無內容檔、`tw-territory` 16 筆全部有內容檔）。要不要一起掛是內容判斷，不是技術問題：那幾層的圖層說明比較短，而且**是那張卡上唯一講得出東西的內容**。

> 43 處保留區／保護區的內容檔與官方連結（含三個索引頁的分頁參數陷阱）見
> `CLAUDE_TW.md`。

⚠️ 按鈕**放在 `<label>` 外面**（`.layer-row-head` 這層 flex）：放進去的話點它會連帶切換核取方塊。

### 附屬圖層（`attach`）：跟 `items` 不是同一件事

`attach` 是「這個圖層還有一種**不同幾何**的附屬圖徵」——五大山脈的稜線是線、主峰是點，一條線配一顆點。它**沒有自己的核取方塊**，跟母圖層一起開關、一起移除，並在可點清單裡巢狀排在各自的母圖徵底下。

不要跟 `items` 搞混：`items` 是 N 個**平行**的子圖層（各自有色票與 `maxActive` 上限），`attach` 是一個母子關係。也不要退回成兩個獨立圖層：主峰離開稜線就沒有意義，分成兩個核取方塊會讓人勾了山脈卻看不到最高點在哪。也不要把點塞進 `tw-ranges.geojson` 混合幾何——`LayerRender` 一個圖層只能一種幾何，而且主峰的詳情卡是 `PlaceCard`（有海拔與氣候圖表），跟山脈的 `FeatureCard` 不同，`detail` 必須分開。

**資料是 join 出來的，不是抄的。** `{ type: "derived", derived: "tw-range-peaks" }` 由 `resolve.ts` 把兩份既有的單一事實來源接起來：座標取自 `src/content/places`、「哪座山峰屬於哪條山脈」取自 `tw-ranges.geojson` 的 `peakId`。所以 5 座主峰的座標與歸屬各自只有一份，不會漂開。它跟山脈線圖層共用 `resolveLayerData` 的同一個快取項目，實測 `tw-ranges.geojson` 只抓一次。

目前有三組：**五大山脈 → 主峰**、**縣市界 → 縣市政府**、**北回歸線 → 標誌碑**。

**附屬點一律沿用 `place` 藍，不是母圖層的顏色——這是被色票驗證逼出來的，不是隨手選。** POINT 色票（藍／紅／青／黃／紫）已經是 all-pairs 全過的飽和狀態，把山脈洋紅 `#c23f8f` 加進去，它跟原住民族紅 `#e34948` 的**一般視覺 ΔE 只有 13.0（hard FAIL）**，而驗證器明講這一項不能用次要編碼豁免；紫 `#7a3fa6`、棕 `#8a5a2b`、青綠 `#00857a`、橘褐 `#b06a00` 也全部 FAIL（撞紫／撞紅／彩度不足）。縣市界橘 `#d95926` 更糟，對原住民族紅只有 **5.1**（CVD 2.7）。藍在語意上是一致的：「藍點＝地圖上一個有詳情卡的地點」。**要動這個顏色請先重跑 `validate_palette.js --pairs all` 明暗兩模式。**

⚠️ **附屬圖層的 min/maxzoom 不會從母圖層繼承，要自己宣告。** 母圖層的縮放範圍講的是**它自己那份幾何**的限制：縣市界的 `maxzoom: 11` 是因為相鄰的面各自簡化會開出次像素縫隙——那條理由對「政府大樓的一個點」完全不成立。

踩過一次而且症狀很難認：政府點繼承了 maxzoom 11，清單的 `browse.zoom` 卻是 14，於是點一下縣市政府就飛到**完全空白**的畫面（政府點與縣市面同時都在 maxzoom 之外），而詳情卡、相機、`getPaintProperty` 全都正常。**只驗 paint 表達式是抓不到的**，一定要在**飛完之後**用 `queryRenderedFeatures` 數實際算繪的數量。`validate-content.mjs` 現在會擋住 `browse.zoom` 落在 `[minzoom, maxzoom)` 之外（圖層與附屬圖層都檢查）。

`browse.zoom` 也要考慮**母圖徵看不看得見**：縣市政府設 10 而不是街廓尺度的 14，是因為這一層的教學重點是「政府設在這個縣市的哪裡」，取景必須讓政府點與所屬縣市的面同時在畫面上，而縣市面的 maxzoom 是 11。

⚠️ **附屬圖層沒有宣告 `browse` 就不會有巢狀清單、也不會進搜尋索引**，跟一般圖層同一條
規則（沒有 `browse` ＝「這些圖徵不是一份可以逐一點選的清單」）。`ThemeBrowse` 與
`searchIndex` 兩處原本都是**無條件**處理 attach 的，颱風的 757 個中心定位點因此
（a）把那一層的抽屜清單灌成 **771 列**，每個颱風底下掛著五十幾個沒有名字的子項目；
（b）讓聚焦搜尋框多抓 117 KB 卻產不出任何結果。兩處都已改成看 `attach.browse`，
主峰與縣市政府（都有宣告）行為不變。

#### ⚠️ 線／面的取景上限必須從圖層自己的 `maxzoom` 算，不可以寫死

`browse.zoom` 只管**點**圖層（`flyTo`）；線與面走 `fitBounds`，上限是那個 `maxZoom` 選項。
`ThemeMapPage` 的 `fitMaxZoom()` 因此取 `min(12, layer.maxzoom - 0.5)`——**寫死 12 是壞的**。

maplibre 的 `maxzoom` 是**開區間**（`zoom >= maxzoom` 整層不畫），所以拿寫死的 12 去框
一個 `maxzoom: 12` 的圖層時，只要圖徵夠小、`fitBounds` 撞到上限，相機就停在**正好 12**，
剛選的那一塊面憑空消失：`getLayer()` 有東西、詳情卡照樣開、相機也飛對了位置，
`queryRenderedFeatures` 卻是 **0**，**完全靜默**——跟上面政府點那個坑是同一種病。

⚠️ **這不是邊角案例，而且症狀會隨視窗寬度改變**（`fitBounds` 的 zoom 跟畫布大小相依）。
實測 1920×929 的畫布，368 個鄉鎮有 **290 個**的 `fitBounds` zoom ≥ 12（板橋區、永和區、
臺北市大安區…），臺東縣關山鎮剛好卡在門檻上（11.94）——所以會收到「成功鎮看得到、
換成關山鎮整層不見」這種看起來毫無道理的回報，而同一個操作在小一點的視窗上是正常的。
縣市界（`maxzoom: 11`）的嘉義市、新竹市、臺北市同理。

⚠️ 附屬圖層要傳 **`attach.maxzoom`**，不是母圖層的（縮放範圍不繼承，見上）。

⚠️ 留 0.5 級餘裕而不是剛好停在 `maxzoom` 下面一點點：11.99 雖然畫得出來，但那是圖層
即將消失的邊緣，使用者再往前捲一格滾輪剛選的東西就又不見了。

⚠️ **母子連動強調的兩個方向都從 `attach.parentProperty` 推，不要寫死屬性名。** 早期版本在 `ThemeMapPage` 寫死 `["peakId", "rangeId"]`，加了縣市政府之後立刻壞掉——`countyId` 不在清單裡，點縣市政府時所屬縣市不會被強調，而卡片與相機都正常，所以這件事在畫面上非常容易被忽略過去。母 → 子的方向也不需要母圖徵身上有任何屬性：反過來找「哪個子項目指向我」就好（`tw-ranges.geojson` 的 `peakId` 現在只用於 resolve.ts 的 join）。

### 圖層 id 的組合方式

```
instanceId = item ? `${layer.id}-${item.id}` : layer.id
circle → `${instanceId}-points`
line   → `${instanceId}-line`（有 label 再加 `-label`）
fill   → `${instanceId}-fill` + `${instanceId}-outline`
```

`-points` 後綴是刻意沿用的舊命名，讓 `places-points`／`indigenous-points`／`species-<id>-points` 一個字元都不變。

**fill 一定是兩個 maplibre 圖層**：maplibre 的 `fill-outline-color` 只能畫 1px 髮絲線、線寬不可調，外框必須是同一個 source 上的獨立 line 圖層。

外框的不透明度預設 0.9，可以用 `render.outlineOpacity` 調低。⚠️ 會用到它的情境只有一個：**用同色半透明的外框去補相鄰面之間的縫**（生物群系六類的共用邊界對不齊），見下。

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

### 關鍵坑三：依 zoom 縮放的 paint 表達式會被「選取強調」弄壞

`layers/geo.ts` 的 `whenSelected()` 把每一個 paint 值包成
`["case", 選中嗎, ["*", base, 倍率], base]`。**base 本身是一條 zoom 曲線時，這個包法
違反 maplibre 的兩條硬規則**——`["zoom"]` 只能當**最外層** step／interpolate 的輸入，
而且一個屬性裡**只能有一個** zoom 曲線：

```
layers.tw-typhoons-line.paint.line-width:
  Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.
```

⚠️ **失敗的樣子非常難認。** `addGeoLayer` 是一路往下加圖層的：線加不上去，但它**後面**
的沿線標註照樣加上去了——畫面上是一排名字浮在半空中、線與圓點都不見，而 React、詳情卡、
圖例、可點清單全都正常。只有 console 有一行紅字。實測踩過（颱風路徑把半徑改成依 zoom
縮放的那次）。

修法是 `mapZoomStops()`：偵測到 base 是最外層的 zoom 曲線時，把 `case` **推進它的每一個
輸出值裡**，zoom 仍然留在最外層、整條式子也只有一個 zoom 曲線。base 不是 zoom 曲線時
行為逐字不變（實測五大山脈＋主峰、縣市界的面與外框、原住民族的表達式都跟改動前一模一樣）。

⚠️ 所以**在註冊表裡寫任何依 zoom 變化的 `width`／`radius`／`strokeWidth` 之後，一定要
實際勾選那個圖層並看 console**，只跑 `npm run build` 與 typecheck 是抓不到的。

### 沿線標註很脆弱

`text-font` 只有 `"Noto Sans Bold"` 確定存在於 `basemaps.ts` 借用的 OpenFreeMap glyph 端點上，換別的字型名稱會**靜默**畫不出任何標註。

**線越彎、字串越長，放置演算法就越容易靜默拒絕。** 預設用等高線驗證過的寬鬆組合（`symbol-spacing: 120` / `text-max-angle: 60`）：實測世界主要河流用 240/45 時標註數是 **0**，改成 120/60 之後在 zoom 4 可標出 8 條。反過來，緯度參考線又直又橫跨全球，要把 `spacing` 調高到 320，否則同一條線上會重複出現一長串「赤道 赤道 赤道…」。

⚠️ **但不要把「調高 spacing」當成通用解——`symbol-spacing` 是在單一圖磚內沿線量的。** 只有當一張圖磚裡的那一段線比 spacing 還長時它才起作用（緯度參考線在低縮放時正是如此，所以那裡的 320 是真的有效）。線本身短、或節點密到每張圖磚只裝得下一小段時，它**完全無效**：臺灣主題的海峽中線（兩個端點、600 km）與北回歸線（5 個經度）實測把 spacing 從 **80 一路調到 700，各縮放的標註數逐一相同**，因為每張圖磚固定放一個——那時標註數是**圖磚數**驅動的，會隨著放大而線性增加，調 spacing 一點用都沒有。要壓下來只能限制縮放範圍（面標註的 `label.maxzoom` 就是為此加的）或改幾何。

⚠️ **換掉幾何來源可能連帶弄壞標註，而且只有實測數得出來。** 臺灣主要河川從手繪示意路徑換成 OSM 實測河道時踩過：幾何、顏色、排序、詳情卡全部正常，**但全島視角的標註從原本的數條掉到只剩 1 條**——真實河道比手繪的平滑線彎得多，同一組 120/60 參數就從「夠寬鬆」變成「幾乎全部拒絕」。而且掉的不是無關緊要的小河，**濁水溪這種課本必講的河正好標不出來**。修法是把 `maxAngle` 調到 150（實測 140／160 結果相同、180 只多兩條但等於完全不設限），標註回到 9 條。**改動任何圖層的幾何來源之後，要重數一次它的標註數，不能只確認圖層還在。**

改動後一定要用 `queryRenderedFeatures` 實測放置數量，不要只靠肉眼。

**標註本身也要能點。** `geoHitLayerIds()` 對有標註的線會回傳 `[線, 標註]` 兩層——使用者看到的是「中央山脈」那四個字，自然會去點字，但字畫在 symbol 圖層上而線只有 2.6px 寬，只綁線的話點在字上有很高機率整個落空，而且畫面上沒有任何反應可以解釋原因。

兩層在畫面上是重疊的，所以 `bindGeoLayerInteractions()` 收**一組**圖層一起管理，不是一層一組獨立監聽：游標用 `hovered` 集合記住還停在哪幾層上（否則滑鼠從字移到線時，標註層的 `mouseleave` 會把游標重設掉，即使人還停在線上），點擊則用 `originalEvent` 的同一性擋掉第二次（點在字的正中央會同時命中兩層）。`useGeoLayers` 的互動記帳因此以 **instanceId** 為 key，不是 layerId。

### ⚠️ 點擊仲裁不可以交給 maplibre 的派送順序

`originalEvent` 那個去重只在**同一組**圖層內有效。**不同 instance 之間也會互相蓋到**，而 `map.on(type, layerId, …)` 是依**監聽註冊順序**派送的——註冊順序只是「使用者先勾了哪個圖層」的意外結果（`useGeoLayers` 的 Effect 1 只替新出現的 instance 補綁，不會重排既有的）。

實測踩過：地形景點 `defaultOn`、縣市界後來才勾，於是縣市的 handler 最後跑、它的 `setSelected` 蓋掉山峰的——**點玉山主峰開出的是南投縣的卡片，五大山脈的主峰等於完全點不到**。而且圖層堆疊順序是對的（`places-points` 確實在 `tw-counties-fill` 之上），所以查 `layerOrder` 完全查不出問題。

修法是 `geo.ts` 的 `isTopmostHit()`：每次點擊現查 `queryRenderedFeatures`，規則是「**小目標優先，其餘照算繪順序**」。

- **命中的圓點優先**，即使它不是最上面那一層。圓點半徑只有 6–7 px，沿線標註的命中範圍卻是整個文字方塊。實測「阿里山山脈」的標註剛好蓋住大塔山，純照算繪順序那座山峰一樣點不到——而標註畫在點之上是 `layerOrder.ts` 的既定設計，不能為了這件事去動堆疊。線、標註與面在別的地方都還有一大片可以點，那顆點沒有別的地方可以點。
- 否則取 `queryRenderedFeatures` 的第一筆（畫在最上面的）。

兩個實作細節不要拿掉：**競爭圖層清單要用 ref**（已綁好的 instance 不會重綁，得讀得到之後才勾選的圖層），**查詢前要用 `map.getLayer()` 濾掉不存在的 id**（切底圖的瞬間圖層是真的不存在的，混進去 maplibre 會報錯）。

### 顏色

`src/map/thematicColors.ts` 是唯一的顏色來源。策略是**三組獨立色票**（`POINT` / `LINE` / `FILL`），各自**組內** all-pairs 驗證即可——形狀本身就在區辨（18% 透明度的面染跟 6px 圓點是不同的視覺通道），跨幾何的配對不需要驗證。每組再用 `MAX_ACTIVE_BY_KIND`（circle 4 / line 3 / fill 2）封頂，需求才維持在可解範圍。

已驗證：地形景點藍 `#2a78d6` + 原住民族紅 `#e34948`；物種三色青／黃／紫；線／面**五色** 水系藍 `#2a78d6` + 行政區橘 `#d95926` + 山脈洋紅 `#c23f8f` + 保護區紫 `#7538ae` + 交通翠綠 `#2da26d`：

```bash
node scripts/validate_palette.js "#2a78d6,#d95926,#c23f8f,#7538ae,#2da26d" --pairs all --mode light|dark
# → 兩模式五項檢查全數 PASS，唯一一項 WARN 是深色模式下保護區紫的 2.43:1（見下）
# → CVD 最差 ΔE 8.3（翠綠↔洋紅，deutan）、一般視覺最差 ΔE 16.6（保護區紫↔洋紅）
```

⚠️ **保護區紫與交通翠綠是在兩條分支上各自加入的**，各自只跟前三色驗過（都寫成
「四色」）。合併之後才第一次以**五色**一起驗證——結論是沒有新的衝突：最差的那兩
對仍然是各自原本就記錄的那兩對，紫↔綠這一對（兩邊都沒驗過的組合）比它們都寬鬆。
**下次再加第六個線／面顏色時，要驗的是完整的五色清單，不是「前三色 + 新色」。**

#### ⚠️ 保護區紫是唯一一個「帶著 WARN 上線」的顏色

`#7538ae` 在**深色模式**對面板底色的對比只有 **2.43:1**（低於 3:1）——正是當初否掉
山脈紫 `#7a3fa6`（2.56:1）的那一項。這次判斷相反，理由要一起看才成立：

1. **山脈那次有乾淨的替代品（洋紅），這次沒有。** 掃過整個 OKLCH 色域（L 0.48–0.68
   × C 0.08–0.24 × 全色相）之後，在四色 all-pairs 下**六項全 PASS** 的只剩 h 152–160
   的綠（`#5aa173` 一帶）與 h 308 的淡紫 `#a684c5`。
2. **那兩個在地圖上都不能用，是實測不是推測。** 臺灣主題的建議底圖是 NLSC 通用電子
   地圖，山區底色就是綠的，而保護區有一半以上落在山區——`#5aa173` 疊上去之後玉山、
   太魯閣、大武山的界線幾乎描不出來（跟當初排除綠與棕當山脈線色是同一個理由）；
   `#a684c5` 彩度只有 0.10，同樣糊掉。三個候選在同一個視角實際疊過才選的。
3. **WARN 要求的 relief 在這個 UI 裡本來就成立。** 色塊只出現在圖層抽屜與圖例，兩處
   一律緊接著圖層名稱的文字，色塊從來不是唯一的辨識線索。

**要改這個顏色，請先把上面兩族候選在 NLSC 底圖的山區實際疊一次再說**，不要只看驗證
器的輸出——這件事驗證器測不出來。

#### 交通翠綠 `#2da26d` 是掃出來的，不是挑出來的

前三色已經把色相空間佔掉大半，第四色的可行區間非常窄。用 OKLCH 掃過整個色域（色相每 2.5°、L 0.44–0.78、C 0.10–0.30，逐點跑明暗兩模式的 all-pairs），**零 WARN 的候選只剩 21 個**，集中在色相 150–162° 的一段綠，外加兩個彩度低到當地圖線太虛的淡紫。直覺會先想到的選擇全部不合格：紫 `#7a3fa6`／`#8335c3` 在 dark 模式對比只有 2.56–2.77:1（WARN，與當初 relief 拒絕紫色**同一個**原因）、青綠 `#00857a` 直接 FAIL、綠 `#009e73` 對洋紅的 deutan ΔE 只有 6.2。

**要換色請重跑掃描，不要憑感覺往旁邊挪**——這一格四周就是 WARN。

綠色在 relief 被禁、在這裡可以，理由是處境相反：山脈線整條走在 NLSC 的綠色山區底色上，交通軸線絕大部分走西部平原（NLSC 是白／灰底），而且這一層的教學重點正是「路線**繞開**山地」。

⚠️ 順帶一提，保護區紫當初排除的候選之一正是 h 152–160 的綠（`#5aa173`），理由是
「保護區有一半以上落在山區，綠色會被 NLSC 的山區底色吃掉」。那跟這裡選翠綠**不衝突**：
兩層的地理分佈相反（保護區在山上、交通軸線在平原），所以同一個色相對前者不行、對
後者可以。要動這兩個顏色任一個，都要先想清楚它實際會疊在什麼底色上。

行政區橘刻意用 `#d95926` 而不是色票的 light step `#eb6834`：後者在 **dark 模式的亮度帶檢查會 FAIL**。地圖是 WebGL 畫布只能有一組固定色，所以必須挑「兩個模式都過」的值。

山脈（`relief`）同理選 `#c23f8f` 而不是製圖上更常見的紫 `#7a3fa6`——紫在 **dark 模式的對比只有 2.56:1（WARN）**，`#6d3f9e` 與物種紫 `#4a3aa7` 則直接在 dark 模式亮度帶 FAIL。**棕色與綠色是被排除的**，不是沒想到：等高線 `rgba(120,78,42,.55)` 與地形陰影 `#5a4632` 都是棕的，而 NLSC 通用電子地圖的山區底色是綠的——山脈線畫成那兩種顏色，等於畫在它自己要說明的那片地形上看不見。

#### 唯一一個「顏色跟著數值走」的圖層：水庫蓄水率

一般規則是顏色代表**圖層身分**，狀態只准動尺寸與外框。水庫是明確的例外，理由跟地震用震級驅動半徑相同：`percent` 是圖徵**自己的資料屬性**，不是 UI 狀態，而且這一層存在的理由就是即時水情——全部畫成同一顆藍點，「哪幾座快見底了」就得一顆一顆點開。

色階是 `RESERVOIR_FILL_RAMP`（`thematicColors.ts`）：dataviz 參考色票的藍 ramp step 250／400／500／600，**單一色相由淺到深**（sequential／ordinal 的規則，不是紅→綠那種 status 配色）。驗證用的是 **`--ordinal` 模式**，不是分類色的 `--pairs all`：

```bash
node scripts/validate_palette.js "#86b6ef,#3987e5,#256abf,#184f95" --ordinal --mode light|dark
# → 兩模式各四項全數 PASS（單一色相、亮度單調、步階間距 ≥ 0.06、淺端 2.06:1）
```

⚠️ 用分類色的 `--pairs all` 去驗一條正確的 ramp **會 FAIL，那是設計如此**（它本來就橫跨整個亮度帶、相鄰步階刻意相近），不要為了讓它過而去改壞色階。**兩端不要再往外延伸**：step 200 `#9ec5f4` 在淺色模式只有 1.74:1、step 700 `#0d366b` 在深色模式只有 1.46:1，都低於 2:1 下限。

「暫無資料」的灰 `#7d7c76` 刻意**不在 ramp 裡**——資料缺漏不是「蓄水率很低」，混進色階等於謊報。有 ramp 的圖層，`MapLegend` 必須把級距一起畫出來（只給一個代表色的圖例會讓深淺不同的圓點變成看不懂的雜訊）。

⚠️ **`ColorRamp.nodata` 是選填的，只在真的會有缺值時才宣告**——它會在圖例上多畫一列。人口那一層 368 個鄉鎮每一個都有統計（沒有的兩筆在取得層就濾掉、不會變成 feature），宣告它等於在圖例上放一個永遠不會出現的類別。省略時缺值的 feature 畫成圖層的身分色，但 `rampExpression()` 的 `["case", ["has", prop], …]` 那層守衛**仍然要留著**：`["step"]` 拿到 null 一樣會在執行期炸，而「保證每筆都有值」是資料的承諾、不是型別系統擋得住的事。

#### 第二個「顏色跟著數值走」的圖層：古蹟指定級別

古蹟三級（國定／直轄市定／縣(市)定）是**序位**，不是三個平等的類別，所以跟水庫同一條
規則——單一色相由淺到深，**不佔用分類點色票**（那份色票 CLAUDE.md 已記錄為飽和）。
色階是 `MONUMENT_LEVEL_COLORS`（赭紅／磚色，由淺到深＝級別由低到高）：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#aa604e,#934c3a,#7d3827" --ordinal --mode light|dark
# → 兩模式各四項全數 PASS
```

跟水庫不同的是，古蹟三級是三個**各自可勾選的子圖層**，所以色階不是 `colorRamp`，
而是用 `LayerItem.color` 把顏色**固定綁在各級上**。⚠️ `items` 的預設行為是**依勾選
順序**從 `palette` 指派（特有種那樣是對的，物種之間沒有序位），古蹟不能這樣：先勾
「縣(市)定」再勾「國定」的話，國定會拿到中間色，「越深＝級別越高」的圖例當場失效。
**地圖、圖例與圖層抽屜三個地方一律走 `resolve.ts` 的 `itemColorOf()`**——誰自己寫一次
`palette[index % len]` 都會靜默不一致。

⚠️ **這件事真的發生過，而且潛伏了很久**：`LayerPanel` 的子項目色塊原本自己算
`palette[selectedIds.indexOf(id) % len]`，**完全略過 `LayerItem.color`**。實測先勾
「國定古蹟」時，抽屜畫的是 `#aa604e`（那其實是縣(市)定的顏色），地圖與圖例畫的是固定色
`#7d3827`——抽屜裡「越深＝級別越高」當場失效，而且畫面上沒有任何錯誤。作物三色與垂直
植被帶六帶（都靠固定色）也一起受影響。**索引仍然是勾選順序**，特有種那種依 palette
指派的圖層行為才不會變。

**為什麼是赭紅而不是飽和的棕**：語意上棕色最像古蹟，但真正的判準是**古蹟與原住民族
同屬「人文」群組、很可能一起勾**，所以色階中間色必須跟原住民族紅 `#e34948` 分得開。
飽和棕 `#b5793c` 對它的 **deutan ΔE 只有 0.6**（紅綠色盲完全分不出來）、一般視覺也只有
12.7（低於 15）。掃過整個 OKLCH 色域後，同時通過 `--ordinal` 與
`validate_palette.js "#2a78d6,#e34948,<中間色>" --pairs all` 的只剩三族：低彩度赭紅／棕
（h 25–50）、黃綠（h 115–155，撞特有種綠與交通翠綠）、洋紅／紫（h 310–345，撞山脈洋紅
與物種紫）。赭紅是唯一語意也對的。

⚠️ **棕色系在這個站上有前科**：等高線 `rgba(120,78,42,.55)` 與地形陰影 `#5a4632` 都是
棕的，山脈線就是因此不能用棕。古蹟能用的理由跟交通軸線能用綠色一樣是**地理分佈相反**
——古蹟絕大多數在市區與平原（臺北 209、臺南 142、金門 96），NLSC 在那裡是白／灰底，
而且圓點有白色外框。要改這個顏色、或懷疑山區的古蹟看不清楚時，**先在 NLSC 底圖的
山區實際疊一次再說**。

#### 第三個色階：人口密度的紫

`POPULATION_DENSITY_RAMP`（`#c7a2d7` → `#a66ac0` → `#87519e` → `#673b7a`，
級距 500／2,000／10,000 人/km²）。跟水庫、古蹟同一條規則：`density` 是圖徵自己的資料
屬性，而這一層刻意讓**半徑＝人口數、顏色＝密度**各佔一個通道。

⚠️ **它是掃出來的，不是挑的**，而且限制比前兩次更緊——紅棕那一族已經被古蹟佔走了。
條件有兩層：色階本身過 `--ordinal`，而**中間色**還要跟同屬「人文」群組、實際上很可能
一起勾的點圖層過 `--pairs all`：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#c7a2d7,#a66ac0,#87519e,#673b7a" --ordinal --mode light|dark
node <dataviz-skill>/scripts/validate_palette.js "#2a78d6,#e34948,#934c3a,#87519e" --pairs all --mode light|dark
```

掃過整個 OKLCH 色域（色相每 2.5°、四種彩度，亮度與彩度剖面照抄水庫那條已驗證的
ramp）後，兩關全過的**只剩色相 310–332° 的紫／洋紅那一族**，18 組候選——正是古蹟那次
記錄的三族之一。在那 18 組裡選 h=315／彩度 0.14，理由是它是**唯一一組深色模式對比
3.07:1、真的清得過 3:1** 的，其餘每一組都落在 2.96–3.02 而要多欠一筆 relief。

⚠️ **`--pairs all` 輸出裡的兩個 WARN 都不是這個新色造成的**：CVD 最差的
`#934c3a↔#e34948`（ΔE 7.2 protan）與深色對比 `#934c3a` 2.77:1 都是古蹟↔原住民族那組
**既有**的，拿掉 `#87519e` 重跑一模一樣。新色自己最差的一般視覺配對是 15.2（過 15）。

⚠️ **不要改用色階裡別的階當身分色**：實測第 2 階 `#a66ac0` 直接 **FAIL**——它對地形
景點藍 `#2a78d6` 的 protan ΔE 只有 3.6。

⚠️ 保護區紫 `#7538ae`（h 304）只差 11°，但那是**面**、這是**圓點**，跨幾何不驗（既有
規則），而且兩層的地理分佈相反——保護區在山上、人口集中在西部平原，跟交通翠綠能用的
理由相同。**已經實測過**（NLSC 底圖、zoom 10）：全臺形心真的落在保護區面上的人口點只有
兩個——花蓮縣卓溪鄉（玉山國家公園）與秀林鄉（太魯閣國家公園），都是最淺那一階，白色外框
把圓點跟底下的紫色面切得乾淨、讀得出來。**要改這個顏色的話再疊一次。**

#### 第四組色階：垂直植被帶的暈渲設色（規則不一樣）

`VEGETATION_BELTS`（`#246135` → `#53803c` → `#949938` → `#cead59` → `#e7c89f` → `#f0e6da`，
由低海拔到高海拔）。⚠️ **它跟前三條色階不是同一類東西**：水庫、古蹟、人口是**序位
色階**（單一色相由淺到深）；這一條是**暈渲設色**（hypsometric tint）——蓋滿全島、
半透明、由 DEM 高程直接驅動的連續場，跟 hillshade 的棕色與等高線的棕色同屬
「非分類的固定角色」，**不參與 POINT／LINE／FILL 那三組 all-pairs 驗證**。

該驗的是「六帶讀不讀得出順序」：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#f0e6da,#e7c89f,#cead59,#949938,#53803c,#246135" --ordinal --mode light|dark
# → 亮度單調 PASS、相鄰 ΔL 全部 ≥0.06 PASS（兩個模式）
```

⚠️ **另外兩項是預期會 FAIL 的，不要為了讓它們過而改壞色階**：

- **Single hue（色相跨度 77°）**：暈渲設色本來就是多色相。綠→黃→白對應
  「闊葉林 → 針葉林 → 裸岩與雪」，那正是這一層要教的；改成單一色相就講不出來了。
- **Light-end contrast（`#f0e6da` 淺色模式只有 1.20:1）**：那一項量的是「色塊 vs
  圖表底色」，而這條 ramp **從來不畫在面板上**，只有圖例的小色塊會碰到面板。
  高山寒原就是要接近裸岩與雪的顏色，壓深它等於謊報。比照保護區紫帶著 WARN 上線的
  既有判例：色塊一律緊接著帶名文字，從來不是唯一線索；另外圖例色塊用
  `.layer-swatch-band` 把邊框換成 `var(--text-muted)` 的實線補償。

**真正該驗的是它疊在 NLSC 底圖上讀不讀得出來**，驗證器測不到——NLSC 的山區底色
本來就是綠的（山脈線與保護區不能用綠就是這個原因）。改色前先在玉山一帶打開 3D
地形實際疊一次。

#### ⚠️ 線／面色票其實**沒有**飽和——那個結論來自一次太粗的掃描

本檔案一度記錄線／面五色已飽和。加活動斷層時重掃才發現：那次掃描的 **L 步進是
0.06、彩度從 0.10 起跳**，剛好跳過 L≈0.485 那一條窄縫。把步進降到 0.005 之後，
`#8f463f`（磚紅）讓**六色 all-pairs 兩模式全數 PASS**：

```bash
node <dataviz-skill>/scripts/validate_palette.js "#2a78d6,#d95926,#c23f8f,#7538ae,#2da26d,#8f463f" --pairs all --mode light|dark
# → 一般視覺最差 #8f463f↔#c23f8f ΔE 15.8（剛好過 15 的硬下限）
# → CVD 最差仍是既有的翠綠↔洋紅 8.3（沒有因為多一色而變差）
# → 唯一 WARN 是深色模式對比 2.58，跟保護區紫的 2.43 同一類、同一個既有判例
```

⚠️ **餘裕非常小（15.8 對下限 15）**，往任何方向挪都可能掉出去。要改色請重跑上面
那條完整六色指令，而且 **L 的掃描步進不要大於 0.005**——粗掃會讓你以為無解。

紅色在語意上也對：官方「臺灣活動斷層分布圖」與課本畫斷層就是紅的。⚠️ 它跟古蹟
赭紅 `#934c3a` 很近，但古蹟是**圓點**、斷層是**線**，跨幾何本站不驗（既有規則），
而且地理分佈相反——古蹟在市區與平原，斷層沿山前與縱谷。

#### 主要作物三色，以及「物種三色全數 PASS」這句話已經不成立

作物三色 `CROP_COLORS`（果樹 `#d36085`／蔬菜 `#7d9913`／茶 `#0994de`）是**分類色**，
用 `--pairs all` 驗證：CVD 最差 ΔE 10.4、一般視覺最差 25.9，彩度下限與亮度帶**兩個
模式都過**。

⚠️ **校準過的事實：現行的物種三色（`#1baf7a,#eda100,#4a3aa7`）用現在的驗證器重跑，
深色模式的亮度帶檢查是 FAIL**（`#eda100` L=0.764、`#4a3aa7` L=0.433 都在帶外），
CVD 9.1、一般視覺 22.9。也就是說本檔案舊版寫的「物種三色 all-pairs 全數 PASS」
**已經不可重現**（驗證器或色票其中之一變過）。作物色是刻意選在**比它更嚴格**的
位置上的，要改色請至少維持 CVD ≥ 9.1、一般視覺 ≥ 22.9，而且兩個模式的亮度帶都過。

⚠️ **為什麼只有三種作物**：不是挑剩的，是掃出來的上限。用 OKLCH 掃過色相／亮度／
彩度找**四色**分類組合，能達到上面那個分離度的**一組都沒有**——四個分類色本質上
就是沒辦法跟三個一樣好分。所以這一層維持三個子圖層。

顏色與作物的對應靠圖例文字，不是靠「像不像」——茶配藍不是寫錯，那是掃描後唯一可行
的第三個色相（比照交通軸線的翠綠是算出來的，不是挑出來的）。

`reference`（緯度參考線）與 `hazard`（地震帶）是**非分類的固定角色**，比照 hillshade 的棕色，刻意排除在色票驗證之外。地震帶尤其不該給分類色相：2800 個依震級縮放的點是**密度場**，教學內容是「地震帶沿板塊邊緣浮現」，不是「這個色相代表地震」；給它色相不但擠爆色票驗證，2800 個不透明白框圓點在投影機上也只是一坨糊的（所以 `strokeWidth: 0` 必須是可設定的）。

⚠️ **「非分類的固定角色」不等於「沒驗過」。** `plate`（暖褐）、`continent`（梅紫）、
`mountain`（世界主要山脈的紫）與 `volcano`（洋紅）都是「一整層同一個顏色」所以不進
三組色票，但它們**各自掃過同框名單**（見 `thematicColors.ts` 逐個常數的說明）——只有
`reference`、`hazard`、`wind` 與 `vegetation` 是真的不驗。加新角色時先確認自己屬於
哪一種。

#### ⚠️ 但中性色的另一頭是「看不見」，那不是「低調」是壞掉

「全球地震帶」初版是 `radius: mag 6.5→1.5, 9→6` ＋ `opacity: 0.35`，實測在**主題預設
視角**（`center [0,10]`、`zoom 1.8`，也就是勾起圖層之後看到的第一眼）幾乎完全看不見，
使用者的回報是「勾了圖層但地圖上沒有任何資料」。三件事疊在一起：

1. 那個視角正中央是**非洲與大西洋**——全球最沒有地震的地方——環太平洋全被推到畫面兩側；
2. 絕大多數圖徵落在 M6.5–7，半徑只有 **1.5–2 px**，而且半徑不隨 zoom 變，低縮放時就是
   這麼小；
3. 0.35 的深灰在淺色底圖上本來就接近看不出來。

現在是 `2.6→7` ＋ `0.55`（實測 zoom 1.8 讀得出安地斯、中美洲、印尼、日本、喜馬拉雅與
地中海－伊朗各條帶，zoom 4 的印尼一帶仍是一顆顆分得開的點）。

⚠️ **`queryRenderedFeatures` 完全抓不到這種問題**：出事的時候它照樣回 1,829 筆，圖層在、
source 也 loaded。這一類「畫得出來但看不見」的缺陷**只能看畫面**，而且要在**圖層自己的
預設視角**看——換個地方看（跳到環太平洋）它一直都是好的。

⚠️ **也不要用白框去救。** 同一個視角實測 `strokeWidth: 0.6`：日本海溝與印尼一帶變成一片
白色雜訊、連底圖地名都被吃掉，正是這一層當初決定不畫外框的原因。要提高可讀性請動
**不透明度與半徑下限**，不要動外框。（「臺灣地震」相反——612 筆疊在忙碌的 NLSC 底圖上，
白框才是關鍵。兩層的判準不同，不要互相照抄。）

### 選取中的圖徵怎麼強調

同一個圖層裡所有圖徵都是同一個顏色（顏色代表**圖層身分**，不是個別圖徵），所以選了 16 族裡的某一族之後，地圖上根本認不出哪一顆紅點是它。

**強調不可以用換顏色做。** 那會讓「紅點＝原住民族」這個圖例對應失效，也違反「顏色跟著實體、不跟著狀態」。改用**尺寸與外框**這兩個獨立通道，色相完全不動：

| 幾何 | 選取時 |
|---|---|
| circle | 半徑 ×2、外框 3px、不透明度 1 |
| line | 線寬 ×2.2、不透明度 1 |
| fill | 面不透明度 0.38、外框 ×2.5 |

實作在 `addGeoLayer` 的 `whenSelected()`，做成 data-driven 的 `case` 表達式而**不是**另外加一個 highlight 圖層——後者會多出必須排進 `layerOrder` 那條堆疊帶的圖層 id，而且切底圖時得再寫一條狀態同步路徑。表達式的寫法是 `["*", base, 倍率]` 而不是先算成數字，因為 `base` 本身可能就是表達式（地震用震級驅動半徑）。

`useGeoLayers` 收的是**一份 id 清單**（`highlightIds`），不管它們屬於哪個圖層：圖徵 id 在各 collection 內唯一（`taipei`／`amis`／`tw-tao`），同時可見的兩層撞 id 實務上不會發生。它跟 `instances` 一樣要放進 ref，切底圖 `reapply` 才帶得到當下的強調；effect 依賴用 `join("|")` 的字串，比照 `instanceKey`，否則每次算繪的新陣列都會白重跑。

### 順帶強調的關聯圖徵（山脈 → 主峰）

清單之所以是清單而不是單一 id：**選了山脈要連它的主峰一起標出來**，否則畫面上只有一條線，看不出最高點在哪。

關聯寫在資料裡——`tw-ranges.geojson` 每個 feature 有 `peakId`，指向 `src/content/places` 的主峰 id。`ThemeMapPage` 的 `highlightIds` memo 會在選取的圖徵上找這個屬性並把它加進清單。

兩個圖層**互相不需要知道對方**：山脈在 `tw-ranges`、主峰在 `tw-range-peaks`，各自拿同一份清單去比對即可。要再加別的關聯（例如流域 → 出海口）只要在 geojson 補一個同名屬性，不必動算繪程式。

### 新增資料

**手動整理的內容**（地點、原住民族、物種介紹）：建 `src/content/<type>/<id>.json`，**檔名必須等於 `id`**，跑 `npm run validate`。

**註冊表驅動的地理要素**（縣市、河流、山脈、洋流…）：
1. 幾何進 `public/data/geo/`（`npm run build:geodata` 產生）或 `public/data/geo-manual/`（手繪示意幾何）
2. 在 `registry/themes/*.ts` 加一筆圖層定義
3. 說明文字**選填**：`src/content/geo/<collection>/<id>.json`。**沒有內容檔時 `FeatureCard` 會退回顯示 geojson 的 `name` + 圖層自己的 `description`/`sources`**，所以新圖層可以先上線再逐一補寫（22 個縣市與 5 條山脈目前都已補齊）

示意幾何一定要標 `schematic: true`，UI 才會顯示「教學示意圖，非精確界線」的警語——這是內容誠信的承諾，比照 GBIF 觀測點與 ERA5 氣候值的既有做法。

⚠️ **「示意」不等於「放 `geo-manual/`」。** 行星風系與洋流都是示意的，但兩者都走
`generators.ts`：前者的座標其實是**參數**（帶的緯度、箭頭間隔），後者雖然是手訂的
**座標**，卻需要程式算箭頭、切 ±180 並在控制點旁邊寫註解。判準是「有沒有非座標的
東西要一起維護」——只有純粹的一份手繪多邊形才適合 `geo-manual/`。

### 已知資料限制

- **臺灣各圖層的資料限制（縣市界、鄉鎮界、遠洋離島、五大山脈、臺灣123、兩個刻意
  移除的圖層…）搬到 `CLAUDE_TW.md`** 的「已知資料限制（臺灣）」。下面留的是跨主題的幾條。

- **geojson 的 feature 順序就是圖層抽屜裡可點清單的顯示順序。** `LayerBrowseList` 直接照 `data.features` 算繪、**刻意不排序**——共用元件不該知道哪個圖層該怎麼排，排序規則跟著資料集走。縣市界排成**由北到南、離島（連江→金門→澎湖）整組最後**，在 `build-geodata.mjs` 的 transform 裡做掉，上游 GML 的順序是任意的。

  南北用**主體（面積最大那一塊）的面形心緯度**，不是最北端：高雄市一路往北延伸到那瑪夏（23.47°N）比臺南市的最北端還北，依最北端排會排出「高雄在臺南前面」這種一看就錯的順序。離島另外分一組也是同樣的道理——純依緯度排，連江縣（26.2°N）會跳到基隆市前面、金門縣會插在苗栗與臺中之間，把「由北到南」這條線索攔腰截斷。

- **Natural Earth 的河流沒有中文名欄位**，中文名靠 `build-geodata.mjs` 裡的 `RIVER_NAMES_ZH` 對照表。對不到就沿用原名。注意 NE 把黃河的 name 寫成 `"Huang"`（不是 `"Huang He"`）。

- **國際換日線（`date-line`）不是 180° 經線，不要自己畫一條直線交差。** 它為了不讓同一個
  國家跨在兩個日期上，繞開了楚科奇、阿留申群島、吉里巴斯與薩摩亞——那個折線形狀正是這
  一層唯一要教的東西（吉里巴斯 1995 年把萊恩群島改到線的西側，才有現在往東凸到西經 150°
  的那一大塊）。幾何取自 Natural Earth 的 `ne_10m_geographic_lines`（`featurecla` 就是
  `Date line`），是製圖界的標準畫法，所以這一層**不標 `schematic`**；但「沒有國際條約規定
  它在哪」仍然要講，寫在註冊表的 `notes` 裡。

  ⚠️ **上游把它切成 5 段是必要的，不是資料髒。** 折線橫跨 ±180，接成一段的話某兩個相鄰
  節點會從 179.99 跳到 -179.99，maplibre 會照著畫一條**繞過整個地球**的橫線，而且不會有
  任何錯誤訊息。`build-geodata.mjs` 的 transform 因此逐段檢查經度跨距 < 180°。

  ⚠️ **沿線標註的 `spacing` 不可以照抄緯度參考線的 320。** 那是給九條各自很長的橫線用的；
  換日線被切成 5 段、單段在畫面上經常短於 320px——實測主題預設視角（zoom 1.8）用 320 是
  **0 個標註**、240 是 1 個，200 才穩定拿到 2 個。標註是垂直排列的（maplibre 對 CJK 的
  `line` 放置會自動直排，字是正的不是側躺），跟紙本地圖的習慣一致。

  ⚠️ **搜「國際換日線」只會勾起圖層、相機不會動**，那是 `kind: "layer"` 搜尋結果的**既有
  行為**（`ThemeMapPage` 的 pendingHit effect 在 `!pendingHit.featureId` 就 return，
  fitBounds 那一段永遠走不到），不是這一層特有的——實測搜「全球地震帶」也一樣。要修的話
  是那條守衛，不是這個圖層。
- **相鄰的面各自簡化會在共用邊界開出次像素縫隙**（Douglas–Peucker 不保拓樸）。免依賴的緩解方式是設 `maxzoom`（縣市界設 11），讓它在縫隙變得可解析之前就停止繪製。

## 全螢幕地圖外框與浮動控制

兩個主題頁的版面是 `ThemeMapPage` 組出來的 `.map-shell`（`position: fixed; inset: 0`）：

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

`--z-map-ui: 5` → `--z-scrim: 10` → `--z-drawer: 15` → `--z-panel: 20` → `--z-popover: 30`。

**詳情面板在抽屜之上**，而且抽屜開著時它從 `top: 0` 起算（`.map-shell[data-drawer-open="true"] .map-detail-panel`），把抽屜**整片蓋住**——關掉詳情就回到剛才那份可點清單，不用重開抽屜、重新展開圖層。所以**選取圖徵不會動到抽屜**：`useDrawerOpen` 只有 `setOpen` 一個 setter，早期那個「選了圖徵就自動收起抽屜、但不寫 localStorage」的 `closeTransient` 已經連同五處呼叫一起移除。

⚠️ 那條 `top: 0` 的特異性（0,3,0）高過 `@media (max-width: 860px)` 裡的 `.map-detail-panel`（0,1,0），**光靠媒體查詢寫在後面是壓不過它的**。窄螢幕的底部抽拉卡因此要用**一模一樣的選擇器**把 `top: auto` 寫回去，否則會變成 `top: 0` + `height: 62dvh` 的怪版面。

遮罩（`--z-scrim`）是**抽屜的**遮罩，所以排在抽屜之下——它原本被夾在 panel 與 drawer 中間，只是為了在舊順序下蓋住詳情面板。`--z-popover` 仍高於 `--z-panel`，搜尋建議清單照樣蓋在詳情之上。

抽屜**首次造訪預設收起**：它蓋住的正好是左上角的搜尋框，預設開著會讓人第一眼看不到這次的主要入口。圖層仍然找得到——☰ 就在搜尋藥丸最左邊，而且搜尋本身也搜得到圖層名稱。

maplibre 的四個角落容器是 map container 內的 `position: absolute; z-index: 2`，所以 `.map-shell-canvas` 要 `isolation: isolate` 把它關進自己的堆疊脈絡。浮動控制的容器一律 `pointer-events: none`，只有按鈕與面板本身 `auto`，否則會吃掉地圖手勢。

### 內建控制的位置

主題頁把 `NavigationControl` 與 `ScaleControl` 都移到 `bottom-right`（`MapView` 的 `navPosition` / `scalePosition` prop，預設值維持 top-right／bottom-left 給 `/compare`），因為右上角讓給 ⋮⋮⋮、左下角讓給「圖層」磚。`MapLegend` 也從絕對定位改成 `.map-bottom-left` 這個 flex 欄位的普通子節點，白拿面板閃避。

**maplibre 自己的控制維持預設淺色外觀**：它的圖示是內嵌的深色 SVG data URI，把 `.maplibregl-ctrl-group` 換成 `var(--surface)` 會讓深色模式下的圖示直接消失。它們疊在圖磚上，而圖磚本來就不隨主題變色。

### 彈出層機制（`src/usePopover.ts`）

**不用 `<dialog>`、不用原生 Popover API。** `showModal()` 會鎖焦點並擋住地圖拖曳；`show()` / `popover=""` 會升到 top layer，於是跳出上面那道 z-index 階梯與 `--left-panel-w` 的定位脈絡——而整個 shell 的重點就是這幾層彼此的相對順序。

- Escape 掛在**面板層級**的 `onKeyDown`，不是 document 監聽：開啟時焦點已在面板裡，Escape 自然只關掉最上層；document 監聽會把抽屜跟選單一起關掉。**圖層抽屜是唯一的例外**（`dismissOnEscape: false`），見下。
- `didOpenRef` 擋住「抽屜從 localStorage 還原成開啟」時在首次算繪就搶走文件焦點。**焦點還給觸發器那條路徑跟誰關掉它無關**：那個 effect 只看 `open` 由真變假，所以用 ☰ 開的抽屜即使是被下面那個 shell 層級的 Escape 關掉，焦點一樣會回到 ☰。
- 點外面關閉用 `pointerdown` 而不是 `click`，這樣彈出層會在 maplibre 開始拖曳前就關掉。原生 `<select>` 的選項清單不派發頁面層級的 `pointerdown`，所以「圖層」彈出層裡的底圖 `<select>` 不會把自己關掉。
- 不做 focus trap、不加 `aria-modal`：底下的地圖仍然可以操作，宣告成 modal 是對輔助科技說謊。

#### ⚠️ 全站唯一掛在 document 上的 Escape

抽屜與詳情面板現在可以同時開著，關的順序要有人仲裁，所以那一個 Escape 由 `ThemeMapPage` 的一個 effect 統一處理，抽屜的 `usePopover` 用 `dismissOnEscape: false` 把自己那份讓出來。**由上往下逐層退出，一次一層**：

1. 詳情面板開著 → 關詳情（抽屜不動）
2. 否則抽屜開著 → 關抽屜
3. 兩個都關著（畫面上只剩地圖）→ **清掉所有疊圖**（`activeLayerIds` 與 `activeItemIds` 一起清），回到一張乾淨的底圖

第 3 層的兩個 setter 都用函式形式在沒東西可清時回傳原值，這樣「地圖上什麼都沒有時再按 Escape」是真正的 no-op，不會產生新的 `Set`／物件而白重算一次 `active` → `instances`。⚠️ 它清的是**主題圖層**：等高線、地形陰影、3D 地形屬於底圖層級（`MapView` 加的），不在這個範圍裡，也不該進來。

- **必須掛在 document**，這一條跟上面的既有規則相反：焦點不一定在面板裡——點地圖圖徵之後焦點還在 canvas（甚至 body）上，面板層級的 `onKeyDown` 根本收不到，而詳情面板在改動前**完全沒有鍵盤關閉方式**就是這個原因。
- **不會出現當初排除 document 監聽時擔心的「一次關掉兩層」**：仲裁一次只關一層。
- **巢狀的彈出層仍然優先**：⋮⋮⋮、「圖層」磚與搜尋建議清單都在自己的 `onKeyDown` 裡 `stopPropagation()`，而 React 的合成事件會連帶呼叫**原生**的 `stopPropagation`，事件冒不到 document。實測：搜尋框裡按 Escape 只收起建議清單、詳情不動；⋮⋮⋮ 開著時按 Escape 只關選單。
- ⚠️ **抽屜的 `usePopover` 不可以退回成自己處理 Escape**。最常見的那個流程是：點抽屜清單裡的一列（焦點停在那顆按鈕上）→ 詳情疊上來 → 按 Escape，面板層級的 handler 會先攔到，**關掉的是底下看不到的抽屜而不是最上層的詳情**。
- 關抽屜用 `setOpen`（會寫 localStorage）：按 Escape 是使用者主動的動作，語意跟點 ✕ 一樣。

`usePopover` 由 `ThemeMapPage` 呼叫（不是 `LayerDrawer` 自己），因為 ☰ 現在住在搜尋藥丸裡、面板是抽屜，兩者不再共用一個 DOM 子樹。這樣拆是安全的：`rootRef` **只**用在「點外面關閉」那個 effect，而抽屜是 `dismissOnOutsideClick: false`，那個 effect 直接 early return；焦點的進出靠 `triggerRef`／`panelRef`，與 DOM 結構無關。

`MapSearchBox` 的建議清單**不重用 `usePopover`**：它的觸發器語意是 `aria-haspopup="dialog"` 的按鈕，而搜尋框是 combobox（輸入框自己是觸發器、清單是 listbox），套上去是對輔助科技說謊。但「點外面用 `pointerdown` 關閉」的手法是照抄的，理由相同。

---

## 主題頁搜尋（`src/search/searchIndex.ts` + `MapSearchBox`）

兩個主題頁共用同一個搜尋框，索引跨全部兩個主題。

### 索引哪些東西（規則要照著走，不要臨時擴充）

`allLayers()` 裡 `status === "ready"` 的圖層：

- **地物**：只索引「有 `browse` 設定」「有 `items`」或「來源是 `generated`」的圖層。
  `browse` 本來就代表「這個圖層的圖徵是一份可以逐一點選的清單」，所以新圖層照常宣告 `browse` 就會自動進索引。
  ⚠️ 這條規則同時把 `quakes` 擋在外面，這是刻意的：那份 geojson 有 **400 KB**、2831 筆**沒有名稱**的點，它是密度場不是清單。索引它只會多抓一份大檔案再產生 2831 筆搜不到的項目。
- **圖層本身**：所有 ready 圖層的名稱（搜「河流」要找得到「世界主要河流」這個圖層）。`planned` 的不列，因為勾不動。
- 沒有 `properties.id` 或沒有 `properties.name` 的圖徵一律跳過——前者選不了、後者搜不到。
- 比對的字串是 `name` + `shortName` + `en` + `meta` + 內容檔別名。**`shortName` 一定要在裡面**：它是沿線標註在地圖上實際印出來的字（「高鐵」「國道1」），使用者看到什麼就會搜什麼。少了它，搜最常用的俗名「高鐵」只會搜到圖層本身，而圖層結果是不開卡的——「國道」「南迴」剛好是全名的子字串，所以這個洞不會在那兩個字上暴露出來。`en` 是上游原生就有英文名時才有（目前只有鄉鎮的 `TOWNENG`）：`contentKeywords()` 只對 place／indigenous／species 回傳別名，`detail.type === "geo"` 的圖層拿不到任何別名，那一行是它們唯一的來源。⚠️ 官方羅馬拼音**不一定是漢語拼音**——鹿港鎮的 `TOWNENG` 是 `Lukang Township`，搜「Lugang」是搜不到的。

#### ⚠️ 附屬圖徵的 haystack 也要收 `en`

`featureHits()` 有兩段在組 haystack：一般圖徵那段收 `name` + `shortName` + `en` +
`meta` + 別名，**附屬圖徵（`attach`）那段原本漏掉 `en`**。世界主要山脈的 39 座最高峰
是第一個帶 `en` 的附屬圖層（`Mount Everest`、`K2`、`Denali`…），於是**搜「K2」一筆
結果都沒有**——而搜「喬戈里峰」是好的、搜「Andes」也是好的（那是母圖層那一段收的），
所以畫面上完全看不出少了什麼。臺灣的兩個附屬圖層（主峰、縣市政府）的 properties
本來就沒有 `en`，這個洞因此潛伏到 2026-08 才發現。已修。

#### ⚠️ 同名去重的 key 是「名稱 + `meta`」，不是只有名稱

去重原本是為了 Natural Earth 把一條河拆成多段（`niger-0`、`niger-1`…），照單全收會讓搜「河」出現一整排一模一樣的「尼羅河」。但**同名不一定是同一個東西**：鄉鎮市區有 8 個重複名（中正區在臺北市與基隆市各一個、東區有四個），只看名稱的話搜「中正區」永遠只出得來一個，另一個**從此搜不到**，而畫面上沒有任何線索說明為什麼。

被拆段的河流不受影響——它們的 `meta` 全是 `undefined`，同名同 meta 仍然收斂成一筆（實測 world-rivers 的 24 個重複名全部如此）。

**而且撞名時要把 `meta` 補進副標**，否則畫面上是兩列一模一樣的字。這件事**只對真的撞名的標題做**：水庫的 `meta` 是「蓄水 62%・有效容量 …」這種長字串，沒撞名還硬加只會把副標塞爆。實測搜「東區」會得到四列，各自標著新竹市／臺中市／嘉義市／臺南市。

索引是 **lazy 的**：搜尋框第一次獲得焦點才 `buildSearchIndex()`。**實測（2026-08，production build 讀 `performance.getEntriesByType('resource')`）它會多抓 24 份、合計約 3.04 MB**：

| 檔案 | 大小 |
|---|---|
| `tw-townships.geojson` | 517 KB |
| `tw-basins.geojson` | 347 KB |
| `world-continents.geojson` | 326 KB |
| `tw-monuments-municipal.geojson` | 240 KB |
| `tw-rivers.geojson` | 230 KB |
| `tw-monuments-county.geojson` | 193 KB |
| `tw-counties.geojson` | 192 KB |
| `tw-protected-areas.geojson` | 183 KB |
| `world-rivers.geojson` | 146 KB |
| `plates.geojson` | 125 KB |
| `tw-crops-vegetable.geojson` | 106 KB |
| `tw-crops-fruit.geojson` | 102 KB |
| `tw-population.geojson` | 93 KB |
| `tw-monuments-national.geojson` | 51 KB |
| `tw-quakes-major.geojson` | 49 KB |
| `tw-faults.geojson` | 40 KB |
| `world-mountains.geojson` | 30 KB |
| `tw-crops-tea.geojson` | 25 KB |
| `tw-reservoirs.geojson` + `reservoirs-live.json` | 20 + 2 KB |
| `tw-typhoons.geojson` | 14 KB |
| `world-mountain-peaks.geojson` | 10 KB |
| `tw-county-halls.geojson` | 8 KB |
| `tw-strait-median-line.geojson` | <1 KB |

⚠️ **`tw-transport.geojson` 不在這張表上，那不是漏掉——它從來就不該在。** 交通軸線是
`items` 圖層，而 `featureHits()` 對子項目是 `if (!item.source) continue`：靠 `featureIds`
從母圖層切出來的子項目**沒有自己的 source**，所以那份 geojson 根本不會被索引抓。
`tw-eez`（四片經濟海域）同理，實測聚焦搜尋框後 **0 次**請求。這也表示那兩層的搜尋
完全靠 `LayerItem.keywords`，少填就搜不到（見 types.ts 的說明）。

⚠️ **`world-continents.geojson` 是這張表上唯一「七筆圖徵卻要 326 KB」的項目。** 那是
`browse` 的必然結果（有可點清單就會進索引），而它換到的是「搜『大洋洲』『Asia』
『南極』找得到那一洲」——洲名是這一層唯一的檢索入口。**洲名那一層（attach）不另外
算成本**：它的名稱讀自同一份 geojson，共用 `resolveLayerData` 的快取。

（`tw-territory.geojson` 4 KB 與 `tw-ranges.geojson` 3 KB 不列在表上：那兩層 `defaultOn`，
進站時就付過了，不是聚焦搜尋框才新增的成本。）

一個班 30 個學生同時開站時，這 2.68 MB 不該是每個人無條件付的成本。資料一律走 `resolveLayerData()`，與圖層顯示**以及 `TownshipCard`** 共用同一份快取，不會抓兩次——鄉鎮共用卡要的那五份（鄉鎮界、人口、三份作物）全都已經在這張表上。

⚠️ **颱風的 757 個中心定位點（117 KB）不在這張表上**，但**理由不是「attach 不會被
索引」——`buildSearchIndex()` 是會走 `layer.attach` 的**（主峰與縣市政府就靠它才搜得到）。
真正的規則是「**附屬圖層沒有宣告 `browse` 就不索引**」，跟一般圖層同一條。

⚠️ 這件事實測踩過：`searchIndex.ts` 原本無條件 `resolveLayerData(layer.attach.source)`，
於是聚焦搜尋框就多抓那 118 KB——而定位點**沒有 `name`**，抓下來連一筆搜尋結果都產
不出來（`featureHits()` 會把沒有 name 的圖徵跳過）。只看搜尋結果是抓不到這個浪費的，
要看 `performance.getEntriesByType('resource')`。

⚠️ **古蹟那三份（483 KB）是子項目圖層唯一會進索引的例子，而且必須明確開啟。**
`items` 圖層預設**只索引子項目本身**（三筆「國定古蹟／直轄市定古蹟／縣(市)定古蹟」），
要展開成圖徵得在 `items.indexFeatures` 明講。這不是可有可無的開關：特有種的子項目
source 是**觀測點** geojson（五份共 262 KB，properties 只有日期與紀錄類型、**沒有名字**），
預設展開等於讓每個學生白付那 262 KB 卻一筆結果也搜不到。古蹟相反——1,064 個圖徵全部
有名字，而 `items` 圖層又**沒有可點清單**（`ThemeMapPage` 的 `!l.items`），
**搜尋是這一層唯一的檢索入口**。

⚠️ **這張表上的數字要跟著 `public/data/` 一起維護**，不要照抄舊版：合併兩條分支時發現兩邊各自記的清單都已經過期（其中一邊還把 `tw-counties` 寫成 35 KB，實際是 192 KB）。要重新量就跑
`for f in public/data/geo/*.geojson; do echo "$(basename $f) $(( $(wc -c < $f) / 1024 ))KB"; done`。

⚠️ 實測時 `performance.getEntriesByType('resource')` 會列出**十份**而不是九份：多出來的 `tw-ranges.geojson`(3 KB) 是「五大山脈」`defaultOn` 在**進站時**就抓的，不是搜尋索引的成本（它確實也在索引裡，只是那筆已經付過了）。上表只列聚焦搜尋框才新增的九份。

**保護區那 182 KB 與流域那 219 KB 是值得的**：兩層的圖徵全部有名字，而「玉山國家公園」「大武山自然保留區」「濁水溪流域」正是學生會直接打進搜尋框的字串——這跟 `quakes` 那 402 KB／2831 筆**沒有名稱**的點是相反的案例（所以 `quakes` 沒有 `browse`，不進索引）。

### 選了一筆結果之後（`ThemeMapPage` 的 `pendingHit` 狀態機）

不能同步飛過去：圖層可能還沒勾選、資料可能還沒抓回來，甚至可能要先換主題。所以只記下 `pendingHit`，由一個 effect 分批消化——每一輪只做當下做得到的事，做不到就 return，等 `instances` 變了再來。三個容易踩的點：

- **`enableLayer()` 要自己守 `MAX_ACTIVE_BY_KIND`。** 平常那個上限是靠 `LayerPanel` 把核取方塊 disable 掉來落實的，搜尋自動勾選繞過那個 UI。超過就踢掉同幾何、`Set` 迭代順序最前面（最早勾）的那一個。
- **跨主題時要抑制換主題 effect 的 `flyTo`**（用 `pendingHitRef`，不是 state——導覽發生在 setState 生效之前），否則會先飛到主題預設相機再飛第二次。但**詳情卡一定要清成 `null`**：目標若是 `detail.type === "none"` 的圖層（緯度參考線），pendingHit effect 永遠不會 `setSelected`，上一個主題的詳情卡就會留在畫面上（實測踩過）。
- **`detail.type === "none"` 只飛不開卡**；圖層本身的結果只勾選 + `fitBounds`，也不開卡。一張沒有內容的詳情卡什麼都沒教到。
- 抓資料失敗時 instance 的 `data` 永遠是 null、effect 不會再被觸發，所以 `pendingHit` 有一條 8 秒死線，否則它會一直卡著並讓下一次換主題誤判。

### ⚠️ 搜尋命中「只顯示這一筆」：站上第二條逐圖徵通道

**兩種呈現方式都是常設的，由使用者自己選，不要哪天挑一個刪掉。** 開關在右上 ⋮⋮⋮
選單，存在 `localStorage` 的 `gaia-solo-search`（第三個鍵，前兩個是 `gaia-theme` 與
`gaia-layer-drawer`），**預設是 `"all"`＝一路以來的行為**（換預設等於在沒有說明的情況
下改變所有既有使用者的畫面）。

⚠️ **這件事刻意不做成「站方替使用者決定」**，理由是適合哪一種跟**圖層密度**有關、
不是全站二選一：搜一個颱風、一條斷層、一個古蹟時「只顯示這一筆」才看得清楚；但重大
地震與水庫這種密度型圖層，鄰居本身就是教學內容（地震帶沿板塊邊緣排列），藏掉等於把
重點弄丟。所以**不要**改成依圖層自動切換或加一個逐圖層的強制旗標——那會把使用者已經
選好的偏好偷偷推翻。這也是 `ThemeBrowse` 那次 `?browse=drawer|panel` 的**反例**：那次
兩版是同一件事的兩種擺法，本來就該選一個；這次兩版回答的是不同場合的需求。

站上原本**只有一條**逐圖徵通道：`geo.ts` 的 `whenSelected()`，那是 **paint**
（全部照畫、只把命中的加粗，顏色不准動）。這次新增的是 **filter**：
`applySoloFilter()` 對 `geoLayerIds()` 回傳的每一個圖層下
`["in", ["get","id"], ["literal", ids]]`。⚠️ **它至今仍是全站唯一寫 `map.setFilter`
的地方**——子項目的切分刻意改在 `resolve.ts` 切資料而不是再下一道 filter，就是為了
不跟這個功能糾纏（見交通軸線那節的 `LayerItem.featureIds`）。

- ⚠️ **不 solo 時一定要主動 `setFilter(id, null)`。** `addGeoLayer` 是 upsert（既有圖層
  走 `setPaintProperty`，從不重建），少了這一手，解除之後圖層會永遠停在上一次的過濾
  狀態。呼叫點**只有一個**（`addGeoLayer` 包在 `addGeoLayerShapes` 外面），三個幾何
  分支各自 early-return，在分支裡各補一次將來一定會漏。
- **允許的 id 直接重用 `highlightIds`**，附屬關係就自動成立（實測：搜「秀姑巒山」
  也會把母圖層濾成中央山脈一條）。
- **爆炸半徑只有命中的那一層 + 它的附屬圖層**，其他勾選中的圖層完全不動。
  ⚠️ 因此**鄉鎮／人口／作物那三層雖然共用 `TOWNCODE`，卻只有命中的那一層被濾**
  ——實測搜「鹿谷鄉」時鄉鎮面剩 1（隱藏 367），而人口圓點仍然是 137 個。
  這是刻意的，不是漏掉。
- **三個 no-op**：高程分帶（沒有 geojson 可濾）、`kind: "layer"` 的結果（本來就是
  「打開整層」）、`detail.type === "none"`（不開卡片，而聚焦的生命週期綁在 `selected`
  上，設了會被立刻清掉而閃一下）。
- ⚠️ **解除只有一條規則**（`selected` 換人或圖層被取消勾選就解除），**外加
  `handleSelectHit` 裡的一次 `setSolo(null)`**。後者不能省：**圖層本身**的搜尋結果
  與高程分帶都會在設定 `selected` 之前就 return，`selected` 原封不動，於是上一次
  聚焦的圖層會繼續只畫一筆——使用者明明要求看整層。實測踩過。
- ⚠️ **Escape 階梯沒有多一段**：第一段關詳情時聚焦一起解除（同一個狀態轉換）。
- **抽屜的可點清單刻意不過濾**（資料沒動，只有算繪被過濾），所以清單仍然列出全部
  14 個颱風——那是第二條逃生路徑，也是換看另一個颱風的正常操作。⚠️ 不要順手把清單
  也濾掉：濾了之後「只顯示這一筆」就變成一個**出不來的模式**，只剩取消勾選圖層一條路。
- **畫面上一定要有 chip**（`.map-solo-chip`，排在圖例上方）：少掉十幾條線而畫面沒有
  任何說明，是這個功能唯一真正的風險。它寫的是「只顯示：韋恩（已隱藏同層 13 筆）」
  加一顆「顯示全部」。放左下角是因為 `.map-bottom-left` 本來就會閃避面板，而且抽屜
  開著時被 `visibility: hidden` 收起來的是 `.map-top-left`、不是這一欄。

實測（1920×929、`jumpTo([130,22], 3.2)`，「只顯示這一筆」）：颱風 `tw-typhoons-line` 14 → **1**、
`tw-typhoon-centers-points` 757 → **85**（含 `-label` 三層都帶同一個 filter）；
五大山脈 5 → **1**、主峰 5 → **1**；縣市界 `-fill`／`-outline`／縣市政府 22 → **1／1／1**。
切底圖（含向量的 liberty）之後**過濾必須存活**（靠 `soloFiltersRef`，實測仍是 1／85）。

⚠️ 驗這一層有兩個會給出**假結果**的陷阱：**背景分頁**下 geojson source 的
`isSourceLoaded()` 永遠是 false、`queryRenderedFeatures` 一律回 0（看起來像圖層壞了）；
以及長線與 MultiPolygon 會**跨圖磚重複**，一定要數**不重複的 id**。

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
- **維基百科可以當來源，但它是次級來源**：適合查山脈走向、主峰高度這類已有共識的基本地理事實；凡是數值型的權威資料（氣候正常值、人口統計、保育等級）一律仍以主管機關的原始資料為準。並列時官方來源寫在維基百科後面（`["維基百科 板塊構造論", "內政部國土測繪中心"]`），讀者才看得出哪一筆追得到原始出處
- **⚠️ `sources` 的每一筆都要連得到「那份資料本身」，不是機構首頁**，而且**標籤要指名那份資料**。這條規則在 2026-08 掃過整個世界地理主題（51 個標籤）之後才寫死，因為抽查出三種都會讓人追不到出處的寫法：
  - **泛稱的機構名 + 首頁**：`Natural Earth` → 首頁。但世界主題有五個圖層用它、吃的是五份不同的資料集，所以拆成 `Natural Earth 1:10m 地理線`／`1:50m 河流與湖泊中心線`／`1:50m 國界`／`1:10m 自然地理區`／`1:10m 城市聚落`，各自連到那份資料的下載頁；`USGS` 同理拆成「地震目錄」與「夏威夷火山觀測站」（同一個機關、兩份完全不同的東西）
  - **泛稱到根本沒有連結**：`維基百科` 這個標籤**不在 `sourceLinks.ts` 裡**（那是刻意的），所以火山帶與洋流兩層的卡片上它一直是**沒有連結的純文字**。維基百科一律寫成 `維基百科 <條目名>`
  - **抄隔壁圖層填的來源**：`world-agriculture`（planned）掛著 `Natural Earth`，但 NE 根本沒有農業資料。planned 的圖層也要填**做得出那一層的**真實資料集
  ⚠️ 新增來源時請照 `sourceLinks.ts` 既有的做法，在 key 旁邊寫一行「為什麼連這一頁而不是首頁」
- `facts` 控制在 4 筆左右，每筆一行講完；長篇說明放課文
- 比較用的地點，`facts` 裡建議放一筆「對照重點」，明講這組配對要讓學生看見什麼

#### ⚠️ `koppen` 不可以拿 ERA5 自己算

很自然會想到「反正 `public/data/climate/` 就有月均溫與月雨量，直接套柯本公式算一遍最一致」。**實測會算錯，而且錯的方向很固定**：ERA5 是 25 km 網格，冬季雨量被大幅平滑，於是「冬乾」判不出來——嘉南平原、臺中盆地、八卦台地、埔里盆地、桶盤嶼算出來全變成 `Cf*`，而中央氣象署的分區是 `Cwa`（西部 苗栗以南至嘉南平原的平原地帶＋澎湖群島）。同理 `Aw` 會被算成 `Am`／`Cwa`（屏東平原、田寮月世界、鵝鑾鼻），因為最冷月均溫被拉低到 18 °C 以下。

所以 `koppen` 一律照**中央氣象署的臺灣氣候分區**填：北部與東北部平原丘陵 `Cfa`、苗栗以南至嘉南平原的平原地帶與澎湖 `Cwa`、高雄屏東平原 `Aw`、東部全年有雨 `Cfa`、高山依海拔 `Cfb`／`ET`。ERA5 只拿來當**方向性的**交叉檢查，不當判準。

唯一由 ERA5 定案的是大屯火山群（七星山，1,120 m）：它正好卡在 `Cfa`／`Cfb` 的最暖月 22 °C 門檻上（ERA5 21.6 °C，由鞍部測站 825 m 依環境減率外推約 22.1 °C），兩邊都在誤差內，因此取站上自己那份資料看得到的值 `Cfb`。**這是刻意的，不是漏改。**

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
npm run dev             # http://localhost:5173（**開發者專用**，代理人不要動）
npm run dev:agent       # http://localhost:5199（代理人專用，--strictPort 不會偷跳埠）
npm run typecheck       # tsc --noEmit
npm run validate        # zod 驗證內容 + 圖層註冊表交叉檢查
npm run test:order      # 圖層堆疊順序的回歸測試（不需瀏覽器）
npm run build           # validate → test:order → typecheck → vite build → postbuild
npm run build:debug     # 帶地圖除錯掛勾的 production build（驗證用，見下）
npm run preview         # 預覽 production build（4173）。⚠️ 代理人驗證一律用這台，
                        #   5173／5174 是開發者自己的 dev server，不要動（見「驗證方式」）
npm run build:climate   # 產生氣候 JSON（已存在會跳過）
npm run build:climate -- --force   # 全部重抓
npm run build:species   # 產生特有種觀測點 geojson（已存在會跳過）
npm run build:species -- --force   # 全部重抓
npm run build:reservoirs # 產生水庫即時水情（每次都重抓，CI 也會跑，見「部署」）
npm run build:geodata   # 產生行政區/河流/地震/水庫 geojson（已存在會跳過）
npm run build:geodata -- --force --only=quakes   # 只重抓一個資料集
npm run build:geodata -- --force --only=tw-protected-areas   # 國家公園與保護區（約 2 分鐘）
npm run build:geodata -- --force --only=tw-townships          # 368 個鄉鎮市區（下載 12.8 MB）
npm run build:geodata -- --force --only=tw-rivers             # 118 個列管水系，⚠️ 約 40 分鐘
                                       # （每條河一次 Overpass 查詢，且會撞到限流而退避重試，
                                       #   這是正常的，不要以為卡住了。跑背景並看日誌的長度對照）
npm run build:geodata -- --force --only=tw-crops-fruit        # 作物三種要各跑一次（需先有鄉鎮界）
npm run build:geodata -- --force --only=tw-population         # 368 個鄉鎮的人口（同樣需先有鄉鎮界）
npm run build:geodata -- --force --only=tw-faults             # 33 條活動斷層
npm run build:geodata -- --force --only=tw-quakes             # 臺灣周邊 M≥5.5（612 筆）
npm run build:geodata -- --force --only=tw-quakes-major       # 災害性地震（自己查 USGS，不依賴 tw-quakes）
npm run build:geodata -- --force --only=tw-typhoons           # 14 個侵臺颱風的官方最佳路徑
npm run build:geodata -- --force --only=tw-typhoon-centers    # 同一份資料的 757 個中心定位點
npm run build:geodata -- --force --only=date-line            # 國際換日線（Natural Earth）
npm run build:geodata -- --force --only=plates               # 52 塊板塊（含球面面積）
npm run build:geodata -- --force --only=plate-boundaries    # 三種板塊邊界（下載 10 MB 的 step 檔）
npm run build:geodata -- --force --only=volcanoes            # 1,214 座全新世活火山（GVP）
npm run build:geodata -- --force --only=world-continents     # 七大洲（Natural Earth 國界 → 依洲別聯集）
npm run build:geodata -- --force --only=world-mountains      # 39 條山脈（範圍面 → 中軸線）
npm run build:geodata -- --force --only=world-mountain-peaks # 同一份下載的 39 座最高峰
npm run build:geodata -- --force --only=koppen-zones-c       # 柯本五大類要各跑一次（a／b／c／d／e）
                                       # （一個 process 裡共用同一份下載，見 lib/koppen.mjs）
npm run build:geodata -- --force --only=biomes-desert        # 生物群系六類要各跑一次
                                       # （tropical-forest／savanna／temperate-forest／boreal／tundra 同理；
                                       #   ⚠️ 六個不要連著跑，上游會回一個指著參數的假 400，見下）
npm run build:geodata -- --force --only=tw-eez              # 臺、日、菲的經濟海域＋釣魚臺爭議海域
                                       # （下載 17 MB，裁切到臺灣周邊後產物 103 KB）
npm run build:geodata -- --force --only=tw-monuments-national   # 古蹟三級要各跑一次
                                       # （municipal／county 同理；歷史沿革分片會一起寫出）
```

`build:climate` 對 Open-Meteo、`build:species` 對 GBIF、`build:geodata` 對 Natural Earth 與 USGS 都有指數退避重試（429/5xx 時等 5s/10s/20s…），連抓多筆被限流是正常的，重跑一次即可補齊。

`build:geodata` 有**大小預算**：單一圖層超過 1 MB 直接 `exit 1`（不是印警告），超過 500 KB 印提醒。真正的限制不是 GitHub Pages，是一個班 30 個學生同時用學校 wifi 開站。

---

## 驗證方式

### ⚠️ 自己起伺服器，用 5199 或 4173，不要碰 5173

要驗證就**自己跑 npm 指令起一台自己的伺服器**，而且分兩段：

```bash
npm run dev:agent                          # 5199，改一行看一次用這台（HMR，免重建）
npm run build:debug && npm run preview     # 4173，收尾／出貨前的最終驗證用這台
```

**迭代期用 `dev:agent`（5199）。** 除錯掛勾在 dev 模式**本來就是開的**——
`MAP_DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG_MAPS === "1"`，
第一個運算元在 dev 是 true，所以 `window.__gaiaMaps` 與 `preserveDrawingBuffer`
（canvas `readPixels` 讀像素量色差要靠它）在 dev 一樣可用。調顏色、數圖徵、數沿線
標註、測點擊這些都不必等重新建置。`--strictPort` 是刻意加的：沒有它，埠被佔用時
vite 會**安靜地跳到下一個埠**，而下一個埠可能是別人的。

**收尾一定要再用 `build:debug` + `preview`（4173）跑一次。** dev 走的是原始 ESM，
驗不到只有打包後才出現的那一類問題——maplibre 的 worker 檔案沒被複製進 `dist/`
（檢查清單第 7 項，切到向量底圖會整片空白而且零錯誤訊息），以及 chunk 切分相關的
問題。**只在 dev 驗過就出貨等於沒驗過那一類。**

⚠️ **`5173`（`npm run dev` 的預設埠）是開發者自己開著的，絕對不要動它**——不要接管、
不要重啟，更不要 `pkill -f vite` 或任何會把它一起殺掉的收尾動作。驗證完只收掉自己
那台（用 `run_in_background` 起的就停自己那個工作，或用 `lsof -ti :5199`／`:4173`
這種**指名埠號**的方式，不要用會掃到別人程序的 pattern）。
踩過一次：驗完隨手 `pkill -f vite`，把開發者正在用的 dev server 一起關掉了。

⚠️ `npm run dev`（不帶 `--strictPort`）在 5173 被佔用時會自動跳 5174——那台**也可能
是別人的**，看到不是自己起的埠一律不要碰。這正是 `dev:agent` 要固定 5199 的理由。

### ⚠️ 用瀏覽器自動化驗證時，分頁一定要在前景

maplibre 的 `Style.loadJSON()` 會先 `await` 一個 `requestAnimationFrame` 才真正套用樣式。**背景分頁不會觸發 rAF**，所以在沒有被選取的分頁裡開站，會停在：`map.style.stylesheet` 是 undefined、`load` 事件永遠不觸發（`window.__gaiaMaps` 因此是空的）、一張圖磚都不抓、畫面全白，而且**完全沒有任何 console 錯誤或失敗的網路請求**——症狀跟「worker 檔案沒被複製」幾乎一模一樣，很容易誤判成程式壞了。

先確認 `document.visibilityState === 'visible'`（背景分頁下所有地圖驗證都不算數），需要時用
`osascript -e 'tell application "Google Chrome" to set active tab index of window 1 to N'` 把分頁切到前景再等幾秒。
同理，在背景載入、之後才切到前景的分頁，相機狀態可能跟網址參數對不上（`_constrain` 會在尺寸還沒定案時調整 zoom／緯度），要重新整理後再驗一次比較頁的 URL 還原。

**「前景」不等於「這個分頁是視窗裡被選中的那一個」。** `document.visibilityState` 走的是
系統層級的可見性：分頁被選中、Chrome 是最前景的應用程式，但**視窗在一個已休眠或被遮住的
螢幕上**時，它照樣是 `hidden`——而 `setInterval` 不會被節流（背景分頁會被節流到 1 秒），
所以「計時器跑得好好的、頁面卻是 hidden」正是這個情況的指紋。實測踩過：視窗在第二台
螢幕上，`osascript … activate` 回報成功、`active tab index` 也對、截圖甚至照得到畫面，
但地圖永遠停在空白、`window.__gaiaMaps` 是 undefined，看起來完全像程式壞了。
先用 `tell application "Google Chrome" to get bounds of window 1` 確認視窗在哪台螢幕上。

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
   - ⚠️ **點預設組合與換下拉選單之後，`a`／`b` 必須真的出現在網址上**，而且下面的地點選單、hint、氣候圖表要跟著換成新的那一組。這裡踩過一次：`jumpTo` 會同步觸發 `handleCamera` 寫網址，它拿到的 `prev` 是**還沒有 a/b 的快照**，所以「先寫網址再飛」會把 a/b 洗掉——兩張地圖飛對了位置，但下面的圖表還是舊的那一組，圖表與地圖對不起來。修法是**先飛、網址最後寫**（見 `ComparePage` 的 `applyPreset`／`selectPlace`）
4. 兩側氣候圖表的 Y 軸範圍相同
5. DevTools Network：**不得有任何帶 API key 的請求**；圖磚全部回 200
6. Console 無 CORS、WebGL 或 maplibre 錯誤
7. **切到每一種向量底圖（目前是「世界地圖」）並確認地物真的渲染出來**，不能只看 `npm run build` 成功。這一項只在 production build 才驗得出來——`npm run dev` 用的是原始 ESM，不會踩到 worker 檔案沒被複製的問題，`npm run preview` 或實際部署才會踩到
8. 主題頁（滿版版面）：
   - 搜尋藥丸左邊的 ☰ 開圖層抽屜 → 核取方塊可任意複選疊加；`planned` 的是停用狀態但仍有說明文字
   - 抽屜關著時點地圖圖徵 → **搜尋框下方的詳情面板**開卡（`top` 是 `60px`，＝`--search-h`）
   - **抽屜開著時點抽屜清單裡的一列 → 抽屜留在原地，詳情整片疊在它上面**：
     ```js
     const shell = document.querySelector('.map-shell');
     const css = (s, p) => getComputedStyle(document.querySelector(s))[p];
     shell.dataset.drawerOpen === 'true' && shell.dataset.detailOpen === 'true'  // 兩個都開
     css('.map-detail-panel', 'top')      // '0px'（抽屜開著時從頂端起算，不留 --search-h）
     +css('.map-detail-panel', 'zIndex') > +css('.layer-drawer', 'zIndex')       // 20 > 15
     ```
     關掉詳情（✕ 或 Escape）→ 抽屜與剛才展開的那一層**原封不動**（連捲動位置都在），選取中那一列是 `.place-btn.is-active`
   - `localStorage.removeItem('gaia-layer-drawer')` 後重整 → 抽屜是**收起的**，搜尋框與詳情卡直接可見
   - 手動開抽屜 → 重新整理後仍是開的；模擬封鎖 localStorage 不得拋錯
   - ⚠️ 窄螢幕（≤860px）**抽屜開著時詳情仍然是底部抽拉卡**，不能被打回 `top: 0`：
     ```js
     css('.map-detail-panel', 'height')   // = 62dvh；rect.top + rect.height === innerHeight
     ```
   - 搜尋（見下面第 12 項）
   - 勾選縣市界／世界主要河流後，可點清單長在圖層抽屜裡該圖層那一列底下：
     ```js
     document.querySelectorAll('.layer-drawer .place-list').length      // > 0
     document.querySelectorAll('.map-detail-panel .place-list').length  // 0（詳情面板不放清單）
     ```
   - 鍵盤：Tab 到 ☰ → Enter 開啟 → Escape 關閉且焦點回到 ☰；⋮⋮⋮ 同理；⋮⋮⋮ 開著時點「圖層」磚會關掉 ⋮⋮⋮ 但**不會**關掉抽屜
     （⚠️ `MapView` 是第一個子節點，所以 Tab 會先走過 canvas 與 maplibre 自己的縮放鈕才輪到 ☰）
   - **Escape 是三段式的，而且要連著按到底**（見「全站唯一掛在 document 上的 Escape」）。
     勾幾個圖層、點清單一列開詳情之後，焦點停在那顆按鈕上（最常見的位置），然後連按：
     ```js
     const m = window.__gaiaMaps.at(-1), shell = document.querySelector('.map-shell');
     const themeLayers = () => m.getStyle().layers.map(l => l.id)
       .filter(id => /^tw-|^places-|^indigenous-|^species-|^quakes/.test(id));
     // Esc #1 → detailOpen false、drawerOpen 仍 true、themeLayers() 不變
     // Esc #2 → drawerOpen false、themeLayers() 仍不變、localStorage 為 'closed'
     // Esc #3 → themeLayers() 是 []、.map-legend 消失，但 contour-lines 與 hillshade 仍在
     // Esc #4 → 完全的 no-op（圖層數與 __gaiaMaps.length 都不變）
     ```
     清完之後重開抽屜：核取方塊要**全部**是未勾的；把有子項目的圖層（古蹟）再勾回來時，
     三個級別的子項目也必須是未勾的——那是 `activeItemIds` 真的被清掉、而不只是被隱藏的唯一證據
   - **Escape 不越級**，四種情況都要驗：
     - 焦點在 `BODY`／canvas 上（點完地圖圖徵的位置）→ Escape 一樣關得掉詳情。**這是加 document 監聽的唯一理由，一定要驗**
     - 焦點在搜尋輸入框、建議清單開著 → Escape 只收清單，`shell.dataset.detailOpen` **不變**
     - ⋮⋮⋮ 開著 → Escape 只關選單，`shell.dataset.detailOpen` **不變**
     - 左下「圖層」磚的彈出層開著 → Escape 只關彈出層，**已勾選的圖層一個都不能掉**
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
11. `window.__gaiaMaps.length` 不變（證明沒有 remount 重建地圖）：用**右上角 ⋮⋮⋮ 選單**走完兩個主題與 `/compare` 再回來（主題頁應為 1、`/compare` 為 2），以及開關抽屜／詳情面板／兩個彈出層各五次、跨主題搜尋數次之後。
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
    - Network 只多抓 `tw-counties.geojson`、`world-rivers.geojson` 與水庫那兩份，**沒有 `quakes.geojson`**：
      ```js
      performance.getEntriesByType('resource').filter(r => /geojson/.test(r.name)).map(r => r.name.split('/').pop())
      ```
    - 鍵盤：打字 → ↓↑ 移動 `.search-hit.is-active` → Enter 選取；Escape 第一次關清單、第二次清空輸入框
13. **選取中的圖徵要在同色的一堆裡認得出來**（見「選取中的圖徵怎麼強調」）。看的是 paint 表達式，不是只看卡片有沒有開：
    ```js
    m.getPaintProperty('indigenous-points', 'circle-radius')
    // 選了阿美族 → ["case",["==",["get","id"],"amis"],["*",7,2],7]
    // 改選泰雅族 → 同一條式子換成 "atayal"（舊的自動變回一般大小）
    // 關掉詳情面板 → 回到單純的 7，沒有 case
    ```
    三種幾何各驗一次（`indigenous-points` 點／`tw-ranges-line` 線／`tw-counties-fill` 面），**而且切底圖之後要再驗一次**——`setStyle` 會清光圖層，強調是靠 `highlightIdsRef` 在 `reapply` 時重建的。
    山脈 ↔ 主峰的連動強調是**雙向**的，清單一定是**兩筆**，兩個圖層的表達式都要帶到：
    ```js
    // 選玉山山脈（父）或玉山主峰（子）都一樣
    m.getPaintProperty('tw-ranges-line','line-width')          // …["literal",["yushan-range","yushan"]]…
    m.getPaintProperty('tw-range-peaks-points','circle-radius') // 同一份清單
    ```
    ⚠️ 早期版本刻意只做單向（選山脈才連主峰），**現在兩個方向都要成立**——「選子類視同也選父類」是明確的需求，不是可有可無。點主峰開的是主峰自己的 `PlaceCard`（有海拔與氣候圖表），不是山脈的卡片。
14. **附屬圖層（五大山脈 → 主峰）**：
    ```js
    // 五大山脈沒勾時，主峰圖層不存在；勾了就一起出現（沒有自己的核取方塊）
    !!m.getLayer('tw-range-peaks-points')
    // 主峰身上要有 join 出來的 rangeId
    m.queryRenderedFeatures({layers:['tw-range-peaks-points']}).map(f=>f.properties.name+'@'+f.properties.rangeId)
    // 五座主峰**只能出現在主峰圖層**：勾了「地形景點」也不會在同一個座標上再長一顆
    m.queryRenderedFeatures({layers:['places-points']})
      .filter(f=>/玉山主峰|雪山|秀姑巒山|大塔山|新港山/.test(f.properties.name))  // []
    // tw-ranges.geojson 只能被抓一次（三個用途共用 resolveLayerData 的快取：
    // 山脈線本身、tw-range-peaks 的 join、places-taiwan 排除主峰）
    performance.getEntriesByType('resource').filter(r=>/tw-ranges/.test(r.name)).length  // 1
    ```
    抽屜清單要有 5 組巢狀（`.place-list-children`），各含 1 座主峰；搜「雪山」要同時搜得到「雪山（五大山脈・主峰）」與「雪山山脈」，選前者會開主峰卡並把山脈一起加粗。

    縣市界 → 縣市政府同理：勾縣市界會一起出現 22 個政府點（`tw-county-halls-points`），抽屜有 22 組巢狀，搜「縣政府」找得到，點任一個都要讓**所屬縣市的面一起變深**——只看卡片開了不算數，要看 `m.getPaintProperty('tw-counties-fill','fill-opacity')` 的清單裡有兩筆。

    ⚠️ **臺灣主題進站的三件事要一起看：`camera`、`initialSelection`、`defaultOn`。** 現在是全島視角（埔里地理中心碑、zoom 7）＋「臺灣本島（地理中心碑）」的詳情卡，所以 `tw-territory` 必須 `defaultOn`；五大山脈維持 `defaultOn`（zoom 7 正好是它標註驗證過的尺度）。改任何一個都要同時檢查另外兩個，否則第一眼會變成「詳情卡在講一個地圖上沒有的東西」——早期版本開在玉山 zoom 12 + 玉山主峰的卡片，就是靠這條規則綁在一起的。

    ⚠️ **zoom 7 看不到等高線**（`CONTOUR_MIN_ZOOM` 是 9），這是換開場時知道並接受的取捨：這個主題現在的開場是「臺灣有多大、範圍到哪裡」，等高線在使用者放大後才出現。要改回以地形為開場，上面那三件事要一起換回去。

    ⚠️ **`src/content/places/taipei.json` 不可以刪，`id` 也不可以改。** 它同時被 `/compare` 的預設組合使用（`presets.ts` 用 `a: "taipei"` 參照），刪掉或改 id 會讓比較頁那一組壞掉。改動 `src/content/places/` 之後要順手開 `/compare` 點一次那個組合確認（下拉選單要顯示「臺北盆地（25.0°N）」與「開羅（30.0°N）」、四張圖表都在）。

    ⚠️ 這一筆的 `name.zh` 是**臺北盆地**不是「臺北」——那是刻意的，用來跟行政區圖層的「臺北市」分開（搜「盆地」現在會乾淨地列出埔里／臺中／臺北三個盆地）。**改名時 `presets.ts` 的 `label` 要一起改**，否則按鈕寫「臺北」、底下下拉選單卻是「臺北盆地」。

    ⚠️ **`src/content/places/` 新增一筆地點，就會同時改動三個地方**：地形景點圖層、`/compare` 的兩個下拉選單、主題頁搜尋索引。所以新增後 `npm run build:climate` 是必須的——`/compare` 選到一個沒有氣候 JSON 的地點會得到空圖表，而 `npm run validate` **不會**擋（climate 驗證只檢查「有 JSON 的必須對得到地點」，反向不檢查）。

> **第 15–27 項是臺灣主題各圖層的驗證，搬到 `CLAUDE_TW.md` 了**（水庫、保護區、
> 交通軸線、河川、流域、古蹟、鄉鎮界、作物、人口、三層共用卡、植被帶、斷層與地震、
> 颱風）。編號沒有重排，所以下面直接從第 28 項接下去。

28. **世界底圖的地名語系**（`/theme/world`，底圖維持「世界地圖」，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [10, 25], zoom: 2.6 });
    // 每個「用地名當文字」的 symbol 圖層都要被改寫，ref 與門牌不可以被動到
    const sym = m.getStyle().layers.filter(l => l.type === 'symbol');
    sym.filter(l => !(Array.isArray(l.layout?.['text-field']) && l.layout['text-field'][0] === 'let'))
       .map(l => l.id + '=' + JSON.stringify(l.layout?.['text-field']))
    // 期望只剩公路盾牌（["to-string",["get","ref"]]）、單向箭頭與本站的 contour-labels
    ```
    - ⚠️ **這一項只能用眼睛驗，`queryRenderedFeatures` 是看不出來的**——它回的是圖徵的
      原始 properties，不是算繪出來的字串。截圖看歐洲與北非那一帶：德國、法國、義大利、
      西班牙、土耳其、埃及、沙烏地阿拉伯全部要是**完整的**繁體中文
    - ⚠️ **回歸判準是「最後一個字有沒有被吃掉」**（`index-of` 參數順序寫反的症狀，
      見上）。德國變「德」、埃及變「埃」時 console 一個字都不會印
    - **多值名稱要只剩第一段**：阿拉伯聯合大公國不可以畫成「阿拉伯聯合大公國;阿拉伯聯合酋長國」
    - **`ZH_HANT_OVERRIDES` 要生效**：同一個視角要看得到剛果民主共和國、中非共和國、
      迦納、幾內亞、幾內亞灣、瓜地馬拉、吉爾吉斯、奧地利（而不是刚果民主共和国、加纳、
      几内亚湾、危地馬拉……）
    - **備援底圖也要localize**：把 `BASEMAP_STYLES.liberty` 暫時改成一個會 404 的網址、
      重載，`m.getStyle().sources` 應該有 `carto`，而地名一樣是繁體中文。驗完記得改回來
    - **切到 NLSC 再切回世界地圖**，改寫必須還在（`setStyle` 會清光樣式）
    - ⚠️ **一定要在 production build 驗一次**（`npm run build:debug` + `npm run preview`）：
      這一項動到的是**向量底圖**的載入路徑，正好是檢查清單第 7 項那個「worker 檔案沒被
      複製就整片空白、而且零錯誤訊息」的地方

29. **國際換日線**（`/theme/world` → 參考線，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [-175, 15], zoom: 2.6 });
    m.queryRenderedFeatures({ layers: ['date-line-line'] }).length          // 5（一段一筆）
    m.queryRenderedFeatures({ layers: ['date-line-label'] }).length         // 2
    m.getPaintProperty('date-line-line', 'line-dasharray')                  // [3,3]，跟緯度參考線同一組樣式
    ```
    - ⚠️ **形狀是這一層的全部**：那條線必須在吉里巴斯處往東凸到西經 150°、在薩摩亞附近往回折，
      不可以是一條直的 180° 經線。**只數圖徵是驗不到的**，一定要看畫面
    - ⚠️ **不可以出現一條橫貫整個地球的橫線**（某一段跨過 ±180 的症狀，建置期已擋，但改動
      `tolerance` 或上游改版後要再看一次）
    - 標註是**直排的正體字**（maplibre 對 CJK 的 line 放置會自動直排），不是側躺的
    - 圖例要有兩列（緯度參考線、國際換日線），色塊同色是刻意的——`reference` 是非分類的固定角色
    - 切底圖之後重驗存在、顏色、虛線與排序（在 `contour-lines` 之上、`contour-labels` 之下）
    - ⚠️ 搜「國際換日線」會勾起圖層但**相機不動**，那是 `kind: "layer"` 結果的既有行為（見上）

30. **板塊與板塊邊界**（`/theme/world` → 地體構造，兩層一起勾，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [-40, 10], zoom: 2.2 });
    new Set(m.queryRenderedFeatures({layers:['plates-fill']}).map(f=>f.properties.id)).size  // 23
    m.queryRenderedFeatures({ layers: ['plates-label'] }).length                              // 20
    ['divergent','convergent','transform'].map(k =>
      m.getPaintProperty(`plate-boundaries-${k}-line`, 'line-color'))
    // 期望 ["#c95c1c","#2f74c9","#159c6b"]，**不可以隨勾選順序改變**
    ```
    - ⚠️ **這一層的正確性只能用眼睛驗**：大西洋中脊必須是橘（張裂）與綠（錯動）交錯的
      階梯狀、祕魯－智利海溝與日本海溝必須是藍（聚合）。數字全對但顏色配錯是看得出來的
    - **顏色綁在邊界種類上，不是勾選順序**（回歸判準，比照古蹟三級與交通軸線）：
      先勾「錯動型」再勾「張裂型」，張裂仍然必須是橘色；圖例色塊要跟地圖一致
    - **勾母圖層時三種要自動全勾**（`items.defaultAll`）。⚠️ 但**只在還沒選過時才補**
      ——搜「錯動型邊界」只打開那一種之後，再去勾母圖層不會被打回全開，那是刻意的
    - **點板塊要開得了卡**（`fill-opacity` 是 0，但 maplibre 的 hit test 不看不透明度）：
      點菲律賓海板塊 → 標題「菲律賓海板塊」、副標「次要板塊・544 萬 km²」，
      **選取時整塊面要浮出 0.38 的暖褐**：
      ```js
      JSON.stringify(m.getPaintProperty('plates-fill','fill-opacity'))
      // ["case",["in",["get","id"],["literal",["plate-ps"]]],0.38,0]
      ```
    - 抽屜清單依分類分三組：`["主要板塊:8","次要板塊:14","微板塊:30"]`，組內依面積由大
      到小（開頭是太平洋板塊 1.05 億 km²）。⚠️ **主要是 8 塊不是 7 塊**，見上
    - **三種邊界各要開得了說明卡，而且兩條路徑開出同一張**（內容檔在
      `src/content/geo/plate-boundaries/`，三個 id 必須一致，見上）：
      ```js
      // ① 點抽屜裡的子項目名稱
      [...document.querySelectorAll('.layer-drawer .layer-row')]
        .find(r => r.textContent.startsWith('板塊邊界'))
        .querySelector('.species-name-btn').click();   // 「張裂型邊界」
      // ② 點地圖上的線（先用 queryRenderedFeatures 找一個只命中該層的像素再派事件）
      document.querySelector('.map-detail-panel').innerText.split('\n')[0]  // 兩者都是該種邊界的名字
      ```
      ⚠️ 卡片開了不算數，要看**內文**：退回 `FeatureCard` fallback 時標題一樣對，
      但內容會變成圖層說明（代表內容檔的 id 對不上）
    - 選取時該種邊界要加粗，而且**清單裡是不帶前綴的 id**：
      ```js
      JSON.stringify(m.getPaintProperty('plate-boundaries-divergent-line','line-width'))
      // ["case",["in",["get","id"],["literal",["divergent"]]],["*",1.6,2.2],1.6]
      ```
    - 搜「太平洋板塊」「Pacific」都要找得到；搜「錯動」要出現「錯動型邊界」子項目
    - **三種邊界都是虛線**，而且**跟「世界主要河流」一起打開時要分得出來**（見上，
      那是這一層畫虛線的唯一理由）：
      ```js
      m.getPaintProperty('plate-boundaries-convergent-line','line-dasharray')  // [4, 1.5]
      ```
      ⚠️ 用眼睛看喜馬拉雅一帶（`jumpTo([85, 28], 4)`）：藍色實線＋沿線河名是恆河與
      布拉馬普特拉河，藍色虛線是聚合型邊界。**兩條都畫成實線就是回歸**
    - 資料來源那一行**必須有三個連結**（Bird、Nordpil、維基百科）——ODC-BY 要求標示出處，
      少一個就違反授權
    - ⚠️ **不可以出現一條橫貫整個地球的橫線**（某一段跨過 ±180 的症狀，建置期已擋）
    - 切底圖之後重驗存在、顏色與排序（面 < 線 < 標註，全部在 `contour-lines` 之上、
      `contour-labels` 之下）

31. **火山帶**（`/theme/world` → 地體構造，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.getPaintProperty('volcanoes-points', 'circle-color')                       // "#c0259c"
    new Set(m.queryRenderedFeatures({layers:['volcanoes-points']}).map(f=>f.properties.id)).size
    // 主題預設視角（center [0,10]、zoom 1.8、1512×772）為 949
    ```
    - ⚠️ **這一層最重要的一項只能用眼睛驗，而且必須在「勾起來的第一眼」看**：不要先
      `jumpTo` 到環太平洋。主題預設視角的正中央是非洲與大西洋，全球地震帶就是在這個
      視角上「數得到 1,829 筆但畫面上什麼都看不到」的。要看得出安地斯、中美洲、印尼、
      日本、地中海與東非大裂谷各條火山帶
    - **跟「板塊邊界」「全球地震帶」疊起來**（`jumpTo([135,20], 3)`）：洋紅的火山點在
      島弧上、灰色震央偏海溝側、藍線沿海溝——三者分得開才算過。⚠️ 洋紅↔橘（張裂型）
      是這一層唯一的色彩風險，冰島與東非大裂谷那一帶要特別看
    - 點任一座火山要開得了卡，而且卡上**沒有圖層說明**（`hideLayerDescription`）：
      ```js
      // 富士山 → 標題「富士山」、副標「Fujisan・層狀火山・海拔 3,776 公尺」、
      //          下一行「最後噴發 1708 年・西北太平洋火山區」
      ```
    - 臺灣的兩座要在（`龜山島`、`大屯火山群`），中文名不可以退回英文
    - **搜「火山」找得到圖層本身，搜「富士山」是空的**——那是刻意的（沒有 `browse`
      就不進索引，見上）。⚠️ 順帶確認聚焦搜尋框**不會**抓 `volcanoes.geojson`
    - 切底圖之後重驗存在、顏色與排序（在 `contour-lines` 之上、`contour-labels` 之下，
      而且在板塊邊界的線之上）

32. **森林與沙漠帶**（`/theme/world` → 氣候與生物群系，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.getStyle().layers.map(l => l.id).filter(i => /^biomes-.*-fill$/.test(i)).length   // 6（defaultAll）
    ['tropical-forest','savanna','desert','temperate-forest','boreal','tundra']
      .map(k => m.getPaintProperty(`biomes-${k}-fill`, 'fill-color'))
    // 期望 ["#25744c","#989401","#b4410d","#369db8","#695ba9","#c754f4"]，**不隨勾選順序改變**
    m.getPaintProperty('biomes-desert-outline', 'line-opacity')                         // 0.15（補縫用，見上）
    ```
    - ⚠️ **這一層的成敗只能用眼睛驗**，而且要在**主題預設視角**（zoom 1.8）看：
      撒哈拉與阿拉伯要連成一條壓在北回歸線上的橘色帶、薩赫爾是橄欖綠、剛果與亞馬遜是
      深綠、歐亞中緯度是藍綠、加拿大與西伯利亞是靛紫、青藏高原與安地斯高地是洋紅
    - ⚠️ **檢查有沒有白縫**：`jumpTo([10,20], 3.6)` 看撒哈拉／薩赫爾交界。露出一條條
      白色細縫代表外框的補縫失效（`outlineOpacity` 或 `outlineWidth` 被改掉了）
    - ⚠️ 反過來也要看：全球視角下**不可以**出現一張細線網（那是外框太實，見上）
    - 點任一塊面要開得了卡（六類各有內容檔）：點撒哈拉 → 標題「沙漠與乾旱地」、
      副標「南北緯 30° 附近那兩條——副熱帶高壓底下不下雨」；**選取時整類一起加深**
      （`fill-opacity` 0.25 → 0.38，全球的沙漠同時變深才是對的）
    - 六類的核取方塊可以各自取消，取消後不會重抓（`resolveLayerData` 有快取）
    - 搜「沙漠」要出現「沙漠與乾旱地」子項目，選它只勾那一類（不是六類全開）
    - `maxzoom: 5`：`jumpTo` 到 zoom 5.5 整層應該消失，這是刻意的（見上）
    - 資料來源那一行**必須有兩個連結**（RESOLVE、Esri Living Atlas）——CC-BY 要求標示出處
    - 切底圖之後重驗存在、顏色、外框不透明度與排序（面在 `contour-lines` 之上、
      `contour-labels` 之下）

33. **柯本氣候分區**（`/theme/world` → 氣候與生物群系，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    ['a','b','c','d','e'].map(k => m.getPaintProperty(`koppen-zones-${k}-fill`, 'fill-color'))
    // 期望 ["#1d9dc8","#d8783d","#147811","#ba229e","#5e42fe"]，**不隨勾選順序改變**
    // 亞型數：A 4／B 4／C 9／D 11／E 2（合計 30，一個都不能少）
    ['a','b','c','d','e'].map(k =>
      new Set(m.queryRenderedFeatures({layers:[`koppen-zones-${k}-fill`]}).map(f=>f.properties.id)).size)
    ```
    - ⚠️ **這一層最快的正確性檢查是拿幾個城市對答案**（`queryRenderedFeatures` 在
      `m.project([lng,lat])` 上查）：臺北 `Cfa`、東京 `Cfa`、倫敦 `Cfb`、開羅 `BWh`、
      西伯利亞（100°E,62°N）`Dfc`。⚠️ **高雄會是 `Am` 而不是本站地點卡的 `Aw`**，
      那是 0.5° 網格的已知落差，不是壞掉（見上）
    - 點任一塊要開出**亞型**的卡：標題「Cfa 溫暖濕潤氣候」、副標「溫帶・全年有雨・
      最暖月 ≥22 °C」、下一行「代表地點：…」。⚠️ 卡上**不該有圖層說明**
      （`hideLayerDescription`）
    - **搜「Cfa」要找得到「C 溫帶氣候」**（靠 `items[].keywords`，這一層沒有開
      `indexFeatures`）。⚠️ 順帶確認聚焦搜尋框**不會**抓 `koppen-zones-*.geojson`
    - ⚠️ **不可以出現白縫**：這一層的相鄰類別邊界是逐位元相同的格線，看得到縫代表
      建置期的 `tolerance` 被改成大於 0 了（見上）
    - 南極要是一塊完整的冰帽（EF 加一圈 ET），**不可以變成橫貫地圖的一條帶**
    - 全球視角下五類的分布要對得上課本的柯本圖：撒哈拉／阿拉伯／澳洲內陸橙、
      亞馬遜／剛果／東南亞青、歐洲與美東綠、俄羅斯與加拿大紫紅、北極與南極藍紫
    - `maxzoom: 5`：超過就整層消失（0.5° 網格再放大只是一格一格的階梯）
    - 切底圖之後重驗存在、顏色與排序（在 `contour-lines` 之上、`contour-labels` 之下）

34. **行星風系**（`/theme/world` → 氣候與生物群系，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    const parts = ['pressure-belts','trades','westerlies','polar-easterlies'];
    parts.map(i => m.getPaintProperty(`wind-belts-${i}-line`, 'line-color'))  // 四個都是 "#5a6f96"
    m.getPaintProperty('wind-belts-pressure-belts-line', 'line-dasharray')    // [1,2.5]（只有氣壓帶是點線）
    // ⚠️ 標註數要在**縮到 zoom 1.2** 之後數，主題預設視角看不到極地東風（見上）
    m.jumpTo({ center: [0, 0], zoom: 1.2 });
    parts.map(i => m.queryRenderedFeatures({layers:[`wind-belts-${i}-label`]}).length)
    // 1512×772 實測 [16, 8, 7, 6]；預設視角（zoom 1.8）是 [6, 4, 4, 0]
    ```
    - ⚠️ **這一層的成敗在箭頭的方向，只能用眼睛驗**：信風指向西南（北半球）與西北
      （南半球）、西風指向東北與東南、極地東風指向西南與西北。**方向畫反是最容易
      發生又最不會報錯的錯**，而它正好是這一層唯一要教的東西
    - ⚠️ 六條帶的箭頭在畫面上要**看起來一樣斜**（斜度依緯度校正過）。極地東風變成
      接近垂直代表 `ARROW_SCREEN_SLOPE_DEG` 那段校正被改掉了
    - 氣壓帶是**間斷的短線段**而不是橫貫全圖的長線（否則會跟緯度參考線疊成一條），
      而且三條各自標著「赤道低壓帶」「副熱帶高壓帶」「副極地低壓帶」
    - 點箭頭或點氣壓帶要開得了卡（六筆圖徵各有內容檔）：點信風 → 標題「信風」、
      副標「從副熱帶高壓吹回赤道的風…」；點 30° 那條 → 「副熱帶高壓帶」
    - 圖例要有四列、色塊同色，而且「氣壓帶」那一列帶著 `（示意）` 標記（schematic）
    - 搜「信風」「馬緯度」「咆哮」都要找得到（分別命中信風、氣壓帶、西風——靠
      `items[].keywords`，這一層沒有可點清單）
    - ⚠️ **不可以出現橫貫整個地球的線**（箭頭跨過 ±180 的症狀）
    - `maxzoom: 4`：再放大一支箭頭會比畫面還寬，整層應該消失
    - 切底圖之後重驗顏色、虛線與排序（在 `contour-lines` 之上、`contour-labels` 之下）

35. **洋流（暖流／寒流）**（`/theme/world` → 海洋，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    [m.getPaintProperty('ocean-currents-warm-line','line-color'),
     m.getPaintProperty('ocean-currents-cold-line','line-color')]   // ["#b00a1d","#133eec"]
    // 主題預設視角（center [0,10]、zoom 1.8）：18 條**全部**畫得出來，而且全部標得出名字
    const u = l => new Set(m.queryRenderedFeatures({layers:[l]}).map(f=>f.properties.id)).size;
    [u('ocean-currents-warm-line'), u('ocean-currents-cold-line')]  // [10, 8]
    m.queryRenderedFeatures({layers:['ocean-currents-warm-label','ocean-currents-cold-label']}).length
    // 1800×953 實測 20（長線會拿到兩個標註）
    ```
    - ⚠️ **這一層的成敗在箭頭的方向，只能用眼睛驗**：北半球的環流順時針（灣流北上、
      加利福尼亞寒流南下）、南半球逆時針（巴西暖流南下、本格拉寒流北上）。
      **方向畫反是最容易發生又最不會報錯的錯**，而它正好是這一層要教的東西
    - ⚠️ **不可以出現橫貫整個地球的橫線**（某一段跨過 ±180 的症狀）。北太平洋暖流、
      兩條赤道暖流與西風漂流一定會跨換日線，要看它們在畫面左右兩側**各接上一半**，
      而且線真的畫到圖幅邊緣、不是提前幾度就停住
    - ⚠️ **經度寫錯方向的回歸判準**：往西流的洋流（兩條赤道暖流）如果被寫成 wrap 過的
      經度，會產出一堆碎線＋一條 44° 的橫線。建置期沒有東西擋，只能看畫面
    - 點任一條要開得了卡（18 條都有內容檔）：點黑潮 → 標題「黑潮 Kuroshio Current」、
      副標「從菲律賓東方北上…」，底下有「這是簡化的教學示意幾何」的警語
    - **搜「黑潮」「祕魯寒流」要直接命中那一條洋流**（不是只命中「暖流」子項目），
      選了會 `fitBounds` 過去並開卡。⚠️ 順帶確認聚焦搜尋框**不會**因此多抓任何檔案
      ——這一層是程式產生的，`performance.getEntriesByType('resource')` 裡不該有
      任何 `ocean-currents` 的項目
    - 顏色**綁在暖／寒上，不隨勾選順序改變**：先勾寒流再勾暖流，暖流仍然必須是紅的
    - ⚠️ **跟「板塊邊界」一起打開時的已知衝突要親眼確認一次**（`jumpTo([-78,-25], 3)`）：
      藍色的祕魯寒流會與藍色的聚合型邊界沿祕魯－智利海溝平行並排。**那是已知且記錄
      在案的**（見上），判讀靠洋流的沿線名稱；發現連名字都讀不出來才是回歸
    - `maxzoom: 6`：再放大整層應該消失
    - 切底圖之後重驗存在、顏色與排序（在 `contour-lines` 之上、`contour-labels` 之下）

36. **大洲分區**（`/theme/world` → 國界與大洲，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [0, 10], zoom: 1.9 });
    new Set(m.queryRenderedFeatures({layers:['world-continents-fill']}).map(f=>f.properties.id)).size  // 7
    m.queryRenderedFeatures({ layers: ['world-continent-labels-label'] }).map(f=>f.properties.name)
    // 1920×873 實測 6 個（南極洲在這個視角的畫面外）；**每一洲最多一個**
    m.getPaintProperty('world-continents-outline', 'line-color')   // "#a05a80"
    ```
    - ⚠️ **最重要的一項是「洲名有沒有重複」**，而且只有數標註或看畫面才抓得到：把
      洲名改回掛在面上的話，實測全球視角會出現六十幾個「亞洲」「北美洲」散在各個島上
      （maplibre 逐塊逐圖磚算錨點，見上）。`queryRenderedFeatures` 數出來每一洲 >1 就是回歸
    - ⚠️ **不可以出現橫貫大陸的直線**（分界線被套用到不該切的國家的症狀，見上）。看
      `jumpTo([40,35], 2.6)`：烏拉山（東經 60°）、烏拉河、土耳其海峽、蘇伊士各有一條
      短短的洲界，**沒有**任何一條線延伸到別的大陸去
    - 點南美洲內陸與點「大洋洲」那四個字，兩者都要開卡，而且開的是**那一洲自己的卡**
      （洲名是附屬圖層，id 與母圖徵相同）
    - 選取時整洲浮出 0.38 的面染：
      ```js
      JSON.stringify(m.getPaintProperty('world-continents-fill','fill-opacity'))
      // ["case",["in",["get","id"],["literal",["africa"]]],0.38,0]
      ```
      ⚠️ 順便用眼睛確認**西奈半島沒有跟著非洲一起變深**——那是蘇伊士那條洲界有沒有
      切對的唯一證據
    - 抽屜清單是 7 列、依面積由大到小（亞、非、北美、南美、南極、歐、大洋），副標是
      面積與占陸地比例
    - 搜「大洋洲」「Asia」「南極」都要找得到；⚠️ 這一層有 `browse`，所以聚焦搜尋框
      **會**多抓 `world-continents.geojson`（326 KB），那是已知成本
    - 南極洲要是一整片完整的陸地（`jumpTo([20,-60], 1.6)`），**不可以有一條橫貫地圖的
      橫線**——它的環沿著南緯 90° 繞回起點，建置期的檢查對那條邊是刻意放行的
    - `maxzoom: 5`（面）與 `maxzoom: 4`（洲名）：zoom 4.2 應該只剩面、zoom 5.2 整層消失
    - 切底圖之後重驗存在、顏色與排序（面 < 線 < 洲名，全部在 `contour-lines` 之上、
      `contour-labels` 之下）

37. **世界主要山脈**（`/theme/world` → 地形水系，見上）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [0, 10], zoom: 1.8 });
    m.getPaintProperty('world-mountains-line', 'line-color')   // "#8e26ff"（**不是** relief 的 #c23f8f）
    new Set(m.queryRenderedFeatures({layers:['world-mountains-line']}).map(f=>f.properties.id)).size
    // 主題預設視角、1920×873 實測 38（橫貫南極山脈在畫面外）
    m.queryRenderedFeatures({ layers: ['world-mountains-label'] }).length          // 12
    m.queryRenderedFeatures({ layers: ['world-mountain-peaks-points'] }).length    // 38
    ```
    - ⚠️ **這一層的成敗只能用眼睛驗**：中軸線要真的落在山脈上。看安地斯（沿南美西緣
      一路到火地島）、洛磯與海岸山脈（平行的兩條）、喜馬拉雅（沿青藏高原南緣的弧）、
      大分水嶺（澳洲東岸）。**一條穿過平原或海面的直線就是回歸**（多半代表
      `polygonAxis()` 的平滑或連通分量過濾被改壞了）
    - ⚠️ **跟「火山帶」一起打開**（`jumpTo([-70,-30], 4)`）：紫色的線是安地斯山脈、
      洋紅的點是火山。**兩者分不出來就是回歸**——那正是這一層不能沿用 `relief` 洋紅的
      唯一理由（見上）。冰島與東非大裂谷那一帶也要看一次
    - **跟「板塊邊界」一起打開**（`jumpTo([84,31], 4)`）：藍色**虛線**是聚合型邊界、
      紫色**實線**是喜馬拉雅山脈，兩條平行貼著
    - 點地圖上的線要開得了卡，而且要是**內容檔**那一版（不是 fallback）：標題下面有
      四格數據（最高峰／主要國家／長度或走向），底下是 `facts`、示意警語與三個來源
      連結。⚠️ 只看標題對不對是分不出來的——退回 fallback 時標題一樣對，但四格數據
      會消失、內文變成 geojson 的 `meta` 與 `detail` 那兩行
    - **點最高峰開的是山峰自己的卡，而且卡上不可以有示意警語**（`attach.schematic: false`，
      見上）：
      ```js
      // 點抽屜裡的「聖母峰」→ 卡片是「聖母峰／Mount Everest／喜馬拉雅山脈主峰・8,848 公尺」
      document.querySelector('.map-detail-panel').innerText.includes('教學示意')   // false
      ```
    - **母子雙向連動強調**，清單一定是兩筆（比照五大山脈 → 主峰）：
      ```js
      JSON.stringify(m.getPaintProperty('world-mountains-line','line-width'))
      // ["case",["in",["get","id"],["literal",["himalaya","himalaya-peak"]]],["*",2.6,2.2],2.6]
      ```
    - ⚠️ **點最高峰之後山脈必須還在畫面上**（`attach.browse.zoom` 是 5.5、母圖層
      `maxzoom` 是 6，見上）。只看卡片有沒有開是抓不到的：
      ```js
      // 點「聖母峰」之後
      m.getZoom()                                                              // 5.5
      m.queryRenderedFeatures({ layers: ['world-mountains-line'] }).length > 0  // true
      ```
    - 抽屜清單是 78 列（39 條山脈各帶一座巢狀的最高峰）、依洲分七組
      （亞、歐、非、北美、南美、大洋、南極），組內依主峰高度由高到低，開頭是喜馬拉雅
    - 搜「安地斯」「Andes」「聖母峰」「庫克山」都要找得到；⚠️ **原名也要**：
      搜「K2」「Denali」「Aoraki」各要命中一座最高峰——那是附屬圖徵的 haystack
      有沒有收 `en` 的唯一證據（見「搜尋索引」那節，這個洞真的漏過）。
      ⚠️ 兩層都有 `browse`，所以聚焦搜尋框**會**多抓 40 KB（30 + 10），那是已知成本
    - `maxzoom: 6`：zoom 6.2 整層應該消失（中軸線再放大就是假精確）
    - 切底圖之後重驗存在、顏色與排序（線 < 最高峰 < 沿線標註，全部在 `contour-lines`
      之上、`contour-labels` 之下）

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

`.github/workflows/deploy.yml`：push 到 `main`（或每 6 小時的 `schedule`）→ `npm ci` → `npm run build:reservoirs` → `npm run build` → `upload-pages-artifact`（`dist`）→ `deploy-pages`。

**`build:reservoirs` 是唯一一個會在 CI 打外部 API 的步驟，而且是 `continue-on-error: true`。** 這不是偷懶：repo 裡已經 commit 了一份 `reservoirs-live.json` 當 fallback，上游掛掉或被 bot 防護攔下時，正確的行為是沿用舊快照繼續部署，而不是讓整個網站發不出去。其餘的 `build:*` 腳本（geodata／climate／species）**CI 永遠不會執行**，產物一律 commit 進 repo。

那個 `schedule` 存在的唯一理由是水庫水情：純靜態站沒辦法在執行期抓資料，所以「即時」的更新頻率就等於重新部署的頻率。

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
├─ search/searchIndex.ts  # 主題頁搜尋索引（跨兩個主題，lazy 建立）
├─ content/
│  ├─ index.ts            # import.meta.glob 載入地點/原住民族/物種；氣候與物種觀測點 JSON 用 fetch
│  ├─ places/*.json
│  ├─ indigenous/*.json   # 16 族代表點
│  └─ species/*.json      # 物種介紹文字（不含座標）
│  └─ geo/<collection>/*.json  # 地理要素說明（選填，沒有就走 FeatureCard fallback；
│                              #   ⚠️ tw-vegetation-belts 例外，六帶都必填——那一層
│                              #   沒有 geojson，fallback 等於沒有退路）
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
   ├─ ReservoirCard.tsx   # 水庫詳情卡（即時水情水球 + 基本資料，資料全來自 geojson）
   ├─ MonumentCard.tsx    # 古蹟詳情卡（基本資料來自 geojson，歷史沿革按縣市延遲載入）
   ├─ QuakeCard.tsx       # 單次地震的震央卡片（規模／震源深度／震央經緯度，字串在這裡組）
   ├─ TownshipCard.tsx    # 鄉鎮市區詳情卡（鄉鎮界／人口／作物三層共用，五份資料自己抓）
   └─ PlaceCard/IndigenousCard/SpeciesCard/FeatureCard/LayerPanel/MapLegend…
public/data/
├─ reservoirs-live.json   # build:reservoirs 產生（禁止手改，每次部署重抓）
├─ climate/*.json         # build:climate 產生
├─ species/*.geojson      # build:species 產生
├─ geo/*.geojson          # build:geodata 產生（禁止手改）
├─ monuments/*.json       # 古蹟歷史沿革的縣市分片，21 份（build:geodata 產生，禁止手改）
└─ geo-manual/*.geojson   # 手繪教學示意幾何（可以手改）
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ build-species.mjs      # GBIF → public/data/species
├─ build-geodata.mjs      # NLSC / Natural Earth / USGS / 水利署 / OSM / 文資局 → public/data/geo
├─ build-reservoirs.mjs   # 水利署水庫水情 → public/data/reservoirs-live.json
├─ lib/simplify.mjs       # 自帶的 Douglas–Peucker（刻意不加依賴）
├─ lib/unzip.mjs          # 自帶的 ZIP 讀取器（zlib.inflateRaw；檔名會判 Big5，見上）
├─ lib/gml.mjs            # NLSC 行政區界線 GML + TGOS SimpleWFS 兩種 GML 2 形狀
├─ lib/kml.mjs            # 水利署水庫蓄水範圍 KML 的剖析器（同樣只認得那一種）
├─ lib/shp.mjs            # shapefile 讀取器，只支援多邊形。**兩組慣例並存**：
│                         #   readShapefileZip()（.shp/.dbf/.prj/.cpg，已反轉＋已投影）供保護區用
│                         #   parseShpPolygons()/parseDbf()（原始 TM2 座標）專供 tw-basins
├─ lib/twd97.mjs          # TWD97 TM2 → WGS84（中央子午線 121/119/117 由 .prj 決定）
├─ lib/dissolve.mjs       # 有向邊相消的多邊形聯集（分區圖 → 園區範圍）
├─ lib/csv.mjs            # CSV 剖析器（水庫與國家公園索引共用）
├─ lib/protected-areas.mjs # 國家公園與保護區四個資料集的存取層
├─ lib/reservoirs.mjs     # 水利署開放資料的共用存取層（CSV 剖析、bot 防護、id 對照表）
├─ lib/monuments.mjs      # 文資局古蹟的存取層（經緯度顛倒修正、名稱前綴剝除、縣市分片）
├─ lib/quakes-major.mjs   # 氣象署〈災害地震〉表的剖析（＋2023 年後補錄的人工抄錄表）
├─ lib/faults.mjs         # 活動斷層的存取層（地質雲端點、33 條的 id 對照表、筆數檢查）
├─ lib/typhoons.mjs       # 侵臺颱風的存取層（氣象署最佳路徑 txt ＋ 概況表 HTML；14 個的 id 對照表）
├─ lib/volcanoes.mjs      # GVP 全新世活火山的存取層（19 個火山區與 17 種類型的中文對照、40 幾座知名火山的中文名、筆數檢查）
├─ lib/continents.mjs     # 七大洲的存取層（NE 國界的洲別欄位、四條課本洲界的切線、陸地面積交叉檢查）
├─ lib/mountains.mjs      # 世界主要山脈的存取層（39 條的中文名／洲別／成因／最高峰對照表、範圍面 → 中軸線）
├─ lib/biomes.mjs         # RESOLVE 生態區的存取層（14 個生物群系 → 六個教學用大類、小碎塊過濾、跨 ±180 檢查）
├─ lib/koppen.mjs         # 柯本氣候分區的存取層（0.5° ASCII 網格、30 個亞型的中文名與判準、五大類分組）
├─ lib/population.mjs     # 各鄉鎮市區人口密度的存取層（年份寫死、site_id 切縣市／鄉鎮、行政層級）
├─ lib/crops.mjs          # 農情調查的存取層（逐縣市抓以避開 9999 上限、台／臺正規化、非生產列過濾）
├─ lib/overpass.mjs       # OSM Overpass 存取層（端點輪替、way 串接）。**兩種查法並存**：
│                         #   fetchRouteLines()  單一選擇器一次一條，交通軸線用（10 條）
│                         #   fetchWaterwaysByRef() 依 ref 分批一次 30 條，河川用（118 條）
├─ lib/rivers.mjs         # 118 個列管水系的官方身分（RIVERS：id／河川代碼／管理等級／流經縣市／常用別名／26 條才有的官方長度面積）
│                         #   RIVER_IDS／RIVER_OSM_REFS／RIVER_FACTS／BASIN_IDS 全部從 RIVERS 衍生
├─ lib/fetch-retry.mjs    # 指數退避的 fetch（含 HTTP/2 fallback，見上）
├─ validate-content.mjs   # 建置前 schema 驗證 + 註冊表交叉檢查（會跑一次 generators.ts 拿程式產生的圖徵 id）
└─ postbuild.mjs          # 404.html + CNAME 確認
```

`src/content/index.ts` 直接把 JSON 當成對應型別使用而不在瀏覽器端跑 zod——建置期已經驗過，不必把 zod 打包進前端。
