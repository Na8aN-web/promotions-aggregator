import { createApp } from "./server/app.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`✓ API listening on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  GET  /promotions     (?search, ?startDate, ?endDate, ?brand, ?page, ?pageSize)`);
  console.log(`  GET  /promotions/:id`);
  console.log(`  GET  /brands`);
  console.log(`  POST /scrape`);
  console.log(`  GET  /scrape/:jobId`);
});