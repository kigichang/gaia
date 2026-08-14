/**
 * 經濟部地質調查及礦業管理中心的臺灣活動斷層。
 *
 * ## ⚠️ 為什麼不是走 data.gov.tw
 *
 * 政府資料開放平臺的「活動斷層分布圖」（資料集 6697）**只發佈 WMS 連結**——那是
 * 影像服務，拿不到向量幾何，而且會變成執行期的外部相依（本站不做這件事）。實測
 * 那份 CSV 裡全是 `geomap.gsmma.gov.tw/mapguide/...&format=image/png` 這種圖磚網址。
 *
 * 向量資料在同一個主管機關自己的「地質雲加值應用平臺」上，回的就是乾淨的
 * GeoJSON（WGS84、100 條線段、帶分類與觀察方式）。所以來源仍然是**主管機關本身**，
 * 只是走它的網站端點而不是開放平臺的散布檔。
 *
 * ⚠️ 這是一個**沒有文件的內部端點**，不像 data.gov.tw 的散布檔有版本與格式承諾。
 * 它哪天改路徑或改欄位，這裡會直接失敗（而不是靜默拿到壞資料，因為下面有筆數與
 * 欄位檢查）。真的失效時的替代路徑是 fault.gsmma.gov.tw 的圖資下載。
 *
 * ## ⚠️ 這是 33 條的版本，不是最新的 36 條
 *
 * 2021 年的改版把活動斷層從 33 條增為 36 條（新增初鄉、口宵里、車瓜林三條）。
 * 這個端點回的是**改版前的 33 條**（實測搜尋不到那三個名字）。三條都是後來才
 * 補列、課本不會點名的小斷層，而課本會講的（車籠埔、山腳、梅山、新化、池上、
 * 潮州…）一條都沒少——但**圖層說明必須寫明是 33 條的版本**，不能寫「最新」。
 */

/** 地質雲加值應用平臺（經濟部地質調查及礦業管理中心）。 */
export const SOURCE_URL = "https://www.geologycloud.tw/data/zh-tw/ActiveFault";
export const SOURCE_PAGE = "https://www.geologycloud.tw/map/ActiveFault/zh-tw";
export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部地質調查及礦業管理中心";

/** 實測的線段數與斷層數。對不上就讓建置失敗——上游改版是要有人看到的事件。 */
const EXPECTED_SEGMENTS = 100;
const EXPECTED_FAULTS = 33;

/**
 * 官方分類。**第一類的定義是「全新世（一萬年）以來曾經活動」**，第二類是
 * 「更新世晚期（十萬年）以來曾經活動」——這是課本會考的區別，所以要原樣保留，
 * 不要自己改寫成「活躍／較不活躍」之類的說法。
 */
const CLASS_NOTE = {
  第一類: "全新世（一萬年內）曾活動",
  第二類: "更新世晚期（十萬年內）曾活動",
};

/**
 * 斷層中文名 → 本站 id。
 *
 * ⚠️ **不能用 `slugify()`**：它是 `[^a-z0-9]+ → -` 的實作，中文全部被剝掉，33 條
 * 斷層會得到 33 個空字串（實測就是這樣，靠 build-geodata 的「id 有重複」檢查擋下來的）。
 * 比照 `COUNTY_IDS`／`RIVERS`／`RESERVOIR_IDS` 的既有做法，用一份人工對照表——
 * 這些 id 是內容檔的檔名與圖徵強調的 key，必須跨上游改版保持穩定。
 *
 * 對不到就讓建置失敗：上游新增一條斷層（2021 年改版就多了三條）是要由人決定
 * 新 id 的事件，不是可以自動猜的。
 */
