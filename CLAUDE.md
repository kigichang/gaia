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
>
> ⚠️ **世界地理主題的圖層文件在 `CLAUDE_WORLD.md`，那份也不會自動載入。**
> 要動 `/theme/world` 的任何圖層——`src/map/registry/themes/world.ts`、
> `generators.ts` 的 `windBelts()`／`oceanCurrents()`、`scripts/lib/` 底下對應的
> 存取層、`public/data/geo/` 與 `src/content/geo/` 底下非 `tw-` 的那些，以及
> `basemaps.ts` 的地名繁體化——**請先把 `CLAUDE_WORLD.md` 讀完再開始**。那裡有
> 板塊、大洲、火山帶、世界主要山脈、生物群系、柯本氣候分區、行星風系、洋流、
> 世界櫥窗各層的資料來源、取得邏輯、踩過的坑與第 28–40 項驗證清單。

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
| 臺灣活動斷層 | `geologycloud.tw/data/zh-tw/ActiveFault?all=true`（經濟部地質調查及礦業管理中心「地質雲」） | **只在建置期呼叫**。⚠️ data.gov.tw 那份**只有 WMS 影像**，拿不到向量；⚠️ **`?all=true` 不能省**——少了它只回前 100 段（HTTP 200），這一層踩過整整一輪，見 `CLAUDE_TW.md` |
| 臺灣地質圖（地層面） | `geologycloud.tw/data/zh-tw/Stratum25?all=true`（同一個平臺的二十五萬分之一地質圖） | **只在建置期呼叫**。⚠️ **`?all=true` 不能省**——少了它上游只回 100 筆而且 HTTP 200；官方地質圖在網路上只發圖磚影像，見 `CLAUDE_TW.md` |
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
| 日和山（世界櫥窗「海拔最低的山」）的位置與 3 公尺標高 | `maps.gsi.go.jp`（日本國土地理院 地理院地圖） | **程式完全不呼叫**。日本沒有把「哪些丘登載為山」做成可下載的資料集，官方依據就是地形圖本身，所以來源連的是**定位到那座山的地圖**，座標與標高人工轉錄進 `public/data/geo-manual/world-superlatives-peaks.geojson`（比照海峽中線） |
| 基本地理事實（山脈走向、主峰高度、河川路徑、河川分界…） | `zh.wikipedia.org` 各條目 | **程式完全不呼叫**，人工查閱後寫進 `src/content/` 與 `public/data/geo-manual/`。次級來源，用法見「內容撰寫規範」，CC BY-SA |

> ⚠️ 表格裡的「見下」現在分散在三份文件：臺灣的資料集見 `CLAUDE_TW.md`、世界的
> （板塊、生物群系、柯本、Natural Earth 的大洲與山脈、GVP 火山…）見 `CLAUDE_WORLD.md`，
> 兩邊的小節標題都沒有改。

### ⚠️ NLSC 的路徑順序陷阱

NLSC WMTS 是 `{z}/{y}/{x}`——**y 在 x 前面**，跟絕大多數 XYZ 服務相反。寫成 `{z}/{x}/{y}` 仍然會回 HTTP 200，只是拿到位置完全錯亂的圖磚，不會有任何錯誤訊息。

### 氣候資料為什麼要預先產製

`scripts/build-climate.mjs` 在建置期抓 1991–2020 逐日資料，聚合成 12 個月的均溫與月雨量，輸出到 `public/data/climate/<place-id>.json`。網站執行期只讀本地 JSON。

理由：一個班級同時開站會對 Open-Meteo 產生大量請求而被限流（實測連抓 5 個地點就會收到 429）；而且執行期抓 30 年逐日資料再聚合會讓圖表等好幾秒。

**已知資料限制**：ERA5 是約 25 km 網格的再分析資料，會平滑掉小島與陡峭地形的地形雨。例如希洛實測年雨量約 3300 mm，ERA5 只給約 1590 mm。用於教學比較的量級關係仍然正確，但**不要把這些數字當成氣象站觀測值引用**。

⚠️ **`src/content/places/` 的地點在主題頁看不到氣候圖表**：`PlaceCard` 只列
`facts` 與那四格數據，`ClimateChart` **只用在 `/compare`**。內容檔裡寫「下面那張
氣溫圖」在主題頁是假的（踩過），要引導讀者看圖就寫「到同緯度比較頁把它選進來」。

⚠️ **世界地點不是只能為了配對而收**：`world-places` 原本四筆都是為了 `/compare`
挑的緯度配對（開羅、塔曼拉塞特、馬薩特蘭、希洛），2026-08 加的**雅庫茨克**是第一個
為了它自己而收的——「世界最冷的大城市」。實測它的月均溫落差 **55.9 °C** 是全站
地點裡最大的（第二名塔曼拉塞特只有 17.4），所以那張圖本身就是一堂大陸性氣候。

⚠️ **2026-08 又補了 26 個世界城市，`world-places` 因此從 5 筆變成 31 筆**（挑選判準、
氣候型覆蓋、跟 ERA5 對不起來的三筆，以及新增的五組 `/compare` 配對全部寫在
**`CLAUDE_WORLD.md` 的「世界重要城市」**）。雅庫茨克**現在有配對了**（雷克雅維克，
64°N vs 62°N），舊版這裡寫的「它沒有對應的 presets 配對」已經不成立——那條限制的
理由（同緯度、同 zoom 才可比）仍然有效，只是本站終於收得到同緯度的另一個地點。

⚠️ **這批地點讓主 chunk 多了 gzip 18.5 KB**（170.4 → 188.9 KB，實測見下面
「為什麼不能繼續用 `import.meta.glob({ eager: true })`」）。那是刻意接受的：
`places` 必須 eager（`searchIndex.ts` 要同步讀別名），而這一份資料同時餵
`world-places` 圖層、`/compare` 與搜尋索引，是進站就會用到的東西。

### 臺灣各圖層的資料來源與坑 → 見 `CLAUDE_TW.md`

