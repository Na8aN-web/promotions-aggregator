import * as crypto from "node:crypto";
import type { ScrapeJob } from "@promo/shared";

const jobs = new Map<string, ScrapeJob>();

export function createJob(): ScrapeJob {
  const job: ScrapeJob = {
    jobId: crypto.randomUUID(),
    status: "queued",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    promotionsScraped: null,
    brandsScraped: null,
    error: null,
  };
  jobs.set(job.jobId, job);
  return job;
}

export function getJob(jobId: string): ScrapeJob | null {
  return jobs.get(jobId) ?? null;
}

export function updateJob(jobId: string, patch: Partial<ScrapeJob>): void {
  const existing = jobs.get(jobId);
  if (!existing) return;
  jobs.set(jobId, { ...existing, ...patch });
}