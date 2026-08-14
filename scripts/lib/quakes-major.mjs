/**
 * 維基百科〈臺灣地震列表〉的「災害性地震列表」，1900 年以後的 99 筆。
 *
 * ## ⚠️ 這份是**人工抄錄**的，建置期不會去打維基百科
 *
 * CLAUDE.md 的既有規則：維基百科「程式完全不呼叫」，它是次級來源，人工查閱後把
 * 結論寫進檔案。所以這裡是一份靜態表，build-geodata.mjs 只拿它去跟 USGS 的震央
 * 對照——**建置期被抓取的只有 USGS**。上游條目更新時要重新抄，不是重跑就會變。
 *
 * ## ⚠️ magCwa 跟 USGS 的規模不是同一個東西
 *
 * 維基百科這張表用的是中央氣象署的規模（ML／MW），跟 USGS 目錄的值系統性地不同
 * ——實測 2025-12-27 宜蘭外海 CWA 7.0 對 USGS 6.6、2024-04-27 花蓮 CWA 6.3 對 USGS 5.7、
 * 921 是 CWA 7.3 對 USGS 7.7。
 *
 * **地圖上的點與卡片的「規模」一律用 USGS**（那是點位的來源，兩者必須一致）；
 * 這個欄位只在兩邊差 0.3 以上時，於卡片上以「中央氣象署規模」另外標示，
 * 讓看過課本的人不會覺得我們的數字寫錯了。
 *
 * ## 對照方式
 *
 * 以**當地日期**（UTC+8，跟 USGS 那份換算後的 date 同基準）比對，同一天有多筆時取
 * 規模最接近的，且規模差超過 1.0 就不算對到。實測 99 筆裡 94 筆對得到；對不到的
 * 是規模太小或早期目錄未收錄，建置日誌會列出來——那是預期中的資料範圍差異，
 * 不是錯誤，**不要為了湊滿而放寬比對條件**。
 */
