import { runScrape } from "../scraper/scrape.js";

async function main() {
  console.log("Starting scrape...\n");
  const t0 = Date.now();
  const result = await runScrape();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n✓ Scrape complete in ${elapsed}s`);
  console.log(`  Promotions: ${result.promotionsScraped}`);
  console.log(`  Brands:     ${result.brandsScraped}`);
  if (result.errors.length) {
    console.log(`  Errors:     ${result.errors.length}`);
    for (const err of result.errors.slice(0, 5)) {
      console.log(`    - ${err}`);
    }
    if (result.errors.length > 5) {
      console.log(`    ... and ${result.errors.length - 5} more`);
    }
  }
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});