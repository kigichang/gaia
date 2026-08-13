/**
 * 臺灣河川／流域分區的共用常數。
 *
 * 收錄範圍是**經濟部公告的全部 118 個列管水系**（民國 112 年 2 月公告
 * 「河川區分為中央管河川、跨省市河川、直轄市管河川及縣(市)管河川」）：
 * 中央管 24 + 跨省市 2 + 直轄市管 27 + 縣(市)管 65。這是官方對「河川」的完整
 * 定義，不是隨手挑的知名河川清單——比照縣市界用內政部的 22 縣市、國家公園用
 * 主管機關的公告清單，範圍由主管機關決定而不是由編者的印象決定。
 *
 * 公告本文另有一條界線：「凡屬排水管理辦法第 4 條規定之排水非屬河川」。所以
 * 愛河、後勁溪、東螺溪、員林大排這些**有水利署河川代碼但已歸類為排水**的水道
 * 不在這 118 之內，即使 OSM 上有現成的關聯可抓（實測 OSM 上帶六位代碼、代碼
 * 結尾為 000 的關聯共 150 個，比列管水系多 32 個）。要放寬到那些水道，要改的是
 * 這份表加上圖層說明，不是偷偷多抓幾條。
 *
 * 這個檔案管一件事：**118 個水系的官方身分**——中文名、本站 id、水利署河川代碼、
 * 管理等級、流經縣市，以及 26 條中央管／跨省市河川才有的官方長度與流域面積。
 *
 * 兩個圖層的**幾何來源不同、精確度同一等級**：
 * - `tw-rivers`（線）＝ OpenStreetMap 的 `waterway=river` 關聯，用 `ref`
 *   （水利署河川代碼）選取，見下面的 `ref` 欄與 `RIVER_OSM_REFS`。
 * - `tw-basins`（面）＝ 水利地理資訊服務平台的「河川流域範圍圖」SHP，見 `BASIN_URL`。
 *   **只涵蓋 26 條中央管／跨省市河川**（BASIN 那份資料只有這些），所以
 *   `BASIN_IDS` 是從有官方面積的那 26 筆衍生的，不是全部 118 筆。
 */

/**
 * 資料集「河川流域範圍圖」（BASIN），水利地理資訊服務平台。SHP 格式，座標系統
 * TWD97/TM2 zone 121（EPSG:3826，見 lib/twd97.mjs）。
 *
 * ⚠️ 這份資料很乾淨：每個官方河川名稱在 143 筆 record 裡剛好對到一筆單一環
 * （無孔洞）多邊形，實測面積與官方數字誤差多在 10% 以內（濁水溪 3167.5 vs
 * 官方 3157 km²、淡水河 2733.9 vs 2726），`build-geodata.mjs` 的 tw-basins
 * transform 直接精確比對名稱就夠了。
 */
export const BASIN_URL = "https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=BASIN&filetype=SHP";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部水利署";

/**
 * 圖層抽屜可點清單的**分組順序**（`browse.groupBy: "category"`）。
 *
 * `LayerBrowseList` 依序切、不排序，所以 geojson 的 feature 必須照這個順序寫出，
 * 同一個等級的河川要連續。順序是「管理層級由高到低」，課本會點名的 24 條中央管
 * 河川因此排在最前面。
 */
export const RIVER_CATEGORY_ORDER = [
  "中央管河川",
  "跨省市河川",
  "直轄市管河川",
  "縣(市)管河川",
];