export const MAJOR_QUAKES = [
  { date: "1904-04-24", place: "嘉義", magCwa: 6.1, harm: "3人死亡／66棟房屋全毀" },
  { date: "1904-11-06", place: "嘉義一帶", magCwa: 6.1, harm: "145人死亡／661棟房屋全毀" },
  { date: "1906-03-17", place: "嘉義民雄", magCwa: 7.1, harm: "1,258人死亡／6,769棟房屋全毀" },
  { date: "1906-03-26", place: "雲林斗六", magCwa: 5, harm: "1人死亡／29棟房屋全毀" },
  { date: "1906-04-07", place: "台南鹽水港", magCwa: 5.3, harm: "1人死亡／63棟房屋全毀" },
  { date: "1906-04-14", place: "台南鹽水港", magCwa: 6.6, harm: "15人死亡／1,794棟房屋全毀" },
  { date: "1908-01-11", place: "花蓮萬榮", magCwa: 7.3, harm: "2人死亡／3棟房屋全毀" },
  { date: "1909-04-15", place: "台北", magCwa: 7.3, harm: "9人死亡／122棟房屋全毀" },
  { date: "1910-04-12", place: "東北部外海", magCwa: 8.3, harm: "60人死亡／13棟房屋全毀" },
  { date: "1916-08-28", place: "濁水溪上流", magCwa: 6.8, harm: "16人死亡／614棟房屋全毀" },
  { date: "1916-11-15", place: "台中東南", magCwa: 6.2, harm: "1人死亡／97棟房屋全毀" },
  { date: "1917-01-05", place: "南投埔里", magCwa: 6.2, harm: "54人死亡／130棟房屋全毀" },
  { date: "1917-01-07", place: "南投埔里", magCwa: 5.5, harm: "187棟房屋全毀" },
  { date: "1920-06-05", place: "花蓮近海", magCwa: 8.2, harm: "5人死亡／273棟房屋全毀" },
  { date: "1922-09-02", place: "蘇澳近海", magCwa: 7.6, harm: "5人死亡／14棟房屋全毀" },
  { date: "1922-10-15", place: "蘇澳近海", magCwa: 5.9, harm: "6人死亡" },
  { date: "1922-12-02", place: "蘇澳近海", magCwa: 6, harm: "1人死亡／1棟房屋全毀" },
  { date: "1927-08-25", place: "台南新營", magCwa: 6.5, harm: "11人死亡／214棟房屋全毀" },
  { date: "1930-12-08", place: "台南新營", magCwa: 6.1, harm: "4人死亡／49棟房屋全毀" },
  { date: "1933-05-04", place: "花蓮", magCwa: null, harm: "1人死亡" },
  { date: "1935-04-21", place: "苗栗縣關刀山", magCwa: 7.1, harm: "3,276人死亡／17,907棟房屋全毀" },
  { date: "1935-07-17", place: "後龍溪河口", magCwa: 6.2, harm: "44人死亡／1,734棟房屋全毀" },
  { date: "1939-11-07", place: "苗栗縣卓蘭", magCwa: 5.8, harm: "4棟房屋全毀" },
  { date: "1941-12-17", place: "嘉義中埔", magCwa: 7.1, harm: "360死／4,520棟房屋全毀" },
  { date: "1943-10-23", place: "花蓮", magCwa: 6.2, harm: "1人死亡／1棟房屋全毀" },
  { date: "1943-12-02", place: "綠島南方近海", magCwa: 6.1, harm: "3人死亡／139棟房屋全毀" },
  { date: "1946-12-05", place: "台南新化", magCwa: 6.1, harm: "74人死亡／1,954棟房屋全毀" },
  { date: "1951-10-22", place: "花蓮", magCwa: 7.3, harm: "rowspan=3|68人死亡" },
  { date: "1951-10-22", place: "花蓮", magCwa: 7.1, harm: null },
  { date: "1951-10-22", place: "花蓮", magCwa: 7.1, harm: null },
  { date: "1951-11-25", place: "台東", magCwa: 6.1, harm: "rowspan=2|17人死亡／1,016棟房屋全毀" },
  { date: "1951-11-25", place: "台東", magCwa: 7.3, harm: null },
  { date: "1955-04-04", place: "屏東恆春", magCwa: 6.8, harm: "22棟房屋全毀" },
  { date: "1957-02-24", place: "花蓮", magCwa: 7.3, harm: "11人死亡／44棟房屋全毀" },
  { date: "1957-10-20", place: "花蓮", magCwa: 6.6, harm: "4人死亡" },
  { date: "1959-04-27", place: "與那國", magCwa: 7.7, harm: "1人死亡／9棟房屋全毀" },
  { date: "1959-08-15", place: "屏東恆春", magCwa: 7.1, harm: "16人死亡／1,214棟房屋全毀" },
  { date: "1963-02-13", place: "宜蘭", magCwa: 7.3, harm: "3人死亡／6棟房屋全毀" },
  { date: "1963-03-04", place: "宜蘭", magCwa: 6.4, harm: "1人死亡" },
  { date: "1964-01-18", place: "嘉義-台南", magCwa: 6.3, harm: "106人死亡／10,924棟房屋全毀" },
  { date: "1965-05-18", place: "台東大武", magCwa: 6.5, harm: "21棟房屋全毀／澎湖、台東有地鳴" },
  { date: "1966-03-13", place: "花蓮外海", magCwa: 7.8, harm: "4人死亡／24棟房屋全毀" },
  { date: "1967-10-25", place: "宜蘭", magCwa: 6.1, harm: "2人死亡／21棟房屋全毀" },
  { date: "1972-01-25", place: "台東外海", magCwa: 7.3, harm: "1人死亡／5棟房屋全毀" },
  { date: "1972-04-24", place: "花蓮", magCwa: 6.9, harm: "5人死亡／50棟房屋全毀" },
  { date: "1978-12-23", place: "台東外海", magCwa: 6.8, harm: "2人死亡" },
  { date: "1982-01-23", place: "花蓮", magCwa: 6.5, harm: "1人死亡" },
  { date: "1986-11-15", place: "花蓮外海", magCwa: 6.8, harm: "15人死亡／37棟房屋全毀" },
  { date: "1990-12-13", place: "花蓮", magCwa: 6.5, harm: "2人死亡／3棟房屋全毀" },
  { date: "1993-12-16", place: "嘉義", magCwa: 5.7, harm: null },
  { date: "1994-06-05", place: "宜蘭", magCwa: 6.5, harm: "1人死亡／1棟房屋全毀" },
  { date: "1995-02-23", place: "花蓮", magCwa: 5.8, harm: "2人死亡" },
  { date: "1995-06-25", place: "宜蘭", magCwa: 6.5, harm: "1人死亡／6棟房屋全毀" },
  { date: "1998-07-17", place: "嘉義", magCwa: 6.2, harm: "5人死亡／18棟房屋全毀" },
  { date: "1999-09-21", place: "南投（集集大地震）", magCwa: 7.3, harm: "2,415人死亡／11,305人受傷／29人失蹤／51,711棟房屋全毀" },
  { date: "1999-10-22", place: "嘉義市", magCwa: 6.4, harm: "230人受傷／7棟房屋全毀" },
  { date: "2000-05-17", place: "台中德基", magCwa: 5.6, harm: "3人死亡" },
  { date: "2000-06-11", place: "南投", magCwa: 6.7, harm: "2人死亡" },
  { date: "2002-03-31", place: "花蓮外海", magCwa: 6.8, harm: "7人死亡／興建中的臺北101塔吊吊臂斷裂震落" },
  { date: "2002-05-15", place: "宜蘭蘇澳", magCwa: 6.2, harm: "1人死亡" },
  { date: "2003-12-10", place: "台東成功", magCwa: 6.4, harm: null },
  { date: "2004-05-01", place: "花蓮", magCwa: 5.3, harm: "2人死亡／中橫公路落石" },
  { date: "2006-04-01", place: "台東", magCwa: 6.2, harm: "14棟房屋全毀" },
  { date: "2006-12-26", place: "屏東恆春外海", magCwa: 7, harm: "rowspan=2|2人死亡／42人受傷／3棟房屋全毀" },
  { date: "2006-12-26", place: "屏東恆春外海", magCwa: 7, harm: null },
  { date: "2009-11-05", place: "南投", magCwa: 6.2, harm: "1人受傷" },
  { date: "2009-12-19", place: "花蓮外海", magCwa: 6.9, harm: "17人受傷／多棟房屋毀損" },
  { date: "2010-03-04", place: "高雄茂林（甲仙地震）", magCwa: 6.4, harm: "96人受傷／54萬戶停電" },
  { date: "2012-02-26", place: "屏東霧台", magCwa: 6.4, harm: null },
  { date: "2013-03-27", place: "南投仁愛", magCwa: 6.2, harm: "1人死亡／97人受傷" },
  { date: "2013-06-02", place: "南投魚池", magCwa: 6.5, harm: "5人死亡／18人受傷" },
  { date: "2013-10-31", place: "花蓮萬榮", magCwa: 6.4, harm: "1人受傷" },
  { date: "2015-02-14", place: "台灣東部海域", magCwa: 6.3, harm: null },
  { date: "2015-04-20", place: "花蓮外海", magCwa: 6.4, harm: "1人死亡／1人受傷" },
  { date: "2016-02-06", place: "高雄美濃", magCwa: 6.6, harm: "117人死亡／551人受傷" },
  { date: "2016-05-31", place: "東北部外海", magCwa: 6.9, harm: null },
  { date: "2016-10-06", place: "台灣東部海域", magCwa: 6.2, harm: null },
  { date: "2017-02-11", place: "高雄近海", magCwa: 5.7, harm: "4人受傷" },
  { date: "2018-02-06", place: "台灣東部海域", magCwa: 6.2, harm: "17死291傷" },
  { date: "2019-04-18", place: "花蓮秀林", magCwa: 6.3, harm: "1死16傷／停電1345戶／停水137戶" },
  { date: "2019-08-08", place: "宜蘭外海", magCwa: 6.2, harm: "1人死亡／10675戶停電" },
  { date: "2020-12-10", place: "宜蘭外海", magCwa: 6.7, harm: null },
  { date: "2021-04-18", place: "花蓮壽豐", magCwa: 6.2, harm: null },
  { date: "2021-10-24", place: "宜蘭南澳", magCwa: 6.5, harm: null },
  { date: "2022-01-03", place: "臺灣東部海域", magCwa: 6, harm: "部分地區有停電以及造成電梯受困的情形發生" },
  { date: "2022-03-23", place: "花蓮豐濱外海", magCwa: 6.7, harm: "台九線玉里鎮玉興橋坍塌，部分区域停电，一人轻伤送医" },
  { date: "2022-09-17", place: "臺東關山", magCwa: 6.6, harm: null },
  { date: "2022-09-18", place: "臺東池上", magCwa: 6.8, harm: "1人死亡，146人受傷" },
  { date: "2022-12-15", place: "花蓮外海", magCwa: 6.5, harm: "玉山落石導致6人受傷" },
  { date: "2024-04-03", place: "花蓮壽豐", magCwa: 7.1, harm: "20人罹難、1,155人受傷及2人失聯" },
  { date: "2024-04-03", place: "花蓮壽豐", magCwa: 6.5, harm: "無人傷亡" },
  { date: "2024-04-23", place: "花蓮外海", magCwa: 6.1, harm: "無人傷亡" },
  { date: "2024-04-23", place: "花蓮壽豐", magCwa: 6.2, harm: "無人傷亡" },
  { date: "2024-04-27", place: "花蓮", magCwa: 6.3, harm: "無人傷亡" },
  { date: "2025-01-21", place: "嘉義大埔", magCwa: 6.4, harm: "50人受傷" },
  { date: "2025-06-11", place: "花蓮東部海域", magCwa: 6.4, harm: null },
  { date: "2025-12-08", place: "花蓮東部海域", magCwa: 5.7, harm: null },
  { date: "2025-12-24", place: "臺東卑南", magCwa: 6.1, harm: null },
  { date: "2025-12-27", place: "宜蘭東部海域", magCwa: 7, harm: "}" },
];
