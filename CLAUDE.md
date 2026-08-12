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
| 臺灣縣市界線 | `data.gov.tw/api/v2/rest/dataset/7442` → TGOS 的 GML zip（內政部國土測繪中心） | **只在建置期呼叫**，政府資料開放授權條款第 1 版 |
| 世界行政區／河流幾何 | `raw.githubusercontent.com/nvkelso/natural-earth-vector`（Natural Earth） | **只在建置期呼叫**，public domain |
| 地震目錄 | `earthquake.usgs.gov/fdsnws/event/1/query`（USGS） | **只在建置期呼叫**，免金鑰、`ACAO: *` |
| 水庫基本資料／水庫水情 | `opendata.wra.gov.tw/api/v2/…?format=CSV`（經濟部水利署） | **只在建置期呼叫**。⚠️ **沒有 CORS 標頭**（瀏覽器一定抓不到），而且掛著 bot 防護，見下 |
| 水庫蓄水範圍 | `gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=ressub&filetype=KML` | **只在建置期呼叫**，約 38 MB 的 KML，只用來算形心 |
| 河川(支流) 幾何 | `gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=RIVERLIN&filetype=SHP` | **只在建置期呼叫**，SHP（zip 包 .shp+.dbf），座標系統 TWD97/TM2 zone 121，見下 |
| 河川流域範圍圖 | `gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=BASIN&filetype=SHP` | **只在建置期呼叫**，SHP（面），同樣 TWD97/TM2 zone 121，見下 |
| 河川長度／流域面積 | `www.wra.gov.tw/cp.aspx?n=3163&dn=3164`（經濟部水利署） | 沒有開放資料 API，人工抄錄進 `scripts/lib/rivers.mjs` 的 `RIVER_FACTS` |
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

### 水庫資料為什麼拆成兩個檔案

水庫有兩種更新頻率差了四個數量級的資料，所以拆開：

| 檔案 | 內容 | 誰產生 | 多久變一次 |
|---|---|---|---|
| `public/data/geo/tw-reservoirs.geojson` | 位置、有效容量、壩型、壩高、集水面積 | `npm run build:geodata` | 一年 |
| `public/data/reservoirs-live.json` | 蓄水量、水位、進出流量、集水區降雨 | `npm run build:reservoirs` | 一小時 |

兩份都 commit 進 repo，由 `registry/resolve.ts` 的 `derived: "tw-reservoirs"` 在瀏覽器端 join（key 是本站的水庫 id）。把會變的那一半混進 geojson，等於每小時要重新 commit 一份 20 KB 的幾何。

**「即時」的實際更新頻率＝重新部署的頻率。** 純靜態站不能在執行期打水利署 API（沒有 CORS），所以 `.github/workflows/deploy.yml` 加了 `schedule: cron "17 */6 * * *"`，每 6 小時重新抓一次並重新部署。那個步驟是 `continue-on-error: true`：repo 裡已經有一份快照當 fallback，上游掛掉時正確的行為是沿用舊資料繼續部署，而不是讓整個網站發不出去。**因此 `ReservoirCard` 一定要顯示觀測時間**，使用者才看得出自己在看多舊的東西——比照 GBIF 與 ERA5 的既有承諾。

#### ⚠️ 上游的 bot 防護會回 HTTP 200

`opendata.wra.gov.tw` 前面掛著 F5 的 JS 挑戰。被攔下來時回的是一頁 `bobcmn`/`TSPD` 的 HTML，**狀態碼仍然是 200**，所以只看狀態碼的退避重試完全不會重試，而 CSV 剖析器會把那頁 HTML 當成一欄叫 `<!DOCTYPE html>` 的資料表安靜吃下去、產出 0 筆水庫。`lib/reservoirs.mjs` 因此做了兩件事：只用 `format=CSV`（`format=JSON` 幾乎必中挑戰），以及把 `assertNotChallenge()` **包在重試迴圈裡面**。

#### 其他實測過的坑

