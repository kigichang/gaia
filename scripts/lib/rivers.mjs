/**
 * 臺灣主要河川的共用常數。
 *
 * 兩份資料源刻意分開，跟水庫（basics CSV + extent KML）是同一個道理——各自缺一半：
 *   - 幾何：水利地理資訊服務平台的「河川(支流)」SHP（RIVERLIN），只有中文名，
 *     沒有長度／流域面積。
 *   - 長度與流域面積：水利署全球資訊網的「河川長度」頁面，是人工整理的官方表格，
 *     沒有 API，所以直接把數字抄進這裡（比照 RESERVOIR_IDS 寫死對照表的既有決定）。
 *
 * 收錄範圍是水利署公告的 **24 條中央管河川 + 2 條跨省市河川**（淡水河、磺溪），
 * 這是官方對「主要河川」的定義，不是隨手挑的知名河川清單。
 */

/**
 * 資料集「河川(支流)」（RIVERLIN），水利地理資訊服務平台。SHP 格式，
 * 座標系統 TWD97/TM2 zone 121（EPSG:3826，見 lib/twd97.mjs）。
 *
 * ⚠️ 這份圖資的測量／數化時間標記是 **2000–2008 年**，比縣市界（每半年更新）
 * 舊很多。河道本身在教學會用的比例尺下不會有肉眼可辨的改變（除非發生大規模
 * 河川整治工程），所以仍然拿來用；但**長度／流域面積不能從這份幾何反推**，
 * 一律以下面 RIVER_FACTS 的官方數字為準——見 build-geodata.mjs 的說明。
 */
export const RIVERLIN_URL = "https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=RIVERLIN&filetype=SHP";

/**
 * 資料集「河川流域範圍圖」（BASIN），同一個平台。SHP 格式，同樣是 TWD97/TM2
 * zone 121。跟 RIVERLIN**不是同一份資料**，但可以共用這個檔案的 id／facts
 * 對照表（見下面 `BASIN_IDS`）——這是水系圖層真正「合併」的地方：幾何各自
 * 有各自的抓取與剖析邏輯，但「這個官方河川叫什麼名字、對應本站哪個 id」
 * 只維護一份。
 *
 * ⚠️ 這份資料**比 RIVERLIN 乾淨很多**：每個官方河川名稱在 143 筆 record 裡
 * 剛好對到一筆單一環（無孔洞）多邊形，實測面積與 RIVER_FACTS 的官方流域面積
 * 誤差多在 10% 以內（濁水溪 3167.5 vs 官方 3157 km²、淡水河 2733.9 vs 2726），
 * 不需要像 RIVERLIN 那樣分群挑最大連通塊——這也是為什麼 `build-geodata.mjs`
 * 的 tw-basins transform 直接精確比對名稱，沒有 clusterParts() 那段邏輯。
 */
export const BASIN_URL = "https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=BASIN&filetype=SHP";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部水利署";

/**
 * 河川中文名 → 本站 id。
 *
 * 寫死對照表而不是 slugify，理由跟 COUNTY_IDS／RESERVOIR_IDS 一樣：這些 id 是
 * 內容檔檔名（src/content/geo/tw-rivers/<id>.json）與圖徵強調用的 key。
 *
 * ⚠️ 一律加 `-river` 後綴，即使拼音本身已經唯一——這是刻意的，不是贅字：
 * 「水系」這個群組裡河川與水庫**同時可見**，而 `曾文溪`／`曾文水庫` 這種同源
 * 命名在拼音下會撞（都是 `zengwen`）、`阿公店溪`／`阿公店水庫` 也一樣
 * （都是 `agongdian`）。撞到的後果是選取強調會互相污染——選了曾文溪，
 * 曾文水庫的圓點也會被誤判成同一個 id 而放大。加後綴讓兩個集合的 id
 * 命名空間永遠不相交，不必逐一檢查現有 40 座水庫的拼音。
 */
export const RIVER_IDS = {
  蘭陽溪: "lanyang-river",
  鳳山溪: "fengshan-river",
  頭前溪: "touqian-river",
  中港溪: "zhonggang-river",
  後龍溪: "houlong-river",
  大安溪: "daan-river",
  大甲溪: "dajia-river",
  烏溪: "wu-river",
  濁水溪: "zhuoshui-river",
  北港溪: "beigang-river",
  朴子溪: "puzi-river",
  八掌溪: "bazhang-river",
  急水溪: "jishui-river",
  曾文溪: "zengwen-river",
  鹽水溪: "yanshui-river",
  二仁溪: "erren-river",
  阿公店溪: "agongdian-river",
  高屏溪: "gaoping-river",
  東港溪: "donggang-river",
  四重溪: "sichong-river",
  卑南溪: "beinan-river",
  秀姑巒溪: "xiuguluan-river",
  花蓮溪: "hualien-river",
  和平溪: "heping-river",
  淡水河: "danshui-river",
  磺溪: "huang-river",
};

