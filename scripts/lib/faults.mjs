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
 * GeoJSON（WGS84、134 條線段、帶分類與觀察方式）。所以來源仍然是**主管機關本身**，
 * 只是走它的網站端點而不是開放平臺的散布檔。
 *
 * ⚠️ 這是一個**沒有文件的內部端點**，不像 data.gov.tw 的散布檔有版本與格式承諾。
 * 它哪天改路徑或改欄位，這裡會直接失敗（而不是靜默拿到壞資料，因為下面有筆數與
 * 欄位檢查）。真的失效時的替代路徑是 fault.gsmma.gov.tw 的圖資下載。
 *
 * ## 37 個圖徵 = 官方現行的 36 條 ＋ 一條官方已併回、這份圖資仍單列的
 *
 * 官方〈活動斷層分布圖〉（`fault.gsmma.gov.tw/About/Fault_map`，2026-08 實測）
 * 列 **36 條**；這個端點回的是 **37 條**，多出來的是「三義斷層之分支斷層」
 * ——官方已經把它併回三義斷層，這份圖資還單獨畫著。**兩者共用同一頁說明**。
 *
 * ⚠️ 2026-08 之前這裡拿到的是 33 條，並且被寫成「這個端點是改版前的版本」。
 * **那個判斷是錯的**：只是 `SOURCE_URL` 少了 `?all=true` 而被截斷（見下）。
 */

/**
 * 地質雲加值應用平臺（經濟部地質調查及礦業管理中心）。
 *
 * ⚠️⚠️ **`?all=true` 不能省。** 不帶這個參數時端點只回**前 100 個 feature**，
 * 而且 **HTTP 200、格式完全正常**——沒有任何跡象顯示資料被截斷了。這個坑潛伏了
 * 很久：舊版的 `EXPECTED_SEGMENTS = 100` 剛好把截斷後的筆數當成了正確值，於是
 * 少掉的四條（初鄉、九芎坑、口宵里、車瓜林）被寫進文件當成「官方有、這個端點
 * 沒有」。實測帶了參數是 **134 段／37 條**，正好是官方現行的 36 條 ＋ 官方已併回
 * 三義斷層、但這份圖資仍單列的「三義斷層之分支斷層」。
 *
 * 同一個平臺的其他端點都一樣（`Stratum25` 1,569 → 100、`TectonicElement50`
 * 153 → 100），地質雲自己的前端就是打 `?all=true`（`map/javascripts/map/app.min.js`
 * 的 `G.overLayers.data`）。岩石分布那一層走的是同一條路，見 `lib/geology.mjs`。
 */
export const SOURCE_URL = "https://www.geologycloud.tw/data/zh-tw/ActiveFault?all=true";
export const SOURCE_PAGE = "https://www.geologycloud.tw/map/ActiveFault/zh-tw";
export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部地質調查及礦業管理中心";

/**
 * 實測的線段數與斷層數。對不上就讓建置失敗——上游改版是要有人看到的事件。
 *
 * ⚠️ 這兩個數字同時也是 `?all=true` 的守門員：參數掉了就會回 100 段／33 條，
 * 這裡會立刻失敗而不是靜默少畫四條斷層。**不要為了讓建置過去而把它們改回去。**
 */
const EXPECTED_SEGMENTS = 134;
const EXPECTED_FAULTS = 37;

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
 * ⚠️ **不能用 `slugify()`**：它是 `[^a-z0-9]+ → -` 的實作，中文全部被剝掉，37 條
 * 斷層會得到 37 個空字串（實測就是這樣，靠 build-geodata 的「id 有重複」檢查擋下來的）。
 * 比照 `COUNTY_IDS`／`RIVERS`／`RESERVOIR_IDS` 的既有做法，用一份人工對照表——
 * 這些 id 是內容檔的檔名與圖徵強調的 key，必須跨上游改版保持穩定。
 *
 * 對不到就讓建置失敗：上游新增一條斷層是要由人決定新 id 的事件，不是可以自動猜的。
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
  車瓜林斷層: "cheguanlin",
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
  初鄉斷層: "chuxiang",
  九芎坑斷層: "jiuqiongkeng",
  口宵里斷層: "kouxiaoli",
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
   * 同一條斷層在上游是多筆線段（車籠埔斷層有 21 段），合併成一個 MultiLineString。
   * 可點清單要的是「37 條斷層」，不是「134 個線段」——點一段只選到那一段，
   * 而使用者想選的是整條車籠埔斷層。
   */
  const byName = new Map();
  for (const f of segments) {
    const name = normalizeName(f.properties?.Name);
    /**
     * ⚠️ **分類欄位的名字在兩種回應裡不一樣**：不帶參數時是 `FAULT_TYPE`，
     * 帶 `?all=true` 時是 `Type`（實測，同一個端點、同一天）。兩個都讀，
     * 但值仍然必須落在 `CLASS_NOTE` 裡——不是靜默接受任何東西。
     */
    const faultClass = clean(f.properties?.Type ?? f.properties?.FAULT_TYPE);
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

/**
 * 沿線標註用的短名例外。
 *
 * 一般規則是把尾綴的「斷層」兩個字去掉（`build-geodata.mjs` 的 transform 在做），
 * 37 條裡只有這一條不適用——去掉尾綴會得到「三義斷層之分支」，比原本的全名只短
 * 兩個字，等於沒省到，而標註能不能放得出來就取決於字串長度。
 */
export const SHORT_NAMES = {
  三義斷層之分支斷層: "三義分支",
};

export { CLASS_NOTE };