- **收錄範圍是「基本資料」的 40 座公告水庫，不是「今天查得到水情的那幾座」。** 以水情當篩選條件時產出 33 筆，白河、虎頭埤、谷關這些課本會提到的水庫剛好當天沒回報就整座消失了——一份 commit 進 repo 的靜態檔案，內容不該取決於產生它的那一小時上游剛好回了什麼。缺水情的水庫在卡片上顯示「暫無即時資料」。
- **`percent` 缺值時不可以寫成 `null` 塞進 properties**：算繪用的 `["has", "percent"]` 會判成 true，於是「暫無資料」被畫成 0%——把資料缺漏謊報成水庫見底。`resolve.ts` 只在真的有值時才寫這個屬性。
- **蓄水率不夾在 100% 以下。** 滿庫溢流時上游本來就會給出 100 以上的值（實測寶山第二 105.9%）。夾住等於竄改資料；要夾的是長條的寬度與顏色級距，不是數字本身。
- **集集攔河堰、石岡壩、直潭壩是引水設施不是蓄水設施**，蓄水率天生偏低（實測 19.9%／24.2%）。`ReservoirCard` 依**名稱結尾是不是「壩」或「堰」**顯示警語——那是官方命名本身的線索，比另外維護一份清單可靠。阿公店水庫排砂期間也會刻意維持低水位（實測 0.7%），圖層說明有交代「低不一定代表缺水」。
- **上游的文字欄位內含換行**（石門的鄉鎮是 `"桃園市龍潭區、\n大溪區、復興區"`），那是排版斷行不是剖析錯誤，`lib/reservoirs.mjs` 的 `clean()` 會整個刪掉空白（不是併成空格——這些欄位全是中文，頓號後面多一格很醜）。
- **KML 的座標高度是科學記號**（`…,-1.599837560206652e-005`），數字的正規表示式少了 `[eE][-+]?\d+` 會讓**每一個** token 都判成格式錯誤（實測 491/491）。
- **形心用面積加權（shoelace），不是 bbox 中心**：水庫是狹長的樹枝狀，bbox 中心經常落在水體外面的山坡上（實測石門、曾文都是），而那個點會被拿去當「點一下飛過去」的目標。

### 河川資料：SHP、投影，以及「同名不同河」的坑

臺灣主要河川（24 條中央管河川 + 淡水河、磺溪共 26 條，水利署官方定義）的幾何跟水庫一樣拆成兩份互不相干的來源，理由也一樣——各缺一半：

- **幾何**：水利地理資訊服務平台「河川(支流)」SHP（`RIVERLIN`），只有中文名，沒有長度／流域面積。
- **長度／流域面積**：水利署官網〈河川長度〉頁面的官方表格，沒有開放資料 API，人工抄進 `scripts/lib/rivers.mjs` 的 `RIVER_FACTS`（比照 `RESERVOIR_IDS`／`COUNTY_IDS` 寫死對照表的既有作法）。

#### ⚠️ 這份 SHP 沒有 GML／KML，得自己讀二進位格式

水利地理資訊服務平台對「河川(支流)」只給 SHP，沒有 GML 或 KML 可以走正規表示式（開發機也沒有 GDAL）。`scripts/lib/shp.mjs` 因此自己刻了最小的 `.shp`（PolyLine，type 3）與 `.dbf`（dBase III，只認 Character 欄位）讀取器，比照 `lib/gml.mjs`／`lib/kml.mjs`／`lib/unzip.mjs` 一貫的免依賴原則。

**座標系統也跟以前不一樣**：這份 SHP 的 `.prj` 寫的是 `TWD97_TM2_zone_121`（EPSG:3826）——**投影坐標**，單位是公尺，不是縣市界／水庫那份 TWD97 地理坐標（EPSG:3824，度，可以直接當 WGS84 用）。`scripts/lib/twd97.mjs` 因此另外實作了反算橫麥卡托（inverse Transverse Mercator，GRS80 橢球），已用 round-trip 測試驗證（正算已知座標再反算回來，四個測試點誤差在 1e-8 度以下），並用 RIVERLIN 自己的 bbox 四角反算出北緯 21.9°–25.3°、東經 120.05°–122.0° 做過合理性檢查——跟臺灣本島＋周邊離島的實際範圍相符。**升級或更換這份圖資時要重新用同一組測試點驗證投影公式沒有錯位**（座標系統選錯不會報錯，只會讓河川全部畫到海裡）。

#### ⚠️ RIVERLIN 是依「名稱字串」分筆，不是依「實際河川」分筆

實測踩過最大的坑：這份 2000–2008 年數化的圖資裡，同一個河川名稱在全國各地被獨立當成地名重複使用（例如「頭前溪」在新竹是知名大河，但其他鄉鎮的小溝渠也叫這個名字），這些互不相連、有時相隔上百公里的線段全部塞進同一筆 record 的 parts 裡——「北港溪」一筆記錄的所有 parts 疊起來，bounding box 對角線量到超過 200 公里，而北港溪本身只有 82 公里長。**直接把一筆 record 的幾何當成一條河川畫出來，會畫出一條從新竹跳到南投再跳到屏東的假河川，而且沒有任何錯誤訊息。**

解法是 `lib/shp.mjs` 的 `clusterParts()`：把同一筆 record 的 parts 依空間鄰近程度分群（bounding box 重疊 + 2 公里緩衝——這個距離夠橋接同一條河在交會點附近的數化斷點，又不會誤併相隔數公里以上的不相關同名小溪），`build-geodata.mjs` 的 transform 再取總長度最長的那一群，視為這個名稱底下真正的主要河川。比對階段除了精確符合官方名稱，也會把 RIVERLIN 裡「名稱(別名)」的括號變體（例如「烏溪(大肚溪)」「和平溪(大濁水溪)」）一併收進來源池再分群，因為官方河川常常在下游改稱別名。

