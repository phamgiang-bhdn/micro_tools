import type React from "react";

interface Props {
  body: string;
  author?: string;
  rating?: number;
  sourceUrl?: string;
  sourceName?: string;
  verifiedBuyer?: boolean;
}

export function ReviewQuoteBlock({ body, author, rating, sourceUrl, sourceName, verifiedBuyer }: Props): React.ReactElement | null {
  if (!body || !body.trim()) return null;
  return (
    <aside className="my-2 rounded-2xl border border-line bg-card-soft p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path d="M9.17 6A4.17 4.17 0 0 0 5 10.17V18h6v-6.83A4.17 4.17 0 0 0 9.17 6Zm9 0A4.17 4.17 0 0 0 14 10.17V18h6v-6.83A4.17 4.17 0 0 0 18.17 6Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[1.7] text-ink">{body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-mute">
            {typeof rating === "number" && rating > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                {"★".repeat(Math.round(Math.max(0, Math.min(5, rating))))}
                <span className="text-ink-mute">({rating.toFixed(1)})</span>
              </span>
            ) : null}
            {author ? <span className="text-ink-soft">— {author}</span> : null}
            {verifiedBuyer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                ✓ Đã mua
              </span>
            ) : null}
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="nofollow noreferrer" className="ml-auto text-brand-700 hover:underline">
                {sourceName ?? "Nguồn"} ↗
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