/**
 * 118 個列管水系的官方身分。**這是唯一的一份**，`RIVER_IDS`／`RIVER_OSM_REFS`／
 * `RIVER_FACTS`／`BASIN_IDS` 全部從它衍生，不要再另外維護平行的對照表。
 *
 * ## 欄位
 *
 * - `id`：本站 id，也是內容檔檔名（`src/content/geo/tw-rivers/<id>.json`）與圖徵
 *   強調用的 key。**寫死對照表而不是 slugify**，理由跟 COUNTY_IDS／RESERVOIR_IDS
 *   一樣：它必須跨資料源改版保持穩定。
 *
 *   ⚠️ **一律加 `-river` 後綴**，即使拼音本身已經唯一——這是刻意的，不是贅字：
 *   「水系」這個群組裡河川與水庫**同時可見**，而 `曾文溪`／`曾文水庫` 這種同源
 *   命名在拼音下會撞（都是 `zengwen`）、`阿公店溪`／`阿公店水庫` 也一樣。撞到的
 *   後果是選取強調會互相污染——選了曾文溪，曾文水庫的圓點也會被誤判成同一個 id
 *   而放大。加後綴讓兩個集合的 id 命名空間永遠不相交。
 *
 * - `ref`：水利署河川代碼，也是 OSM `waterway` 關聯的 `ref`。**選取一律用它，
 *   不要用名稱**：河川名在臺灣不唯一（新竹的鳳山溪 129000 與高雄的鳳山溪 171000
 *   同名不同河，濁水溪、頭前溪、北港溪也各有好幾條同名的小溪流散落全國），
 *   這正是當初讓水利署 RIVERLIN SHP 無法使用的同一個問題。
 *
 * - `category`：公告的管理等級，同時是可點清單的分組依據。
 * - `counties`：公告表上的「流經直轄市、縣(市)」。中央管與跨省市取自表 1／表 4，
 *   直轄市管與縣(市)管取自表 2／表 3 的分縣市小標。
 *
 * - `alias`（選填）：**OSM／一般地圖上的常用名，與公告名稱不同時才有。**
 *   `name` 一律用公告名稱（這一層的收錄範圍就是那份公告），但公告名稱有 20 條
 *   已經不是地圖與路牌上寫的字（乾華溪＝阿里磅溪、豐濱溪＝貓公溪、成功溪＝
 *   新港溪…）。別名會寫進 geojson 的 `meta`，所以清單副標看得到、搜尋也搜得到
 *   ——學生對著底圖上的「阿里磅溪」找得到我們標的「乾華溪」。
 *
 * - `length_km`／`area_km2`（選填）：**只有 26 條中央管／跨省市河川有。**
 *   來源是水利署全球資訊網〈河川長度〉頁面（www.wra.gov.tw/cp.aspx?n=3163&dn=3164）
 *   的官方數字，人工抄錄（那個頁面沒有開放資料 API）。
 *
 *   ⚠️ **其餘 92 條沒有官方長度，也不要拿 OSM 幾何量出來的公里數填。** 公告
 *   明訂直轄市管與縣(市)管河川的「河川界點由主管機關訂定公告之」，界點不同、
 *   量到的長度就不同；把 OSM 河道長度放進同一個欄位，等於讓兩種不同基準的數字
 *   長得一模一樣。這些河川的卡片改為呈現公告等級與流經縣市。
 *
 * ## ⚠️ 官方名稱與 OSM 名稱的對照是查出來的，不是猜的
 *
 * 92 條裡有 25 條的公告名稱在 OSM 上不是 `name`。其中 20 條由 OSM 的 `alt_name`
 * 唯一命中（實測沒有任何一條 alt_name 對到兩個關聯），另外 5 條（瑪鍊溪＝瑪鋉溪、
 * 八蓮溪＝八連溪、津林溪＝加津林溪、薯寮溪＝蕃薯寮溪、水連溪＝水璉溪）是一字
 * 之差的異體寫法，且各自的代碼正好是該縣市代碼序列裡唯一剩下的空缺。
 *
 * **這件事不能靠語感猜**：花蓮的「大富溪」是 OSM 的 `小清水溪`（248000）、
 * 「大清水溪」是 OSM 的 `良里溪`（249000）——望文生義正好會對調。
 */
