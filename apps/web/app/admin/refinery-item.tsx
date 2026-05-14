"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatNumber, normalizeProduct } from "../../lib/format";
import type { ProductItem, ProductView } from "../../lib/types";
import {
  approveExtractionAction,
  rejectExtractionAction,
  retryExtractionAction
} from "./actions";

interface RefineryItemProps {
  extractionId: string;
  productId: string;
  productName: string;
  productNetwork: string;
  rawContent: string;
  initialAiOutput: Record<string, unknown> | null;
}

const field =
  "w-full rounded-lg border border-google-outline bg-google-surface px-3 py-2.5 text-sm text-google-ink placeholder:text-google-ink-secondary focus:border-google-blue focus:outline-none focus:ring-1 focus:ring-google-blue";

export function RefineryItem({
  extractionId,
  productId,
  productName,
  productNetwork,
  rawContent,
  initialAiOutput
}: RefineryItemProps) {
  const initialText = JSON.stringify(initialAiOutput ?? {}, null, 2);
  const [jsonText, setJsonText] = useState(initialText);

  const preview = useMemo(() => buildPreview(jsonText, productId, productName, productNetwork), [
    jsonText,
    productId,
    productName,
    productNetwork
  ]);

  return (
    <div className="grid gap-6 rounded-2xl border border-google-outline bg-google-surface p-6 shadow-google-md xl:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
          Raw content · {productName} · {productNetwork}
        </p>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-google-outline bg-google-surface-tint p-4 text-xs leading-relaxed text-google-ink">
          {rawContent}
        </pre>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
          AI output (JSON, editable)
        </p>
        <form action={approveExtractionAction} className="space-y-3">
          <input type="hidden" name="extractionId" value={extractionId} />
          <input type="hidden" name="reviewer" value="admin" />
          <textarea
            name="aiOutput"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            spellCheck={false}
            className={`${field} h-56 font-mono text-xs`}
          />
          <button
            type="submit"
            disabled={!preview.ok}
            className="inline-flex h-10 items-center rounded-full bg-google-success px-5 text-sm font-medium text-white shadow-google hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve &amp; sync
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <form action={retryExtractionAction}>
            <input type="hidden" name="extractionId" value={extractionId} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-google-warning bg-white px-5 text-sm font-medium text-google-ink hover:bg-amber-50"
            >
              Reject &amp; retry
            </button>
          </form>
          <form action={rejectExtractionAction}>
            <input type="hidden" name="extractionId" value={extractionId} />
            <input type="hidden" name="reviewer" value="admin" />
            <input type="hidden" name="reason" value="Manual rejection from admin panel" />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-red-200 bg-white px-5 text-sm font-medium text-google-error hover:bg-red-50"
            >
              Reject
            </button>
          </form>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-google-ink-secondary">
            Live preview (như user thấy)
          </p>
          <a
            href={`/admin/preview/${extractionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-google-blue hover:underline"
          >
            Mở trang chi tiết →
          </a>
        </div>
        {preview.ok ? (
          <PreviewCard view={preview.view} />
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-google-error">
            <p className="font-medium">JSON không hợp lệ — không thể preview & không thể Approve.</p>
            <p className="mt-1 font-mono">{preview.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type PreviewState =
  | { ok: true; view: ProductView }
  | { ok: false; error: string };

function buildPreview(
  jsonText: string,
  productId: string,
  productName: string,
  productNetwork: string
): PreviewState {
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(jsonText) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Output must be a JSON object." };
    }
    parsed = value as Record<string, unknown>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const fakeProduct: ProductItem = {
    id: productId,
    toolId: "preview",
    network: productNetwork,
    name: productName,
    affiliateUrl: "#",
    scrapedData: parsed
  };
  return { ok: true, view: normalizeProduct(fakeProduct) };
}

function PreviewCard({ view }: { view: ProductView }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-google-outline bg-white shadow-card">
        <div className="relative aspect-square bg-canvas">
          {view.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.image}
              alt={view.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-2xl font-bold text-brand-700">
              {view.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {view.discountPercent && view.discountPercent > 0 ? (
            <span className="absolute left-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              -{view.discountPercent}%
            </span>
          ) : null}
          {view.badge ? (
            <span className="absolute right-2 top-2 rounded-md bg-google-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {view.badge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm text-ink">{view.name}</p>
          {view.price !== undefined ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-bold text-brand-700 sm:text-base">
                {formatMoney(view.price, view.currency)}
              </span>
              {view.originalPrice && view.originalPrice > view.price ? (
                <span className="text-[11px] text-ink-mute line-through">
                  {formatMoney(view.originalPrice, view.currency)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-medium text-ink-soft">Liên hệ shop</p>
          )}
          {view.store ? <p className="text-[11px] text-ink-mute">{view.store}</p> : null}
          {view.rating !== undefined ? (
            <p className="text-[11px] text-ink-mute">
              <span className="text-amber-500">★</span> {view.rating.toFixed(1)}
              {view.reviewCount ? ` · ${formatNumber(view.reviewCount)} đánh giá` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {view.highlights && view.highlights.length > 0 ? (
        <div className="rounded-xl border border-google-outline bg-google-surface-tint p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-google-ink-secondary">
            Highlights
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-google-ink">
            {view.highlights.slice(0, 4).map((entry, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-brand-500" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
