import type React from "react";
import { cn } from "../../../lib/utils";

type Tone = "default" | "warning" | "danger" | "success";

const TONES: Record<Tone, string> = {
  default: "border-dashed border-admin-line bg-admin-subtle/40 text-admin-mute",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

interface AdminEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  className
}: AdminEmptyStateProps): React.ReactElement {
  return (
    <div className={cn("rounded-xl border p-8 text-center", TONES[tone], className)}>
      {icon ? <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-white/70 text-admin-ink">{icon}</div> : null}
      <p className="text-sm font-semibold text-admin-ink">{title}</p>
      {description ? (
        <div className="mx-auto mt-1.5 max-w-md text-xs text-admin-mute">{description}</div>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
