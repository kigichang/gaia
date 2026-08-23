/**
 * 臺灣岩石分布（地質圖的地層面）的存取層。
 *
 * ## ⚠️ 為什麼不是走 data.gov.tw，也不是走地調所的圖磚服務
 *
 * 跟活動斷層那一層是**同一個結論、同一個主管機關**（見 `lib/faults.mjs` 的檔頭）：
 * 官方的地質圖在網路上只發**影像**。實測 `geomap.gsmma.gov.tw/api/Tile/v1/getTile.cfm
 * ?layer=50K_GEOLOGICAL_MAP&x=&y=&z=` 回的是 `image/png` 的圖磚，那個主機上也沒有
 * GeoServer（`/geoserver/ows` 回 404）——拿不到向量幾何，而且會變成執行期的外部相依。
 *
 * 向量資料在同一個主管機關自己的「地質雲加值應用平臺」上，回的就是乾淨的 GeoJSON
 * （WGS84、Polygon、屬性帶圖例代碼／地層名稱／岩性／年代）。所以來源仍然是**主管
 * 機關本身**，只是走它的網站端點而不是開放平臺的散布檔。
 *
 * ⚠️ 這是一個**沒有文件的內部端點**，沒有版本與格式承諾。下面因此有圖徵數、圖例
 * 單位數與面積總和三道硬檢查——上游改版時要**直接失敗**，不要靜默少畫幾塊。
 *
 * ## ⚠️⚠️ `?all=true` 不能省略，少了它上游只回 100 筆
 *
 * 這是這一層最容易靜默出錯的地方：不帶參數時端點回的是**前 100 個** feature
 * （實測 `Stratum25` 1,569 → 100、`TectonicElement50` 153 → 100），**HTTP 200、
 * 格式完全正常**，只是資料少了 94%。地質雲自己的前端就是打 `?all=true`
 * （`map/javascripts/map/app.min.js` 的 `G.overLayers.data`）。
 *
 * ⚠️ 同一個坑目前**還留在 `lib/faults.mjs` 上**：那支沒有帶 `?all=true`，所以拿到的
 * 是 100 段／33 條，而帶了參數是 **134 段／37 條**（多出初鄉、九芎坑、口宵里、
 * 車瓜林四條）。CLAUDE_TW.md 現在把那四條寫成「官方有、這個端點沒有」，其實只是被
 * 截斷了。修那一層要連著補四份內容檔與 `FAULT_IDS`，所以留給另一次改動。
 *
 * ## 為什麼是「二十五萬分之一」那一份，不是五萬分之一
 *
 * 平臺上有兩份地層面：`Stratum`（五萬分之一）與 `Stratum25`（二十五萬分之一，
 * 圖層清單裡跟 `Fault25` 同一組）。這一層用後者，理由是前者用不了：
 *
 * - **圖例沒有整編**。五萬分之一是一幅一幅測繪的，全島拼起來有 **585 種**不同的
 *   「地層名稱＋岩性＋年代」組合，而且其中 2,503 筆連名稱都是空的、另外 1,989 筆
 *   是「水體」。要在上面做教學用的岩石分類，等於自己重編一份圖例。
 * - **35 MB**（`Stratum25` 是 2.9 MB）。這一層要拆成六個產物檔進 repo。
 *
 * 二十五萬分之一那一份是整編過的：全島 **45 個圖例單位**、每一筆都有代碼、名稱、
 * 岩性與年代，正好對得上課本講的「西部沉積岩、中央山脈變質岩、東部火成岩」。
 *
 * ⚠️ **代價是它不含金門與馬祖**（實測 bbox 東經 119.32–122.11、北緯 21.89–25.63，
 * 澎湖、綠島、蘭嶼都在，金門 118.2°E 與馬祖 26.2°N 不在）。五萬分之一那一份有金門，
 * 但基於上面兩點不能用。這件事寫在圖層的 `notes` 裡。
 *
 * ## ⚠️ 圖例單位的鍵是「代碼＋圖例符號」，不是代碼
 *
 * 44 個 `Code` 對應 45 個圖例單位：`7010`（安山岩）在上游拆成 `α1`（中新世）與
 * `α4`（更新世）兩筆。只用 `Code` 當鍵會把兩者併掉，而「大屯火山群是更新世、
 * 基隆火山群是中新世」正是這一層要教的東西之一。
 */

