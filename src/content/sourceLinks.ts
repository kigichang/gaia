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
  交通部中央氣象署: "https://www.cwa.gov.tw/",
  /**
   * 颱風路徑與災損那一層的實際來源頁。
   *
   * ⚠️ 不能只寫「交通部中央氣象署」連到氣象署首頁——最佳路徑資料與「颱風概況表」
   * 都只在這個子站上，連到首頁等於追不到（比照「行政院 國情簡介－土地」的既有判斷）。
   */
  "交通部中央氣象署 颱風資料庫": "https://rdc28.cwa.gov.tw/TDB/",
  內政部: "https://www.moi.gov.tw/",
  // 颱風概況表自己註明「災情節錄自內政部消防署及行政院農委會資料」，
  // 所以死亡與失蹤人數的原始主管機關是消防署、農損是農業部（前農委會）
  內政部消防署: "https://www.nfa.gov.tw/",
  農業部: "https://www.moa.gov.tw/",
  內政部國土測繪中心: "https://www.nlsc.gov.tw/",
  // 「臺灣123」那一組島群數字的出處（該頁自己標的資料來源是內政部）。
  // 連的是那一頁本身：面積、島嶼數、經緯度全在這一頁，連到行政院首頁等於追不到。
  "行政院 國情簡介－土地":
    "https://www.ey.gov.tw/state/4447F4A951A1EC45/094b1d53-de8d-4393-bde6-ab092969cce4",
  "內政部 114年第6週內政統計通報（113年底原住民人口數）":
    "https://www.moi.gov.tw/News_Content.aspx?n=2905&s=325345",
  "內政部戶政司 114年各鄉鎮市區人口密度":
    "https://data.gov.tw/dataset/8410",
  原住民族委員會全球資訊網: "https://www.cip.gov.tw/",
  "原住民族委員會 113年4月原住民族人口數統計資料":
    "https://www.cip.gov.tw/zh-tw/news/data-list/940F9579765AC6A0/index.html?cumid=940F9579765AC6A0",
  台灣原住民族文化知識網: "https://knowlegde.gov.taipei/",
  內政部國家公園署: "https://www.nps.gov.tw/",
  玉山國家公園管理處: "https://www.ysnp.gov.tw/",
  雪霸國家公園管理處: "https://www.spnp.gov.tw/",
  太魯閣國家公園管理處: "https://www.taroko.gov.tw/",
  陽明山國家公園管理處: "https://www.ymsnp.gov.tw/",
  墾丁國家公園管理處: "https://www.ktnp.gov.tw/",
  臺江國家公園管理處: "https://www.tjnp.gov.tw/",
  金門國家公園管理處: "https://www.kmnp.gov.tw/",
  // 東沙環礁與澎湖南方四島兩座海洋型國家公園同屬這一處
  海洋國家公園管理處: "https://www.marine.gov.tw/",
  北海岸及觀音山國家風景區管理處: "https://www.northguan-nsa.gov.tw/",
  澎湖國家風景區管理處: "https://www.penghu-nsa.gov.tw/",
  交通部觀光署: "https://www.taiwan.net.tw/",
  // 燈塔的主管機關（本島四極的地標有三個是燈塔）
  交通部航港局: "https://www.motcmpb.gov.tw/",
  經濟部水利署: "https://www.wra.gov.tw/",

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

  農業部農田水利署: "https://www.ia.gov.tw/",
  農業部林業及自然保育署: "https://www.forest.gov.tw/",
  // 垂直植被帶那六個高程界線的實際出處。連的是那一頁本身而不是農業部首頁：
  // 六帶與界線只有這一頁講得完整，而全站的既有承諾是「資料要能追溯出處」。
  // ⚠️ 舊網域 kids.coa.gov.tw 仍然搜得到，農業部改制後已改為 kids.moa.gov.tw。
  "農業部農業兒童網 山地植群帶分布":
    "https://kids.moa.gov.tw/view.php?func=knowledge&subfunc=kids_knowledge&category=B16&id=27",
  // 上面那一頁自己標的製作單位（發行是林務局，即現在的林業及自然保育署）
  國立臺灣大學生物多樣性研究中心: "https://www.brc.ntu.edu.tw/",
  // 主要作物分布的來源（農情調查）
  農業部農糧署: "https://www.afa.gov.tw/",
  // 古蹟圖層的來源。網站名是「國家文化資產網」，每一處古蹟的官方頁面都在它底下
  // （MonumentCard 用 geojson 的 url 屬性直接連到個案頁）。
  文化部文化資產局: "https://nchdb.boch.gov.tw/",
  維基百科: "https://zh.wikipedia.org/",

  // 97 條沒有官方詳細資料的河川，改用維基百科（見 CLAUDE.md 的說明）。
  // ⚠️ 這裡刻意逐條登記真正的條目名，不要改成從河川名自動組網址：
  // 公告名與條目名有 27 條對不上，而且花蓮那兩條會**互相對調**
  //（公告「大清水溪」＝條目「良里溪」、公告「大富溪」的條目 native_name 才是小清水溪），
  // 自動組出來的網址會靜靜地連到另一條同名的河。
  "維基百科 七里溪": "https://zh.wikipedia.org/wiki/%E4%B8%83%E9%87%8C%E6%BA%AA",
  "維基百科 七家灣溪": "https://zh.wikipedia.org/wiki/%E4%B8%83%E5%AE%B6%E7%81%A3%E6%BA%AA",
  "維基百科 九棚溪": "https://zh.wikipedia.org/wiki/%E4%B9%9D%E6%A3%9A%E6%BA%AA",
  "維基百科 八甲溪": "https://zh.wikipedia.org/wiki/%E5%85%AB%E7%94%B2%E6%BA%AA",
  "維基百科 八里溪": "https://zh.wikipedia.org/wiki/%E5%85%AB%E9%87%8C%E6%BA%AA",
  "維基百科 八連溪 (三芝區)": "https://zh.wikipedia.org/wiki/%E5%85%AB%E9%80%A3%E6%BA%AA%20(%E4%B8%89%E8%8A%9D%E5%8D%80)",
  "維基百科 三富溪": "https://zh.wikipedia.org/wiki/%E4%B8%89%E5%AF%8C%E6%BA%AA",
  "維基百科 三棧溪": "https://zh.wikipedia.org/wiki/%E4%B8%89%E6%A3%A7%E6%BA%AA",
  "維基百科 上坪溪": "https://zh.wikipedia.org/wiki/%E4%B8%8A%E5%9D%AA%E6%BA%AA",
  "維基百科 大屯溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%B1%AF%E6%BA%AA",
  "維基百科 大竹溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E7%AB%B9%E6%BA%AA",
  "維基百科 大里溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E9%87%8C%E6%BA%AA",
  "維基百科 大武溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%AD%A6%E6%BA%AA",
  "維基百科 大堀溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%A0%80%E6%BA%AA",
  "維基百科 大富溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%AF%8C%E6%BA%AA",
  "維基百科 大溪川": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%BA%AA%E5%B7%9D",
  "維基百科 冬山河": "https://zh.wikipedia.org/wiki/%E5%86%AC%E5%B1%B1%E6%B2%B3",
  "維基百科 羅東溪": "https://zh.wikipedia.org/wiki/%E7%BE%85%E6%9D%B1%E6%BA%AA",
  "維基百科 外雙溪": "https://zh.wikipedia.org/wiki/%E5%A4%96%E9%9B%99%E6%BA%AA",
  "維基百科 大德溪": "https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%BE%B7%E6%BA%AA",
  "維基百科 小坑溪 (石門區)": "https://zh.wikipedia.org/wiki/%E5%B0%8F%E5%9D%91%E6%BA%AA%20(%E7%9F%B3%E9%96%80%E5%8D%80)",
  "維基百科 山間溪": "https://zh.wikipedia.org/wiki/%E5%B1%B1%E9%96%93%E6%BA%AA",
  "維基百科 太麻里溪": "https://zh.wikipedia.org/wiki/%E5%A4%AA%E9%BA%BB%E9%87%8C%E6%BA%AA",
  "維基百科 文里溪": "https://zh.wikipedia.org/wiki/%E6%96%87%E9%87%8C%E6%BA%AA",
  "維基百科 木瓜溪": "https://zh.wikipedia.org/wiki/%E6%9C%A8%E7%93%9C%E6%BA%AA",
  "維基百科 水母溪": "https://zh.wikipedia.org/wiki/%E6%B0%B4%E6%AF%8D%E6%BA%AA",
  "維基百科 水連溪": "https://zh.wikipedia.org/wiki/%E6%B0%B4%E9%80%A3%E6%BA%AA",
  "維基百科 加蘭溪": "https://zh.wikipedia.org/wiki/%E5%8A%A0%E8%98%AD%E6%BA%AA",
  "維基百科 北勢溪 (新北市)": "https://zh.wikipedia.org/wiki/%E5%8C%97%E5%8B%A2%E6%BA%AA%20(%E6%96%B0%E5%8C%97%E5%B8%82)",
  "維基百科 石公溪": "https://zh.wikipedia.org/wiki/%E7%9F%B3%E5%85%AC%E6%BA%AA",
  "維基百科 石門溪": "https://zh.wikipedia.org/wiki/%E7%9F%B3%E9%96%80%E6%BA%AA",
  "維基百科 石盤溪": "https://zh.wikipedia.org/wiki/%E7%9F%B3%E7%9B%A4%E6%BA%AA",
  "維基百科 安朔溪": "https://zh.wikipedia.org/wiki/%E5%AE%89%E6%9C%94%E6%BA%AA",
  "維基百科 尖山腳溪": "https://zh.wikipedia.org/wiki/%E5%B0%96%E5%B1%B1%E8%85%B3%E6%BA%AA",
  "維基百科 旭海溪": "https://zh.wikipedia.org/wiki/%E6%97%AD%E6%B5%B7%E6%BA%AA",
  "維基百科 竹湖溪": "https://zh.wikipedia.org/wiki/%E7%AB%B9%E6%B9%96%E6%BA%AA",
  "維基百科 老田寮溪": "https://zh.wikipedia.org/wiki/%E8%80%81%E7%94%B0%E5%AF%AE%E6%BA%AA",
  "維基百科 老梅溪": "https://zh.wikipedia.org/wiki/%E8%80%81%E6%A2%85%E6%BA%AA",
  "維基百科 汶水溪": "https://zh.wikipedia.org/wiki/%E6%B1%B6%E6%B0%B4%E6%BA%AA",
  "維基百科 沙灣溪": "https://zh.wikipedia.org/wiki/%E6%B2%99%E7%81%A3%E6%BA%AA",
  "維基百科 良里溪": "https://zh.wikipedia.org/wiki/%E8%89%AF%E9%87%8C%E6%BA%AA",
  "維基百科 里仁溪": "https://zh.wikipedia.org/wiki/%E9%87%8C%E4%BB%81%E6%BA%AA",
  "維基百科 官田溪": "https://zh.wikipedia.org/wiki/%E5%AE%98%E7%94%B0%E6%BA%AA",
  "維基百科 宜蘭河": "https://zh.wikipedia.org/wiki/%E5%AE%9C%E8%98%AD%E6%B2%B3",
  "維基百科 房裡溪": "https://zh.wikipedia.org/wiki/%E6%88%BF%E8%A3%A1%E6%BA%AA",
  "維基百科 東澳溪": "https://zh.wikipedia.org/wiki/%E6%9D%B1%E6%BE%B3%E6%BA%AA",
  "維基百科 林口溪": "https://zh.wikipedia.org/wiki/%E6%9E%97%E5%8F%A3%E6%BA%AA",
  "維基百科 林子溪": "https://zh.wikipedia.org/wiki/%E6%9E%97%E5%AD%90%E6%BA%AA",
  "維基百科 林邊溪": "https://zh.wikipedia.org/wiki/%E6%9E%97%E9%82%8A%E6%BA%AA",
  "維基百科 金崙溪": "https://zh.wikipedia.org/wiki/%E9%87%91%E5%B4%99%E6%BA%AA",
  "維基百科 長濱溪": "https://zh.wikipedia.org/wiki/%E9%95%B7%E6%BF%B1%E6%BA%AA",
  "維基百科 南勢溪": "https://zh.wikipedia.org/wiki/%E5%8D%97%E5%8B%A2%E6%BA%AA",
  "維基百科 城埔溪": "https://zh.wikipedia.org/wiki/%E5%9F%8E%E5%9F%94%E6%BA%AA",
  "維基百科 後洲溪": "https://zh.wikipedia.org/wiki/%E5%BE%8C%E6%B4%B2%E6%BA%AA",
  "維基百科 津林溪": "https://zh.wikipedia.org/wiki/%E6%B4%A5%E6%9E%97%E6%BA%AA",
  "維基百科 紅水仙溪": "https://zh.wikipedia.org/wiki/%E7%B4%85%E6%B0%B4%E4%BB%99%E6%BA%AA",
  "維基百科 紅葉溪": "https://zh.wikipedia.org/wiki/%E7%B4%85%E8%91%89%E6%BA%AA",
  "維基百科 苑裡溪": "https://zh.wikipedia.org/wiki/%E8%8B%91%E8%A3%A1%E6%BA%AA",
  "維基百科 員潭溪": "https://zh.wikipedia.org/wiki/%E5%93%A1%E6%BD%AD%E6%BA%AA",
  "維基百科 埔坪溪": "https://zh.wikipedia.org/wiki/%E5%9F%94%E5%9D%AA%E6%BA%AA",
  "維基百科 烏萬溪": "https://zh.wikipedia.org/wiki/%E7%83%8F%E8%90%AC%E6%BA%AA",
  "維基百科 真柄溪": "https://zh.wikipedia.org/wiki/%E7%9C%9F%E6%9F%84%E6%BA%AA",
  "維基百科 馬太鞍溪": "https://zh.wikipedia.org/wiki/%E9%A6%AC%E5%A4%AA%E9%9E%8D%E6%BA%AA",
  "維基百科 馬武窟溪": "https://zh.wikipedia.org/wiki/%E9%A6%AC%E6%AD%A6%E7%AA%9F%E6%BA%AA",
  "維基百科 乾華溪": "https://zh.wikipedia.org/wiki/%E4%B9%BE%E8%8F%AF%E6%BA%AA",
  "維基百科 基隆河": "https://zh.wikipedia.org/wiki/%E5%9F%BA%E9%9A%86%E6%B2%B3",
  "維基百科 清水溪 (濁水溪)": "https://zh.wikipedia.org/wiki/%E6%B8%85%E6%B0%B4%E6%BA%AA%20(%E6%BF%81%E6%B0%B4%E6%BA%AA)",
  "維基百科 通霄溪": "https://zh.wikipedia.org/wiki/%E9%80%9A%E9%9C%84%E6%BA%AA",
  "維基百科 都威溪": "https://zh.wikipedia.org/wiki/%E9%83%BD%E5%A8%81%E6%BA%AA",
  "維基百科 都蘭溪": "https://zh.wikipedia.org/wiki/%E9%83%BD%E8%98%AD%E6%BA%AA",
  "維基百科 陳有蘭溪": "https://zh.wikipedia.org/wiki/%E9%99%B3%E6%9C%89%E8%98%AD%E6%BA%AA",
  "維基百科 鹿野溪": "https://zh.wikipedia.org/wiki/%E9%B9%BF%E9%87%8E%E6%BA%AA",
  "維基百科 富林溪": "https://zh.wikipedia.org/wiki/%E5%AF%8C%E6%9E%97%E6%BA%AA",
  "維基百科 富家溪": "https://zh.wikipedia.org/wiki/%E5%AF%8C%E5%AE%B6%E6%BA%AA",
  "維基百科 景山溪": "https://zh.wikipedia.org/wiki/%E6%99%AF%E5%B1%B1%E6%BA%AA",
  "維基百科 景美溪": "https://zh.wikipedia.org/wiki/%E6%99%AF%E7%BE%8E%E6%BA%AA",
  "維基百科 朝庸溪": "https://zh.wikipedia.org/wiki/%E6%9C%9D%E5%BA%B8%E6%BA%AA",
  "維基百科 港子溪": "https://zh.wikipedia.org/wiki/%E6%B8%AF%E5%AD%90%E6%BA%AA",
  "維基百科 菜寮溪": "https://zh.wikipedia.org/wiki/%E8%8F%9C%E5%AF%AE%E6%BA%AA",
  "維基百科 塔瓦溪": "https://zh.wikipedia.org/wiki/%E5%A1%94%E7%93%A6%E6%BA%AA",
  "維基百科 新店溪": "https://zh.wikipedia.org/wiki/%E6%96%B0%E5%BA%97%E6%BA%AA",
  "維基百科 新武呂溪": "https://zh.wikipedia.org/wiki/%E6%96%B0%E6%AD%A6%E5%91%82%E6%BA%AA",
  "維基百科 新屋溪": "https://zh.wikipedia.org/wiki/%E6%96%B0%E5%B1%8B%E6%BA%AA",
  "維基百科 新港溪": "https://zh.wikipedia.org/wiki/%E6%96%B0%E6%B8%AF%E6%BA%AA",
  "維基百科 新豐溪": "https://zh.wikipedia.org/wiki/%E6%96%B0%E8%B1%90%E6%BA%AA",
  "維基百科 楓林溪": "https://zh.wikipedia.org/wiki/%E6%A5%93%E6%9E%97%E6%BA%AA",
  "維基百科 溫寮溪": "https://zh.wikipedia.org/wiki/%E6%BA%AB%E5%AF%AE%E6%BA%AA",
  "維基百科 達仁溪": "https://zh.wikipedia.org/wiki/%E9%81%94%E4%BB%81%E6%BA%AA",
  "維基百科 隘寮溪": "https://zh.wikipedia.org/wiki/%E9%9A%98%E5%AF%AE%E6%BA%AA",
  "維基百科 壽豐溪": "https://zh.wikipedia.org/wiki/%E5%A3%BD%E8%B1%90%E6%BA%AA",
  "維基百科 寧埔溪": "https://zh.wikipedia.org/wiki/%E5%AF%A7%E5%9F%94%E6%BA%AA",
  "維基百科 旗山溪": "https://zh.wikipedia.org/wiki/%E6%97%97%E5%B1%B1%E6%BA%AA",
  "維基百科 瑪鋉溪": "https://zh.wikipedia.org/wiki/%E7%91%AA%E9%8B%89%E6%BA%AA",
  "維基百科 樂樂溪": "https://zh.wikipedia.org/wiki/%E6%A8%82%E6%A8%82%E6%BA%AA",
  "維基百科 興仁溪": "https://zh.wikipedia.org/wiki/%E8%88%88%E4%BB%81%E6%BA%AA",
  "維基百科 貓羅溪": "https://zh.wikipedia.org/wiki/%E8%B2%93%E7%BE%85%E6%BA%AA",
  "維基百科 薯寮溪": "https://zh.wikipedia.org/wiki/%E8%96%AF%E5%AF%AE%E6%BA%AA",
  "維基百科 豐濱溪": "https://zh.wikipedia.org/wiki/%E8%B1%90%E6%BF%B1%E6%BA%AA",
  "維基百科 寶斗溪": "https://zh.wikipedia.org/wiki/%E5%AF%B6%E6%96%97%E6%BA%AA",
  "維基百科 觀音溪": "https://zh.wikipedia.org/wiki/%E8%A7%80%E9%9F%B3%E6%BA%AA",


  // 22 個縣市政府的官方網站。它們同時是「這筆資料的出處」與「使用者想點進去的
  // 官方連結」，所以走既有的 sources 機制而不是另外加一個欄位——SourceLinks
  // 本來就會把認得的來源名稱渲染成連結。
  //
  // 全部實測過：19 個直接回 200；新北、桃園要帶瀏覽器 User-Agent 才回 200
  // （WAF 擋 curl，真人瀏覽器沒問題）；雲林在 Cloudflare 的人機驗證後面，
  // 自動化一律拿到 403，網址本身是對的。維基百科的資訊框沒填南投縣政府的網站，
  // 那一筆是另外補的官方網域。
  基隆市政府: "https://www.klcg.gov.tw",
  臺北市政府: "https://www.gov.taipei",
  新北市政府: "https://www.ntpc.gov.tw",
  桃園市政府: "https://www.tycg.gov.tw",
  新竹市政府: "https://www.hccg.gov.tw",
  新竹縣政府: "https://www.hsinchu.gov.tw",
  宜蘭縣政府: "https://www.e-land.gov.tw",
  苗栗縣政府: "https://www.miaoli.gov.tw",
  臺中市政府: "https://www.taichung.gov.tw",
  彰化縣政府: "https://www.chcg.gov.tw",
  南投縣政府: "https://www.nantou.gov.tw",
  花蓮縣政府: "https://www.hl.gov.tw",
  雲林縣政府: "https://www.yunlin.gov.tw",
  嘉義市政府: "https://www.chiayi.gov.tw",
  嘉義縣政府: "https://www.cyhg.gov.tw",
  臺南市政府: "https://www.tainan.gov.tw",
  高雄市政府: "https://www.kcg.gov.tw",
  臺東縣政府: "https://www.taitung.gov.tw",
  屏東縣政府: "https://www.pthg.gov.tw",
  連江縣政府: "https://www.matsu.gov.tw",
  金門縣政府: "https://www.kinmen.gov.tw",
  澎湖縣政府: "https://www.penghu.gov.tw",
  "GBIF Global Biodiversity Information Facility": "https://www.gbif.org/",
  "Natural Earth": "https://www.naturalearthdata.com/",
  /**
   * 板塊與板塊邊界。授權是 ODC-BY 1.0，**要求標示出處**，所以原作者（Bird）與
   * 轉製者（Nordpil）兩個都要列，少一個就違反授權。
   */
  "Peter Bird (2003) 板塊模型": "https://doi.org/10.1029/2001GC000252",
  "Nordpil 板塊資料集": "https://github.com/fraxen/tectonicplates",
  "維基百科 板塊列表": "https://zh.wikipedia.org/wiki/%E6%9D%BF%E5%A1%8A%E5%88%97%E8%A1%A8",
  // 交通軸線的線位來源。ODbL 1.0 要求標示「© OpenStreetMap 貢獻者」，
  // 這個署名義務不是新增的——世界底圖 OpenFreeMap 本來就是 OSM 衍生的。
  OpenStreetMap: "https://www.openstreetmap.org/copyright",
  交通部高速公路局: "https://www.freeway.gov.tw/",
  臺灣鐵路公司: "https://www.railway.gov.tw/",
  台灣高鐵: "https://www.thsrc.com.tw/",
  "Open-Meteo ERA5 再分析資料": "https://open-meteo.com/en/docs/historical-weather-api",
  USGS: "https://www.usgs.gov/",

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
};
