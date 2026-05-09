import {
  brandSchema,
  brandWithCountSchema,
  type Brand,
  type BrandWithCount,
} from "@promo/shared";
import { db } from "./index.js";

interface BrandRow {
  id: string;
  name: string;
  website_url: string | null;
  hours_json: string | null;
  social_json: string;
  source_url: string;
  source_portal: string;
  scraped_at: string;
}

function rowToBrand(row: BrandRow): Brand {
  return brandSchema.parse({
    id: row.id,
    name: row.name,
    websiteUrl: row.website_url,
    hours: row.hours_json ? JSON.parse(row.hours_json) : null,
    socialLinks: JSON.parse(row.social_json),
    sourceUrl: row.source_url,
    sourcePortal: row.source_portal,
    scrapedAt: row.scraped_at,
  });
}

const upsertStmt = db.prepare(`
INSERT INTO brands (
  id, name, website_url, hours_json, social_json,
  source_url, source_portal, scraped_at
) VALUES (
  @id, @name, @websiteUrl, @hoursJson, @socialJson,
  @sourceUrl, @sourcePortal, @scrapedAt
)
ON CONFLICT(id) DO UPDATE SET
  name          = excluded.name,
  website_url   = excluded.website_url,
  hours_json    = excluded.hours_json,
  social_json   = excluded.social_json,
  source_url    = excluded.source_url,
  source_portal = excluded.source_portal,
  scraped_at    = excluded.scraped_at;
`);

export function upsertBrand(b: Brand): void {
  upsertStmt.run({
    id: b.id,
    name: b.name,
    websiteUrl: b.websiteUrl,
    hoursJson: b.hours ? JSON.stringify(b.hours) : null,
    socialJson: JSON.stringify(b.socialLinks),
    sourceUrl: b.sourceUrl,
    sourcePortal: b.sourcePortal,
    scrapedAt: b.scrapedAt,
  });
}

export function getBrandById(id: string): Brand | null {
  const row = db
    .prepare("SELECT * FROM brands WHERE id = ?")
    .get(id) as BrandRow | undefined;
  return row ? rowToBrand(row) : null;
}

export function listBrandsWithCount(): BrandWithCount[] {
  const rows = db
    .prepare(
      `SELECT b.*, COUNT(p.id) AS promotion_count
       FROM brands b
       LEFT JOIN promotions p ON p.brand_id = b.id
       GROUP BY b.id
       ORDER BY b.name ASC`,
    )
    .all() as Array<BrandRow & { promotion_count: number }>;

  return rows.map((row) =>
    brandWithCountSchema.parse({
      ...rowToBrand(row),
      promotionCount: row.promotion_count,
    }),
  );
}