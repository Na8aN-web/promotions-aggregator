import { SOURCE_PORTAL } from "@promo/shared";
import { upsertBrand, getBrandById, listBrandsWithCount } from "../db/brands.js";
import {
  upsertPromotion,
  getPromotionById,
  listPromotions,
} from "../db/promotions.js";

const now = new Date().toISOString();

upsertBrand({
  id: "test-brand",
  name: "Test Brand",
  websiteUrl: "https://example.com",
  hours: { raw: "Mon–Sat 10–9", weekly: null },
  socialLinks: [{ platform: "instagram", url: "https://instagram.com/test" }],
  sourceUrl: "https://example.com/brand/test",
  sourcePortal: SOURCE_PORTAL,
  scrapedAt: now,
});

upsertPromotion({
  id: "test-promo",
  name: "20% off everything",
  description: "Storewide sale this weekend",
  imageUrl: "https://example.com/img.jpg",
  startDate: "2026-05-09",
  endDate: "2026-05-15",
  sourceUrl: "https://example.com/promo/test",
  sourcePortal: SOURCE_PORTAL,
  brandId: "test-brand",
  scrapedAt: now,
});

console.log("\n— getBrandById('test-brand') —");
console.log(getBrandById("test-brand"));

console.log("\n— getPromotionById('test-promo') —");
console.log(getPromotionById("test-promo"));

console.log("\n— listBrandsWithCount() —");
console.log(listBrandsWithCount());

console.log("\n— listPromotions({ page:1, pageSize:10 }) —");
console.log(listPromotions({ page: 1, pageSize: 10 }));

console.log("\n— listPromotions({ search: 'weekend' }) —");
console.log(
  listPromotions({ page: 1, pageSize: 10, search: "weekend" }),
);

console.log("\n✓ db smoke test passed\n");