水庫、國家公園與保護區、河川與流域、交通軸線、古蹟、作物、人口、垂直植被帶、
岩石分布、活動斷層與地震、颱風、特有種觀測點——這些圖層的來源、取得邏輯與實測踩過的坑
全部搬到 **`CLAUDE_TW.md`** 了（上面那張端點總表仍然是完整的）。
**要動臺灣主題的圖層就先讀那一份。**

### 世界各圖層的資料來源與坑 → 見 `CLAUDE_WORLD.md`

板塊與板塊邊界、大洲分區、火山帶、世界主要山脈、森林與沙漠帶、柯本氣候分區、
行星風系、洋流、世界櫥窗（作者精選），以及世界底圖的地名繁體化——這些圖層的來源、
取得邏輯與實測踩過的坑全部搬到 **`CLAUDE_WORLD.md`** 了（上面那張端點總表仍然是
完整的）。**要動世界主題的圖層就先讀那一份。**

### 地理要素說明為什麼要延遲載入

`src/content/geo/<collection>/<id>.json` 是**單一事實來源**（zod 驗證、git 追蹤、
人手寫的），但**執行期讀的不是它**——`scripts/build-geo-content.mjs` 把每個
collection 打包成一份 `public/data/geo-content/<collection>.json`（key 是圖徵 id），
詳情卡開的時候才抓那一份。

#### 為什麼不能繼續用 `import.meta.glob({ eager: true })`

原本 `content/index.ts` 對 `./geo/*/*.json` 是 eager 的，所以 536 份說明**全部**打包
進主 chunk。實測那一段是 gzip **210 KB**——主 chunk 從 375.2 KB 掉到 165.2 KB，
少了 **56%**。那是每一個進站的人都要付的，即使他只打開一個圖層、只點一張卡；一個班
30 個學生同時開站時，這正是本站一路在避免的成本（比照搜尋索引的 lazy 化與古蹟歷史
沿革的縣市分片）。

⚠️ **地點／原住民族／物種那三組刻意維持 eager，不要順手一起改**：`searchIndex.ts`
要**同步**讀得到別名。地理要素相反——`searchIndex.ts` 一個字都沒用到（它只 import
那三支），所以改成非同步不影響搜尋。

⚠️ **那三組合計已經不是「只有 51 份」了**：2026-08 補了 26 個世界城市之後是 77 份，
實測主 chunk 因此從 gzip **170.4 KB 變成 188.9 KB**（把那 26 份暫時移走再 build 量的）。
這條路只剩兩個選項，都不要順手做：**要嘛接受**（現況——那份資料進站就會用到），
**要嘛把地點拆成「索引（id／名稱／座標／地形）＋詳情（facts）」兩份**，讓搜尋索引
只吃索引那半。後者會動到 schema、`PlaceCard`、`resolve.ts` 與 `/compare` 四個地方，
不是加內容時順手能做的事。

#### 分片單位是 collection，不是逐筆

逐筆會變成 536 個請求；而一張卡打開之後，同一層的其他圖徵幾乎一定會被點到（抽屜的
可點清單就擺在旁邊）。判斷同古蹟按縣市切成 21 份。最大的一份是 `tw-rivers`
（147 條、96 KB），仍遠低於本站的單檔預算（分片的硬上限設在 512 KB）。

#### ⚠️ 沒有任何內容檔的 collection 也要寫一份空分片

有 collection 是**宣告了但一份內容檔都沒有**的，一律走 `FeatureCard` 的 fallback。
⚠️ **這份名單 2026-08 縮短了**：`koppen-zones`（30 個亞型全部補齊）、`world-rivers`
（118 條裡的 33 條）、`volcanoes`（1,214 座裡的 9 座）、`world-mountain-peaks`
（39 座裡的 10 座）都寫了說明卡（見 `CLAUDE_WORLD.md`），現在真正全空的只剩
`tw-geology`（45 個圖例單位）。**但下面這條規則不能拿掉**——只要還有一個空的
collection，或之後又宣告了新的，它就必須成立。改成延遲載入之後，
那些卡片每開一次就會去抓一份不存在的分片 → **console 一行 404**，而且會先閃一下
「說明載入中…」才退回 fallback。所以 `lib/geo-content.mjs` 會**讀註冊表**補上 `{}`：
兩個 byte 換掉一個 404 與一次閃動。三個位置都要看——`layer.detail`、`items.detail`
（岩石分布的圖例單位、古蹟的級別）與 `attach.detail`（世界主要山脈的最高峰）。

⚠️ 反過來（有內容目錄、沒有圖層宣告）**不補也不刪**：`world-superlatives` 就是那樣
（兩層下架待重新設計，內容檔刻意留著），照樣產生分片，只是沒人會抓。

#### 三個實作細節不要拿掉

- **勾選圖層時就 prefetch**（`ThemeMapPage` 的 `prefetchGeoCollection`）。最自然的抓取
  時機是「點開卡片那一刻」，但那會讓每個 collection 的第一張卡先閃一段「說明載入中…」。
  勾圖層的當下本來就在抓那一層的 geojson（幾十到幾百 KB），順手多抓幾十 KB 感覺不到，
  而**沒有勾那一層的人一個 byte 都不會付**——分片要省的正是那個。實測 localhost 上
  「說明載入中…」根本看不到，要人工把 fetch 延遲幾秒才逼得出來。
- **載入中的卡片只畫 geojson 那邊就有的東西**（名稱、原名、`meta`）加一行
  「說明載入中…」，**不畫圖層說明、不畫來源、不畫示意警語**。⚠️ 三個都不是小事：
  圖層說明會先鋪一整段再整個換掉；`sources` 在內容檔與圖層上是兩組不同的字；而示意
  警語遇到 `attach.schematic: false`（世界主要山脈的最高峰）會「先出現再消失」，那等於
  對讀者說了一句幾百毫秒的假話。
