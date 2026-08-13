/**
 * 農業部農糧署「農情調查」的存取層（政府資料開放平臺資料集 7302）。
 *
 * 產出三個 geojson：果樹／蔬菜／茶，各是**鄉鎮形心上的點**，半徑代表年種植面積。
 * 幾何來自已經產好的 `public/data/geo/tw-townships.geojson`——所以這一份**必須先
 * 建置鄉鎮界**，這也正是當初先補鄉鎮界的原因（作物統計是依鄉鎮的）。
 *
 * ⚠️ 上游有 CORS 標頭，但仍然只在建置期呼叫：43,538 筆原始統計不該讓學生的
 * 瀏覽器自己抓、自己聚合。
 */

/** 資料集 7302「農情調查」。每年更新一次。 */
export const DATASET_ID = 7302;
const ENDPOINT =
  "https://data.moa.gov.tw/Service/OpenData/FromM/TownCropData.aspx?IsTransData=1&UnitId=038";

export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "農業部農糧署";

/**
 * ⚠️ **不能一次抓全部。** 不帶篩選時上游**固定只回 9999 筆**（實測；不是剛好，
 * 是硬上限），而且只涵蓋 6 個縣市——照單全收的話會做出一張「臺灣只有六個縣市
 * 種東西」的地圖，**而且沒有任何錯誤訊息**。`City=` 篩選可以逃出這個上限
 * （實測單一縣市最多 4,583 筆，離 9999 還有距離）。
 */
const COUNTIES = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市",
  "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "屏東縣",
  "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
];

/**
 * ⚠️ 上游把「臺」寫成「台」（台北市、台中市、台南市、台東縣，**連鄉鎮名也有**：
 * 屏東縣霧台鄉）。鄉鎮界圖資用的是「臺」，不正規化的話 join 會靜默少掉那幾筆。
 * 實測正規化前 344/345 對得上，正規化後 345/345。
 */
const normalize = (s) => (s ?? "").replace(/台/g, "臺").trim();

/**
 * 要收錄的三種作物。
 *
 * `match` 收的是**作物代碼**：代碼的第一碼就是官方的類別（0 雜糧、1 豆類、
 * 2 根莖、3 特用、4 蔬菜、5 綠肥／休閒、6 果樹、7 牧草、8 藥用、9 花卉菇類、
 * Y 其他）。用代碼而不是名稱比對，是因為名稱有「其他果菜」「其他葉菜」這種
 * 開放結尾的項目。
 *
 * ⚠️ **為什麼沒有稻米**：農情調查**不含水稻**。這不是篩掉的，是上游就沒有——
 * 實測彰化縣（稻米大縣）在這份資料裡的水稻是 **0 筆**，雲林縣只有 4 筆掛在
 * 「Y04」這個雜項代碼下，而且 `Crop=水稻` 篩選回 0 列、113 與 114 年都一樣。
 * 水稻另有專屬的統計（「臺灣地區稻作種植、收穫面積及產量」），但那份**只到縣市**，
 * 跟這一層的鄉鎮尺度對不起來，硬混會做出一張兩種粒度混在一起的圖。
 *
 * ⚠️ **為什麼沒有花卉菇類**：那個類別的「面積」不是耕地面積——太空包香菇是按包
 * 計算的，全國合計 57 萬公頃，比整個蔬菜類還大，畫出來會讓彰化看起來像全臺最大
 * 的農業縣。同理 5 開頭的「休閒面積／荒廢面積」（全國 211 萬公頃）是**沒有種東西**
 * 的地，更不能當作物。
 */
export const CROP_ITEMS = [
  {
    id: "fruit",
    label: "果樹",
    /** 6 開頭＝果樹。檳榔、芒果、香蕉、龍眼都在這裡 */
    match: (code) => code.startsWith("6"),
  },
  {
    id: "vegetable",
    label: "蔬菜",
    /** 4 開頭＝蔬菜 */
    match: (code) => code.startsWith("4"),
  },
  {
    id: "tea",
    label: "茶",
    /**
     * 只取代碼 305 的「茶」，不是整個 3 開頭的特用作物——那一類最大宗是油菜子
     * （綠肥性質），混進來會讓「茶區」變成一張看不出阿里山、鹿谷、坪林的圖。
     */
    match: (code) => code === "305",
  },
];

/**
 * 抓取並依鄉鎮聚合。module-level 快取：三個 geojson 是三筆 SOURCES，但上游只該
 * 抓一輪（22 個縣市各一次請求）。
 */
let cached = null;

export function fetchCrops(fetchWithRetry) {
  cached ??= load(fetchWithRetry);
  return cached;
}

