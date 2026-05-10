"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  PaginatedPromotions,
  BrandWithCount,
  Promotion,
} from "@promo/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function HomePage() {
  // --- Filter state ---------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");          // debounced
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [groupByBrand, setGroupByBrand] = useState(false);

  // --- Data state -----------------------------------------------------------
  const [flatData, setFlatData] = useState<PaginatedPromotions | null>(null);
  const [brands, setBrands] = useState<BrandWithCount[] | null>(null);
  const [groupedPromos, setGroupedPromos] = useState<Promotion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce: 300ms after the user stops typing, commit the search value.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, groupByBrand]);

  // Fetch data when anything changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const run = async () => {
      try {
        if (groupByBrand) {
          // Grouped view: pull all brands and a wide page of promos.
          params.set("pageSize", "200");
          const [bRes, pRes] = await Promise.all([
            fetch(`${API}/brands`),
            fetch(`${API}/promotions?${params.toString()}`),
          ]);
          if (!bRes.ok || !pRes.ok) throw new Error(`API ${bRes.status}/${pRes.status}`);
          const bJson = await bRes.json();
          const pJson = (await pRes.json()) as PaginatedPromotions;
          if (cancelled) return;
          setBrands(bJson.items as BrandWithCount[]);
          setGroupedPromos(pJson.items);
          setFlatData(null);
        } else {
          params.set("page", String(page));
          params.set("pageSize", "12");
          const res = await fetch(`${API}/promotions?${params.toString()}`);
          if (!res.ok) throw new Error(`API ${res.status}`);
          const json = (await res.json()) as PaginatedPromotions;
          if (cancelled) return;
          setFlatData(json);
          setBrands(null);
          setGroupedPromos(null);
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
  }, [search, startDate, endDate, page, groupByBrand]);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Promotions</h1>
        <p className="text-gray-600">The Promenade Shops at Briargate</p>
      </header>

      {/* Filter controls */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border bg-gray-50 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Search</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="name or description…"
            className="w-64 rounded border bg-white px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border bg-white px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border bg-white px-3 py-2"
          />
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={groupByBrand}
            onChange={(e) => setGroupByBrand(e.target.checked)}
          />
          <span className="text-sm font-medium">Group by brand</span>
        </label>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-red-700">
          Error: {error}
        </p>
      )}

      {!loading && !error && !groupByBrand && flatData && (
        <FlatView data={flatData} page={page} setPage={setPage} />
      )}

      {!loading && !error && groupByBrand && brands && groupedPromos && (
        <GroupedView brands={brands} promos={groupedPromos} />
      )}
    </main>
  );
}

// --- Flat view ----------------------------------------------------------------
function FlatView({
  data,
  page,
  setPage,
}: {
  data: PaginatedPromotions;
  page: number;
  setPage: (p: number) => void;
}) {
  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        {data.total} {data.total === 1 ? "promotion" : "promotions"} • Page{" "}
        {data.page} of {data.totalPages}
      </p>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.items.map((p) => (
          <PromotionCard key={p.id} promo={p} />
        ))}
      </div>
      {data.items.length === 0 && (
        <p className="text-gray-500">No promotions match your filters.</p>
      )}
      {data.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}

// --- Grouped view -------------------------------------------------------------
function GroupedView({
  brands,
  promos,
}: {
  brands: BrandWithCount[];
  promos: Promotion[];
}) {
  // Bucket promos by brandId.
  const byBrand = new Map<string, Promotion[]>();
  for (const p of promos) {
    if (!p.brandId) continue;
    const list = byBrand.get(p.brandId) ?? [];
    list.push(p);
    byBrand.set(p.brandId, list);
  }
  // Only show brands that actually have matching promos under the current filter.
  const visible = brands.filter((b) => (byBrand.get(b.id)?.length ?? 0) > 0);

  if (visible.length === 0) {
    return <p className="text-gray-500">No brands match your filters.</p>;
  }

  return (
    <div className="space-y-8">
      {visible.map((b) => (
        <section key={b.id} className="rounded-lg border p-5">
          <header className="mb-4 border-b pb-3">
            <h2 className="text-2xl font-semibold">{b.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              {b.websiteUrl && (
                <a
                  href={b.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Website ↗
                </a>
              )}
              {b.hours && (
                <span>
                  <span className="font-medium">Hours:</span> {b.hours.raw}
                </span>
              )}
              {b.socialLinks.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {b.socialLinks.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="capitalize text-blue-600 underline"
                    >
                      {s.platform}
                    </a>
                  ))}
                </span>
              )}
            </div>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(byBrand.get(b.id) ?? []).map((p) => (
              <PromotionCard key={p.id} promo={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// --- Promotion card ----------------------------------------------------------
function PromotionCard({ promo }: { promo: Promotion }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md">
      {promo.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={promo.imageUrl}
          alt={promo.name}
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="p-3">
        <h3 className="mb-1 line-clamp-2 text-lg font-semibold">{promo.name}</h3>
        {promo.description && (
          <p className="mb-2 line-clamp-3 text-sm text-gray-600">
            {promo.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{promo.endDate ? `Ends ${promo.endDate}` : "Ongoing"}</span>
          <Link
            href={`/promotions/${promo.id}`}
            className="text-blue-600 underline"
          >
            View details →
          </Link>
        </div>
      </div>
    </article>
  );
}