/**
 * 地質雲加值應用平臺（經濟部地質調查及礦業管理中心）。
 *
 * ⚠️ `?all=true` 見檔頭——少了它只會拿到 100 筆，而且完全靜默。
 */
export const SOURCE_URL = "https://www.geologycloud.tw/data/zh-tw/Stratum25?all=true";
export const SOURCE_PAGE = "https://www.geologycloud.tw/map/Stratum/zh-tw";
export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "經濟部地質調查及礦業管理中心 二十五萬分之一地質圖";

/** 實測的圖徵數與圖例單位數。對不上就讓建置失敗（比照活動斷層的線段數檢查）。 */
const EXPECTED_POLYGONS = 1569;
const EXPECTED_UNITS = 45;

/**
 * 六個岩石大類。
 *
 * ## 為什麼是六類，而不是 45 個圖例單位各一個顏色
 *
 * 跟生物群系 14→6、柯本 30 個亞型→5 大類是同一件事：本站掃過整個色域，**六色已經
 * 是 all-pairs 全過的分類色上限**（見 `thematicColors.ts`）。所以**顏色是大類、
 * 圖徵是圖例單位**——地圖畫六個顏色，點下去才告訴你這裡是哪一個地層。
 *
 * ## 併法要說得出口
 *
 * 界線就是課本講臺灣地質時的那幾條：
 *
 * - **沖積層**與**臺地／階地堆積**分開。兩者都是還沒膠結成岩的沉積物，但一個是
 *   現在還在堆的河流沖積扇與平原，一個是更新世抬升後被紅土化、切割成階地的老堆積
 *   ——「嘉南平原」與「桃園台地」的差別就在這裡，併起來這一層就講不出它了。
 * - **板岩**與**片岩**分開。兩者都是變質岩，但「雪山山脈與中央山脈西翼是板岩、
 *   千枚岩，東翼的大南澳變質雜岩才是片岩、片麻岩與大理岩」是中央山脈最核心的一條
 *   地質事實（太魯閣的大理岩峽谷就是後者）。併成一個「變質岩」等於把它刪掉。
 * - **火成岩**收的是岩性上真的是火成岩的單位，包括夾在沉積地層裡的火山岩與凝灰岩
 *   （`0011`／`0121`／`0131` 的玄武岩質凝灰岩及岩流、`1111`／`1731` 的火山岩），
 *   以及利吉層裡以外來岩塊為主的蛇綠岩系（`7901`／`9020`）。⚠️ 那幾筆的**地層
 *   名稱**是母地層（「三峽群及其相當地層」），所以下面的 `label` 把岩性接在後面，
 *   免得在「火成岩」的核取方塊底下點出一個叫三峽群的東西。
 *
 * ⚠️ 石灰岩（恆春石灰岩、隆起珊瑚礁、各群的石灰岩透鏡體）一律歸**沉積岩**，
 * 不另開一類：它在全島只有 60 km²，而且化學沉積與碎屑沉積同屬沉積岩，
 * 課本也是這樣分的。墾丁與小琉球的珊瑚礁石灰岩因此在沉積岩那一格裡。
 */
export const ROCK_CLASSES = [
  { id: "alluvium", label: "沖積層" },
  { id: "terrace", label: "臺地與階地堆積" },
  { id: "sedimentary", label: "沉積岩" },
  { id: "slate", label: "板岩與千枚岩" },
  { id: "schist", label: "片岩與大理岩" },
  { id: "igneous", label: "火成岩" },
];

