/**
 * 臺灣的自然保護區域圖資存取層（國家公園 + 自然保留區 + 野生動物保護區 + 自然保護區）。
 *
 * 比照 lib/reservoirs.mjs：把「上游長什麼樣、哪裡會咬人」關在一個模組裡，
 * build-geodata.mjs 只看得到一個回傳 GeoJSON feature 陣列的函式。
 *
 * ## 為什麼一個圖層要拼四個資料集
 *
 * 臺灣的「自然保護區域」在法律上有五類，主管機關不同、開放資料也各自發布：
 *
 * | 類別 | 依據 | 發布機關 |
 * |---|---|---|
 * | 國家公園／國家自然公園 | 國家公園法 | 內政部國家公園署 |
 * | 自然保留區 | 文化資產保存法 | 農業部林業及自然保育署 |
 * | 野生動物保護區 | 野生動物保育法 | 同上 |
 * | 自然保護區 | 森林法相關規定 | 同上 |
 *
 * 第五類「野生動物重要棲息環境」**刻意不收**：它是四類裡面積最大、而且與前面
 * 四類大量重疊的一層（棲息環境常常整個包住保護區），全部畫上去只會讓圖面糊成
 * 一片而看不出「保護區在哪」。這個取捨寫在圖層說明裡，不是靜默略過。
 *
 * 海域的野生動物保護區也不在內：它們已經改由海洋委員會主管，不在林業及自然
 * 保育署這份「陸域」資料集裡。同樣寫在圖層說明裡。
 *
 * ## ⚠️ 三個實測過的坑
 *
 * 1. **座標是 TM2 公尺，而且中央子午線有三種**（見 lib/twd97.mjs）。
 * 2. **一半的國家公園沒有「範圍圖」，只有「土地使用分區圖」**——要先把分區合併
 *    成園區（見 lib/dissolve.mjs），否則外框圖層會把每一條分區界都描出來。
 * 3. **官方索引裡有些檔案包在 RAR／7z 裡**（陽明山第 4 次通盤檢討、台江），
 *    免依賴的 Node 開不了。這兩座各自改走別的官方管道，見下面的 `source`。
 */
import { parseCsv } from "./csv.mjs";
import { fetchBuffer } from "./fetch-retry.mjs";
import { parseWfsGml } from "./gml.mjs";
import { dissolveRings, geodesicArea } from "./dissolve.mjs";
import { readShapefileZip, signedRingArea } from "./shp.mjs";
import { readZip } from "./unzip.mjs";
import { TM2_TAIWAN, tm2ToWgs84 } from "./twd97.mjs";

export const LICENSE = "政府資料開放授權條款第 1 版";

/** 內政部國家公園署「國家公園地理資訊圖層彙整」——一份指向各處室圖資的索引 CSV。 */
const NATIONAL_PARK_INDEX = 174421;

/** 農業部農業資料開放平臺的檔案清單 API（回 `[{ FileName, FileUrl }]`）。 */
const MOA_FILE_LIST = (dataId) =>
  `https://data.moa.gov.tw/api/FileToJson.ashx?DataId=${dataId}&DataTable=OpenDataList`;

/**
 * 十座國家公園與國家自然公園。
 *
 * **順序就是圖層抽屜裡可點清單的順序**（LayerBrowseList 不排序），排成成立年份
 * 由早到晚——課本講國家公園時就是照這個順序，從墾丁一路講到澎湖南方四島。
 *
 * `officialHa` 是公告面積，只用來跟圖資算出來的面積交叉比對（見 `checkArea`）；
 * 它不會寫進 geojson，圖層上顯示的一律是圖形本身算出來的面積。
 *
 * `dissolve: true` ＝ 這份圖資是分區圖不是範圍圖，要先合併（見檔頭第 2 點）。
 */
