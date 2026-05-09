import { z } from "zod";

/**
 * Known social media platforms. "other" is a fallback for platforms we
 * don't explicitly recognize — keeps the union closed for type safety
 * while remaining flexible.
 */
export const socialPlatformSchema = z.enum([
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "twitter",
  "youtube",
  "pinterest",
  "linkedin",
  "other",
]);
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;

export const socialLinkSchema = z.object({
  platform: socialPlatformSchema,
  url: z.string().url(),
});
export type SocialLink = z.infer<typeof socialLinkSchema>;

/**
 * One day's open/close window. Times are local "HH:mm" — we don't store
 * timezone here; the consumer assumes the source portal's local time.
 * `open === null && close === null` means closed that day.
 */
export const dayHoursSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  open: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});
export type DayHours = z.infer<typeof dayHoursSchema>;

/**
 * Brand operating hours.
 * - `raw` is always populated — the unparsed string we scraped, used as
 *   a fallback in the UI and as a debugging anchor.
 * - `weekly` is the structured representation, or null if we couldn't
 *   parse the raw string into a weekly schedule.
 */
export const brandHoursSchema = z.object({
  raw: z.string(),
  weekly: z.array(dayHoursSchema).nullable(),
});
export type BrandHours = z.infer<typeof brandHoursSchema>;

/**
 * A brand. Normalized as a separate entity (see DESIGN.md) — many
 * promotions reference one brand by id.
 */
export const brandSchema = z.object({
  id: z.string(),                              // stable id (slug derived from sourceUrl)
  name: z.string().min(1),
  websiteUrl: z.string().url().nullable(),     // brand's own site, not the mall portal
  hours: brandHoursSchema.nullable(),          // null if not present on the source
  socialLinks: z.array(socialLinkSchema),      // [] if none — never null
  sourceUrl: z.string().url(),                 // brand's directory page on the mall portal
  sourcePortal: z.string(),                    // hostname of the source portal
  scrapedAt: z.string().datetime(),            // ISO 8601
});
export type Brand = z.infer<typeof brandSchema>;