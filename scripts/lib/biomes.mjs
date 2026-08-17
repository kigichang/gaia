/**
 * 陸域生物群系（RESOLVE Ecoregions 2017）的存取層。
 *
 * ## 為什麼是 RESOLVE 而不是自己畫
 *
 * 「森林與沙漠帶」原本掛著 `schematic: true`，打算手繪幾條緯度帶。但這一層要教的是
 * 「**為什麼**沙漠帶落在南北緯 30° 附近」——手繪的長方形只是把結論畫出來，看不出
 * 撒哈拉與阿拉伯連成一氣、而同緯度的東亞卻是森林（季風的功勞）。RESOLVE Ecoregions
 * 2017（Dinerstein et al.，WWF 陸域生態區的現行版本）是這件事的標準資料集，847 個
 * 生態區各自標了 14 個生物群系之一。所以這一層**不標 schematic**。
 *
 * ## 為什麼走 Esri Living Atlas 的 FeatureServer
 *
 * 官方的 `Ecoregions2017.zip` 是 **149 MB 的 shapefile**，解開來更大——`lib/shp.mjs`
 * 是自己寫的純 JS 讀取器，那個量級不該讓它去扛。Living Atlas 上的同一份資料支援
 * 伺服器端的 `maxAllowableOffset`（幾何綜合）與 `geometryPrecision`（小數位），
 * 一次要求就能拿到已經化簡過的 GeoJSON（六類合計約 1.5 MB）。
 *
 * ⚠️ **授權是 CC-BY 4.0，必須標示出處**（比照板塊那份 ODC-BY）：來源要同時列出
 * 原始資料集與取得管道，少一個就違反授權。
 *
 * ## ⚠️ 連續打會收到一個會騙人的 400
 *
 * 短時間內連發六個大查詢，第二輪之後開始回
 * `{"error":{"code":400,...,"details":["'maxAllowableOffset' parameter is invalid"]}}`
 * ——**同一個網址用 curl 單獨打是好的**，參數也沒有錯。看起來是流量控管，但錯誤訊息
 * 指著參數，很容易讓人跑去改 offset（實測 0.2／0.4／0.8 都出現過同一句話）。
 * 所以 `fetchBiomeClass()` 自己做間隔與退避重試，而不是靠 `fetchWithRetry`
 * ——那支只認 429／5xx，這裡是 HTTP 400 帶著一個 JSON 錯誤物件。
 */

const SERVICE =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Resolve_Ecoregions/FeatureServer/0/query";

export const LICENSE = "Creative Commons 姓名標示 4.0（CC-BY 4.0）";
/** ⚠️ CC-BY 要求標示出處，原始資料集與取得管道兩個都要列。 */
export const SOURCE_LABELS = ["RESOLVE 生態區 2017（Dinerstein et al.）", "Esri Living Atlas"];
export const SOURCE_PAGE = "https://ecoregions.appspot.com/";

/**
 * 伺服器端的幾何綜合容差（度）。0.4° ≈ 44 公里。
 *
 * 這一層的 `maxzoom` 是 5（世界尺度），那個尺度下 1° 只有 22 px，0.4° 大約 9 px；
 * 再細的邊界在畫面上看不出來，卻會讓檔案大一倍。**本站自己的 Douglas–Peucker
 * 仍然會再跑一次**（`tolerance`），兩者不衝突：伺服器端砍的是頂點密度，我們這邊
 * 砍的是化簡後仍然共線的點。
 */
const MAX_ALLOWABLE_OFFSET = 0.4;

/**
 * 保留的多邊形最小面積（度²）。0.15 度² ≈ 1,850 km²（赤道附近）。
 *
 * ⚠️ **這個過濾是這一層能不能塞進大小預算的關鍵，不是可有可無的清理。** 上游把每
 * 一個小島、每一個湖心島都收了進來：光是苔原那一類就有 **50,680 個環**，其中 29,000
 * 多個是加拿大北極群島與湖泊的碎塊，全留的話那一類自己就 3.5 MB。
 *
 * ⚠️ 門檻不能再往上調：0.3 度² 會開始咬到峇里島、宿霧這種課本會提到的島，而熱帶雨林
 * 這一類的教學重點正好在印尼與菲律賓的群島上。
 *
 * ⚠️ 跟離島那條規則一樣，**必須在簡化之前**做：Douglas–Peucker 不會刪掉整個環。
 */
const MIN_POLYGON_AREA = 0.15;

