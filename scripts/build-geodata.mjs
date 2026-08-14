#!/usr/bin/env node
/**
 * 由公開資料集產生主題圖層用的 GeoJSON。
 *
 * 為什麼在建置階段做：比照 build-climate.mjs / build-species.mjs 的既有作法。
 * 上游檔案動輒數十 MB，執行期不可能讓學生的瀏覽器去抓；本腳本只在開發機上跑，
 * 產物 commit 進 repo，**CI 永遠不會執行它**。
 *
 * 產出：public/data/geo/<id>.geojson（由本腳本管理，請勿手動編輯）
 *       手繪的教學示意幾何放 public/data/geo-manual/，本腳本永遠不碰那個目錄。
 *
 * 用法：
 *   npm run build:geodata                  # 已存在的跳過
 *   npm run build:geodata -- --force       # 全部重抓
 *   npm run build:geodata -- --only=quakes # 只處理一個資料集
 */
import { writeFile, mkdir, access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./lib/fetch-retry.mjs";
import { simplifyGeometry, slugify } from "./lib/simplify.mjs";
import { parseNlscGml, ringArea } from "./lib/gml.mjs";
import { parseReservoirKml, ringsCentroid } from "./lib/kml.mjs";
import { readZip, readZipText } from "./lib/unzip.mjs";
import {
  parseShpPolygons,
  parseDbf,
  readShapefileZip,
  ringsToPolygons,
} from "./lib/shp.mjs";
import { TM2_TAIWAN, tm2ToWgs84 } from "./lib/twd97.mjs";
import {
  LICENSE as OSM_LICENSE,
  SOURCE_LABEL as OSM_SOURCE_LABEL,
  OVERPASS_ENDPOINTS,
  fetchRouteLines,
  fetchWaterwaysByRef,
  stitchWays,
  totalLengthKm,
} from "./lib/overpass.mjs";
import {
  LICENSE as PROTECTED_LICENSE,
  fetchProtectedAreas,
} from "./lib/protected-areas.mjs";
import {
  CROP_ITEMS,
  DATASET_ID as CROP_DATASET_ID,
  LICENSE as CROP_LICENSE,
  SOURCE_LABEL as CROP_SOURCE_LABEL,
  aggregate as aggregateCrops,
  fetchCrops,
  formatArea,
  townKey,
} from "./lib/crops.mjs";
import {
  DATASET_ID as MONUMENT_DATASET_ID,
  LEVELS as MONUMENT_LEVELS,
  LICENSE as MONUMENT_LICENSE,
  SOURCE_LABEL as MONUMENT_SOURCE_LABEL,
  fetchMonuments,
  historyShards,
  monumentFeature,
} from "./lib/monuments.mjs";
import {
  CWA_URL as DISASTER_URL,
  LICENSE as DISASTER_LICENSE,
  fetchDisasterQuakes,
} from "./lib/quakes-major.mjs";
import {
  CLASS_NOTE as FAULT_CLASS_NOTE,
  LICENSE as FAULT_LICENSE,
  SOURCE_LABEL as FAULT_SOURCE_LABEL,
  SOURCE_PAGE as FAULT_SOURCE_PAGE,
  SHORT_NAMES as FAULT_SHORT_NAMES,
  fetchFaults,
} from "./lib/faults.mjs";
import {
  DATASET_ID as POPULATION_DATASET_ID,
  LEVEL_ORDER as POPULATION_LEVEL_ORDER,
  LICENSE as POPULATION_LICENSE,
  SOURCE_LABEL as POPULATION_SOURCE_LABEL,
  adminLevel,
  fetchPopulation,
  formatPopulation,
} from "./lib/population.mjs";
import {
  EXTENT_KML_URL,
  LICENSE as WRA_LICENSE,
  RESERVOIR_IDS,
  SOURCE_LABEL as WRA_SOURCE_LABEL,
  fetchReservoirBasics,
  formatCapacity,
} from "./lib/reservoirs.mjs";
import { BASIN_URL, BASIN_IDS, RIVERS, RIVER_CATEGORY_ORDER } from "./lib/rivers.mjs";

const exists = (p) => access(p).then(() => true).catch(() => false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public/data/geo");
/** 古蹟歷史沿革的縣市分片（點開詳情卡才抓，見 lib/monuments.mjs 的檔頭）。 */
const MONUMENT_DIR = join(ROOT, "public/data/monuments");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

/**
 * 大小預算。
 *
 * 真正的限制不是 GitHub Pages（1 GB 站台／單檔 100 MB），而是**一個班 30 個學生
 * 同時用學校 wifi 開站**。超過硬上限就讓腳本失敗而不是只印警告——上游資料集
 * 變動時，payload 不能悄悄地膨脹。
 */
const SOFT_LIMIT = 500 * 1024;
const HARD_LIMIT = 1024 * 1024;

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/**
 * 政府資料開放平臺的資料集 metadata API（免金鑰、回 JSON）。
 * 7442 =「直轄市、縣市界線(TWD97經緯度)」，發布機關是內政部國土測繪中心——
 * 跟本站底圖用的 NLSC WMTS 同一個來源。
 */
const DATA_GOV_TW_DATASET = (id) => `https://data.gov.tw/api/v2/rest/dataset/${id}`;

/**
 * 縣市中文名 → ISO 3166-2:TW 代碼的 id。
 *
 * 為什麼是寫死的對照表而不是 slugify：NLSC 的 GML **只有「名稱」一個屬性**，沒有
 * COUNTYCODE（那在 SHP 版才有）。而這些 id 是內容檔的檔名（src/content/geo/
 * tw-counties/<id>.json）與圖徵強調用的 key，必須跨資料源改版保持穩定——原本從
 * Natural Earth 的 iso_3166_2 產生的就是這一組，換資料源不能讓它們全部變號。
 *
 * 對不到就讓建置失敗（見 transform）：縣市改名／新增是重大行政變更，應該由人來
 * 決定新 id，而不是靜默地生出一個沒有內容檔對應的新代碼。
 */
const COUNTY_IDS = {
  臺北市: "tw-tpe",
  新北市: "tw-tpq",
  桃園市: "tw-tao",
  臺中市: "tw-txg",
  臺南市: "tw-tnn",
  高雄市: "tw-khh",
  基隆市: "tw-kee",
  新竹市: "tw-hsz",
  嘉義市: "tw-cyi",
  新竹縣: "tw-hsq",
  苗栗縣: "tw-mia",
  彰化縣: "tw-cha",
  南投縣: "tw-nan",
  雲林縣: "tw-yun",
  嘉義縣: "tw-cyq",
  屏東縣: "tw-pif",
  宜蘭縣: "tw-ila",
  花蓮縣: "tw-hua",
  臺東縣: "tw-ttt",
  澎湖縣: "tw-pen",
  金門縣: "tw-kin",
  連江縣: "tw-lie",
};

/**
 * 離島的面積下限（度²）。
 *
 * NLSC 是實測界線，把每一塊礁岩都收了進來——澎湖 296 個、連江 183 個、金門 43 個
 * polygon，光是這些就佔掉檔案的六成，而它們在這個圖層可見的縮放範圍（maxzoom 11）
 * 全都小於一個像素。1e-5 度² ≈ 0.11 km²，實測留下澎湖 21、連江 11、金門 7 個島，
 * 課本會提到的東引（4.4 km²）、七美（7.4 km²）、小琉球（6.9 km²）都在門檻之上。
 *
 * ⚠️ Douglas–Peucker 不會刪掉整個環（環少於 4 點就還原成原始環），所以這個過濾
 * **必須在簡化之前**做，不能指望容差幫忙。
 */
const MIN_ISLAND_AREA = 1e-5;

/**
 * 交通軸線裡一段折線的最短長度（公里）。比照 `MIN_ISLAND_AREA` 的既有作法。
 *
 * 臺鐵的路線關聯除了正線之外，還收了車站股道、渡線與短連絡線，串完會剩下一批
 * 短到只有幾百公尺、甚至不到 10 公尺的碎線。這些東西在這個圖層可見的縮放尺度下
 * 全是一個點，卻各自是一條合法的 LineString，會讓沿線標註在同一個地方重複冒出來。
 *
 * ⚠️ 這裡不寫死「串完有幾條」：Overpass 各鏡像站的 replication 快照不同步，同一天
 * 抓兩次拿到的 way 數就可能差十幾條（實測西部幹線 1006 與 1017 都出現過），
 * 條數本來就會浮動。要核對的是**公里數**對不對得上官方數字，不是條數。
 *
 * ⚠️ 這個過濾**必須在簡化之前**做，理由跟礁岩那條一樣：Douglas–Peucker 不會刪掉
 * 整條線，指望容差幫忙是沒有用的。
 *
 * 門檻取 2 公里而不是更高：成追線（3.4 公里）這種確實屬於幹線的短連絡線要留著。
 */
const MIN_AXIS_SEGMENT_KM = 2;

/**
 * 離島縣。清單排序時整組排在本島各縣市之後。
 *
 * 純粹依緯度排的話，連江縣（26.2°N）會跳到基隆市前面、金門縣會插在苗栗與臺中之間——
 * 但它們跟本島根本不相鄰，夾在中間只會讓「由北到南」這條線索斷掉。離島自己內部
 * 仍然由北到南（連江 → 金門 → 澎湖）。
 */
const OFFSHORE_COUNTIES = new Set(["連江縣", "金門縣", "澎湖縣"]);

/**
 * 圖徵主體（面積最大那一塊）的形心緯度，用來決定清單的南北順序。
 *
 * 用形心而不是最北端：高雄市一路往北延伸到那瑪夏（23.47°N），比臺南市的最北端還北，
 * 依最北端排會排出「高雄在臺南前面」這種一看就錯的順序。
 *
 * 用面形心（shoelace）而不是頂點平均：海岸線曲折的地方頂點特別密，頂點平均會被拉過去。
 * （實測這份資料兩種算法排出來的順序相同，選面形心只是不想依賴那個巧合。）
 */
/**
 * 單一環的形心緯度。`mainPartCentroidLatitude` 的內圈，另外抽出來給鄉鎮界用——
 * 它要的是「整個縣市的面積加權形心」，不是「最大那一塊的形心」（見該處說明）。
 */
function ringCentroidLatitude(ring) {
  let area2 = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area2 += cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  return area2 ? cy / (3 * area2) : 0;
}

function mainPartCentroidLatitude(polygons) {
  const outer = polygons.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best))[0];
  let area2 = 0;
  let cy = 0;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const cross = outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1];
    area2 += cross;
    cy += (outer[j][1] + outer[i][1]) * cross;
  }
  return cy / (3 * area2);
}

