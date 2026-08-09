import { z } from "zod";

/** 課程主題分類。新增分類時要同步更新 UI 的篩選器與 CLAUDE.md。 */
export const TopicSchema = z.enum([
  "landform", // 地形
  "climate", // 氣候
  "hydrology", // 水文
  "human", // 人文（人口、聚落、產業）
]);

export const LevelSchema = z.enum(["junior", "senior"]);

export const RegionSchema = z.enum(["taiwan", "world"]);

export const PlaceSchema = z.object({
  /** 檔名（不含副檔名）必須等於 id */
  id: z.string().regex(/^[a-z0-9-]+$/, "id 只能用小寫英數與連字號"),
  name: z.object({ zh: z.string(), en: z.string() }),
  coord: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  /** 海拔（公尺）。全站單位一律公制。 */
  elevation_m: z.number(),
  region: RegionSchema,
  topics: z.array(TopicSchema).min(1),
  /** 柯本氣候分類代碼，如 Cfa、BWh、Af */
  koppen: z.string().regex(/^[A-E][a-zA-Z]{0,2}$/),
  /** 地形類型的簡短描述，如「盆地」「高山」「沙漠」 */
  landform: z.string(),
  /** 地圖預設視角，缺省時用 coord + zoom 9 */
  defaultZoom: z.number().min(0).max(16).optional(),
  facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .min(1),
  curriculum: z.object({ level: LevelSchema, unit: z.string() }),
  /** 資料來源。每一筆地點資料都必須標註出處。 */
  sources: z.array(z.string()).min(1),
});

export type Place = z.infer<typeof PlaceSchema>;
export type Topic = z.infer<typeof TopicSchema>;

/** build-climate.mjs 產生的氣候正常值檔案格式。 */
export const ClimateSchema = z.object({
  placeId: z.string(),
  period: z.string(),
  source: z.string(),
  /** 12 個月的月均溫（°C），index 0 = 一月 */
  temperature_c: z.array(z.number()).length(12),
  /** 12 個月的月累積雨量（mm），index 0 = 一月 */
  precipitation_mm: z.array(z.number()).length(12),
});

export type Climate = z.infer<typeof ClimateSchema>;

/**
 * 台灣原住民族分佈（人文地理）。
 *
 * `representativeCoord` 是文化園區、部落大會地點或行政中心，
 * 用來在地圖上標出「這裡有這個族群」，**不是**正式的分布邊界或行政區界線。
 * UI 文案與資料撰寫都要避免暗示這是精確的地理範圍。
 */
export const IndigenousGroupSchema = z.object({
  /** 檔名（不含副檔名）必須等於 id */
  id: z.string().regex(/^[a-z0-9-]+$/, "id 只能用小寫英數與連字號"),
  name: z.object({ zh: z.string(), en: z.string() }),
  representativeCoord: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  /** 主要分布縣市，文字列表，不是邊界資料 */
  mainDistribution: z.array(z.string()).min(1),
  populationEstimate: z.number().optional(),
  /** 人口統計的年度，如 "2024"。有填人口數就要填年度，方便追溯時效性 */
  populationYear: z.string().optional(),
  language: z.string().optional(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
  curriculum: z.object({ level: LevelSchema, unit: z.string() }),
  sources: z.array(z.string()).min(1),
});

export type IndigenousGroup = z.infer<typeof IndigenousGroupSchema>;

/** 物種分類，用於物種清單的圖示／篩選 */
export const SpeciesCategorySchema = z.enum([
  "mammal", // 哺乳類
  "bird", // 鳥類
  "fish", // 魚類
  "amphibian", // 兩棲類
  "reptile", // 爬蟲類
  "insect", // 昆蟲
]);

/**
 * 台灣特有種物種基本資料（自然地理／生態）。
 *
 * 這裡只放不會變動的物種介紹文字，**不含座標**——座標由
 * scripts/build-species.mjs 在建置期向 GBIF 查詢真實觀測紀錄產生，
 * 見 SpeciesOccurrenceSchema。
 */
export const SpeciesSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id 只能用小寫英數與連字號"),
  name: z.object({ zh: z.string(), en: z.string(), latin: z.string() }),
  /**
   * GBIF 的物種 taxonKey（用 https://api.gbif.org/v1/species/match?name=<學名>
   * 查一次取得），build-species.mjs 用這個精準查詢觀測紀錄，避免用學名字串
   * 查詢時跟同名異種或亞種混淆。
   */
  gbifTaxonKey: z.number().int().positive(),
  category: SpeciesCategorySchema,
  /** 保育等級，如「珍貴稀有保育類」，沒有正式列管就留空 */
  conservationStatus: z.string().optional(),
  habitat: z.string(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
  curriculum: z.object({ level: LevelSchema, unit: z.string() }),
  sources: z.array(z.string()).min(1),
});

export type Species = z.infer<typeof SpeciesSchema>;

/**
 * build-species.mjs 產生的物種觀測點 GeoJSON 格式，來源是 GBIF occurrence API。
 * 請勿手動編輯——內容過時或想調整筆數上限，重新執行 `npm run build:species` 產生。
 */
export const SpeciesOccurrenceSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        speciesId: z.string(),
        /** GBIF 紀錄的觀測日期，部分歷史紀錄沒有精確日期 */
        date: z.string().nullable(),
        /** GBIF 的紀錄類型，如 HUMAN_OBSERVATION、PRESERVED_SPECIMEN */
        basisOfRecord: z.string(),
      }),
    }),
  ),
});

export type SpeciesOccurrence = z.infer<typeof SpeciesOccurrenceSchema>;
