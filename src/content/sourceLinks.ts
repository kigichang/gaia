/**
 * 已知資料來源名稱 → 官方網站連結。
 *
 * key 必須與各內容檔 `sources` 陣列裡的字串完全一致。沒有列在這裡的來源名稱
 * 會照舊顯示為純文字，不會壞掉——新增內容時不必馬上補連結。
 *
 * 維基百科是**次級來源**：它適合用來查山脈走向、主峰高度這類已經有共識的
 * 基本地理事實，但凡是數值型的權威資料（氣候正常值、人口統計、保育等級）
 * 一律仍以主管機關的原始資料為準。並列時把官方來源寫在維基百科後面，
 * 讀者才看得出哪一筆能追到原始出處。
 */
export const SOURCE_LINKS: Record<string, string> = {
  交通部中央氣象署: "https://www.cwa.gov.tw/V8/C/C/Statistics/monthlydata.html",
  /**
   * 颱風路徑與災損那一層的實際來源頁。
   *
   * ⚠️ 不能只寫「交通部中央氣象署」連到氣象署首頁——最佳路徑資料與「颱風概況表」
   * 都只在這個子站上，連到首頁等於追不到（比照「行政院 國情簡介－土地」的既有判斷）。
   */
  // ⚠️ 泛稱的「交通部中央氣象署」現在指向每月氣象統計（地點的氣候敘述用得到）。
  // 災害地震那一層引用的是另一份東西——氣象署地震測報中心的〈災害地震〉表，
  // 所以另立一個標籤，比照颱風資料庫的既有做法。
  "交通部中央氣象署 災害地震": "https://scweb.cwa.gov.tw/zh-tw/page/disaster/5",
  // 26 條中央管／跨省市河川的官方長度與流域面積出自這張總表。
  "經濟部水利署 河川長度": "https://www.wra.gov.tw/cp.aspx?n=3163&dn=3164",
  "交通部中央氣象署 颱風資料庫": "https://rdc28.cwa.gov.tw/TDB/",
  // 「臺灣123」島群面積的主管機關。連方域業務那一頁——領土範圍、領海基線的公告都在這裡，
  // 連到內政部首頁等於追不到（比照「行政院 國情簡介－土地」的既有判斷）。
  內政部: "https://www.land.moi.gov.tw/chhtml/content/68?mcid=3225",
  // 颱風概況表自己註明「災情節錄自內政部消防署及行政院農委會資料」，
  // 所以死亡與失蹤人數的原始主管機關是消防署、農損是農業部（前農委會）
  // 颱風概況表的死亡與失蹤人數節錄自消防署，連的是它的「天然災害統計」那一頁。
  內政部消防署: "https://www.nfa.gov.tw/cht/index.php?code=list&ids=233",
  // 颱風的農損數字節錄自農業部，連的是農業統計資料查詢系統。
  農業部: "https://agrstat.moa.gov.tw/sdweb/public/inquiry/InquireAdvance.aspx",
  // 縣市界、鄉鎮市區界、地形圖都出自這裡。連「國土測繪圖資服務雲」的開放資料下載頁
  // ——那是真的拿得到檔案的地方，不是首頁。個別資料集另有 data.gov.tw 的 7442／7441。
  內政部國土測繪中心: "https://whgis.nlsc.gov.tw/Opendata/Files.aspx",
  /**
   * 專屬經濟海域那一層的三個來源。
   *
   * ⚠️ `Marine Regions 海域界線資料庫` 是 **CC-BY 的署名義務**，不是可有可無的
   * 外連——`FeatureCard` 有內容檔時顯示的是內容檔的 `sources`，四份內容檔少了
   * 這個字串，署名就會憑空消失（比照 tw-rivers 對 OpenStreetMap 的 ODbL 署名）。
   *
   * 另外兩筆連的是**條文與公告本身**，不是主管機關首頁：這一層的重點正是
   * 「200 浬有法源，但外界線至今未公告」，連到首頁等於追不到那句話
   * （比照「行政院 國情簡介－土地」的既有判斷）。
   */
  "Marine Regions 海域界線資料庫": "https://www.marineregions.org/eezsearch.php",
  /**
   * 海峽中線那一層的兩個來源。
   *
   * ⚠️ 國防部**沒有把中線座標放成一份可連結的公告或開放資料**——2019-07-30 那組數字
   * 是記者會上公布的，只能連到國防部全球資訊網。維基百科在這裡因此不是「順便附上」，
   * 而是唯一能讓讀者追到各版本座標與越線事件時序的地方，比照 97 條河川的既有做法
   * （來源名稱帶條目名，不是泛稱的「維基百科」）。
   */
  中華民國國防部: "https://www.mnd.gov.tw/",
  /**
   * 北回歸線那一層唯一的外部來源：標誌碑的位置與設立年代。
   *
   * ⚠️ 緯度值（23.43661°）與每年南移約 14 公尺**不是**從這裡來的——那是地球轉軸
   * 傾角的天文常數，由 `generators.ts` 的 `LATITUDE_LINES` 直接給，不需要外部來源。
   */
  "維基百科 嘉義北回歸線標誌":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E5%8C%97%E5%9B%9E%E6%AD%B8%E7%B7%9A%E6%A8%99%E8%AA%8C",
  "維基百科 臺灣海峽中線":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E7%81%A3%E6%B5%B7%E5%B3%BD%E4%B8%AD%E7%B7%9A",
  中華民國專屬經濟海域及大陸礁層法:
    "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0000010",
  "海洋委員會 中華民國第一批領海基線":
    "https://www.oac.gov.tw/ch/home.jsp?id=243&parentpath=0,4,242",
  // 「臺灣123」那一組島群數字的出處（該頁自己標的資料來源是內政部）。
  // 連的是那一頁本身：面積、島嶼數、經緯度全在這一頁，連到行政院首頁等於追不到。
  "行政院 國情簡介－土地":
    "https://www.ey.gov.tw/state/4447F4A951A1EC45/094b1d53-de8d-4393-bde6-ab092969cce4",
  "內政部 114年第6週內政統計通報（113年底原住民人口數）":
    "https://www.moi.gov.tw/News_Content.aspx?n=2905&s=325345",
  "內政部戶政司 114年各鄉鎮市區人口密度":
    "https://data.gov.tw/dataset/8410",
  原住民族委員會全球資訊網: "https://www.cip.gov.tw/zh-tw/tribe/grid-list/index.html",
  "原住民族委員會 113年4月原住民族人口數統計資料":
    "https://www.cip.gov.tw/zh-tw/news/data-list/940F9579765AC6A0/index.html?cumid=940F9579765AC6A0",
  台灣原住民族文化知識網: "https://knowlegde.gov.taipei/",
  內政部國家公園署: "https://data.gov.tw/dataset/174421",
  玉山國家公園管理處: "https://www.ysnp.gov.tw/Folder/Resource",
  雪霸國家公園管理處: "https://www.spnp.gov.tw/cp.aspx?n=14499",
  太魯閣國家公園管理處: "https://www.taroko.gov.tw/cp.aspx?n=5443",
  陽明山國家公園管理處: "https://www.ymsnp.gov.tw/cp.aspx?n=18110",
  墾丁國家公園管理處: "https://www.ktnp.gov.tw/cp.aspx?n=4752B9BC22AAF612",
  臺江國家公園管理處: "https://www.tjnp.gov.tw/cp.aspx?n=373",
  金門國家公園管理處: "https://www.kmnp.gov.tw/",
  // 東沙環礁與澎湖南方四島兩座海洋型國家公園同屬這一處
  海洋國家公園管理處: "https://www.marine.gov.tw/zh_tw/about/mnph/History",
  北海岸及觀音山國家風景區管理處: "https://www.northguan-nsa.gov.tw/",
  澎湖國家風景區管理處: "https://www.penghu-nsa.gov.tw/AboutUs/A01.htm",
  // 景點座標出自觀光署的開放資料（北回歸線標誌碑那三處就是從這裡抄的）。
  交通部觀光署: "https://media.taiwan.net.tw/",
  // 北回歸線標誌碑那一組的第二個來源：瑞穗那座的設立年代、1981 年遷移的原因，
  // 以及「北緯 23 度 27 分 4.51 秒」這個名目緯度，都只在鄉公所自己的頁面上。
  花蓮縣瑞穗鄉公所: "https://www.juisui.gov.tw/cp.aspx?n=1685",
  // 燈塔的主管機關（本島四極的地標有三個是燈塔）
  交通部航港局: "https://www.motcmpb.gov.tw/Article?siteId=1&nodeId=75",
  // 河川流域範圍圖與水庫蓄水範圍都是從水利空間資訊服務平台下載的。
  // ⚠️ 河川的官方長度是另一頁，見下面的「經濟部水利署 河川長度」。
  經濟部水利署: "https://gic.wra.gov.tw/",

  /**
   * 47 條河川各自的官方介紹頁（水利署「讓我們看河去」）。走既有的 sources 機制
   * 而不是另外開一個欄位，比照 33 條活動斷層與 43 處保留區的既有決定：內容檔的
   * `sources` 寫 `經濟部水利署 濁水溪`，SourceLinks 就會把它渲染成連到那一頁的
   * 連結，同時滿足「標示出處」與「使用者想點進去看官方原文」兩件事。
   *
   * 兩批的頁面形狀不同，這件事在取材時會遇到：
   * - **26 條中央管／跨省市河川**是一河一頁（網址帶 `dn`），表格欄位是
   *   發源地／主流長度／入海口／河床平均坡降／主要支流／流域面積／平地面積／
   *   山地面積／流經行政區。
   * - **21 條直轄市管／縣(市)管河川**是**一頁講好幾條**（例如 n=3337 一頁就是
   *   率芒溪、枋山溪、楓港溪三條），欄位少一些：發源地／主要支流／幹線長度／
   *   流域面積／平均坡度／流經區域。同一頁的河川共用同一個網址是正常的。
   *
   * ⚠️ 37 個網址全部實測回 200（2026-08）。`cp.aspx?n=` 這種查詢字串式的網址
   * 沒有版本承諾，改版時舊網址會直接失效而卡片上只剩一個死連結——重新整理這一
   * 區塊時，從 cl.aspx?n=3259（北部）／3270（中部）／3285（南部）／3306（東部）／
   * 3328（縣市管）五個索引頁重新抓連結，不要憑印象改數字。
   */
  "經濟部水利署 蘭陽溪": "https://www.wra.gov.tw/cp.aspx?n=3260&dn=3261",
  "經濟部水利署 淡水河": "https://www.wra.gov.tw/cp.aspx?n=3262&dn=3263",
  "經濟部水利署 磺溪": "https://www.wra.gov.tw/cp.aspx?n=3264&dn=3265",
  "經濟部水利署 鳳山溪": "https://www.wra.gov.tw/cp.aspx?n=3266&dn=3267",
  "經濟部水利署 頭前溪": "https://www.wra.gov.tw/cp.aspx?n=3268&dn=3269",
  "經濟部水利署 中港溪": "https://www.wra.gov.tw/cp.aspx?n=3271&dn=3272",
  "經濟部水利署 後龍溪": "https://www.wra.gov.tw/cp.aspx?n=3273&dn=3274",
  "經濟部水利署 大安溪": "https://www.wra.gov.tw/cp.aspx?n=3275&dn=3276",
  "經濟部水利署 大甲溪": "https://www.wra.gov.tw/cp.aspx?n=3277&dn=3278",
  "經濟部水利署 烏溪": "https://www.wra.gov.tw/cp.aspx?n=3279&dn=3280",
  "經濟部水利署 濁水溪": "https://www.wra.gov.tw/cp.aspx?n=3281&dn=3282",
  "經濟部水利署 北港溪": "https://www.wra.gov.tw/cp.aspx?n=3283&dn=3284",
  "經濟部水利署 朴子溪": "https://www.wra.gov.tw/cp.aspx?n=3286&dn=3287",
  "經濟部水利署 八掌溪": "https://www.wra.gov.tw/cp.aspx?n=3288&dn=3289",
  "經濟部水利署 急水溪": "https://www.wra.gov.tw/cp.aspx?n=3290&dn=3291",
  "經濟部水利署 曾文溪": "https://www.wra.gov.tw/cp.aspx?n=3292&dn=3293",
  "經濟部水利署 鹽水溪": "https://www.wra.gov.tw/cp.aspx?n=3294&dn=3295",
  "經濟部水利署 二仁溪": "https://www.wra.gov.tw/cp.aspx?n=3296&dn=3297",
  "經濟部水利署 阿公店溪": "https://www.wra.gov.tw/cp.aspx?n=3298&dn=3299",
  "經濟部水利署 高屏溪": "https://www.wra.gov.tw/cp.aspx?n=3300&dn=3301",
  "經濟部水利署 東港溪": "https://www.wra.gov.tw/cp.aspx?n=3302&dn=3303",
  "經濟部水利署 四重溪": "https://www.wra.gov.tw/cp.aspx?n=3304&dn=3305",
  "經濟部水利署 卑南溪": "https://www.wra.gov.tw/cp.aspx?n=3307&dn=3308",
  "經濟部水利署 秀姑巒溪": "https://www.wra.gov.tw/cp.aspx?n=3309&dn=3310",
  "經濟部水利署 花蓮溪": "https://www.wra.gov.tw/cp.aspx?n=3311&dn=3312",
  "經濟部水利署 和平溪": "https://www.wra.gov.tw/cp.aspx?n=3313&dn=3314",
  // 以下 21 條走「讓我們看河去(縣市管河川)」，同一頁講好幾條
  "經濟部水利署 南澳溪": "https://www.wra.gov.tw/cp.aspx?n=3330",
  "經濟部水利署 蘇澳溪": "https://www.wra.gov.tw/cp.aspx?n=3330",
  "經濟部水利署 新城溪": "https://www.wra.gov.tw/cp.aspx?n=3330",
  "經濟部水利署 得子口溪": "https://www.wra.gov.tw/cp.aspx?n=3331",
  "經濟部水利署 雙溪": "https://www.wra.gov.tw/cp.aspx?n=3332",
  "經濟部水利署 南崁溪": "https://www.wra.gov.tw/cp.aspx?n=3333",
  "經濟部水利署 老街溪": "https://www.wra.gov.tw/cp.aspx?n=3333",
  "經濟部水利署 社子溪": "https://www.wra.gov.tw/cp.aspx?n=3333",
  "經濟部水利署 西湖溪": "https://www.wra.gov.tw/cp.aspx?n=3335",
  "經濟部水利署 新虎尾溪": "https://www.wra.gov.tw/cp.aspx?n=3336",
  "經濟部水利署 率芒溪": "https://www.wra.gov.tw/cp.aspx?n=3337",
  "經濟部水利署 枋山溪": "https://www.wra.gov.tw/cp.aspx?n=3337",
  "經濟部水利署 楓港溪": "https://www.wra.gov.tw/cp.aspx?n=3337",
  "經濟部水利署 保力溪": "https://www.wra.gov.tw/cp.aspx?n=3338",
  "經濟部水利署 港口溪": "https://www.wra.gov.tw/cp.aspx?n=3338",
  "經濟部水利署 知本溪": "https://www.wra.gov.tw/cp.aspx?n=3339",
  "經濟部水利署 利嘉溪": "https://www.wra.gov.tw/cp.aspx?n=3339",
  "經濟部水利署 太平溪": "https://www.wra.gov.tw/cp.aspx?n=3339",
  "經濟部水利署 吉安溪": "https://www.wra.gov.tw/cp.aspx?n=3340",
  "經濟部水利署 美崙溪": "https://www.wra.gov.tw/cp.aspx?n=3340",
  "經濟部水利署 立霧溪": "https://www.wra.gov.tw/cp.aspx?n=3341",

  農業部農田水利署: "https://www.ia.gov.tw/zh-TW/about/articles?a=89",
  // 這個標籤最常被引用的是保育等級（特有種那五份、垂直植被帶）。
  農業部林業及自然保育署: "https://www.forest.gov.tw/0008324",
  // 垂直植被帶那六個高程界線的實際出處。連的是那一頁本身而不是農業部首頁：
  // 六帶與界線只有這一頁講得完整，而全站的既有承諾是「資料要能追溯出處」。
  // ⚠️ 舊網域 kids.coa.gov.tw 仍然搜得到，農業部改制後已改為 kids.moa.gov.tw。
  "農業部農業兒童網 山地植群帶分布":
    "https://kids.moa.gov.tw/view.php?func=knowledge&subfunc=kids_knowledge&category=B16&id=27",
  // 上面那一頁自己標的製作單位（發行是林務局，即現在的林業及自然保育署）
  國立臺灣大學生物多樣性研究中心: "https://www.brc.ntu.edu.tw/",
  // 主要作物分布的來源（農情調查）
  農業部農糧署: "https://data.gov.tw/dataset/7302",
  // 古蹟圖層的來源。網站名是「國家文化資產網」，每一處古蹟的官方頁面都在它底下
  // （MonumentCard 用 geojson 的 url 屬性直接連到個案頁）。
  文化部文化資產局: "https://data.gov.tw/dataset/6246",
  /**
   * 洋流那一層的另一個來源。連的是 NOAA Ocean Service 的洋流教學專頁而不是首頁：
   * 暖流／寒流、環流方向與湧升流的說明都在這一頁，連到首頁等於追不到
   * （比照「農業部農業兒童網 山地植群帶分布」的既有判斷）。
   */
  "美國國家海洋暨大氣總署（NOAA）":
    "https://oceanservice.noaa.gov/education/tutorial_currents/",

  // 97 條沒有官方詳細資料的河川，改用維基百科（見 CLAUDE_TW.md 的說明）。
  // ⚠️ 這裡刻意逐條登記真正的條目名，不要改成從河川名自動組網址：
  // 公告名與條目名有 27 條對不上，而且花蓮那兩條會**互相對調**
  //（公告「大清水溪」＝條目「良里溪」、公告「大富溪」的條目 native_name 才是小清水溪），
  // 自動組出來的網址會靜靜地連到另一條同名的河。
  "維基百科 七里溪": "https://zh.wikipedia.org/zh-tw/%E4%B8%83%E9%87%8C%E6%BA%AA",
  "維基百科 七家灣溪": "https://zh.wikipedia.org/zh-tw/%E4%B8%83%E5%AE%B6%E7%81%A3%E6%BA%AA",
  "維基百科 九棚溪": "https://zh.wikipedia.org/zh-tw/%E4%B9%9D%E6%A3%9A%E6%BA%AA",
  "維基百科 八甲溪": "https://zh.wikipedia.org/zh-tw/%E5%85%AB%E7%94%B2%E6%BA%AA",
  "維基百科 八里溪": "https://zh.wikipedia.org/zh-tw/%E5%85%AB%E9%87%8C%E6%BA%AA",
  "維基百科 八連溪 (三芝區)": "https://zh.wikipedia.org/zh-tw/%E5%85%AB%E9%80%A3%E6%BA%AA%20(%E4%B8%89%E8%8A%9D%E5%8D%80)",
  "維基百科 三富溪": "https://zh.wikipedia.org/zh-tw/%E4%B8%89%E5%AF%8C%E6%BA%AA",
  "維基百科 三棧溪": "https://zh.wikipedia.org/zh-tw/%E4%B8%89%E6%A3%A7%E6%BA%AA",
  "維基百科 上坪溪": "https://zh.wikipedia.org/zh-tw/%E4%B8%8A%E5%9D%AA%E6%BA%AA",
  "維基百科 大屯溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%B1%AF%E6%BA%AA",
  "維基百科 大竹溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E7%AB%B9%E6%BA%AA",
  "維基百科 大里溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E9%87%8C%E6%BA%AA",
  "維基百科 大武溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E6%AD%A6%E6%BA%AA",
  "維基百科 大堀溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%A0%80%E6%BA%AA",
  "維基百科 大富溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%AF%8C%E6%BA%AA",
  "維基百科 大溪川": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E6%BA%AA%E5%B7%9D",
  "維基百科 冬山河": "https://zh.wikipedia.org/zh-tw/%E5%86%AC%E5%B1%B1%E6%B2%B3",
  "維基百科 羅東溪": "https://zh.wikipedia.org/zh-tw/%E7%BE%85%E6%9D%B1%E6%BA%AA",
  "維基百科 外雙溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%96%E9%9B%99%E6%BA%AA",
  "維基百科 大德溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%BE%B7%E6%BA%AA",
  "維基百科 小坑溪 (石門區)": "https://zh.wikipedia.org/zh-tw/%E5%B0%8F%E5%9D%91%E6%BA%AA%20(%E7%9F%B3%E9%96%80%E5%8D%80)",
  "維基百科 山間溪": "https://zh.wikipedia.org/zh-tw/%E5%B1%B1%E9%96%93%E6%BA%AA",
  "維基百科 太麻里溪": "https://zh.wikipedia.org/zh-tw/%E5%A4%AA%E9%BA%BB%E9%87%8C%E6%BA%AA",
  "維基百科 文里溪": "https://zh.wikipedia.org/zh-tw/%E6%96%87%E9%87%8C%E6%BA%AA",
  "維基百科 木瓜溪": "https://zh.wikipedia.org/zh-tw/%E6%9C%A8%E7%93%9C%E6%BA%AA",
  "維基百科 水母溪": "https://zh.wikipedia.org/zh-tw/%E6%B0%B4%E6%AF%8D%E6%BA%AA",
  "維基百科 水連溪": "https://zh.wikipedia.org/zh-tw/%E6%B0%B4%E9%80%A3%E6%BA%AA",
  "維基百科 加蘭溪": "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E8%98%AD%E6%BA%AA",
  "維基百科 北勢溪 (新北市)": "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E5%8B%A2%E6%BA%AA%20(%E6%96%B0%E5%8C%97%E5%B8%82)",
  "維基百科 石公溪": "https://zh.wikipedia.org/zh-tw/%E7%9F%B3%E5%85%AC%E6%BA%AA",
  "維基百科 石門溪": "https://zh.wikipedia.org/zh-tw/%E7%9F%B3%E9%96%80%E6%BA%AA",
  "維基百科 石盤溪": "https://zh.wikipedia.org/zh-tw/%E7%9F%B3%E7%9B%A4%E6%BA%AA",
  "維基百科 安朔溪": "https://zh.wikipedia.org/zh-tw/%E5%AE%89%E6%9C%94%E6%BA%AA",
  "維基百科 尖山腳溪": "https://zh.wikipedia.org/zh-tw/%E5%B0%96%E5%B1%B1%E8%85%B3%E6%BA%AA",
  "維基百科 旭海溪": "https://zh.wikipedia.org/zh-tw/%E6%97%AD%E6%B5%B7%E6%BA%AA",
  "維基百科 竹湖溪": "https://zh.wikipedia.org/zh-tw/%E7%AB%B9%E6%B9%96%E6%BA%AA",
  "維基百科 老田寮溪": "https://zh.wikipedia.org/zh-tw/%E8%80%81%E7%94%B0%E5%AF%AE%E6%BA%AA",
  "維基百科 老梅溪": "https://zh.wikipedia.org/zh-tw/%E8%80%81%E6%A2%85%E6%BA%AA",
  "維基百科 汶水溪": "https://zh.wikipedia.org/zh-tw/%E6%B1%B6%E6%B0%B4%E6%BA%AA",
  "維基百科 沙灣溪": "https://zh.wikipedia.org/zh-tw/%E6%B2%99%E7%81%A3%E6%BA%AA",
  "維基百科 良里溪": "https://zh.wikipedia.org/zh-tw/%E8%89%AF%E9%87%8C%E6%BA%AA",
  "維基百科 里仁溪": "https://zh.wikipedia.org/zh-tw/%E9%87%8C%E4%BB%81%E6%BA%AA",
  "維基百科 官田溪": "https://zh.wikipedia.org/zh-tw/%E5%AE%98%E7%94%B0%E6%BA%AA",
  "維基百科 宜蘭河": "https://zh.wikipedia.org/zh-tw/%E5%AE%9C%E8%98%AD%E6%B2%B3",
  "維基百科 房裡溪": "https://zh.wikipedia.org/zh-tw/%E6%88%BF%E8%A3%A1%E6%BA%AA",
  "維基百科 東澳溪": "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E6%BE%B3%E6%BA%AA",
  "維基百科 林口溪": "https://zh.wikipedia.org/zh-tw/%E6%9E%97%E5%8F%A3%E6%BA%AA",
  "維基百科 林子溪": "https://zh.wikipedia.org/zh-tw/%E6%9E%97%E5%AD%90%E6%BA%AA",
  "維基百科 林邊溪": "https://zh.wikipedia.org/zh-tw/%E6%9E%97%E9%82%8A%E6%BA%AA",
  "維基百科 金崙溪": "https://zh.wikipedia.org/zh-tw/%E9%87%91%E5%B4%99%E6%BA%AA",
  "維基百科 長濱溪": "https://zh.wikipedia.org/zh-tw/%E9%95%B7%E6%BF%B1%E6%BA%AA",
  "維基百科 南勢溪": "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E5%8B%A2%E6%BA%AA",
  "維基百科 城埔溪": "https://zh.wikipedia.org/zh-tw/%E5%9F%8E%E5%9F%94%E6%BA%AA",
  "維基百科 後洲溪": "https://zh.wikipedia.org/zh-tw/%E5%BE%8C%E6%B4%B2%E6%BA%AA",
  "維基百科 津林溪": "https://zh.wikipedia.org/zh-tw/%E6%B4%A5%E6%9E%97%E6%BA%AA",
  "維基百科 紅水仙溪": "https://zh.wikipedia.org/zh-tw/%E7%B4%85%E6%B0%B4%E4%BB%99%E6%BA%AA",
  "維基百科 紅葉溪": "https://zh.wikipedia.org/zh-tw/%E7%B4%85%E8%91%89%E6%BA%AA",
  "維基百科 苑裡溪": "https://zh.wikipedia.org/zh-tw/%E8%8B%91%E8%A3%A1%E6%BA%AA",
  "維基百科 員潭溪": "https://zh.wikipedia.org/zh-tw/%E5%93%A1%E6%BD%AD%E6%BA%AA",
  "維基百科 埔坪溪": "https://zh.wikipedia.org/zh-tw/%E5%9F%94%E5%9D%AA%E6%BA%AA",
  "維基百科 烏萬溪": "https://zh.wikipedia.org/zh-tw/%E7%83%8F%E8%90%AC%E6%BA%AA",
  "維基百科 真柄溪": "https://zh.wikipedia.org/zh-tw/%E7%9C%9F%E6%9F%84%E6%BA%AA",
  "維基百科 馬太鞍溪": "https://zh.wikipedia.org/zh-tw/%E9%A6%AC%E5%A4%AA%E9%9E%8D%E6%BA%AA",
  "維基百科 馬武窟溪": "https://zh.wikipedia.org/zh-tw/%E9%A6%AC%E6%AD%A6%E7%AA%9F%E6%BA%AA",
  "維基百科 乾華溪": "https://zh.wikipedia.org/zh-tw/%E4%B9%BE%E8%8F%AF%E6%BA%AA",
  "維基百科 基隆河": "https://zh.wikipedia.org/zh-tw/%E5%9F%BA%E9%9A%86%E6%B2%B3",
  "維基百科 清水溪 (濁水溪)": "https://zh.wikipedia.org/zh-tw/%E6%B8%85%E6%B0%B4%E6%BA%AA%20(%E6%BF%81%E6%B0%B4%E6%BA%AA)",
  "維基百科 通霄溪": "https://zh.wikipedia.org/zh-tw/%E9%80%9A%E9%9C%84%E6%BA%AA",
  "維基百科 都威溪": "https://zh.wikipedia.org/zh-tw/%E9%83%BD%E5%A8%81%E6%BA%AA",
  "維基百科 都蘭溪": "https://zh.wikipedia.org/zh-tw/%E9%83%BD%E8%98%AD%E6%BA%AA",
  "維基百科 陳有蘭溪": "https://zh.wikipedia.org/zh-tw/%E9%99%B3%E6%9C%89%E8%98%AD%E6%BA%AA",
  "維基百科 鹿野溪": "https://zh.wikipedia.org/zh-tw/%E9%B9%BF%E9%87%8E%E6%BA%AA",
  "維基百科 富林溪": "https://zh.wikipedia.org/zh-tw/%E5%AF%8C%E6%9E%97%E6%BA%AA",
  "維基百科 富家溪": "https://zh.wikipedia.org/zh-tw/%E5%AF%8C%E5%AE%B6%E6%BA%AA",
  "維基百科 景山溪": "https://zh.wikipedia.org/zh-tw/%E6%99%AF%E5%B1%B1%E6%BA%AA",
  "維基百科 景美溪": "https://zh.wikipedia.org/zh-tw/%E6%99%AF%E7%BE%8E%E6%BA%AA",
  "維基百科 朝庸溪": "https://zh.wikipedia.org/zh-tw/%E6%9C%9D%E5%BA%B8%E6%BA%AA",
  "維基百科 港子溪": "https://zh.wikipedia.org/zh-tw/%E6%B8%AF%E5%AD%90%E6%BA%AA",
  "維基百科 菜寮溪": "https://zh.wikipedia.org/zh-tw/%E8%8F%9C%E5%AF%AE%E6%BA%AA",
  "維基百科 塔瓦溪": "https://zh.wikipedia.org/zh-tw/%E5%A1%94%E7%93%A6%E6%BA%AA",
  "維基百科 新店溪": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%BA%97%E6%BA%AA",
  "維基百科 新武呂溪": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E6%AD%A6%E5%91%82%E6%BA%AA",
  "維基百科 新屋溪": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%B1%8B%E6%BA%AA",
  "維基百科 新港溪": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E6%B8%AF%E6%BA%AA",
  "維基百科 新豐溪": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E8%B1%90%E6%BA%AA",
  "維基百科 楓林溪": "https://zh.wikipedia.org/zh-tw/%E6%A5%93%E6%9E%97%E6%BA%AA",
  "維基百科 溫寮溪": "https://zh.wikipedia.org/zh-tw/%E6%BA%AB%E5%AF%AE%E6%BA%AA",
  "維基百科 達仁溪": "https://zh.wikipedia.org/zh-tw/%E9%81%94%E4%BB%81%E6%BA%AA",
  "維基百科 隘寮溪": "https://zh.wikipedia.org/zh-tw/%E9%9A%98%E5%AF%AE%E6%BA%AA",
  "維基百科 壽豐溪": "https://zh.wikipedia.org/zh-tw/%E5%A3%BD%E8%B1%90%E6%BA%AA",
  "維基百科 寧埔溪": "https://zh.wikipedia.org/zh-tw/%E5%AF%A7%E5%9F%94%E6%BA%AA",
  "維基百科 旗山溪": "https://zh.wikipedia.org/zh-tw/%E6%97%97%E5%B1%B1%E6%BA%AA",
  "維基百科 瑪鋉溪": "https://zh.wikipedia.org/zh-tw/%E7%91%AA%E9%8B%89%E6%BA%AA",
  "維基百科 樂樂溪": "https://zh.wikipedia.org/zh-tw/%E6%A8%82%E6%A8%82%E6%BA%AA",
  "維基百科 興仁溪": "https://zh.wikipedia.org/zh-tw/%E8%88%88%E4%BB%81%E6%BA%AA",
  "維基百科 貓羅溪": "https://zh.wikipedia.org/zh-tw/%E8%B2%93%E7%BE%85%E6%BA%AA",
  "維基百科 薯寮溪": "https://zh.wikipedia.org/zh-tw/%E8%96%AF%E5%AF%AE%E6%BA%AA",
  "維基百科 豐濱溪": "https://zh.wikipedia.org/zh-tw/%E8%B1%90%E6%BF%B1%E6%BA%AA",
  "維基百科 寶斗溪": "https://zh.wikipedia.org/zh-tw/%E5%AF%B6%E6%96%97%E6%BA%AA",
  "維基百科 觀音溪": "https://zh.wikipedia.org/zh-tw/%E8%A7%80%E9%9F%B3%E6%BA%AA",


  // 22 個縣市政府的官方網站。它們同時是「這筆資料的出處」與「使用者想點進去的
  // 官方連結」，所以走既有的 sources 機制而不是另外加一個欄位——SourceLinks
  // 本來就會把認得的來源名稱渲染成連結。
  //
  // 全部實測過：19 個直接回 200；新北、桃園要帶瀏覽器 User-Agent 才回 200
  // （WAF 擋 curl，真人瀏覽器沒問題）；雲林在 Cloudflare 的人機驗證後面，
  // 自動化一律拿到 403，網址本身是對的。維基百科的資訊框沒填南投縣政府的網站，
  // 那一筆是另外補的官方網域。
  /**
   * 22 個縣市政府、8 座國家公園、風景區與運輸業者：一律連到那個機關自己的
   * **「認識○○／地理環境／園區介紹」**那一頁，不是首頁。
   *
   * 網址是從各機關首頁的連結或搜尋引擎已索引的頁面取得的，2026-08 逐一實測。
   *
   * ⚠️ **有四個網站是 SPA（雪霸、太魯閣、陽明山、臺江），對任何路徑都回 200**
   * ——那表示狀態碼證明不了網址對不對，猜出來的路徑在瀏覽器上會是 404。
   * 這四筆的網址是從搜尋引擎已索引的結果拿的（標題確實是「園區介紹」「關於雪霸」
   * 這類），不是猜的。**改這四筆之前要用瀏覽器實際開一次，不要只看 curl 的狀態碼。**
   *
   * ⚠️ 以下幾個維持首頁，因為找不到可引用的介紹頁（實測 404 或站上根本沒有）：
   * 臺中市（9945/Normalnodelist 實測 404）、彰化縣（abouts-city-surroundings.aspx
   * 回的是站內 404 頁）、桃園市、南投縣、雲林縣、澎湖縣、金門國家公園管理處、
   * 北海岸及觀音山國家風景區管理處、台灣原住民族文化知識網、國立臺灣大學生物多樣性
   * 研究中心。要補的話請先確認那一頁真的存在。
   */
  基隆市政府: "https://www.klcg.gov.tw/tw/klcg1/3175.html",
  臺北市政府: "https://www.gov.taipei/cp.aspx?n=469A3095FCB700F3",
  新北市政府: "https://www.ntpc.gov.tw/ch/home.jsp?id=acd3c124c0849a39",
  桃園市政府: "https://www.tycg.gov.tw",
  新竹市政府: "https://www.hccg.gov.tw/hccg/app/folder/1800",
  新竹縣政府: "https://www.hsinchu.gov.tw/cp.aspx?n=92",
  宜蘭縣政府: "https://www.e-land.gov.tw/cp.aspx?n=14747",
  苗栗縣政府: "https://www.miaoli.gov.tw/cp.aspx?n=260",
  臺中市政府: "https://www.taichung.gov.tw",
  彰化縣政府: "https://www.chcg.gov.tw",
  南投縣政府: "https://www.nantou.gov.tw",
  花蓮縣政府: "https://www.hl.gov.tw/cl.aspx?n=32735",
  雲林縣政府: "https://www.yunlin.gov.tw",
  嘉義市政府: "https://www.chiayi.gov.tw/cl.aspx?n=440",
  嘉義縣政府: "https://www.cyhg.gov.tw/cp.aspx?n=43",
  臺南市政府: "https://www.tainan.gov.tw/cp.aspx?n=13292",
  高雄市政府: "https://www.kcg.gov.tw/cp.aspx?n=07880B28C8E3EAEA",
  臺東縣政府: "https://www.taitung.gov.tw/cp.aspx?n=15107",
  屏東縣政府: "https://www.pthg.gov.tw/Content_List.aspx?n=69C7AEB54C628D5D",
  連江縣政府: "https://www.matsu.gov.tw/chhtml/newslist/371030000A/580",
  金門縣政府: "https://www.kinmen.gov.tw/cp.aspx?n=B602E31F7317F1AA",
  澎湖縣政府: "https://www.penghu.gov.tw",
  // 特有種觀測點的來源。連的是「臺灣境內的紀錄」那個查詢，不是 GBIF 首頁。
  // ⚠️ 這個網址用 curl 測會回 403（Cloudflare 的 bot 防護），瀏覽器開是正常的
  // ——本檔案其餘網址都實測 200，只有這一筆沒辦法用指令驗證。
  "GBIF Global Biodiversity Information Facility": "https://www.gbif.org/occurrence/search?country=TW",
  "Natural Earth": "https://www.naturalearthdata.com/",
  /**
   * 板塊與板塊邊界。授權是 ODC-BY 1.0，**要求標示出處**，所以原作者（Bird）與
   * 轉製者（Nordpil）兩個都要列，少一個就違反授權。
   */
  "Peter Bird (2003) 板塊模型": "https://doi.org/10.1029/2001GC000252",
  "Nordpil 板塊資料集": "https://github.com/fraxen/tectonicplates",
  "維基百科 板塊列表": "https://zh.wikipedia.org/zh-tw/%E6%9D%BF%E5%A1%8A%E5%88%97%E8%A1%A8",
  /**
   * 全球活火山。GVP 的授權方式是「引用即可自由使用」，所以來源標籤要留著全名，
   * 不要簡寫成「Smithsonian」。知名火山的中文名另外標維基百科（次級來源）。
   */
  "史密森尼學會 全球火山計畫（GVP）": "https://volcano.si.edu/",
  /**
   * 陸域生物群系。授權是 CC-BY 4.0，**要求標示出處**，所以原始資料集（RESOLVE／
   * Dinerstein et al. 2017）與取得管道（Esri Living Atlas 的 FeatureServer）
   * 兩個都要列，少一個就違反授權（比照板塊那份 ODC-BY）。
   */
  "RESOLVE 生態區 2017（Dinerstein et al.）": "https://ecoregions.appspot.com/",
  /**
   * 柯本氣候分區。維也納獸醫大學公開提供，條件是引用 Kottek et al. (2006)，
   * 所以來源標籤帶著論文出處，不要簡寫成「柯本分類」。
   */
  "柯本－蓋格氣候分類圖（Kottek et al. 2006）": "https://koeppen-geiger.vu-wien.ac.at/present.htm",
  "Esri Living Atlas":
    "https://www.arcgis.com/home/item.html?id=37ea320eebb647c6838c23f72abae5ef",
  /**
   * 七大洲的說明卡（src/content/geo/world-continents/）。幾何來自 Natural Earth，
   * 但最高峰、面積比例、洲界怎麼畫這類敘述性的內容是查維基百科寫的（次級來源，
   * 比照三種板塊邊界那幾張卡的既有作法）——逐洲登記條目，不要只寫泛稱的「維基百科」。
   */
  "維基百科 亞洲": "https://zh.wikipedia.org/zh-tw/%E4%BA%9E%E6%B4%B2",
  "維基百科 非洲": "https://zh.wikipedia.org/zh-tw/%E9%9D%9E%E6%B4%B2",
  "維基百科 北美洲": "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E7%BE%8E%E6%B4%B2",
  "維基百科 南美洲": "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E7%BE%8E%E6%B4%B2",
  "維基百科 南極洲": "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%A5%B5%E6%B4%B2",
  "維基百科 歐洲": "https://zh.wikipedia.org/zh-tw/%E6%AD%90%E6%B4%B2",
  "維基百科 大洋洲": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E6%B4%8B%E6%B4%B2",
  // 三種邊界的說明卡（src/content/geo/plate-boundaries/）查名稱與代表案例用的次級來源。
  // 幾何與三分類仍然一律以 Bird (2003) 為準，見上面那則說明。
  "維基百科 板塊構造論":
    "https://zh.wikipedia.org/zh-tw/%E6%9D%BF%E5%A1%8A%E6%A7%8B%E9%80%A0%E8%AB%96",
  // 交通軸線的線位來源。ODbL 1.0 要求標示「© OpenStreetMap 貢獻者」，
  // 這個署名義務不是新增的——世界底圖 OpenFreeMap 本來就是 OSM 衍生的。
  OpenStreetMap: "https://www.openstreetmap.org/copyright",
  交通部高速公路局: "https://www.freeway.gov.tw/Publish.aspx?cnid=2903",
  // 省道（三條橫貫公路）的主管機關。⚠️ 2023-09 由「公路總局」改制為「公路局」，
  // 舊名仍搜得到，但機關名稱要用現行的。
  交通部公路局: "https://www.thb.gov.tw/cl.aspx?n=184",
  臺灣鐵路公司: "https://www.railway.gov.tw/tra-tip-web/adr/about-vision",
  台灣高鐵: "https://www.thsrc.com.tw/event/Governance/THSRC_Introduction.pdf",
  "Open-Meteo ERA5 再分析資料": "https://open-meteo.com/en/docs/historical-weather-api",
  USGS: "https://earthquake.usgs.gov/earthquakes/search/",

  // 43 處保留區／保護區各自的官方介紹頁（林業及自然保育署）。走既有的 sources
  // 機制而不是另外開欄位，比照 22 個縣市政府的既有決定：那一頁同時是「這筆
  // 說明的出處」與「使用者想點進去看更多的官方連結」。
  // ⚠️ 十座國家公園不在這裡——它們的主管機關是內政部國家公園署，各自有管理處。
  // 自然保留區 22 處
  "林業保育署 淡水河紅樹林自然保留區": "https://www.forest.gov.tw/0007950",
  "林業保育署 坪林台灣油杉自然保留區": "https://www.forest.gov.tw/0007955",
  "林業保育署 哈盆自然保留區": "https://www.forest.gov.tw/0007956",
  "林業保育署 插天山自然保留區": "https://www.forest.gov.tw/0007957",
  "林業保育署 鴛鴦湖自然保留區": "https://www.forest.gov.tw/0007958",
  "林業保育署 南澳闊葉樹林自然保留區": "https://www.forest.gov.tw/0007959",
  "林業保育署 苗栗三義火炎山自然保留區": "https://www.forest.gov.tw/0007960",
  "林業保育署 澎湖玄武岩自然保留區": "https://www.forest.gov.tw/0007961",
  "林業保育署 台灣一葉蘭自然保留區": "https://www.forest.gov.tw/0007962",
  "林業保育署 出雲山自然保留區": "https://www.forest.gov.tw/0007963",
  "林業保育署 台東紅葉村台東蘇鐵自然保留區": "https://www.forest.gov.tw/0007964",
  "林業保育署 烏山頂泥火山自然保留區": "https://www.forest.gov.tw/0007965",
  "林業保育署 大武山自然保留區": "https://www.forest.gov.tw/0007966",
  "林業保育署 大武事業區台灣穗花杉自然保留區": "https://www.forest.gov.tw/0007967",
  "林業保育署 挖子尾自然保留區": "https://www.forest.gov.tw/0007968",
  "林業保育署 烏石鼻海岸自然保留區": "https://www.forest.gov.tw/0007969",
  "林業保育署 墾丁高位珊瑚礁自然保留區": "https://www.forest.gov.tw/0007970",
  "林業保育署 九九峰自然保留區": "https://www.forest.gov.tw/0007971",
  "林業保育署 澎湖南海玄武岩自然保留區": "https://www.forest.gov.tw/0007972",
  "林業保育署 旭海-觀音鼻自然保留區": "https://www.forest.gov.tw/0007973",
  "林業保育署 北投石自然保留區": "https://www.forest.gov.tw/0007974",
  "林業保育署 龍崎牛埔惡地自然保留區": "https://www.forest.gov.tw/0007975",
  // 野生動物保護區 16 處
  "林業保育署 高雄市那瑪夏區楠梓仙溪野生動物保護區": "https://www.forest.gov.tw/0007978",
  "林業保育署 無尾港水鳥保護區": "https://www.forest.gov.tw/0007979",
  "林業保育署 臺北市野雁保護區": "https://www.forest.gov.tw/0007980",
  "林業保育署 臺南市四草野生動物保護區": "https://www.forest.gov.tw/0007981",
  "林業保育署 大肚溪口野生動物保護區": "https://www.forest.gov.tw/0007983",
  "林業保育署 蘭陽溪口水鳥保護區": "https://www.forest.gov.tw/0007985",
  "林業保育署 櫻花鉤吻鮭野生動物保護區": "https://www.forest.gov.tw/0007996",
  "林業保育署 台東縣海端鄉新武呂溪魚類保護區": "https://www.forest.gov.tw/0007986",
  "林業保育署 玉里野生動物保護區": "https://www.forest.gov.tw/0007988",
  "林業保育署 新竹市濱海野生動物保護區": "https://www.forest.gov.tw/0007989",
  "林業保育署 台南縣曾文溪口北岸黑面琵鷺動物保護區": "https://www.forest.gov.tw/0007990",
  "林業保育署 宜蘭縣雙連埤野生動物保護區": "https://www.forest.gov.tw/0007991",
  "林業保育署 高美野生動物保護區": "https://www.forest.gov.tw/0007992",
  "林業保育署 桃園高榮野生動物保護區": "https://www.forest.gov.tw/0007993",
  "林業保育署 翡翠水庫食蛇龜野生動物保護區": "https://www.forest.gov.tw/0007994",
  "林業保育署 馬祖列島雌光螢野生動物保護區": "https://www.forest.gov.tw/0007997",
  // 自然保護區 5 處
  "林業保育署 十八羅漢山自然保護區": "https://www.forest.gov.tw/0008038",
  "林業保育署 甲仙四德化石自然保護區": "https://www.forest.gov.tw/0008039",
  "林業保育署 關山臺灣海棗自然保護區": "https://www.forest.gov.tw/0008040",
  "林業保育署 海岸山脈臺東蘇鐵自然保護區": "https://www.forest.gov.tw/0008041",
  "林業保育署 大武台灣油杉自然保護區": "https://www.forest.gov.tw/0008042",
  // 圖層層級的署名（活動斷層、臺灣地震的斷層底圖）。首頁會 302 到 /nss/p/index，
  // 直接寫最終網址免得多一次跳轉。
  經濟部地質調查及礦業管理中心: "https://www.gsmma.gov.tw/nss/p/index",
  "經濟部地質調查及礦業管理中心 臺灣活動斷層分布圖":
    "https://fault.gsmma.gov.tw/About/Fault_map",
  /**
   * 33 條活動斷層各自的官方詳細說明頁（「臺灣活動斷層」網站，編號依官網現行的
   * 36 條分布圖）。⚠️ 三義斷層之分支斷層在 36 條的版本裡沒有單列，它跟三義斷層
   * 共用同一頁。
   */
  "地質調查及礦業管理中心 山腳斷層": "https://fault.gsmma.gov.tw/About/FaultMore/0f0ba96791b44c849d9515ef3df9fd7c",
  "地質調查及礦業管理中心 湖口斷層": "https://fault.gsmma.gov.tw/About/FaultMore/be5c5a21d104434280f17a88d8c2cbca",
  "地質調查及礦業管理中心 新竹斷層": "https://fault.gsmma.gov.tw/About/FaultMore/d85876f69018479196f28121e5176de5",
  "地質調查及礦業管理中心 新城斷層": "https://fault.gsmma.gov.tw/About/FaultMore/1e36747a19b048aa910f81220c8a393a",
  "地質調查及礦業管理中心 獅潭斷層": "https://fault.gsmma.gov.tw/About/FaultMore/3fd6c05b2efd4d91b35847c0b3d71c77",
  "地質調查及礦業管理中心 三義斷層": "https://fault.gsmma.gov.tw/About/FaultMore/ae141da17b684753ae417710bc89ed48",
  "地質調查及礦業管理中心 大甲斷層": "https://fault.gsmma.gov.tw/About/FaultMore/46365c82026744e4ac954f4ca2e7028e",
  "地質調查及礦業管理中心 鐵砧山斷層": "https://fault.gsmma.gov.tw/About/FaultMore/1ad2e638e38b41e49550c54f2a502f0a",
  "地質調查及礦業管理中心 屯子腳斷層": "https://fault.gsmma.gov.tw/About/FaultMore/e01d9c47f9b0432da78016a3c231cabc",
  "地質調查及礦業管理中心 彰化斷層": "https://fault.gsmma.gov.tw/About/FaultMore/7e082094f90c43628c9b96bad9787922",
  "地質調查及礦業管理中心 車籠埔斷層": "https://fault.gsmma.gov.tw/About/FaultMore/55ae0384aecc43279b779ddf8a99e788",
  "地質調查及礦業管理中心 大茅埔－雙冬斷層": "https://fault.gsmma.gov.tw/About/FaultMore/6379d16f026d403ebd0bf54696d3a4a2",
  "地質調查及礦業管理中心 梅山斷層": "https://fault.gsmma.gov.tw/About/FaultMore/dd06c43a008c4872862ece36b0366b4f",
  "地質調查及礦業管理中心 大尖山斷層": "https://fault.gsmma.gov.tw/About/FaultMore/3815d2075c8a4750be020b2bbf4a24f6",
  "地質調查及礦業管理中心 木屐寮斷層": "https://fault.gsmma.gov.tw/About/FaultMore/b122ecd4c76e42828a4b471522ea06c3",
  "地質調查及礦業管理中心 六甲斷層": "https://fault.gsmma.gov.tw/About/FaultMore/a03d40bec7084c99bd88b4bcd193ff76",
  "地質調查及礦業管理中心 觸口斷層": "https://fault.gsmma.gov.tw/About/FaultMore/9146280f396e4bf6ad090e74720058f3",
  "地質調查及礦業管理中心 新化斷層": "https://fault.gsmma.gov.tw/About/FaultMore/1dd6cbac6e614bffa6d81cedf2cb7cc9",
  "地質調查及礦業管理中心 後甲里斷層": "https://fault.gsmma.gov.tw/About/FaultMore/2f951a9fa30f4de6bf0e9d3b343b7b6c",
  "地質調查及礦業管理中心 左鎮斷層": "https://fault.gsmma.gov.tw/About/FaultMore/c3772e901fa74ac7ba0f9aefa0d7dfdb",
  "地質調查及礦業管理中心 小崗山斷層": "https://fault.gsmma.gov.tw/About/FaultMore/ac51e24f1e1c47559fc28d44b8d73c8b",
  "地質調查及礦業管理中心 旗山斷層": "https://fault.gsmma.gov.tw/About/FaultMore/7893ab7400ba45e081c7312467134d52",
  "地質調查及礦業管理中心 潮州斷層": "https://fault.gsmma.gov.tw/About/FaultMore/1bc2ecd60d984d85a6579a42d77a473c",
  "地質調查及礦業管理中心 恆春斷層": "https://fault.gsmma.gov.tw/About/FaultMore/f24fa2e580174ac9aba3edb28edcedc7",
  "地質調查及礦業管理中心 米崙斷層": "https://fault.gsmma.gov.tw/About/FaultMore/6fe5298de54548df8c1d0c6215709a22",
  "地質調查及礦業管理中心 嶺頂斷層": "https://fault.gsmma.gov.tw/About/FaultMore/d8b303dc603346c6bbec958744a78917",
  "地質調查及礦業管理中心 瑞穗斷層": "https://fault.gsmma.gov.tw/About/FaultMore/1afefb6fee73489a8c96c98799d8e61a",
  "地質調查及礦業管理中心 奇美斷層": "https://fault.gsmma.gov.tw/About/FaultMore/ada05552d0c44ab0bbab0b0547eb482b",
  "地質調查及礦業管理中心 玉里斷層": "https://fault.gsmma.gov.tw/About/FaultMore/66f44d794f954a2c81dd8996fb283461",
  "地質調查及礦業管理中心 池上斷層": "https://fault.gsmma.gov.tw/About/FaultMore/8060eee7113943109f047dabf46cd6c7",
  "地質調查及礦業管理中心 鹿野斷層": "https://fault.gsmma.gov.tw/About/FaultMore/f2f2b6e40b8b40a1b2aa38cf89a5daf8",
  "地質調查及礦業管理中心 利吉斷層": "https://fault.gsmma.gov.tw/About/FaultMore/f75a1cf5fc2e4a879e56b218f6e3d56f",
  /**
   * 維基百科的逐篇條目連結（150 篇）。
   *
   * ⚠️ **每一筆都是用 zh.wikipedia 的 API 查證過的，不是從名稱組出來的。**
   * CLAUDE_TW.md 對 97 條河川那批已經記過這個教訓（公告名「大清水溪」的條目其實是
   * 「良里溪」，自動組網址會靜默連到另一條河），這一批照同一條規矩重做了一次，
   * 而且**自動查證真的又抓到六個會配錯的**：
   *
   *   連江縣   → 直接查會導向**中國福建的连江县**，正確條目是「連江縣 (中華民國)」
   *   雪山     → 是消歧義頁，要「雪山 (台灣)」
   *   磺溪     → 是消歧義頁；我們那條是 13.5 km／49 km²、金山注入東海，即「磺溪 (新北市)」
   *   雙溪     → 是消歧義頁；26.81 km／132.5 km² 完全吻合「雙溪 (新北市)」
   *   國道3號  → 是消歧義頁，要「福爾摩沙高速公路」
   *   國道5號  → 是消歧義頁，要「蔣渭水高速公路」
   *
   * ⚠️ **網址一律用 `/zh-tw/` 而不是 `/wiki/`。** 兩者都連得到同一篇條目，但 `/wiki/`
   * 會依讀者的瀏覽器或帳號設定決定字體變體，**臺灣的學生點下去有可能看到簡體**
   * ——那跟本站把世界底圖地名全部改寫成繁體中文是同一件事（見 CLAUDE.md）。
   * `/zh-tw/` 強制繁體。2026-08 已把全部 285 筆統一成這個形式。
   *
   * ⚠️ **新增時請照同一個流程**：用 API 查 `prop=extracts|pageprops`，同時檢查
   * `pageprops.disambiguation` 與摘要開頭有沒有「也可以指：」，再比對摘要裡的
   * 數字（長度、面積、行政區）跟我們的資料對不對得上。**只確認「網址回 200」是不夠的**
   * ——消歧義頁與同名條目都會回 200。
   */
  "維基百科 阿公店溪":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E5%85%AC%E5%BA%97%E6%BA%AA",
  "維基百科 阿里山山脈":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E9%87%8C%E5%B1%B1%E5%B1%B1%E8%84%88",
  "維基百科 八卦台地":
    "https://zh.wikipedia.org/zh-tw/%E5%85%AB%E5%8D%A6%E5%8F%B0%E5%9C%B0",
  "維基百科 八掌溪":
    "https://zh.wikipedia.org/zh-tw/%E5%85%AB%E6%8E%8C%E6%BA%AA",
  "維基百科 保力溪":
    "https://zh.wikipedia.org/zh-tw/%E4%BF%9D%E5%8A%9B%E6%BA%AA",
  "維基百科 卑南溪":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%91%E5%8D%97%E6%BA%AA",
  "維基百科 北港溪":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E6%B8%AF%E6%BA%AA",
  "維基百科 北橫公路":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E6%A9%AB%E5%85%AC%E8%B7%AF",
  "維基百科 埔里盆地群":
    "https://zh.wikipedia.org/zh-tw/%E5%9F%94%E9%87%8C%E7%9B%86%E5%9C%B0%E7%BE%A4",
  "維基百科 曾文溪":
    "https://zh.wikipedia.org/zh-tw/%E6%9B%BE%E6%96%87%E6%BA%AA",
  "維基百科 大安溪":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%AE%89%E6%BA%AA",
  "維基百科 大甲溪":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E7%94%B2%E6%BA%AA",
  "維基百科 大塔山":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%A1%94%E5%B1%B1",
  "維基百科 大屯火山群":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%B1%AF%E7%81%AB%E5%B1%B1%E7%BE%A4",
  "維基百科 淡水河":
    "https://zh.wikipedia.org/zh-tw/%E6%B7%A1%E6%B0%B4%E6%B2%B3",
  "維基百科 得子口溪":
    "https://zh.wikipedia.org/zh-tw/%E5%BE%97%E5%AD%90%E5%8F%A3%E6%BA%AA",
  "維基百科 釣魚臺":
    "https://zh.wikipedia.org/zh-tw/%E9%87%A3%E9%AD%9A%E8%87%BA",
  "維基百科 東部幹線":
    "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E9%83%A8%E5%B9%B9%E7%B7%9A",
  "維基百科 東港溪":
    "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E6%B8%AF%E6%BA%AA",
  "維基百科 東沙環礁國家公園":
    "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E6%B2%99%E7%92%B0%E7%A4%81%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 鵝鑾鼻":
    "https://zh.wikipedia.org/zh-tw/%E9%B5%9D%E9%91%BE%E9%BC%BB",
  "維基百科 二仁溪":
    "https://zh.wikipedia.org/zh-tw/%E4%BA%8C%E4%BB%81%E6%BA%AA",
  "維基百科 枋山溪":
    "https://zh.wikipedia.org/zh-tw/%E6%9E%8B%E5%B1%B1%E6%BA%AA",
  "維基百科 楓港溪":
    "https://zh.wikipedia.org/zh-tw/%E6%A5%93%E6%B8%AF%E6%BA%AA",
  "維基百科 鳳山溪":
    "https://zh.wikipedia.org/zh-tw/%E9%B3%B3%E5%B1%B1%E6%BA%AA",
  "維基百科 福爾摩沙高速公路":
    "https://zh.wikipedia.org/zh-tw/%E7%A6%8F%E7%88%BE%E6%91%A9%E6%B2%99%E9%AB%98%E9%80%9F%E5%85%AC%E8%B7%AF",
  "維基百科 富貴角":
    "https://zh.wikipedia.org/zh-tw/%E5%AF%8C%E8%B2%B4%E8%A7%92",
  "維基百科 港口溪":
    "https://zh.wikipedia.org/zh-tw/%E6%B8%AF%E5%8F%A3%E6%BA%AA",
  "維基百科 高屏溪":
    "https://zh.wikipedia.org/zh-tw/%E9%AB%98%E5%B1%8F%E6%BA%AA",
  "維基百科 高雄市":
    "https://zh.wikipedia.org/zh-tw/%E9%AB%98%E9%9B%84%E5%B8%82",
  "維基百科 高雄市政府":
    "https://zh.wikipedia.org/zh-tw/%E9%AB%98%E9%9B%84%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 龜山島":
    "https://zh.wikipedia.org/zh-tw/%E9%BE%9C%E5%B1%B1%E5%B3%B6",
  "維基百科 國聖港燈塔":
    "https://zh.wikipedia.org/zh-tw/%E5%9C%8B%E8%81%96%E6%B8%AF%E7%87%88%E5%A1%94",
  "維基百科 海岸山脈":
    "https://zh.wikipedia.org/zh-tw/%E6%B5%B7%E5%B2%B8%E5%B1%B1%E8%84%88",
  "維基百科 和平溪":
    "https://zh.wikipedia.org/zh-tw/%E5%92%8C%E5%B9%B3%E6%BA%AA",
  "維基百科 後龍溪":
    "https://zh.wikipedia.org/zh-tw/%E5%BE%8C%E9%BE%8D%E6%BA%AA",
  "維基百科 花東縱谷":
    "https://zh.wikipedia.org/zh-tw/%E8%8A%B1%E6%9D%B1%E7%B8%B1%E8%B0%B7",
  "維基百科 花蓮溪":
    "https://zh.wikipedia.org/zh-tw/%E8%8A%B1%E8%93%AE%E6%BA%AA",
  "維基百科 花蓮縣":
    "https://zh.wikipedia.org/zh-tw/%E8%8A%B1%E8%93%AE%E7%B8%A3",
  "維基百科 花蓮縣政府":
    "https://zh.wikipedia.org/zh-tw/%E8%8A%B1%E8%93%AE%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 磺溪 (新北市)":
    "https://zh.wikipedia.org/zh-tw/%E7%A3%BA%E6%BA%AA_(%E6%96%B0%E5%8C%97%E5%B8%82)",
  "維基百科 火炎山 (苗栗縣)":
    "https://zh.wikipedia.org/zh-tw/%E7%81%AB%E7%82%8E%E5%B1%B1_(%E8%8B%97%E6%A0%97%E7%B8%A3)",
  "維基百科 基隆市":
    "https://zh.wikipedia.org/zh-tw/%E5%9F%BA%E9%9A%86%E5%B8%82",
  "維基百科 基隆市政府":
    "https://zh.wikipedia.org/zh-tw/%E5%9F%BA%E9%9A%86%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 吉安溪":
    "https://zh.wikipedia.org/zh-tw/%E5%90%89%E5%AE%89%E6%BA%AA",
  "維基百科 急水溪":
    "https://zh.wikipedia.org/zh-tw/%E6%80%A5%E6%B0%B4%E6%BA%AA",
  "維基百科 嘉南平原":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E5%8D%97%E5%B9%B3%E5%8E%9F",
  "維基百科 嘉義市":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E5%B8%82",
  "維基百科 嘉義市政府":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 嘉義縣":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E7%B8%A3",
  "維基百科 嘉義縣政府":
    "https://zh.wikipedia.org/zh-tw/%E5%98%89%E7%BE%A9%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 蔣渭水高速公路":
    "https://zh.wikipedia.org/zh-tw/%E8%94%A3%E6%B8%AD%E6%B0%B4%E9%AB%98%E9%80%9F%E5%85%AC%E8%B7%AF",
  "維基百科 金門國家公園":
    "https://zh.wikipedia.org/zh-tw/%E9%87%91%E9%96%80%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 金門縣":
    "https://zh.wikipedia.org/zh-tw/%E9%87%91%E9%96%80%E7%B8%A3",
  "維基百科 金門縣政府":
    "https://zh.wikipedia.org/zh-tw/%E9%87%91%E9%96%80%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 墾丁國家公園":
    "https://zh.wikipedia.org/zh-tw/%E5%A2%BE%E4%B8%81%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 蘭陽平原":
    "https://zh.wikipedia.org/zh-tw/%E8%98%AD%E9%99%BD%E5%B9%B3%E5%8E%9F",
  "維基百科 蘭陽溪":
    "https://zh.wikipedia.org/zh-tw/%E8%98%AD%E9%99%BD%E6%BA%AA",
  "維基百科 蘭嶼":
    "https://zh.wikipedia.org/zh-tw/%E8%98%AD%E5%B6%BC",
  "維基百科 老街溪":
    "https://zh.wikipedia.org/zh-tw/%E8%80%81%E8%A1%97%E6%BA%AA",
  "維基百科 立霧溪":
    "https://zh.wikipedia.org/zh-tw/%E7%AB%8B%E9%9C%A7%E6%BA%AA",
  "維基百科 利嘉溪":
    "https://zh.wikipedia.org/zh-tw/%E5%88%A9%E5%98%89%E6%BA%AA",
  "維基百科 連江縣 (中華民國)":
    "https://zh.wikipedia.org/zh-tw/%E9%80%A3%E6%B1%9F%E7%B8%A3_(%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B)",
  "維基百科 連江縣政府":
    "https://zh.wikipedia.org/zh-tw/%E9%80%A3%E6%B1%9F%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 林口台地":
    "https://zh.wikipedia.org/zh-tw/%E6%9E%97%E5%8F%A3%E5%8F%B0%E5%9C%B0",
  "維基百科 琉球嶼":
    "https://zh.wikipedia.org/zh-tw/%E7%90%89%E7%90%83%E5%B6%BC",
  "維基百科 率芒溪":
    "https://zh.wikipedia.org/zh-tw/%E7%8E%87%E8%8A%92%E6%BA%AA",
  "維基百科 綠島":
    "https://zh.wikipedia.org/zh-tw/%E7%B6%A0%E5%B3%B6",
  "維基百科 美崙溪":
    "https://zh.wikipedia.org/zh-tw/%E7%BE%8E%E5%B4%99%E6%BA%AA",
  "維基百科 苗栗縣":
    "https://zh.wikipedia.org/zh-tw/%E8%8B%97%E6%A0%97%E7%B8%A3",
  "維基百科 苗栗縣政府":
    "https://zh.wikipedia.org/zh-tw/%E8%8B%97%E6%A0%97%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 南澳溪":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%BE%B3%E6%BA%AA",
  "維基百科 南橫公路":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%A9%AB%E5%85%AC%E8%B7%AF",
  "維基百科 南迴線":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E8%BF%B4%E7%B7%9A",
  "維基百科 南崁溪":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E5%B4%81%E6%BA%AA",
  "維基百科 南沙群岛":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%B2%99%E7%BE%A4%E5%B2%9B",
  "維基百科 南投縣":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%8A%95%E7%B8%A3",
  "維基百科 南投縣政府":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%8A%95%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 澎湖南方四島國家公園":
    "https://zh.wikipedia.org/zh-tw/%E6%BE%8E%E6%B9%96%E5%8D%97%E6%96%B9%E5%9B%9B%E5%B3%B6%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 澎湖縣":
    "https://zh.wikipedia.org/zh-tw/%E6%BE%8E%E6%B9%96%E7%B8%A3",
  "維基百科 澎湖縣政府":
    "https://zh.wikipedia.org/zh-tw/%E6%BE%8E%E6%B9%96%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 屏東平原":
    "https://zh.wikipedia.org/zh-tw/%E5%B1%8F%E6%9D%B1%E5%B9%B3%E5%8E%9F",
  "維基百科 屏東縣":
    "https://zh.wikipedia.org/zh-tw/%E5%B1%8F%E6%9D%B1%E7%B8%A3",
  "維基百科 屏東縣政府":
    "https://zh.wikipedia.org/zh-tw/%E5%B1%8F%E6%9D%B1%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 朴子溪":
    "https://zh.wikipedia.org/zh-tw/%E6%9C%B4%E5%AD%90%E6%BA%AA",
  "維基百科 七股潟湖":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%83%E8%82%A1%E6%BD%9F%E6%B9%96",
  "維基百科 清水斷崖":
    "https://zh.wikipedia.org/zh-tw/%E6%B8%85%E6%B0%B4%E6%96%B7%E5%B4%96",
  "維基百科 三貂角":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%89%E8%B2%82%E8%A7%92",
  "維基百科 社子溪":
    "https://zh.wikipedia.org/zh-tw/%E7%A4%BE%E5%AD%90%E6%BA%AA",
  "維基百科 壽山國家自然公園":
    "https://zh.wikipedia.org/zh-tw/%E5%A3%BD%E5%B1%B1%E5%9C%8B%E5%AE%B6%E8%87%AA%E7%84%B6%E5%85%AC%E5%9C%92",
  "維基百科 雙溪 (新北市)":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%99%E6%BA%AA_(%E6%96%B0%E5%8C%97%E5%B8%82)",
  "維基百科 四重溪":
    "https://zh.wikipedia.org/zh-tw/%E5%9B%9B%E9%87%8D%E6%BA%AA",
  "維基百科 蘇澳溪":
    "https://zh.wikipedia.org/zh-tw/%E8%98%87%E6%BE%B3%E6%BA%AA",
  "維基百科 台江國家公園":
    "https://zh.wikipedia.org/zh-tw/%E5%8F%B0%E6%B1%9F%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 台灣高鐵":
    "https://zh.wikipedia.org/zh-tw/%E5%8F%B0%E7%81%A3%E9%AB%98%E9%90%B5",
  "維基百科 臺北市":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8C%97%E5%B8%82",
  "維基百科 臺北市政府":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8C%97%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 臺東縣":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E6%9D%B1%E7%B8%A3",
  "維基百科 臺東縣政府":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E6%9D%B1%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 臺南市":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8D%97%E5%B8%82",
  "維基百科 臺南市政府":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8D%97%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 臺灣地震列表":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E7%81%A3%E5%9C%B0%E9%9C%87%E5%88%97%E8%A1%A8",
  "維基百科 臺灣行政區劃":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E7%81%A3%E8%A1%8C%E6%94%BF%E5%8D%80%E5%8A%83",
  "維基百科 臺灣山脈列表":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E7%81%A3%E5%B1%B1%E8%84%88%E5%88%97%E8%A1%A8",
  "維基百科 臺中盆地":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E4%B8%AD%E7%9B%86%E5%9C%B0",
  "維基百科 臺中市":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E4%B8%AD%E5%B8%82",
  "維基百科 臺中市政府":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E4%B8%AD%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 太魯閣國家公園":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%AA%E9%AD%AF%E9%96%A3%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 太平溪":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%AA%E5%B9%B3%E6%BA%AA",
  "維基百科 桃園市":
    "https://zh.wikipedia.org/zh-tw/%E6%A1%83%E5%9C%92%E5%B8%82",
  "維基百科 桃園市政府":
    "https://zh.wikipedia.org/zh-tw/%E6%A1%83%E5%9C%92%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 桃園臺地群":
    "https://zh.wikipedia.org/zh-tw/%E6%A1%83%E5%9C%92%E8%87%BA%E5%9C%B0%E7%BE%A4",
  "維基百科 桶盤嶼":
    "https://zh.wikipedia.org/zh-tw/%E6%A1%B6%E7%9B%A4%E5%B6%BC",
  "維基百科 頭前溪":
    "https://zh.wikipedia.org/zh-tw/%E9%A0%AD%E5%89%8D%E6%BA%AA",
  "維基百科 外傘頂洲":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%96%E5%82%98%E9%A0%82%E6%B4%B2",
  "維基百科 烏溪":
    "https://zh.wikipedia.org/zh-tw/%E7%83%8F%E6%BA%AA",
  "維基百科 西部幹線":
    "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E9%83%A8%E5%B9%B9%E7%B7%9A",
  "維基百科 西湖溪":
    "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E6%B9%96%E6%BA%AA",
  "維基百科 新北市":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%8C%97%E5%B8%82",
  "維基百科 新北市政府":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%8C%97%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 新城溪":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%9F%8E%E6%BA%AA",
  "維基百科 新港大山":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E6%B8%AF%E5%A4%A7%E5%B1%B1",
  "維基百科 新虎尾溪":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E8%99%8E%E5%B0%BE%E6%BA%AA",
  "維基百科 新竹市":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E7%AB%B9%E5%B8%82",
  "維基百科 新竹市政府":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E7%AB%B9%E5%B8%82%E6%94%BF%E5%BA%9C",
  "維基百科 新竹縣":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E7%AB%B9%E7%B8%A3",
  "維基百科 新竹縣政府":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E7%AB%B9%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 秀姑巒山":
    "https://zh.wikipedia.org/zh-tw/%E7%A7%80%E5%A7%91%E5%B7%92%E5%B1%B1",
  "維基百科 秀姑巒溪":
    "https://zh.wikipedia.org/zh-tw/%E7%A7%80%E5%A7%91%E5%B7%92%E6%BA%AA",
  "維基百科 雪霸國家公園":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%AA%E9%9C%B8%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 雪山 (台灣)":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%AA%E5%B1%B1_(%E5%8F%B0%E7%81%A3)",
  "維基百科 雪山山脈":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%AA%E5%B1%B1%E5%B1%B1%E8%84%88",
  "維基百科 鹽水溪":
    "https://zh.wikipedia.org/zh-tw/%E9%B9%BD%E6%B0%B4%E6%BA%AA",
  "維基百科 陽明山國家公園":
    "https://zh.wikipedia.org/zh-tw/%E9%99%BD%E6%98%8E%E5%B1%B1%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 野柳風景特定區":
    "https://zh.wikipedia.org/zh-tw/%E9%87%8E%E6%9F%B3%E9%A2%A8%E6%99%AF%E7%89%B9%E5%AE%9A%E5%8D%80",
  "維基百科 宜蘭縣":
    "https://zh.wikipedia.org/zh-tw/%E5%AE%9C%E8%98%AD%E7%B8%A3",
  "維基百科 宜蘭縣政府":
    "https://zh.wikipedia.org/zh-tw/%E5%AE%9C%E8%98%AD%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 玉山國家公園":
    "https://zh.wikipedia.org/zh-tw/%E7%8E%89%E5%B1%B1%E5%9C%8B%E5%AE%B6%E5%85%AC%E5%9C%92",
  "維基百科 玉山山脈":
    "https://zh.wikipedia.org/zh-tw/%E7%8E%89%E5%B1%B1%E5%B1%B1%E8%84%88",
  "維基百科 月世界":
    "https://zh.wikipedia.org/zh-tw/%E6%9C%88%E4%B8%96%E7%95%8C",
  "維基百科 雲林縣":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%B2%E6%9E%97%E7%B8%A3",
  "維基百科 雲林縣政府":
    "https://zh.wikipedia.org/zh-tw/%E9%9B%B2%E6%9E%97%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 彰化縣":
    "https://zh.wikipedia.org/zh-tw/%E5%BD%B0%E5%8C%96%E7%B8%A3",
  "維基百科 彰化縣政府":
    "https://zh.wikipedia.org/zh-tw/%E5%BD%B0%E5%8C%96%E7%B8%A3%E6%94%BF%E5%BA%9C",
  "維基百科 知本溪":
    "https://zh.wikipedia.org/zh-tw/%E7%9F%A5%E6%9C%AC%E6%BA%AA",
  "維基百科 中港溪":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E6%B8%AF%E6%BA%AA",
  "維基百科 中橫公路":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E6%A9%AB%E5%85%AC%E8%B7%AF",
  "維基百科 中華民國島嶼列表":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E5%B3%B6%E5%B6%BC%E5%88%97%E8%A1%A8",
  "維基百科 中山高速公路":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E5%B1%B1%E9%AB%98%E9%80%9F%E5%85%AC%E8%B7%AF",
  "維基百科 中央山脈":
    "https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E5%A4%AE%E5%B1%B1%E8%84%88",
  "維基百科 濁水溪":
    "https://zh.wikipedia.org/zh-tw/%E6%BF%81%E6%B0%B4%E6%BA%AA",

  "維基百科 阿古拉斯洋流":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E5%8F%A4%E6%8B%89%E6%96%AF%E6%B4%8B%E6%B5%81",
  "維基百科 阿拉斯加洋流":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E6%8B%89%E6%96%AF%E5%8A%A0%E6%B4%8B%E6%B5%81",
  "維基百科 巴西洋流":
    "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E8%A5%BF%E6%B4%8B%E6%B5%81",
  "維基百科 北赤道暖流":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E8%B5%A4%E9%81%93%E6%9A%96%E6%B5%81",
  "維基百科 北大西洋漂流":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E5%A4%A7%E8%A5%BF%E6%B4%8B%E6%BC%82%E6%B5%81",
  "維基百科 北太平洋洋流":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E5%A4%AA%E5%B9%B3%E6%B4%8B%E6%B4%8B%E6%B5%81",
  "維基百科 本格拉寒流":
    "https://zh.wikipedia.org/zh-tw/%E6%9C%AC%E6%A0%BC%E6%8B%89%E5%AF%92%E6%B5%81",
  "維基百科 大氣環流":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E6%B0%A3%E7%92%B0%E6%B5%81",
  "維基百科 東澳洋流":
    "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E6%BE%B3%E6%B4%8B%E6%B5%81",
  "維基百科 副熱帶高氣壓帶":
    "https://zh.wikipedia.org/zh-tw/%E5%89%AF%E7%86%B1%E5%B8%B6%E9%AB%98%E6%B0%A3%E5%A3%93%E5%B8%B6",
  "維基百科 黑潮":
    "https://zh.wikipedia.org/zh-tw/%E9%BB%91%E6%BD%AE",
  "維基百科 加利福尼亞洋流":
    "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E5%88%A9%E7%A6%8F%E5%B0%BC%E4%BA%9E%E6%B4%8B%E6%B5%81",
  "維基百科 加那利洋流":
    "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E9%82%A3%E5%88%A9%E6%B4%8B%E6%B5%81",
  "維基百科 拉布拉多洋流":
    "https://zh.wikipedia.org/zh-tw/%E6%8B%89%E5%B8%83%E6%8B%89%E5%A4%9A%E6%B4%8B%E6%B5%81",
  "維基百科 秘魯涼流":
    "https://zh.wikipedia.org/zh-tw/%E7%A7%98%E9%AD%AF%E6%B6%BC%E6%B5%81",
  "維基百科 墨西哥灣暖流":
    "https://zh.wikipedia.org/zh-tw/%E5%A2%A8%E8%A5%BF%E5%93%A5%E7%81%A3%E6%9A%96%E6%B5%81",
  "維基百科 南赤道洋流":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E8%B5%A4%E9%81%93%E6%B4%8B%E6%B5%81",
  "維基百科 南極繞極流":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%A5%B5%E7%B9%9E%E6%A5%B5%E6%B5%81",
  "維基百科 親潮":
    "https://zh.wikipedia.org/zh-tw/%E8%A6%AA%E6%BD%AE",
  "維基百科 熱帶輻合帶":
    "https://zh.wikipedia.org/zh-tw/%E7%86%B1%E5%B8%B6%E8%BC%BB%E5%90%88%E5%B8%B6",
  "維基百科 西澳洋流":
    "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E6%BE%B3%E6%B4%8B%E6%B5%81",
  "維基百科 西風帶":
    "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E9%A2%A8%E5%B8%B6",
  "維基百科 信風":
    "https://zh.wikipedia.org/zh-tw/%E4%BF%A1%E9%A2%A8",

};
