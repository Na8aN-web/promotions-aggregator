import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { promotionsRouter } from "./routes/promotions.js";
import { brandsRouter } from "./routes/brands.js";
import { scrapeRouter } from "./routes/scrape.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/promotions", promotionsRouter);
  app.use("/brands", brandsRouter);
  app.use("/scrape", scrapeRouter);

  // Final error handler. The 4-arg signature is what tells Express this is
  // an error middleware (not a regular one).
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : String(err),
    });
  };
  app.use(errorHandler);

  return app;
}