/**
 * 45 個圖例單位 → 本站的 id、顯示名稱與所屬大類。
 *
 * 鍵是 `"<Code>|<Abbrev>"`（理由見檔頭：44 個 Code 對應 45 個單位）。
 *
 * ⚠️ **不能用 `slugify()`**：它是 `[^a-z0-9]+ → -`，中文全部被剝掉，45 個單位會
 * 得到 45 個空字串（比照 `FAULT_IDS`／`RIVERS`／`RESERVOIR_IDS` 的既有做法）。
 * 這些 id 是圖徵強調與內容檔配對用的 key，必須跨上游改版保持穩定。
 * **對不到就讓建置失敗**：上游新增一個圖例單位是要由人決定 id 與所屬大類的事件。
 *
 * `label` 是卡片標題。⚠️ 它只由**官方欄位拼出來**（`Name`，必要時加上 `Note` 或
 * `Time` 當括號），不是重新命名——本站對官方原文的既有規範。加括號的情形有三種：
 * 同一個地層在上游被岩性拆成好幾筆（卓蘭層／瑞芳群的石灰岩、嵙山層的礫岩…）、
 * 同名不同年代（安山岩 α1／α4），以及夾在沉積地層裡的火山岩（見 `ROCK_CLASSES`）。
 */
export const UNITS = {
  // ── 沖積層 ────────────────────────────────────────────────────────────────
  "6020|Q6": { id: "alluvium", label: "沖積層", cls: "alluvium" },

  // ── 臺地與階地堆積 ─────────────────────────────────────────────────────────
  "6050|Q3": { id: "laterite-terrace", label: "紅土臺地堆積", cls: "terrace" },
  "6060|Q4": { id: "terrace-deposit", label: "臺地堆積", cls: "terrace" },
  "0020|Q1": { id: "dananwan-milun", label: "大南灣層，米崙層", cls: "terrace" },

  // ── 沉積岩 ────────────────────────────────────────────────────────────────
  "0010|Ms": { id: "sanxia-group", label: "三峽群及其相當地層", cls: "sedimentary" },
  "0120|My": { id: "yeliu-group", label: "野柳群及其相當地層", cls: "sedimentary" },
  "0130|Mj": { id: "ruifang-group", label: "瑞芳群及其相當地層", cls: "sedimentary" },
  "0132|ls": { id: "ruifang-limestone", label: "瑞芳群及其相當地層（石灰岩）", cls: "sedimentary" },
  "0100|P2": { id: "cholan-formation", label: "卓蘭層及其相當地層", cls: "sedimentary" },
  "0101|ls": { id: "cholan-limestone", label: "卓蘭層及其相當地層（石灰岩）", cls: "sedimentary" },
  "0140|P1": { id: "chinshui-shale", label: "錦水頁岩及其相當地層", cls: "sedimentary" },
  "0161|PQs": { id: "toukoshan-formation", label: "嵙山層及其相當地層", cls: "sedimentary" },
  "0162|PQc": { id: "toukoshan-conglomerate", label: "嵙山層及其相當地層（礫岩）", cls: "sedimentary" },
  "0041|MPs": { id: "takangkou-chimei", label: "大港口層，奇美層", cls: "sedimentary" },
  "0042|MPc": { id: "takangkou-conglomerate", label: "大港口層，奇美層（礫岩）", cls: "sedimentary" },
  "1660|OM3": { id: "aoti-formation", label: "澳底層", cls: "sedimentary" },
  "0090|PQl": { id: "lichi-kenting", label: "利吉層，墾丁層", cls: "sedimentary" },
  "1340|PQp": { id: "peinanshan-conglomerate", label: "卑南山礫岩", cls: "sedimentary" },
  "1420|Q2": { id: "hengchun-limestone", label: "恆春石灰岩", cls: "sedimentary" },
  "6041|Q5": { id: "raised-coral-reef", label: "隆起珊瑚礁", cls: "sedimentary" },
  "1535|ls": { id: "tuluanshan-limestone", label: "都巒山層（石灰岩）", cls: "sedimentary" },

  // ── 板岩與千枚岩 ───────────────────────────────────────────────────────────
  "1730|Ml": { id: "lushan-formation", label: "廬山層", cls: "slate" },
  "0080|Eh": { id: "hsitsun-hsinkao", label: "西村層，新高層", cls: "slate" },
  "1490|OM1": { id: "kankou-formation", label: "乾溝層", cls: "slate" },
  "1230|EO": { id: "szeleng-sandstone", label: "四稜砂岩", cls: "slate" },
  "1110|OM2": { id: "tatungshan-formation", label: "大桶山層", cls: "slate" },

  // ── 片岩與大理岩（大南澳片岩＝中央山脈東翼的變質雜岩） ──────────────────────
  "5025|PM4": { id: "tananao-schist", label: "大南澳片岩（黑色片岩，綠色片岩，矽質片岩）", cls: "schist" },
  "5024|PM5": { id: "tananao-black-schist", label: "大南澳片岩（黑色片岩）", cls: "schist" },
  "5026|PM3": { id: "tananao-marble", label: "大南澳片岩（變質石灰岩）", cls: "schist" },
  "5021|PM1": { id: "tananao-gneiss", label: "大南澳片岩（片麻岩）", cls: "schist" },
  "5023|PM2": { id: "tananao-migmatite", label: "大南澳片岩（混合岩）", cls: "schist" },

  // ── 火成岩 ────────────────────────────────────────────────────────────────
  "7010|α4": { id: "andesite-pleistocene", label: "安山岩（更新世）", cls: "igneous" },
  "7010|α1": { id: "andesite-miocene", label: "安山岩（中新世）", cls: "igneous" },
  "7063|α3": { id: "andesitic-clastic-pleistocene", label: "安山岩質碎屑岩（更新世）", cls: "igneous" },
  "7062|α2": { id: "andesitic-clastic-miocene", label: "安山岩質碎屑岩（中新世）", cls: "igneous" },
  "7030|β": { id: "basalt", label: "玄武岩", cls: "igneous" },
  "1530|Mt": { id: "tuluanshan-formation", label: "都巒山層", cls: "igneous" },
  "0011|tu": { id: "sanxia-tuff", label: "三峽群及其相當地層（玄武岩質凝灰岩及岩流）", cls: "igneous" },
  "0121|tu": { id: "yeliu-tuff", label: "野柳群及其相當地層（玄武岩質凝灰岩及岩流）", cls: "igneous" },
  "0131|tu": { id: "ruifang-tuff", label: "瑞芳群及其相當地層（玄武岩質凝灰岩及岩流）", cls: "igneous" },
  "1111|v": { id: "tatungshan-volcanics", label: "大桶山層（火山岩）", cls: "igneous" },
  "1731|v": { id: "lushan-volcanics", label: "廬山層（火山岩）", cls: "igneous" },
  "7901|ω1": {
    id: "exotic-blocks",
    label: "輝長岩，橄欖岩，玄武岩，蛇紋岩，集塊岩（外來岩塊為主）",
    cls: "igneous",
  },
  "9020|ω2": { id: "serpentinite", label: "蛇紋岩及基性火成岩", cls: "igneous" },
  "7095|γ": { id: "quartz-porphyry", label: "石英斑岩", cls: "igneous" },
};

