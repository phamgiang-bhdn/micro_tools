import type React from "react";
import { cn } from "../../lib/utils";

type StatTone = "default" | "primary" | "success" | "brand" | "accent";

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: StatTone;
  /** Hiển thị compact (text size nhỏ hơn). */
  size?: "sm" | "md";
  className?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "text-ink",
  primary: "text-primary-700",
  success: "text-success-ink",
  // deprecated aliases
  brand: "text-primary-700",
  accent: "text-success-ink"
};

export function Stat({
  label,
  value,
  tone = "default",
  size = "md",
  className
}: StatProps): React.ReactElement {
  const valueClass = size === "sm" ? "text-sm font-bold" : "text-base font-bold";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/70 px-3 py-2 backdrop-blur",
        className
      )}
    >
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className={cn(valueClass, TONE_CLASS[tone])}>{value}</dd>
    </div>
  );
}

interface StatGridProps {
  children: React.ReactNode;
  /** Số cột mặc định trên màn nhỏ. */
  cols?: 2 | 3 | 4;
  className?: string;
}

const COLS: Record<NonNullable<StatGridProps["cols"]>, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4"
};

export function StatGrid({ children, cols = 4, className }: StatGridProps): React.ReactElement {
  return <dl className={cn("grid gap-3", COLS[cols], className)}>{children}</dl>;
}
