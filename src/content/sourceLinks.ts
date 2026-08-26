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
   * 而不是另外開一個欄位，比照 37 條活動斷層與 43 處保留區的既有決定：內容檔的
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
   * 古蹟三級定義卡的來源。連的是全國法規資料庫的法規本文而不是文化部首頁：
   * 「古蹟依其主管機關區分為國定、直轄市定、縣（市）定三類」這句話就在第 17 條，
   * 而指定基準（三選一，國定另加「重要、保存完整、典範」）在授權訂定的審查辦法
   * 第 2 條——兩份是不同的法規，各自連自己那一份才追得到。
   */
  文化資產保存法: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=H0170001",
  古蹟指定及廢止審查辦法: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=H0170058",
  // 舊制第一級／第二級／第三級古蹟怎麼變成現在三類的沿革（1997、2005 兩次修法）。
  // 次級來源，只用來查沿革，法條與數字一律以上面兩份法規與官方開放資料為準。
  "維基百科 國定古蹟": "https://zh.wikipedia.org/zh-tw/%E5%9C%8B%E5%AE%9A%E5%8F%A4%E8%B9%9F",
  /**
   * 洋流那一層的另一個來源。連的是 NOAA Ocean Service 的洋流教學專頁而不是首頁：
   * 暖流／寒流、環流方向與湧升流的說明都在這一頁，連到首頁等於追不到
   * （比照「農業部農業兒童網 山地植群帶分布」的既有判斷）。
   */
  "美國國家海洋暨大氣總署（NOAA）":
    "https://oceanservice.noaa.gov/education/tutorial_currents/",
  // 洋流圖層本身（18 條的分類與流向）。逐條洋流的條目另外登記在下面那 150 篇裡。
  "維基百科 洋流": "https://zh.wikipedia.org/zh-tw/%E6%B4%8B%E6%B5%81",
  // 緯度參考線的回歸線與極圈用的是轉軸傾角的實際值（約 23.436°），不是課本的 23.5°
  "維基百科 轉軸傾角": "https://zh.wikipedia.org/zh-tw/%E8%BD%89%E8%BB%B8%E5%82%BE%E8%A7%92",
  /**
   * 主要農業帶（planned）。⚠️ 這一層原本掛著「Natural Earth」，但 **NE 根本沒有
   * 農業資料**——那是照抄隔壁圖層填的。改成真正做得出這一層的公開資料集：
   * 聯合國糧農組織的全球農業生態區（GAEZ v4，免金鑰、可下載作物適宜性與實際產區）。
   */
  "聯合國糧農組織 全球農業生態區（GAEZ）": "https://gaez.fao.org/pages/data-viewer",

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
  /**
   * Natural Earth **不能只寫一個「Natural Earth」連到首頁**：世界主題有五個圖層用它，
   * 而它們吃的是五份不同的資料集（換日線是 10m 地理線、河流是 50m 河流中心線、
   * 大洲是 50m 國界…）。連到首頁等於把「這個數字哪來的」丟給讀者自己在下載頁裡翻，
   * 比照「農業部農業兒童網 山地植群帶分布」與 NOAA 那兩筆的既有判斷。
   *
   * ⚠️ 每一筆都對應 `scripts/lib/*.mjs` 或 `build-geodata.mjs` 裡真正抓的那個檔名，
   * 換資料集（例如河流從 50m 換成 10m）時這裡要跟著換。
   */
  // ne_10m_geographic_lines（國際換日線）
  "Natural Earth 1:10m 地理線":
    "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-geographic-lines/",
  // ne_50m_rivers_lake_centerlines（世界主要河流）
  "Natural Earth 1:50m 河流與湖泊中心線":
    "https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-rivers-lake-centerlines/",
  // ne_50m_admin_0_countries（大洲分區＝依 CONTINENT 欄位併起來的；國界那一層也用它）
  "Natural Earth 1:50m 國界":
    "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/",
  // ne_10m_geography_regions_polys（世界主要山脈的範圍面＝這份裡 featurecla 為 "Range/mtn" 的 222 筆）
  "Natural Earth 1:10m 自然地理區":
    "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/",
  /**
   * ne_10m_geography_regions_elevation_points（世界主要山脈的最高峰）。
   *
   * ⚠️ 網址跟上面那筆**是同一頁**（NE 把自然地理的面、線、點放在同一個下載頁），
   * 但標籤仍然要分成兩個：卡片上寫「Natural Earth 1:10m 自然地理區」而讀者拿到的
   * 是山峰高度時，他沒辦法知道那個數字出自哪一份檔案。
   */
  "Natural Earth 1:10m 高程點":
    "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/",
  // ne_10m_populated_places（世界人口分布 planned；三個世界地點的座標也出自它）
  "Natural Earth 1:10m 城市聚落":
    "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/",
  /**
   * 板塊與板塊邊界。授權是 ODC-BY 1.0，**要求標示出處**，所以原作者（Bird）與
   * 轉製者（Nordpil）兩個都要列，少一個就違反授權。
   */
  "Peter Bird (2003) 板塊模型": "https://doi.org/10.1029/2001GC000252",
  "Nordpil 板塊資料集": "https://github.com/fraxen/tectonicplates",
  "維基百科 板塊列表": "https://zh.wikipedia.org/zh-tw/%E6%9D%BF%E5%A1%8A%E5%88%97%E8%A1%A8",
  /**
   * 世界主題「板塊」那一層的 52 份圖徵說明（`src/content/geo/plates/`）。分類與面積
   * 一律以 Bird (2003) 為準（上面那兩筆），這 52 條維基百科條目只用來查已有共識的
   * 敘述性事實——板塊怎麼形成、邊界屬於哪一種、上面有哪些地形與地震火山事件。
   * ⚠️ 逐條登記，不要只寫泛稱的「維基百科」（那個標籤不在這份表裡，會渲染成沒有
   * 連結的純文字）。⚠️ 排序刻意跟 geojson 的圖徵順序一致（依面積由大到小），方便
   * 跟抽屜裡的清單對照。
   *
   * ⚠️ 中文條目名與本站採用的板塊中文名不一定相同（本站的「湯加板塊」在維基百科
   * 是〈東加板塊〉、「揚子板塊」是〈華南板塊〉、「新海布里地板塊」是
   * 〈新赫布里底板塊〉…）。這裡一律用**本站的名字**當標籤與網址，維基百科的
   * `/zh-tw/` 路徑會自己做重新導向與字形轉換——52 條實測全部回 200 並落在正確的
   * 條目上。改動時請重跑一次那個檢查，不要只看有沒有拼錯字。
   *
   * ⚠️ 菲律賓海、揚子、巽他、阿穆爾、沖繩五塊**不在這一段裡**：它們早就登記在下面
   * 臺灣主題那一段，兩個主題共用同一個標籤，所以這裡刻意不重複登記。
   */
  "維基百科 太平洋板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%A4%AA%E5%B9%B3%E6%B4%8B%E6%9D%BF%E5%A1%8A",
  "維基百科 非洲板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%9D%9E%E6%B4%B2%E6%9D%BF%E5%A1%8A",
  "維基百科 南極洲板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%A5%B5%E6%B4%B2%E6%9D%BF%E5%A1%8A",
  "維基百科 北美洲板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E7%BE%8E%E6%B4%B2%E6%9D%BF%E5%A1%8A",
  "維基百科 歐亞板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%AD%90%E4%BA%9E%E6%9D%BF%E5%A1%8A",
  "維基百科 澳洲板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%BE%B3%E6%B4%B2%E6%9D%BF%E5%A1%8A",
  "維基百科 南美洲板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E7%BE%8E%E6%B4%B2%E6%9D%BF%E5%A1%8A",
  "維基百科 印度板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%B0%E5%BA%A6%E6%9D%BF%E5%A1%8A",
  "維基百科 索馬利亞板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%B4%A2%E9%A6%AC%E5%88%A9%E4%BA%9E%E6%9D%BF%E5%A1%8A",
  "維基百科 納斯卡板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%B4%8D%E6%96%AF%E5%8D%A1%E6%9D%BF%E5%A1%8A",
  "維基百科 阿拉伯板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E6%8B%89%E4%BC%AF%E6%9D%BF%E5%A1%8A",
  "維基百科 鄂霍次克板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%84%82%E9%9C%8D%E6%AC%A1%E5%85%8B%E6%9D%BF%E5%A1%8A",
  "維基百科 加勒比板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E5%8B%92%E6%AF%94%E6%9D%BF%E5%A1%8A",
  "維基百科 科科斯板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%A7%91%E7%A7%91%E6%96%AF%E6%9D%BF%E5%A1%8A",
  "維基百科 斯科舍板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%96%AF%E7%A7%91%E8%88%8D%E6%9D%BF%E5%A1%8A",
  "維基百科 加洛林板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E6%B4%9B%E6%9E%97%E6%9D%BF%E5%A1%8A",
  "維基百科 新海布里地板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E6%B5%B7%E5%B8%83%E9%87%8C%E5%9C%B0%E6%9D%BF%E5%A1%8A",
  "維基百科 緬甸板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%B7%AC%E7%94%B8%E6%9D%BF%E5%A1%8A",
  "維基百科 北安地斯板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E5%AE%89%E5%9C%B0%E6%96%AF%E6%9D%BF%E5%A1%8A",
  "維基百科 阿爾蒂普拉諾板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E7%88%BE%E8%92%82%E6%99%AE%E6%8B%89%E8%AB%BE%E6%9D%BF%E5%A1%8A",
  "維基百科 班達海板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%8F%AD%E9%81%94%E6%B5%B7%E6%9D%BF%E5%A1%8A",
  "維基百科 安那托利亞板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%AE%89%E9%82%A3%E6%89%98%E5%88%A9%E4%BA%9E%E6%9D%BF%E5%A1%8A",
  "維基百科 鳥首板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%B3%A5%E9%A6%96%E6%9D%BF%E5%A1%8A",
  "維基百科 克馬德克板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%85%8B%E9%A6%AC%E5%BE%B7%E5%85%8B%E6%9D%BF%E5%A1%8A",
  "維基百科 木百靈板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%9C%A8%E7%99%BE%E9%9D%88%E6%9D%BF%E5%A1%8A",
  "維基百科 馬里亞納板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%A6%AC%E9%87%8C%E4%BA%9E%E7%B4%8D%E6%9D%BF%E5%A1%8A",
  "維基百科 摩鹿加海板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%91%A9%E9%B9%BF%E5%8A%A0%E6%B5%B7%E6%9D%BF%E5%A1%8A",
  "維基百科 北俾斯麥板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8C%97%E4%BF%BE%E6%96%AF%E9%BA%A5%E6%9D%BF%E5%A1%8A",
  "維基百科 帝汶板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%B8%9D%E6%B1%B6%E6%9D%BF%E5%A1%8A",
  "維基百科 愛琴海板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%84%9B%E7%90%B4%E6%B5%B7%E6%9D%BF%E5%A1%8A",
  "維基百科 南俾斯麥板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E4%BF%BE%E6%96%AF%E9%BA%A5%E6%9D%BF%E5%A1%8A",
  "維基百科 巴拿馬板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E6%8B%BF%E9%A6%AC%E6%9D%BF%E5%A1%8A",
  "維基百科 胡安·德富卡板塊":
    "https://zh.wikipedia.org/zh-tw/%E8%83%A1%E5%AE%89%C2%B7%E5%BE%B7%E5%AF%8C%E5%8D%A1%E6%9D%BF%E5%A1%8A",
  "維基百科 湯加板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%B9%AF%E5%8A%A0%E6%9D%BF%E5%A1%8A",
  "維基百科 巴爾莫勒爾礁板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E7%88%BE%E8%8E%AB%E5%8B%92%E7%88%BE%E7%A4%81%E6%9D%BF%E5%A1%8A",
  "維基百科 南桑威奇板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%A1%91%E5%A8%81%E5%A5%87%E6%9D%BF%E5%A1%8A",
  "維基百科 復活節島板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%BE%A9%E6%B4%BB%E7%AF%80%E5%B3%B6%E6%9D%BF%E5%A1%8A",
  "維基百科 康威礁板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%BA%B7%E5%A8%81%E7%A4%81%E6%9D%BF%E5%A1%8A",
  "維基百科 所羅門海板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%89%80%E7%BE%85%E9%96%80%E6%B5%B7%E6%9D%BF%E5%A1%8A",
  "維基百科 紐阿福歐板塊":
    "https://zh.wikipedia.org/zh-tw/%E7%B4%90%E9%98%BF%E7%A6%8F%E6%AD%90%E6%9D%BF%E5%A1%8A",
  "維基百科 毛克板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%AF%9B%E5%85%8B%E6%9D%BF%E5%A1%8A",
  "維基百科 里維拉板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%87%8C%E7%B6%AD%E6%8B%89%E6%9D%BF%E5%A1%8A",
  "維基百科 胡安·費爾南德斯板塊":
    "https://zh.wikipedia.org/zh-tw/%E8%83%A1%E5%AE%89%C2%B7%E8%B2%BB%E7%88%BE%E5%8D%97%E5%BE%B7%E6%96%AF%E6%9D%BF%E5%A1%8A",
  "維基百科 設得蘭板塊":
    "https://zh.wikipedia.org/zh-tw/%E8%A8%AD%E5%BE%97%E8%98%AD%E6%9D%BF%E5%A1%8A",
  "維基百科 富圖納板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%AF%8C%E5%9C%96%E7%B4%8D%E6%9D%BF%E5%A1%8A",
  "維基百科 加拉巴哥板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E6%8B%89%E5%B7%B4%E5%93%A5%E6%9D%BF%E5%A1%8A",
  "維基百科 馬努斯板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%A6%AC%E5%8A%AA%E6%96%AF%E6%9D%BF%E5%A1%8A",
  /**
   * 臺灣主題的「板塊」與「板塊邊界」兩層（`src/content/geo/tw-plates/` 與
   * `tw-plate-boundaries/`）。幾何與分類一律以 Bird (2003) 為準（上面那兩筆），
   * 這幾條維基百科條目只用來查已有共識的敘述性事實——板塊的中文名、沖繩海槽是
   * 弧後盆地、南海何時停止擴張這一類。⚠️ 逐條登記，不要只寫泛稱的「維基百科」
   * （那個標籤不在這份表裡，會渲染成沒有連結的純文字）。
   */
  "維基百科 菲律賓海板塊":
    "https://zh.wikipedia.org/zh-tw/%E8%8F%B2%E5%BE%8B%E8%B3%93%E6%B5%B7%E6%9D%BF%E5%A1%8A",
  "維基百科 揚子板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%8F%9A%E5%AD%90%E6%9D%BF%E5%A1%8A",
  "維基百科 巽他板塊":
    "https://zh.wikipedia.org/zh-tw/%E5%B7%BD%E4%BB%96%E6%9D%BF%E5%A1%8A",
  "維基百科 阿穆爾板塊":
    "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E7%A9%86%E7%88%BE%E6%9D%BF%E5%A1%8A",
  "維基百科 沖繩板塊":
    "https://zh.wikipedia.org/zh-tw/%E6%B2%96%E7%B9%A9%E6%9D%BF%E5%A1%8A",
  "維基百科 沖繩海槽":
    "https://zh.wikipedia.org/zh-tw/%E6%B2%96%E7%B9%A9%E6%B5%B7%E6%A7%BD",
  "維基百科 琉球海溝":
    "https://zh.wikipedia.org/zh-tw/%E7%90%89%E7%90%83%E6%B5%B7%E6%BA%9D",
  "維基百科 馬尼拉海溝":
    "https://zh.wikipedia.org/zh-tw/%E9%A6%AC%E5%B0%BC%E6%8B%89%E6%B5%B7%E6%BA%9D",
  "維基百科 臺灣海峽":
    "https://zh.wikipedia.org/zh-tw/%E8%87%BA%E7%81%A3%E6%B5%B7%E5%B3%BD",
  "維基百科 南海":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E6%B5%B7",
  // 世界主要山脈：39 條的中文名與成因說明的查閱來源（次級來源，見 CLAUDE.md「內容撰寫規範」）
  "維基百科 山脈列表": "https://zh.wikipedia.org/zh-tw/%E5%B1%B1%E8%84%88%E5%88%97%E8%A1%A8",
  /**
   * 39 條山脈各自的條目——每一份內容檔（`src/content/geo/world-mountains/`）都引它。
   *
   * ⚠️ 標籤裡的條目名要跟維基百科上**實際的**標題一致（連結是由它組出來的）：
   * 「海岸山脈 (北美)」與「內華達山脈 (美國)」的括號是條目自己的消歧義後綴，
   * 少了它會連到臺灣的海岸山脈與西班牙的內華達山脈。全部實測過 HTTP 200。
   */
  "維基百科 喜馬拉雅山脈": "https://zh.wikipedia.org/zh-tw/%E5%96%9C%E9%A6%AC%E6%8B%89%E9%9B%85%E5%B1%B1%E8%84%88",
  "維基百科 喀喇崑崙山脈": "https://zh.wikipedia.org/zh-tw/%E5%96%80%E5%96%87%E5%B4%91%E5%B4%99%E5%B1%B1%E8%84%88",
  "維基百科 興都庫什山脈": "https://zh.wikipedia.org/zh-tw/%E8%88%88%E9%83%BD%E5%BA%AB%E4%BB%80%E5%B1%B1%E8%84%88",
  "維基百科 帕米爾高原": "https://zh.wikipedia.org/zh-tw/%E5%B8%95%E7%B1%B3%E7%88%BE%E9%AB%98%E5%8E%9F",
  "維基百科 天山山脈": "https://zh.wikipedia.org/zh-tw/%E5%A4%A9%E5%B1%B1%E5%B1%B1%E8%84%88",
  "維基百科 崑崙山脈": "https://zh.wikipedia.org/zh-tw/%E5%B4%91%E5%B4%99%E5%B1%B1%E8%84%88",
  "維基百科 阿爾泰山脈": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E7%88%BE%E6%B3%B0%E5%B1%B1%E8%84%88",
  "維基百科 祁連山脈": "https://zh.wikipedia.org/zh-tw/%E7%A5%81%E9%80%A3%E5%B1%B1%E8%84%88",
  "維基百科 秦嶺": "https://zh.wikipedia.org/zh-tw/%E7%A7%A6%E5%B6%BA",
  "維基百科 大興安嶺": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E8%88%88%E5%AE%89%E5%B6%BA",
  "維基百科 札格羅斯山脈": "https://zh.wikipedia.org/zh-tw/%E6%9C%AD%E6%A0%BC%E7%BE%85%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 厄爾布爾士山脈": "https://zh.wikipedia.org/zh-tw/%E5%8E%84%E7%88%BE%E5%B8%83%E7%88%BE%E5%A3%AB%E5%B1%B1%E8%84%88",
  "維基百科 托魯斯山脈": "https://zh.wikipedia.org/zh-tw/%E6%89%98%E9%AD%AF%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 西高止山脈": "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E9%AB%98%E6%AD%A2%E5%B1%B1%E8%84%88",
  "維基百科 安南山脈": "https://zh.wikipedia.org/zh-tw/%E5%AE%89%E5%8D%97%E5%B1%B1%E8%84%88",
  "維基百科 巴里桑山脈": "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E9%87%8C%E6%A1%91%E5%B1%B1%E8%84%88",
  "維基百科 阿爾卑斯山脈": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E7%88%BE%E5%8D%91%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 庇里牛斯山脈": "https://zh.wikipedia.org/zh-tw/%E5%BA%87%E9%87%8C%E7%89%9B%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 喀爾巴阡山脈": "https://zh.wikipedia.org/zh-tw/%E5%96%80%E7%88%BE%E5%B7%B4%E9%98%A1%E5%B1%B1%E8%84%88",
  "維基百科 亞平寧山脈": "https://zh.wikipedia.org/zh-tw/%E4%BA%9E%E5%B9%B3%E5%AF%A7%E5%B1%B1%E8%84%88",
  "維基百科 斯堪地那維亞山脈": "https://zh.wikipedia.org/zh-tw/%E6%96%AF%E5%A0%AA%E5%9C%B0%E9%82%A3%E7%B6%AD%E4%BA%9E%E5%B1%B1%E8%84%88",
  "維基百科 高加索山脈": "https://zh.wikipedia.org/zh-tw/%E9%AB%98%E5%8A%A0%E7%B4%A2%E5%B1%B1%E8%84%88",
  "維基百科 烏拉山脈": "https://zh.wikipedia.org/zh-tw/%E7%83%8F%E6%8B%89%E5%B1%B1%E8%84%88",
  "維基百科 阿特拉斯山脈": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E7%89%B9%E6%8B%89%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 衣索比亞高原": "https://zh.wikipedia.org/zh-tw/%E8%A1%A3%E7%B4%A2%E6%AF%94%E4%BA%9E%E9%AB%98%E5%8E%9F",
  "維基百科 德拉肯斯山脈": "https://zh.wikipedia.org/zh-tw/%E5%BE%B7%E6%8B%89%E8%82%AF%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 洛磯山脈": "https://zh.wikipedia.org/zh-tw/%E6%B4%9B%E7%A3%AF%E5%B1%B1%E8%84%88",
  "維基百科 阿帕拉契山脈": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E5%B8%95%E6%8B%89%E5%A5%91%E5%B1%B1%E8%84%88",
  "維基百科 海岸山脈 (北美)": "https://zh.wikipedia.org/zh-tw/%E6%B5%B7%E5%B2%B8%E5%B1%B1%E8%84%88%20(%E5%8C%97%E7%BE%8E)",
  "維基百科 喀斯開山脈": "https://zh.wikipedia.org/zh-tw/%E5%96%80%E6%96%AF%E9%96%8B%E5%B1%B1%E8%84%88",
  "維基百科 內華達山脈 (美國)": "https://zh.wikipedia.org/zh-tw/%E5%85%A7%E8%8F%AF%E9%81%94%E5%B1%B1%E8%84%88%20(%E7%BE%8E%E5%9C%8B)",
  "維基百科 阿拉斯加山脈": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E6%8B%89%E6%96%AF%E5%8A%A0%E5%B1%B1%E8%84%88",
  "維基百科 東馬德雷山脈": "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E9%A6%AC%E5%BE%B7%E9%9B%B7%E5%B1%B1%E8%84%88",
  "維基百科 西馬德雷山脈": "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E9%A6%AC%E5%BE%B7%E9%9B%B7%E5%B1%B1%E8%84%88",
  "維基百科 安地斯山脈": "https://zh.wikipedia.org/zh-tw/%E5%AE%89%E5%9C%B0%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 大分水嶺": "https://zh.wikipedia.org/zh-tw/%E5%A4%A7%E5%88%86%E6%B0%B4%E5%B6%BA",
  "維基百科 南阿爾卑斯山脈": "https://zh.wikipedia.org/zh-tw/%E5%8D%97%E9%98%BF%E7%88%BE%E5%8D%91%E6%96%AF%E5%B1%B1%E8%84%88",
  "維基百科 新幾內亞高地": "https://zh.wikipedia.org/zh-tw/%E6%96%B0%E5%B9%BE%E5%85%A7%E4%BA%9E%E9%AB%98%E5%9C%B0",
  "維基百科 橫貫南極山脈": "https://zh.wikipedia.org/zh-tw/%E6%A9%AB%E8%B2%AB%E5%8D%97%E6%A5%B5%E5%B1%B1%E8%84%88",
  /**
   * ── 世界櫥窗：地表之最 ──────────────────────────────────────────────
   *
   * ⚠️ 這四筆的規則跟別處一樣：連得到**那份資料本身**，不是機構首頁。
   */
  // 中洋脊的長度（約 65,000 公里）與「九成以上在海面下」都出自這一頁的事實說明，
  // 不是 NOAA 首頁，也不是洋流那一層引的那份洋流教學頁。
  "美國國家海洋暨大氣總署 中洋脊": "https://oceanexplorer.noaa.gov/facts/mid-ocean-ridge.html",
  "維基百科 洋中脊": "https://zh.wikipedia.org/zh-tw/%E6%B4%8B%E4%B8%AD%E8%84%8A",
  // 聖母峰的 8,848.86 公尺（2020 年中尼聯合公布的雪面高程）與岩面高程的差別
  "維基百科 珠穆朗瑪峰": "https://zh.wikipedia.org/zh-tw/%E7%8F%A0%E7%A9%86%E6%9C%97%E7%8E%9B%E5%B3%B0",
  /**
   * ⚠️ 連的是**日文**維基百科：日和山（仙台市宮城野區蒲生）在中文維基百科沒有
   * 條目，而海嘯削掉山頭、2014 年重新確認 3 公尺這段沿革只有那一篇寫得完整。
   */
  "維基百科 日和山（仙台市）": "https://ja.wikipedia.org/wiki/%E6%97%A5%E5%92%8C%E5%B1%B1_(%E4%BB%99%E5%8F%B0%E5%B8%82)",
  /**
   * 日和山「是一座山」的官方依據就是它登載在地理院地圖（地形圖）上，所以連的是
   * **定位到那座山的地圖本身**，不是國土地理院首頁——那是這筆數字唯一追得到的
   * 原始出處（比照海峽中線那筆「官方沒有可連結的公告」的處理方式）。
   */
  "日本國土地理院 地理院地圖（日和山）": "https://maps.gsi.go.jp/#16/38.255750/141.011806/",
  /**
   * ⚠️ 連的是**英文**維基百科：普哈胡努（加德納尖峰）在中文維基百科沒有條目。
   * 體積 15 萬 km³ 的原始出處是下面那篇 2020 年的論文，維基百科只是查閱管道。
   */
  "維基百科 Pūhāhonu": "https://en.wikipedia.org/wiki/P%C5%ABh%C4%81honu",
  // 「體積最大的火山」這個紀錄換人的原始研究（Earth and Planetary Science Letters）。
  // ⚠️ 數值型的權威資料一律以原始文獻為準，維基百科只是次級來源（見 CLAUDE.md）。
  "Garcia et al. (2020) 普哈胡努：地球上最大最熱的盾狀火山":
    "https://doi.org/10.1016/j.epsl.2020.116296",
  // 露出海面那兩塊岩石的官方介紹頁（不是紀念區首頁）
  "帕帕哈瑙莫夸基亞海洋國家紀念區 加德納尖峰":
    "https://www.papahanaumokuakea.gov/visit/gardner.html",
  // 世界櫥窗的兩座安地斯火山（中文名與沿革；座標、海拔與噴發年代以 GVP 為準）
  "維基百科 奧霍斯-德爾薩拉多山":
    "https://zh.wikipedia.org/zh-tw/%E5%A5%A5%E9%9C%8D%E6%96%AF-%E5%BE%B7%E5%B0%94%E8%90%A8%E6%8B%89%E5%A4%9A%E5%B1%B1",
  "維基百科 尤耶亞科山": "https://zh.wikipedia.org/zh-tw/%E5%B0%A4%E8%80%B6%E4%BA%9E%E7%A7%91%E5%B1%B1",
  // 維蘇威火山那一筆：火山本身、西元 79 年那次噴發、被埋掉的城市，三個條目分開登記
  // ——「那次噴發」與「那座城市」是這一筆真正要講的東西，連到火山條目追不到。
  "維基百科 維蘇威火山": "https://zh.wikipedia.org/zh-tw/%E7%B6%AD%E8%98%87%E5%A8%81%E7%81%AB%E5%B1%B1",
  "維基百科 西元79年維蘇威火山爆發":
    "https://zh.wikipedia.org/zh-tw/%E8%A5%BF%E5%85%8379%E5%B9%B4%E7%B6%AD%E8%98%87%E5%A8%81%E7%81%AB%E5%B1%B1%E7%88%86%E7%99%BC",
  "維基百科 龐貝": "https://zh.wikipedia.org/zh-tw/%E5%BA%9E%E8%B4%9D",
  /**
   * 理查特結構（撒哈拉之眼）那一筆。三個來源各自回答這張卡的一件事：
   * ⚠️ IUGS 那一頁是「撞擊說已被推翻」這句話的出處（2022 年全球百大地質遺產的
   * 認定文件，`SITE 048`），維基百科追不到那個層級的判斷；NASA 那一頁是「太空人
   * 拿它當地標」與 45 公里那個尺寸的出處。
   * ⚠️ NASA 的網址寫 `science.nasa.gov`，**不要改回 `earthobservatory.nasa.gov`**：
   * 舊網址現在是 301 轉址（實測），連過去會多跳一次。
   */
  "維基百科 理查特結構":
    "https://zh.wikipedia.org/zh-tw/%E7%90%86%E6%9F%A5%E7%89%B9%E7%B5%90%E6%A7%8B",
  "IUGS 全球地質遺產 理查特結構":
    "https://iugs-geoheritage.org/geoheritage_sites/richat-structure-a-cretaceous-alkaline-complex/",
  "NASA 地球觀測站 理查特結構":
    "https://science.nasa.gov/earth/earth-observatory/richat-structure-92071",
  /**
   * 尼莫點那一筆。⚠️ NOAA 那一頁是「Bloop 是冰震、而且這種聲音能傳五千公里以上」
   * 的出處——那句話是這張卡的重點（「聽起來來自附近」不等於來源在附近），
   * 維基百科追不到那個層級的判斷。拉萊耶另外登記條目：它是小說設定，
   * 跟前兩者不是同一種東西，混在一個「維基百科」標籤底下讀者分不出來。
   */
  "維基百科 尼莫點": "https://zh.wikipedia.org/zh-tw/%E5%B0%BC%E8%8E%AB%E9%BB%9E",
  "美國國家海洋暨大氣總署 Bloop 聲響": "https://www.pmel.noaa.gov/acoustics/sounds/bloop.html",
  "維基百科 拉萊耶": "https://zh.wikipedia.org/zh-tw/%E6%8B%89%E8%90%8A%E8%80%B6",
  /**
   * 荷姆茲海峽那一筆。四個來源各自撐起卡片的一段：
   * ⚠️ 石油流量一律以**美國能源資訊署（EIA）**那一頁為準（2,100 萬桶／日、占全球
   * 石油液體消費 21%），不要改用新聞轉述的數字——那些多半沒寫是哪一年、哪一種口徑。
   * ⚠️ 臺灣那一段的百分比是**自己從能源署的年資料算出來的**（波斯灣內五國占 61.7%，
   * 2025 年），所以來源連的是那份資料集本身而不是任何一篇報導；重算時記得阿曼的油港
   * 在海峽外面，不能算進來。
   * ⚠️ Lloyd's List Intelligence 那一條撐的是卡片上**有時效**的那一段（2026 年 8 月的
   * 通行量），日期已經寫進內文，之後要更新的就是那一句。
   */
  "維基百科 荷姆茲海峽":
    "https://zh.wikipedia.org/zh-tw/%E9%9C%8D%E5%B0%94%E6%9C%A8%E5%85%B9%E6%B5%B7%E5%B3%A1",
  "美國能源資訊署 荷姆茲海峽石油流量": "https://www.eia.gov/todayinenergy/detail.php?id=61002",
  "經濟部能源署 原油進口來源年資料": "https://data.gov.tw/dataset/163714",
  "Lloyd's List Intelligence 荷姆茲海峽簡報":
    "https://www.lloydslistintelligence.com/resources/blog/strait-of-hormuz-brief-5-august-2026",
  /**
   * 土渕海峽（世界最窄的海峽）那一筆。四個來源各自撐起這張卡的一段：
   * ⚠️ 尺寸（9.93／2,500 公尺、滿潮 3.4 與乾潮 1.5 公尺水深）與 100 日圓的橫渡
   * 證明書一律以**土庄町**那一頁為準，那是主管這條水道的地方政府自己公布的，
   * 不要改抄旅遊網站或新聞轉述的數字。
   * ⚠️ 連的是**日文**維基百科：名稱是為了申請金氏世界紀錄才取的、1990 年因為
   * 「沒有國家機關的證明」被退件、登載到地形圖之後才於 1996 年通過——這段沿革
   * 只有那一篇寫得完整（中文條目是沒有列出任何來源的小作品，只用來對照譯名）。
   * ⚠️ 地理院地圖那一條跟日和山是同一種處理：這條水道「算不算一條海峽」的官方
   * 依據就是它登載在地形圖上，所以連的是**定位到那條海峽的地圖本身**，不是國土
   * 地理院首頁。實測國土地理院的地名檢索（`msearch.gsi.go.jp/address-search`）
   * 打「土渕海峡」回傳的就是這一條，證明那筆登載至今仍在。
   */
  "土庄町 土渕海峽": "https://www.town.tonosho.kagawa.jp/kanko/sightseeing/581.html",
  "維基百科（日文） 土渕海峽": "https://ja.wikipedia.org/wiki/%E5%9C%9F%E6%B8%95%E6%B5%B7%E5%B3%A1",
  "日本國土地理院 地理院地圖（土渕海峽）":
    "https://maps.gsi.go.jp/#17/34.486472/134.186183/",
  "維基百科 土渕海峽": "https://zh.wikipedia.org/zh-tw/%E5%9C%9F%E6%B8%95%E6%B5%B7%E5%B3%BD",
  /**
   * 麻六甲海峽那一筆。⚠️ 石油流量沿用荷姆茲那條既有規則：**一律以 EIA 那一頁為準**，
   * 不要改用新聞轉述的數字。連的是 EIA 專講麻六甲的那一篇（2017-08-11，資料年是
   * 2016 年的每日 1,600 萬桶），**不是**荷姆茲那一篇——那一頁整篇沒有提到麻六甲。
   * ⚠️ 卡片已經把「2016 年」寫進句子裡，因為它跟荷姆茲引的 2022 年不是同一年；
   * 之後 EIA 更新了就連同年份一起換。
   * ⚠️ 「麻六甲困境」在中文維基百科沒有條目（`马六甲困局`／`馬六甲困境` 兩個標題
   * 都不存在，實測），所以連英文條目——胡錦濤 2003 年提出、中國進口原油約八成
   * 經過這裡這兩件事只有那一篇寫得完整。
   * ⚠️ 中文維基的條目名是「马六甲海峡」，本站用臺灣慣用的「麻六甲海峽」——那個
   * 標題在維基上是重新導向（實測），所以這個網址連得過去。
   */
  "維基百科 麻六甲海峽": "https://zh.wikipedia.org/zh-tw/%E9%A9%AC%E5%85%AD%E7%94%B2%E6%B5%B7%E5%B3%A1",
  "美國能源資訊署 麻六甲海峽石油流量": "https://www.eia.gov/todayinenergy/detail.php?id=32452",
  "維基百科（英文） 麻六甲困境": "https://en.wikipedia.org/wiki/Malacca_Dilemma",
  /**
   * 直布羅陀海峽、博斯普魯斯海峽、曼德海峽（2026-08 一次加進來的三條海峽）。
   * ⚠️ 沿用本檔案的規則：**泛稱的「維基百科」不登記**，逐條目寫出名字；石油流量
   * 一律以 EIA 那一頁為準。
   * ⚠️ 曼德海峽的 EIA 連的是專講它的那一篇（2019-08-27，資料年是 2018 年的每日
   * 620 萬桶），跟荷姆茲、麻六甲各自連的是三個不同的頁面。
   * ⚠️ 「蒙特勒公約」與「土耳其海峽」在中文維基百科都沒有條目（實測），所以連英文。
   * 「贊克萊洪水」同理沒有中文條目，那一段併在「墨西拿鹽度危機」裡講，不另外登記。
   */
  "維基百科 直布羅陀海峽":
    "https://zh.wikipedia.org/zh-tw/%E7%9B%B4%E5%B8%83%E7%BE%85%E9%99%80%E6%B5%B7%E5%B3%BD",
  "維基百科 海格力斯之柱":
    "https://zh.wikipedia.org/zh-tw/%E6%B5%B7%E6%A0%BC%E5%8A%9B%E6%96%AF%E4%B9%8B%E6%9F%B1",
  "維基百科 墨西拿鹽度危機":
    "https://zh.wikipedia.org/zh-tw/%E5%A2%A8%E8%A5%BF%E6%8B%BF%E9%B9%BD%E5%BA%A6%E5%8D%B1%E6%A9%9F",
  "維基百科 博斯普魯斯海峽":
    "https://zh.wikipedia.org/zh-tw/%E5%8D%9A%E6%96%AF%E6%99%AE%E9%B2%81%E6%96%AF%E6%B5%B7%E5%B3%A1",
  "維基百科（英文） 蒙特勒公約":
    "https://en.wikipedia.org/wiki/Montreux_Convention_Regarding_the_Regime_of_the_Straits",
  "維基百科（英文） 土耳其海峽": "https://en.wikipedia.org/wiki/Turkish_Straits",
  "維基百科 曼德海峽": "https://zh.wikipedia.org/zh-tw/%E6%9B%BC%E5%BE%B7%E6%B5%B7%E5%B3%A1",
  "美國能源資訊署 曼德海峽石油與天然氣流量":
    "https://www.eia.gov/todayinenergy/detail.php?id=41073",
  /**
   * ⚠️ 這是本站第一個引用 IMF PortWatch 的地方。連的是**那份資料集本身**
   * （`Daily_Chokepoints_Data`：全球 28 個咽喉點的每日通行艘次與估計貨運量），
   * 不是 PortWatch 首頁——曼德海峽那張卡上的 74.6／32.5／28.2 就是從它算出來的
   * （用它的 ArcGIS FeatureServer 對 `n_total` 取期間平均）。
   * ⚠️ 這份資料**每天都在更新**，卡片上的數字因此寫死了統計截止日；要重算就照
   * 卡片上的期間重跑一次，不要只改數字不改日期。
   */
  "國際貨幣基金組織 PortWatch 每日咽喉點通行量":
    "https://portwatch.imf.org/datasets/3da2b9ca97684916b75c4013f95d18ab/about",
  /**
   * 臺灣海峽（2026-08 加入「作者精選」的第六條海峽）。
   * ⚠️ 「黑水溝」另外登記條目：那是這張卡第二段的主題（移民、季風、《渡臺悲歌》），
   * 主條目講不到那個層次。
   * ⚠️ 「澎湖 1 號」撐的是「冰期時海峽是陸地」那一段唯一的實物證據——2015 年
   * 《自然．通訊》、2025 年以蛋白質定序確認為丹尼索瓦人。中文條目名是「澎湖1號」
   * （不是「澎湖原人」，那個標題是重新導向）。
   * ⚠️ 通行艘次沿用上面那筆 PortWatch，不另外登記。
   */
  // ⚠️「維基百科 臺灣海峽」在上面板塊那一區已經登記過了（同一個網址），不要再加一次
  //    ——重複的 key 會讓 tsc 直接報 TS1117（踩過）。
  "維基百科 黑水溝": "https://zh.wikipedia.org/zh-tw/%E9%BB%91%E6%B0%B4%E6%BA%9D",
  "維基百科 澎湖1號": "https://zh.wikipedia.org/zh-tw/%E6%BE%8E%E6%B9%961%E8%99%9F",
  /**
   * 兩條運河（2026-08 加入「作者精選」的「運河」那一組）。
   * ⚠️ 通行艘次沿用上面那筆 PortWatch，不另外登記。
   * ⚠️ 加通湖另外登記條目：那是巴拿馬運河「為什麼非有船閘不可」與「每次通行要用掉
   * 2 億公升淡水」兩段的主角，主條目只帶過一句。
   * ⚠️ 長賜輪（2021 年擱淺六天那一艘）與《君士坦丁堡公約》（1888 年、規定運河
   * 戰時也應開放）各自登記——那是蘇伊士那張卡「省下 7,000 公里，但隨時可能停掉」
   * 那一段的兩個具體依據。
   * ⚠️ 「雷賽布遷徙」在中文維基百科沒有條目（`雷塞布遷徙`／`勒塞普遷徙` 兩個標題
   * 實測都不存在），所以連英文。
   */
  "維基百科 巴拿馬運河": "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E6%8B%BF%E9%A9%AC%E8%BF%90%E6%B2%B3",
  "維基百科 加通湖": "https://zh.wikipedia.org/zh-tw/%E5%8A%A0%E9%80%9A%E6%B9%96",
  "維基百科 蘇伊士運河": "https://zh.wikipedia.org/zh-tw/%E8%8B%8F%E4%BC%8A%E5%A3%AB%E8%BF%90%E6%B2%B3",
  "維基百科 長賜輪": "https://zh.wikipedia.org/zh-tw/%E9%95%B7%E8%B3%9C%E8%BC%AA",
  "維基百科 君士坦丁堡公約":
    "https://zh.wikipedia.org/zh-tw/%E5%90%9B%E5%A3%AB%E5%9D%A6%E4%B8%81%E5%A0%A1%E5%85%AC%E7%B4%84",
  "維基百科（英文） 雷賽布遷徙": "https://en.wikipedia.org/wiki/Lessepsian_migration",
  /**
   * 兩個海角（2026-08 加入「作者精選」的「海角」那一組，排在「運河」後面）。
   * ⚠️ 通行艘次沿用上面那筆 PortWatch，不另外登記——合恩角那張卡引的是麥哲倫海峽、
   * 好望角那張卡引的是好望角本身，兩筆都出自同一個 `Daily_Chokepoints_Data` 資料集。
   * ⚠️ 「海洋的界線」連英文條目，因為兩張卡共同的重點——大西洋／太平洋的界線是
   * 合恩角的經線（西經 67°16′）、大西洋／印度洋的界線是厄加勒斯角的東經 20 度——
   * 出自國際海道測量組織的《海洋與海域的界限》(S-23)，而中文維基百科沒有對應條目
   * （`海洋和海的界限`／`海與洋的界限` 實測都不存在）；IHO 官方那份 PDF 的公開鏡像
   * 擋自動連線，所以連的是把 S-23 逐條列出來的那個英文條目。
   * ⚠️ 弗羅厄德角、厄加勒斯角、開普角三筆各自登記：它們分別撐著「合恩角不是南美洲
   * 大陸最南端」「好望角不是非洲最南端」「站在開普角不等於站在好望角」三段，主條目
   * 都只帶過一句。
   */
  "維基百科 合恩角": "https://zh.wikipedia.org/zh-tw/%E5%90%88%E6%81%A9%E8%A7%92",
  "維基百科 德雷克海峽":
    "https://zh.wikipedia.org/zh-tw/%E5%BE%B7%E9%9B%B7%E5%85%8B%E6%B5%B7%E5%B3%A1",
  "維基百科 弗羅厄德角":
    "https://zh.wikipedia.org/zh-tw/%E5%BC%97%E7%BE%85%E5%8E%84%E5%BE%B7%E8%A7%92",
  "維基百科 好望角": "https://zh.wikipedia.org/zh-tw/%E5%A5%BD%E6%9C%9B%E8%A7%92",
  "維基百科 厄加勒斯角":
    "https://zh.wikipedia.org/zh-tw/%E5%8E%84%E5%8A%A0%E5%8B%92%E6%96%AF%E8%A7%92",
  "維基百科 開普角": "https://zh.wikipedia.org/zh-tw/%E9%96%8B%E6%99%AE%E8%A7%92",
  "維基百科 巴爾托洛梅烏·迪亞士":
    "https://zh.wikipedia.org/zh-tw/%E5%B7%B4%E7%88%BE%E6%89%98%E6%B4%9B%E6%A2%85%E7%83%8F%C2%B7%E8%BF%AA%E4%BA%9E%E5%A3%AB",
  "維基百科（英文） 海洋的界線": "https://en.wikipedia.org/wiki/Borders_of_the_oceans",
  /**
   * 三個湖（死海、裏海、貝加爾湖）。
   * ⚠️ 死海那一筆連的是 USGS 的 Earthshots——它把 1973 至 2024 年的衛星影像排在一起，
   * 「湖在縮」這件事看得見，比任何一個數字都有說服力；卡片上的水位數字會過期，
   * 那一頁不會。
   * ⚠️ 裏海的法律地位另外登記英文維基（2018 年那份公約），中文維基沒有對應條目，
   * 而「算海還是算湖」正是那張卡的重點，只連主條目追不到。
   * ⚠️ 貝加爾湖的深度有好幾個流傳的數字（1,642／1,700／1,741 公尺），卡片採
   * 1,642，那是現行的測深值；UNESCO 那一頁是「最老、最深、全球五分之一未結冰
   * 地表淡水」這組說法的官方出處。
   */
  "維基百科 死海": "https://zh.wikipedia.org/zh-tw/%E6%AD%BB%E6%B5%B7",
  "USGS 死海地表變化衛星影像":
    "https://eros.usgs.gov/earthshots/dead-sea-israel-jordan-west-bank",
  "維基百科 裏海": "https://zh.wikipedia.org/zh-tw/%E9%87%8C%E6%B5%B7",
  "維基百科（英文） 裏海法律地位公約":
    "https://en.wikipedia.org/wiki/Convention_on_the_legal_status_of_the_Caspian_Sea",
  "維基百科 貝加爾湖": "https://zh.wikipedia.org/zh-tw/%E8%B2%9D%E5%8A%A0%E7%88%BE%E6%B9%96",
  "UNESCO 世界遺產 貝加爾湖": "https://whc.unesco.org/en/list/754/",
  /**
   * 雅庫茨克（世界重要城市）。⚠️ 這是這一層第一個帶維基百科來源的地點——
   * 其餘四個城市的數值全部來自 ERA5，而這一筆的「最冷的大城市」「年溫差
   * 102.8 °C」「35 萬人」是氣候正常值以外的事實，追不到 Open-Meteo。
   */
  "維基百科 雅庫茨克": "https://zh.wikipedia.org/zh-tw/%E9%9B%85%E5%BA%AB%E8%8C%A8%E5%85%8B",
  /**
   * 百慕達三角那一筆的關鍵來源。連的是 NOAA 海洋服務處的事實問答頁——「沒有證據
   * 顯示這裡的失蹤比其他繁忙海域更常發生」這句話出自這一頁，那正是這張卡的重點。
   * ⚠️ 不要改連 `oceanservice.noaa.gov/facts/bermudatriangle.html`：那個網址會回
   * HTTP 200 但內容是站內的 404 頁面（實測），檔名是 `bermudatri.html`。
   */
  "美國國家海洋暨大氣總署 百慕達三角": "https://oceanservice.noaa.gov/facts/bermudatri.html",
  "維基百科 百慕達三角": "https://zh.wikipedia.org/zh-tw/%E7%99%BE%E6%85%95%E5%A4%A7%E4%B8%89%E8%A7%92",
  /**
   * 東非大裂谷那一筆（作者精選・範圍）。⚠️ 泛稱的「USGS」在本檔案一律拆開登記，
   * 這一個連的是 This Dynamic Earth 的〈認識板塊運動〉那一章——「非洲底下可能正在
   * 發育一個新的擴張中心」這句話出自那一頁，它也是這張卡的骨幹。
   */
  "USGS 認識板塊運動": "https://pubs.usgs.gov/gip/dynamic/understanding.html",
  // 裂谷本身、北端的三聯點、西支最深的那個湖，以及在裂谷裡出土的那具化石——
  // 四件事各自登記條目，不要只寫泛稱的「維基百科」（次級來源，數值仍以上面那份為準）。
  "維基百科 東非大裂谷": "https://zh.wikipedia.org/zh-tw/%E6%9D%B1%E9%9D%9E%E5%A4%A7%E8%A3%82%E8%B0%B7",
  "維基百科 阿法爾三角": "https://zh.wikipedia.org/zh-tw/%E9%98%BF%E6%B3%95%E7%88%BE%E4%B8%89%E8%A7%92",
  "維基百科 坦干伊喀湖": "https://zh.wikipedia.org/zh-tw/%E5%9D%A6%E5%B9%B2%E4%BC%8A%E5%96%80%E6%B9%96",
  "維基百科 露西 (南方古猿)":
    "https://zh.wikipedia.org/zh-tw/%E9%9C%B2%E8%A5%BF_(%E5%8D%97%E6%96%B9%E5%8F%A4%E7%8C%BF)",
  /**
   * 全球活火山。GVP 的授權方式是「引用即可自由使用」，所以來源標籤要留著全名，
   * 不要簡寫成「Smithsonian」。知名火山的中文名另外標維基百科（次級來源）。
   */
  // ⚠️ 連 VOTW 資料庫的說明頁，不是 GVP 首頁：本站抓的就是這個資料庫（全新世火山），
  // 而它的引用格式、目前版本與 DOI 都印在這一頁上（實測 2026-08 是 v. 5.4.0）。
  "史密森尼學會 全球火山計畫（GVP）": "https://volcano.si.edu/gvp_votw.cfm",
  // 40 幾座知名火山的中文名（次級來源，逐條登記條目，不寫泛稱的「維基百科」）
  "維基百科 火山列表": "https://zh.wikipedia.org/zh-tw/%E7%81%AB%E5%B1%B1%E5%88%97%E8%A1%A8",
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
  // ⚠️ 泛稱的「USGS」拆成兩個標籤：三個地震圖層抓的是地震目錄（ANSS ComCat，
  // 端點是 fdsnws/event/1/query，這裡連它的查詢介面），而希洛那張地點卡引用的是
  // 夏威夷火山觀測站的火山資料——同一個機關、兩份完全不同的東西。
  "USGS 地震目錄": "https://earthquake.usgs.gov/earthquakes/search/",
  "USGS 夏威夷火山觀測站": "https://www.usgs.gov/observatories/hvo",

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
   * 岩石分布那一層的實際來源頁：地質雲加值應用平臺的「基本地質圖」圖台。
   *
   * ⚠️ 不能只寫泛稱的「經濟部地質調查及礦業管理中心」（那條連的是機關首頁）——
   * 同一個機關在這個站上被引用了三份完全不同的東西（活動斷層分布圖、各斷層的
   * 說明頁、二十五萬分之一地質圖），比照 Natural Earth 那次把五份資料集拆開標示
   * 的既有決定：`sources` 的每一筆都要連得到「那份資料本身」。
   */
  "經濟部地質調查及礦業管理中心 二十五萬分之一地質圖":
    "https://www.geologycloud.tw/map/Stratum/zh-tw",
  /**
   * 37 條活動斷層各自的官方詳細說明頁（「臺灣活動斷層」網站，編號依官網現行的
   * 36 條分布圖）。⚠️ 三義斷層之分支斷層在 36 條的版本裡沒有單列，它跟三義斷層
   * 共用同一頁——所以這裡是 **36 個網址**、不是 37 個。
   */
  "地質調查及礦業管理中心 山腳斷層": "https://fault.gsmma.gov.tw/About/FaultMore/0f0ba96791b44c849d9515ef3df9fd7c",
  "地質調查及礦業管理中心 湖口斷層": "https://fault.gsmma.gov.tw/About/FaultMore/be5c5a21d104434280f17a88d8c2cbca",
  // 2026-08 補的四條。它們原本被誤判成「官方有、地質雲那個端點沒有」，其實只是
  // 上游少了 `?all=true` 而被截斷（見 scripts/lib/faults.mjs 的檔頭）。
  "地質調查及礦業管理中心 初鄉斷層": "https://fault.gsmma.gov.tw/About/FaultMore/b45e1277e17f4a26b66cda330e33165f",
  "地質調查及礦業管理中心 九芎坑斷層": "https://fault.gsmma.gov.tw/About/FaultMore/5539bc89555149b59fc874459dd350ef",
  "地質調查及礦業管理中心 口宵里斷層": "https://fault.gsmma.gov.tw/About/FaultMore/900a4f075851474d8c94a61a2c0c4548",
  "地質調查及礦業管理中心 車瓜林斷層": "https://fault.gsmma.gov.tw/About/FaultMore/66714cf680c2418ebbc44042d4e5c55e",
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
