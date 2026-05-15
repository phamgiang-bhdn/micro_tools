import type React from "react";
import { cn } from "../../../lib/utils";

interface SectionCardProps {
  title?: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}

export function SectionCard({
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
  bodyClassName,
  padded = true
}: SectionCardProps): React.ReactElement {
  const hasHeader = Boolean(title || eyebrow || description || actions);
  return (
    <section className={cn("admin-card overflow-hidden", padded ? "p-0" : null, className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-admin-line bg-admin-subtle/30 px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-0.5 text-base font-semibold text-admin-ink">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-admin-mute">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(padded ? "p-5" : null, bodyClassName)}>{children}</div>
    </section>
  );
}
