/**
 * 內政部戶政司「各鄉鎮市區人口密度」的存取層（政府資料開放平臺資料集 8410）。
 *
 * 產出 `public/data/geo/tw-population.geojson`：368 個**鄉鎮形心上的點**，
 * 半徑代表年底人口數、顏色代表人口密度。幾何跟作物層一樣直接讀已經產好的
 * `tw-townships.geojson`，所以**建置順序有相依**（先鄉鎮界，再這一層）。
 *
 * ⚠️ 這份統計的縣市層級數字，就是 22 個縣市內容檔（`src/content/geo/tw-counties/`）
 * 面積／人口／人口密度的同一個來源。要改年份的話**兩邊要一起改**，否則卡片上
 * 「臺北市 244.0 萬」與圓點加總會對不起來，而畫面上沒有任何線索解釋為什麼。
 */

/** 資料集 8410「各鄉鎮市區人口密度」。一年更新一次（年底統計）。 */
export const DATASET_ID = 8410;
export const LICENSE = "政府資料開放授權條款第 1 版";
export const SOURCE_LABEL = "內政部戶政司";

/**
 * 要取用的統計年度（民國）。
 *
 * ⚠️ **刻意寫死，不取「最新的那一份」。** 上游同一個資料集底下掛著 102–114 年
 * 十幾份 CSV，自動挑最大的那個年份，會讓網站的人口數字在某天上游補檔之後**靜默
 * 改變**，而 22 個縣市內容檔裡的數字是人工寫的、不會跟著動——兩邊立刻對不起來。
 * 升級年份是要順手更新那 22 份內容檔與 `sources` 年份標示的事件，該由人決定。
 */
export const STAT_YEAR = 114;

/**
 * ⚠️ **東沙群島與南沙群島這兩列的人口是「…」，不是數字。**
 *
 * 這跟當初聚合縣市人口時踩到的是同一個坑：不濾掉的話 `Number()` 會得到 NaN，
 * 半徑表達式拿到 NaN 在 maplibre 裡**不會報錯**，只是那顆點靜靜地不見。
 * 它們也沒有對應的鄉鎮界圖徵（那兩處在圖資裡屬於高雄市旗津區以外的獨立島群），
 * 所以正確的處理就是跳過並回報，不是補 0——0 人跟「沒有統計」是兩件事。
 */
const isMissing = (v) => !/^\d+$/.test(String(v ?? "").trim());

/** 上游把「臺」寫成「台」的老問題。比照 lib/crops.mjs，兩邊都要正規化。 */
const normalize = (s) => (s ?? "").replace(/台/g, "臺").trim();

/**
 * `site_id` 是「縣市＋鄉鎮」黏在一起的一個字串（`新北市板橋區`），沒有分欄。
 *
 * 縣市名一律是 3 個字（`臺北市`／`新北市`／`嘉義縣`／`連江縣`…），所以固定切前 3 個字
 * 就對——實測 368 筆全部命中，沒有例外。⚠️ 不要改成「找第一個『市』或『縣』就切」：
 * 那會把 `新竹縣竹北市` 切成 `新竹縣竹` + `北市`，而且**不會報錯**。
 */
export function splitSite(siteId) {
  const s = normalize(siteId);
  return { county: s.slice(0, 3), town: s.slice(3) };
}

/**
 * 鄉鎮的行政層級——「都市體系」那一半就靠它。
 *
 * 判準是鄉鎮名的**末字**，那是《地方制度法》的層級本身：直轄市與市底下設「區」、
 * 縣底下依人口與發展程度設「縣轄市」「鎮」「鄉」。原住民族地區的「山地原住民區」
 * 末字也是「區」，這裡不另外分——它在地方制度法上確實是區。
 *
 * ⚠️ 這是**行政層級**，不是主計總處定義的「都會區」。圖層說明要講清楚，
 * 不要讓學生把「板橋區是區」讀成「板橋是都會區中心」。
 */
export function adminLevel(town) {
  const last = town.at(-1);
  if (last === "區") return "區";
  if (last === "市") return "縣轄市";
  if (last === "鎮") return "鎮";
  return "鄉";
}

/** 可點清單的分組順序：由都市往鄉村。`browse.groupBy` 是依序切、不排序的。 */
export const LEVEL_ORDER = ["區", "縣轄市", "鎮", "鄉"];

/** 給人看的人口字串。個位數的人沒有意義，破萬就換成「萬人」。 */
export function formatPopulation(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 萬人`;
  return `${n.toLocaleString("en-US")} 人`;
}

/**
 * 抓取並剖析。回傳 `{ rows, warnings }`，`rows` 是 `{ county, town, pop, area, density }`。
 *
 * 上游是 CSV 而且**前兩列都是標頭**（第 1 列英文欄名、第 2 列中文欄名），
 * 只跳過一列會把「統計年／區域別／年底人口數…」那一列當成一個叫「統計年」的鄉鎮。
 */
export async function fetchPopulation(fetchWithRetry, resolveDataGovTwUrl) {
  // resolveDataGovTwUrl 要求**剛好命中一個**資源。⚠️ 這個資料集底下的 113 年有
  // 兩份同名 CSV，所以錨定開頭的 `^114年` 是必要的——寫成 `/114/` 會連 `114年` 以外
  // 的敘述也命中，而寫得太鬆的下場是建置直接失敗（這是好事，總比挑到別年好）。
  const url = await resolveDataGovTwUrl(DATASET_ID, new RegExp(`^${STAT_YEAR}年`));
  const res = await fetchWithRetry(url);
  const text = (await res.text()).replace(/^﻿/, "");

  const lines = text.trim().split(/\r?\n/).slice(2);
  const rows = [];
  const skipped = [];
  for (const line of lines) {
    const [, siteId, pop, area, density] = line.split(",");
    if (isMissing(pop)) {
      skipped.push(normalize(siteId));
      continue;
    }
    const { county, town } = splitSite(siteId);
    rows.push({
      county,
      town,
      pop: Number(pop),
      area: Number(area),
      density: Number(density),
    });
  }

  const warnings = [];
  if (skipped.length) {
    // 東沙群島與南沙群島。列出來而不是靜默跳過——哪天多一筆是要有人看到的
    warnings.push(`人口欄不是數字而跳過：${skipped.join("、")}`);
  }
  warnings.push(
    `${STAT_YEAR} 年底統計 ${rows.length} 個鄉鎮市區，合計 ${formatPopulation(
      rows.reduce((s, r) => s + r.pop, 0),
    )}`,
  );
  return { rows, warnings };
}
