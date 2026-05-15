import type React from "react";

type Tone = "info" | "warning" | "tip" | "success";

interface Props {
  tone: Tone;
  title: string;
  body: string;
}

const TONE: Record<
  Tone,
  { wrap: string; iconBg: string; titleColor: string; icon: React.ReactElement; label: string }
> = {
  info: {
    wrap: "border-sky-200 bg-sky-50/70",
    iconBg: "bg-sky-100 text-sky-700",
    titleColor: "text-sky-900",
    label: "Cần biết",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </svg>
    )
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50/70",
    iconBg: "bg-amber-100 text-amber-800",
    titleColor: "text-amber-900",
    label: "Cẩn thận",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <path d="M10.3 3.7 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v5M12 18h.01" />
      </svg>
    )
  },
  tip: {
    wrap: "border-violet-200 bg-violet-50/70",
    iconBg: "bg-violet-100 text-violet-700",
    titleColor: "text-violet-900",
    label: "Mẹo",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <path d="M12 2a7 7 0 0 0-4 12.7V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3A7 7 0 0 0 12 2Z" />
        <path d="M10 22h4" />
      </svg>
    )
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50/70",
    iconBg: "bg-emerald-100 text-emerald-700",
    titleColor: "text-emerald-900",
    label: "Quan trọng",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    )
  }
};

export function CalloutBlock({ tone, title, body }: Props): React.ReactElement {
  const t = TONE[tone];
  return (
    <aside className={`relative flex gap-4 rounded-2xl border-l-4 ${t.wrap} border p-5 sm:p-6`}>
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${t.iconBg}`}>
        {t.icon}
      </span>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{t.label}</span>
        </div>
        <h4 className={`text-base font-bold tracking-tight sm:text-lg ${t.titleColor}`}>{title}</h4>
        <p className="text-sm leading-6 text-ink-soft">{body}</p>
      </div>
    </aside>
  );
}