- **`useDetailTitle` 對 `geo` 要在「查不到內容檔」時退回 geojson 的 `name`。**
  ⚠️ 這一條只有在「同一個圖層裡**有些**圖徵寫了內容檔、有些沒有」時才看得出來：
  世界主要河流 118 筆有 33 筆有卡片，退回之前點尼羅河有標題、點旁邊的
  「尼羅河（艾伯特段）」標題列就是**空白**的——而卡片本體照樣把名稱、圖層說明與來源
  畫得好好的（`FeatureCard` 的標題本來就是 `feature?.name.zh ?? fallback.name`），
  所以畫面上只像「這一列忘了畫」。1,214 座火山、39 座主峰同理。
- **`useDetailTitle` 是 hook 不是純函式**。面板標題原本同步查得到；現在分片還沒到就是
  undefined，而純函式版本**不會在分片落地後重算**，標題會一直空著（實測過）。所以它
  等 Promise 落地再逼一次重繪，並且必須在 `ThemeMapPage` 的**本體**呼叫——寫進
  `{detailOpen && …}` 那段 JSX 裡是條件式呼叫 hook，會壞。
- ⚠️ **它還要收 `instances`，那不是可有可無的參數。** `DetailSpec` 有九種，其中
  **古蹟、水庫、地震、鄉鎮**四種沒有內容檔，名字只存在於圖層的 geojson 裡（那份掛在
  `instances` 上）。補進來之前這支對那四種一律回 `undefined`，面板最上面那條標題列
  **一直是空白的**——而卡片本體完全正常，所以這個洞躺了很久沒被發現。
  ⚠️ 查詢一律用 `detail.type` 而不是圖層 id（`featuresIn()`）：古蹟是三個 instance、
  地震是兩個、鄉鎮是五個，拿單一 `owner.id` 去找一定會漏。
  ⚠️ 地震那一支要沿用「**有 `name` 的那一筆優先**」的既有規則（兩層共用同一組
  featureId，母圖層那 612 筆沒有地名），標題直接用 `QuakeCard` 匯出的 `quakeTitle()`
  ——**不要在面板這邊自己寫一份**，否則「已含『地震』兩個字的地名」與「沒有地名就退回
  規模」這兩個邊角會悄悄分歧。
  ⚠️ 那四種**不需要 `bump()` 重繪**：它們讀的 `instances` 本身就是 state。撈不到時
  回 `undefined` 讓標題留白，**不要塞「鄉鎮市區」這種佔位字**——那會在資料到之前先
  印一個錯的名字，比留白更糟。

#### ⚠️ 忘了重新產生分片是完全靜默的

詳情卡讀的是分片、不是 `src/content/geo/`，所以「改了內容卻沒跑
`npm run build:geo-content`」的症狀是**卡片顯示上一版的文字**——沒有錯誤訊息、
`npm run build` 也照樣成功。`validate-content.mjs` 因此**逐 byte 比對**兩邊（產生器與
驗證器共用 `lib/geo-content.mjs` 的同一支函式，所以不會出現「格式不同但內容相同」的
假警報），不同步就讓建置失敗。**那條檢查不要拿掉。**

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
14. **不得手動編輯 `public/data/geo-content/*.json`。** 地理要素說明的分片，由 `npm run build:geo-content` 從 `src/content/geo/` 產生。**內容要改 `src/content/geo/` 底下那一份**；`npm run validate` 會逐 byte 比對，不同步就讓建置失敗。
15. **不得憑感覺挑主題圖層的顏色。** 改動或新增 `src/map/thematicColors.ts` 的顏色前，必須重新用 dataviz skill 的 `scripts/validate_palette.js`（`--pairs all`，因為主題圖層是可任意複選的核取方塊，不能只驗證清單裡「相鄰」的顏色）驗證明暗兩模式，理由與已驗證過的組合見該檔案的註解。序位型的色階（水庫蓄水率、古蹟級別）改用 `--ordinal`。

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

> ⚠️ 下表的「見下」對**臺灣主題**的列指的是 `CLAUDE_TW.md`、對**世界主題**的列指的是
> `CLAUDE_WORLD.md`（那些小節連同標題整段搬過去了，用同一個標題找得到）。

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
| `world-superlative-peaks-points` | circle（⚠️ **已下架待重新設計**，見上；兩座山＋三座火山共五筆，沿用 `place` 藍。⚠️ 圖層 id 留著 `-peaks`，label 卻是「高山與火山」，見下） |
| `world-superlative-ranges-line` / `-label` | line + symbol（⚠️ **已下架待重新設計**，見上；安地斯山脈與中洋脊兩筆，沿用 `mountain` 紫。⚠️ 安地斯的幾何跟 `world-mountains` **完全重合**是刻意的，見下） |
| `world-picks-points` | circle（世界櫥窗；**編者選集**，跟「世界之最」是兩種東西，同樣沿用 `place` 藍，見下） |
| `world-picks-areas-line` / `-label` | line + symbol（世界櫥窗；編者選集裡**有範圍**的項目，`reference` 中性灰虛線——那條虛線的語意是「這是示意的線」，⚠️ 但兩筆的理由不同，見下） |
| `world-places-points` | circle |
| `world-population-points` | circle（505 個百萬人以上的都會區；半徑＝都會區人口，顏色是單一身分色。⚠️ 顏色**不是**臺灣人口那個紫——紫對火山洋紅是 hard FAIL，見 `CLAUDE_WORLD.md`） |
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
| `tw-geology-<class>-fill` / `-outline` | fill + line，**六個岩石大類各自一組**（`alluvium`／`terrace`／`sedimentary`／`slate`／`schist`／`igneous`）。⚠️ 顏色是大類、**圖徵是 45 個圖例單位**（點下去才知道是廬山層還是大南澳片岩）；外框是拿來**補相鄰面之間的縫**的，比照生物群系，見 `CLAUDE_TW.md` |
| `tw-plates-fill` / `-outline` | fill + line（臺灣周邊 6 塊板塊；`fillOpacity: 0`，畫出來的是外框與名字。⚠️ **板塊名不是面的標註**，見下） |
| `tw-plate-labels-points` / `-label` | circle + symbol（附屬圖層；`radius: 0`，整層只是六個板塊名的錨點——比照世界主題的洲名，理由見 `CLAUDE_TW.md`） |
| `tw-plate-boundaries-<type>-line` / `-label` | line + symbol，**三種邊界各自一組**（`divergent`／`convergent`／`transform`）。顏色與虛線沿用世界主題那一組；⚠️ **沿線標註在這一層是必要條件**（聚合藍對水系藍 ΔE 2.1），見 `CLAUDE_TW.md` |
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
| 臺灣地理 | `/theme/taiwan` | 臺灣123（土地與島群、專屬經濟海域、海峽中線、北回歸線）、行政區（縣市、鄉鎮市區）、**地體構造（板塊、板塊邊界）**、地形（地形景點、五大山脈、岩石分布）、天然災害（活動斷層、地震、颱風路徑與災損）、水系（118 個列管水系、水庫即時水情、河川流域分區）、人文（原住民族、交通軸線、古蹟、人口與都市體系）、植被生態（特有種、國家公園與保護區、垂直植被帶）、農業物產（主要作物分布） |
| 世界地理 | `/theme/world` | **全球尺度（骨架，排在前面）**：參考線（緯度參考線、國際換日線）、**世界櫥窗**（作者精選、作者精選・範圍；⚠️「世界之最」兩層已下架待重新設計，見上）、氣候與生物群系（森林與沙漠帶、柯本氣候分區、行星風系）、海洋（洋流：18 條暖流／寒流）、地體構造（板塊、板塊邊界、地震帶、火山帶）。**世界地理原有**：城市（世界重要城市 31 個、世界人口分布 505 個都會區）、大洲（大洲分區；⚠️「國界」那個 planned 圖層 2026-08 拿掉了，兩種建議底圖本身就畫著國界，見 `CLAUDE_WORLD.md`）、地形水系（世界主要河流、世界主要山脈）、人文專題 |