**⚠️ 即使做了以上兩步，仍有約 11 條河川（烏溪、高屏溪、淡水河、濁水溪、中港溪、後龍溪、大安溪、朴子溪、急水溪、鹽水溪、阿公店溪）的圖徵只涵蓋官方幹流長度的 10–50%。** 原因是這幾條河的官方「幹流長度」是沿著**上游改稱其他歷史／支流名稱的河段**去量的（例如淡水河的 158.7 公里實際上是沿大漢溪／新店溪這類另外命名的支流量出來的），不是簡單的名稱別名能自動接上。這是這份免費資料本身的完整度限制，不是分群邏輯的 bug——曾經評估過人工逐條研究上游別名鏈，但這是需要跨多個資料源驗證的水文研究工作，範圍遠超過「畫一張教學地圖」。目前的做法是**如實標註**：`scripts/build-geodata.mjs` 建置時會印出這份清單，對應河川的內容檔（`src/content/geo/tw-rivers/<id>.json`）多一筆「資料涵蓋」fact 說明圖上的線只是下游一小段，長度／流域面積數字仍然是官方全流域數字。**新增或替換河川圖資後要重新量測涵蓋率並更新這份清單**，不要假設分群邏輯永遠夠用。

### 流域分區：跟河川「共用清單、不共用幾何」

「流域分區」（`tw-basins`，面）是河川的姊妹圖層，回答的問題不一樣——不是「這條河流過哪裡」，是「這片山坡的雨水會流進哪條河」。**幾何完全是另一份資料**（水利地理資訊服務平台的「河川流域範圍圖」，BASIN，面），不是從河川線算出來的：集水區範圍需要真正的水文測繪（分水嶺、地表逕流方向），不是幾何運算能從一條線推出面。

**真正共用的是「這個官方河川叫什麼名字、對應本站哪個 id」這件事**，寫在 `scripts/lib/rivers.mjs` 裡：`tw-basins` 的 id 對照表（`BASIN_IDS`）直接從 `RIVER_IDS` 衍生（把 `-river` 尾綴換成 `-basin`，不是另外手動輸入 26 筆），長度／流域面積的官方數字（`RIVER_FACTS`）也是同一份。這才是使用者問「能不能跟河川資料合併」時真正該合併的部分——兩層各自的幾何抓取／剖析邏輯完全獨立（不同 SHP、不同 shape type），但「26 個官方河川是誰、面積是多少」只維護一份，不會有兩個地方各自對到不同的數字。

**⚠️ 兩層的 id 刻意不共用**（`gaoping-river` vs `gaoping-basin`），即使兩者指的是同一條河。這不是隨手加的尾綴：「主要河川」跟「流域分區」是兩個各自獨立可勾選的圖層，不是像五大山脈→主峰那種父子 `attach` 關係，如果共用同一個 id，選取其中一層會不會意外連動強調另一層（透過 `highlightIds` 的 Set 比對）沒有測過、行為未定義。用不同尾綴把兩個 id 命名空間分開，讓行為可預測——跟 `RIVER_IDS` 當初為了不跟水庫 id 撞名而加 `-river` 尾綴，是同一個理由。

**BASIN 這份資料本身乾淨很多，不需要 RIVERLIN 那套分群邏輯**：143 筆 record 裡，26 個官方河川名稱各自剛好對到一筆**單一環、無孔洞**的多邊形（`build-geodata.mjs` 的 transform 會在遇到多環時直接丟例外，不猜哪個環是洞），面積跟官方數字的誤差多在 10% 以內（濁水溪 3167.5 vs 官方 3157 km²、淡水河 2733.9 vs 2726、卑南溪 1605.2 vs 1603）。精確比對名稱就夠了，沒有 RIVERLIN 那種「同名不同河」的問題。

顏色沿用 `hydrology`（水系藍），跟河川線同色：面／線是已經一起驗證過的色票（見「顏色」一節的「線／面三色」），這裡刻意不挑另一個顏色——半透明面跟細線是不同的視覺通道，同色反而強化「這是同一個水系家族」的語意，跟縣市界橘、山脈洋紅維持區隔。

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
11. **不得在執行期呼叫水利署的 API。** 那個端點沒有 CORS 標頭，瀏覽器一定抓不到；水庫資料一律走 build-time 產製。
12. **不得手動編輯 `public/data/reservoirs-live.json` 與 `public/data/geo/tw-reservoirs.geojson`。** 由 `npm run build:reservoirs` 與 `npm run build:geodata` 產生。
13. **不得憑感覺挑主題圖層的顏色。** 改動或新增 `src/map/thematicColors.ts` 的顏色前，必須重新用 dataviz skill 的 `scripts/validate_palette.js`（`--pairs all`，因為主題圖層是可任意複選的核取方塊，不能只驗證清單裡「相鄰」的顏色）驗證明暗兩模式，理由與已驗證過的組合見該檔案的註解。

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
| `tw-reservoirs-points` | circle（顏色是**依蓄水率分級的表達式**，不是單一色，見下） |
| `tw-rivers-line` / `tw-rivers-label` | line + symbol |
| `tw-basins-fill` / `tw-basins-outline` | fill + line |

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
| 臺灣地理 | `/theme/taiwan` | 行政區、地形、水系（含水庫即時水情）、人文（原住民族）、植被生態（特有種）、農業物產 |
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

