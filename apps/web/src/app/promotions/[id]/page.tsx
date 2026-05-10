"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Promotion, BrandWithCount } from "@promo/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PromotionDetailPage({ params }: PageProps) {
  // Next 15+ delivers params as a Promise; `use()` unwraps it in a client component.
  const { id } = use(params);

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [brand, setBrand] = useState<BrandWithCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const promoRes = await fetch(`${API}/promotions/${id}`);
        if (promoRes.status === 404) {
          if (!cancelled) {
            setError("Promotion not found");
            setLoading(false);
          }
          return;
        }
        if (!promoRes.ok) throw new Error(`API ${promoRes.status}`);
        const promo = (await promoRes.json()) as Promotion;
        if (cancelled) return;
        setPromotion(promo);

        if (promo.brandId) {
          const brandsRes = await fetch(`${API}/brands`);
          if (brandsRes.ok) {
            const data = await brandsRes.json();
            const found =
              (data.items as BrandWithCount[]).find(
                (b) => b.id === promo.brandId,
              ) ?? null;
            if (!cancelled) setBrand(found);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-blue-600 underline"
      >
        ← Back to all promotions
      </Link>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && promotion && (
        <article>
          {promotion.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={promotion.imageUrl}
              alt={promotion.name}
              className="mb-6 max-h-96 w-full rounded-lg object-cover"
            />
          )}

          <h1 className="mb-2 text-3xl font-bold">{promotion.name}</h1>

          {brand && (
            <p className="mb-4 text-lg text-gray-700">
              From <span className="font-semibold">{brand.name}</span>
            </p>
          )}

          <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <div>
              <span className="font-medium">Starts:</span>{" "}
              {promotion.startDate ?? "Unspecified"}
            </div>
            <div>
              <span className="font-medium">Ends:</span>{" "}
              {promotion.endDate ?? "Unspecified"}
            </div>
            <div>
              <span className="font-medium">Scraped:</span>{" "}
              {new Date(promotion.scrapedAt).toLocaleString()}
            </div>
          </div>

          {promotion.description && (
            <section className="mb-8">
              <h2 className="mb-2 text-xl font-semibold">Details</h2>
              <p className="whitespace-pre-line text-gray-800">
                {promotion.description}
              </p>
            </section>
          )}

          <section className="mb-8">
            <a
              href={promotion.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              View on source site ↗
            </a>
          </section>

          {brand && (
            <section className="rounded-lg border bg-gray-50 p-4">
              <h2 className="mb-3 text-xl font-semibold">About {brand.name}</h2>
              <div className="space-y-2 text-sm text-gray-700">
                {brand.websiteUrl && (
                  <div>
                    <span className="font-medium">Website:</span>{" "}
                    <a
                      href={brand.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-600 underline"
                    >
                      {brand.websiteUrl}
                    </a>
                  </div>
                )}
                {brand.hours && (
                  <div>
                    <span className="font-medium">Hours:</span> {brand.hours.raw}
                  </div>
                )}
                {brand.socialLinks.length > 0 && (
                  <div>
                    <span className="font-medium">Social:</span>{" "}
                    {brand.socialLinks.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-3 capitalize text-blue-600 underline"
                      >
                        {s.platform}
                      </a>
                    ))}
                  </div>
                )}
                <div>
                  <span className="font-medium">Other promotions:</span>{" "}
                  {brand.promotionCount}
                </div>
              </div>
            </section>
          )}
        </article>
      )}
    </main>
  );
}