import type React from "react";

interface Props {
  pros: string[];
  cons: string[];
}

export function ProsConsBlock({ pros, cons }: Props): React.ReactElement {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40">
        <header className="border-b border-emerald-200/70 bg-emerald-100/60 px-5 py-3">
          <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wider text-emerald-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Điểm mạnh
          </p>
        </header>
        <ul className="space-y-2.5 p-5">
          {pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-emerald-950">
              <span
                aria-hidden
                className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-micro text-white"
              >
                ✓
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/40">
        <header className="border-b border-rose-200/70 bg-rose-100/60 px-5 py-3">
          <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wider text-rose-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M6 6 18 18M6 18 18 6" />
            </svg>
            Điểm yếu
          </p>
        </header>
        <ul className="space-y-2.5 p-5">
          {cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-rose-950">
              <span
                aria-hidden
                className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-rose-500 text-micro text-white"
              >
                −
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