async function load(fetchWithRetry) {
  const rows = [];
  const emptyCounties = [];
  for (const county of COUNTIES) {
    let got = [];
    // 上游的縣市名有「台」也有「臺」，兩種都試（實測多數縣市只認「台」那一種）
    for (const form of [county, county.replace(/臺/g, "台")]) {
      const res = await fetchWithRetry(`${ENDPOINT}&City=${encodeURIComponent(form)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        got = data;
        break;
      }
    }
    if (got.length >= 9999) {
      throw new Error(`${county} 回了 ${got.length} 筆，已達上游單次上限，需要再往下分頁`);
    }
    if (!got.length) emptyCounties.push(county);
    rows.push(...got);
  }

  const warnings = [];
  if (emptyCounties.length) {
    // 金門與連江實測沒有農情調查資料，這是上游的收錄範圍，不是抓取失敗
    warnings.push(`沒有農情調查資料的縣市：${emptyCounties.join("、")}`);
  }
  warnings.push(`上游統計共 ${rows.length.toLocaleString("en-US")} 筆`);
  return { rows, warnings };
}

/**
 * 把統計聚合成「每個鄉鎮、這一類作物的年種植面積」。
 *
 * ⚠️ **面積是跨期作相加的**。同一個鄉鎮的同一種作物會有一期作／二期作／裡作
 * 好幾列（多年生的茶與果樹則只有一列「全年」），相加得到的是**年種植面積**
 * ——也就是一年之內總共種了多少，一塊地一年種兩期就算兩次。這是農業統計的標準
 * 定義，不是重複計算的 bug，但**卡片與圖例都要寫「年種植面積」**，不要寫成
 * 「耕地面積」。
 */
/**
 * 這一列是不是「真的在生產」。
 *
 * 只對多年生作物（`期作 === "全年"`，也就是茶與果樹）判斷：**種植面積有數字、但
 * 收穫面積與收量都是 0**，代表那不是一片在生產的果園。
 *
 * ⚠️ 這條規則是被一筆實測到的上游錯誤逼出來的：新竹縣寶山鄉報了 **2,487 公頃的
 * 蘋果**，收穫面積 0、收量 0——那是全國其他所有蘋果（合計約 230 公頃，真正的產地
 * 是臺中和平區梨山一帶）的十六倍，而寶山鄉是海拔一百多公尺的丘陵，種不出蘋果。
 * 不濾掉的話，地圖上會在新竹丘陵長出一顆全臺數一數二大的果樹圓點。
 *
 * 實測影響很小而且很準：果樹面積少 6.5%、茶少 0.2%（前五大茶鄉一個都沒變），
 * 而寶山鄉的果樹從 4,497 公頃回到 320 公頃。**季節性作物不套這條規則**——蔬菜
 * 一年多收，某一期沒收成是正常的。
 */
function isProducing(r) {
  if (r["期作"] !== "全年") return true;
  const harvested = r["收穫面積(公頃)"] ?? 0;
  const output = r["收量(公斤)"] ?? 0;
  return harvested > 0 || output > 0;
}

export function aggregate(rows, item) {
  const byTown = new Map();
  for (const r of rows) {
    const code = (r["作物代碼"] ?? "").trim();
    if (!item.match(code)) continue;
    const area = r["種植面積(公頃)"];
    if (typeof area !== "number" || !(area > 0)) continue;
    if (!isProducing(r)) continue;
    const county = normalize(r["縣市"]);
    const town = normalize(r["鄉鎮"]);
    const key = townKey(county, town);
    // 縣市與鄉鎮名放進 value，呼叫端不必再把 key 拆回來——拆字串是多一個會錯的地方
    const cur = byTown.get(key) ?? { county, town, area: 0, crops: new Map() };
    cur.area += area;
    cur.crops.set(r["作物"], (cur.crops.get(r["作物"]) ?? 0) + area);
    byTown.set(key, cur);
  }
  return byTown;
}

/**
 * 「縣市＋鄉鎮」的 join key。
 *
 * ⚠️ **兩邊一定要走同一個函式。** 作物統計與鄉鎮界圖資各自組一次 key 的話，任何
 * 一點差異（分隔字元、有沒有 trim、台／臺）都會讓 join 靜默失敗，而症狀是
 * 「幾乎每個鄉鎮都對不到」，看起來完全像資料壞掉。這裡踩過一次：分隔字元不小心
 * 打成 NUL（U+0000），在終端機上跟空白**看起來一模一樣**。
 */
export function townKey(county, town) {
  return `${normalize(county)}|${normalize(town)}`;
}

/** 給人看的面積字串。四位數的公頃沒有人讀得出量級，破萬就換成「萬公頃」。 */
export function formatArea(ha) {
  if (ha >= 10000) return `${(ha / 10000).toFixed(1)} 萬公頃`;
  if (ha >= 100) return `${Math.round(ha).toLocaleString("en-US")} 公頃`;
  return `${ha.toFixed(1)} 公頃`;
}

export { normalize };
