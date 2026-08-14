/**
 * 臺灣的災害地震。
 *
 * ## 來源：以中央氣象署為主
 *
 * 主體是**交通部中央氣象署地震測報中心**的〈災害地震〉表
 * （`scweb.cwa.gov.tw/zh-tw/page/disaster/5`），1901–2022 共 139 筆。那是主管機關
 * 自己的權威清單，而且**帶官方的經緯度、震源深度與 ML／Mw**——所以這一層完全
 * 不需要跟 USGS 做任何啟發式比對（早期版本靠「同一天、規模最接近」去猜，那條路
 * 有把災情掛到錯的地震上的風險，現在整段拿掉了）。
 *
 * ⚠️ **那份官方表只收到 2022-09-18。** 2023 年以後的災害地震（包括 0403 花蓮）
 * 不在裡面，所以另外用 `RECENT_QUAKES` 補 11 筆，**每一筆都標明來源**，卡片與圖層
 * 說明都看得到。這是刻意接受的混合來源：一個臺灣的地理教學站沒有 0403 花蓮
 * 說不過去。氣象署補上 2023 年以後的資料時，應該把 `RECENT_QUAKES` 對應的幾筆刪掉。
 *
 * ⚠️ **不要為了「來源一致」把 RECENT_QUAKES 拿掉**，也不要反過來整層改回維基百科
 * ——前者會讓最近三年一片空白，後者會退回啟發式比對。
 *
 * ## ⚠️ 這是 HTML 剖析，不是開放資料 API
 *
 * 氣象署沒有把這份表放進開放資料平臺（那邊的地震 API 要金鑰，撞硬性禁止 #1），
 * 所以只能剖析那一頁的表格。剖析 HTML 很脆弱，因此下面有**筆數與欄位數的硬檢查**
 * ——上游改版時要直接失敗，不要靜默少收幾筆。
 */

/** 中央氣象署地震測報中心〈災害地震〉。 */
export const CWA_URL = "https://scweb.cwa.gov.tw/zh-tw/page/disaster/5";
export const CWA_LABEL = "交通部中央氣象署";
export const WIKI_LABEL = "維基百科";
export const LICENSE = "政府資料開放授權條款第 1 版（氣象署）／CC BY-SA（維基百科）";

/** 實測的資料列數與欄數。對不上就讓建置失敗。 */
const EXPECTED_ROWS = 139;
const EXPECTED_COLS = 9;

/**
 * 2023 年以後的災害地震，官方表尚未收錄。
 *
 * 名稱與災情人工抄自維基百科〈臺灣地震列表〉，位置、深度與規模取自 USGS
 * （那是本站「臺灣地震」那一層的同一個目錄，所以這幾筆會跟母圖層的點重合）。
 * ⚠️ 每一筆在產物裡都會帶 `source`，卡片必須顯示——混合來源就要說出來。
 */
