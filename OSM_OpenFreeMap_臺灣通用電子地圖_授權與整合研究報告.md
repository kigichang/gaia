# OpenStreetMap 圖資能否用於 OpenFreeMap 或臺灣通用電子地圖？
### 授權相容性與整合可行性研究報告

> 撰寫日期：2026-08-12 ｜ 用途：開發前的技術與法遵評估參考
> 免責聲明：本報告整理自公開條款與社群文件，非法律意見。商業產品上線前建議再向 NLSC 去函確認、或諮詢智財律師。

---

## 一、結論先行（TL;DR）

| 情境 | 可行性 | 關鍵條件 |
|---|---|---|
| OSM 資料 → OpenFreeMap（用公共實例或自架） | ✅ 完全可行 | OFM 本身就是 OSM 圖資做的；照規定顯示標示 |
| OSM 向量圖層「疊」在臺灣通用電子地圖圖磚上顯示 | ✅ 可行 | 兩者各自標示；兩層資料不互相融合 |
| 把 NLSC **Open Data 版**資料併入 OSM 衍生資料庫 | ✅ 可行但有義務 | OGDL-1.0 可再轉授權 → 與 ODbL 相容；但合併後的資料庫須以 ODbL 對外提供 |
| 把 NLSC **完整版／高解析度**圖磚拿來描繪進 OSM | ❌ 明確禁止 | 授權與 OSM 不相容，台灣社群 2025 年起嚴格取締、直接回退 |
| 把 OSM 資料交給政府併入臺灣通用電子地圖產品 | ⚠️ 實務困難 | 政府端須願意讓該衍生資料庫適用 ODbL，一般不可行 |
| 純內部系統（不對外公開）使用 OSM | ✅ 無義務 | ODbL 只規範公開散布行為 |

**一句話**：OSM → OpenFreeMap 沒有任何問題；OSM 與臺灣通用電子地圖「並列疊圖」沒有問題；真正的紅線在於**資料融合的方向**與**你用的是 NLSC 的哪一個版本**。

---

## 二、三方授權底細

### 2.1 OpenStreetMap — ODbL 1.0

OSM 資料受著作權與資料庫權保護，採 **Open Database License (ODbL)**，是一份「姓名標示 + 相同方式分享」的授權。判斷義務時只需分清三個概念：

- **產出作品（Produced Work）**：由資料算繪出來的地圖圖片、圖磚、App 畫面、印刷品。
  → 義務：**標示 OSM**（使用量達 substantial 時）。產出作品本身**不必**開放授權，可以自訂條款、可以賣錢。
- **衍生資料庫（Derivative Database）**：把 OSM 資料與其他來源**融合**後產生的新資料集（例如把外部速限欄位接到 OSM 的道路記錄上、用 OSM 路網做地理編碼後產生的成果）。
  → 義務：任何人索取時**必須以 ODbL 免費提供**該衍生資料庫（或提供產製方法）。
- **集合資料庫（Collective Database）**：OSM 與其他資料**各自獨立並存**，只是放在同一個系統／同一張地圖上。
  → 不算衍生，僅需標示清楚哪些資料來自 OSM。

重點：格式轉換（如 shp → PostGIS）屬「trivial transformation」，不產生新資料庫；純粹只用 OSM 一個來源做的線化簡、多邊形合併、路徑計算，也仍是產出作品而非衍生資料庫。

另外 OSM 明白提醒：**第三方資料的授權若與 ODbL 衝突（尤其是無法接受「衍生資料庫須免費提供」這一點），就不能拿來與 OSM 融合後對外散布**。

### 2.2 OpenFreeMap（OFM）

- 由 Hyperknot Software Kft.（匈牙利）營運，程式碼 MIT 授權；圖磚資料來自 OpenStreetMap，schema 為未改動的 OpenMapTiles，產製工具鏈為 Planetiler + MapLibre + Natural Earth + Wikidata。
- **公共實例完全免費、無圖磚請求數上限、無需註冊、無 API key、無 cookie**，靠贊助維持；另提供每週全球 Btrfs / MBTiles 下載檔，可自架。
- **標示為必要義務**：使用 MapLibre 時會自動加上；若用其他客戶端、或用於印刷品與影片，需自行加註「OpenFreeMap © OpenMapTiles Data from OpenStreetMap」，其中 OpenFreeMap 一段可省略。
- 服務條款採「as-is」無擔保、適用匈牙利法、爭議於布達佩斯仲裁——**對商業產品而言，這代表沒有 SLA**。

