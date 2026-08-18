/**
 * 全球活火山（史密森尼學會 全球火山計畫 GVP）的存取層。
 *
 * ## 為什麼是 GVP 的「全新世火山」
 *
 * 課本說的「活火山」＝**全新世（約一萬年）以來噴發過**的火山，而 GVP 的
 * Volcanoes of the World 正是那份權威名單（1,214 座）。USGS 只有靜態圖、
 * Natural Earth 根本沒有火山圖層，所以這是唯一一份公開、帶座標、帶最後噴發
 * 年代的全球資料。
 *
 * ⚠️ **黃石與多巴這類「超級火山」不在名單裡**，那不是漏掉：它們最後一次噴發
 * 分別在約 7 萬與 7.4 萬年前，早於全新世，按定義不算活火山。圖層的 notes 有交代。
 *
 * ## 端點
 *
 * GeoServer 的 WFS，一次回整份 GeoJSON（2.4 MB）。**只在建置期呼叫**，
 * 產物約 130 KB。免金鑰、不需要 User-Agent（跟 Overpass 不同）。
 */

const WFS = "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows";

export const VOLCANOES_URL =
  `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
  `&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json`;

/** 引用格式見 https://volcano.si.edu/ 的 How to Cite。 */
export const LICENSE = "Smithsonian Institution, Global Volcanism Program（引用即可自由使用）";
export const SOURCE_LABEL = "史密森尼學會 全球火山計畫（GVP）";

/**
 * 上游 `Region` → 中文火山區名（19 個，一個不能少）。
 *
 * 這一欄取代了「國家」當卡片上的地理定位：這一層叫**火山帶**，「屬於哪一條
 * 火山帶」比「屬於哪一國」更接近它要教的東西，而且國家有 88 個、中文名要另外
 * 維護一份長表，火山區只有 19 個。
 *
 * ⚠️ 對不到就讓建置失敗（比照 `PLATES`）：上游新增一個火山區是要由人決定中文名
 * 的事件，不是可以自動猜的。
 */
export const REGIONS_ZH = {
  "European Volcanic Regions": "歐洲火山區",
  "Arabia-Central Asia Volcanic Regions": "阿拉伯－中亞火山區",
  "Eastern Africa Volcanic Regions": "東非火山區",
  "Northern Africa Volcanic Regions": "北非火山區",
  "Somalian-Antarctic Volcanic Regions": "索馬利亞－南極火山區",
  "Tonga-Kermadec Volcanic Regions": "東加－克馬德克火山區",
  "Southern Pacific Volcanic Regions": "南太平洋火山區",
  "Southwestern Pacific Volcanic Regions": "西南太平洋火山區",
  "Eastern Australia Volcanic Regions": "澳洲東部火山區",
  "Sunda-Banda Volcanic Regions": "巽他－班達火山區",
  "Western Pacific Volcanic Regions": "西太平洋火山區",
  "Eastern Asia Volcanic Regions": "東亞火山區",
  "Northwestern Pacific Volcanic Regions": "西北太平洋火山區",
  "North America Volcanic Regions": "北美洲火山區",
  "Eastern Pacific Volcanic Regions": "東太平洋火山區",
  "Middle America-Caribbean Volcanic Regions": "中美洲－加勒比海火山區",
  "South America Volcanic Regions": "南美洲火山區",
  "Atlantic Ocean Volcanic Regions": "大西洋火山區",
  "Antarctic-Scotia Volcanic Regions": "南極－斯科舍火山區",
};

/**
 * 上游 `Primary_Volcano_Type` → 中文火山類型。
 *
 * ⚠️ 上游同一種類型有**單複數與存疑三種寫法**（`Stratovolcano`／
 * `Stratovolcano(es)`／`Stratovolcano?`），所以要先正規化再查表——照字面查會
 * 漏掉三分之一的圖徵。
 */
const TYPES_ZH = {
  Stratovolcano: "層狀火山",
  "Volcanic field": "火山區",
  Shield: "盾狀火山",
  "Shield(pyroclastic)": "盾狀火山（碎屑質）",
  Caldera: "破火山口",
  Complex: "複合火山",
  Compound: "複成火山",
  "Fissure vent": "裂隙噴發口",
  "Pyroclastic cone": "火山碎屑錐",
  "Lava dome": "熔岩穹丘",
  "Lava cone": "熔岩錐",
  Maar: "低平火山口",
  "Crater rows": "火山口列",
  "Tuff cone": "凝灰岩錐",
  "Tuff ring": "凝灰岩環",
  Cone: "火山錐",
  "Explosion crater": "爆裂火山口",
};

/** `Stratovolcano(es)` / `Lava cone(es)` / `Stratovolcano?` → `Stratovolcano`。 */
function normalizeType(raw) {
  return String(raw ?? "").replace(/\((?:e?s)\)$/, "").replace(/\?$/, "").trim();
}

/**
 * 知名火山的中文名（GVP 的 `Volcano_Number` → 中文）。
 *
 * ⚠️ **這份表不可能補完，收錄範圍必須是一條講得出來的界線**（比照 basemaps.ts
 * 的 `ZH_HANT_OVERRIDES` 與 build-geodata.mjs 的 `RIVER_NAMES_ZH`）。現在的界線是
 * 「**臺灣的兩座**，加上課本、新聞與科普讀物會直接叫出名字的知名火山」——1,214 座
 * 裡的 40 幾座。其餘沿用 GVP 的原名，那也是查得到資料的名字。
 *
 * 中文名逐筆取自維基百科（zh-tw），比照五大山脈、颱風與板塊對照表的既有做法：
 * 維基百科是次級來源，只拿來查已有共識的名稱，座標、海拔與噴發年代一律用 GVP 的。
 *
 * ⚠️ key 用 `Volcano_Number` 不用名稱：GVP 會修訂拼寫（`Fuji` → `Fujisan`、
 * `White Island` → `Whakaari/White Island`），編號則是穩定的識別碼。
 * 對不到就讓建置失敗（見 `buildVolcanoFeatures`）。
 */
export const NAMES_ZH = {
  // 臺灣
  281031: "龜山島",
  281032: "大屯火山群",
  // 日本、朝鮮半島、堪察加
  283030: "富士山",
  282080: "姶良破火山口（櫻島）",
  282110: "阿蘇山",
  282100: "雲仙岳",
  283110: "淺間山",
  283040: "御嶽山",
  284010: "伊豆大島",
  284040: "三宅島",
  305060: "長白山",
  300260: "克柳切夫火山",
  // 菲律賓、印尼
  273070: "塔阿爾火山",
  273083: "皮納土玻火山",
  273030: "馬榮火山",
  262000: "喀拉喀托火山",
  263250: "默拉皮火山",
  263300: "塞梅魯火山",
  263280: "克盧德火山",
  264040: "坦博拉火山",
  264020: "阿貢火山",
  264030: "林賈尼火山",
  261080: "錫納朋火山",
  // 紐西蘭、太平洋島弧
  241100: "魯阿佩胡火山",
  241080: "東加里羅火山",
  241070: "陶波火山",
  241040: "懷特島火山",
  243040: "洪加東加－洪加哈阿派火山",
  // 地中海
  211020: "維蘇威火山",
  211060: "埃特納火山",
  211040: "斯特龍伯利火山",
  211050: "武爾卡諾島",
  211010: "坎皮佛萊格瑞",
  212040: "聖托里尼火山",
  // 冰島
  372070: "海克拉火山",
  372030: "卡特拉火山",
  372020: "艾雅法拉冰蓋",
  // 北美洲、夏威夷
  321050: "聖海倫斯火山",
  321030: "雷尼爾山",
  323010: "沙斯塔山",
  332010: "基拉韋亞火山",
  332020: "茂納羅亞火山",
  341090: "波波卡特佩特火山",
  // 中南美洲
  360120: "培雷火山",
  351020: "內瓦多德爾魯伊斯火山",
  352050: "科多帕希火山",
  357120: "比亞里卡火山",
  // 非洲、印度洋、南極
  223030: "尼拉貢戈火山",
  221080: "爾塔阿雷火山",
  233020: "富爾奈斯火山",
  390020: "埃里伯斯火山",
  // 2026-08 補：同一條界線（課本、新聞與科普讀物會直接叫出名字的），
  // 上一輪漏掉的知名火山。中文名同樣逐筆取自維基百科（zh-tw）。
  213040: "亞拉拉特山",
  214010: "厄爾布魯士山",
  232010: "達馬萬德峰",
  233010: "卡爾塔拉火山",
  241030: "塔拉納基山",
  312170: "卡特邁火山",
  313030: "里道特火山",
  323080: "拉森火山",
  332030: "毛納基亞火山",
  341100: "奧里薩巴山",
  344090: "莫莫通博火山",
  344100: "馬薩亞火山",
  345033: "阿雷納爾火山",
  345040: "波阿斯火山",
  345060: "伊拉蘇火山",
  351080: "加雷拉斯火山",
  352010: "雷文塔多火山",
  352071: "欽波拉索山",
  352080: "通古拉瓦火山",
  352090: "桑蓋火山",
  354006: "薩班卡亞火山",
  354010: "埃爾米斯蒂火山",
  354020: "烏維納斯火山",
  355092: "利坎卡武爾火山",
  355130: "奧霍斯－德爾薩拉多山",
  357110: "亞伊馬火山",
  358010: "奧索爾諾火山",
  360050: "蘇弗里耶爾丘陵火山",
  360150: "聖文森蘇弗里耶爾火山",
  373010: "格里姆火山",
  373060: "阿斯基亞火山",
  384010: "福古火山",
};

/**
 * 最後噴發年代。負數是西元前，`null` 是「全新世內噴發過但年代不明」。
 *
 * ⚠️ 366 座（三成）沒有年代，那是資料本身的狀態不是缺漏——它們是靠地層或
 * 碳定年判定為全新世噴發，但定不出年份。寫成「年代不詳」比留白誠實。
 */
export function formatEruption(year) {
  if (year == null) return "最後噴發年代不詳";
  if (year < 0) return `最後噴發 西元前 ${Math.abs(year).toLocaleString("en-US")} 年`;
  return `最後噴發 ${year} 年`;
}

/**
 * 海拔。⚠️ **可以是負的**——GVP 收了海底火山（最深 -5,700 公尺），
 * 寫成「海拔 -5700 公尺」會讀不懂。
 */
export function formatElevation(m) {
  if (m == null) return null;
  const n = Math.abs(m).toLocaleString("en-US");
  return m < 0 ? `海面下 ${n} 公尺` : `海拔 ${n} 公尺`;
}

/**
 * GVP 的一筆 → 本站的 feature。
 *
 * 產物**刻意只留卡片會用到的欄位**：上游還有英文的地質沿革（`Geological_Summary`，
 * 動輒好幾百字）、照片網址與岩性，全部丟掉——1,214 筆全帶著的話產物會從 130 KB
 * 膨脹到 2 MB 以上，直接撞穿大小預算，而卡片一個字都用不到。
 */
function volcanoFeature(raw) {
  const p = raw.properties;
  const zh = NAMES_ZH[p.Volcano_Number];
  const type = TYPES_ZH[normalizeType(p.Primary_Volcano_Type)];
  const region = REGIONS_ZH[p.Region];
  if (!region) throw new Error(`未知的火山區「${p.Region}」，請先決定它的中文名`);

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: raw.geometry.coordinates.slice(0, 2) },
    properties: {
      id: `volcano-${p.Volcano_Number}`,
      name: zh ?? p.Volcano_Name,
      /**
       * GVP 的原名一律保留。
       *
       * ⚠️ 這一層**一份內容檔都沒有**，所以卡片走的是 `FeatureCard` 的 fallback。
       * 那條路徑本來讀不到英文名（`feature.name.en` 只存在於內容檔），2026-08 改成
       * fallback 也讀 geojson 的 `en`——中文名是對照表翻出來的，原名不顯示的話，
       * 學生沒辦法拿它去查 GVP 或對照新聞。`searchIndex` 也會把它收進 haystack。
       */
      en: p.Volcano_Name,
      // 副標不再重複印原名（`en` 已經在標題旁邊了）
      meta: [type ?? "類型不詳", formatElevation(p.Elevation)].filter(Boolean).join("・"),
      detail: [formatEruption(p.Last_Eruption_Year), region].join("・"),
    },
  };
}

/**
 * 整份轉換 + 自我檢查。
 *
 * 兩道檢查都是「上游改版時要吵，不要靜默地少一半」：
 * - 筆數掉到 1,000 以下就失敗（實測 1,214 座，2026-08）。
 * - `NAMES_ZH` 的每一個編號都必須在上游找得到——找不到代表 GVP 併掉或重編了
 *   那座火山，那份中文名就變成一筆永遠套不上的死資料。
 */
export function buildVolcanoFeatures(raw) {
  const features = raw.features
    .filter((f) => f.geometry?.type === "Point")
    .map(volcanoFeature)
    // 依 GVP 編號排序：上游的順序是任意的，排過才不會每次重抓都產生無意義的 diff
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

  if (features.length < 1000) {
    throw new Error(`只轉出 ${features.length} 座火山，上游欄位可能變了（實測應有 1,214 座）`);
  }

  const ids = new Set(features.map((f) => f.properties.id));
  const missing = Object.keys(NAMES_ZH).filter((n) => !ids.has(`volcano-${n}`));
  if (missing.length) {
    throw new Error(`NAMES_ZH 的編號在上游找不到：${missing.join("、")}`);
  }

  return features;
}