const NATIONAL_PARKS = [
  {
    id: "np-kenting",
    name: "墾丁國家公園",
    category: "國家公園",
    officialHa: 33289,
    // 索引裡墾丁只有「細部計畫圖」這一列，但那個 zip 裡同時放了主要計畫圖與
    // 細部計畫圖兩份 shapefile。要的是**主要計畫圖**——細部計畫只涵蓋園區內
    // 需要細部規劃的那幾塊，拿它當範圍會少掉大半個墾丁。
    source: { via: "tgos", file: "墾丁國家公園細部計畫圖(SHP)(第4次通盤檢討)", shp: "主要計畫圖" },
    dissolve: true,
  },
  {
    id: "np-yushan",
    name: "玉山國家公園",
    category: "國家公園",
    officialHa: 103121,
    source: { via: "tgos", file: "玉山國家公園範圍圖(SHP)(第4次通盤檢討)" },
  },
  {
    id: "np-yangmingshan",
    name: "陽明山國家公園",
    category: "國家公園",
    officialHa: 11338,
    /**
     * ⚠️ 第 4 次通盤檢討的範圍圖在官方索引裡是一個**內含 RAR** 的 zip，免依賴的
     * Node 解不開（zlib 只有 inflate）。所以改用同一個平臺（TGOS）為第 3 次通盤
     * 檢討開的 WFS 端點——一樣是官方發布、而且是可以直接抓的 GML。
     *
     * 代價是版本較舊（102 年公告）。陽明山兩次通盤檢討之間界線幾乎沒有變動，
     * 對一份簡化到數十公尺的教學圖資沒有影響，但這是知道之後選的，不是漏掉。
     */
    source: {
      via: "wfs",
      url:
        "https://ogcmap.tgos.tw/TGOS_UserServices/25194/Ymsnp3PlanBorder/SimpleWFS.aspx" +
        "?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=Ymsnp3PlanBorder",
    },
  },
  {
    id: "np-taroko",
    name: "太魯閣國家公園",
    category: "國家公園",
    officialHa: 92000,
    source: { via: "tgos", file: "太魯閣國家公園計畫圖(SHP)(第3次通盤檢討)" },
    dissolve: true,
  },
  {
    id: "np-sheipa",
    name: "雪霸國家公園",
    category: "國家公園",
    officialHa: 76850,
    /**
     * 這份 KML 是從 CAD 轉出來的**單一條封閉折線**（`<LineString>`，不是
     * `<Polygon>`），所以不能走 lib/kml.mjs——那支找的是 `<outerBoundaryIs>`。
     * 首尾座標實測完全相同，直接當成環用。
     */
    source: { via: "tgos", file: "雪霸國家公園計畫範圍圖(KML)(第2次通盤檢討)", kml: true },
  },
  {
    id: "np-kinmen",
    name: "金門國家公園",
    category: "國家公園",
    officialHa: 3720,
    source: { via: "tgos", file: "金門國家公園計畫範圍圖(SHP)(第3次通盤檢討)" },
  },
  {
    id: "np-dongsha",
    name: "東沙環礁國家公園",
    category: "國家公園",
    officialHa: 353668,
    source: { via: "tgos", file: "東沙環礁國家公園計畫圖(SHP)(第2次通盤檢討)" },
    dissolve: true,
  },
  {
    id: "np-taijiang",
    name: "台江國家公園",
    category: "國家公園",
    officialHa: 39310,
    /**
     * ⚠️ 官方索引裡台江的兩份圖資（陸域、海域）都包在 **7z** 裡（副檔名寫成
     * `.rar`，其實是 7z 的簽章），免依賴的 Node 一樣開不了。
     *
     * 所以改抓中央研究院「研究資料寄存所」(depositar) 上的同一份官方檔案——
     * 它是把原始 shapefile 解開後重新以純 zip 寄存，內容（含 .prj）與官方一致。
     * 這是全部資料源裡唯一一筆不是直接向主管機關取得的，圖層說明有註記。
     *
     * 陸域用的是「範圍圖」、海域只有「分區圖」（所以要合併）；兩者加起來才是
     * 公告的 39,310 公頃，只畫陸域會少掉近九成的面積。
     */
    source: {
      via: "mirror",
      urls: [
        "https://data.depositar.io/dataset/ca3f1d12-6b4e-47ba-8fe4-3ef467d0d1a2/resource/39154c11-2949-477f-b2a8-8823a3a24b22/download/taijiang_park_land_field.zip",
        "https://data.depositar.io/dataset/29e5e59b-0b9b-4bc5-b942-9022fc270352/resource/350eace3-d4b6-49ec-ae5b-82ebb8b923cf/download/taijiang_park_ocean_use.zip",
      ],
    },
    dissolve: true,
  },
  {
    id: "np-south-penghu",
    name: "澎湖南方四島國家公園",
    category: "國家公園",
    officialHa: 35843,
    source: { via: "tgos", file: "澎湖南方四島國家公園計畫圖(SHP)" },
    dissolve: true,
  },
  {
    id: "np-shoushan",
    name: "壽山國家自然公園",
    category: "國家自然公園",
    officialHa: 1123,
    source: { via: "tgos", file: "壽山國家自然公園計畫範圍圖(SHP)(第1次通盤檢討)" },
  },
];

