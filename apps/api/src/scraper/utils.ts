import * as crypto from "node:crypto";

export function stableId(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 16);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function parseLooseDate(text: string, fallbackYear?: number): string | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const slash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash && slash[1] && slash[2] && slash[3]) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  const long = text.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (long && long[1] && long[2]) {
    const monthIdx = MONTHS.indexOf(long[1].toLowerCase());
    if (monthIdx >= 0) {
      const day = parseInt(long[2], 10);
      if (day >= 1 && day <= 31) {
        const year = long[3]
          ? parseInt(long[3], 10)
          : (fallbackYear ?? new Date().getFullYear());
        return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  return null;
}

export function findDateRange(text: string): { start: string | null; end: string | null } {
  const sep = /\s+(?:-|–|to|through|thru)\s+/i;
  const parts = text.split(sep);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const start = parseLooseDate(parts[0]);
    const end = parseLooseDate(parts[1]);
    if (start || end) return { start, end };
  }
  return { start: null, end: parseLooseDate(text) };
}