import type React from "react";
import { cn } from "../../lib/utils";

/**
 * Badge — design system V3. Tone canonical: primary / cta / success / warning / danger / info / neutral / ink.
 * `brand` + `accent` là alias deprecated (→ primary / success) giữ cho code cũ, xoá ở Phase 6.
 */
type Tone =
  | "primary"
  | "cta"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "ink"
  | "brand"
  | "accent";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: "sm" | "md";
}

const TONES: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200",
  cta: "bg-cta-50 text-cta-700 ring-1 ring-inset ring-cta-200",
  success: "bg-success-soft text-success-ink ring-1 ring-inset ring-success/20",
  warning: "bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning/20",
  danger: "bg-danger-soft text-danger-ink ring-1 ring-inset ring-danger/20",
  info: "bg-info-soft text-info-ink ring-1 ring-inset ring-info/20",
  neutral: "bg-surface text-ink-soft ring-1 ring-inset ring-border",
  ink: "bg-ink text-white",
  // deprecated aliases
  brand: "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200",
  accent: "bg-success-soft text-success-ink ring-1 ring-inset ring-success/20"
};

export function Badge({ tone = "neutral", size = "sm", className, ...props }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-micro" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