// 建置期自我檢查：45 個單位、45 個唯一 id、每一個大類都對得到 ROCK_CLASSES
{
  const keys = Object.keys(UNITS);
  if (keys.length !== EXPECTED_UNITS) {
    throw new Error(`UNITS 有 ${keys.length} 筆，預期 ${EXPECTED_UNITS} 筆`);
  }
  const ids = keys.map((k) => UNITS[k].id);
  if (new Set(ids).size !== ids.length) throw new Error("UNITS 的 id 有重複");
  const classIds = new Set(ROCK_CLASSES.map((c) => c.id));
  for (const k of keys) {
    if (!classIds.has(UNITS[k].cls)) throw new Error(`圖例單位 ${k} 的大類「${UNITS[k].cls}」不存在`);
  }
  for (const c of ROCK_CLASSES) {
    if (!keys.some((k) => UNITS[k].cls === c.id)) throw new Error(`大類「${c.id}」底下一個圖例單位都沒有`);
  }
}

/** 球面多邊形面積（km²），只用來做總面積的合理性檢查。比照 lib/plates.mjs。 */
const EARTH_RADIUS_KM = 6371.0088;
function ringAreaKm2(ring) {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    total +=
      ((x2 - x1) * Math.PI) / 180 *
      (2 + Math.sin((y1 * Math.PI) / 180) + Math.sin((y2 * Math.PI) / 180));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

function polygonAreaKm2(rings) {
  let area = ringAreaKm2(rings[0]);
  for (let i = 1; i < rings.length; i++) area -= ringAreaKm2(rings[i]);
  return area;
}

/**
 * 下載並剖析地層面，**整個 process 只做一次**。
 *
 * 六個大類是六個資料集（六個產物檔），但它們吃的是同一份 2.9 MB 的 GeoJSON
 * ——比照古蹟三級、作物三種與柯本五類共用 module-level 快取的既有做法。
 *
 * 回傳 `Map<"<Code>|<Abbrev>", 多邊形環陣列[]>`。
 */
let cached = null;
export async function fetchStrata(fetchWithRetry) {
  if (cached) return cached;

  const res = await fetchWithRetry(SOURCE_URL);
  const raw = await res.json();
  const features = raw?.features;
  if (!Array.isArray(features)) throw new Error("上游不是 FeatureCollection，端點格式可能變了");

  /**
   * ⚠️ 這道檢查就是在守 `?all=true`：少了那個參數上游只回 100 筆，HTTP 200、
   * 格式完全正常，只是資料少了 94%（見檔頭）。
   */
  if (features.length < EXPECTED_POLYGONS * 0.9) {
    throw new Error(
      `只讀到 ${features.length} 個多邊形（預期約 ${EXPECTED_POLYGONS}）——` +
        "先確認網址上的 ?all=true 還在，再考慮上游是不是改版了",
    );
  }

  const byUnit = new Map();
  let area = 0;
  for (const f of features) {
    const p = f?.properties ?? {};
    const key = `${p.Code}|${p.Abbrev}`;
    const unit = UNITS[key];
    if (!unit) {
      throw new Error(
        `圖例單位「${key}」（${p.Name}／${p.Note}／${p.Time}）不在 UNITS 對照表裡，` +
          "請先決定它的 id 與所屬岩石大類",
      );
    }
    if (f.geometry?.type !== "Polygon") {
      throw new Error(`圖例單位「${key}」的幾何是 ${f.geometry?.type}，這一層只處理 Polygon`);
    }
    if (!byUnit.has(key)) byUnit.set(key, { unit, props: p, rings: [] });
    byUnit.get(key).rings.push(f.geometry.coordinates);
    area += polygonAreaKm2(f.geometry.coordinates);
  }

  if (byUnit.size !== EXPECTED_UNITS) {
    throw new Error(`上游只出現 ${byUnit.size} 個圖例單位，預期 ${EXPECTED_UNITS} 個`);
  }

  /**
   * 面積總和是這一層唯一的自我檢查（比照板塊面積總和等於地球表面積、七大洲總和
   * 等於陸地面積）：這份圖鋪滿臺灣本島與澎湖，所以總和必須接近
   * 本島及附屬島嶼 35,887 ＋ 澎湖 127 ≈ 36,014 km²。實測 36,178（+0.5%）。
   * 對不上代表投影或幾何弄錯了——那是別的檢查抓不到的。
   */
  const EXPECTED_AREA = 36014;
  const drift = (area - EXPECTED_AREA) / EXPECTED_AREA;
  if (Math.abs(drift) > 0.05) {
    throw new Error(
      `地層面總面積 ${area.toFixed(0)} km²，與臺灣本島＋澎湖的 ${EXPECTED_AREA} km² 差 ` +
        `${(drift * 100).toFixed(1)}%（超過 5%）`,
    );
  }

  cached = { byUnit, totalAreaKm2: area, polygons: features.length };
  return cached;
}

/**
 * 一個圖例單位的 feature 屬性（卡片走 `FeatureCard` 的 fallback，沒有內容檔）。
 *
 * ⚠️ `meta` 與 `detail` 用的是**上游的原文**，包含它用全形逗號當頓號的寫法
 * （「砂岩，頁岩」）——那是官方圖例上印的字，改成頓號等於改寫來源。
 * ⚠️ 沖積層那一筆上游的 `Note` 是空的（1,569 筆裡有 129 筆），所以 `meta` 要能
 * 只有年代。**不要自己補一句岩性**，那會變成一筆查不到出處的敘述。
 */
export function unitProperties(entry) {
  const { unit, props } = entry;
  const cls = ROCK_CLASSES.find((c) => c.id === unit.cls);
  const lithology = (props.Note ?? "").trim();
  return {
    id: unit.id,
    name: unit.label,
    meta: lithology ? `${lithology}・${props.Time}` : props.Time,
    detail: `圖例代碼 ${props.Abbrev}・岩石大類：${cls.label}`,
  };
}