/**
 * 六個教學用大類 → 上游的 `BIOME_NUM`。**14 個生物群系一個都沒有漏掉**（見下）。
 *
 * 為什麼是六類而不是十四類：十四個分類色不可能通過色票驗證（本站掃過整個 OKLCH
 * 色域，六色已經是 all-pairs 全數 PASS 的上限，見 thematicColors.ts 的
 * `BIOME_COLORS`），而課本講的本來就是「熱帶雨林、莽原、沙漠、溫帶林、針葉林、
 * 苔原」這幾條帶。
 *
 * ⚠️ 併類的判斷寫在這裡，改動前先讀一遍：
 * - **紅樹林（14）併進熱帶林**：它是熱帶海岸的森林，而且是一條條幾公里寬的窄帶，
 *   在世界尺度下幾乎全部會被 `MIN_POLYGON_AREA` 濾掉——單獨列一類等於一個空的
 *   核取方塊。
 * - **溫帶草原（8）與熱帶莽原（7）合成「莽原與草原」**：北美大草原與歐亞大草原
 *   在課本裡是「溫帶草原」，跟莽原不是同一件事，但兩者都是草原、而且分開就要第七
 *   個顏色。類名寫成「莽原與草原」而不是「莽原」就是為了不說謊。
 * - **地中海型（12）併進溫帶林**：它是溫帶的硬葉林，範圍小而破碎。
 * - **高山草原與灌叢（10）併進苔原**：那是「高山寒原」，跟緯度上的苔原是同一種
 *   低溫限制（本站臺灣主題的垂直植被帶講的就是這件事）。
 */
export const BIOME_CLASSES = [
  {
    id: "tropical-forest",
    label: "熱帶雨林與季風林",
    nums: [1, 2, 3, 14],
  },
  {
    id: "savanna",
    label: "莽原與草原",
    nums: [7, 8, 9],
  },
  {
    id: "desert",
    label: "沙漠與乾旱地",
    nums: [13],
  },
  {
    id: "temperate-forest",
    label: "溫帶林",
    nums: [4, 5, 12],
  },
  {
    id: "boreal",
    label: "針葉林（泰加林）",
    nums: [6],
  },
  {
    id: "tundra",
    label: "苔原與高山寒原",
    nums: [10, 11],
  },
];

/** 上游 14 個 `BIOME_NUM` 一個都不能漏——漏掉的那一類會在地圖上變成一塊空白。 */
const ALL_NUMS = BIOME_CLASSES.flatMap((c) => c.nums).sort((a, b) => a - b);
if (ALL_NUMS.join() !== Array.from({ length: 14 }, (_, i) => i + 1).join()) {
  throw new Error(`BIOME_CLASSES 沒有涵蓋 1–14 全部的 BIOME_NUM：${ALL_NUMS.join("、")}`);
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
};

/**
 * 抓一類，回傳 `{ feature, kept, dropped }`。
 *
 * 產物是**一個 MultiPolygon**：六類就是六筆圖徵，跟板塊邊界的三筆同一個形狀。
 * 上游那 847 個生態區的英文名（`ECO_NAME`）逐一列出來對國中小沒有意義，而且
 * 註冊表的 `items` 是用中文類名當核取方塊的。
 */
export async function fetchBiomeClass(cls, { attempts = 5 } = {}) {
  const url =
    `${SERVICE}?where=BIOME_NUM+IN+(${cls.nums.join(",")})` +
    `&outFields=BIOME_NUM&returnGeometry=true` +
    `&maxAllowableOffset=${MAX_ALLOWABLE_OFFSET}&geometryPrecision=2&outSR=4326` +
    `&f=geojson&resultRecordCount=2000`;

  let raw = null;
  for (let i = 0; i < attempts && !raw?.features; i++) {
    if (i) await new Promise((r) => setTimeout(r, 8000 * i));
    try {
      raw = await (await fetch(url)).json();
    } catch {
      raw = null;
    }
    // 見檔頭：連發時會回一個指著 maxAllowableOffset 的 400，等一下再打就好
    if (!raw?.features && i === attempts - 1) {
      throw new Error(`${cls.label}：上游沒有回 features（${JSON.stringify(raw).slice(0, 120)}）`);
    }
  }

  const polygons = [];
  let dropped = 0;
  for (const f of raw.features) {
    const list = f.geometry?.type === "Polygon" ? [f.geometry.coordinates] : f.geometry?.coordinates ?? [];
    for (const poly of list) {
      if (ringArea(poly[0]) < MIN_POLYGON_AREA) {
        dropped++;
        continue;
      }
      /**
       * ⚠️ 一個環不可以跨越 ±180——跨了 maplibre 會把那塊面攤成橫貫整個地球的
       * 一條帶而且不報錯（跟國際換日線、板塊邊界同一個坑）。上游已經在換日線上
       * 切開了，這裡只是確認它有。
       */
      const lngs = poly[0].map((p) => p[0]);
      if (Math.max(...lngs) - Math.min(...lngs) >= 180) {
        throw new Error(`${cls.label}：有一塊多邊形跨過了 ±180，上游的切割可能變了`);
      }
      // 內環（湖泊）用同一個門檻濾掉：世界尺度下看不見，卻佔掉大量頂點
      polygons.push(poly.filter((ring, i) => i === 0 || ringArea(ring) >= MIN_POLYGON_AREA));
    }
  }

  if (!polygons.length) throw new Error(`${cls.label}：過濾後 0 塊，上游的 BIOME_NUM 可能變了`);

  return {
    ecoregions: raw.features.length,
    kept: polygons.length,
    dropped,
    feature: {
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: polygons },
      properties: { id: cls.id, name: cls.label },
    },
  };
}