> 對你的意義：把 OSM 圖資「用在 OpenFreeMap 上」在授權面完全沒有障礙，因為 OFM 就是 OSM 的產出作品。真正該評估的是營運面（無 SLA、無合約對象）。

### 2.3 臺灣通用電子地圖（Taiwan e-Map, NLSC）

這是全案最容易踩雷的地方，因為**同一個名字底下有兩套授權完全不同的東西**：

**(A) Open Data 版 — 可自由使用**
- 授權：**政府資料開放授權條款－第 1 版（OGDL-1.0）**，免費、不限時間地域與目的、可重製改作、**可再轉授權（sublicense）**、授權不會事後撤回，唯一義務是**依規定顯名標示**。條款第 4 條並明訂與 **CC BY 4.0 相容**，必要時可直接轉以 CC BY 4.0 利用。
- 內容限制：僅提供**比例尺小於 1:18,000（圖磚第 15 級）**的圖磚，且只有**點陣圖磚**（含／不含等高線兩版），無建物投影等細節，**沒有開放向量檔**（社群曾在 data.gov.tw 提案要 shp/kml 向量開放資料版）。
- 取得方式：
  - WMTS：`https://maps.nlsc.gov.tw/OpenData/wmts`（圖層代號如 `EMAP5_OPENDATA`、`EMAP2_OPENDATA`）
  - WMS：`https://maps.nlsc.gov.tw/OpenData/wms`
  - 離線檔：政府資料開放平臺的「臺灣通用電子地圖圖磚封裝檔」、「MBTiles 檔（APP 離線地圖用）」等資料集，授權欄位標示為 OGDL-1.0。
- 這個版本已整合進 OSM 的 iD 編輯器台灣圖層清單，**可合法用來描繪 OSM**。

**(B) 完整版／需申請版 — 不可當開放資料用**
- 端點如 `https://wmts.nlsc.gov.tw/wmts/EMAP5/...`、`https://maps.nlsc.gov.tw/S_Maps/wmts`，解析度更高、層級更深。
- 這些屬「測繪成果電子資料」，依《內政部國土測繪中心測繪成果電子資料流通作業要點》辦理，區分**非加值型／加值型**申請，需簽署資料使用注意事項；向量檔（道路、建物、門牌等 10 大類）、WFS、地籍圖磚、模糊檢索 API、路徑規劃 API 等多屬**需申請**服務，民營公司須提訂閱申請書、審查或繳費後才提供。國土測繪圖資 e 商城亦聲明網站圖文版權屬 NLSC、非經書面同意不得轉載。
- **OSM Wiki 台灣頁面已明文警告**：高解析度 NLSC 圖層著作權與 OSM 不相容、嚴禁使用；自 2025 年起嚴格取締，用未符授權底圖描繪者直接回退，累犯送 Data Working Group 處理。

> ⚠️ **開發時最常見的錯誤**：隨手 Google 到的 `wmts.nlsc.gov.tw/wmts/EMAP5/...` 是「免申請即可介接」，但**「免申請」不等於「開放授權」**。要主張 OGDL-1.0 的自由使用權利，請確實使用 `OpenData` 路徑或 data.gov.tw 上架的檔案。

---

## 三、逐情境判定

### 情境 A：拿 OSM 資料做自己的地圖，用 OpenFreeMap 呈現
**可行。** 兩種做法：
1. 直接用 OFM 公共實例的 style 與圖磚 → 你是「使用他人的產出作品」，照 OFM 規定標示即可。
2. 自架 OFM（Planetiler 產圖磚）或自行改 style → 你是「基於 OSM 單一來源產生產出作品」，屬 ODbL Case 2，**不構成衍生資料庫**，僅需標示 OSM。改 style、篩選圖徵、簡化線段、換 schema 都不影響這個結論。

