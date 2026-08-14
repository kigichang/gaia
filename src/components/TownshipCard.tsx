import { useEffect, useState } from "react";
import { SourceLinks } from "./SourceLinks";
import { Stat } from "./PlaceCard";
import { resolveLayerData } from "../map/registry/resolve";

/**
 * 鄉鎮市區的詳情卡——**鄉鎮市區界、人口與都市體系、主要作物分布三層共用同一張**。
 *
 * ## 為什麼一張卡
 *
 * 三層講的是同一個實體（一個鄉鎮市區），所以它們的 featureId 都是官方 TOWNCODE，
 * `detail` 都是 `{ type: "township" }`。點鄉鎮的面、點人口圓點、點作物圓點，開出來
 * 的是逐字相同的一張卡。
 *
 * ## 為什麼資料自己抓，而不是從 instances 撿
 *
 * 從 `instances` 只撿得到**目前勾選中**那幾層的資料，於是同一個鄉鎮的卡片會因為
 * 使用者勾了什麼而長得不一樣——那是使用者無從預期的。這裡改成一律把五份抓齊：
 *
 *   data/geo/tw-townships.geojson                     （名稱、縣市、行政層級）
 *   data/geo/tw-population.geojson                    （人口、密度、面積）
 *   data/geo/tw-crops-{fruit,vegetable,tea}.geojson   （三類作物的年種植面積）
 *
 * 成本沒有看起來那麼高：`resolveLayerData()` 是模組層級的 Promise 快取，跟圖層本身
 * **以及搜尋索引**共用同一份，所以已經載入過的不會重抓，而搜尋索引本來就會抓這五份。
 *
 * ## 缺哪一段就不畫那一段
 *
 * 沒有農情調查資料的鄉鎮（都會區大多沒有，金門連江整個縣都沒有）**不顯示那一類**，
 * 不要填「0 公頃」——資料缺漏不是「種了 0 公頃」，比照水庫「暫無即時資料」與
 * 人口色階不宣告 nodata 的既有承諾。
 */

type Props = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/**
 * 三類作物的檔案與顯示名。順序＝卡片上的順序，跟圖層的子項目順序一致。
 *
 * `layerId` 跟著路徑一起放，是為了讓署名對得起來：`sources` 是**依實際畫出來的
 * 區塊**取聯集的，沒有作物資料的鄉鎮（連江與金門整個縣都不在農情調查裡）不該
 * 掛上農糧署——那等於替一份沒有出現在卡片上的資料署名。
 */
const CROP_FILES = [
  { label: "果樹", path: "data/geo/tw-crops-fruit.geojson" },
  { label: "蔬菜", path: "data/geo/tw-crops-vegetable.geojson" },
  { label: "茶", path: "data/geo/tw-crops-tea.geojson" },
] as const;

const TOWNSHIP = { layerId: "tw-townships", path: "data/geo/tw-townships.geojson" };
const POPULATION = { layerId: "tw-population", path: "data/geo/tw-population.geojson" };
const CROPS_LAYER_ID = "tw-crops";

interface TownshipData {
  township?: Props;
  population?: Props;
  crops: { label: string; props: Props }[];
}

/**
 * 把五份資料抓齊並依 id 併成一筆。
 *
 * 這支自己也做一層快取：五份合起來 900 KB 的 JSON，`features.find()` 五次雖然不貴，
 * 但每次換選取都重跑一遍沒有意義，而且 `resolveLayerData()` 回的是同一個物件。
 */
const cache = new Map<string, Promise<TownshipData>>();

function loadTownship(id: string): Promise<TownshipData> {
  const cached = cache.get(id);
  if (cached) return cached;

  const promise = (async (): Promise<TownshipData> => {
    const find = async (path: string): Promise<Props | undefined> => {
      const fc = await resolveLayerData({ type: "remote", path });
      return fc?.features.find((f) => f.properties?.id === id)?.properties ?? undefined;
    };
    const [township, population, ...crops] = await Promise.all([
      find(TOWNSHIP.path),
      find(POPULATION.path),
      ...CROP_FILES.map((c) => find(c.path)),
    ]);
    return {
      township,
      population,
      crops: CROP_FILES.flatMap((c, i) => {
        const props = crops[i];
        return props ? [{ label: c.label as string, props }] : [];
      }),
    };
  })();
  cache.set(id, promise);
  return promise;
}

