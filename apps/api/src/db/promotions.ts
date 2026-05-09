import {
  promotionSchema,
  type Promotion,
  type GetPromotionsQuery,
  type PaginatedPromotions,
} from "@promo/shared";
import { db } from "./index.js";

interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string;
  source_portal: string;
  brand_id: string | null;
  scraped_at: string;
}

function rowToPromotion(row: PromotionRow): Promotion {
  return promotionSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    startDate: row.start_date,
    endDate: row.end_date,
    sourceUrl: row.source_url,
    sourcePortal: row.source_portal,
    brandId: row.brand_id,
    scrapedAt: row.scraped_at,
  });
}

const upsertStmt = db.prepare(`
INSERT INTO promotions (
  id, name, description, image_url, start_date, end_date,
  source_url, source_portal, brand_id, scraped_at
) VALUES (
  @id, @name, @description, @imageUrl, @startDate, @endDate,
  @sourceUrl, @sourcePortal, @brandId, @scrapedAt
)
ON CONFLICT(id) DO UPDATE SET
  name          = excluded.name,
  description   = excluded.description,
  image_url     = excluded.image_url,
  start_date    = excluded.start_date,
  end_date      = excluded.end_date,
  source_url    = excluded.source_url,
  source_portal = excluded.source_portal,
  brand_id      = excluded.brand_id,
  scraped_at    = excluded.scraped_at;
`);

export function upsertPromotion(p: Promotion): void {
  upsertStmt.run({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    startDate: p.startDate,
    endDate: p.endDate,
    sourceUrl: p.sourceUrl,
    sourcePortal: p.sourcePortal,
    brandId: p.brandId,
    scrapedAt: p.scrapedAt,
  });
}

export function getPromotionById(id: string): Promotion | null {
  const row = db
    .prepare("SELECT * FROM promotions WHERE id = ?")
    .get(id) as PromotionRow | undefined;
  return row ? rowToPromotion(row) : null;
}

export function listPromotions(q: GetPromotionsQuery): PaginatedPromotions {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (q.search) {
    where.push(
      "(name LIKE @search COLLATE NOCASE OR COALESCE(description, '') LIKE @search COLLATE NOCASE)",
    );
    params.search = `%${q.search}%`;
  }
  if (q.brand) {
    where.push("brand_id = @brand");
    params.brand = q.brand;
  }
  // Date-range filter: "promotions whose run window overlaps [startDate, endDate]".
  // Null start_date is treated as -infinity; null end_date as +infinity.
 if (q.startDate) {
    // Deal must START on or after the user's startDate (strict containment).
    where.push("(start_date IS NOT NULL AND start_date >= @startDate)");
    params.startDate = q.startDate;
  }
  if (q.endDate) {
    // Deal must END on or before the user's endDate (strict containment).
    where.push("(end_date IS NOT NULL AND end_date <= @endDate)");
    params.endDate = q.endDate;
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const offset = (q.page - 1) * q.pageSize;

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM promotions ${whereSql}`)
    .get(params) as { c: number };
  const total = totalRow.c;

  const rows = db
    .prepare(
      `SELECT * FROM promotions ${whereSql}
       ORDER BY COALESCE(end_date, '9999-12-31') ASC, name ASC
       LIMIT @pageSize OFFSET @offset`,
    )
    .all({ ...params, pageSize: q.pageSize, offset }) as PromotionRow[];

  return {
    items: rows.map(rowToPromotion),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}