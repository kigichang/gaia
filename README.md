# Gaia — 國/高中地理課程互動地圖

把地理課程內容整理到一張帶等高線的地圖上，並提供「比較同緯度、不同地區」的互動工具。

🌏 https://gaia.kigi.tw

## 這個網站在做什麼

同一條緯線上，臺灣年雨量 2000 mm 以上，撒哈拉不到 25 mm，兩地年均溫卻幾乎一樣。緯度不是決定氣候的唯一因素——這件事用講的很抽象，把兩個地方並排放在同一個比例尺下看就很直觀。

- **同緯度比較**：左右兩張地圖鎖定相同緯度與縮放層級，經度各自獨立平移。下方同步呈現地形資料卡與氣溫雨量圖（兩側共用 Y 軸範圍）。
- **等高線地形**：等高線由瀏覽器即時從全球 DEM 圖磚計算，可疊加地形陰影與 3D 地形。
- **臺灣專題**：可切換國土測繪中心的通用電子地圖與正射影像。

## 開發

需要 Node ≥ 22.12。

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 產出 dist/
```

其他指令與專案規範見 [CLAUDE.md](./CLAUDE.md)。

## 資料來源

- 地形：[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)（SRTM 等資料集）
- 世界底圖：[OpenFreeMap](https://openfreemap.org/) / [OpenStreetMap](https://www.openstreetmap.org/copyright) 貢獻者
- 臺灣底圖：[內政部國土測繪中心](https://maps.nlsc.gov.tw/)
- 氣候：[Open-Meteo](https://open-meteo.com/) ERA5 再分析資料，1991–2020

氣候數值為 ERA5 再分析（約 25 km 網格），會平滑掉小島與陡峭地形的地形雨，適合作教學比較，不等同氣象站觀測值。
