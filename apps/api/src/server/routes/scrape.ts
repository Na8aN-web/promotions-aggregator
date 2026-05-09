import { Router } from "express";
import { runScrape } from "../../scraper/scrape.js";
import { createJob, getJob, updateJob } from "../jobs.js";

export const scrapeRouter = Router();

// POST /scrape — kick off a job, return immediately
scrapeRouter.post("/", (_req, res) => {
  const job = createJob();

  // Fire-and-forget: don't await. The IIFE captures errors so they don't
  // become unhandled rejections.
  void (async () => {
    updateJob(job.jobId, { status: "running" });
    try {
      const result = await runScrape((msg) =>
        console.log(`[job ${job.jobId}] ${msg}`),
      );
      updateJob(job.jobId, {
        status: "done",
        finishedAt: new Date().toISOString(),
        promotionsScraped: result.promotionsScraped,
        brandsScraped: result.brandsScraped,
        error: result.errors.length
          ? `${result.errors.length} record(s) failed (logged to server)`
          : null,
      });
    } catch (err) {
      updateJob(job.jobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  res.status(202).json(job);
});

// GET /scrape/:jobId — poll status
scrapeRouter.get("/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});