/**
 * 世界主要河流的中文名對照。
 *
 * Natural Earth 的 50m 河流資料**完全沒有中文名欄位**（只有 name / name_en /
 * name_alt），所以中文名只能自己對照。這裡只收課綱會提到的大河；對不到的
 * 就沿用原名，不會壞掉。
 *
 * 同一條河在 NE 裡常被切成多段、各段用當地語言命名（長江上游叫 Jinsha／
 * Tongtian／Tuotuo，尼羅河分成 Victoria Nile／Albert Nile／El Bahr el Abyad），
 * 所以這裡把各段都指到學生認得的那個名字。
 */
const RIVER_NAMES_ZH = {
  Amazonas: "亞馬遜河",
  Ucayali: "亞馬遜河（烏卡亞利段）",
  Nile: "尼羅河",
  "Victoria Nile": "尼羅河（維多利亞段）",
  "Albert Nile": "尼羅河（艾伯特段）",
  "El Bahr el Abyad": "白尼羅河",
  "Bahr el Jebel": "尼羅河（傑貝勒段）",
  Kagera: "卡蓋拉河",
  "Damietta Branch": "尼羅河三角洲（杜姆亞特分流）",
  "Rosetta Branch": "尼羅河三角洲（羅塞塔分流）",
  Yangtze: "長江",
  "Chang Jiang": "長江",
  Jinsha: "金沙江",
  Tongtian: "通天河",
  Tuotuo: "沱沱河",
  // ⚠️ NE 把黃河的 name 寫成 "Huang"（不是 "Huang He"），漏掉這個 key
  // 就會讓課本上最常提到的大河之一顯示成英文
  Huang: "黃河",
  "Huang He": "黃河",
  "Heilong Jiang": "黑龍江",
  Abay: "青尼羅河",
  "El Bahr el Azraq": "青尼羅河",
  Yukon: "育空河",
  Orinoco: "奧里諾科河",
  Columbia: "哥倫比亞河",
  Ohio: "俄亥俄河",
  Madeira: "馬德拉河",
  Kasai: "開賽河",
  Ubangi: "烏班吉河",
  "Shatt al Arab": "阿拉伯河",
  "Al Furat": "幼發拉底河",
  Firat: "幼發拉底河",
  Congo: "剛果河",
  Lualaba: "剛果河（盧阿拉巴段）",
  Mississippi: "密西西比河",
  Missouri: "密蘇里河",
  Ganges: "恆河",
  Brahmaputra: "布拉馬普特拉河",
  Yarlung: "雅魯藏布江",
  Indus: "印度河",
  Mekong: "湄公河",
  Lancang: "瀾滄江",
  Danube: "多瑙河",
  Donau: "多瑙河",
  Volga: "伏爾加河",
  Niger: "尼日河",
  Zambezi: "尚比西河",
  Amur: "黑龍江（阿穆爾河）",
  Lena: "勒拿河",
  Ob: "鄂畢河",
  Irtysh: "額爾濟斯河",
  Yenisey: "葉尼塞河",
  Angara: "安加拉河",
  Mackenzie: "馬更些河",
  "St. Lawrence": "聖羅倫斯河",
  Paraná: "巴拉那河",
  Murray: "墨累河",
  Darling: "達令河",
  Euphrates: "幼發拉底河",
  Tigris: "底格里斯河",
  Rhine: "萊茵河",
  Rhein: "萊茵河",
  Seine: "塞納河",
  Ayeyarwady: "伊洛瓦底江",
  Irrawaddy: "伊洛瓦底江",
};

/**
 * 主要交通軸線。每一筆是**一條教學上會整條講的軸線**，不是一個 OSM 關聯。
 *
 * 幾條臺鐵幹線在 OSM 裡是依「線名」拆開的（縱貫線、臺中線、海岸線、屏東線各自
 * 一個關聯），但課本講的是「西部幹線」這一整條；所以這裡用 `parts` 把它們併成
 * 一個圖徵，串接交給 `stitchWays()`。
 *
 * ⚠️ **每個選擇器都刻意只取單一方向**（北向／北上／順行）。OSM 把上下行分成兩個
 * 關聯，兩個都抓會在圖上畫出相距數十公尺的雙線——在教學會用的縮放尺度下那只是
 * 一條變粗、邊緣毛躁的線，還讓檔案大一倍。選錯方向不影響教學（走廊位置相同），
 * 但**必須固定一個**，否則每次重抓的產物都不一樣。
 *
 * `shortName` 是沿線標註用的短名，`name` 是詳情卡與清單用的全名。分開是必要的：
 * 「國道一號（中山高速公路）」這種長字串在彎曲的線上會被放置演算法整個拒絕，
 * 標註數直接變 0（見 CLAUDE.md「沿線標註很脆弱」）。
 */
const TRANSPORT_AXES = [
  {
    id: "thsr",
    name: "臺灣高速鐵路",
    shortName: "高鐵",
    meta: "南港—左營・西部走廊",
    parts: ['relation["route"="railway"]["network"="台灣高鐵"]["name"~"北向"]'],
  },
  {
    id: "freeway-1",
    name: "國道一號（中山高速公路）",
    shortName: "國道1",
    meta: "基隆—高雄・臺灣第一條高速公路",
    parts: ['relation["route"="road"]["network"="TW:freeway"]["ref"="1"]["name"~"北向"]'],
  },
  {
    id: "freeway-3",
    name: "國道三號（福爾摩沙高速公路）",
    shortName: "國道3",
    meta: "基隆—林邊・沿西部丘陵臺地",
    parts: ['relation["route"="road"]["network"="TW:freeway"]["ref"="3"]["name"~"北上"]'],
  },
  {
    id: "freeway-5",
    name: "國道五號（蔣渭水高速公路）",
    shortName: "國道5",
    meta: "南港—蘇澳・雪山隧道穿越雪山山脈",
    parts: ['relation["route"="road"]["network"="TW:freeway"]["ref"="5"]["name"~"北向"]'],
  },
  {
    id: "tra-west",
    name: "臺鐵西部幹線",
    shortName: "西部幹線",
    meta: "基隆—枋寮・縱貫線＋山線＋海線＋屏東線",
    parts: [
      'relation["route"="railway"]["name"="縱貫線(北上)"]',
      'relation["route"="railway"]["name"="臺中線"]',
      'relation["route"="railway"]["name"="海岸線"]',
      'relation["route"="railway"]["name"="屏東線"]',
    ],
  },
  {
    id: "tra-east",
    name: "臺鐵東部幹線",
    shortName: "東部幹線",
    meta: "八堵—臺東・宜蘭線＋北迴線＋臺東線",
    parts: [
      'relation["route"="railway"]["name"="宜蘭線 (順行)"]',
      'relation["route"="railway"]["name"="北迴線 (順行)"]',
      'relation["route"="railway"]["name"="臺東線"]',
    ],
  },
  {
    id: "tra-south-link",
    name: "臺鐵南迴線",
    shortName: "南迴線",
    meta: "枋寮—臺東・唯一連接西部與東部的鐵路",
    parts: ['relation["route"="railway"]["name"="南迴線"]'],
  },
];