### 附屬圖層（`attach`）：跟 `items` 不是同一件事

`attach` 是「這個圖層還有一種**不同幾何**的附屬圖徵」——五大山脈的稜線是線、主峰是點，一條線配一顆點。它**沒有自己的核取方塊**，跟母圖層一起開關、一起移除，並在可點清單裡巢狀排在各自的母圖徵底下。

不要跟 `items` 搞混：`items` 是 N 個**平行**的子圖層（各自有色票與 `maxActive` 上限），`attach` 是一個母子關係。也不要退回成兩個獨立圖層：主峰離開稜線就沒有意義，分成兩個核取方塊會讓人勾了山脈卻看不到最高點在哪。也不要把點塞進 `tw-ranges.geojson` 混合幾何——`LayerRender` 一個圖層只能一種幾何，而且主峰的詳情卡是 `PlaceCard`（有海拔與氣候圖表），跟山脈的 `FeatureCard` 不同，`detail` 必須分開。

**資料是 join 出來的，不是抄的。** `{ type: "derived", derived: "tw-range-peaks" }` 由 `resolve.ts` 把兩份既有的單一事實來源接起來：座標取自 `src/content/places`、「哪座山峰屬於哪條山脈」取自 `tw-ranges.geojson` 的 `peakId`。所以 5 座主峰的座標與歸屬各自只有一份，不會漂開。它跟山脈線圖層共用 `resolveLayerData` 的同一個快取項目，實測 `tw-ranges.geojson` 只抓一次。

目前有兩組：**五大山脈 → 主峰**、**縣市界 → 縣市政府**。

**附屬點一律沿用 `place` 藍，不是母圖層的顏色——這是被色票驗證逼出來的，不是隨手選。** POINT 色票（藍／紅／青／黃／紫）已經是 all-pairs 全過的飽和狀態，把山脈洋紅 `#c23f8f` 加進去，它跟原住民族紅 `#e34948` 的**一般視覺 ΔE 只有 13.0（hard FAIL）**，而驗證器明講這一項不能用次要編碼豁免；紫 `#7a3fa6`、棕 `#8a5a2b`、青綠 `#00857a`、橘褐 `#b06a00` 也全部 FAIL（撞紫／撞紅／彩度不足）。縣市界橘 `#d95926` 更糟，對原住民族紅只有 **5.1**（CVD 2.7）。藍在語意上是一致的：「藍點＝地圖上一個有詳情卡的地點」。**要動這個顏色請先重跑 `validate_palette.js --pairs all` 明暗兩模式。**

⚠️ **附屬圖層的 min/maxzoom 不會從母圖層繼承，要自己宣告。** 母圖層的縮放範圍講的是**它自己那份幾何**的限制：縣市界的 `maxzoom: 11` 是因為相鄰的面各自簡化會開出次像素縫隙——那條理由對「政府大樓的一個點」完全不成立。

踩過一次而且症狀很難認：政府點繼承了 maxzoom 11，清單的 `browse.zoom` 卻是 14，於是點一下縣市政府就飛到**完全空白**的畫面（政府點與縣市面同時都在 maxzoom 之外），而詳情卡、相機、`getPaintProperty` 全都正常。**只驗 paint 表達式是抓不到的**，一定要在**飛完之後**用 `queryRenderedFeatures` 數實際算繪的數量。`validate-content.mjs` 現在會擋住 `browse.zoom` 落在 `[minzoom, maxzoom)` 之外（圖層與附屬圖層都檢查）。

`browse.zoom` 也要考慮**母圖徵看不看得見**：縣市政府設 10 而不是街廓尺度的 14，是因為這一層的教學重點是「政府設在這個縣市的哪裡」，取景必須讓政府點與所屬縣市的面同時在畫面上，而縣市面的 maxzoom 是 11。

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

### ⚠️ 點擊仲裁不可以交給 maplibre 的派送順序

`originalEvent` 那個去重只在**同一組**圖層內有效。**不同 instance 之間也會互相蓋到**，而 `map.on(type, layerId, …)` 是依**監聽註冊順序**派送的——註冊順序只是「使用者先勾了哪個圖層」的意外結果（`useGeoLayers` 的 Effect 1 只替新出現的 instance 補綁，不會重排既有的）。

實測踩過：地形景點 `defaultOn`、縣市界後來才勾，於是縣市的 handler 最後跑、它的 `setSelected` 蓋掉山峰的——**點玉山主峰開出的是南投縣的卡片，五大山脈的主峰等於完全點不到**。而且圖層堆疊順序是對的（`places-points` 確實在 `tw-counties-fill` 之上），所以查 `layerOrder` 完全查不出問題。

