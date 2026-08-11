# Gaia — 地理課程互動地圖

把地理課程內容整理到一張帶等高線的地圖上，**以主題而不是年級來組織**，並提供「比較同緯度、不同地區」的互動工具。

🌏 https://gaia.kigi.tw

如果你喜歡我的創作或者有幫助到你的學習，請贊助支持均一：https://official.junyiacademy.org/donate/

## 這個網站在做什麼

同一條緯線上，臺灣年雨量 2000 mm 以上，撒哈拉不到 25 mm，兩地年均溫卻幾乎一樣。緯度不是決定氣候的唯一因素——這件事用講的很抽象，把兩個地方並排放在同一個比例尺下看就很直觀。

網站分成三個**主題地圖**與一個**比較工具**：

| 頁面 | 在講什麼 |
|---|---|
| [臺灣地理](https://gaia.kigi.tw/theme/taiwan) | 行政區、地形、水系、原住民族、植被生態、農業物產 |
| [世界地理](https://gaia.kigi.tw/theme/world) | 世界重要城市的人文與地理條件、大尺度的地形與水系 |
| [全球地理形貌](https://gaia.kigi.tw/theme/global) | 用赤道／南北回歸線／南北緯 30°、60° 當骨架，看森林與沙漠、洋流、板塊與地震帶怎麼分布 |
| [同緯度比較](https://gaia.kigi.tw/compare) | 左右兩張地圖鎖定相同緯度與縮放層級，經度各自獨立平移 |

主題地圖的每個圖層都是可任意複選疊加的核取方塊（在左上角 ☰ 的圖層抽屜裡）。同緯度比較頁下方會同步呈現兩地的地形資料卡與氣溫雨量圖（兩側共用 Y 軸範圍，柱高才能互相比較）。

這兩者是互補的：**全球地理形貌**解釋「為什麼緯度重要」（副熱帶高壓帶為什麼把沙漠推到南北緯 30° 附近），**同緯度比較**則帶學生鑽進同一條緯度上的兩個地方看差異。

全站另外共用三個地形疊圖：等高線（瀏覽器即時從全球 DEM 圖磚計算）、地形陰影、3D 地形；底圖可切換世界地圖與國土測繪中心的通用電子地圖／正射影像。

## 目前收錄的內容

架構已經做好，資料逐步回補中。三個主題共 **31 個圖層**，其中 8 個已有資料，其餘 23 個會顯示成停用的「資料整理中」選項——但仍然寫了說明與資料來源，讓人看得出這張地圖打算長成什麼樣子。

已有資料的圖層：

- **臺灣**：縣市界（21 個）、地形景點、原住民族 16 族、特有種 5 種的 GBIF 觀測點
- **世界**：世界重要城市、世界主要河流（116 條）
- **全球**：緯度參考線（9 條）、全球地震帶（1960 年以來規模 6.5 以上，2831 筆）

## 加一個新圖層

圖層由 `src/map/registry/` 的註冊表驅動，**加一筆資料就會出現在 UI，不需要寫元件**：

1. 幾何放進 `public/data/geo/`（用 `npm run build:geodata` 產生）或 `public/data/geo-manual/`（手繪的教學示意幾何）
2. 在 `src/map/registry/themes/*.ts` 加一筆圖層定義（id、分組、幾何型別 circle/line/fill、顏色角色、資料來源）
3. `npm run validate` 會在建置期交叉檢查——包含「宣告的檔案是不是真的存在」，因為那個錯誤在執行期是完全靜默的

說明文字是選填的：沒有寫 `src/content/geo/<collection>/<id>.json` 時，點下去會退回顯示 geojson 的名稱加上圖層自己的說明與來源。

## 開發

需要 Node ≥ 22.12。

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # validate → test:order → typecheck → 產出 dist/

npm run validate     # 內容 schema + 圖層註冊表交叉檢查
npm run test:order   # 圖層堆疊順序的回歸測試（不需瀏覽器）
npm run build:debug  # 帶地圖除錯掛勾的 production build，配合 npm run preview 驗證圖層
```

氣候、特有種、地理幾何都是**建置期**產製後 commit 進 repo 的靜態檔案（`npm run build:climate` / `build:species` / `build:geodata`），網站執行期只讀本地 JSON，不會在上課時對外部 API 發出大量請求。整站是純靜態、無後端、無 API key。

其他指令與專案規範見 [CLAUDE.md](./CLAUDE.md)。

## 資料來源

- 地形：[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（SRTM 等資料集）
- 世界底圖：[OpenFreeMap](https://openfreemap.org/) / [OpenStreetMap](https://www.openstreetmap.org/copyright) 貢獻者
- 臺灣底圖：[內政部國土測繪中心](https://maps.nlsc.gov.tw/)
- 氣候：[Open-Meteo](https://open-meteo.com/) ERA5 再分析資料，1991–2020
- 行政區與河流：[Natural Earth](https://www.naturalearthdata.com/)（public domain）
- 地震目錄：[USGS](https://earthquake.usgs.gov/)（public domain）
- 特有種觀測紀錄：[GBIF](https://www.gbif.org/)
- 原住民族人口與分布：[原住民族委員會](https://www.cip.gov.tw/)、內政部統計通報

### 已知資料限制

教學使用時值得先知道這幾件事：

- **氣候數值是 ERA5 再分析**（約 25 km 網格），會平滑掉小島與陡峭地形的地形雨。例如希洛實測年雨量約 3300 mm，ERA5 只給約 1590 mm。量級關係仍然正確，但不要當成氣象站觀測值引用。
- **特有種觀測點反映的是歷史觀測熱點**，受賞鳥與採集活動的地點偏好影響，不是嚴謹的族群密度普查。
- **臺灣縣市界只有 21 個，缺連江縣（馬祖）**——Natural Earth 的資料集裡沒有收錄。
- **原住民族的標記是代表點**（文化園區或行政中心），不是精確的分布邊界。
- 標示為「教學示意圖」的圖層（洋流、氣候帶、行星風系）是簡化的示意幾何，不是精確測繪資料。