const SOURCES = [
  {
    id: "tw-counties",
    label: "臺灣縣市界",
    /**
     * 資料源是內政部國土測繪中心，不是 Natural Earth。
     *
     * ⚠️ **不要改回 Natural Earth**：NE 10m 的 TWN 只有 **21** 個一級行政區，
     * 整份資料集裡都沒有連江縣（馬祖），而馬祖正是課本講「臺灣的離島」時一定會
     * 點名的地方。NLSC 這份是實測界線、22 個縣市齊全、中文名原生就是課綱用的
     * 「臺」字寫法，而且每半年更新。
     *
     * 代價是格式：政府資料開放平臺只提供 SHP 與 GML，沒有 GeoJSON。SHP 要 ogr2ogr
     * （得先裝 GDAL），所以走 GML——它是純文字 XML，用 lib/unzip.mjs + lib/gml.mjs
     * 兩個免依賴的小模組就能處理完。
     */
    resolveUrl: () => resolveDataGovTwUrl(7442, /GML/),
    license: "政府資料開放授權條款第 1 版",
    sourceLabel: "內政部國土測繪中心",
    // 下載回來的是 zip 包一個 12 MB 的 GML，不是 JSON
    parse: async (res) => {
      const buf = Buffer.from(await res.arrayBuffer());
      return parseNlscGml(readZipText(buf, (name) => name.toLowerCase().endsWith(".gml")));
    },
    // 相鄰面各自簡化會在共用邊界開出次像素縫隙（見 lib/simplify.mjs），
    // 所以這個圖層在註冊表裡設了 maxzoom，讓它在縫隙可解析之前就停止繪製。
    //
    // 0.0008° ≈ 89 公尺，在圖層的 maxzoom 11 約 1.3 px、在實際教學會用的 zoom 7–10
    // 都是次像素。NLSC 原始資料有 33 萬個點，不簡化是 570 KB；這個容差落在 192 KB。
    tolerance: 0.0008,
    digits: 4,
    transform: (features) =>
      features
        .map((f) => {
          const name = f.properties.名稱;
          const id = COUNTY_IDS[name];
          if (!id) {
            throw new Error(`縣市「${name}」不在 COUNTY_IDS 對照表裡，請先決定它的 id`);
          }
          // 次像素的礁岩在簡化階段刪不掉，只能在這裡先濾（見 MIN_ISLAND_AREA）
          const coordinates = f.geometry.coordinates.filter(
            (polygon) => ringArea(polygon[0]) >= MIN_ISLAND_AREA,
          );
          return {
            type: "Feature",
            geometry: { type: "MultiPolygon", coordinates },
            properties: { id, name },
            // 排序用，不寫進產物
            _lat: mainPartCentroidLatitude(coordinates),
            _offshore: OFFSHORE_COUNTIES.has(name) ? 1 : 0,
          };
        })
        // ⚠️ **feature 的順序就是圖層抽屜裡可點清單的顯示順序**（LayerBrowseList
        // 直接照 data.features 算繪）。上游 GML 的順序是任意的，排成由北到南、
        // 離島最後，清單才跟課本講臺灣的方式一致。
        .sort((a, b) => a._offshore - b._offshore || b._lat - a._lat)
        .map(({ _lat, _offshore, ...feature }) => feature),
  },

  {
    id: "tw-townships",
    label: "臺灣鄉鎮市區界",
    /**
     * 同一個發布單位、同一套實測界線，只是下一個行政層級（縣市界是資料集 7442）。
     *
     * ⚠️ **這一份只有 SHP，沒有 GML**——縣市界當初選 GML 是因為「SHP 要 ogr2ogr」，
     * 但那是在 `lib/shp.mjs` 出現之前。現在直接用 `readShapefileZip()`（國家公園
     * 與保護區在用的同一支），而且這份的 `.prj` 是 `GEOGCS["GCS_TWD97[2020]"…]`
     * ——**是地理坐標（度）不是 TM2**，所以 `parsePrj()` 回 null、不需要投影轉換。
     */
    resolveUrl: () => resolveDataGovTwUrl(7441, /SHP/),
    license: "政府資料開放授權條款第 1 版",
    sourceLabel: "內政部國土測繪中心",
    /**
     * ⚠️ **zip 裡有兩份 shapefile**：要的是 `TOWN_MOI_<日期>.shp`（18 MB），另一份
     * `Town_Majia_Sanhe.shp`（45 KB）是屏東瑪家鄉三和的特例圖。不指定 `pick` 的話
     * `readShapefileZip()` 會因為「符合條件的 .shp 不等於 1」直接丟例外——這跟墾丁
     * 那個「主要計畫圖 vs 細部計畫圖」是同一類陷阱，只是這次擋得住。
     */
    parse: async (res) =>
      readShapefileZip(Buffer.from(await res.arrayBuffer()), (name) =>
        /^TOWN_MOI_/i.test(name),
      ),
    /**
     * 0.0012° ≈ 133 公尺。比縣市界那個 0.0008 粗，是**量體逼出來的**：368 個相鄰
     * 多邊形、115 萬個頂點，簡化到後面會進入高原（實測 0.0008 是 677 KB、0.0012 是
     * 509 KB，再放寬也降不了多少）。
     *
     * ⚠️ 產出約 **509 KB，會印「超過建議值 500 KB」的提醒——那是預期的，不是錯誤**。
     * 硬上限 1 MB 還有一倍餘裕。要壓到 500 KB 以下只能犧牲鄉鎮數或讓形狀失真，
     * 兩個都比多那 9 KB 糟。
     */
    tolerance: 0.0012,
    digits: 4,
    transform: ({ features }) => {
      /** 縣市的代表緯度，用來把整個縣市的鄉鎮一起排到正確的南北位置。 */
      const countyPolygons = new Map();
      const rows = features.map((f) => {
        const p = f.properties;
        // 次像素的礁岩在簡化階段刪不掉，只能先濾（理由與判準同 tw-counties）。
        // 實測濾掉之後 polygon 從 1034 降到 417，而 368 個鄉鎮一個都沒有消失。
        const coordinates = ringsToPolygons(f.rings).filter(
          (polygon) => Math.abs(ringArea(polygon[0])) >= MIN_ISLAND_AREA,
        );
        if (!countyPolygons.has(p.COUNTYNAME)) countyPolygons.set(p.COUNTYNAME, []);
        countyPolygons.get(p.COUNTYNAME).push(...coordinates);
        return {
          type: "Feature",
          geometry: { type: "MultiPolygon", coordinates },
          properties: {
            // ⚠️ id 用官方的 TOWNCODE，**不能用名稱 slugify**：鄉鎮名不唯一，
            // 實測有 8 個重複名（中正區、信義區、中山區、東區…）散在不同縣市。
            // 人口與作物兩層也**共用這個 id**（見 CLAUDE.md「三層共用 id」），
            // 所以它現在同時是三層共用詳情卡的 join key。
            id: `tw-${p.TOWNCODE}`,
            name: p.TOWNNAME,
            county: p.COUNTYNAME,
            /**
             * 行政層級（區／縣轄市／鎮／鄉），從鄉鎮名末字判斷，不需要額外資料源。
             * 三層合併成一筆搜尋結果之後，活下來的是這一層那一筆，副標要講得出
             * 「這是什麼」才有用（見 searchIndex.ts 的合併規則）。
             */
            level: adminLevel(p.TOWNNAME),
            /** 英文名進搜尋索引當別名（上游原生就有，不必自己拼） */
            en: p.TOWNENG,
            /** 清單次標。同名鄉鎮唯一能分辨的線索就是縣市 */
            meta: `${p.COUNTYNAME}・${adminLevel(p.TOWNNAME)}`,
          },
          _county: p.COUNTYNAME,
          _code: p.TOWNCODE,
        };
      });

      // ⚠️ feature 順序＝圖層抽屜可點清單的順序（LayerBrowseList 不排序）。
      // 上游 SHP 的順序是任意的（實測第一筆是臺東縣成功鎮），排成跟縣市界一致的
      // 「由北到南、離島整組最後」，同縣市內再依官方代碼，清單才讀得下去。
      //
      // ⚠️ 縣市的代表緯度要用**面積加權形心**，不能沿用縣市界那支
      // `mainPartCentroidLatitude`（它取「最大的那一塊」）。理由是這裡的輸入是
      // 鄉鎮而不是整個縣市：取最大塊會變成「取這個縣市面積最大的那個鄉鎮」，
      // 於是桃園市被代表成復興區（山區、偏南）、臺北市被代表成士林區，實測會把
      // 基隆↔臺北、桃園↔新竹市、彰化↔花蓮、臺南↔高雄四對的順序排反。
      // 面積加權之後實測與 tw-counties.geojson 的縣市順序**逐字相同**——
      // 兩個行政區圖層的清單順序不一致是會被看出來的。
      const countyLat = new Map(
        [...countyPolygons].map(([name, polygons]) => {
          let area = 0;
          let weighted = 0;
          for (const polygon of polygons) {
            const a = Math.abs(ringArea(polygon[0]));
            area += a;
            weighted += a * ringCentroidLatitude(polygon[0]);
          }
          return [name, area ? weighted / area : 0];
        }),
      );
      return rows
        .sort(
          (a, b) =>
            (OFFSHORE_COUNTIES.has(a._county) ? 1 : 0) -
              (OFFSHORE_COUNTIES.has(b._county) ? 1 : 0) ||
            countyLat.get(b._county) - countyLat.get(a._county) ||
            a._code.localeCompare(b._code),
        )
        .map(({ _county, _code, ...feature }) => feature);
    },
  },
  {
    id: "world-rivers",
    label: "世界主要河流",
    // 50m 是世界尺度主題的正確比例尺；10m 的臺灣河川覆蓋太薄，
    // 所以「臺灣主要河川」在註冊表裡維持 planned，不能拿這份資料充數。
    url: `${NE}/ne_50m_rivers_lake_centerlines.geojson`,
    license: "Natural Earth（public domain）",
    sourceLabel: "Natural Earth",
    tolerance: 0.01,
    digits: 3,
    // scalerank <= 3（116 條）而不是 <= 2（62 條）：實測 <= 2 會漏掉黃河、恆河、
    // 伏爾加河、尼日河、印度河——全都是課綱會點名的大河，漏掉就不能叫「世界主要河流」。
    transform: (raw) =>
      raw.features
        .filter((f) => f.properties.scalerank <= 3 && f.properties.name)
        .map((f, i) => ({
          type: "Feature",
          geometry: f.geometry,
          properties: {
            id: `${slugify(f.properties.name)}-${i}`,
            // NE 沒有中文名欄位，對不到就沿用原名
            name: RIVER_NAMES_ZH[f.properties.name] ?? f.properties.name,
          },
        })),
  },
  {
    id: "tw-reservoirs",
    label: "臺灣主要水庫",
    /**
     * 位置來自「水庫蓄水範圍」KML，屬性來自「水庫基本資料」CSV——**兩份都要**，
     * 因為它們各缺一半：基本資料有容量、壩高、集水面積，就是沒有座標；KML 有幾何，
     * 屬性卻只有一個中文名。
     *
     * 產出的是**點**不是面。蓄水範圍的原始幾何是 38 MB 的狹長樹枝狀多邊形，而這一層
     * 在教學上會用的 zoom（8–12）下，多數水庫小於幾個像素——簡化到能塞進大小預算時
     * 形狀早就沒了。點配上「依容量縮放的半徑」反而在每個 zoom 都讀得出來。
     */
    url: EXTENT_KML_URL,
    license: WRA_LICENSE,
    sourceLabel: WRA_SOURCE_LABEL,
    /**
     * 收錄範圍是**「水庫基本資料」的 40 座公告水庫**，不是「今天查得到即時水情的
     * 那幾座」。這件事踩過一次：以水情當篩選條件時產出 33 筆，白河、虎頭埤、谷關
     * 這些課本會提到的水庫剛好當天沒有回報就整座消失了——而一份 commit 進 repo 的
     * 靜態檔案，內容不該取決於產生它的那一小時上游剛好回了什麼。
     *
     * 沒有即時水情的水庫照樣有壩型、容量、集水面積可以教；水情缺漏由前端顯示成
     * 「暫無即時資料」（見 components/ReservoirCard.tsx），不是把整座水庫藏起來。
     */
    parse: async (res) => ({
      placemarks: parseReservoirKml(await res.text()),
      basics: await fetchReservoirBasics(fetchWithRetry),
    }),
    // 點不需要簡化；5 位小數 ≈ 1 公尺，形心本來就沒有更高的精度可言
    tolerance: 0,
    digits: 5,
    transform: ({ placemarks, basics }) => {
      const byName = new Map(placemarks.map((p) => [p.name, p]));
      const features = [];
      /** 配不到幾何的水庫。靜默跳過會讓「少了一座」永遠沒有人發現。 */
      const skipped = [];
      for (const [code, b] of basics) {
        const id = RESERVOIR_IDS[b.name];
        if (!id) {
          throw new Error(`水庫「${b.name}」不在 RESERVOIR_IDS 對照表裡，請先決定它的 id`);
        }
        const placemark = byName.get(b.name);
        const centroid = placemark && ringsCentroid(placemark.rings);
        if (!centroid) {
          skipped.push(b.name);
          continue;
        }
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: centroid },
          properties: {
            id,
            name: b.name,
            // 即時水情靠這個代碼 join（見 registry/resolve.ts 的 tw-reservoirs）
            code,
            capacity: b.effectiveCapacity_10k_m3,
            /** 給人看的容量字串。格式化只做一次，前端不必重寫一份同樣的邏輯。 */
            capacityLabel: formatCapacity(b.effectiveCapacity_10k_m3),
            damType: b.damType,
            damHeight_m: b.damHeight_m,
            catchment_ha: b.catchment_ha,
            surface_ha: b.surface_ha,
            river: b.river,
            town: b.town,
            authority: b.authority,
            purpose: b.purpose,
            meta: `${b.town}・有效容量 ${formatCapacity(b.effectiveCapacity_10k_m3)}`,
          },
        });
      }
      if (skipped.length) {
        console.warn(`\n  ⚠ 有水情但蓄水範圍 KML 裡找不到幾何：${skipped.join("、")}`);
      }
      // ⚠️ feature 順序就是圖層抽屜裡可點清單的順序（LayerBrowseList 不排序）。
      // 依有效容量由大到小，清單開頭就是曾文、翡翠、石門這些課本會點名的水庫。
      return features.sort((a, b) => b.properties.capacity - a.properties.capacity);
    },
  },
  {
    id: "tw-protected-areas",
    label: "臺灣國家公園與保護區",
    /**
     * 四個資料集拼起來（十座國家公園 + 自然保留區 + 陸域野生動物保護區 +
     * 自然保護區），取得與合併的細節全部關在 lib/protected-areas.mjs 裡。
     * 所以這一筆用 `load` 自己抓，不走 `url` + `parse` 那條單一來源的路。
     */
    load: (fetchWithRetry) => fetchProtectedAreas(fetchWithRetry),
    sourceUrl: [
      "https://data.gov.tw/dataset/174421",
      "https://data.gov.tw/dataset/9933",
      "https://data.gov.tw/dataset/25540",
      "https://data.gov.tw/dataset/24914",
    ],
    license: PROTECTED_LICENSE,
    sourceLabel: "內政部國家公園署、農業部林業及自然保育署",
    /**
     * 0.0003° ≈ 33 公尺。比縣市界那個 0.0008 細，因為這一層**沒有設 maxzoom**：
     * 保護區彼此不相鄰，沒有「相鄰面各自簡化會開出縫隙」的問題，所以可以一直
     * 放大看。33 公尺在 zoom 13 約 1.4 px，在教學會用的 zoom 7–12 都是次像素。
     */
    tolerance: 0.0003,
    digits: 5,
    transform: (raw) => raw.features,
  },
  {
    id: "tw-transport",
    label: "臺灣主要交通軸線",
    /**
     * 唯一走 OpenStreetMap 的圖層。為什麼別無選擇（NE 的臺灣道路沒有名字、
     * TDX 要 API key、手繪對精確且公開的線位不誠實）寫在 lib/overpass.mjs 開頭。
     */
    url: OVERPASS_ENDPOINTS[0],
    license: OSM_LICENSE,
    sourceLabel: OSM_SOURCE_LABEL,
    /**
     * 走 `load` 而不是 `url` + `parse`：Overpass 要 POST 查詢語句，而且一條軸線
     * 可能由多個關聯併起來（西部幹線是四個），本來就不是「下載一個檔案」。
     */
    load: async () => {
      const axes = [];
      for (const axis of TRANSPORT_AXES) {
        const lines = [];
        for (const selector of axis.parts) {
          const part = await fetchRouteLines(selector);
          lines.push(...part.lines);
        }
        // 串接必須在簡化之前：DP 永遠保留每條線的頭尾，對著幾百條碎線做簡化
        // 幾乎砍不掉東西，沿線標註也放不出來（見 lib/overpass.mjs 的說明）
        const stitched = stitchWays(lines);
        // 車站股道與渡線在這個尺度下只是一個點，卻會各自吃掉一個沿線標註
        const kept = stitched.filter((line) => totalLengthKm([line]) >= MIN_AXIS_SEGMENT_KM);
        if (kept.length === 0) {
          throw new Error(`${axis.name}：串接後沒有任何長度足夠的折線，選擇器可能選錯了`);
        }
        console.log(
          `\n  ${axis.name}：${lines.length} 段 → 串成 ${stitched.length} 條、` +
            `留下 ${kept.length} 條／約 ${totalLengthKm(kept).toFixed(0)} 公里`,
        );
        axes.push({ ...axis, lines: kept });
      }
      return axes;
    },
    // 0.0005° ≈ 55 公尺。交通軸線是「走廊位置」的教學圖層，不是導航圖資；
    // 這個容差在圖層可見的每個縮放尺度下都是次像素，卻能把點數砍掉九成。
    tolerance: 0.0005,
    digits: 4,
    // ⚠️ feature 順序＝圖層抽屜可點清單的順序（LayerBrowseList 不排序）。
    // 依「高鐵 → 國道 → 台鐵」排，跟課本介紹西部走廊的順序一致。
    transform: (axes) =>
      axes.map(({ id, name, shortName, meta, lines }) => ({
        type: "Feature",
        geometry: { type: "MultiLineString", coordinates: lines },
        properties: { id, name, shortName, meta },
      })),
  },
  {
    id: "tw-rivers",
    label: "臺灣河川",
    /**
     * **經濟部公告的全部 118 個列管水系**的幹流河道（中央管 24＋跨省市 2＋
     * 直轄市管 27＋縣(市)管 65，清單見 lib/rivers.mjs 的 `RIVERS`），來自
     * OpenStreetMap 的 `waterway=river` 關聯（第二個走 OSM 的圖層，另一個是
     * tw-transport）。
     *
     * 為什麼不是官方資料、也不再是手繪：水利署的 RIVERLIN SHP 依「名稱字串」分筆，
     * 上游改稱其他名稱的河段會變成另一筆記錄（11 條河只涵蓋官方長度的 10–50%）；
     * OSM 的關聯依**實際河川**建立，改名的上游河段以 `main_stream` 角色收在同一個
     * 關聯裡，這正是 RIVERLIN 做不到的事。選取用 `ref`（水利署河川代碼）避開同名
     * 不同河，四條長度偏短的河川為什麼不補接上游，全部寫在 lib/rivers.mjs 的
     * `RIVER_OSM_REFS`。
     */
    url: OVERPASS_ENDPOINTS[0],
    license: OSM_LICENSE,
    sourceLabel: OSM_SOURCE_LABEL,
    // 跟 tw-transport 同樣走 load：Overpass 要 POST 查詢語句，不是下載一個檔案
    load: async () => {
      const rivers = [];
      const warnings = [];
      // 分批一次問 30 個代碼，不是一條發一次查詢——118 次要跑 40 分鐘，而且
      // Overpass 有公平使用規範。「每個 ref 必須剛好選中一個關聯」那道防線在
      // `fetchWaterwaysByRef` 裡逐個 ref 檢查（那是 92 條沒有官方長度可比對的
      // 河川**唯一**的防線，不要放寬）。
      // 只取 main_stream：side_stream 是支流，一起抓會畫成整個水系而不是幹流。
      const byRef = await fetchWaterwaysByRef(
        Object.values(RIVERS).map((r) => r.ref),
        { role: "main_stream" },
      );

      for (const [officialName, river] of Object.entries(RIVERS)) {
        const { lines } = byRef.get(river.ref);
        // 串接必須在簡化之前（見 lib/overpass.mjs）：沿線標註是逐一 LineString
        // 放置的，幾十段碎線放不出標註，DP 也砍不掉東西
        const stitched = stitchWays(lines);
        if (stitched.length === 0) {
          throw new Error(`${officialName}（ref=${river.ref}）：關聯裡沒有 main_stream 角色的 way`);
        }
        const km = totalLengthKm(stitched);

        // 只有 26 條中央管／跨省市河川有官方長度可以核對。其餘 92 條的界點由地方
        // 政府各自公告、沒有全國一致的長度表，所以這裡只把量到的公里數印出來當
        // 眼睛可以掃過去的合理性線索，不做門檻判斷、也不寫進產物。
        if (river.length_km == null) {
          console.log(`\n  ${officialName}：${stitched.length} 條／${km.toFixed(1)} km（無官方長度）`);
          rivers.push({ officialName, river, lines: stitched });
          continue;
        }

        const deviation = (km - river.length_km) / river.length_km;
        // 差一個量級＝選到同名的小溪流或抓成整個水系，那是要當場失敗的錯誤；
        // 上游未數化造成的偏短（實測最多 -50%）只印提醒，理由見 RIVER_OSM_REFS
        if (Math.abs(deviation) > 0.6) {
          throw new Error(
            `${officialName}（ref=${river.ref}）：實測 ${km.toFixed(1)} km 與官方 ` +
              `${river.length_km} km 相差 ${(deviation * 100).toFixed(0)}%，選擇器可能選錯河`,
          );
        }
        const flag = Math.abs(deviation) > 0.15 ? "⚠ " : "";
        const note =
          `${flag}${officialName}：${stitched.length} 條／${km.toFixed(1)} km` +
          `（官方 ${river.length_km}，${deviation > 0 ? "+" : ""}${(deviation * 100).toFixed(0)}%）`;
        if (flag) warnings.push(note);
        else console.log(`\n  ${note}`);
        rivers.push({ officialName, river, lines: stitched });
      }
      return { rivers, warnings };
    },
    // 0.0005° ≈ 55 公尺，跟 tw-transport 同一個量級：這是「河川大致怎麼流」的
    // 教學圖層，不是水利工程圖資
    tolerance: 0.0005,
    digits: 4,
    transform: ({ rivers }) =>
      rivers
        .map(({ officialName, river, lines }) => ({
          type: "Feature",
          // 上游未數化的河段會讓幹流斷成兩截，所以一律 MultiLineString
          geometry: { type: "MultiLineString", coordinates: lines },
          properties: {
            id: river.id,
            // `name` 一律用公告名稱（這一層的收錄範圍就是那份公告）。地圖與路牌上
            // 常見的另一個寫法放進 `meta`，見下。
            name: officialName,
            // 只有 26 條中央管／跨省市河川有官方數字，其餘留 undefined ——
            // JSON.stringify 會整個省掉那個 key，不會寫出 null
            length_km: river.length_km,
            area_km2: river.area_km2,
            // 可點清單的分組依據（browse.groupBy），也是詳情卡上的公告等級
            category: river.category,
            // 支流才有：母水系的中文名，卡片與清單都靠它說明「這條河屬於誰」
            parent: river.parent,
            /**
             * 清單副標、搜尋副標與（沒有內容檔時）詳情卡的次標。
             *
             * ⚠️ **`meta` 是 `searchIndex` 唯一會收進 haystack 的額外欄位**，所以
             * 凡是「使用者可能拿來搜的別名」都得塞進這裡，少一個就等於那個詞搜不到，
             * 而畫面上沒有任何線索解釋為什麼。三種情況：
             *
             * - **有官方長度的 26 條**：顯示長度（這一層最有教學價值的數字）。其中
             *   5 條再加上「上游稱大漢溪」——OSM 的 main_stream 把上游改名的河段
             *   收在同一個關聯裡，所以淡水河那條線的上游走的就是大漢溪的河道。
             *   學生搜「大漢溪」會找到淡水河並飛過去，那是誠實的答案；把大漢溪
             *   另外畫一條會得到兩條完全重疊的線（見 lib/rivers.mjs 的 `upstream`）。
             * - **26 條支流**：顯示「常用別名・母水系水系」。
             * - **其餘 92 條**：顯示「常用別名・流經縣市」，讓 65 筆縣(市)管河川
             *   在清單裡分得出彼此。
             */
            meta:
              river.length_km != null
                ? `幹流長度 ${river.length_km} km` +
                  (river.upstream ? `・上游稱${river.upstream}` : "")
                : [river.alias, river.parent ? `${river.parent}水系` : river.counties.join("、")]
                    .filter(Boolean)
                    .join("・"),
            // FeatureCard 的 fallback 專用（118 條裡的 92 條與 26 條支流都沒有
            // 內容檔）：`meta` 已經被別名與縣市／母水系佔滿，等級改由這一行交代
            detail: river.length_km != null ? undefined : river.category,
          },
        }))
        /**
         * ⚠️ feature 順序就是圖層抽屜裡可點清單的順序（`LayerBrowseList` 不排序，
         * 而且 `groupBy` 是**依序切**的——同一個等級的河川必須連續，否則會被切成
         * 兩組）。所以先照 `RIVER_CATEGORY_ORDER` 分群，群內再排：
         *
         * - 有官方長度的（中央管、跨省市）**由長到短**，維持既有行為：清單開頭是
         *   濁水溪、高屏溪這些課本會點名的河川。
         * - 沒有官方長度的（直轄市管、縣市管）依**水利署河川代碼**，那是沿海岸
         *   逆時針編的，於是清單順序就是地理順序（新北由北海岸往西、屏東由西往東
         *   繞過恆春、臺東由南往北）。沒有長度可排的情況下，這比字典序有意義得多。
         */
        .sort((a, b) => {
          const ca = RIVER_CATEGORY_ORDER.indexOf(a.properties.category);
          const cb = RIVER_CATEGORY_ORDER.indexOf(b.properties.category);
          if (ca !== cb) return ca - cb;
          if (a.properties.length_km != null && b.properties.length_km != null) {
            return b.properties.length_km - a.properties.length_km;
          }
          return RIVERS[a.properties.name].ref.localeCompare(RIVERS[b.properties.name].ref);
        }),
  },
  {
    id: "tw-basins",
    label: "臺灣河川流域分區",
    /**
     * 跟 tw-rivers 共用 lib/rivers.mjs 的同一份 118 條官方清單，但**產物只有 72
     * 筆**：上游的 BASIN 圖資只給其中 72 個水系個別的流域代碼，其餘 46 條的集水區
     * 被歸在「沒有個別代碼的小水系」群組碼底下，沒辦法無歧義地拆出來。缺漏是預期
     * 中的資料範圍差異，transform 會把清單印出來（不是丟例外）。
     *
     * 幾何來源也完全不同：tw-rivers 的線來自 OSM 的河川關聯，這裡的面來自水利署
     * 的 SHP（BASIN）——集水區範圍需要真正的水文測繪，不是從一條線推得出來的。
     *
     * ⚠️ **join 用 `BASIN_NO`（＝河川代碼去掉末位），不是 `BASIN_NAME`。**
     * 上游名稱有錯字（`老梅j溪`）、異體字（`後州溪`／`通宵溪`／`安溯溪`）與同名
     * 不同河（`新港溪`），名稱比對會安靜地漏掉或接錯——理由與 RIVERLIN 報廢時
     * 完全相同，詳見 transform 裡的說明。實測 72 筆全部是**單一環（無孔洞）**。
     */
    url: BASIN_URL,
    license: WRA_LICENSE,
    sourceLabel: WRA_SOURCE_LABEL,
    parse: async (res) => {
      const buf = Buffer.from(await res.arrayBuffer());
      const entries = readZip(buf);
      const shpEntry = entries.find((e) => e.name.toLowerCase().endsWith(".shp"));
      const dbfEntry = entries.find((e) => e.name.toLowerCase().endsWith(".dbf"));
      if (!shpEntry || !dbfEntry) {
        throw new Error(`BASIN.zip 裡找不到 .shp／.dbf（內容：${entries.map((e) => e.name).join("、")}）`);
      }
      return {
        polygons: parseShpPolygons(shpEntry.read()),
        rows: parseDbf(dbfEntry.read()),
      };
    },
    // 0.0004° 跟 tw-rivers 同一個量級：流域邊界本身就是這個圖層唯一的內容
    tolerance: 0.0004,
    digits: 5,
    transform: ({ polygons, rows }) => {
      /**
       * ⚠️ **用 `BASIN_NO` join，不要用 `BASIN_NAME`。**
       *
       * `BASIN_NO` 就是水利署河川代碼**去掉末位**（官方 110000 → `1100`），所以
       * 它跟 `RIVERS` 的 `ref` 是同一個識別碼系統，join 完全沒有歧義。
       *
       * 名稱 join 會出事，而且是安靜地出事：
       * - 上游有錯字與異體字（`後州溪`／後洲溪、`通宵溪`／通霄溪、`安溯溪`／安朔溪、
       *   `水仙溪`／紅水仙溪、`老梅j溪` 那個 j 是真的印在資料裡的）——名稱比對會
       *   直接漏掉這幾條。
       * - **同名不同河**：BASIN 裡的 `新港溪` 到底是臺東成功鎮那條（224000）還是
       *   苗栗冷水坑溪的別名（133000），名稱看不出來。這正是 RIVERLIN 當初報廢的
       *   同一個坑（見 CLAUDE.md），不要再走一次。
       *
       * 一個 `BASIN_NO` 對到多筆時**一律跳過**：那是上游用來歸類「沒有個別代碼的
       * 小水系」的群組碼（實測 2803 底下有 5 條北海岸小溪），拿群組裡任一條當成
       * 某條官方河川的流域是猜的。
       */
      const byNo = new Map();
      rows.forEach((r, i) => {
        const key = String(r.BASIN_NO);
        byNo.set(key, [...(byNo.get(key) ?? []), i]);
      });

      const features = [];
      /**
       * 官方 118 個水系裡，BASIN 沒有發布個別流域面的那些。
       *
       * ⚠️ 這裡**不能像以前那樣丟例外**——以前清單只有 26 條中央管／跨省市河川，
       * 上游每一條都有面，缺一條就是真的出事；現在清單是 118 條，而上游本來就
       * 只給其中 72 條個別的流域代碼。缺漏是預期中的資料範圍差異，不是錯誤，
       * 所以改成印出來讓人看得到。
       */
      const missing = [];

      for (const [officialName, river] of Object.entries(RIVERS)) {
        // 支流沒有自己的流域面——集水區是依水系劃的，支流的集水區本來就包在
        // 母水系那一片裡。`BASIN_IDS` 也是這樣過濾的，兩邊要一致。
        if (!river.ref.endsWith("000")) continue;
        const id = BASIN_IDS[officialName];
        if (!id) {
          throw new Error(`河川「${officialName}」不在 BASIN_IDS 對照表裡，請先決定它的 id`);
        }

        const cand = byNo.get(river.ref.slice(0, 4)) ?? [];
        if (cand.length !== 1) {
          missing.push(officialName);
          continue;
        }
        const record = polygons[cand[0]];
        if (!record || record.parts.length === 0) {
          missing.push(officialName);
          continue;
        }
        if (record.parts.length !== 1) {
          // 實測 72 筆全部是單一環，多環代表上游改版，寧可失敗也不要猜哪個環是洞
          throw new Error(`「${officialName}」的流域是 ${record.parts.length} 環，需要人工確認外環／洞的判斷`);
        }

        // BASIN.prj 就是 TWD97 TM2 zone 121，參數與 TM2_TAIWAN 完全相同
        const ring = record.parts[0].map(([x, y]) => tm2ToWgs84(x, y, TM2_TAIWAN));
        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            id,
            name: officialName,
            // 只有 26 條中央管／跨省市河川有官方流域面積。
            // ⚠️ **不要拿上游 dbf 的 `AREA` 欄位補**：那是數化多邊形的面積，跟公告
            // 數字最大差 17.9%（鹽水溪 404.5 vs 343），兩者混在同一個欄位會讓
            // 讀者以為是同一種數字——比照河川長度不混用 OSM 量測值的同一條規則。
            area_km2: river.area_km2,
            category: river.category,
            meta:
              river.area_km2 != null
                ? `流域面積 ${river.area_km2} km²`
                : [river.alias, river.counties.join("、")].filter(Boolean).join("・"),
            detail: river.area_km2 != null ? undefined : river.category,
          },
        });
      }

      if (missing.length) {
        const systems = Object.values(RIVERS).filter((r) => r.ref.endsWith("000")).length;
        console.log(
          `\n  ⓘ 對到 ${features.length}／${systems} 個獨立水系，` +
            `以下 ${missing.length} 條上游沒有發布個別流域面：${missing.join("、")}`,
        );
      }
      /**
       * ⚠️ feature 順序就是可點清單的順序，而清單依 `category` 分組（`groupBy` 是
       * **依序切**的，同一等級必須連續）。規則與 tw-rivers 逐字相同：先照
       * `RIVER_CATEGORY_ORDER` 分群，有官方面積的群內由大到小（開頭是高屏溪、
       * 濁水溪），沒有的依河川代碼（＝沿海岸逆時針的地理順序）。
       */
      return features.sort((a, b) => {
        const ca = RIVER_CATEGORY_ORDER.indexOf(a.properties.category);
        const cb = RIVER_CATEGORY_ORDER.indexOf(b.properties.category);
        if (ca !== cb) return ca - cb;
        if (a.properties.area_km2 != null && b.properties.area_km2 != null) {
          return b.properties.area_km2 - a.properties.area_km2;
        }
        return RIVERS[a.properties.name].ref.localeCompare(RIVERS[b.properties.name].ref);
      });
    },
  },
  {
    id: "quakes",
    label: "全球地震帶",
    // 免金鑰、ACAO: *。單次上限 20000 筆；抓之前先打 /count 確認沒超過。
    //
    // 門檻選 M≥6.5、自 1960 年起（約 2800 筆／390 KB）是量出來的，不是隨手訂的：
    // M≥6.0 自 1975 年起是 7284 筆、1030 KB，直接撞上大小預算的硬上限。而且
    // 7000 個重疊的點在教室投影機上就是一坨糊的，較高的門檻配上較長的時間窗
    // （65 年，涵蓋 1960 智利、1964 阿拉斯加這類大事件）反而把板塊邊緣描得更清楚。
    url:
      "https://earthquake.usgs.gov/fdsnws/event/1/query" +
      "?format=geojson&minmagnitude=6.5&starttime=1960-01-01&orderby=time",
    countUrl:
      "https://earthquake.usgs.gov/fdsnws/event/1/count" +
      "?format=geojson&minmagnitude=6.5&starttime=1960-01-01",
    license: "USGS（public domain）",
    sourceLabel: "USGS",
    // 點位不需要簡化，只取位：2 位小數 ≈ 1.1 公里，在這個圖層可見的每個 zoom
    // 都是次像素，光取位就能把檔案砍掉一半。
    tolerance: 0,
    digits: 2,
    transform: (raw) =>
      raw.features
        .filter((f) => f.geometry?.type === "Point" && f.properties.mag != null)
        .map((f) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: f.geometry.coordinates.slice(0, 2) },
          properties: {
            id: slugify(f.id),
            mag: Math.round(f.properties.mag * 10) / 10,
            depth_km: Math.round(f.geometry.coordinates[2] ?? 0),
            year: new Date(f.properties.time).getUTCFullYear(),
          },
        })),
  },

  /**
   * 古蹟三級各一筆。
   *
   * 三筆共用 `lib/monuments.mjs` 的 module-level 快取，所以上游那 8.1 MB 一個
   * process 只下載一次；但**產物是三個檔**，因為級別是三個各自可勾選的子圖層，
   * 只勾「國定古蹟」就只該付 45 KB（見該檔檔頭）。
   *
   * feature 順序＝指定年份由早到晚，讓最早公告的（赤嵌樓、淡水紅毛城那一批）
   * 排在前面；同年再依名稱，避免上游順序變動造成無意義的 diff。
   */
  /**
   * 三種作物各一筆。共用 `lib/crops.mjs` 的 module-level 快取，所以 22 個縣市的
   * 統計一個 process 只抓一輪；產物是三個小檔（各一兩百個鄉鎮的點）。
   */
  ...CROP_ITEMS.map((item) => ({
    id: `tw-crops-${item.id}`,
    label: `臺灣${item.label}分布`,
    load: async (fetchWithRetry) => {
      const { rows, warnings } = await fetchCrops(fetchWithRetry);
      return { rows, warnings, centroids: await townshipCentroids() };
    },
    sourceUrl: `https://data.gov.tw/dataset/${CROP_DATASET_ID}`,
    license: CROP_LICENSE,
    sourceLabel: CROP_SOURCE_LABEL,
    // 點不需要簡化；5 位小數 ≈ 1 公尺，形心本來就沒有更高的精度可言
    tolerance: 0,
    digits: 5,
    transform: ({ rows, centroids }) => {
      const byTown = aggregateCrops(rows, item);
      const features = [];
      /** 統計裡有、但鄉鎮界圖資對不到的鄉鎮。靜默跳過會讓少一塊沒人發現。 */
      const unmatched = [];
      for (const [key, { county, town, area, crops }] of byTown) {
        const town_ = centroids.get(key);
        if (!town_) {
          unmatched.push(`${county}${town}`);
          continue;
        }
        // 這個鄉鎮種最多的前三種，給詳情卡用
        const top = [...crops].sort((a, b) => b[1] - a[1]).slice(0, 3);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: town_.centroid },
          properties: {
            // ⚠️ 官方 TOWNCODE，跟鄉鎮界與人口層**共用**（見 CLAUDE.md「三層共用 id」）。
            // 三個作物子圖層因此各有一筆同 id 的 feature——instance 之內仍然唯一
            // （一個鄉鎮一種作物一筆），跨 instance 互撞正是這次要的。
            id: town_.id,
            name: town,
            county,
            crop: item.label,
            area_ha: Math.round(area * 10) / 10,
            areaLabel: formatArea(area),
            top: top.map(([n, a]) => `${n} ${formatArea(a)}`).join("、"),
            meta: `${county}・${item.label} ${formatArea(area)}`,
          },
        });
      }
      if (unmatched.length) {
        throw new Error(
          `這些鄉鎮在 tw-townships.geojson 裡找不到：${unmatched.join("、")}（可能是「台／臺」沒正規化）`,
        );
      }
      // ⚠️ feature 順序＝抽屜可點清單的順序。依面積由大到小，清單開頭就是這種
      // 作物最主要的產地——那正是這一層要回答的問題。
      return features.sort((a, b) => b.properties.area_ha - a.properties.area_ha);
    },
  })),

  ...Object.entries(MONUMENT_LEVELS).map(([levelName, { slug }]) => ({
    id: `tw-monuments-${slug}`,
    label: `臺灣${levelName}`,
    load: async (fetchWithRetry) => {
      const { records, warnings } = await fetchMonuments(
        fetchWithRetry,
        resolveDataGovTwUrl,
        COUNTY_IDS,
      );
      await writeMonumentShards(records);
      return { records: records.filter((r) => r.levelName === levelName), warnings };
    },
    sourceUrl: `https://data.gov.tw/dataset/${MONUMENT_DATASET_ID}`,
    license: MONUMENT_LICENSE,
    sourceLabel: MONUMENT_SOURCE_LABEL,
    // 點位不需要簡化。5 位小數 ≈ 1 公尺，上游本來就沒有比這更高的精度。
    tolerance: 0,
    digits: 5,
    transform: ({ records }) =>
      records
        .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name, "zh-Hant"))
        .map(monumentFeature),
  })),

  {
    id: "tw-population",
    label: "臺灣鄉鎮人口",
    load: async (fetchWithRetry) => {
      const { rows, warnings } = await fetchPopulation(fetchWithRetry, resolveDataGovTwUrl);
      return { rows, warnings, centroids: await townshipCentroids() };
    },
    sourceUrl: `https://data.gov.tw/dataset/${POPULATION_DATASET_ID}`,
    license: POPULATION_LICENSE,
    sourceLabel: POPULATION_SOURCE_LABEL,
    // 點不需要簡化；5 位小數 ≈ 1 公尺，形心本來就沒有更高的精度可言
    tolerance: 0,
    digits: 5,
    transform: ({ rows, centroids }) => {
      const features = [];
      /** 統計裡有、但鄉鎮界圖資對不到的鄉鎮。靜默跳過會讓少一塊沒人發現。 */
      const unmatched = [];
      for (const { county, town, pop, area, density } of rows) {
        const town_ = centroids.get(townKey(county, town));
        if (!town_) {
          unmatched.push(`${county}${town}`);
          continue;
        }
        const level = adminLevel(town);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: town_.centroid },
          properties: {
            // ⚠️ **用鄉鎮界那份的官方 TOWNCODE id，不是自己組一個。**
            // 鄉鎮／人口／作物三層講的是同一個實體，共用 id 才能共用同一張詳情卡、
            // 在搜尋裡合併成一筆、以及讓 highlightIds 連動強調（見 CLAUDE.md
            // 「三層共用 id」）。順帶也解掉「中正區、東區在 8 個縣市重複」那個
            // 不能用名稱 slugify 的老問題。
            id: town_.id,
            name: town,
            county,
            level,
            // 半徑用 sqrt(population) 內插、顏色用 density 分級——都要是**數字**。
            // TownshipCard 也直接讀這幾個數值自己排版，所以不再組 detail 字串。
            population: pop,
            density: Math.round(density),
            area_km2: Math.round(area * 100) / 100,
            meta: `${county}・${level}・${formatPopulation(pop)}`,
          },
        });
      }
      if (unmatched.length) {
        throw new Error(
          `這些鄉鎮在 tw-townships.geojson 裡找不到：${unmatched.join("、")}（可能是「台／臺」沒正規化）`,
        );
      }
      // ⚠️ feature 順序＝抽屜可點清單的順序，而 `browse.groupBy: "level"` 是
      // **依序切、不排序**的，所以同一個層級必須連續。層級之內再依人口由多到少
      // ——清單開頭就是全臺人口最多的鄉鎮，那正是「都市體系」要看的東西。
      return features.sort(
        (a, b) =>
          POPULATION_LEVEL_ORDER.indexOf(a.properties.level) -
            POPULATION_LEVEL_ORDER.indexOf(b.properties.level) ||
          b.properties.population - a.properties.population,
      );
    },
  },

  {
    id: "tw-faults",
    label: "臺灣活動斷層",
    load: async (fetchWithRetry) => fetchFaults(fetchWithRetry),
    sourceUrl: FAULT_SOURCE_PAGE,
    license: FAULT_LICENSE,
    sourceLabel: FAULT_SOURCE_LABEL,
    // 上游已經是 WGS84 的折線。0.0002° ≈ 22 公尺——斷層線位本來就有數化誤差，
    // 這個容差在教學會用的每個 zoom 都是次像素。
    tolerance: 0.0002,
    digits: 5,
    transform: ({ faults }) =>
      faults
        .map((f) => ({
          type: "Feature",
          geometry: { type: "MultiLineString", coordinates: f.lines },
          properties: {
            // ⚠️ 用 lib/faults.mjs 的人工對照表，**不是 slugify**：那支把中文全部
            // 剝掉，33 條斷層會得到 33 個空字串（實測踩過）
            id: `fault-${f.id}`,
            name: f.name,
            /**
             * 沿線標註用的短名（見註冊表的 `render.label`）。
             *
             * ⚠️ **不是排版偏好，是「標得出來」與「標不出來」的差別。** 實測 1440×663
             * 的畫布：用全名（4–9 個字）在全島視角只放得出 **3** 個標註，去掉尾綴的
             * 「斷層」兩個字之後是 **13** 個；zoom 8.5 的南部是 8 → 16。`symbol-placement:
             * line` 對字串長度極度敏感，而斷層線又短又彎。
             *
             * 這跟交通軸線用 `shortName`（「國道1」而不是「國道一號（中山高速公路）」）
             * 是同一條規則。全名仍然留在 `name` 上，清單、卡片與搜尋都用它。
             */
            shortName: FAULT_SHORT_NAMES[f.name] ?? f.name.replace(/斷層$/, ""),
            faultClass: f.faultClass,
            // 線寬用它驅動：第一類粗、第二類細（見註冊表的 render.width）
            classRank: f.faultClass === "第一類" ? 1 : 2,
            meta: `${f.faultClass}・${FAULT_CLASS_NOTE[f.faultClass]}`,
            detail: [...f.observe].join("、"),
          },
        }))
        // ⚠️ feature 順序＝可點清單的順序，而 browse.groupBy 是**依序切、不排序**的，
        // 所以第一類必須全部連續排在第二類前面。組內依名稱，避免上游順序變動造成
        // 無意義的 diff。
        .sort(
          (a, b) =>
            a.properties.classRank - b.properties.classRank ||
            a.properties.name.localeCompare(b.properties.name, "zh-Hant"),
        ),
  },

  {
    id: "tw-quakes",
    label: "臺灣地震",
    /**
     * 臺灣周邊 **M≥5.5**、1900 年以來（實測 612 筆）。
     *
     * ⚠️ 門檻從 5.0 拉到 5.5 是**顯示密度**的決定：1,341 個點在本島上疊成一片，
     * 連底圖的地形都看不見。5.5 之後剩 612 筆，島上還讀得出個別事件。
     * 這個門檻**只影響這一層**——「重大地震」有自己的 USGS 查詢，見下。
     *
     * ⚠️ **為什麼不用中央氣象署**：CWA 的地震開放資料要申請 API key，直接撞上
     * 硬性禁止事項 #1。USGS 免金鑰、public domain，而且站上「全球地震帶」用的
     * 就是同一個目錄，兩層的資料基礎一致。
     *
     * ⚠️ **USGS 對臺灣 1973 年以前的目錄並不完整**（實測每十年 8–67 筆，1970 年代
     * 之後跳到 140–190）。那個跳升是**目錄完整度**不是地震變多，圖層說明必須講。
     * 仍然收到 1900 年，是因為 1920 花蓮 M8.2、1935 新竹-臺中、1951 縱谷這些課本
     * 會點名的大地震都在那之前。
     */
    url:
      "https://earthquake.usgs.gov/fdsnws/event/1/query" +
      "?format=geojson&minmagnitude=5.5&starttime=1900-01-01&orderby=time" +
      "&minlatitude=21.0&maxlatitude=26.5&minlongitude=118.5&maxlongitude=123.5",
    countUrl:
      "https://earthquake.usgs.gov/fdsnws/event/1/count" +
      "?format=geojson&minmagnitude=5.5&starttime=1900-01-01" +
      "&minlatitude=21.0&maxlatitude=26.5&minlongitude=118.5&maxlongitude=123.5",
    license: "USGS（public domain）",
    sourceLabel: "USGS",
    // 比照全球地震帶：點位不簡化、只取位。2 位小數 ≈ 1.1 公里，在這一層看得到的
    // 每個 zoom 都是次像素。
    tolerance: 0,
    digits: 2,
    /**
     * ⚠️ **這一層的每個點就是一個震央**，properties 只留描述那個震央的東西：
     * 規模、震源深度、發生日期。USGS 還給了 `place`（英文地名字串）、`sig`、`tsunami`
     * 之類的欄位，一律不留——這是中文教學站，而且那些跟「震央在哪」無關。
     *
     * ⚠️ **給人看的字串一律由 `QuakeCard` 組，不要存進 geojson。** 試過把
     * `name`／`meta`／`detail` 三個字串寫進 properties（好讓 FeatureCard 的 fallback
     * 直接用），檔案從 190 KB 漲到 **400 KB**——那 210 KB 全是可以從 mag／depth／date
     * 重新算出來的重複資料，而這一層是一個班 30 個學生勾下去就要各付一份的東西。
     *
     * ⚠️ **震央與震源是兩件事**：震央（epicenter）是地面上的那個點，也就是這裡畫的
     * 位置；震源深度是它底下破裂起始點的深度。卡片上要分別寫清楚，不要混成「深度」。
     */
    transform: (raw) =>
      raw.features
        .filter((f) => f.geometry?.type === "Point" && f.properties.mag != null)
        .map((f) => {
          const mag = Math.round(f.properties.mag * 10) / 10;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: f.geometry.coordinates.slice(0, 2) },
            properties: {
              id: slugify(f.id),
              mag,
              /** 震源深度（公里）。⚠️ 那是震央**底下**破裂起始點的深度，不是震央本身。 */
              depth_km: Math.round(f.geometry.coordinates[2] ?? 0),
              /**
               * ⚠️ **一定要換算成臺灣時間（UTC+8）再取日期。**
               * USGS 的 `time` 是 UTC epoch，直接 `toISOString()` 會把 921 大地震
               * （1999-09-21 01:47 CST）印成 **1999-09-20**——那是學生一眼就會看出
               * 錯的日期，而且不會有任何錯誤訊息。同理 0403 花蓮地震（2024-04-03
               * 07:58 CST）UTC 是 04-02。
               */
              date: new Date(f.properties.time + 8 * 3600 * 1000).toISOString().slice(0, 10),
            },
          };
        }),
  },

  {
    id: "tw-quakes-major",
    label: "臺灣重大地震",
    /**
     * 中央氣象署〈災害地震〉表（1901–2022，139 筆）＋ 2023 年以後補錄的 11 筆。
     *
     * ⚠️ **不再跟 USGS 做任何比對。** 氣象署那份自己就帶官方經緯度、震源深度與
     * ML／Mw，早期那套「同一天、規模最接近」的啟發式比對整段拿掉了——那條路有把
     * 災情掛到錯的地震上的風險。
     *
     * ⚠️ **因此這一層的點跟「臺灣地震」不再重合**：兩層來自不同目錄，同一次地震
     * 的震央實測差 5–26 公里（2022 關山最大 25.9 km），也不再共用 id、不會連動
     * 強調。那是兩個目錄的真實差異，不是 bug——圖層說明有交代。
     */
    load: async (fetchWithRetry) => fetchDisasterQuakes(fetchWithRetry),
    sourceUrl: DISASTER_URL,
    license: DISASTER_LICENSE,
    sourceLabel: "交通部中央氣象署",
    tolerance: 0,
    digits: 3,
    transform: ({ quakes }) =>
      quakes
        .map((q) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [q.lng, q.lat] },
          properties: {
            // 官方沒有給每筆一個穩定編號（編號欄有 7 筆是空的），用日期＋座標組，
            // 同一天的多筆（0403 主震與餘震）也分得開
            id: `cwaq-${q.date}-${q.lat}-${q.lng}`,
            /**
             * ⚠️ 這個欄位必須叫 `name`：searchIndex 的 featureHits() 只認它，
             * 叫別的名字整層都搜不到而且不會報錯（見 CLAUDE.md）。
             * 官方表有 8 筆沒有名稱，用日期補一個，否則可點清單那一列會是空白。
             */
            name: q.name ?? `${q.date} 地震`,
            mag: q.magLocal,
            ...(q.magMoment != null &&
              q.magLocal != null &&
              Math.abs(q.magMoment - q.magLocal) >= 0.3 && { magMoment: q.magMoment }),
            ...(q.depthKm != null && { depth_km: q.depthKm }),
            date: q.date,
            ...(q.harm && { harm: q.harm }),
            // ⚠️ 混合來源，每一筆都要標得出來自哪裡
            source: q.source,
            meta: `${q.date}${q.magLocal != null ? `・規模 ${q.magLocal.toFixed(1)}` : ""}`,
          },
        }))
        // feature 順序＝可點清單的順序。由新到舊——學生想找的多半是近年那幾次。
        .sort((a, b) => b.properties.date.localeCompare(a.properties.date)),
  },
];