修法是 `geo.ts` 的 `isTopmostHit()`：每次點擊現查 `queryRenderedFeatures`，規則是「**小目標優先，其餘照算繪順序**」。

- **命中的圓點優先**，即使它不是最上面那一層。圓點半徑只有 6–7 px，沿線標註的命中範圍卻是整個文字方塊。實測「阿里山山脈」的標註剛好蓋住大塔山，純照算繪順序那座山峰一樣點不到——而標註畫在點之上是 `layerOrder.ts` 的既定設計，不能為了這件事去動堆疊。線、標註與面在別的地方都還有一大片可以點，那顆點沒有別的地方可以點。
- 否則取 `queryRenderedFeatures` 的第一筆（畫在最上面的）。

兩個實作細節不要拿掉：**競爭圖層清單要用 ref**（已綁好的 instance 不會重綁，得讀得到之後才勾選的圖層），**查詢前要用 `map.getLayer()` 濾掉不存在的 id**（切底圖的瞬間圖層是真的不存在的，混進去 maplibre 會報錯）。

### 顏色

`src/map/thematicColors.ts` 是唯一的顏色來源。策略是**三組獨立色票**（`POINT` / `LINE` / `FILL`），各自**組內** all-pairs 驗證即可——形狀本身就在區辨（18% 透明度的面染跟 6px 圓點是不同的視覺通道），跨幾何的配對不需要驗證。每組再用 `MAX_ACTIVE_BY_KIND`（circle 4 / line 3 / fill 2）封頂，需求才維持在可解範圍。

已驗證：地形景點藍 `#2a78d6` + 原住民族紅 `#e34948`；物種三色青／黃／紫；線／面三色 水系藍 `#2a78d6` + 行政區橘 `#d95926` + 山脈洋紅 `#c23f8f`（`--pairs all`，明暗兩模式全數 PASS，CVD 最差 ΔE 12.3、一般視覺最差 ΔE 16.7）。

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

`reference`（緯度參考線）與 `hazard`（地震帶）是**非分類的固定角色**，比照 hillshade 的棕色，刻意排除在色票驗證之外。地震帶尤其不該給分類色相：2800 個依震級縮放的點是**密度場**，教學內容是「地震帶沿板塊邊緣浮現」，不是「這個色相代表地震」；給它色相不但擠爆色票驗證，2800 個不透明白框圓點在投影機上也只是一坨糊的（所以 `strokeWidth: 0` 必須是可設定的）。

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

手繪示意幾何（洋流、氣候帶、風系）一定要標 `schematic: true`，UI 才會顯示「教學示意圖，非精確界線」的警語——這是內容誠信的承諾，比照 GBIF 觀測點與 ERA5 氣候值的既有做法。

### 已知資料限制

- **⚠️ 臺灣縣市界不要改回 Natural Earth。** NE 10m 整份資料集裡都沒有連江縣（馬祖），只有 21 個縣市——而馬祖正是課本講離島時一定會點名的地方。現在改用內政部國土測繪中心的實測界線（政府資料開放平臺 dataset **7442**），22 個縣市齊全、中文名原生就是課綱用的「臺」字寫法、每半年更新。

  代價是格式：政府資料開放平臺只提供 **SHP 與 GML**，沒有 GeoJSON。SHP 要 `ogr2ogr`（得先裝 GDAL），所以走 GML——它是純文字 XML，`scripts/lib/unzip.mjs`（zlib.inflateRaw 自幹的 ZIP 讀取器）+ `scripts/lib/gml.mjs`（只認得 NLSC 那一種 GML 2 形狀的剖析器）兩個免依賴小模組就處理完了，比照 `lib/simplify.mjs` 不加依賴的既有作法。

  **下載網址是查出來的，不是寫死的**：TGOS 的檔名帶發布日期（`COUNTY_MOI_1140318_.zip`），改版後舊網址會消失，所以 `resolveDataGovTwUrl()` 先打 data.gov.tw 的 metadata API 拿當下的網址。

- **縣市 id 由 `COUNTY_IDS` 對照表寫死，不是 slugify 出來的。** NLSC 的 GML 只有「名稱」一個屬性（COUNTYCODE 只在 SHP 版裡），而這些 id（`tw-tpe`／`tw-lie`…，ISO 3166-2:TW）是內容檔的檔名與圖徵強調用的 key，必須跨資料源改版保持穩定。對不到就讓建置失敗——縣市改名是重大行政變更，該由人決定新 id。

