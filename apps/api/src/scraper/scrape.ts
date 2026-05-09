import { chromium, type Page } from "playwright";
import {
    type Brand,
    type Promotion,
    type SocialLink,
    type SocialPlatform,
    SOURCE_PORTAL,
    SOURCE_LISTING_URL,
} from "@promo/shared";
import { upsertBrand } from "../db/brands.js";
import { upsertPromotion } from "../db/promotions.js";
import { stableId, sleep, findDateRange } from "./utils.js";

// ─── Politeness (NFR2) ───────────────────────────────────────────────
const POLITENESS_DELAY_MS = 1000;
const USER_AGENT =
    "promotions-aggregator-takehome/0.1 (+contact: jane.ugwu16@gmail.com)";

// ─── Social-domain → platform mapping ────────────────────────────────
const SOCIAL_DOMAINS: Record<string, SocialPlatform> = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "tiktok.com": "tiktok",
    "twitter.com": "twitter",
    "x.com": "x",
    "youtube.com": "youtube",
    "pinterest.com": "pinterest",
    "linkedin.com": "linkedin",
};

export interface ScrapeResult {
    promotionsScraped: number;
    brandsScraped: number;
    errors: string[];
}

// ─── Orchestrator ────────────────────────────────────────────────────
export async function runScrape(
    onLog: (msg: string) => void = console.log,
): Promise<ScrapeResult> {
    const errors: string[] = [];
    const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: USER_AGENT });

  // Polyfill __name in the browser context. tsx/esbuild rewrites named
  // arrow functions inside our evaluate callbacks as __name(fn, "name")
  // for keep-names support. That helper doesn't exist in the browser, so
  // we inject a no-op shim that gets it out of the way.
  await ctx.addInitScript(`
    if (typeof globalThis.__name === 'undefined') {
      globalThis.__name = function(fn) { return fn; };
    }
  `);

  const page = await ctx.newPage();

    let promotionsScraped = 0;
    const seenBrandUrls = new Set<string>();

    try {
        onLog(`→ loading listing: ${SOURCE_LISTING_URL}`);
        await page.goto(SOURCE_LISTING_URL, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => { });

        // Pull every distinct /deals/<id>/ link off the listing page.
        const dealUrls = await page.$$eval("a", (anchors) => {
            const seen = new Set<string>();
            const out: string[] = [];
            for (const a of anchors as HTMLAnchorElement[]) {
                if (!a.href) continue;
                const m = a.href.match(/\/deals\/(\d+)\/?/);
                if (m && m[1] && !seen.has(m[1])) {
                    seen.add(m[1]);
                    out.push(a.href);
                }
            }
            return out;
        });

        onLog(`✓ found ${dealUrls.length} unique promotion URLs`);

        // For each promo: scrape detail, then scrape its brand if we haven't yet.
        for (const dealUrl of dealUrls) {
            try {
                await sleep(POLITENESS_DELAY_MS);
                const result = await scrapeDealPage(page, dealUrl, onLog);
                if (!result) continue;

                if (result.brandUrl && !seenBrandUrls.has(result.brandUrl)) {
                    seenBrandUrls.add(result.brandUrl);
                    await sleep(POLITENESS_DELAY_MS);
                    try {
                        const brand = await scrapeBrandPage(page, result.brandUrl, onLog);
                        if (brand) upsertBrand(brand);
                    } catch (err) {
                        const msg = `brand scrape failed for ${result.brandUrl}: ${err instanceof Error ? err.message : String(err)}`;
                        errors.push(msg);
                        onLog(`⚠ ${msg}`);
                    }
                }

                upsertPromotion(result.promotion);
                promotionsScraped++;
            } catch (err) {
                const msg = `deal scrape failed for ${dealUrl}: ${err instanceof Error ? err.message : String(err)}`;
                errors.push(msg);
                onLog(`⚠ ${msg}`);
            }
        }
    } finally {
        await browser.close();
    }

    return {
        promotionsScraped,
        brandsScraped: seenBrandUrls.size,
        errors,
    };
}

// ─── Deal page parser ────────────────────────────────────────────────
interface ScrapedDeal {
    promotion: Promotion;
    brandUrl: string | null;
}

