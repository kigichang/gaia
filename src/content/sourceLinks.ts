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
  內政部國土測繪中心: "https://www.nlsc.gov.tw/",
  "內政部 114年第6週內政統計通報（113年底原住民人口數）":
    "https://www.moi.gov.tw/News_Content.aspx?n=2905&s=325345",
  "內政部戶政司 114年各鄉鎮市區人口密度":
    "https://data.gov.tw/dataset/8410",
  原住民族委員會全球資訊網: "https://www.cip.gov.tw/",
  "原住民族委員會 113年4月原住民族人口數統計資料":
    "https://www.cip.gov.tw/zh-tw/news/data-list/940F9579765AC6A0/index.html?cumid=940F9579765AC6A0",
  台灣原住民族文化知識網: "https://knowlegde.gov.taipei/",
  玉山國家公園管理處: "https://www.ysnp.gov.tw/",
  雪霸國家公園管理處: "https://www.spnp.gov.tw/",
  太魯閣國家公園管理處: "https://www.taroko.gov.tw/",
  陽明山國家公園管理處: "https://www.ymsnp.gov.tw/",
  墾丁國家公園管理處: "https://www.ktnp.gov.tw/",
  臺江國家公園管理處: "https://www.tjnp.gov.tw/",
  北海岸及觀音山國家風景區管理處: "https://www.northguan-nsa.gov.tw/",
  澎湖國家風景區管理處: "https://www.penghu-nsa.gov.tw/",
  交通部觀光署: "https://www.taiwan.net.tw/",
  經濟部水利署: "https://www.wra.gov.tw/",
  農業部農田水利署: "https://www.ia.gov.tw/",
  農業部林業及自然保育署: "https://www.forest.gov.tw/",
  維基百科: "https://zh.wikipedia.org/",

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
  "Open-Meteo ERA5 再分析資料": "https://open-meteo.com/en/docs/historical-weather-api",
  USGS: "https://www.usgs.gov/",
};
