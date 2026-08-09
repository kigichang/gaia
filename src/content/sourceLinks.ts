/**
 * 已知資料來源名稱 → 官方網站連結。
 *
 * key 必須與各內容檔 `sources` 陣列裡的字串完全一致。沒有列在這裡的來源名稱
 * 會照舊顯示為純文字，不會壞掉——新增內容時不必馬上補連結。
 */
export const SOURCE_LINKS: Record<string, string> = {
  交通部中央氣象署: "https://www.cwa.gov.tw/",
  內政部國土測繪中心: "https://www.nlsc.gov.tw/",
  "內政部 114年第6週內政統計通報（113年底原住民人口數）":
    "https://www.moi.gov.tw/News_Content.aspx?n=2905&s=325345",
  原住民族委員會全球資訊網: "https://www.cip.gov.tw/",
  "原住民族委員會 113年4月原住民族人口數統計資料":
    "https://www.cip.gov.tw/zh-tw/news/data-list/940F9579765AC6A0/index.html?cumid=940F9579765AC6A0",
  台灣原住民族文化知識網: "https://knowlegde.gov.taipei/",
  玉山國家公園管理處: "https://www.ysnp.gov.tw/",
  雪霸國家公園管理處: "https://www.spnp.gov.tw/",
  農業部林業及自然保育署: "https://www.forest.gov.tw/",
  "GBIF Global Biodiversity Information Facility": "https://www.gbif.org/",
  "Natural Earth": "https://www.naturalearthdata.com/",
  "Open-Meteo ERA5 再分析資料": "https://open-meteo.com/en/docs/historical-weather-api",
  USGS: "https://www.usgs.gov/",
};