兩個主題頁都是**滿版地圖 + 浮動控制**（仿 Google Map），沒有頁首也沒有側欄——版面機制見下面的「全螢幕地圖外框與浮動控制」。

### ⚠️ 「全球地理形貌」在 2026-08 併進「世界地理」 → 見 `CLAUDE_WORLD.md`

`THEMES` 從三個變兩個、`themes/global.ts` 改名成 `themes/world.ts`、
舊網址 `/theme/global` 由 `App.tsx` 重導（**那條路由不要拿掉**，而且必須排在
`/theme/:themeId` 前面）。合併帶來的同框色衝突（聚合型邊界藍對水系藍 ΔE 2.1
→ 板塊邊界改畫虛線）與「線圖層變成七個、上限仍然是 3」的取捨寫在
**`CLAUDE_WORLD.md`** 的「主題地圖頁：世界主題的部分」。

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
| `tw-faults` | 37 條都沒有內容檔時，卡片整片都是圖層說明；現在是「車籠埔斷層／第一類・全新世（一萬年內）曾活動／觀察／資料來源」 |
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

- **世界各圖層的資料限制（Natural Earth 河流的中文名、國際換日線的折線與 5 段切分…）
  搬到 `CLAUDE_WORLD.md`** 的「已知資料限制（世界）」。

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

`.map-top-left` 是 `display: flex` 的一列，`MapSearchBox` 用 `flex: 1; min-width: 0` 佔滿剩下的寬度，`DonateButton`（`src/components/DonateButton.tsx`）用 `flex: none` 排在右邊——這是唯一一個心型固定用暖紅色（不是 `.map-fab` 預設的中性灰）的浮動按鈕，因為它要引導點擊而不是單純導覽。抽屜開著時整欄一起 `visibility: hidden`，心型也會跟著收起。

⚠️ **心型不是連結，是第三個 `MapPopover`。** 它原本是 `<a target="_blank">` 直接跳到均一的贊助頁，2026-08 改成先開一張「問題、建議與贊助」的小卡（GitHub Issue／`mailto:` ／贊助頁三個連結）。理由是這顆按鈕其實承擔兩件事，而**回報問題在整個站上沒有別的入口**——主題頁是滿版地圖，沒有頁首也沒有頁尾，直接外跳等於把那條路徹底藏起來，使用者在按下去之前也不知道自己會被帶去哪裡。

⚠️ **`flex: none` 要掛在 `MapPopover` 的根節點上（`.map-donate-root`），不是心型按鈕上。** 這就是 `MapPopover` 那個 `rootClassName` 存在的唯一理由：flex 子元素是根節點、心型只是它的孫節點，掛錯地方時搜尋框一長按鈕就被壓扁。窄螢幕那條 `display: none` 同理（見下）。

⚠️ **開關、Escape、點外面關閉一律走 `usePopover`，不要自己寫一份。** 尤其是 Escape：`usePopover` 把它掛在面板上並 `stopPropagation()`，所以不會冒到 `ThemeMapPage` 那個 document 層級的三段式 Escape——按 Escape 只關掉這張小卡，不會順手把詳情面板或抽屜一起關掉（實測層數不變）。

⚠️ **窄螢幕（≤860px）由 ⋮⋮⋮ 選單接手同一段內容，兩者永遠只出現一個。** 心型在那個寬度整顆是 `display: none`（要讓出 ⋮⋮⋮ 的位置與打字空間，見下），而**贊助還有別的管道、回報問題沒有**——少了這一段，手機上就完全沒有入口。所以內文抽成 `ContactNote`（`src/components/ContactNote.tsx`）給兩邊共用，`AppMenu` 那一段包在 `.map-menu-contact` 裡預設 `display: none`、只在窄螢幕變 `block`。

⚠️ **`.map-donate-root` 與 `.map-menu-contact` 那兩條 CSS 是一組的，改一條就要改另一條**——只改其中一條的後果分別是「手機上沒有回報入口」（回歸成上一版）或「桌機上同一段內容講兩次」，兩者在建置期都抓不到。窄螢幕還要把 `.map-menu` 加寬到 300px：⋮⋮⋮ 面板本來只靠 `min-width: 220px` 撐著，兩個完整網址在那個寬度下會斷得很碎。

⚠️ `/compare` 的 `variant="inline"` **沒有**這一段（那裡是頁首的一列，塞不下兩段文字），這是已知的。

