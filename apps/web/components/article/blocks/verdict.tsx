import type React from "react";

interface Props {
  summary: string;
  bestFor?: string[];
  notFor?: string[];
}

export function VerdictBlock({ summary, bestFor, notFor }: Props): React.ReactElement {
  return (
    <section className="overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-br from-ink to-ink/90 p-7 text-white shadow-xl sm:p-9">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Kết luận</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tổng kết</h2>
      <p className="mt-4 text-lg leading-relaxed text-white/90">{summary}</p>

      {(bestFor?.length || notFor?.length) ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {bestFor?.length ? (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Phù hợp với</p>
              <ul className="mt-2.5 space-y-1.5">
                {bestFor.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                    <span aria-hidden className="mt-1 text-emerald-300">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {notFor?.length ? (
            <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">Không hợp với</p>
              <ul className="mt-2.5 space-y-1.5">
                {notFor.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                    <span aria-hidden className="mt-1 text-rose-300">✕</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