/**
 * 林業及自然保育署的三個資料集。
 *
 * `expected` 是預期的區域數。對不上就讓建置失敗——新公告一處保留區是要更新
 * 圖層說明與內容檔的事件，不該靜默地多出一個沒有人看過的圖徵。
 */
const CONSERVATION_DATASETS = [
  { dataId: 157, category: "自然保留區", prefix: "nr", expected: 22 },
  { dataId: 162, category: "野生動物保護區", prefix: "wr", expected: 16 },
  { dataId: 350, category: "自然保護區", prefix: "fr", expected: 5 },
];

const HECTARE = 10000;

/**
 * 把環轉成 GeoJSON 慣例的繞行方向（外環逆時針＝帶號面積為正、內環順時針）。
 *
 * shapefile 那條路徑在 lib/shp.mjs 裡就整份反轉過了，但 KML 與 WFS 沒有——它們
 * 是從同一批 CAD／shapefile 匯出的，環一樣是順時針。踩過：陽明山的環是順時針，
 * dissolve 於是判定「一個外環都沒有」而整座公園消失。GML 用 outerBoundaryIs／
 * innerBoundaryIs **明確標了**哪個是洞，所以這裡照著標記強制方向，比猜上游的
 * 繞行慣例可靠。
 */
const orient = (ring, outer) =>
  signedRingArea(ring) > 0 === outer ? ring : ring.slice().reverse();

/** 幾何算出來的面積與公告面積差太多時出聲。投影或選錯圖層都會在這裡現形。 */
function checkArea(label, polygons, officialHa, warnings) {
  const ha = geodesicArea(polygons) / HECTARE;
  const drift = Math.abs(ha - officialHa) / officialHa;
  if (drift > 0.5) {
    throw new Error(
      `${label}：圖形面積 ${Math.round(ha)} 公頃與公告的 ${officialHa} 公頃相差 ${Math.round(drift * 100)}%，八成挑錯圖層或投影`,
    );
  }
  if (drift > 0.1) {
    warnings.push(`${label} 圖形面積 ${Math.round(ha)} 公頃／公告 ${officialHa} 公頃`);
  }
  return ha;
}

/**
 * 環的面積下限，度²。
 *
 * 1 度² 在臺灣的緯度帶約 1.13e10 平方公尺，所以 8.8e-9 度² ≈ **100 平方公尺**。
 * 這個門檻要濾掉的是 dissolve 的殘渣（零面積的來回線、自相接處拆出來的碎環，
 * 實測東沙 133 個、太魯閣 36 個），而最小的一筆真資料是北投石自然保留區的
 * 2,216 平方公尺——中間差了一個數量級以上，不會誤傷。
 */
const MIN_RING_AREA = 8.8e-9;

/** 每個圖徵一律做一次 dissolve：不需要合併的也只是把環重新串一次，結果相同。 */
function toPolygons(rings, label) {
  const polygons = dissolveRings(rings, label, MIN_RING_AREA);
  // 整塊都比門檻小的圖徵（沒有這種，但保險）寧可原樣留著，也不要整個消失
  const kept = polygons.filter((poly) => geodesicArea([poly]) >= 100);
  return kept.length ? kept : polygons;
}

/** 取索引 CSV 裡某一列的下載網址。找不到就是上游改版，直接失敗。 */
function pickIndexRow(rows, fileName) {
  const match = rows.filter((r) => r.File_Name === fileName);
  if (match.length !== 1) {
    throw new Error(`國家公園圖層索引裡「${fileName}」有 ${match.length} 列，上游可能改版`);
  }
  return match[0].File_URL;
}

/**
 * TGOS 的網址帶**未編碼的中文檔名**（`…/墾丁(四通)_shp.zip`），`fetch` 會直接拒收。
 * `new URL()` 的序列化本來就會把路徑裡的非 ASCII 百分比編碼，借它做就好——
 * 自己跑 `encodeURIComponent` 會把已經編碼的部分再編一次（`%` → `%25`），
 * 結果是一個看起來很像對的 404。
 */
