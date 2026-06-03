import type React from "react";

type Tone = "brand" | "accent" | "warning" | "error" | "neutral";
type IconKey = "revenue" | "rate" | "tokens" | "crawler";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: IconKey;
}

const TONE: Record<Tone, { value: string; chip: string; iconBg: string }> = {
  brand: {
    value: "text-primary-700",
    chip: "bg-primary-50 text-primary-700 ring-primary-200",
    iconBg: "bg-primary-50 text-primary-700"
  },
  accent: {
    value: "text-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-700"
  },
  warning: {
    value: "text-amber-700",
    chip: "bg-amber-50 text-amber-800 ring-amber-200",
    iconBg: "bg-amber-50 text-amber-700"
  },
  error: {
    value: "text-red-600",
    chip: "bg-red-50 text-red-700 ring-red-200",
    iconBg: "bg-red-50 text-red-700"
  },
  neutral: {
    value: "text-admin-ink",
    chip: "bg-admin-subtle text-admin-mute ring-admin-line",
    iconBg: "bg-admin-subtle text-admin-mute"
  }
};

export function KpiCard({ label, value, hint, tone = "neutral", icon }: KpiCardProps): React.ReactElement {
  const palette = TONE[tone];
  return (
    <article className="admin-card relative overflow-hidden p-5 transition hover:shadow-google-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">{label}</p>
        {icon ? (
          <span className={`grid size-8 place-items-center rounded-lg ${palette.iconBg}`}>
            <Icon name={icon} />
          </span>
        ) : null}
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${palette.value} sm:text-3xl`}>{value}</p>
      {hint ? (
        <p className="mt-1.5 text-xs text-admin-mute">{hint}</p>
      ) : null}
    </article>
  );
}

function Icon({ name }: { name: IconKey }): React.ReactElement {
  switch (name) {
    case "revenue":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />
        </svg>
      );
    case "rate":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case "tokens":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "crawler":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M9 2v4M15 2v4M4 10h16" />
        </svg>
      );
  }
}
