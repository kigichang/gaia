/**
 * 世界人口分布（Natural Earth 1:10m 城市聚落）的存取層。
 *
 * ## 為什麼是 Natural Earth 的 populated places
 *
 * 這一層要教的是**世界人口分布不均**——東亞、南亞、歐洲與北美東北部擠成一團，
 * 撒哈拉、西伯利亞、亞馬遜與澳洲內陸幾乎空白。要畫出那個對比，需要的是「一份
 * 涵蓋全球、每個點都帶人口數」的清單，而不是一份人口密度網格：
 *
 * - **人口密度網格**（SEDAC GPW、WorldPop）解析度夠細，但檔案以 GB 計，而且
 *   SEDAC 需要註冊帳號才能下載——本站的硬性限制是「不得引入需要金鑰的服務」，
 *   建置期也不想維護一個要登入的來源。
 * - **Natural Earth 的 `ne_10m_populated_places`** 是 public domain、免金鑰、
 *   一次抓完（19 MB），而且**帶著 `NAME_ZHT` 正體中文名**（見下），濾到百萬人以上
 *   只剩 505 筆、產物不到 100 KB。
 *
 * ⚠️ **代價要講清楚，而且寫進圖層的 `notes`**：這是**都會區人口**的點資料，不是
 * 人口密度。它畫得出「哪裡有大城市」，畫不出「鄉村人口有多密」——恆河平原、爪哇
 * 與尼羅河谷的鄉村密度是全球最高的幾處，在這一層上只會看到幾顆點。
 *
 * ## ⚠️ 中文名用 `NAME_ZHT`，不是 `NAME_ZH`
 *
 * `NAME_ZH` 是簡體（东京、圣保罗），`NAME_ZHT` 是正體而且用的是臺灣慣用譯名
 * （雪梨、沙加、聖荷西）。實測 505 筆**每一筆都有 `NAME_ZHT`**，所以不需要退回
 * 英文名的分支——但仍然留了 fallback，上游哪天缺一筆時應該是那一筆顯示英文名，
 * 而不是整層壞掉。
 *
 * ⚠️ 這跟 `basemaps.ts` 的底圖地名繁體化是**兩件事**：那邊改的是向量底圖的
 * `text-field` 表達式（`name:zh-Hant`），這裡是建置期把欄位寫進產物。
 *
 * ## ⚠️ 國名要另外 join，而且 join 的是 `ADM0_A3`
 *
 * populated places 只有英文國名（`ADM0NAME`）。中文國名從**同一個 Natural Earth
 * 家族**的國界檔（`ne_50m_admin_0_countries`，大洲分區已經在用的那一份）join 過來，
 * key 用三碼 ISO（`ADM0_A3` ↔ `ADM0_A3`）——⚠️ **不要用國名字串 join**：
 * 兩份檔案的英文寫法不完全一致（`United States of America` vs `United States`），
 * 而且香港、澳門這種在 populated places 裡是獨立 `ADM0_A3` 的地方會對不上。
 *
 * ⚠️ join 不到就退回英文國名（例如上游把某地標成 `-99`），**不要讓建置失敗**：
 * 卡片上少一個中文國名不影響這一層要教的事，但一次上游改版讓整個網站發不出去
 * 就本末倒置了。實測 505 筆裡對不上的是 0 筆。
 *
 * ## ⚠️ `POP_MIN` 有一條壞掉的尾巴，不可以照單全印
 *
 * 卡片的第二行原本無條件印「市轄區人口」（`POP_MIN`），實際打開巴黎那張卡才發現
 * 它寫的是 **1.1 萬**。逐筆量過：505 筆裡有 **24 筆的 `POP_MIN` 不到 `POP_MAX`
 * 的一成**，而那 24 筆每一個都是明顯壞掉的值——拉哥斯 0.2 萬／947 萬（0.02%）、
 * 巴黎 1.1／990、聖地亞哥 4.7／572、馬德里 5.0／557、羅馬 3.5／334。上游那個欄位
 * 對這些城市抓到的多半是某個小到不合理的行政核心。
 *
 * 一成到兩成半那一段（63 筆）相反，**全部是合理的**：東京 834／3,568（23%）、
 * 波士頓 59／447（13%）、深圳 100／758（13%）、里約 201／1,175（17%）——那正是
 * 「市轄區 vs 都會區」本來就該有的差距，也是這一行想教的東西。
 *
 * 所以門檻設在 **10%**：低於它就不印那一行（那 24 筆的卡片仍然有名稱、國家與
 * 都會區人口），其餘照印。⚠️ **不要改成無條件印**——在一張教地理的卡片上印
 * 「巴黎市轄區人口 1.1 萬」是把上游的錯誤當成事實教出去。
 */

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

/** 帶多語名稱的完整版（`_simple` 那一份沒有 `NAME_ZHT`，不要用）。 */
export const POPULATED_PLACES_URL = `${NE}/ne_10m_populated_places.geojson`;

export const LICENSE = "Natural Earth（public domain）";
export const SOURCE_LABEL = "Natural Earth 1:10m 城市聚落";