### 情境 B：在 OFM 底圖上疊自己的資料（門市、路線、統計面量圖）
**可行。** 若你的資料是自己蒐集、未使用 OSM 產生 → 集合資料庫，只需在地圖上標示 OSM。
**但注意**：如果你用 OSM 的路網做 geocoding、用 OSM 的路名回填欄位、或用 OSM 建物輪廓比對出你的資料，**就變成衍生資料庫**，一旦公開散布該資料集，任何人可要求你以 ODbL 免費提供。

### 情境 C：OSM 向量圖層疊在臺灣通用電子地圖圖磚上（雙圖層並存）
**可行，這是最務實的組合。** 兩個資料集在畫面上疊合但未融合 → 集合資料庫 + 產出作品。
義務：
- 對 OSM：標示 © OpenStreetMap contributors。
- 對 NLSC：依 OGDL-1.0 附件的「顯名聲明」要求標示提供機關、年份、資料集名稱與版本，並指向政府資料開放授權條款網址；**未盡顯名標示義務者，視為自始未取得授權**（這條特別嚴格，務必做到）。
- 技術面限制：Open Data 版圖磚只到 z15，放大後會糊；若要深層級底圖，需回頭申請完整版（授權即改變），或改用 OFM 自架底圖。

### 情境 D：把 NLSC Open Data 版資料匯入／融合進 OSM 衍生資料庫
**授權上相容。** 因為 OGDL-1.0 明確允許再轉授權，不與「衍生資料庫須免費提供」衝突，這正是 ODbL Case 4 所說「相容授權」的情形。
但實務上兩件事要注意：
1. 合併後的資料庫**必須能以 ODbL 提供給任何索取者**，且需保留 NLSC 的顯名標示。
2. 若目標是**上傳到 openstreetmap.org 主資料庫**，那是另一回事——需遵守 OSM 的 Import Guidelines 並先與台灣社群討論；且目前 Open Data 版只有圖磚沒有向量，實務上只能作為**描繪參考底圖**（此用途已獲社群認可）。

### 情境 E：用 NLSC 完整版圖磚描繪 OSM
**禁止。** 見上文 OSM Wiki 台灣頁面的明文取締政策。這是開發者與內部標圖團隊最需要教育的一點。

### 情境 F：把 OSM 圖資回饋／併入臺灣通用電子地圖
**實務上不可行。** NLSC 的成果需以 OGDL-1.0 或需申請條款對外提供；若其中混入 OSM 衍生資料，該衍生資料庫依 ODbL 須免費開放，與 NLSC 現行的加值型付費申請制度衝突。除非該部分完全獨立成一個標示為 ODbL 的集合圖層，否則不建議。

### 情境 G：純內部使用
ODbL 只約束公開散布。公司內網、僅員工可見的系統，不產生標示或開放義務（但 NLSC 需申請服務的契約義務仍在，兩者要分開看）。

---

## 四、標示（Attribution）實作範本

放在地圖右下角 attribution control，或 App 的「關於／圖資來源」頁：

```text
© OpenStreetMap contributors（ODbL）
OpenFreeMap © OpenMapTiles
內政部國土測繪中心 [年份] 臺灣通用電子地圖（開放資料版）
本開放資料依政府資料開放授權條款第1版釋出 https://data.gov.tw/license
```

要點：
- OSM 的標示需可點擊連到 `https://www.openstreetmap.org/copyright`。
- MapLibre + OFM style 會自動帶出 OSM/OpenMapTiles 標示；但**印刷品、影片、截圖行銷素材要手動補上**。
- NLSC 的顯名聲明需含「提供機關／年份／資料集名稱與版本／授權條款連結」四要素。
- 若你公開散布的是**資料庫**而非地圖圖片，還需隨附 ODbL 條款全文。

---

## 五、建議架構

**方案 1（推薦起手式）：OFM 公共實例當底圖 + NLSC OpenData 當可切換參考圖層**
- 底圖：`https://tiles.openfreemap.org/styles/liberty`（MapLibre GL JS）
- 參考層：`https://maps.nlsc.gov.tw/OpenData/wmts` 的 `EMAP5_OPENDATA`（raster source，jpeg，GoogleMapsCompatible / EPSG:3857，maxzoom 15）
- 優點：零成本、零申請、授權乾淨；台灣使用者對 NLSC 圖面熟悉度高，可作為「政府版對照」。
- 缺點：OFM 無 SLA；NLSC 層放大受限。

