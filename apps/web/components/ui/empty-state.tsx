import type React from "react";

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "info" | "warning" | "error";
}

const TONES = {
  info: "border-line bg-white",
  warning: "border-amber-200 bg-amber-50",
  error: "border-red-200 bg-red-50"
} as const;

export function EmptyState({ title, description, action, tone = "info" }: EmptyStateProps): React.ReactElement {
  return (
    <div className={`rounded-2xl border ${TONES[tone]} p-8 text-center shadow-card`}>
      <p className="text-base font-semibold text-ink">{title}</p>
      {description ? <div className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
