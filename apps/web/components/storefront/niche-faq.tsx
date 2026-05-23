import type React from "react";

export interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  items: FaqItem[];
}

/**
 * FAQ accordion-style native `<details>` — không cần JS, SEO-friendly. Caller pass
 * sẵn `items` đã extract (từ Niche.faqItems nếu có, hoặc article BUYING_GUIDE faq block).
 * Component trả null khi rỗng → caller hide section, KHÔNG render placeholder.
 */
export function NicheFaq({ items }: Props): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-card shadow-card">
      {items.map((item, i) => (
        <details
          key={i}
          className="group border-b border-line/60 px-4 py-3 last:border-b-0 sm:px-5"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-ink hover:text-brand-700">
            <span>{item.q}</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              className="size-4 shrink-0 transition group-open:rotate-180"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
