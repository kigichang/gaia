/**
 * 世界主要山脈（Natural Earth 自然地理區）的存取層。
 *
 * ## 為什麼是 Natural Earth 的「自然地理區」
 *
 * 山脈沒有像國界那樣的官方界線圖資——「阿爾卑斯山脈到哪裡為止」本來就是製圖上的
 * 判斷。公開、免金鑰、涵蓋全球而且逐筆標了種類的只有 Natural Earth 的
 * `ne_10m_geography_regions_polys`（`FEATURECLA === "Range/mtn"`，222 筆），
 * 那也是絕大多數世界地圖標山脈名時用的那一份。授權是 public domain。
 *
 * ## ⚠️ 上游是「面」，本層畫的是「線」——中軸線是算出來的
 *
 * 那 222 筆是**範圍面**（阿爾卑斯是一塊 71 個點的多邊形），但這一層要教的是
 * **走向**：安地斯山脈從委內瑞拉一路拉到火地島、洛磯山脈與海岸山脈平行排列、
 * 喜馬拉雅山脈沿著板塊聚合帶橫過。而且面在這個站上還有兩個硬問題：
 *
 * 1. **沒有顏色可用。** 掃過整個 OKLCH 色域，第 14 個面色（既有的大洲梅紫、
 *    生物群系六色、柯本五色、板塊暖褐）一組都不存在——本站的分類色上限是六色，
 *    面色票早就滿了。線色則還有一族紫可以用（見 thematicColors.ts 的
 *    `MOUNTAIN_COLOR`）。
 * 2. **面會吃掉 `MAX_ACTIVE_BY_KIND.fill` 的兩個名額之一**，而「山脈擋住水氣 →
 *    背風側是沙漠」正好要跟柯本氣候分區或生物群系疊著看。畫成線就不用搶。
 *
 * 所以 `polygonAxis()` 把每一塊範圍面化成一條**中軸線**（medial axis 的網格近似）。
 * 實測長度對得上常識：喜馬拉雅 2,253 km（常見值約 2,400）、阿爾卑斯 1,064
 * （約 1,200）、安地斯 8,000 出頭（7,000–8,900 各家說法不一）、大分水嶺 3,695
 * （約 3,500）。⚠️ 但它終究是**從一塊化簡過的範圍面推出來的示意軸線**，不是實測
 * 稜線，所以圖層與每一條都標 `schematic`，而且**不對外publish長度**——那是這一層
 * 最容易產生假精確的地方。
 *
 * ## ⚠️ `NAME_ZHT` 不能用，中文名一律走 `RANGES`
 *
 * 上游那個欄位名字叫 zht，內容卻是簡繁混雜（阿爾卑斯寫「阿尔卑斯山」、烏拉寫
 * 「乌拉尔山脉」、喜馬拉雅寫「喜马拉雅山脉」），而且用的不一定是臺灣的譯名。
 * 這跟世界底圖 `name:zh-Hant` 踩到的是同一個坑（見 CLAUDE.md basemaps 那節）。
 * 所以 39 條的中文名、洲別、成因說明與主峰全部人工整理在 `RANGES`，key 用
 * **`NE_ID`**（上游會改拼寫，數值 id 穩定；`Transantarctic Mountains` 上游拆成
 * 兩筆但共用同一個 NE_ID，正好自動併回一條）。
 */

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/** 自然地理區（面）。山脈是其中 `FEATURECLA === "Range/mtn"` 的 222 筆。 */
export const REGIONS_URL = `${NE}/ne_10m_geography_regions_polys.geojson`;
/** 高程點（633 座標了海拔的山峰）。主峰的座標與高度出自這裡。 */
export const PEAKS_URL = `${NE}/ne_10m_geography_regions_elevation_points.geojson`;

export const LICENSE = "Natural Earth（public domain）";
/** ⚠️ 兩份資料集，兩個標籤——`sourceLinks.ts` 的規則是「連得到那份資料本身」。 */
export const SOURCE_LABELS = ["Natural Earth 1:10m 自然地理區", "Natural Earth 1:10m 高程點"];