const encodePath = (url) => new URL(url).toString();

const buffer = (url) => fetchBuffer(encodePath(url));

/** shapefile zip → 所有記錄的環（已經是經緯度）。 */
function ringsFromShapefile(buf, shpName, label) {
  const { features } = readShapefileZip(buf, shpName ? (n) => n.includes(shpName) : undefined);
  if (features.length === 0) throw new Error(`${label}：shapefile 裡沒有任何記錄`);
  return features.flatMap((f) => f.rings);
}

/** 雪霸那份 CAD 轉出來的 KML：一條封閉折線，直接當環。 */
function ringsFromKmlZip(buf, label) {
  const kml = readZip(buf).filter((e) => e.name.toLowerCase().endsWith(".kml"));
  if (kml.length !== 1) throw new Error(`${label}：zip 裡的 .kml 有 ${kml.length} 個`);
  const text = kml[0].read().toString("utf8");
  const rings = [...text.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) =>
    m[1]
      .trim()
      .split(/\s+/)
      .map((token) => {
        const [lon, lat] = token.split(",");
        return [Number(lon), Number(lat)];
      }),
  );
  if (rings.length === 0) throw new Error(`${label}：KML 裡沒有 <coordinates>`);
  for (const ring of rings) {
    const [first] = ring;
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  }
  // KML 沒有內外環的標記，這份又只有一條範圍線，所以全部當外環
  return rings.map((ring) => orient(ring, true));
}

/** TGOS SimpleWFS：GML 2，座標是 EPSG:3826 的 TM2 公尺。 */
async function ringsFromWfs(fetchWithRetry, url, label) {
  const xml = await (await fetchWithRetry(url)).text();
  return parseWfsGml(xml).flatMap((member) => {
    if (!/3826/.test(member.srsName)) {
      throw new Error(`${label}：WFS 回的是 ${member.srsName}，不是預期的 EPSG:3826`);
    }
    // parseWfsGml 回的第一個環一定是 outerBoundaryIs，其餘是 innerBoundaryIs
    return member.rings.map((ring, index) =>
      orient(ring.map(([x, y]) => tm2ToWgs84(x, y, TM2_TAIWAN)), index === 0),
    );
  });
}

async function fetchNationalParks(fetchWithRetry, warnings) {
  const indexUrl = await resolveIndexUrl(fetchWithRetry);
  const rows = parseCsv(await (await fetchWithRetry(indexUrl)).text());
  if (rows.length === 0) throw new Error("國家公園圖層索引 CSV 剖析後 0 列");

  const features = [];
  for (const park of NATIONAL_PARKS) {
    const { via } = park.source;
    let rings;
    if (via === "wfs") {
      rings = await ringsFromWfs(fetchWithRetry, park.source.url, park.name);
    } else if (via === "mirror") {
      rings = [];
      for (const url of park.source.urls) {
        rings.push(...ringsFromShapefile(await buffer(url), null, park.name));
      }
    } else {
      const buf = await buffer(pickIndexRow(rows, park.source.file));
      rings = park.source.kml
        ? ringsFromKmlZip(buf, park.name)
        : ringsFromShapefile(buf, park.source.shp, park.name);
    }

    const coordinates = toPolygons(rings, park.name);
    const areaHa = checkArea(park.name, coordinates, park.officialHa, warnings);
    features.push(makeFeature(park.id, park.name, park.category, areaHa, coordinates));
  }
  return features;
}

/** 索引 CSV 自己也是一筆開放資料，網址一樣去 data.gov.tw 查而不是寫死。 */
async function resolveIndexUrl(fetchWithRetry) {
  const meta = await (
    await fetchWithRetry(`https://data.gov.tw/api/v2/rest/dataset/${NATIONAL_PARK_INDEX}`)
  ).json();
  const csv = (meta?.result?.distribution ?? []).filter((d) => d.resourceFormat === "CSV");
  if (csv.length !== 1) {
    throw new Error(`資料集 ${NATIONAL_PARK_INDEX} 的 CSV 資源有 ${csv.length} 個`);
  }
  return csv[0].resourceDownloadUrl;
}

/**
 * 從農業部的檔案清單裡挑**最新一期的 SHP**。
 *
 * 檔名長這樣：`自然保留區1152_SHP`、`陸域野生動物保護區1141_SHP`——中間四碼是
 * 民國年 + 期別。清單裡同時躺著好幾期的舊檔，取最大的那個；寫死 RID 半年後
 * 就會抓到過期的界線，而且完全不會報錯。
 */
