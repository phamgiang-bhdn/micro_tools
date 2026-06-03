import type React from "react";

interface Item {
  icon?: string;
  title: string;
  body: string;
}

interface Props {
  title?: string;
  items: Item[];
}

export function CriteriaGridBlock({ title, items }: Props): React.ReactElement {
  return (
    <section className="space-y-5">
      {title ? (
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Tiêu chí chọn mua</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
        </header>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <article
            key={i}
            className="group flex gap-4 rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-pop"
          >
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 text-primary-700 ring-1 ring-primary-200"
            >
              <CriteriaIcon name={item.icon} />
            </span>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold leading-snug text-ink">{item.title}</h3>
              <p className="text-sm leading-6 text-ink-soft">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CriteriaIcon({ name }: { name?: string }): React.ReactElement {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-5"
  };
  switch (name) {
    case "battery":
      return (
        <svg {...props}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2M6 11v2M10 11v2M14 11v2" /></svg>
      );
    case "filter":
      return (
        <svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4z" /></svg>
      );
    case "noise":
      return (
        <svg {...props}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M19 8a6 6 0 0 1 0 8M16 11a3 3 0 0 1 0 2" /></svg>
      );
    case "smart":
    case "wifi":
      return (
        <svg {...props}><path d="M5 13a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19h.01" /></svg>
      );
    case "size":
      return (
        <svg {...props}><path d="M21 8V5a2 2 0 0 0-2-2h-3M3 8V5a2 2 0 0 1 2-2h3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" /></svg>
      );
    case "money":
      return (
        <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01" /></svg>
      );
    case "shield":
      return (
        <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
      );
    case "clock":
      return (
        <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      );
    case "sparkle":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
          <path d="M12 2 14 8l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
        </svg>
      );
  }
}