⚠️ **窄螢幕（≤860px）的 `.map-top-left` 會變成滿寬，於是它跟右上角的 `.map-top-right`（⋮⋮⋮，絕對定位的另一欄）重疊，而它的 `z-index` 比較高——所以蓋掉的一定是主題選單那顆按鈕，而且是連看都看不到、也點不到**（實測 500px 寬時整顆被搜尋藥丸的右端吃掉；使用者在 Pixel 7a 上的回報是「愛心蓋住選主題的按鈕」）。修法有兩條、缺一不可：媒體查詢裡替這一欄補 `padding-right: calc(var(--top-right-fab-w) + var(--fab-gap) + 8px)`（`--top-right-fab-w` 是那顆 fab 的寬度 46px＝圖示 20 + padding 12×2 + 框線 1×2），並且把 `.map-donate-root`（`MapPopover` 的根節點，不是心型按鈕本身）整個 `display: none`——讓出那段留白之後，412px 的手機上搜尋框只剩三百出頭，再擺一顆 46px 的心型就不夠打字了。⚠️ **只藏愛心是不夠的**，搜尋藥丸自己一樣會蓋住 ⋮⋮⋮。驗法是 `document.elementFromPoint()` 打在 ⋮⋮⋮ 的正中心要命中那顆按鈕，光看截圖上愛心不見了會誤判成修好了。

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
- **比對前會做正規化（`normalizeForMatch()`）：轉小寫，並把「台」摺成「臺」。**
  ⚠️ **它只影響比對，不影響顯示**——`SearchHit.title` 與畫面上的字一律維持原樣。
  ⚠️ **兩個方向都需要它，因為上游圖資自己就混用**：實測 `public/data/geo/` 的圖徵
  名稱有 **49 個寫「台」、179 個寫「臺」**，而且**同一份檔案裡兩種都有**
  （`tw-monuments-municipal.geojson` 是 30 對 91，「台南法華寺」與「臺南水仙宮」
  並存，那是文資局公告的正式名稱，不能改資料去遷就搜尋）。沒有這一段的話，
  打哪一種寫法都只搜得到一半，而且畫面上完全看不出原因——搜「台灣海峽」曾經是
  **零結果**。`scripts/lib/crops.mjs` 早就為了 join 做同一件事，這是同一條規則。
  ⚠️ **只摺這一對，不要順手加別的**：「裏／裡」（裏海）、「渕／淵」（土渕海峽）、
  「麻／馬」（麻六甲）是不同的譯名或異體地名，本站一律寫進那一筆圖徵的 `meta`
  ——讀者需要知道有兩種寫法，而 `meta` 會顯示在可點清單的副標上；台／臺 是**同一個
  字**的兩種寫法，寫進 `meta` 只會變成畫面上的雜訊。
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

索引是 **lazy 的**：搜尋框第一次獲得焦點才 `buildSearchIndex()`。**實測（2026-08，production build 讀 `performance.getEntriesByType('resource')`）它會多抓 28 份、合計約 3.05 MB**（⚠️ 那次實測含「世界之最」兩層的 33 KB，該組下架後是 26 份、約 3.02 MB）：

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
| `tw-plates.geojson` | 8 KB |
| `tw-faults.geojson` | 40 KB |
| `world-mountains.geojson` | 30 KB |
| `tw-crops-tea.geojson` | 25 KB |
| `tw-reservoirs.geojson` + `reservoirs-live.json` | 20 + 2 KB |
| `tw-typhoons.geojson` | 14 KB |
| `world-mountain-peaks.geojson` | 10 KB |
| `world-picks-areas.geojson`（geo-manual） | 3 KB |
| `world-picks.geojson`（geo-manual） | 11 KB |
| `tw-county-halls.geojson` | 8 KB |
| `tw-strait-median-line.geojson` | <1 KB |

⚠️ **`tw-transport.geojson` 不在這張表上，那不是漏掉——它從來就不該在。** 交通軸線是
`items` 圖層，而 `featureHits()` 對子項目是 `if (!item.source) continue`：靠 `featureIds`
從母圖層切出來的子項目**沒有自己的 source**，所以那份 geojson 根本不會被索引抓。
`tw-eez`（四片經濟海域）同理，實測聚焦搜尋框後 **0 次**請求。這也表示那兩層的搜尋
完全靠 `LayerItem.keywords`，少填就搜不到（見 types.ts 的說明）。

⚠️ **`tw-geology-*.geojson`（六份、合計約 796 KB）也不在表上，但那是另一種理由：**
它的六個子項目**各自有 `source`**，所以只要開了 `items.indexFeatures` 就會被抓下來
——這一層**刻意不開**（比照柯本氣候分區）。45 個圖例單位的檢索一樣全靠 `keywords`。
實測聚焦搜尋框後 `tw-geology` 的請求數是 **0**；選了「片岩與大理岩」那一筆之後才
多抓那一類的 41 KB。

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
- **⚠️ 內容檔裡不要寫 markdown，卡片一律當純文字算繪。** 詳情卡把 `facts[].value`
  直接放進文字節點，`**粗體**` 因此**會原樣印出兩對星號**——而且不會有任何錯誤，
  只有把那張卡打開來看才發現得了。2026-08 掃過整個 `src/content/` 找到 6 處
  （維蘇威、聖母峰、普哈胡努 ×2、尤耶亞科山、信風），已全部改掉。
  **要強調就用「」**（本站 459 份內容檔本來就是這個慣例），或者把重點寫進句子結構
  （「並不在板塊邊界上」）。⚠️ 這件事**不要靠加一個 markdown 算繪器來解**：那會替
  一份純資料檔開一條新的語法通道，而 `sources`、`stats`、`subtitle`、圖層的
  `description` 與 `notes` 全都不會經過它，寫的人分不出哪裡能用、哪裡不能用。
  `validate-content.mjs` 現在會**逐檔掃 `src/content/{places,indigenous,species,geo}`
  底下的 json**，出現 `**` 就讓建置失敗（檔案層級而不是逐欄位——那兩個星號在這些
  資料檔裡沒有任何合法用途）。