const FAULT_IDS = {
  // 第一類（全新世以來曾活動）
  車籠埔斷層: "chelongpu",
  新城斷層: "xincheng",
  六甲斷層: "liujia",
  三義斷層: "sanyi",
  三義斷層之分支斷層: "sanyi-branch",
  鹿野斷層: "luye",
  "大茅埔－雙冬斷層": "damaopu-shuangdong",
  瑞穗斷層: "ruisui",
  旗山斷層: "qishan",
  米崙斷層: "milun",
  大甲斷層: "dajia",
  觸口斷層: "chukou",
  獅潭斷層: "shitan",
  池上斷層: "chishang",
  新化斷層: "xinhua",
  大尖山斷層: "dajianshan",
  嶺頂斷層: "lingding",
  屯子腳斷層: "tunzijiao",
  梅山斷層: "meishan",
  彰化斷層: "changhua",
  玉里斷層: "yuli",
  鐵砧山斷層: "tiezhenshan",
  // 第二類（更新世晚期以來曾活動）
  奇美斷層: "qimei",
  山腳斷層: "shanjiao",
  新竹斷層: "xinzhu",
  利吉斷層: "liji",
  左鎮斷層: "zuozhen",
  潮州斷層: "chaozhou",
  木屐寮斷層: "mujiliao",
  小崗山斷層: "xiaogangshan",
  後甲里斷層: "houjiali",
  恆春斷層: "hengchun",
  湖口斷層: "hukou",
};

const clean = (v) => String(v ?? "").replace(/\s+/g, "").trim();

/** 名稱正規化：上游有「大茅埔- 雙冬斷層」這種夾了空白的破折號寫法。 */
const normalizeName = (v) => clean(v).replace(/-/g, "－");

export async function fetchFaults(fetchWithRetry) {
  const res = await fetchWithRetry(SOURCE_URL);
  const fc = await res.json();

  const segments = (fc?.features ?? []).filter(
    (f) => f.geometry?.type === "LineString" && f.geometry.coordinates?.length > 1,
  );
  if (segments.length !== EXPECTED_SEGMENTS) {
    throw new Error(
      `活動斷層線段數是 ${segments.length}，預期 ${EXPECTED_SEGMENTS}——上游可能改版了，` +
        `請確認分類欄位與筆數再更新 EXPECTED_SEGMENTS 與圖層說明`,
    );
  }

  /**
   * 同一條斷層在上游是多筆線段（車籠埔斷層有 19 段），合併成一個 MultiLineString。
   * 可點清單要的是「33 條斷層」，不是「100 個線段」——點一段只選到那一段，
   * 而使用者想選的是整條車籠埔斷層。
   */
  const byName = new Map();
  for (const f of segments) {
    const name = normalizeName(f.properties?.Name);
    const faultClass = clean(f.properties?.FAULT_TYPE);
    if (!name || !CLASS_NOTE[faultClass]) {
      throw new Error(`斷層「${name}」的分類是「${faultClass}」，不在預期的第一類／第二類裡`);
    }
    const id = FAULT_IDS[name];
    if (!id) {
      throw new Error(
        `斷層「${name}」不在 FAULT_IDS 對照表裡，請先決定它的 id`,
      );
    }
    const cur = byName.get(name) ?? { id, name, faultClass, lines: [], observe: new Set() };
    // 同名不同類理論上不該發生；真的發生要有人看到，不要靜默取其中一個
    if (cur.faultClass !== faultClass) {
      throw new Error(`斷層「${name}」同時出現 ${cur.faultClass} 與 ${faultClass}`);
    }
    cur.lines.push(f.geometry.coordinates);
    cur.observe.add(clean(f.properties?.observe));
    byName.set(name, cur);
  }

  if (byName.size !== EXPECTED_FAULTS) {
    throw new Error(`活動斷層數是 ${byName.size}，預期 ${EXPECTED_FAULTS}`);
  }

  const warnings = [
    `${byName.size} 條活動斷層／${segments.length} 個線段` +
      `（第一類 ${[...byName.values()].filter((v) => v.faultClass === "第一類").length}、` +
      `第二類 ${[...byName.values()].filter((v) => v.faultClass === "第二類").length}）`,
  ];
  return { faults: [...byName.values()], warnings };
}

export { CLASS_NOTE };