/**
 * 收錄門檻：都會區人口 100 萬。
 *
 * ⚠️ **這個數字是拿分布圖挑的，不是隨手取的整數**：實測 ≥100 萬有 505 筆、
 * ≥200 萬 216 筆、≥300 萬 121 筆、≥500 萬只剩 53 筆。要讓「亞洲季風區連成一片、
 * 撒哈拉與西伯利亞整片空白」這個對比出得來，需要的是前者那個量級——只畫 53 個
 * 特大都市時，畫面上剩下的是一串孤立的點，看不出「帶狀分布」。
 *
 * ⚠️ 往下調到 50 萬會變成 1,100 多筆，世界尺度下東亞與西歐會糊成一團色塊
 * （這一層的圓點半徑最小只有 2.2 px），而且產物翻倍。
 */
export const MIN_POPULATION = 1_000_000;

/**
 * `POP_MIN` 至少要有 `POP_MAX` 的這個比例，那一行才印得出來。
 * ⚠️ 這個 0.1 是量出來的，不是猜的——理由與逐筆數字見檔頭。
 */
export const MIN_CORE_RATIO = 0.1;

/** 產物筆數的自我檢查（上游改版或篩選寫壞時，這一層會靜默變成空圖層）。 */
export const EXPECTED_MIN_CITIES = 400;
export const EXPECTED_MAX_CITIES = 700;

/** 「3568 萬」這種好讀的寫法；一億以上才進位到「億」。 */
export function formatPopulation(n) {
  if (n >= 1e8) {
    const yi = n / 1e8;
    return `${yi.toFixed(yi < 10 ? 2 : 1)} 億`;
  }
  const wan = n / 1e4;
  return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)} 萬`;
}

/** 英文名 → 小寫連字號 id（比照世界主要河流；撞名時由呼叫端補序號）。 */
function slugify(name) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "city"
  );
}

/**
 * 國界檔 → `ADM0_A3` → 中文國名。
 *
 * ⚠️ 只取需要的兩個欄位就丟掉幾何：那份檔案是 25 MB 的多邊形，整份留在記憶體裡
 * 沒有意義（同一個 process 裡大洲分區也會抓它，`fetchJson` 的快取會共用下載）。
 */
export function buildCountryNames(countriesGeojson) {
  const byCode = new Map();
  for (const f of countriesGeojson.features) {
    const p = f.properties;
    const code = p.ADM0_A3 ?? p.ISO_A3;
    const zh = p.NAME_ZHT || p.NAME_ZH;
    if (code && zh && !byCode.has(code)) byCode.set(code, zh);
  }
  return byCode;
}

/**
 * populated places → 產物 feature。
 *
 * `properties` 只留卡片與圖層用得到的欄位（比照 GVP 火山那一層的既有決定）：
 * `population` 餵半徑表達式，`meta`／`detail` 是 `FeatureCard` fallback 的兩行
 * ——這一層**沒有內容檔**，那兩行就是卡片的全部內容。
 */
export function buildCityFeatures(raw, countryNames) {
  const cities = raw.features
    .filter((f) => Number(f.properties.POP_MAX) >= MIN_POPULATION)
    // 由多到少：feature 順序就是清單順序（本站既有規則），也讓大點先畫、小點疊在上面
    .sort((a, b) => Number(b.properties.POP_MAX) - Number(a.properties.POP_MAX));

  const used = new Map();
  const features = cities.map((f) => {
    const p = f.properties;
    const popMax = Number(p.POP_MAX);
    const popMin = Number(p.POP_MIN) || 0;
    const name = p.NAME_ZHT || p.NAME_ZH || p.NAME;
    const country = countryNames.get(p.ADM0_A3) ?? p.ADM0NAME;

    // 撞名的城市（伯明罕、聖荷西、達卡…）靠序號區分，比照世界主要河流的 `nile-15`
    const base = slugify(p.NAMEASCII || p.NAME);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;

    const capital = p.ADM0CAP === 1 ? "首都・" : "";
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(p.LONGITUDE), Number(p.LATITUDE)] },
      properties: {
        id,
        name,
        /** 搜尋 haystack 會收 `en`，卡片標題也會把原名放在中文名旁邊 */
        en: p.NAME,
        meta: `${capital}${country}・都會區人口 ${formatPopulation(popMax)}`,
        /**
         * ⚠️ `POP_MIN` 是**市轄區**人口、`POP_MAX` 是**都會區**（含衛星市鎮）。
         * 兩個一起寫出來才看得懂為什麼「東京 3,568 萬」跟課本寫的「東京都 1,400 萬」
         * 對不上——那正是「都市範圍怎麼定義」這一課。
         *
         * ⚠️ 兩者相同時不重複寫（上游有 47 筆是這樣），⚠️ 而 `POP_MIN` 小於
         * `POP_MAX` 一成時**那個值是壞的**（巴黎 1.1 萬、拉哥斯 0.2 萬），寧可
         * 不印也不要印一個錯的——理由與逐筆數字見檔頭。
         */
        detail:
          popMin && popMin < popMax && popMin >= popMax * MIN_CORE_RATIO
            ? `市轄區人口 ${formatPopulation(popMin)}（都會區與市轄區的差別就是衛星市鎮）`
            : undefined,
        population: popMax,
      },
    };
  });

  return { features, count: features.length };
}
