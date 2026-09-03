/**
 * 規模最強的地震（世界地理主題「地體構造」）。
 *
 * ## 收錄名單來自維基百科〈地震列表〉的「震級最強地震」那張表
 *
 * 那張表列的是**有紀錄以來規模最大的 18 次地震**（Mw 8.5 以上，含幾筆儀器時代
 * 以前只能推估的）。名單是人工抄錄的，**不由程式產生**——上游是一張人手維護的
 * 維基表格，沒有 API，而且它混用了當地日期與 UTC 日期、規模也不全跟任何單一目錄
 * 一致（見下）。抄成常數還有一個好處：新增或移除一筆一定會出現在 git diff 上。
 *
 * ⚠️ **那張表的 wikitext 裡還有第 19 列（1707 年寶永地震，估計 8.6–9.3），但它的
 * 語法寫壞了**（`|-` 那一行後面直接接內容），MediaWiki 會把它當成列屬性吃掉，
 * **在頁面上根本不會顯示**。本站照「讀者看得到的那張表」收 18 筆，沒有收它。
 * 上游修好那一列的話再補。
 *
 * ## ⚠️ 規模採 USGS，不採維基那張表——四筆對不起來，那正是這一層的教學內容
 *
 * 14 筆在 USGS 的地震目錄（ComCat）裡查得到，本站的 `mag`、座標與震源深度**一律
 * 用 USGS 的值**（比照本站「數值型資料以主管機關為準」的既有規則，也比照貝加爾湖
 * 深度、蘇必略湖面積刻意跟中文維基不同）。實測有四筆對不上：
 *
 * | 地震 | 維基那張表 | USGS |
 * |---|---|---|
 * | 2004 印度洋 | 9.3 | **9.1**（維基自己的註腳就寫「USGS 修正為 9.1」） |
 * | 1700 卡斯凱迪亞 | 9.2 | **9.0**（推估值，區間 8.7–9.2） |
 * | 2005 蘇門答臘（尼亞斯） | 8.7 | **8.6**（初評 8.7 後下修） |
 * | 2007 蘇門答臘（明古魯） | 8.5 | **8.4** |
 *
 * 對不上的那幾筆會把維基值一併寫進 `magWiki`，卡片要兩個都講——「最強」取決於
 * 誰量、什麼時候量，那是這一層存在的理由。
 *
 * ## ⚠️ 四筆 USGS 完全沒有，座標與規模是人工轉錄的
 *
 * 1575 瓦爾迪維亞、1668 郯城、1755 里斯本、1833 蘇門答臘都在儀器地震學誕生之前，
 * ComCat 查不到（實測那四個時間窗回 0 筆）。它們的座標與規模推估取自維基百科條目，
 * 每一筆都帶 `source: "維基百科"`，卡片必須顯示——混合來源就要說出來（比照
 * `tw-quakes-major` 的 `RECENT_QUAKES`）。
 *
 * ⚠️ **1755 里斯本的經度一定是 −11，不是 +11。** 中文維基的座標模板漏了 W，
 * Wikipedia API 回的 `lon` 就是 `11`——照抄會把震央放到地中海突尼西亞外海去，
 * 而且畫面上看起來「也還算合理」。英文條目是 36.0N/11.0W，本站採後者。
 *
 * ## ⚠️ `date` 是「這次地震通稱的那一天」，不是 UTC 日期
 *
 * 這些地震在課本與新聞裡就是用那一天稱呼的（1964 年 3 月 27 日的耶穌受難日地震，
 * USGS 記的 UTC 是 3 月 28 日；2025 年堪察加是當地 7 月 30 日、UTC 7 月 29 日）。
 * 所以日期沿用維基那張表，並在建置時跟 USGS 的 UTC 日期交叉檢查——**差超過一天
 * 就讓建置失敗**，那是抄錯行唯一抓得到的方式。
 */

/** USGS 地震目錄。免金鑰、public domain、`ACAO: *`，跟本站另外兩個地震圖層同一個目錄。 */
export const USGS_QUERY =
  "https://earthquake.usgs.gov/fdsnws/event/1/query" +
  "?format=geojson&minmagnitude=8.4&starttime=1500-01-01&orderby=magnitude";