#### ⚠️ `koppen` 不可以拿 ERA5 自己算

很自然會想到「反正 `public/data/climate/` 就有月均溫與月雨量，直接套柯本公式算一遍最一致」。**實測會算錯，而且錯的方向很固定**：ERA5 是 25 km 網格，冬季雨量被大幅平滑，於是「冬乾」判不出來——嘉南平原、臺中盆地、八卦台地、埔里盆地、桶盤嶼算出來全變成 `Cf*`，而中央氣象署的分區是 `Cwa`（西部 苗栗以南至嘉南平原的平原地帶＋澎湖群島）。同理 `Aw` 會被算成 `Am`／`Cwa`（屏東平原、田寮月世界、鵝鑾鼻），因為最冷月均溫被拉低到 18 °C 以下。

所以 `koppen` 一律照**中央氣象署的臺灣氣候分區**填：北部與東北部平原丘陵 `Cfa`、苗栗以南至嘉南平原的平原地帶與澎湖 `Cwa`、高雄屏東平原 `Aw`、東部全年有雨 `Cfa`、高山依海拔 `Cfb`／`ET`。ERA5 只拿來當**方向性的**交叉檢查，不當判準。

唯一由 ERA5 定案的是大屯火山群（七星山，1,120 m）：它正好卡在 `Cfa`／`Cfb` 的最暖月 22 °C 門檻上（ERA5 21.6 °C，由鞍部測站 825 m 依環境減率外推約 22.1 °C），兩邊都在誤差內，因此取站上自己那份資料看得到的值 `Cfb`。**這是刻意的，不是漏改。**

### 預設比較組合

`src/compare/presets.ts`。每一組都要挑「緯度接近、地理條件差很多」的配對，並在 `hint` 寫清楚教學意圖。例如臺北與塔曼拉塞特年均溫都是 22.3 °C，年雨量卻是 2078 mm 對 24 mm。

⚠️ **好的配對是「只有一個變因不同」**，`hint` 要把那個變因指名道姓。2026-08 補了 26 個
世界城市之後新增五組（東京↔洛杉磯＝大陸東西岸、新加坡↔奈洛比＝海拔、聖保羅↔愛麗絲泉＝
南回歸線上的海陸位置、開普敦↔雪梨＝南半球東西岸、雷克雅維克↔努克＝洋流），挑法與
每一組的實測數字見 `CLAUDE_WORLD.md` 的「世界重要城市」。

⚠️ **`lat` 是兩張地圖共用的**（緯度鎖定是 `/compare` 成立的前提），所以配對的兩地
緯度差幾度沒關係、取一個中間值即可（臺北 25.0 ↔ 開羅 30.0 用的就是 27）。**但不要
拿緯度差超過五、六度的兩地硬湊**——那時 `lat` 落在誰身上都不對，兩張地圖會各自
偏離主角。

⚠️ **下拉選單依 `region` 分成「臺灣／世界」兩個 `<optgroup>`**（`ComparePage` 的
`PLACE_GROUPS`）。地點從 30 筆長到 56 筆之後，平鋪的清單會讓臺灣的地點散在世界城市
中間（順序是檔名字母序）。組內順序刻意維持 `places` 原本的順序，比照主題頁可點清單
「排序規則跟著資料集走」的既有規則。

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
npm run build:geo-content # 把 src/content/geo/ 打包成 public/data/geo-content/ 的分片
                        #   ⚠️ 純本地轉換、不打任何 API，改了內容檔就重跑一次（成本是零）。
                        #   忘了跑的話 `npm run validate` 會擋下來
npm run build:geodata   # 產生行政區/河流/地震/水庫 geojson（已存在會跳過）
npm run build:geodata -- --force --only=quakes   # 只重抓一個資料集
npm run build:geodata -- --force --only=tw-protected-areas   # 國家公園與保護區（約 2 分鐘）
npm run build:geodata -- --force --only=tw-townships          # 368 個鄉鎮市區（下載 12.8 MB）
npm run build:geodata -- --force --only=tw-rivers             # 118 個列管水系，⚠️ 約 40 分鐘
                                       # （每條河一次 Overpass 查詢，且會撞到限流而退避重試，
                                       #   這是正常的，不要以為卡住了。跑背景並看日誌的長度對照）
npm run build:geodata -- --force --only=tw-crops-fruit        # 作物三種要各跑一次（需先有鄉鎮界）
npm run build:geodata -- --force --only=tw-population         # 368 個鄉鎮的人口（同樣需先有鄉鎮界）
npm run build:geodata -- --force --only=tw-geology-slate      # 岩石分布六類要各跑一次
                                       # （alluvium／terrace／sedimentary／schist／igneous 同理；
                                       #   一個 process 裡共用同一次 2.9 MB 的下載，見 lib/geology.mjs）