/**
 * 圖層抽屜可點清單的分組順序（`browse.groupBy: "category"`）。
 *
 * ⚠️ 分組依**洲**而不是「新褶曲／古老褶曲」。後者在教學上更有力，但那個分類
 * 對半數的山脈都說不清楚（衣索比亞高原是熔岩高原、西高止山脈是斷層崖、帕米爾
 * 是山結），硬分等於製造一堆查不到出處的斷言。成因逐條寫在 `formation` 裡，
 * 那是講得出來、也標得出來源的層級。
 */
export const CONTINENT_ORDER = ["亞洲", "歐洲", "非洲", "北美洲", "南美洲", "大洋洲", "南極洲"];

/**
 * 收錄的 39 條山脈。**這不是 NE 那 222 筆的全部，是課本會點名的那些。**
 *
 * 選錄界線：臺灣國中小與高中地理課本、以及新聞與科普讀物會直接叫出名字的山脈，
 * 七大洲都要有。⚠️ 不要用 `SCALERANK <= 3` 之類的機械篩選代替它——那樣會同時
 * 漏掉秦嶺（rank 4，中國南北的自然界線）與托魯斯山脈（rank 5），卻收進雅布羅諾維嶺
 * 與塔爾巴哈台山這種課本不會提的。
 *
 * 欄位：
 * - `id`／`name`／`en`：id 同時是 geojson 的 `properties.id` 與（將來若補內容檔）
 *   `src/content/geo/world-mountains/<id>.json` 的檔名，三者必須是同一個字串。
 * - `continent`：`browse.groupBy` 的分組值，必須在 `CONTINENT_ORDER` 裡。
 * - `formation`：卡片上「這條山脈是怎麼來的」那一行。
 * - `peak`：主峰。`en` 必須是 `PEAKS_URL` 裡某個 `featurecla === "mountain"` 的
 *   `name`（建置期會檢查），高度直接取上游的 `elevation`，不自己抄數字。
 *
 * ⚠️ **主峰不可以用「範圍面內海拔最高的那個高程點」自動決定。** 實測會出兩種錯：
 * 上游的興都庫什面**蓋到了南迦帕爾巴特峰**（那是喜馬拉雅的西端），自動選會選到它
 * 而不是蒂里奇米爾峰；西高止山脈真正的最高峰阿奈穆迪山則**落在面的外面**，自動選
 * 會退而選到多達貝塔山。所以逐條指名，面內外都不管。
 */