export const RECENT_QUAKES = [
  { date: "2022-12-15", lat: 23.77, lng: 121.81, depthKm: 13, mag: 5.9, name: "花蓮外海", harm: "玉山落石導致 6 人受傷" },
  { date: "2024-04-03", lat: 23.84, lng: 121.6, depthKm: 40, mag: 7.4, name: "花蓮壽豐", harm: "20 人罹難、1,155 人受傷、2 人失聯" },
  { date: "2024-04-03", lat: 24.1, lng: 121.68, depthKm: 14, mag: 6.4, name: "花蓮壽豐", harm: "無人傷亡" },
  { date: "2024-04-23", lat: 23.86, lng: 121.57, depthKm: 10, mag: 6.1, name: "花蓮外海", harm: "無人傷亡" },
  { date: "2024-04-23", lat: 23.71, lng: 121.66, depthKm: 9, mag: 6.1, name: "花蓮壽豐", harm: "無人傷亡" },
  { date: "2024-04-27", lat: 24.15, lng: 121.67, depthKm: 38, mag: 5.7, name: "花蓮", harm: "無人傷亡" },
  { date: "2025-01-21", lat: 23.18, lng: 120.54, depthKm: 16, mag: 6.0, name: "嘉義大埔", harm: "50 人受傷" },
  { date: "2025-06-11", lat: 23.37, lng: 121.62, depthKm: 29, mag: 5.9, name: "花蓮東部海域", harm: null },
  { date: "2025-12-08", lat: 23.83, lng: 121.74, depthKm: 10, mag: 5.2, name: "花蓮東部海域", harm: null },
  { date: "2025-12-24", lat: 22.9, lng: 121.25, depthKm: 8, mag: 6.0, name: "臺東卑南", harm: null },
  { date: "2025-12-27", lat: 24.68, lng: 122.04, depthKm: 63, mag: 6.6, name: "宜蘭東部海域", harm: null },
];

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 把 `備註` 拆成「名稱」與「災情」。
 *
 * 上游的寫法是「0918池上地震，1人死亡」——第一段是名稱、其餘是災情。但有例外：
 * 6 筆完全沒有備註、1 筆只有災情（「1人重傷」）、1 筆只有名稱（「0917關山地震」）。
 * 判準是**第一段含不含「地震」**：含才當名稱，否則整串都是災情。
 * 純用「有沒有逗號」去切的話，「1人重傷」會被當成地震的名字。
 */
function splitRemark(remark) {
  if (!remark) return { name: null, harm: null };
  const i = remark.indexOf("，");
  if (i < 0) return remark.includes("地震") ? { name: remark, harm: null } : { name: null, harm: remark };
  const head = remark.slice(0, i);
  return head.includes("地震")
    ? { name: head, harm: remark.slice(i + 1) || null }
    : { name: null, harm: remark };
}

const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** 抓取並剖析官方表。回傳 `{ quakes, warnings }`，`quakes` 已含 `source`。 */
export async function fetchDisasterQuakes(fetchWithRetry) {
  const res = await fetchWithRetry(CWA_URL);
  const html = await res.text();

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1])))
    .filter((cells) => cells.length >= EXPECTED_COLS);

  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(
      `氣象署災害地震表剖析出 ${rows.length} 列，預期 ${EXPECTED_ROWS}` +
        `——上游改版了，請重新確認欄位順序再更新 EXPECTED_ROWS`,
    );
  }

  const quakes = [];
  const skipped = [];
  for (const c of rows) {
    // 欄位順序：編號｜日期時間｜緯度｜經度｜震源深度｜ML｜Mw｜土壤液化｜備註
    const dm = c[1].match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const lat = num(c[2]);
    const lng = num(c[3]);
    if (!dm || lat == null || lng == null) {
      skipped.push(c[1] || "(無日期)");
      continue;
    }
    const { name, harm } = splitRemark(c[8]);
    quakes.push({
      date: `${dm[1]}-${dm[2]}-${dm[3]}`,
      lat,
      lng,
      depthKm: num(c[4]),
      // 課本與新聞講的「規模」是氣象署的 ML；Mw 另外留著，兩者不同時卡片會標
      magLocal: num(c[5]),
      magMoment: num(c[6]),
      name,
      harm,
      source: CWA_LABEL,
    });
  }

  for (const r of RECENT_QUAKES) {
    quakes.push({
      date: r.date,
      lat: r.lat,
      lng: r.lng,
      depthKm: r.depthKm,
      magLocal: r.mag,
      magMoment: null,
      name: r.name,
      harm: r.harm,
      // ⚠️ 一定要標來源：這幾筆不是氣象署那份官方表裡的
      source: `${WIKI_LABEL}／USGS`,
    });
  }

  const warnings = [`氣象署 ${rows.length - skipped.length} 筆（1901–2022）＋補錄 ${RECENT_QUAKES.length} 筆（2023 年以後）`];
  if (skipped.length) warnings.push(`日期或座標無法剖析而略過：${skipped.join("、")}`);
  return { quakes, warnings };
}