function useTownship(id: string) {
  const [data, setData] = useState<TownshipData | null>(null);

  useEffect(() => {
    // 換鄉鎮時先清空，否則切換的瞬間會看到上一個鄉鎮的數字配新的標題
    setData(null);
    let cancelled = false;
    void loadTownship(id).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return data;
}

/**
 * @param seed 從已載入的圖層撿到的 properties（可能是三層任一層的）。只用來讓標題
 *   與縣市在抓取完成前就先出現，不必等 900 KB 的 JSON——點下去卡片是空的一秒鐘
 *   看起來像壞掉。
 */
export function TownshipCard({
  featureId,
  seed,
  sourcesByLayer,
}: {
  featureId: string;
  seed?: Props;
  /** 圖層 id → 該圖層的 `sources`。依實際畫出來的區塊取聯集，見 CROP_FILES 的說明。 */
  sourcesByLayer: Record<string, readonly string[]>;
}) {
  const data = useTownship(featureId);

  const township = data?.township ?? seed;
  const name = str(township?.name) ?? "鄉鎮市區";
  const subtitle = [str(township?.county), str(township?.level)].filter(Boolean).join("・");

  const pop = data?.population;
  const population = num(pop?.population);
  const density = num(pop?.density);
  const area = num(pop?.area_km2);

  // 只替**真的畫出來**的區塊署名。連江與金門整個縣都不在農情調查裡，那些鄉鎮的
  // 卡片沒有作物區塊，掛上農糧署等於替一份沒出現的資料署名。
  const sources = [
    ...new Set([
      ...(sourcesByLayer[TOWNSHIP.layerId] ?? []),
      ...(population != null ? (sourcesByLayer[POPULATION.layerId] ?? []) : []),
      ...(data && data.crops.length > 0 ? (sourcesByLayer[CROPS_LAYER_ID] ?? []) : []),
    ]),
  ];

  return (
    <div className="place-card">
      <h4 className="feature-title">{name}</h4>
      {subtitle && <p className="feature-subtitle">{subtitle}</p>}

      {population != null && (
        <div className="detail-stats">
          <Stat label="人口" value={formatPopulation(population)} />
          {density != null && (
            <Stat label="人口密度" value={`${density.toLocaleString("en-US")} 人/km²`} />
          )}
          {area != null && <Stat label="面積" value={`${area.toLocaleString("en-US")} km²`} />}
        </div>
      )}

      {data && data.crops.length > 0 && (
        <section className="township-crops" aria-label="主要作物">
          <h5 className="township-section-title">主要作物（年種植面積）</h5>
          <ul className="detail-facts">
            {data.crops.map(({ label, props }) => (
              <li key={label}>
                <span className="fact-label">{label}</span>
                <span className="fact-value">
                  {str(props.areaLabel) ?? "—"}
                  {str(props.top) && <span className="township-crop-top">{str(props.top)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!data && <p className="township-loading">人口與作物資料載入中…</p>}

      {/* 沒有任何統計的鄉鎮（例如離島的部分鄉）也要講清楚，不要留一片空白 */}
      {data && population == null && data.crops.length === 0 && (
        <p className="feature-fallback">這個鄉鎮市區沒有對應的人口或農情統計。</p>
      )}

      <p className="detail-sources">
        資料來源：
        <SourceLinks sources={sources} />
      </p>
    </div>
  );
}

/** 跟建置期 `lib/population.mjs` 的 `formatPopulation()` 同一個規則。 */
function formatPopulation(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 萬人`;
  return `${n.toLocaleString("en-US")} 人`;
}