/**
 * 鄉鎮的形心與官方 id，給人口與作物兩層用：鄉鎮中文名（含縣市）→ `{ id, centroid }`。
 *
 * 幾何直接讀已經產好的 `tw-townships.geojson`，不重新剖析那份 12.8 MB 的 SHP。
 * 代價是**建置順序有相依**：要先有鄉鎮界才能建這兩層，所以檔案不在時要講清楚
 * 該跑哪一個指令，而不是丟一個 ENOENT。
 *
 * ⚠️ **`id` 也要一起帶出來**，那是「鄉鎮／人口／作物三層共用同一張詳情卡」的關鍵：
 * 三層的 featureId 都用官方 TOWNCODE，卡片、搜尋合併與連動強調才對得起來。
 * 詳見 CLAUDE.md「三層共用 id」那一節。
 */
let townCentroidsPromise = null;
function townshipCentroids() {
  townCentroidsPromise ??= (async () => {
    const path = join(OUT_DIR, "tw-townships.geojson");
    let fc;
    try {
      fc = JSON.parse(await readFile(path, "utf8"));
    } catch {
      throw new Error(
        "找不到 public/data/geo/tw-townships.geojson，人口與作物圖層的點位與 id 都靠它決定。" +
          "請先執行 npm run build:geodata -- --only=tw-townships",
      );
    }
    const byName = new Map();
    for (const f of fc.features) {
      const centroid = ringsCentroid(f.geometry.coordinates.flat());
      if (centroid) {
        byName.set(townKey(f.properties.county, f.properties.name), {
          id: f.properties.id,
          centroid,
        });
      }
    }
    return byName;
  })();
  return townCentroidsPromise;
}

