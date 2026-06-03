import type React from "react";

interface Props {
  items: { q: string; a: string }[];
}

export function FaqBlock({ items }: Props): React.ReactElement {
  return (
    <section className="space-y-3">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">FAQ</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Câu hỏi thường gặp</h2>
      </header>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="group overflow-hidden rounded-2xl border border-line bg-card shadow-card transition open:border-primary-200 open:shadow-pop"
          >
            <summary className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4 text-base font-semibold text-ink hover:text-primary-700 sm:px-6 sm:py-5">
              <span>{item.q}</span>
              <span aria-hidden className="mt-1 shrink-0 text-ink-mute transition group-open:rotate-180">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <div className="border-t border-line bg-canvas/40 px-5 py-4 text-sm leading-7 text-ink-soft sm:px-6">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
