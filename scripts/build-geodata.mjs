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
import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./lib/fetch-retry.mjs";
import { simplifyGeometry, slugify } from "./lib/simplify.mjs";
import { parseNlscGml, ringArea } from "./lib/gml.mjs";
import { parseReservoirKml, ringsCentroid } from "./lib/kml.mjs";
import { readZip, readZipText } from "./lib/unzip.mjs";
import { parseShpPolygons, parseDbf } from "./lib/shp.mjs";
import { tm2ToWgs84 } from "./lib/twd97.mjs";
import {
  LICENSE as OSM_LICENSE,
  SOURCE_LABEL as OSM_SOURCE_LABEL,
  OVERPASS_ENDPOINTS,
  fetchRouteLines,
  stitchWays,
  totalLengthKm,
} from "./lib/overpass.mjs";
import {
  EXTENT_KML_URL,
  LICENSE as WRA_LICENSE,
  RESERVOIR_IDS,
  SOURCE_LABEL as WRA_SOURCE_LABEL,
  fetchReservoirBasics,
  formatCapacity,
} from "./lib/reservoirs.mjs";
import { BASIN_URL, BASIN_IDS, RIVER_FACTS } from "./lib/rivers.mjs";

const exists = (p) => access(p).then(() => true).catch(() => false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public/data/geo");

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
 * 臺鐵的路線關聯除了正線之外，還收了車站股道、渡線與短連絡線——實測西部幹線
 * 串完有 17 條，其中 4 條短於 0.6 公里、最短的一條**不到 10 公尺**。這些東西在
 * 這個圖層可見的縮放尺度下全是一個點，卻各自是一條合法的 LineString，會讓沿線
 * 標註在同一個地方重複冒出來。
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
    id: "tw-basins",
    label: "臺灣河川流域分區",
    /**
     * 跟 tw-rivers 是**同一組官方河川清單**（RIVER_FACTS），幾何來源卻完全不同：
     * tw-rivers 的路徑是手繪教學示意（`public/data/geo-manual/tw-rivers.geojson`，
     * 見 CLAUDE.md「河川路徑」那節），這裡才是真正抓來的 SHP（BASIN，面）。
     * id 對照表用 lib/rivers.mjs 的 `BASIN_IDS`（從 `RIVER_IDS` 衍生），facts
     * （面積）沿用同一份 `RIVER_FACTS`——這是這兩個圖層真正共用資料的地方。
     *
     * ⚠️ BASIN 這份資料乾淨很多：實測 143 筆 record 裡，26 個官方河川名稱各自
     * 剛好對到一筆**單一環（無孔洞）**多邊形，面積與官方數字誤差多在 10% 以內，
     * 精確比對名稱就夠了，不需要空間分群。真的對不到才要懷疑上游改版，不要自己
     * 加模糊比對。
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
      const byName = new Map(rows.map((r, i) => [r.BASIN_NAME, i]));
      const features = [];
      /** 官方表格裡有、但 BASIN 裡對不到幾何的河川。靜默跳過會讓「少一條」永遠沒人發現。 */
      const missing = [];

      for (const [officialName, facts] of Object.entries(RIVER_FACTS)) {
        const id = BASIN_IDS[officialName];
        if (!id) {
          throw new Error(`河川「${officialName}」不在 BASIN_IDS 對照表裡，請先決定它的 id`);
        }

        const idx = byName.get(officialName);
        const record = idx == null ? null : polygons[idx];
        if (!record || record.parts.length === 0) {
          missing.push(officialName);
          continue;
        }
        if (record.parts.length !== 1) {
          // 見上面說明：實測全部是單一環，多環代表上游改版，寧可失敗也不要猜哪個環是洞
          throw new Error(`「${officialName}」的流域是 ${record.parts.length} 環，需要人工確認外環／洞的判斷`);
        }

        const ring = record.parts[0].map(([x, y]) => tm2ToWgs84(x, y));
        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            id,
            name: officialName,
            area_km2: facts.area_km2,
            category: facts.category,
            meta: `流域面積 ${facts.area_km2} km²`,
          },
        });
      }

      if (missing.length) {
        throw new Error(`BASIN 裡找不到幾何：${missing.join("、")}`);
      }
      // ⚠️ feature 順序就是圖層抽屜裡可點清單的順序（LayerBrowseList 不排序）。
      // 依流域面積由大到小，清單開頭是高屏溪、濁水溪、淡水河這些課本會點名的河川。
      return features.sort((a, b) => b.properties.area_km2 - a.properties.area_km2);
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
];

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
  const url = source.resolveUrl ? await source.resolveUrl() : source.url;
  process.stdout.write("下載中…");
  let raw;
  if (source.load) {
    // 不是「下載一個檔案」的資料源自己負責取得（見 tw-transport 的 Overpass 查詢）
    raw = await source.load();
  } else {
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