export const RANGES = {
  // ── 亞洲 ──────────────────────────────────────────────────────────────
  1159104307: {
    id: "himalaya",
    name: "喜馬拉雅山脈",
    en: "Himalayas",
    continent: "亞洲",
    formation: "印澳板塊撞上歐亞板塊，把特提斯海的海床抬成世界最高的褶曲山脈，至今仍在上升",
    peak: { en: "Mount Everest", name: "聖母峰" },
  },
  1159104185: {
    id: "karakoram",
    name: "喀喇崑崙山脈",
    en: "Karakoram Range",
    continent: "亞洲",
    formation: "同一場印澳與歐亞板塊碰撞的產物，四座八千公尺以上的高峰集中在這裡",
    /** ⚠️ 名字裡不再帶「（K2）」：卡片的數據格會變成「喬戈里峰（K2）（8,611 m）」
     * 兩層括號。K2 是上游的原名，`en` 已經帶著它，卡片與搜尋都拿得到。 */
    peak: { en: "K2", name: "喬戈里峰" },
  },
  1159104183: {
    id: "hindu-kush",
    name: "興都庫什山脈",
    en: "Hindu Kush",
    continent: "亞洲",
    formation: "印澳板塊向北推擠的西翼，把帕米爾的山結延伸進阿富汗",
    peak: { en: "Tirich Mir", name: "蒂里奇米爾峰" },
  },
  1159104181: {
    id: "pamir",
    name: "帕米爾高原",
    en: "Pamirs",
    continent: "亞洲",
    formation: "天山、崑崙、喀喇崑崙與興都庫什在此交會的山結，有「世界屋脊」之稱",
    peak: { en: "Kongkoerh", name: "公格爾山" },
  },
  1159104299: {
    id: "tian-shan",
    name: "天山山脈",
    en: "Tian Shan",
    continent: "亞洲",
    formation: "古生代的老山地，因印澳與歐亞碰撞的力量傳到內陸而重新隆起，把新疆分成南北疆",
    peak: { en: "Pik Pobeda", name: "托木爾峰" },
  },
  1159104187: {
    id: "kunlun",
    name: "崑崙山脈",
    en: "Kunlun Mountains",
    continent: "亞洲",
    formation: "青藏高原的北緣，把高原與塔里木盆地分開",
    peak: { en: "Liushi Shan", name: "崑崙女神峰" },
  },
  1159104169: {
    id: "altai",
    name: "阿爾泰山脈",
    en: "Altai Mountains",
    continent: "亞洲",
    formation: "內陸的古老褶曲山地，在新生代重新抬升，是中國、蒙古、俄羅斯與哈薩克的交界",
    peak: { en: "Belukha", name: "別盧哈山" },
  },
  1159103903: {
    id: "qilian",
    name: "祁連山脈",
    en: "Qilian Mountains",
    continent: "亞洲",
    formation: "青藏高原的東北緣，融雪供給了北麓河西走廊的綠洲",
    peak: { en: "Kangze'gyai", name: "團結峰" },
  },
  1159103573: {
    id: "qinling",
    name: "秦嶺",
    en: "Qinling Mountains",
    continent: "亞洲",
    formation: "中國南北的自然界線，冬季擋住南下的冷空氣；一月均溫 0 ℃ 等溫線與年雨量 800 公釐等雨線大致沿著它",
    peak: { en: "Taibai Shan", name: "太白山" },
  },
  1159104171: {
    id: "greater-khingan",
    name: "大興安嶺",
    en: "Greater Khingan Range",
    continent: "亞洲",
    formation: "東亞季風深入內陸的界線，越過它就進入乾燥的蒙古高原",
    peak: { en: "Huanggangliang", name: "黃崗梁" },
  },
  1159104167: {
    id: "zagros",
    name: "札格羅斯山脈",
    en: "Zagros Mountains",
    continent: "亞洲",
    formation: "阿拉伯板塊撞上歐亞板塊擠出的褶皺帶，波斯灣的油田就埋在它的前緣",
    peak: { en: "Zard Kuh", name: "扎爾德山" },
  },
  1730073425: {
    id: "elburz",
    name: "厄爾布爾士山脈",
    en: "Elburz Mountains",
    continent: "亞洲",
    formation: "裏海南岸的火山山脈，擋下裏海的水氣，南側就是伊朗高原的乾燥內陸",
    peak: { en: "Mount Damavand", name: "達馬萬德峰" },
  },
  1159103077: {
    id: "taurus",
    name: "托魯斯山脈",
    en: "Taurus Mountains",
    continent: "亞洲",
    formation: "安納托利亞半島南緣的褶曲山脈，把地中海岸與內陸高原分開",
    peak: { en: "Demirkazik", name: "代米爾卡澤克峰" },
  },
  1159103915: {
    id: "western-ghats",
    name: "西高止山脈",
    en: "Western Ghats",
    continent: "亞洲",
    formation: "印度半島西緣的斷崖，夏季西南季風在迎風坡降下大量地形雨，背風的德干高原則相對乾燥",
    peak: { en: "Anai Mudi", name: "阿奈穆迪山" },
  },
  1730073913: {
    id: "annamite",
    name: "安南山脈",
    en: "Annamite Range",
    continent: "亞洲",
    formation: "中南半島東側的脊梁，是越南與寮國的天然界線",
    peak: { en: "Phou Bia", name: "普比亞山" },
  },
  1159103035: {
    id: "barisan",
    name: "巴里桑山脈",
    en: "Barisan Mountains",
    continent: "亞洲",
    formation: "蘇門答臘西側的火山山脈，正對著印澳板塊隱沒進歐亞板塊的海溝",
    peak: { en: "Gunung Kerinci", name: "克林奇火山" },
  },

  // ── 歐洲 ──────────────────────────────────────────────────────────────
  1159104297: {
    id: "alps",
    name: "阿爾卑斯山脈",
    en: "Alps",
    continent: "歐洲",
    formation: "非洲板塊北移撞上歐亞板塊抬升的年輕褶曲山脈，冰河地形發育完整",
    peak: { en: "Mont Blanc", name: "白朗峰" },
  },
  1159103941: {
    id: "pyrenees",
    name: "庇里牛斯山脈",
    en: "Pyrenees",
    continent: "歐洲",
    formation: "伊比利半島與歐洲大陸之間的褶曲山脈，也是法國與西班牙的國界",
    peak: { en: "Pico de Aneto", name: "阿內托峰" },
  },
  1159103937: {
    id: "carpathians",
    name: "喀爾巴阡山脈",
    en: "Carpathian Mountains",
    continent: "歐洲",
    formation: "阿爾卑斯山系向東延伸的弧形山脈，圈住中歐的匈牙利平原",
    peak: { en: "Gerlach", name: "蓋爾拉赫峰" },
  },
  1159103939: {
    id: "apennines",
    name: "亞平寧山脈",
    en: "Apennines",
    continent: "歐洲",
    formation: "縱貫義大利半島的脊梁，與阿爾卑斯同屬非洲與歐亞板塊擠壓的產物",
    peak: { en: "Corno Grande", name: "大科爾諾峰" },
  },
  1159103935: {
    id: "scandinavian",
    name: "斯堪地那維亞山脈",
    en: "Scandinavian Mountains",
    continent: "歐洲",
    formation: "古生代碰撞形成的老褶曲山地，第四紀冰河把西側刨蝕出挪威的峽灣",
    peak: { en: "Galdhpiggen", name: "加爾赫峰" },
  },
  1159104305: {
    id: "caucasus",
    name: "高加索山脈",
    en: "Caucasus Mountains",
    continent: "歐洲",
    formation: "阿拉伯板塊北推擠出的山脈，也是課本畫的歐亞洲界的一段",
    peak: { en: "Gora Elbrus", name: "厄爾布魯士山" },
  },
  1159104301: {
    id: "urals",
    name: "烏拉山脈",
    en: "Ural Mountains",
    continent: "歐洲",
    formation: "古生代的老褶曲山地，久經侵蝕而低緩；課本以它當歐亞兩洲的界線",
    peak: { en: "Gora Narodnaya", name: "納羅德納亞山" },
  },

  // ── 非洲 ──────────────────────────────────────────────────────────────
  1159104189: {
    id: "atlas",
    name: "阿特拉斯山脈",
    en: "Atlas Mountains",
    continent: "非洲",
    formation: "非洲板塊與歐亞板塊擠壓的南翼，把地中海型氣候的北非海岸與撒哈拉隔開",
    peak: { en: "Jebel Toubkal", name: "圖卜卡勒峰" },
  },
  1159104165: {
    id: "ethiopian-highlands",
    name: "衣索比亞高原",
    en: "Ethiopian Highlands",
    continent: "非洲",
    formation: "熔岩層層堆疊成的高原，東非大裂谷從中穿過，青尼羅河發源於此",
    peak: { en: "Ras Dejen", name: "拉斯達善峰" },
  },
  1159103881: {
    id: "drakensberg",
    name: "德拉肯斯山脈",
    en: "Drakensberg",
    continent: "非洲",
    formation: "南非高原的東緣崖，迎風坡承接印度洋的水氣，背風的內陸則轉為乾燥",
    peak: { en: "Thabana Ntlenyana", name: "塔巴納恩特列尼亞納峰" },
  },

  // ── 北美洲 ────────────────────────────────────────────────────────────
  1159104311: {
    id: "rockies",
    name: "洛磯山脈",
    en: "Rocky Mountains",
    continent: "北美洲",
    formation: "太平洋的板塊隱沒到北美板塊之下抬升出的年輕褶曲山脈，也是北美的大分水嶺",
    peak: { en: "Mount Elbert", name: "埃爾伯特峰" },
  },
  1159104191: {
    id: "appalachians",
    name: "阿帕拉契山脈",
    en: "Appalachian Mountains",
    continent: "北美洲",
    formation: "古生代大陸碰撞形成的老褶曲山地，久經侵蝕而平緩，山間蘊藏豐富煤礦",
    peak: { en: "Mount Mitchell", name: "米契爾峰" },
  },
  1159104197: {
    id: "coast-mountains",
    name: "海岸山脈",
    en: "Coast Mountains",
    continent: "北美洲",
    formation: "北美西岸的年輕山脈，冰河切割出卑詩省一帶的峽灣海岸",
    peak: { en: "Mount Waddington", name: "沃丁頓山" },
  },
  1159104199: {
    id: "cascades",
    name: "喀斯開山脈",
    en: "Cascade Range",
    continent: "北美洲",
    formation: "胡安·德富卡板塊隱沒帶上的火山鏈，聖海倫火山 1980 年的噴發就在這條山脈上",
    peak: { en: "Mount Rainier", name: "雷尼爾火山" },
  },
  1159103951: {
    id: "sierra-nevada",
    name: "內華達山脈",
    en: "Sierra Nevada",
    continent: "北美洲",
    formation: "花崗岩構成的斷塊山，東側落在雨影帶裡，就是乾燥的大盆地",
    peak: { en: "Mount Whitney", name: "惠特尼峰" },
  },
  1159104201: {
    id: "alaska-range",
    name: "阿拉斯加山脈",
    en: "Alaska Range",
    continent: "北美洲",
    formation: "太平洋板塊隱沒帶上的弧形山脈，北美洲最高峰在此",
    peak: { en: "Denali", name: "迪納利山" },
  },
  1159103949: {
    id: "sierra-madre-oriental",
    name: "東馬德雷山脈",
    en: "Sierra Madre Oriental",
    continent: "北美洲",
    formation: "墨西哥高原的東緣，擋住墨西哥灣吹來的水氣",
    peak: { en: "Cerro San Rafael", name: "聖拉斐爾山" },
  },
  1159103953: {
    id: "sierra-madre-occidental",
    name: "西馬德雷山脈",
    en: "Sierra Madre Occidental",
    continent: "北美洲",
    formation: "墨西哥高原的西緣，火山岩層被河流切出深邃的銅峽谷",
    peak: { en: "Cerro Mohinora", name: "莫伊諾拉山" },
  },

  // ── 南美洲 ────────────────────────────────────────────────────────────
  1159104309: {
    id: "andes",
    name: "安地斯山脈",
    en: "Andes",
    continent: "南美洲",
    formation: "納茲卡板塊隱沒到南美板塊之下抬升出的世界最長山脈，西側的阿他加馬沙漠就在它的雨影裡",
    peak: { en: "Cerro Aconcagua", name: "阿空加瓜山" },
  },

  // ── 大洋洲 ────────────────────────────────────────────────────────────
  1159104295: {
    id: "great-dividing-range",
    name: "大分水嶺",
    en: "Great Dividing Range",
    continent: "大洋洲",
    formation: "澳洲東岸的古老山地，分開東流入海與西流內陸的水系，也把濕潤的東岸與乾燥的內陸隔開",
    peak: { en: "Mount Kosciuszko", name: "科修斯科山" },
  },
  1159104623: {
    id: "southern-alps",
    name: "南阿爾卑斯山脈",
    en: "Southern Alps",
    continent: "大洋洲",
    formation: "太平洋板塊與印澳板塊沿阿爾卑斯斷層錯動擠壓抬升，西側是紐西蘭最多雨的地方",
    peak: { en: "Aoraki (Mount Cook)", name: "庫克山" },
  },
  1730072617: {
    id: "new-guinea-highlands",
    name: "新幾內亞高地",
    en: "New Guinea Highlands",
    continent: "大洋洲",
    formation: "印澳板塊與太平洋板塊碰撞抬升，赤道附近少見的高山冰河曾經出現在這裡",
    peak: { en: "Puncak Jaya", name: "查亞峰" },
  },

  // ── 南極洲 ────────────────────────────────────────────────────────────
  1159104505: {
    id: "transantarctic",
    name: "橫貫南極山脈",
    en: "Transantarctic Mountains",
    continent: "南極洲",
    formation: "把南極洲分成東西兩塊的巨大山脈，冰層之上只露出山頂",
    peak: { en: "Mount Kirkpatrick", name: "柯克帕特里克山" },
  },
};

