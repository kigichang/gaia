/**
 * 臺灣主要河川／流域分區的共用常數。
 *
 * 收錄範圍是水利署公告的 **24 條中央管河川 + 2 條跨省市河川**（淡水河、磺溪），
 * 這是官方對「主要河川」的定義，不是隨手挑的知名河川清單。
 *
 * 這個檔案管三件事：河川／流域的中文名 → 本站 id 對照表（`RIVER_IDS`／
 * `BASIN_IDS`）、幹流長度與流域面積的官方數字（`RIVER_FACTS`，沒有開放資料 API，
 * 人工抄自水利署官網表格），以及河川線的 OSM 取得方式（`RIVER_OSM_REFS`）。
 *
 * 兩個圖層的**幾何來源不同、精確度同一等級**：
 * - `tw-rivers`（線）＝ OpenStreetMap 的 `waterway=river` 關聯，用 `ref`
 *   （水利署河川代碼）選取，見 `RIVER_OSM_REFS`。
 * - `tw-basins`（面）＝ 水利地理資訊服務平台的「河川流域範圍圖」SHP，見 `BASIN_URL`。
 */

/**
 * 資料集「河川流域範圍圖」（BASIN），水利地理資訊服務平台。SHP 格式，座標系統
 * TWD97/TM2 zone 121（EPSG:3826，見 lib/twd97.mjs）。這是這個資料夾裡**唯一
 * 還會被抓取並剖析 SHP** 的幾何來源——河川線已經改用手繪路徑（見上）。
 *
 * ⚠️ 這份資料很乾淨：每個官方河川名稱在 143 筆 record 裡剛好對到一筆單一環
 * （無孔洞）多邊形，實測面積與 RIVER_FACTS 的官方流域面積誤差多在 10% 以內
 * （濁水溪 3167.5 vs 官方 3157 km²、淡水河 2733.9 vs 2726），`build-geodata.mjs`
 * 的 tw-basins transform 直接精確比對名稱就夠了。
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
 * key 用官方表格原本的正式名稱，跟 `RIVER_IDS`／`BASIN_IDS` 的 key 一致，方便
 * 三份對照表互相核對。
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

/**
 * 河川中文名 → OSM `waterway` 關聯的 `ref`，也就是**水利署的河川代碼**。
 *
 * ## 為什麼用 ref 而不是名稱
 *
 * 名稱在臺灣的河川上**不唯一**：新竹的鳳山溪（129000）與高雄的鳳山溪（171000，
 * 舊稱前鎮河）同名不同河，濁水溪、頭前溪、北港溪也各有好幾條同名的小溪流散落
 * 全國——這正是當初讓水利署 RIVERLIN SHP 無法使用的同一個問題（見 CLAUDE.md
 * 「為什麼不繼續用水利署的 RIVERLIN SHP」）。
 *
 * OSM 的臺灣河川關聯帶了官方河川代碼，用它選取就沒有歧義；而且 `fetchRouteLines()`
 * 在選中數不等於 1 時會讓建置失敗，上游改名或被拆開都會當場現形。
 *
 * ## 為什麼 OSM 這次可用，RIVERLIN 不行
 *
 * 關鍵不在格式，在於**幹流的定義**。RIVERLIN 依「名稱字串」分筆，上游改稱其他
 * 名稱的河段就變成另一筆記錄，於是 11 條河只涵蓋官方幹流長度的 10–50%。OSM 的
 * 關聯是依**實際河川**建立的，上游改名的河段以 `main_stream` 角色收進同一個
 * 關聯——淡水河的關聯含大漢溪河段（實測 161.6 km／官方 158.7）、高屏溪含荖濃溪
 * 段（177.1／171），正是 RIVERLIN 做不到的那件事。
 *
 * 所以取幾何時**只取 `main_stream` 角色**（`fetchRouteLines` 的 `role` 選項）：
 * `side_stream` 是支流，畫出來會變成整個水系而不是一條幹流。
 *
 * ## ⚠️ 有五條河的長度對不上官方數字，這是量測基準差異，不是選錯河
 *
 * 實測（2026-08）：21 條在 ±15% 內（其中 17 條在 ±5% 內），另外五條——
 * 阿公店溪 -50%、後龍溪 -31%、花蓮溪 -21%、北港溪 -19%、**卑南溪 +17%**。
 *
 * 偏長與偏短是兩件不同的事，都不是錯誤：
 * - **偏長**（卑南溪）是 OSM 把上游改名的河段完整收進 `main_stream`，而官方
 *   長度是從另一個界點起算的。幾何是完整的，這個方向不需要處理。
 * - **偏短**的四條是上游河段在 OSM 尚未數化。都試過補接上游關聯，結論是**不補**：
 *   - 北港溪的虎尾溪、花蓮溪的光復溪，它們的 way **已經在母關聯裡**（實測逐條
 *     比對，去重後總長一個公尺都沒變），補接是空操作；缺的是更上游的河段。
 *   - 後龍溪補上汶水溪關聯後長度確實回到 -5%，但兩段之間**有 4.26 公里的缺口**
 *     （那段在 OSM 裡沒有任何以這兩個名字命名的 way），畫出來是中間斷開的兩截線。
 *     一條在地圖上斷掉的河，比一條短了三成的河更容易讓人誤解。
 *   - 阿公店溪補上濁水溪（167010）後仍是 -33%。
 *
 * 圖上畫的是 OSM 的幹流幾何，卡片與清單上的長度一律是 `RIVER_FACTS` 的官方數字
 * ——兩者本來就是不同來源，差距只影響「線畫到哪裡」，不影響教學數字。
 * 逐條追上游別名鏈是跨資料源的水文研究工作，範圍遠超過「畫一張教學地圖」。
 *
 * `build-geodata.mjs` 因此只在差距 >15% 時印提醒、>60% 才讓建置失敗（那個量級
 * 代表選到同名的小溪流或抓成整個水系，是真的選錯）。
 */
export const RIVER_OSM_REFS = {
  磺溪: "101000",
  淡水河: "114000",
  鳳山溪: "129000",
  頭前溪: "130000",
  中港溪: "134000",
  後龍溪: "135000",
  大安溪: "140000",
  大甲溪: "142000",
  烏溪: "143000",
  濁水溪: "151000",
  北港溪: "154000",
  朴子溪: "155000",
  八掌溪: "158000",
  急水溪: "159000",
  曾文溪: "163000",
  鹽水溪: "165000",
  二仁溪: "166000",
  阿公店溪: "167000",
  高屏溪: "173000",
  東港溪: "174000",
  四重溪: "185000",
  卑南溪: "220000",
  秀姑巒溪: "237000",
  花蓮溪: "242000",
  和平溪: "250000",
  蘭陽溪: "256000",
};