npm run build:geodata -- --force --only=tw-faults             # 37 條活動斷層
npm run build:geodata -- --force --only=tw-quakes             # 臺灣周邊 M≥5.5（612 筆）
npm run build:geodata -- --force --only=tw-quakes-major       # 災害性地震（自己查 USGS，不依賴 tw-quakes）
npm run build:geodata -- --force --only=tw-typhoons           # 14 個侵臺颱風的官方最佳路徑
npm run build:geodata -- --force --only=tw-typhoon-centers    # 同一份資料的 757 個中心定位點
npm run build:geodata -- --force --only=date-line            # 國際換日線（Natural Earth）
npm run build:geodata -- --force --only=plates               # 52 塊板塊（含球面面積）
npm run build:geodata -- --force --only=plate-boundaries    # 三種板塊邊界（下載 10 MB 的 step 檔）
npm run build:geodata -- --force --only=tw-plates            # 臺灣周邊 6 塊板塊（跟 plates 共用同一次下載）
npm run build:geodata -- --force --only=tw-plate-boundaries # 臺灣周邊三種邊界（跟 plate-boundaries 共用那份 step 檔）
npm run build:geodata -- --force --only=volcanoes            # 1,214 座全新世活火山（GVP）
npm run build:geodata -- --force --only=world-continents     # 七大洲（Natural Earth 國界 → 依洲別聯集）
npm run build:geodata -- --force --only=world-population     # 505 個百萬人以上的都會區（下載 19 MB，跟大洲共用國界那份）
npm run build:geodata -- --force --only=world-mountains      # 39 條山脈（範圍面 → 中軸線）
npm run build:geodata -- --force --only=world-mountain-peaks # 同一份下載的 39 座最高峰
npm run build:geodata -- --force --only=world-superlatives-ranges
                                       # 世界櫥窗：安地斯中軸線＋中洋脊（跟 plate-boundaries 共用那份 10 MB 的 step 檔）
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
     - 心型的「問題、建議與贊助」小卡開著 → Escape 只關小卡、焦點回到心型，
       `shell.dataset.detailOpen` **不變**、**已勾選的圖層一個都不能掉**
       （它是第三個 `MapPopover`，走的是同一條 `usePopover` 路徑）
   - **「問題、建議與贊助」在任一寬度剛好一個入口**（⚠️ 用 `offsetParent`，不要用
     `querySelector` 的有無——兩邊的 DOM 一直都在，差別只在 CSS）：
     ```js
     const vis = el => el && el.offsetParent !== null;   // 祖先 display:none 時是 null
     // 寬螢幕：心型看得到、⋮⋮⋮ 裡那一段看不到
     // ≤860px：完全相反，而且 .map-menu 要是 300px（不是 min-width 的 220）
     ```
     ⚠️ 窄螢幕還要照第 8 項既有那條驗 ⋮⋮⋮ 沒有被蓋住（`document.elementFromPoint()`）
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
    - **台／臺 正規化**（`normalizeForMatch()`，見上）。兩種寫法的結果要**逐筆相同**，
      而且**畫面上的字要維持原樣**（摺疊只發生在比對用的副本上）：
      ```js
      // 同一個 helper 打兩次，比對兩份清單
      const hits = () => [...document.querySelectorAll('.search-hit')].map(e => e.textContent.trim());
      // 「台南」與「臺南」→ 12 筆完全相同，而且清單裡「台南法華寺」與「臺南水仙宮」並存
      // 「砲台」與「砲臺」→ 11 筆完全相同（上游兩種寫法都有）
      // 「台灣海峽」與「臺灣海峽」→ 5 筆完全相同
      // 「霧台」與「霧臺」→ 都找得到「霧臺鄉」
      ```
      ⚠️ **兩個方向都要驗**：資料寫「臺」而使用者打「台」（臺灣海峽），以及資料寫「台」
      而使用者打「臺」（台南法華寺）。實測整份 `public/data/geo/` 有 49 個名稱寫「台」、
      179 個寫「臺」，只驗一個方向會漏掉另一半
      ⚠️ 打「臺南法華寺」選下去要真的開出**台南法華寺**那張卡並飛到 120.2095/22.9839
      ——正規化只該影響比對，不該影響 `featureId` 與後續的選取流程
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

> **第 15–27 項與第 41–42 項是臺灣主題各圖層的驗證，搬到 `CLAUDE_TW.md` 了**（水庫、
> 保護區、交通軸線、河川、流域、古蹟、鄉鎮界、作物、人口、三層共用卡、植被帶、
> 斷層與地震、颱風、岩石分布、板塊）；**第 28–40 項是世界主題的，搬到
> `CLAUDE_WORLD.md` 了**（世界底圖地名、國際換日線、板塊與板塊邊界、火山帶、
> 森林與沙漠帶、柯本氣候分區、行星風系、洋流、大洲分區、世界主要山脈、世界櫥窗），
> **第 44–46 項也在那裡**（世界重要城市與新的 `/compare` 配對、柯本／河流／火山／
> 主峰那幾批說明卡、世界人口分布）。編號沒有重排，所以下面只有跨主題的第 43 項。