/**
 * ⚠️ 上游的高度已經過時、以各國現行公告值取代的少數幾筆（key 是 NE 的 `name`）。
 *
 * 只收「差距大到會被學生指出來」的：庫克山 1991 年山頂崩落之後重新測得 3,724
 * 公尺，NE 仍是崩落前的 3,754。聖母峰 8,848 → 8,848.86 這種小數位差異不列
 * （本層一律以公尺整數呈現）。
 */
const ELEVATION_OVERRIDES = {
  "Aoraki (Mount Cook)": 3724,
};

/** 山峰高度的顯示字串。 */
export function formatElevation(m) {
  return `${m.toLocaleString("en-US")} 公尺`;
}

/**
 * 兩份 geojson 只下載一次（`world-mountains` 與 `world-mountain-peaks` 是同一個
 * process 裡的兩個資料集，而主峰的歸屬需要山脈那一份）。比照 lib/koppen.mjs。
 */
let cache = null;
export async function fetchMountainData(fetchWithRetry) {
  if (cache) return cache;
  const [regions, peaks] = await Promise.all([
    fetchWithRetry(REGIONS_URL).then((r) => r.json()),
    fetchWithRetry(PEAKS_URL).then((r) => r.json()),
  ]);

  /** NE_ID → 那條山脈的所有多邊形（上游把橫貫南極山脈拆成兩筆，共用同一個 id）。 */
  const polygonsById = new Map();
  for (const f of regions.features) {
    if (f.properties?.FEATURECLA !== "Range/mtn") continue;
    const meta = RANGES[f.properties.NE_ID];
    if (!meta) continue;
    const parts =
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const entry = polygonsById.get(f.properties.NE_ID) ?? [];
    entry.push(...parts);
    polygonsById.set(f.properties.NE_ID, entry);
  }
  const missing = Object.keys(RANGES).filter((id) => !polygonsById.has(Number(id)));
  if (missing.length) {
    throw new Error(
      `RANGES 有 ${missing.length} 筆在上游找不到（NE_ID ${missing.join("、")}）——` +
        "Natural Earth 可能改版了，請重新確認那幾條的 NE_ID",
    );
  }

  /** NE 的高程點裡 `featurecla === "mountain"` 的部分，依原名索引。 */
  const peaksByName = new Map();
  for (const f of peaks.features) {
    if (f.properties?.featurecla !== "mountain") continue;
    if (!f.properties.elevation) continue;
    // 同名的山峰真的存在（奧林匹斯山有四座），但本層指名的都不是同名的那些；
    // 撞名時保留第一筆並在建置期把情況印出來即可。
    if (!peaksByName.has(f.properties.name)) peaksByName.set(f.properties.name, f);
  }
  const noPeak = Object.values(RANGES).filter((r) => !peaksByName.has(r.peak.en));
  if (noPeak.length) {
    throw new Error(
      `RANGES 指名的主峰在上游的高程點裡找不到：${noPeak.map((r) => `${r.name}／${r.peak.en}`).join("、")}`,
    );
  }

  cache = { polygonsById, peaksByName };
  return cache;
}