async function scrapeDealPage(
    page: Page,
    dealUrl: string,
    onLog: (msg: string) => void,
): Promise<ScrapedDeal | null> {
    onLog(`→ fetching deal: ${dealUrl}`);
    await page.goto(dealUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => { });

    // page.evaluate() runs in the BROWSER context — `document` is real DOM.
    const data = await page.evaluate(() => {
        const text = (s: string) => document.querySelector(s)?.textContent?.trim() || null;
        const attr = (s: string, a: string) => document.querySelector(s)?.getAttribute(a) || null;

        const title =
            text("h1") ||
            text("h2") ||
            document.title.replace(/\|.*$/, "").trim();

        const description =
            text("[class*='description']") ||
            text("article p") ||
            text("main p") ||
            null;

        const imageUrl =
            attr("meta[property='og:image']", "content") ||
            attr("article img", "src") ||
            attr("main img", "src") ||
            attr("img", "src");

        // First /stores/<id>/ anchor on the page = the brand
        const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
        const brandUrl = anchors.find((a) => /\/stores\/\d+/.test(a.href))?.href || null;

        const bodyText = document.body.innerText;
        return { title, description, imageUrl, brandUrl, bodyText };
    });

    if (!data.title) return null;

    // Use the source portal's own numeric ID as our stable id (clean, dedup-safe).
    const idMatch = dealUrl.match(/\/deals\/(\d+)/);
    const id = idMatch ? `deal-${idMatch[1]}` : stableId(dealUrl);

    // Look for date range first in description, then in body text.
    const dateSource = `${data.description ?? ""} ${data.bodyText.slice(0, 2000)}`;
    const { start, end } = findDateRange(dateSource);

    const brandId = data.brandUrl
        ? (() => {
            const m = data.brandUrl.match(/\/stores\/(\d+)/);
            return m ? `brand-${m[1]}` : null;
        })()
        : null;

    const promotion: Promotion = {
        id,
        name: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        startDate: start,
        endDate: end,
        sourceUrl: dealUrl,
        sourcePortal: SOURCE_PORTAL,
        brandId,
        scrapedAt: new Date().toISOString(),
    };

    return { promotion, brandUrl: data.brandUrl };
}

// ─── Brand page parser ───────────────────────────────────────────────
async function scrapeBrandPage(
    page: Page,
    brandUrl: string,
    onLog: (msg: string) => void,
): Promise<Brand | null> {
    onLog(`  → fetching brand: ${brandUrl}`);
    await page.goto(brandUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => { });

    const data = await page.evaluate(() => {
        const text = (s: string) => document.querySelector(s)?.textContent?.trim() || null;

        const name = text("h1") || text("h2") || document.title.replace(/\|.*$/, "").trim();

        // Hours: prefer a heading-then-sibling pattern, else a class-based selector.
        let hoursRaw: string | null = null;
        const hoursHeader = Array.from(
            document.querySelectorAll("h1, h2, h3, h4, dt, strong"),
        ).find((el) => /hours/i.test(el.textContent || ""));
        if (hoursHeader) {
            hoursRaw = hoursHeader.nextElementSibling?.textContent?.trim() || null;
        }
        if (!hoursRaw) {
            hoursRaw = text("[class*='hours' i]");
        }

        // Collect external anchors so Node can classify them as social vs website.
        const anchors = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
        const externals: { href: string; hostname: string }[] = [];
        for (const a of anchors) {
            if (!a.href) continue;
            try {
                const u = new URL(a.href);
                if (u.hostname && !u.hostname.endsWith("thepromenadeshopsatbriargate.com")) {
                    externals.push({ href: a.href, hostname: u.hostname.replace(/^www\./, "") });
                }
            } catch { }
        }

        return { name, hoursRaw, externals };
    });

    if (!data.name) return null;

    const idMatch = brandUrl.match(/\/stores\/(\d+)/);
    const id = idMatch ? `brand-${idMatch[1]}` : stableId(brandUrl);

    // Classify externals: known social domain → SocialLink, otherwise first one wins as website.
    const socialLinks: SocialLink[] = [];
    let websiteUrl: string | null = null;
    for (const ext of data.externals) {
        const platform = matchSocial(ext.hostname);
        if (platform) {
            socialLinks.push({ platform, url: ext.href });
        } else if (!websiteUrl) {
            websiteUrl = ext.href;
        }
    }

    return {
        id,
        name: data.name,
        websiteUrl,
        hours: data.hoursRaw ? { raw: data.hoursRaw, weekly: null } : null,
        socialLinks: dedupSocials(socialLinks),
        sourceUrl: brandUrl,
        sourcePortal: SOURCE_PORTAL,
        scrapedAt: new Date().toISOString(),
    };
}

function matchSocial(hostname: string): SocialPlatform | null {
    for (const [domain, platform] of Object.entries(SOCIAL_DOMAINS)) {
        if (hostname === domain || hostname.endsWith("." + domain)) return platform;
    }
    return null;
}

function dedupSocials(links: SocialLink[]): SocialLink[] {
    const seen = new Set<string>();
    return links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}