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