- **官方界線包含遠洋離島，這是對的，不要當成髒資料刪掉。** 東沙群島與南沙太平島屬高雄市、釣魚臺列嶼屬宜蘭縣、烏坵屬金門縣、彭佳嶼屬基隆市——都是課綱會提到的行政事實，已實測五個都有算繪出來。

  但它們會**撐爆 `fitBounds`**：高雄市的外接矩形從 1.0° 變成 **13.1°**，點一下「高雄市」相機會飛到整個南海。解法在 `bboxOf()`（`src/map/layers/geo.ts`）的 `MIN_FRAMED_PART_RATIO`：取景時忽略面積小於同圖徵最大塊 **1%** 的 polygon，**幾何本身完整保留**。用相對比例而不是絕對面積，才不會拆掉本來就由許多小島組成的縣市——實測 1% 之下澎湖 21 島、連江 11 島、雲林外傘頂洲、臺東蘭嶼全數保留，而 **2% 就會開始吃掉外傘頂洲與蘭嶼**。只對 MultiPolygon 生效，線與點不受影響。

- **面積小於 0.11 km² 的礁岩在建置期就濾掉了**（`MIN_ISLAND_AREA`）。NLSC 收了每一塊礁岩——澎湖 296 個、連江 183 個 polygon，佔掉檔案六成，而它們在 `maxzoom: 11` 之下全都小於一個像素。⚠️ 這個過濾**必須在簡化之前**做：Douglas–Peucker 不會刪掉整個環（少於 4 點就還原成原始環），指望容差幫忙是沒有用的。

- **geojson 的 feature 順序就是圖層抽屜裡可點清單的顯示順序。** `LayerBrowseList` 直接照 `data.features` 算繪、**刻意不排序**——共用元件不該知道哪個圖層該怎麼排，排序規則跟著資料集走。縣市界排成**由北到南、離島（連江→金門→澎湖）整組最後**，在 `build-geodata.mjs` 的 transform 裡做掉，上游 GML 的順序是任意的。

  南北用**主體（面積最大那一塊）的面形心緯度**，不是最北端：高雄市一路往北延伸到那瑪夏（23.47°N）比臺南市的最北端還北，依最北端排會排出「高雄在臺南前面」這種一看就錯的順序。離島另外分一組也是同樣的道理——純依緯度排，連江縣（26.2°N）會跳到基隆市前面、金門縣會插在苗栗與臺中之間，把「由北到南」這條線索攔腰截斷。

- **官方連結走既有的 `sources` 機制，不要另外開一個欄位。** 22 個縣市政府的官網同時是「這筆資料的出處」與「使用者想點進去的官方連結」，`SourceLinks` 本來就會把 `src/content/sourceLinks.ts` 認得的來源名稱渲染成連結，所以內容檔寫 `sources: ["維基百科", "嘉義縣政府"]` 就同時滿足兩件事。

  **新增外部連結前要實測它活著。** 22 個官網實測結果：19 個直接回 200；新北、桃園要帶瀏覽器 User-Agent 才回 200（WAF 擋 curl）；雲林在 Cloudflare 人機驗證後面，自動化一律 403 但網址是對的。維基百科的資訊框**沒有填南投縣政府的網站**，那一筆是另外補的官方網域。

- **22 份縣市說明的數字全部來自內政部戶政司開放資料，不是抄維基百科的。** 面積、人口、人口密度、行政區數都由 data.gov.tw 資料集 **8410「各鄉鎮市區人口密度」**（114 年底）的鄉鎮市區列聚合而來。⚠️ 那份 CSV 的**東沙群島與南沙群島兩列人口是「…」**，要濾掉才不會讓 `int()` 爆掉，也才不會把它們的面積算進高雄市。

  **實際比對過維基百科**：面積 21 個縣市完全相同，只有高雄市差 0.27 km²（官方聚合 2,952.12／維基 2,951.85）；人口全部不同，因為維基是 2026 年 6 月而開放資料是 114 年底。兩者衝突時**一律以官方開放資料為準**，並在 `sources` 用帶年份的名稱（`內政部戶政司 114年各鄉鎮市區人口密度`）讓讀者知道是哪一版。維基百科只用來查地形、沿革、島嶼數這類非數值的敘述性事實。

  ⚠️ **寫「唯一」「最」這類敘述前先用資料算一遍。** 初稿寫過「屏東縣是全臺唯一整個轄區都在熱帶的縣市」，實際用 geojson 的 bbox 對 23.43655°N 檢查才發現**臺南市也是**（最北 23.413）。同樣被算過的還有：面積最小是連江縣 28.8 km²（本島最小是嘉義市 60.0）、人口密度最低是臺東縣、最高是臺北市、彰化縣是所有「縣」裡密度最高的。

