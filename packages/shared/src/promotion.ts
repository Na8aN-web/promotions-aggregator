import { z } from "zod";

/** Date-only ISO 8601 string: "YYYY-MM-DD". Promotions don't carry time-of-day. */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/**
 * A promotion / sale event.
 *
 * Identity: `id` is derived from a hash of `sourceUrl`. Re-scrapes UPSERT
 * on this id, so duplicates are impossible. (See DESIGN.md — dedup strategy.)
 */
export const promotionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  startDate: dateString.nullable(),            // null when the source omits it
  endDate: dateString.nullable(),
  sourceUrl: z.string().url(),                 // canonical URL on the source site
  sourcePortal: z.string(),                    // hostname of the source portal
  brandId: z.string().nullable(),              // null if brand couldn't be resolved
  scrapedAt: z.string().datetime(),
});
export type Promotion = z.infer<typeof promotionSchema>;