/**
 * 流域分區（BASIN，面）的 id，從 `RIVER_IDS` 衍生，不是另外維護一份 26 筆的表。
 *
 * ⚠️ 刻意換成 `-basin` 尾綴，**不是**跟河川線共用同一個 id。「水系」這個群組
 * 現在有河川線（`tw-rivers`）跟流域面（`tw-basins`）兩個各自獨立可勾選的圖層，
 * 兩者是「同一條河的兩種呈現方式」而不是父子關係（不像五大山脈→主峰那種
 * `attach`），所以沒有走 `parentProperty` 那套連動強調機制。如果兩層共用同一個
 * id，選取其中一層會不會意外連動強調另一層目前沒有測過、行為未定義——比照
 * `RIVER_IDS` 當初為了不跟水庫 id 撞名而加 `-river` 尾綴的同一個理由，這裡也
 * 用尾綴把 id 命名空間分開，讓行為可預測。
 */
export const BASIN_IDS = Object.fromEntries(
  Object.entries(RIVER_IDS).map(([name, id]) => [name, id.replace(/-river$/, "-basin")]),
);

/**
 * 幹流長度（公里）與流域面積（平方公里）。
 *
 * 來源：水利署全球資訊網〈河川長度〉頁面（www.wra.gov.tw/cp.aspx?n=3163&dn=3164），
 * 「中央管河川」24 條與「跨省市河川」2 條兩張表格的官方數字，人工抄錄——這個頁面
 * 沒有開放資料 API，跟 RESERVOIR_IDS／COUNTY_IDS 一樣是寫死對照表的既有作法。
 *
 * ⚠️ key 用**沒有括號別名**的官方正式名稱（二仁溪、和平溪），不是 RIVERLIN 的
 * 圖徵名稱（二仁溪(二層行溪)、和平溪(大濁水溪)）——build-geodata.mjs 的 transform
 * 會把兩邊 join 起來，這裡維持官方表格原本的名稱比較好核對來源。
 */
export const RIVER_FACTS = {
  蘭陽溪: { length_km: 73.0, area_km2: 978, category: "中央管河川" },
  鳳山溪: { length_km: 45.4, area_km2: 250, category: "中央管河川" },
  頭前溪: { length_km: 63.0, area_km2: 566, category: "中央管河川" },
  中港溪: { length_km: 54.0, area_km2: 446, category: "中央管河川" },
  後龍溪: { length_km: 58.3, area_km2: 537, category: "中央管河川" },
  大安溪: { length_km: 95.8, area_km2: 758, category: "中央管河川" },
  大甲溪: { length_km: 124.2, area_km2: 1236, category: "中央管河川" },
  烏溪: { length_km: 119.1, area_km2: 2026, category: "中央管河川" },
  濁水溪: { length_km: 186.6, area_km2: 3157, category: "中央管河川" },
  北港溪: { length_km: 82.0, area_km2: 645, category: "中央管河川" },
  朴子溪: { length_km: 75.9, area_km2: 427, category: "中央管河川" },
  八掌溪: { length_km: 80.9, area_km2: 475, category: "中央管河川" },
  急水溪: { length_km: 65.0, area_km2: 379, category: "中央管河川" },
  曾文溪: { length_km: 138.5, area_km2: 1177, category: "中央管河川" },
  鹽水溪: { length_km: 41.3, area_km2: 343, category: "中央管河川" },
  二仁溪: { length_km: 63.2, area_km2: 350, category: "中央管河川" },
  阿公店溪: { length_km: 38.0, area_km2: 137, category: "中央管河川" },
  高屏溪: { length_km: 171.0, area_km2: 3257, category: "中央管河川" },
  東港溪: { length_km: 44.0, area_km2: 472, category: "中央管河川" },
  四重溪: { length_km: 31.9, area_km2: 125, category: "中央管河川" },
  卑南溪: { length_km: 84.4, area_km2: 1603, category: "中央管河川" },
  秀姑巒溪: { length_km: 81.2, area_km2: 1790, category: "中央管河川" },
  花蓮溪: { length_km: 57.3, area_km2: 1507, category: "中央管河川" },
  和平溪: { length_km: 50.7, area_km2: 561, category: "中央管河川" },
  淡水河: { length_km: 158.7, area_km2: 2726, category: "跨省市河川" },
  磺溪: { length_km: 13.5, area_km2: 49, category: "跨省市河川" },
};