export const SOURCE_PAGE =
  "https://zh.wikipedia.org/zh-tw/%E5%9C%B0%E9%9C%87%E5%88%97%E8%A1%A8#%E9%9C%87%E7%BA%A7%E6%9C%80%E5%BC%BA%E5%9C%B0%E9%9C%87";
export const USGS_LABEL = "USGS";
export const WIKI_LABEL = "維基百科";
export const LICENSE = "USGS（public domain）／CC BY-SA（維基百科）";

/**
 * 維基百科〈地震列表〉「震級最強地震」那 18 列。
 *
 * - `wikiMag`：那張表寫的規模。**只用來交叉檢查與寫進 `magWiki`**，不是畫在地圖上的值。
 * - `usgsId`：ComCat 的事件 id（人工對出來的，比照 `lib/cyclones.mjs` 的 SID 對照表）。
 *   `null` 代表 ComCat 沒有這次地震，改用同一列的 `lat`／`lng`／`mag`。
 * - `region`／`deaths`／`tsunami`：寫進 `meta` 與卡片的簡短事實，人工抄自各自的條目。
 *   ⚠️ 死亡人數幾乎都是區間或有爭議，所以是**字串**不是數字，不要改成數值欄位。
 */
export const STRONGEST_QUAKES = [
  {
    id: "chile-1960",
    name: "1960年智利大地震",
    en: "1960 Valdivia Earthquake",
    date: "1960-05-22",
    wikiMag: 9.5,
    usgsId: "official19600522191120_30",
    region: "智利 瓦爾迪維亞外海",
    alias: "瓦爾迪維亞大地震",
    deaths: "約 5,700 人",
    tsunami: "智利沿岸 25 公尺，夏威夷希洛 10.5 公尺",
  },
  {
    id: "alaska-1964",
    name: "1964年阿拉斯加大地震",
    en: "1964 Prince William Sound Earthquake",
    date: "1964-03-27",
    wikiMag: 9.2,
    usgsId: "official19640328033616_30",
    region: "美國 阿拉斯加 威廉王子灣",
    alias: "耶穌受難日地震、安克拉治地震",
    deaths: "139 人",
    tsunami: "局部滑坡海嘯最高 67 公尺",
  },
  {
    id: "sumatra-1833",
    name: "1833年蘇門答臘地震",
    en: "1833 Sumatra Earthquake",
    date: "1833-11-25",
    wikiMag: 9.2,
    usgsId: null,
    lat: -2.5,
    lng: 100.5,
    mag: 9.2,
    region: "印尼 蘇門答臘西南外海",
    alias: "明打威群島地震",
    deaths: "無可靠統計",
    tsunami: "波及塞席爾、馬爾地夫與斯里蘭卡",
  },
  {
    id: "tohoku-2011",
    name: "2011年東北地方太平洋近海地震",
    en: "2011 Great Tohoku Earthquake",
    date: "2011-03-11",
    wikiMag: 9.1,
    usgsId: "official20110311054624120_30",
    region: "日本 宮城縣外海",
    alias: "311 大地震、東日本大震災",
    deaths: "19,787 人罹難、2,549 人失蹤",
    tsunami: "最大溯上高 40.1 公尺",
  },
  {
    id: "sumatra-2004",
    name: "2004年印度洋大地震",
    en: "2004 Sumatra–Andaman Earthquake",
    date: "2004-12-26",
    wikiMag: 9.3,
    usgsId: "official20041226005853450_30",
    region: "印尼 蘇門答臘北部外海",
    alias: "南亞大海嘯、蘇門答臘－安達曼地震",
    deaths: "約 227,898 人罹難、逾 22,000 人失蹤",
    tsunami: "最高 30 公尺，波及印度洋沿岸 14 國",
  },
  {
    id: "kamchatka-1952",
    name: "1952年堪察加地震",
    en: "1952 Kamchatka Earthquake",
    date: "1952-11-04",
    wikiMag: 9.0,
    usgsId: "official19521104165830_30",
    region: "俄羅斯 堪察加半島東岸外海",
    alias: "北庫里爾斯克地震",
    deaths: "北庫里爾斯克 2,336 人",
    tsunami: "北庫里爾斯克 15–18 公尺",
  },
  {
    id: "lisbon-1755",
    name: "1755年里斯本大地震",
    en: "1755 Lisbon Earthquake",
    date: "1755-11-01",
    wikiMag: 9.0,
    usgsId: null,
    lat: 36.0,
    lng: -11.0,
    mag: 9.0,
    region: "葡萄牙 聖維森特角西南外海",
    alias: "諸聖節地震",
    deaths: "約 4 萬至 5 萬人",
    tsunami: "海嘯加上延燒五天的大火，全城 85% 建築被毀",
  },
  {
    id: "cascadia-1700",
    name: "1700年卡斯凱迪亞地震",
    en: "1700 Cascadia Earthquake",
    date: "1700-01-26",
    wikiMag: 9.2,
    usgsId: "official17000127050000000",
    region: "北美洲 卡斯凱迪亞隱沒帶外海",
    alias: "孤兒海嘯",
    deaths: "無文字紀錄",
    tsunami: "十小時後抵達日本，成為「沒有地震的海嘯」",
  },
  {
    id: "kamchatka-2025",
    name: "2025年堪察加半島地震",
    en: "2025 Kamchatka Peninsula Earthquake",
    date: "2025-07-30",
    wikiMag: 8.8,
    usgsId: "us6000qw60",
    region: "俄羅斯 堪察加半島東岸外海",
    alias: null,
    deaths: "無人直接罹難",
    tsunami: "北庫里爾斯克 5–6 公尺，環太平洋多國發布警報",
  },
  {
    id: "chile-2010",
    name: "2010年智利大地震",
    en: "2010 Maule Earthquake",
    date: "2010-02-27",
    wikiMag: 8.8,
    usgsId: "official20100227063411530_30",
    region: "智利 康塞普西翁外海",
    alias: "馬烏萊地震",
    deaths: "525 人",
    tsunami: "最高約 2.7 公尺，波及環太平洋 53 個國家與地區",
  },
  {
    id: "ecuador-1906",
    name: "1906年厄瓜多－哥倫比亞地震",
    en: "1906 Ecuador–Colombia Earthquake",
    date: "1906-01-31",
    wikiMag: 8.8,
    usgsId: "official19060131153610_30",
    region: "厄瓜多 埃斯梅拉達斯外海",
    alias: null,
    deaths: "約 500 至 1,500 人",
    tsunami: "哥倫比亞圖馬科 5 公尺，夏威夷希洛 1.8 公尺",
  },
  {
    id: "rat-islands-1965",
    name: "1965年拉特群島地震",
    en: "1965 Rat Islands Earthquake",
    date: "1965-02-04",
    wikiMag: 8.7,
    usgsId: "official19650204050122_30",
    region: "美國 阿拉斯加 阿留申群島",
    alias: null,
    deaths: "無人罹難",
    tsunami: "申雅島 10.7 公尺",
  },
  {
    id: "sumatra-2012",
    name: "2012年蘇門答臘近海地震",
    en: "2012 Wharton Basin Earthquake",
    date: "2012-04-11",
    wikiMag: 8.6,
    usgsId: "official20120411083836720_20",
    region: "印度洋 蘇門答臘西南外海（板塊內部）",
    alias: "沃頓盆地地震",
    deaths: "5 人",
    tsunami: "最高僅 1.06 公尺",
  },
  {
    id: "sumatra-2005",
    name: "2005年蘇門答臘地震",
    en: "2005 Nias–Simeulue Earthquake",
    date: "2005-03-28",
    wikiMag: 8.7,
    usgsId: "official20050328160936530_30",
    region: "印尼 尼亞斯島一帶",
    alias: "尼亞斯島地震",
    deaths: "915 至 1,314 人",
    tsunami: "幾乎沒有觀測到海嘯",
  },
  {
    id: "medog-1950",
    name: "1950年墨脫地震",
    en: "1950 Assam–Tibet Earthquake",
    date: "1950-08-15",
    wikiMag: 8.6,
    usgsId: "official19500815140934_30",
    region: "中國西藏 墨脫縣與印度阿薩姆交界",
    alias: "阿薩姆－西藏地震、察隅地震",
    deaths: "中國約 4,000 人、印度約 1,500 人",
    tsunami: null,
  },
  {
    id: "tancheng-1668",
    name: "1668年郯城大地震",
    en: "1668 Tancheng Earthquake",
    date: "1668-07-25",
    wikiMag: 8.5,
    usgsId: null,
    lat: 34.8,
    lng: 118.5,
    mag: 8.5,
    region: "中國山東 郯城、莒縣",
    alias: "康熙七年山東地震",
    deaths: "約 4 萬 3 千至 5 萬人",
    tsunami: null,
  },
  {
    id: "valdivia-1575",
    name: "1575年瓦爾迪維亞大地震",
    en: "1575 Valdivia Earthquake",
    date: "1575-12-16",
    wikiMag: 8.5,
    usgsId: null,
    lat: -39.8,
    lng: -73.2,
    mag: 8.5,
    region: "智利 瓦爾迪維亞",
    alias: null,
    deaths: "無可靠統計",
    tsunami: "河水倒灌，堰塞湖潰決造成洪水",
  },
  {
    id: "sumatra-2007",
    name: "2007年蘇門答臘地震",
    en: "2007 Bengkulu Earthquake",
    date: "2007-09-12",
    wikiMag: 8.5,
    usgsId: "official20070912111026830_34",
    region: "印尼 明古魯外海",
    alias: "明古魯地震",
    deaths: "至少 9 人",
    tsunami: "巴東一帶約 1 公尺，局部 3 公尺",
  },
];