- **縣市界的簡化容差是 0.0008°（≈89 公尺），不是別的圖層那個 0.0005°。** NLSC 原始資料有 33 萬個點，不簡化是 570 KB；0.0008 落在 192 KB，在 maxzoom 11 約 1.3 px、在實際教學會用的 zoom 7–10 都是次像素。這個檔案會被搜尋索引 lazy 抓取，一個班 30 個學生同時開站時的成本是選它的主要理由。
- **Natural Earth 的河流沒有中文名欄位**，中文名靠 `build-geodata.mjs` 裡的 `RIVER_NAMES_ZH` 對照表。對不到就沿用原名。注意 NE 把黃河的 name 寫成 `"Huang"`（不是 `"Huang He"`）。
- **相鄰的面各自簡化會在共用邊界開出次像素縫隙**（Douglas–Peucker 不保拓樸）。免依賴的緩解方式是設 `maxzoom`（縣市界設 11），讓它在縫隙變得可解析之前就停止繪製。
- **五大山脈的稜線是手繪示意幾何**（`public/data/geo-manual/tw-ranges.geojson`）。山脈沒有像行政區那樣的官方界線圖資，Natural Earth 也沒收錄，所以走向與端點是依維基百科各條目與地形圖描繪的。圖層與五份內容檔都標了 `schematic: true`，UI 會顯示警語。**不要把它當成精確稜線**；要真的精確得改用 DEM 推導分水嶺。（已離線量過五座主峰到所屬稜線的最短距離：0～2.2 km，走向本身站得住腳。）
- **⚠️ 中央山脈的長度刻意寫「約 340 公里」，不要照維基百科改成 500 公里。** 維基百科中文版寫的是「全長約500公里」，但課本與國土測繪中心慣用的是 340 公里（蘇澳到鵝鑾鼻），這是學生會考的數字，而本站是課程用途。這個差異是知道之後刻意選的，不是漏改——要動它請先確認課綱怎麼寫。
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
npm run build:reservoirs # 產生水庫即時水情（每次都重抓，CI 也會跑，見「部署」）
npm run build:geodata   # 產生行政區/河流/地震/水庫 geojson（已存在會跳過）
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
   - ⚠️ **點預設組合與換下拉選單之後，`a`／`b` 必須真的出現在網址上**，而且下面的地點選單、hint、氣候圖表要跟著換成新的那一組。這裡踩過一次：`jumpTo` 會同步觸發 `handleCamera` 寫網址，它拿到的 `prev` 是**還沒有 a/b 的快照**，所以「先寫網址再飛」會把 a/b 洗掉——兩張地圖飛對了位置，但下面的圖表還是舊的那一組，圖表與地圖對不起來。修法是**先飛、網址最後寫**（見 `ComparePage` 的 `applyPreset`／`selectPlace`）
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

    ⚠️ **臺灣主題的 `defaultOn` 是「五大山脈」，不是「地形景點」。** 這個主題的 `initialSelection` 是玉山主峰、`camera` 也開在玉山，主峰現在住在五大山脈底下——換掉預設開啟的圖層，進站第一眼就會變成「詳情卡在講玉山主峰，地圖上卻沒有任何圖徵」。

    ⚠️ **`src/content/places/taipei.json` 不可以刪。** 它同時被 `/compare` 的「臺北 ↔ 開羅」預設組合使用，刪掉會讓比較頁那一組壞掉。改動 `src/content/places/` 之後要順手開 `/compare` 點一次那個組合確認（下拉選單要顯示「臺北（25.0°N）」與「開羅（30.0°N）」、四張圖表都在）。

    ⚠️ **`src/content/places/` 新增一筆地點，就會同時改動三個地方**：地形景點圖層、`/compare` 的兩個下拉選單、主題頁搜尋索引。所以新增後 `npm run build:climate` 是必須的——`/compare` 選到一個沒有氣候 JSON 的地點會得到空圖表，而 `npm run validate` **不會**擋（climate 驗證只檢查「有 JSON 的必須對得到地點」，反向不檢查）。

15. **水庫即時水情**（`/theme/taiwan`，勾「主要水庫與即時水情」）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [120.9, 23.6], zoom: 7.3 });
    m.queryRenderedFeatures({ layers: ['tw-reservoirs-points'] }).length   // 40（不是 33）
    // 顏色一定要是「先問 has、再 step」的表達式，缺水情的水庫走 nodata 灰
    m.getPaintProperty('tw-reservoirs-points', 'circle-color')
    // 缺水情的 7 座：percent 必須是 undefined，不能是 null
    m.queryRenderedFeatures({ layers: ['tw-reservoirs-points'] })
      .filter(f => f.properties.percent === undefined).map(f => f.properties.name)
    ```
    - 點曾文水庫 → 卡片有蓄水率長條、蓄水量／容量、水位、進出流量、**觀測時間**
    - 點白河水庫（常態缺水情）→ 卡片顯示「暫無即時資料」而不是 0%
    - 點集集攔河堰 → 卡片底部出現「這是攔河堰／壩」的警語
    - 圖例底下要有四段色階 + 「暫無資料」灰：`document.querySelectorAll('.map-legend-ramp-step').length // 5`
    - 切底圖之後重驗一次（ramp 表達式是 `reapply` 時重建的）
    - ⚠️ 搜尋索引現在會多抓 `tw-reservoirs.geojson`(20 KB) 與 `reservoirs-live.json`(8 KB)，
      驗第 12 項的 Network 期望值時要把這兩個算進去