43. **地理要素說明的延遲載入**（跨主題，見上面「地理要素說明為什麼要延遲載入」）。
    ⚠️ **這一項在 localhost 上「看起來永遠是好的」**：分片幾毫秒就到，載入中的狀態根本
    不會出現。要驗那條路徑必須人工把它變慢——在 `content/index.ts` 的
    `loadGeoCollection()` 前面暫時包一個 `setTimeout`（驗完記得拿掉）：
    ```js
    // 勾一個還沒抓過說明的圖層，等清單出來就立刻點第一筆
    const p = document.querySelector('.map-detail-panel');
    p.querySelector('.feature-loading') ? 'LOADING' : (p.querySelector('.detail-facts') ? 'FACTS' : 'FALLBACK')
    ```
    - **載入中**：卡片只有名稱、原名、`meta` 與「說明載入中…」。⚠️ **不可以有**
      `.detail-sources`、`.feature-schematic` 或 `.feature-fallback`（那三段之後會被
      換掉或撤回，見上）
    - **載入完**：換成 `.detail-facts`，而且**面板標題列要跟著補上名字**
      （`.map-detail-head-title`）——空白代表 `useDetailTitle` 又退回成純函式了
    - ⚠️ **九種 `DetailSpec` 要逐一驗面板標題列**（`none` 不開卡片，所以是八種）。
      每一種的 `.map-detail-head-title` 都不可以是空字串，而且要跟卡片自己的
      `.feature-title` 一致：
      ```js
      const head = () => document.querySelector('.map-detail-head-title')?.textContent;
      const card = () => document.querySelector('.map-detail-panel .feature-title')?.textContent;
      // place 雅庫茨克／indigenous 阿美族／species 櫻花鉤吻鮭／geo 蘇伊士運河
      // reservoir 曾文水庫／monument 台南法華寺／township 鹿谷鄉
      // quake 有地名 → 「集集地震」；quake 沒地名 → 「規模 8.2 地震」
      ```
      ⚠️ **沒有地名的地震只能用點的**（臺灣地震那一層沒有 `browse`、不進搜尋索引）：
      勾起來、`queryRenderedFeatures` 找一顆 `!properties.name` 的震央、`m.project()`
      算出螢幕座標再點下去
    - **沒有內容檔的圖徵不能卡在載入中**：勾「流域分區」點一個沒有內容檔的流域
      （例如石門溪）、或勾「世界主要河流」點尼羅河，都要**直接**是 fallback
      （名稱＋`meta`＋圖層說明＋來源）
    - **不可以有 404**：`tw-geology` 一份內容檔都沒有（`volcanoes`／`world-rivers`／
      `world-mountain-peaks` 則是**只有一部分**圖徵有卡片），但分片一律必須存在：
      ```js
      performance.getEntriesByType('resource').filter(r => /geo-content/.test(r.name))
        .map(r => [r.name.split('/').pop(), r.responseStatus])   // 全部要是 200
      ```
    - **只抓用得到的那幾份**：進站時只有 `defaultOn` 圖層那幾份（臺灣主題是
      `tw-territory` 與 `tw-ranges`），勾一個圖層才多一份。⚠️ 用
      `performance.getEntriesByType('resource')` 數之前先確認**總筆數還沒到 250**
      （瀏覽器的預設緩衝上限，聚焦過搜尋框就會塞滿，後面的請求全部不會被記錄——
      踩過，症狀是「明明抓了卻查不到」）
    - **切圖徵不會看到新標題配舊內容**：同一層連點三筆、再跨到另一個 collection，
      標題與卡片內容每一次都要一致
    - **主 chunk 真的變小了**（回歸判準，只有 production build 量得到）：
      ```bash
      npm run build | grep 'assets/index-.*\.js'   # gzip 應該在 165 KB 上下，不是 375 KB
      ```

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
│  ├─ index.ts            # import.meta.glob 載入地點/原住民族/物種（eager，搜尋索引要同步讀）；
│  │                      #   ⚠️ 地理要素相反，是 public/data/geo-content/ 的延遲載入分片
│  ├─ useGeoContent.ts    # useGeoFeature()：詳情卡取地理要素說明的 hook
│  ├─ places/*.json
│  ├─ indigenous/*.json   # 16 族代表點
│  └─ species/*.json      # 物種介紹文字（不含座標）
│  └─ geo/<collection>/*.json  # 地理要素說明（選填，沒有就走 FeatureCard fallback；
│                              #   ⚠️ 這裡是單一事實來源，執行期讀的是它的分片產物；
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
   ├─ MapPopover.tsx      # ⋮⋮⋮、「圖層」磚與心型小卡共用的泡泡容器（rootClassName 見上）
   ├─ MapLayersPopover.tsx# 左下「圖層」磚（內容重用 LayerToggles）
   ├─ MapSearchBox.tsx    # 左上搜尋藥丸（含開抽屜的 ☰）與建議清單
   ├─ DonateButton.tsx    # 搜尋藥丸右邊的心型：開一張「問題、建議與贊助」小卡（寬螢幕才有）
   ├─ ContactNote.tsx     # 那張卡的內文（Issue／mailto／均一）。⚠️ 窄螢幕改由 ⋮⋮⋮ 選單顯示，共用這一份
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
├─ geo-content/*.json     # 地理要素說明的分片，34 份（build:geo-content 產生，禁止手改）
│                         #   ⚠️ 這是 src/content/geo/ 的產物，詳情卡在執行期抓的就是它
├─ monuments/*.json       # 古蹟歷史沿革的縣市分片，21 份（build:geodata 產生，禁止手改）
└─ geo-manual/*.geojson   # 手繪教學示意幾何（可以手改）
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ build-species.mjs      # GBIF → public/data/species
├─ build-geodata.mjs      # NLSC / Natural Earth / USGS / 水利署 / OSM / 文資局 → public/data/geo
├─ build-geo-content.mjs  # src/content/geo → public/data/geo-content（純本地轉換，不打 API）
├─ build-reservoirs.mjs   # 水利署水庫水情 → public/data/reservoirs-live.json
├─ lib/geo-content.mjs    # 分片的產生邏輯（產生器與驗證器共用同一份，才比對得起來）
├─ lib/simplify.mjs       # 自帶的 Douglas–Peucker（刻意不加依賴）
├─ lib/unzip.mjs          # 自帶的 ZIP 讀取器（zlib.inflateRaw；檔名會判 Big5，見上）
├─ lib/gml.mjs            # NLSC 行政區界線 GML + TGOS SimpleWFS 兩種 GML 2 形狀
├─ lib/kml.mjs            # 水利署水庫蓄水範圍 KML 的剖析器（同樣只認得那一種）
├─ lib/shp.mjs            # shapefile 讀取器，只支援多邊形。**兩組慣例並存**：
│                         #   readShapefileZip()（.shp/.dbf/.prj/.cpg，已反轉＋已投影）供保護區用
│                         #   parseShpPolygons()/parseDbf()（原始 TM2 座標）專供 tw-basins
├─ lib/twd97.mjs          # TWD97 TM2 → WGS84（中央子午線 121/119/117 由 .prj 決定）
├─ lib/plates.mjs        # 板塊與板塊邊界的存取層（10 MB step 檔的快取 fetchSteps、
│                         #   串接 mergeStepRuns、跨 ±180 檢查、球面面積與長度）。
│                         #   ⚠️ 中洋脊（世界櫥窗）只取 STEPCLASS === "OSR"，不含大陸裂谷
├─ lib/dissolve.mjs       # 有向邊相消的多邊形聯集（分區圖 → 園區範圍）
├─ lib/csv.mjs            # CSV 剖析器（水庫與國家公園索引共用）
├─ lib/protected-areas.mjs # 國家公園與保護區四個資料集的存取層
├─ lib/reservoirs.mjs     # 水利署開放資料的共用存取層（CSV 剖析、bot 防護、id 對照表）
├─ lib/monuments.mjs      # 文資局古蹟的存取層（經緯度顛倒修正、名稱前綴剝除、縣市分片）
├─ lib/quakes-major.mjs   # 氣象署〈災害地震〉表的剖析（＋2023 年後補錄的人工抄錄表）
├─ lib/faults.mjs         # 活動斷層的存取層（地質雲端點**含 `?all=true`**、37 條的 id 對照表、筆數檢查）
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