/** 規模與維基那張表差多少才值得記進 `magWiki`／印一行警告。 */
const MAG_TOLERANCE = 0.05;

/**
 * 抓 USGS 目錄並跟上面那張表對起來。
 *
 * ⚠️ **一次查詢全部拿回來**（M≥8.4、1500 年以來，實測 23 筆），再依 id 索引。
 * 不要改成逐筆 `eventid=` 查詢：那是 14 次請求換同一份資料。
 */
export async function fetchStrongestQuakes(fetchWithRetry) {
  const raw = await (await fetchWithRetry(USGS_QUERY)).json();
  const byId = new Map(raw.features.map((f) => [f.id, f]));
  const warnings = [];
  const quakes = [];

  for (const q of STRONGEST_QUAKES) {
    if (!q.usgsId) {
      // ComCat 沒有的那四筆（1575／1668／1755／1833），走人工轉錄的座標與推估規模
      if (q.lat == null || q.lng == null || q.mag == null) {
        throw new Error(`${q.id}：沒有 usgsId 就必須自帶 lat／lng／mag`);
      }
      quakes.push({ ...q, source: WIKI_LABEL, depthKm: null });
      continue;
    }
    const f = byId.get(q.usgsId);
    // 上游把事件 id 換掉、或查詢門檻變得抓不到它時要直接失敗，不要靜默少一筆
    if (!f) throw new Error(`${q.id}：USGS 查不到事件 ${q.usgsId}（上游改版了？）`);

    const [lng, lat, depth] = f.geometry.coordinates;
    const mag = Math.round(f.properties.mag * 10) / 10;

    // 通稱的日期 vs USGS 的 UTC 日期，差超過一天就是抄錯行
    const utcDate = new Date(f.properties.time).toISOString().slice(0, 10);
    const days = Math.abs(Date.parse(`${q.date}T00:00:00Z`) - Date.parse(`${utcDate}T00:00:00Z`)) / 86400000;
    if (days > 1) {
      throw new Error(`${q.id}：日期 ${q.date} 與 USGS 的 ${utcDate} 差 ${days} 天`);
    }

    if (Math.abs(mag - q.wikiMag) > MAG_TOLERANCE) {
      warnings.push(`${q.name}：維基那張表寫 ${q.wikiMag}、USGS 是 ${mag}（本站採 USGS，卡片兩個都講）`);
    }
    quakes.push({
      ...q,
      lat,
      lng,
      mag,
      depthKm: depth == null ? null : Math.round(depth),
      magType: f.properties.magType,
      source: USGS_LABEL,
    });
  }

  if (quakes.length !== STRONGEST_QUAKES.length) {
    throw new Error(`規模最強地震：預期 ${STRONGEST_QUAKES.length} 筆，實際 ${quakes.length} 筆`);
  }
  return { quakes, warnings };
}