function pickLatestShp(files, category) {
  const candidates = files
    .filter((f) => /shp/i.test(f.FileName))
    .map((f) => ({ ...f, edition: Number(/(\d{4})/.exec(f.FileName)?.[1] ?? 0) }))
    .sort((a, b) => b.edition - a.edition);
  if (candidates.length === 0) {
    throw new Error(`${category}：檔案清單裡沒有 SHP（現有：${files.map((f) => f.FileName).join("、")}）`);
  }
  return candidates[0];
}

async function fetchConservationAreas(fetchWithRetry, warnings) {
  const features = [];
  for (const dataset of CONSERVATION_DATASETS) {
    const files = await (await fetchWithRetry(MOA_FILE_LIST(dataset.dataId))).json();
    const file = pickLatestShp(files, dataset.category);
    const { features: records } = readShapefileZip(await buffer(file.FileUrl));

    /**
     * 一個保護區可能有好幾筆記錄：核心區／緩衝區／永續利用區是分開的多邊形，
     * 澎湖南海玄武岩自然保留區更是三座島各一筆。官方的 `FILE_NAME`（NR01、
     * WR02、FR02…）就是保護區本身的編號，用它分組。
     *
     * ⚠️ **不能用 `Area_ha` 加總當面積**：那個欄位有時是分區面積（楠梓仙溪
     * 311 + 145），有時是整區面積重複填在每一筆（新竹市濱海四筆都是 1617.03）。
     * 面積一律由幾何算，全站一致。
     */
    const groups = new Map();
    for (const record of records) {
      const props = record.properties;
      const code = String(props.FILE_NAME ?? "").trim();
      const name = String(props.NAME ?? props.Name ?? "").trim();
      if (!code || !name) {
        throw new Error(`${dataset.category}：有記錄缺 FILE_NAME 或名稱，上游欄位可能變了`);
      }
      const group = groups.get(code) ?? { code, name, rings: [] };
      group.rings.push(...record.rings);
      groups.set(code, group);
    }

    if (groups.size !== dataset.expected) {
      throw new Error(
        `${dataset.category}：${groups.size} 處，與預期的 ${dataset.expected} 處不符——` +
          `新增或撤銷公告要連同圖層說明一起更新（${[...groups.values()].map((g) => g.name).join("、")}）`,
      );
    }

    for (const group of [...groups.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      const label = group.name;
      const coordinates = toPolygons(group.rings, label);
      const areaHa = geodesicArea(coordinates) / HECTARE;
      const id = `${dataset.prefix}-${group.code.replace(/^[A-Za-z]+/, "")}`;
      features.push(makeFeature(id, label, dataset.category, areaHa, coordinates));
    }
    warnings.push(`${dataset.category}：取用 ${file.FileName}`);
  }
  return features;
}

/** 面積的顯示字串。0.2 公頃的北投石與 47,000 公頃的大武山要用同一個格式塞進清單次標。 */
function formatArea(ha) {
  if (ha >= 1000) return `約 ${Math.round(ha).toLocaleString("zh-TW")} 公頃`;
  if (ha >= 10) return `約 ${Math.round(ha)} 公頃`;
  return `約 ${ha.toFixed(1)} 公頃`;
}

function makeFeature(id, name, category, areaHa, coordinates) {
  return {
    type: "Feature",
    geometry: { type: "MultiPolygon", coordinates },
    properties: {
      id,
      name,
      category,
      /** 由圖形算出來的面積，不是公告面積（上游的面積欄位不一致，見上）。 */
      area_ha: areaHa >= 100 ? Math.round(areaHa) : Math.round(areaHa * 10) / 10,
      meta: `${category}・${formatArea(areaHa)}`,
    },
  };
}

/**
 * 全部四類保護區域的 GeoJSON feature。
 *
 * 順序＝圖層抽屜可點清單的順序：十座國家公園（依成立年份）在前，
 * 其餘三類各自依官方編號排在後面。
 */
export async function fetchProtectedAreas(fetchWithRetry) {
  const warnings = [];
  const parks = await fetchNationalParks(fetchWithRetry, warnings);
  const others = await fetchConservationAreas(fetchWithRetry, warnings);
  return { features: [...parks, ...others], warnings };
}