/** 取出某條山脈的主峰（座標與高度來自上游，中文名來自 `RANGES`）。 */
export function peakOf(meta, peaksByName) {
  const f = peaksByName.get(meta.peak.en);
  return {
    coordinates: f.geometry.coordinates,
    elevation: ELEVATION_OVERRIDES[meta.peak.en] ?? f.properties.elevation,
    en: f.properties.name,
    name: meta.peak.name,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * 中軸線
 * ──────────────────────────────────────────────────────────────────────── */

/** 8 鄰域。 */
const N8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * 把一塊（或一組）多邊形化成中軸線。
 *
 * 做法是把面**點陣化**之後在網格上找路：
 *   1. 掃描線填滿內部（even-odd，所以內環＝洞會自動被扣掉）。
 *   2. 兩趟 chamfer 距離變換，算出每一格離邊界多遠。
 *   3. 對每個連通分量做兩次 BFS（double sweep）找出圖上距離最遠的兩格＝兩端。
 *   4. Dijkstra 從一端走到另一端，成本＝步長 ×（離邊界越近越貴），路徑因此
 *      貼著中軸走而不是抄捷徑貼著邊。
 *   5. 移動平均去掉網格造成的階梯，之後才交給 Douglas–Peucker。
 *
 * ⚠️ **經緯度要先做 cos(緯度) 校正**再進網格，否則高緯度的山脈（烏拉、布魯克斯）
 * 在網格上會被縱向拉長，中軸線會偏。校正只影響格子的形狀，輸出仍是經緯度。
 *
 * ⚠️ 面積太小的分量會被丟掉（安地斯在上游是 11 塊，其中 10 塊是外海與山腳的碎塊）。
 * 留下來的每一塊各出一條線，所以回傳的是 `MultiLineString` 的座標陣列。
 *
 * @param {Array} polygons 一組多邊形（每個是 [外環, 內環…]）
 * @param {{cellsAcross?: number, minPartRatio?: number, smooth?: number}} [opts]
 */
export function polygonAxis(polygons, { cellsAcross = 220, minPartRatio = 0.06, smooth = 5 } = {}) {
  const rings = polygons.flat();
  const all = rings.flat();
  const lat0 = (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2;
  // 極區（橫貫南極山脈的緯度到 -85）不能讓比例爆掉，所以壓一個下限
  const kx = Math.max(Math.cos((lat0 * Math.PI) / 180), 0.15);

  const grid = rings.map((r) => r.map(([lng, lat]) => [lng * kx, lat]));
  const pts = grid.flat();
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const cell = Math.max(0.01, Math.min(0.25, Math.max(maxX - minX, maxY - minY) / cellsAcross));
  const W = Math.max(3, Math.ceil((maxX - minX) / cell) + 2);
  const H = Math.max(3, Math.ceil((maxY - minY) / cell) + 2);
  const ox = minX - cell / 2;
  const oy = minY - cell / 2;

  // 1. 掃描線填滿
  const inside = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const y = oy + (j + 0.5) * cell;
    const xs = [];
    for (const r of grid) {
      for (let i = 0; i + 1 < r.length; i++) {
        const [x1, y1] = r[i];
        const [x2, y2] = r[i + 1];
        if (y1 > y === y2 > y) continue;
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - ox) / cell - 0.5));
      const i1 = Math.min(W - 1, Math.floor((xs[k + 1] - ox) / cell - 0.5));
      for (let i = i0; i <= i1; i++) inside[j * W + i] = 1;
    }
  }

  // 2. 到邊界的距離（chamfer 3-4，來回三趟就收斂）
  const D = new Float64Array(W * H);
  for (let c = 0; c < W * H; c++) D[c] = inside[c] ? 1e9 : 0;
  const order = [...Array(W * H).keys()];
  const sweep = (seq) => {
    for (const c of seq) {
      if (!inside[c]) continue;
      const ci = c % W;
      const cj = (c - ci) / W;
      let best = D[c];
      for (const [dx, dy] of N8) {
        const w = dx && dy ? 4 : 3;
        const ni = ci + dx;
        const nj = cj + dy;
        // 出界視為外部，距離 0
        best = Math.min(best, ni < 0 || nj < 0 || ni >= W || nj >= H ? w : D[nj * W + ni] + w);
      }
      D[c] = best;
    }
  };
  sweep(order);
  sweep(order.slice().reverse());
  sweep(order);

  // 3. 連通分量
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let s = 0; s < W * H; s++) {
    if (!inside[s] || comp[s] >= 0) continue;
    const cells = [];
    comp[s] = comps.length;
    const stack = [s];
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const ci = c % W;
      const cj = (c - ci) / W;
      for (const [dx, dy] of N8) {
        const ni = ci + dx;
        const nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (inside[n] && comp[n] < 0) {
          comp[n] = comps.length;
          stack.push(n);
        }
      }
    }
    comps.push(cells);
  }
  if (comps.length === 0) throw new Error("多邊形點陣化之後一格都沒有，cellsAcross 可能太小");

  const biggest = Math.max(...comps.map((c) => c.length));
  const lines = [];
  for (const cells of comps) {
    if (cells.length < Math.max(12, biggest * minPartRatio)) continue;
    const path = axisOfComponent(cells);
    if (path.length < 2) continue;
    lines.push(toLngLat(smoothPath(path.map(toXY), smooth)));
  }
  // 最長的排前面，這樣 `properties` 對得上的永遠是主脈
  lines.sort((a, b) => b.length - a.length);
  return lines;

  function toXY(c) {
    const ci = c % W;
    const cj = (c - ci) / W;
    return [ox + (ci + 0.5) * cell, oy + (cj + 0.5) * cell];
  }
  function toLngLat(path) {
    return path.map(([x, y]) => [x / kx, y]);
  }

  /** 從 `start` 出發，回傳圖上距離最遠的那一格。 */
  function bfsFar(start, allowed) {
    const seen = new Set([start]);
    let frontier = [start];
    let far = start;
    while (frontier.length) {
      const next = [];
      for (const c of frontier) {
        const ci = c % W;
        const cj = (c - ci) / W;
        for (const [dx, dy] of N8) {
          const ni = ci + dx;
          const nj = cj + dy;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const n = nj * W + ni;
          if (!allowed.has(n) || seen.has(n)) continue;
          seen.add(n);
          next.push(n);
          far = n;
        }
      }
      frontier = next;
    }
    return far;
  }

  function axisOfComponent(cells) {
    const set = new Set(cells);
    const a = bfsFar(bfsFar(cells[0], set), set);
    const b = bfsFar(a, set);
    const dmax = Math.max(...cells.map((c) => D[c]));
    const cost = new Map([[a, 0]]);
    const prev = new Map();
    // 分量最多幾萬格，用排序的陣列當優先佇列就夠快（實測 39 條全部 1 秒內）
    const queue = [[0, a]];
    while (queue.length) {
      queue.sort((x, y) => x[0] - y[0]);
      const [cu, u] = queue.shift();
      if (cu > (cost.get(u) ?? Infinity)) continue;
      if (u === b) break;
      const ui = u % W;
      const uj = (u - ui) / W;
      for (const [dx, dy] of N8) {
        const ni = ui + dx;
        const nj = uj + dy;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (!set.has(n)) continue;
        // 離邊界越近越貴：9 是實測值，再小路徑會貼著邊切彎，再大會在寬處繞遠路
        const penalty = 1 + 9 * (1 - D[n] / dmax) ** 2;
        const nc = cu + (dx && dy ? Math.SQRT2 : 1) * penalty;
        if (nc < (cost.get(n) ?? Infinity)) {
          cost.set(n, nc);
          prev.set(n, u);
          queue.push([nc, n]);
        }
      }
    }
    const path = [];
    for (let c = b; c !== undefined; c = prev.get(c)) {
      path.push(c);
      if (c === a) break;
    }
    return path.reverse();
  }
}

/**
 * 移動平均，把網格造成的鋸齒磨掉。
 *
 * ⚠️ 這一步不能省：Douglas–Peucker 只會**刪點**，階梯狀的轉角剛好是它認定
 * 「不能刪」的那種點，所以不先平滑的話，簡化完仍然是一條鋸齒線，而且點數還降不下來。
 * 端點固定不動（山脈的兩端就該落在面的兩端）。
 */
function smoothPath(path, window) {
  if (path.length <= 2 || window < 2) return path;
  const half = Math.floor(window / 2);
  return path.map((p, i) => {
    if (i === 0 || i === path.length - 1) return p;
    const lo = Math.max(0, i - half);
    const hi = Math.min(path.length - 1, i + half);
    let x = 0;
    let y = 0;
    for (let k = lo; k <= hi; k++) {
      x += path[k][0];
      y += path[k][1];
    }
    return [x / (hi - lo + 1), y / (hi - lo + 1)];
  });
}