export const RIVERS = {
  // ── 中央管河川 24 水系（表 1）─────────────────────────────
  蘭陽溪: { id: "lanyang-river", ref: "256000", category: "中央管河川", counties: ["宜蘭縣"], length_km: 73.0, area_km2: 978 },
  鳳山溪: { id: "fengshan-river", ref: "129000", category: "中央管河川", counties: ["桃園市", "新竹縣"], length_km: 45.4, area_km2: 250 },
  頭前溪: { id: "touqian-river", ref: "130000", category: "中央管河川", counties: ["新竹縣", "新竹市"], length_km: 63.0, area_km2: 566 },
  中港溪: { id: "zhonggang-river", ref: "134000", category: "中央管河川", counties: ["新竹縣", "苗栗縣"], length_km: 54.0, area_km2: 446 },
  後龍溪: { id: "houlong-river", ref: "135000", category: "中央管河川", counties: ["苗栗縣"], length_km: 58.3, area_km2: 537 },
  大安溪: { id: "daan-river", ref: "140000", category: "中央管河川", counties: ["苗栗縣", "臺中市"], length_km: 95.8, area_km2: 758 },
  大甲溪: { id: "dajia-river", ref: "142000", category: "中央管河川", counties: ["臺中市"], length_km: 124.2, area_km2: 1236 },
  烏溪: { id: "wu-river", ref: "143000", category: "中央管河川", counties: ["臺中市", "彰化縣", "南投縣"], length_km: 119.1, area_km2: 2026 },
  濁水溪: { id: "zhuoshui-river", ref: "151000", category: "中央管河川", counties: ["彰化縣", "南投縣", "雲林縣", "嘉義縣"], length_km: 186.6, area_km2: 3157 },
  北港溪: { id: "beigang-river", ref: "154000", category: "中央管河川", counties: ["雲林縣", "嘉義縣"], length_km: 82.0, area_km2: 645 },
  朴子溪: { id: "puzi-river", ref: "155000", category: "中央管河川", counties: ["嘉義縣", "嘉義市"], length_km: 75.9, area_km2: 427 },
  八掌溪: { id: "bazhang-river", ref: "158000", category: "中央管河川", counties: ["嘉義縣", "嘉義市", "臺南市"], length_km: 80.9, area_km2: 475 },
  急水溪: { id: "jishui-river", ref: "159000", category: "中央管河川", counties: ["嘉義縣", "臺南市"], length_km: 65.0, area_km2: 379 },
  曾文溪: { id: "zengwen-river", ref: "163000", category: "中央管河川", counties: ["嘉義縣", "臺南市"], length_km: 138.5, area_km2: 1177 },
  鹽水溪: { id: "yanshui-river", ref: "165000", category: "中央管河川", counties: ["臺南市"], length_km: 41.3, area_km2: 343 },
  二仁溪: { id: "erren-river", ref: "166000", category: "中央管河川", counties: ["臺南市", "高雄市"], length_km: 63.2, area_km2: 350 },
  阿公店溪: { id: "agongdian-river", ref: "167000", category: "中央管河川", counties: ["高雄市"], length_km: 38.0, area_km2: 137 },
  高屏溪: { id: "gaoping-river", ref: "173000", category: "中央管河川", counties: ["高雄市", "屏東縣"], length_km: 171.0, area_km2: 3257 },
  東港溪: { id: "donggang-river", ref: "174000", category: "中央管河川", counties: ["屏東縣"], length_km: 44.0, area_km2: 472 },
  四重溪: { id: "sichong-river", ref: "185000", category: "中央管河川", counties: ["屏東縣"], length_km: 31.9, area_km2: 125 },
  卑南溪: { id: "beinan-river", ref: "220000", category: "中央管河川", counties: ["臺東縣"], length_km: 84.4, area_km2: 1603 },
  秀姑巒溪: { id: "xiuguluan-river", ref: "237000", category: "中央管河川", counties: ["臺東縣", "花蓮縣"], length_km: 81.2, area_km2: 1790 },
  花蓮溪: { id: "hualien-river", ref: "242000", category: "中央管河川", counties: ["花蓮縣"], length_km: 57.3, area_km2: 1507 },
  和平溪: { id: "heping-river", ref: "250000", category: "中央管河川", counties: ["花蓮縣", "宜蘭縣"], length_km: 50.7, area_km2: 561 },

  // ── 跨省市河川 2 水系（表 4）─────────────────────────────
  淡水河: { id: "danshui-river", ref: "114000", category: "跨省市河川", counties: ["基隆市", "臺北市", "新北市", "桃園市", "新竹縣"], length_km: 158.7, area_km2: 2726 },
  磺溪: { id: "huang-river", ref: "101000", category: "跨省市河川", counties: ["臺北市", "新北市"], length_km: 13.5, area_km2: 49 },

  // ── 直轄市管河川 27 水系（表 2）───────────────────────────
  小坑溪: { id: "xiaokeng-river", ref: "102000", category: "直轄市管河川", counties: ["新北市"] },
  乾華溪: { id: "qianhua-river", ref: "103000", category: "直轄市管河川", counties: ["新北市"], alias: "阿里磅溪" },
  石門溪: { id: "shimen-river", ref: "104000", category: "直轄市管河川", counties: ["新北市"] },
  老梅溪: { id: "laomei-river", ref: "105000", category: "直轄市管河川", counties: ["新北市"] },
  楓林溪: { id: "fenglin-river", ref: "106000", category: "直轄市管河川", counties: ["新北市"] },
  八甲溪: { id: "bajia-river", ref: "107000", category: "直轄市管河川", counties: ["新北市"] },
  埔坪溪: { id: "puping-river", ref: "108000", category: "直轄市管河川", counties: ["新北市"], alias: "埔頭坑溪" },
  八蓮溪: { id: "balian-river", ref: "109000", category: "直轄市管河川", counties: ["新北市"], alias: "八連溪" },
  大屯溪: { id: "datun-river", ref: "110000", category: "直轄市管河川", counties: ["新北市"] },
  後洲溪: { id: "houzhou-river", ref: "111000", category: "直轄市管河川", counties: ["新北市"] },
  興仁溪: { id: "xingren-river", ref: "112000", category: "直轄市管河川", counties: ["新北市"] },
  林子溪: { id: "linzi-river", ref: "113000", category: "直轄市管河川", counties: ["新北市"], alias: "公司田溪" },
  紅水仙溪: { id: "hongshuixian-river", ref: "115000", category: "直轄市管河川", counties: ["新北市"] },
  寶斗溪: { id: "baodou-river", ref: "116000", category: "直轄市管河川", counties: ["新北市"] },
  林口溪: { id: "linkou-river", ref: "117000", category: "直轄市管河川", counties: ["新北市"] },
  南崁溪: { id: "nankan-river", ref: "118000", category: "直轄市管河川", counties: ["桃園市"] },
  老街溪: { id: "laojie-river", ref: "121000", category: "直轄市管河川", counties: ["桃園市"] },
  富林溪: { id: "fulin-river", ref: "122000", category: "直轄市管河川", counties: ["桃園市"] },
  大堀溪: { id: "daku-river", ref: "123000", category: "直轄市管河川", counties: ["桃園市"] },
  觀音溪: { id: "guanyin-river", ref: "124000", category: "直轄市管河川", counties: ["桃園市"] },
  新屋溪: { id: "xinwu-river", ref: "125000", category: "直轄市管河川", counties: ["桃園市"] },
  社子溪: { id: "shezi-river", ref: "126000", category: "直轄市管河川", counties: ["桃園市"] },
  溫寮溪: { id: "wenliao-river", ref: "141000", category: "直轄市管河川", counties: ["臺中市"] },
  雙溪: { id: "shuangxi-river", ref: "262000", category: "直轄市管河川", counties: ["新北市"] },
  尖山腳溪: { id: "jianshanjiao-river", ref: "263000", category: "直轄市管河川", counties: ["新北市"], alias: "石碇溪" },
  瑪鍊溪: { id: "malian-river", ref: "264000", category: "直轄市管河川", counties: ["新北市"], alias: "瑪鋉溪" },
  員潭溪: { id: "yuantan-river", ref: "265000", category: "直轄市管河川", counties: ["新北市"] },

  // ── 縣(市)管河川 65 水系（表 3）─────────────────────────────
  新豐溪: { id: "xinfeng-river", ref: "128000", category: "縣(市)管河川", counties: ["新竹縣"] },
  西湖溪: { id: "xihu-river", ref: "136000", category: "縣(市)管河川", counties: ["苗栗縣"] },
  通霄溪: { id: "tongxiao-river", ref: "137000", category: "縣(市)管河川", counties: ["苗栗縣"] },
  苑裡溪: { id: "yuanli-river", ref: "138000", category: "縣(市)管河川", counties: ["苗栗縣"] },
  房裡溪: { id: "fangli-river", ref: "139000", category: "縣(市)管河川", counties: ["苗栗縣"] },
  新虎尾溪: { id: "xinhuwei-river", ref: "152000", category: "縣(市)管河川", counties: ["雲林縣"] },
  林邊溪: { id: "linbian-river", ref: "176000", category: "縣(市)管河川", counties: ["屏東縣"] },
  率芒溪: { id: "shuaimang-river", ref: "179000", category: "縣(市)管河川", counties: ["屏東縣"] },
  十里溪: { id: "shili-river", ref: "181000", category: "縣(市)管河川", counties: ["屏東縣"], alias: "七里溪" },
  枋山溪: { id: "fangshan-river", ref: "182000", category: "縣(市)管河川", counties: ["屏東縣"] },
  楓港溪: { id: "fenggang-river", ref: "183000", category: "縣(市)管河川", counties: ["屏東縣"] },
  石盤溪: { id: "shipan-river", ref: "184000", category: "縣(市)管河川", counties: ["屏東縣"], alias: "大石盤溪" },
  保力溪: { id: "baoli-river", ref: "186000", category: "縣(市)管河川", counties: ["屏東縣"] },
  港口溪: { id: "gangkou-river", ref: "201000", category: "縣(市)管河川", counties: ["屏東縣"] },
  九棚溪: { id: "jiupeng-river", ref: "202000", category: "縣(市)管河川", counties: ["屏東縣"] },
  港子溪: { id: "gangzi-river", ref: "203000", category: "縣(市)管河川", counties: ["屏東縣"], alias: "港仔溪" },
  牡丹溪: { id: "mudan-river", ref: "204000", category: "縣(市)管河川", counties: ["屏東縣"], alias: "旭海溪" },
  里仁溪: { id: "liren-river", ref: "205000", category: "縣(市)管河川", counties: ["屏東縣"] },
  塔瓦溪: { id: "tawa-river", ref: "206000", category: "縣(市)管河川", counties: ["臺東縣"] },
  達仁溪: { id: "daren-river", ref: "207000", category: "縣(市)管河川", counties: ["臺東縣"] },
  安朔溪: { id: "anshuo-river", ref: "208000", category: "縣(市)管河川", counties: ["臺東縣"] },
  朝庸溪: { id: "chaoyong-river", ref: "209000", category: "縣(市)管河川", counties: ["臺東縣"] },
  大武溪: { id: "dawu-river", ref: "210000", category: "縣(市)管河川", counties: ["臺東縣"] },
  烏萬溪: { id: "wuwan-river", ref: "211000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "大鳥溪" },
  津林溪: { id: "jinlin-river", ref: "212000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "加津林溪" },
  大竹溪: { id: "dazhu-river", ref: "213000", category: "縣(市)管河川", counties: ["臺東縣"] },
  金崙溪: { id: "jinlun-river", ref: "214000", category: "縣(市)管河川", counties: ["臺東縣"] },
  太麻里溪: { id: "taimali-river", ref: "215000", category: "縣(市)管河川", counties: ["臺東縣"] },
  文里溪: { id: "wenli-river", ref: "216000", category: "縣(市)管河川", counties: ["臺東縣"] },
  知本溪: { id: "zhiben-river", ref: "217000", category: "縣(市)管河川", counties: ["臺東縣"] },
  利嘉溪: { id: "lijia-river", ref: "218000", category: "縣(市)管河川", counties: ["臺東縣"] },
  太平溪: { id: "taiping-river", ref: "219000", category: "縣(市)管河川", counties: ["臺東縣"] },
  都蘭溪: { id: "dulan-river", ref: "221000", category: "縣(市)管河川", counties: ["臺東縣"] },
  八里溪: { id: "bali-river", ref: "222000", category: "縣(市)管河川", counties: ["臺東縣"] },
  馬武溪: { id: "mawu-river", ref: "223000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "馬武窟溪" },
  成功溪: { id: "chenggong-river", ref: "224000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "新港溪" },
  富家溪: { id: "fujia-river", ref: "225000", category: "縣(市)管河川", counties: ["臺東縣"] },
  都威溪: { id: "duwei-river", ref: "226000", category: "縣(市)管河川", counties: ["臺東縣"] },
  沙灣溪: { id: "shawan-river", ref: "227000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "大濱溪" },
  寧埔溪: { id: "ningpu-river", ref: "228000", category: "縣(市)管河川", counties: ["臺東縣"] },
  竹湖溪: { id: "zhuhu-river", ref: "229000", category: "縣(市)管河川", counties: ["臺東縣"] },
  大德溪: { id: "dade-river", ref: "230000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "掃別溪" },
  長濱溪: { id: "changbin-river", ref: "231000", category: "縣(市)管河川", counties: ["臺東縣"] },
  城埔溪: { id: "chengpu-river", ref: "232000", category: "縣(市)管河川", counties: ["臺東縣"] },
  馬海溪: { id: "mahai-river", ref: "233000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "馬家溪" },
  山間溪: { id: "shanjian-river", ref: "234000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "三間屋溪" },
  水母溪: { id: "shuimu-river", ref: "235000", category: "縣(市)管河川", counties: ["臺東縣"], alias: "水母丁溪" },
  三富溪: { id: "sanfu-river", ref: "236000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  豐濱溪: { id: "fengbin-river", ref: "238000", category: "縣(市)管河川", counties: ["花蓮縣"], alias: "貓公溪" },
  加蘭溪: { id: "jialan-river", ref: "239000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  薯寮溪: { id: "shuliao-river", ref: "240000", category: "縣(市)管河川", counties: ["花蓮縣"], alias: "蕃薯寮溪" },
  水連溪: { id: "shuilian-river", ref: "241000", category: "縣(市)管河川", counties: ["花蓮縣"], alias: "水璉溪" },
  吉安溪: { id: "jian-river", ref: "243000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  美崙溪: { id: "meilun-river", ref: "244000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  三棧溪: { id: "sanzhan-river", ref: "245000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  立霧溪: { id: "liwu-river", ref: "246000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  石公溪: { id: "shigong-river", ref: "247000", category: "縣(市)管河川", counties: ["花蓮縣"] },
  大富溪: { id: "dafu-river", ref: "248000", category: "縣(市)管河川", counties: ["花蓮縣"], alias: "小清水溪" },
  大清水溪: { id: "daqingshui-river", ref: "249000", category: "縣(市)管河川", counties: ["花蓮縣"], alias: "良里溪" },
  南澳溪: { id: "nanao-river", ref: "251000", category: "縣(市)管河川", counties: ["宜蘭縣"] },
  東澳溪: { id: "dongao-river", ref: "252000", category: "縣(市)管河川", counties: ["宜蘭縣"], alias: "東澳北溪" },
  蘇澳溪: { id: "suao-river", ref: "253000", category: "縣(市)管河川", counties: ["宜蘭縣"] },
  新城溪: { id: "xincheng-river", ref: "254000", category: "縣(市)管河川", counties: ["宜蘭縣"] },
  得子口溪: { id: "dezikou-river", ref: "257000", category: "縣(市)管河川", counties: ["宜蘭縣"] },
  大溪川: { id: "daxi-river", ref: "261000", category: "縣(市)管河川", counties: ["宜蘭縣"] },
};

/** 河川中文名 → 本站 id。從 `RIVERS` 衍生，不要另外維護。 */
export const RIVER_IDS = Object.fromEntries(
  Object.entries(RIVERS).map(([name, r]) => [name, r.id]),
);

/**
 * 河川中文名 → OSM `waterway` 關聯的 `ref`（＝水利署河川代碼）。從 `RIVERS` 衍生。
 *
 * ## 為什麼 OSM 可用，RIVERLIN 不行
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
 * 實測 118 個關聯**全部**都有 `main_stream` 角色的成員，沒有例外。
 *
 * ## ⚠️ 有五條河的長度對不上官方數字，這是量測基準差異，不是選錯河
 *
 * 實測（2026-08）：中央管／跨省市那 26 條裡有 21 條在 ±15% 內（其中 17 條在
 * ±5% 內），另外五條——阿公店溪 -50%、後龍溪 -31%、花蓮溪 -21%、北港溪 -19%、
 * **卑南溪 +17%**。
 *
 * 偏長與偏短是兩件不同的事，都不是錯誤：
 * - **偏長**（卑南溪）是 OSM 把上游改名的河段完整收進 `main_stream`，而官方
 *   長度是從另一個界點起算的。幾何是完整的，這個方向不需要處理。
 * - **偏短**的四條是上游河段在 OSM 尚未數化。都試過補接上游關聯，結論是**不補**：
 *   - 北港溪的虎尾溪、花蓮溪的光復溪，它們的 way **已經在母關聯裡**（實測逐條
 *     比對，去重後總長一個公尺都沒變）；缺的是更上游的河段。
 *   - 後龍溪補上汶水溪關聯後長度確實回到 -5%，但兩段之間**有 4.26 公里的缺口**
 *     （那段在 OSM 裡沒有任何以這兩個名字命名的 way），畫出來是中間斷開的兩截線。
 *     一條在地圖上斷掉的河，比一條短了三成的河更容易讓人誤解。
 *   - 阿公店溪補上濁水溪（167010）後仍是 -33%。
 *
 * 圖上畫的是 OSM 的幹流幾何，卡片與清單上的長度一律是官方數字——兩者本來就是
 * 不同來源，差距只影響「線畫到哪裡」，不影響教學數字。
 *
 * `build-geodata.mjs` 因此只在差距 >15% 時印提醒、>60% 才讓建置失敗（那個量級
 * 代表選到同名的小溪流或抓成整個水系，是真的選錯）。**其餘 92 條沒有官方長度
 * 可比對，那道防線在它們身上不成立**——它們靠的是「`ref` 精確比對且選中數必須
 * 剛好是 1」（見 `fetchRouteLines`）。
 */
export const RIVER_OSM_REFS = Object.fromEntries(
  Object.entries(RIVERS).map(([name, r]) => [name, r.ref]),
);

/**
 * 幹流長度（公里）與流域面積（平方公里）＋管理等級。
 *
 * ⚠️ **只有 26 條中央管／跨省市河川在這裡面**——其餘 92 條沒有官方數字（見
 * `RIVERS` 的說明）。`tw-basins` 直接以這 26 筆為清單，正好也是 BASIN 那份
 * SHP 涵蓋的範圍。
 */
export const RIVER_FACTS = Object.fromEntries(
  Object.entries(RIVERS)
    .filter(([, r]) => r.length_km != null)
    .map(([name, r]) => [
      name,
      { length_km: r.length_km, area_km2: r.area_km2, category: r.category },
    ]),
);

/**
 * 流域分區（BASIN，面）的 id，從全部 118 筆衍生，不是另外維護一份表。
 *
 * ⚠️ **這裡是 118 筆，但 `tw-basins.geojson` 只會有 72 筆。** 上游的 BASIN 圖資
 * 只給其中 72 個水系個別的流域代碼（`BASIN_NO` ＝河川代碼去掉末位），其餘 46 條
 * 的集水區被歸在「沒有個別代碼的小水系」群組碼底下（例如 2803 底下有 5 條北海岸
 * 小溪），拿群組裡任一條當成某條官方河川的流域是猜的。所以 `build-geodata.mjs`
 * 的 transform 對不到就跳過並印出清單——**那是預期中的資料範圍差異，不是錯誤**，
 * 不要為了湊滿 118 而改用名稱比對（上游有錯字、異體字與同名不同河，見該處說明）。
 *
 * ⚠️ 刻意換成 `-basin` 尾綴，**不是**跟河川線共用同一個 id。「水系」這個群組
 * 現在有河川線（`tw-rivers`）跟流域面（`tw-basins`）兩個各自獨立可勾選的圖層，
 * 兩者是「同一條河的兩種呈現方式」而不是父子關係（不像五大山脈→主峰那種
 * `attach`），所以沒有走 `parentProperty` 那套連動強調機制。如果兩層共用同一個
 * id，選取其中一層會不會意外連動強調另一層目前沒有測過、行為未定義——比照
 * `RIVERS` 的 id 當初為了不跟水庫撞名而加 `-river` 尾綴的同一個理由，這裡也
 * 用尾綴把 id 命名空間分開，讓行為可預測。
 */
export const BASIN_IDS = Object.fromEntries(
  Object.entries(RIVERS).map(([name, r]) => [name, r.id.replace(/-river$/, "-basin")]),
);