**方案 2（正式產品）：自架 OFM**
- 用 Planetiler 從 OSM PBF（台灣可取 Geofabrik extract）產圖磚，自控更新頻率與樣式；OFM repo 是針對乾淨 Ubuntu 主機的 Fabric 部署腳本，刻意不含 Docker，且**不保證自架者的自動更新無虞**。
- 若需要 NLSC 深層級底圖或向量圖層（門牌、地標、國土利用），走 NLSC 申請流程，並在系統中**把該圖層與 OSM 圖層維持獨立**，避免製造衍生資料庫。

**技術注意事項**
- 座標系：NLSC 同時提供 EPSG:3857 / 3826(TWD97) / 4326，Web 端一律用 3857 對齊 OFM。
- NLSC OpenData 圖磚為 JPEG（WMS 介接建議也選 JPEG 以提升效能），無透明背景，只能當底圖不能當疊加層。
- 圖磚快取／代理轉存前，請確認該版本授權允許重製（OGDL-1.0 允許；需申請版不一定）。
- OGDL-1.0 有「停止提供」條款：機關得因情事變更或第三人權利疑慮停止全部或一部資料提供，且使用者不得請求賠償——**服務不可假設永久可用，建議自行備份下載版並記錄取得日期與版本**。

---

## 六、風險清單與待辦

| 項目 | 風險 | 建議行動 |
|---|---|---|
| 誤用 NLSC 完整版端點 | 授權瑕疵、若用於描繪 OSM 會被回退並究責 | 在程式碼中把端點常數集中管理，加註解標明授權版本 |
| 顯名標示不完整 | OGDL 明定「視為自始未取得授權」 | 上線前檢查 attribution 字串、印刷素材、社群貼圖 |
| 不慎製造 ODbL 衍生資料庫 | 須無償公開該資料庫 | 明確界定「用 OSM 產生的欄位」不得回寫進私有資料表 |
| OFM 無 SLA | 服務中斷風險 | 商業產品規劃自架 fallback，或評估 MapTiler/Protomaps 等替代 |
| NLSC 資料可能停止提供 | 依 OGDL 條款無求償權 | 下載離線 MBTiles 備份、記錄版本 |
| 個資 | OGDL 明定使用者自負個資法責任（如門牌資料） | 涉門牌／地址資料時另做個資評估 |

**建議行動**
1. 明確定義產品要的最大縮放層級 → 決定是否非用 NLSC 完整版不可。
2. 若需完整版，先向 NLSC 索取「申請服務介接說明表」與民營團體訂閱申請書，確認費用與可否用於商業產品、可否快取。
3. 在 repo 建立 `LICENSES.md`，記錄每個圖資來源、授權、取得日期、標示字串。
4. 若團隊會編輯 OSM，內部發布一份「可用／禁用底圖清單」。

---

## 七、參考資料

- OpenStreetMap Wiki — License/Use Cases：https://wiki.openstreetmap.org/wiki/License/Use_Cases
- OpenStreetMap Wiki — Taiwan（NLSC 圖層使用規範與取締政策）：https://wiki.openstreetmap.org/wiki/Taiwan
- OpenStreetMap 著作權頁：https://www.openstreetmap.org/copyright
- OpenFreeMap 官網與標示規定：https://openfreemap.org/
- OpenFreeMap GitHub（授權、自架限制）：https://github.com/hyperknot/openfreemap
- OpenFreeMap 服務條款：https://openfreemap.org/tos/
- 政府資料開放授權條款－第 1 版：https://data.gov.tw/license
- 國土測繪中心 政府網站資料開放宣告：https://www.nlsc.gov.tw/cp.aspx?n=1632
- 臺灣通用電子地圖內容說明：https://www.nlsc.gov.tw/cp.aspx?n=10702
- 國土測繪圖資服務雲 介接服務說明（免申請／需申請清單）：https://maps.nlsc.gov.tw/S09SOA/homePage.action?Language=ZH
- 政府資料開放平臺 — 臺灣通用電子地圖（不含等高線）：https://data.gov.tw/dataset/25108
- 政府資料開放平臺 — 臺灣通用電子地圖圖磚封裝檔：https://data.gov.tw/dataset/24888
- OSM 社群論壇討論：臺灣通用電子地圖開放資料版向量圖資：https://community.openstreetmap.org/t/topic/103507