/**
 * 歷史沿革的縣市分片，21 份（**臺東縣沒有古蹟**，見 lib/monuments.mjs）。
 *
 * 三筆古蹟 SOURCES 都會呼叫它，但只有第一次真的寫檔——分片的內容與級別無關，
 * 而且 `--only=tw-monuments-county` 單獨重跑時也必須產出，所以不能只掛在其中一筆上。
 */
let shardsWritten = false;
async function writeMonumentShards(records) {
  if (shardsWritten) return;
  shardsWritten = true;
  const shards = historyShards(records);
  await mkdir(MONUMENT_DIR, { recursive: true });
  let bytes = 0;
  for (const [countyId, entries] of shards) {
    const json = JSON.stringify(entries);
    bytes += Buffer.byteLength(json);
    await writeFile(join(MONUMENT_DIR, `${countyId}.json`), json);
  }
  console.log(`  歷史沿革分片：${shards.size} 個縣市／${(bytes / 1024).toFixed(0)} KB`);
}

/**
 * 從政府資料開放平臺查出某個資料集當下的下載網址。
 *
 * 為什麼不寫死網址：TGOS 的檔名帶著發布日期（`COUNTY_MOI_1140318_.zip`），每次改版
 * 都是一個新網址、舊的會消失。寫死等於把腳本綁在某一版資料上，半年後 `--force`
 * 重跑就 404。查 API 只多一次請求，換來的是「重跑就會拿到最新的界線」。
 */