16. **主要河川**（`/theme/taiwan`，勾「主要河川」）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [120.9, 23.6], zoom: 7.3 });
    new Set(m.queryRenderedFeatures({ layers: ['tw-rivers-line'] }).map(f => f.properties.id)).size  // 26
    m.getPaintProperty('tw-rivers-line', 'line-color')   // 水系藍 #2a78d6（colorRole: hydrology）
    ```
    - 點濁水溪（或任一河川）→ 卡片有幹流長度／流域面積／分類、發源地、出海口
    - 點烏溪／高屏溪／淡水河這類「資料涵蓋」不完整的河川 → 卡片多一筆說明圖上只是下游一小段
    - 切底圖之後重驗一次存在與排序（見上面關鍵坑二那組指令，把 `tw-rivers-line` 也加進 `at()` 檢查）
    - ⚠️ 這份圖資是**依名稱字串分筆，不是依實際河川分筆**（見 CLAUDE.md「河川資料」那節）：
      如果重新用 `--force` 重抓 RIVERLIN，一定要重新量測每條河川的 `coverageRatio`，
      不能假設 `clusterParts()` 的 2 公里緩衝永遠選得到正確的那一群
17. **流域分區**（`/theme/taiwan`，勾「流域分區」，可以跟「主要河川」同時勾）：
    ```js
    const m = window.__gaiaMaps.at(-1);
    m.jumpTo({ center: [120.9, 23.6], zoom: 7.3 });
    new Set(m.queryRenderedFeatures({ layers: ['tw-basins-fill'] }).map(f => f.properties.id)).size  // 26
    m.getPaintProperty('tw-basins-fill', 'fill-color')   // 水系藍 #2a78d6，跟河川線同色（刻意的，見說明）
    ```
    - 點任一流域的面 → 卡片有流域面積／分類／對應河川、涵蓋縣市
    - 同時勾兩層時，點擊仲裁要照「小目標優先、其餘照算繪順序」：圓點 > 線 > 面，
      面被同座標的河川線蓋住是正常的，不是 bug
    - ⚠️ `tw-basins` 跟 `tw-rivers` 的 id **刻意不共用**（`gaoping-basin` vs `gaoping-river`）：
      選一條河的線，不應該連動強調它的流域面（反之亦然）——這是特意分開 id 命名空間的結果，
      不要為了「兩個都亮」去改成共用 id，那個行為沒有測過

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
   ├─ ReservoirCard.tsx   # 水庫詳情卡（即時水情長條 + 基本資料，資料全來自 geojson）
   └─ PlaceCard/IndigenousCard/SpeciesCard/FeatureCard/LayerPanel/MapLegend…
public/data/
├─ reservoirs-live.json   # build:reservoirs 產生（禁止手改，每次部署重抓）
├─ climate/*.json         # build:climate 產生
├─ species/*.geojson      # build:species 產生
├─ geo/*.geojson          # build:geodata 產生（禁止手改）
└─ geo-manual/*.geojson   # 手繪教學示意幾何（可以手改）
scripts/
├─ build-climate.mjs      # Open-Meteo → public/data/climate
├─ build-species.mjs      # GBIF → public/data/species
├─ build-geodata.mjs      # NLSC / Natural Earth / USGS / 水利署 → public/data/geo
├─ build-reservoirs.mjs   # 水利署水庫水情 → public/data/reservoirs-live.json
├─ lib/simplify.mjs       # 自帶的 Douglas–Peucker（刻意不加依賴）
├─ lib/unzip.mjs          # 自帶的 ZIP 讀取器（zlib.inflateRaw，同樣不加依賴）
├─ lib/gml.mjs            # NLSC 行政區界線 GML 的剖析器（只認得那一種形狀）
├─ lib/kml.mjs            # 水利署水庫蓄水範圍 KML 的剖析器（同樣只認得那一種）
├─ lib/shp.mjs            # RIVERLIN 的 SHP/DBF 讀取器 + 同名河川的空間分群 clusterParts()
├─ lib/twd97.mjs          # TWD97/TM2 zone 121（EPSG:3826）→ WGS84 的反算橫麥卡托
├─ lib/reservoirs.mjs     # 水利署開放資料的共用存取層（CSV 剖析、bot 防護、id 對照表）
├─ lib/rivers.mjs         # 河川／流域 id 對照表（BASIN_IDS 從 RIVER_IDS 衍生）+ 官方長度／流域面積（RIVER_FACTS）
├─ lib/fetch-retry.mjs    # 指數退避的 fetch，兩支 build 腳本共用
├─ validate-content.mjs   # 建置前 schema 驗證 + 註冊表交叉檢查
└─ postbuild.mjs          # 404.html + CNAME 確認
```

`src/content/index.ts` 直接把 JSON 當成對應型別使用而不在瀏覽器端跑 zod——建置期已經驗過，不必把 zod 打包進前端。
