import { z } from "zod";
import { brandSchema } from "./brand.js";
import { promotionSchema } from "./promotion.js";

/* ---------- GET /promotions ---------- */

export const getPromotionsQuerySchema = z.object({
  search: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  brand: z.string().optional(),                          // brand id
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});
export type GetPromotionsQuery = z.infer<typeof getPromotionsQuerySchema>;

export const paginatedPromotionsSchema = z.object({
  items: z.array(promotionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginatedPromotions = z.infer<typeof paginatedPromotionsSchema>;

/* ---------- GET /brands ---------- */

export const brandWithCountSchema = brandSchema.extend({
  promotionCount: z.number().int().min(0),
});
export type BrandWithCount = z.infer<typeof brandWithCountSchema>;

/* ---------- POST /scrape & GET /scrape/:jobId ---------- */

export const scrapeJobStatusSchema = z.enum([
  "queued",
  "running",
  "done",
  "failed",
]);
export type ScrapeJobStatus = z.infer<typeof scrapeJobStatusSchema>;

export const scrapeJobSchema = z.object({
  jobId: z.string(),
  status: scrapeJobStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  promotionsScraped: z.number().int().nullable(),
  brandsScraped: z.number().int().nullable(),
  error: z.string().nullable(),
});
export type ScrapeJob = z.infer<typeof scrapeJobSchema>;