async function resolveDataGovTwUrl(datasetId, descriptionPattern) {
  const meta = await (await fetchWithRetry(DATA_GOV_TW_DATASET(datasetId))).json();
  const distributions = meta?.result?.distribution ?? [];
  const match = distributions.filter((d) => descriptionPattern.test(d.resourceDescription ?? ""));
  if (match.length !== 1) {
    const listed = distributions.map((d) => d.resourceDescription).join("、") || "（空）";
    throw new Error(
      `資料集 ${datasetId} 符合 ${descriptionPattern} 的資源有 ${match.length} 個（現有：${listed}）`,
    );
  }
  return match[0].resourceDownloadUrl;
}

async function build(source) {
  const outPath = join(OUT_DIR, `${source.id}.geojson`);
  if (!FORCE && (await exists(outPath))) {
    console.log(`- ${source.id}：已存在，跳過（--force 可重抓）`);
    return true;
  }

  if (source.countUrl) {
    const count = await (await fetchWithRetry(source.countUrl)).json();
    console.log(`  ${source.id}：上游 ${count.count} 筆（單次上限 ${count.maxAllowed}）`);
    if (count.count > count.maxAllowed) {
      console.error(`✗ ${source.id}：超過單次上限，需要改成按時間分段抓取`);
      return false;
    }
  }

  process.stdout.write(`- ${source.id}：`);
  process.stdout.write("下載中…");
  // `load` 的資料源沒有單一下載網址：多來源的用 sourceUrl（見 tw-protected-areas），
  // 單一端點的仍然填 url（見 tw-transport 的 Overpass）。這個值只用來寫進產物的 metadata。
  let url = source.sourceUrl ?? source.url;
  let raw;
  if (source.load) {
    // 不是「下載一個檔案」的資料源自己負責取得（見 tw-transport 的 Overpass 查詢、
    // tw-protected-areas 的四個資料集）；順便把它想讓人知道的事情印出來
    raw = await source.load(fetchWithRetry);
    for (const warning of raw.warnings ?? []) console.log(`\n  · ${warning}`);
  } else {
    url = source.resolveUrl ? await source.resolveUrl() : source.url;
    const res = await fetchWithRetry(url);
    // 預設是 GeoJSON；需要先解壓／換格式的資料源自己提供 parse（見 tw-counties）
    raw = source.parse ? await source.parse(res) : await res.json();
  }
  process.stdout.write("轉換中…");

  const features = source
    .transform(raw)
    .map((f) => ({
      ...f,
      geometry: source.tolerance
        ? simplifyGeometry(f.geometry, source.tolerance, source.digits)
        : simplifyGeometry(f.geometry, 0, source.digits),
    }));

  if (features.length === 0) {
    console.error(`\n✗ ${source.id}：轉換後 0 筆，上游欄位可能變了`);
    return false;
  }

  const ids = features.map((f) => f.properties.id);
  if (new Set(ids).size !== ids.length) {
    console.error(`\n✗ ${source.id}：properties.id 有重複`);
    return false;
  }

  const out = {
    type: "FeatureCollection",
    // 出處與授權要能追溯（CLAUDE.md：每筆資料都要標來源），
    // 也讓 commit 進 repo 的 diff 自我解釋。
    metadata: {
      collection: source.id,
      source: url,
      license: source.license,
      generatedAt: new Date().toISOString(),
      ...(source.tolerance ? { simplifyTolerance: source.tolerance } : {}),
      featureCount: features.length,
    },
    features,
  };

  const json = JSON.stringify(out);
  const bytes = Buffer.byteLength(json);
  const kb = (bytes / 1024).toFixed(0);

  if (bytes > HARD_LIMIT) {
    console.error(
      `\n✗ ${source.id}：${kb} KB 超過硬上限 ${HARD_LIMIT / 1024} KB，請調高 tolerance 或縮小篩選範圍`,
    );
    return false;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(outPath, json);
  const warn = bytes > SOFT_LIMIT ? `（⚠ 超過建議值 ${SOFT_LIMIT / 1024} KB）` : "";
  console.log(`完成：${features.length} 筆／${kb} KB${warn}`);
  return true;
}

const targets = ONLY ? SOURCES.filter((s) => s.id === ONLY) : SOURCES;
if (targets.length === 0) {
  console.error(`找不到資料集「${ONLY}」。可用：${SOURCES.map((s) => s.id).join("、")}`);
  process.exit(1);
}

let ok = true;
for (const source of targets) {
  try {
    if (!(await build(source))) ok = false;
  } catch (err) {
    console.error(`\n✗ ${source.id}：${err.message}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("地理資料產生完成 ✓");
