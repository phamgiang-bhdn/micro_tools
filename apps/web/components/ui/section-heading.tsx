import type React from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeading({ eyebrow, title, description, action }: SectionHeadingProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-sm text-ink-soft sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
