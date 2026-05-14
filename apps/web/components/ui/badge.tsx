import type React from "react";
import { cn } from "../../lib/utils";

type Tone = "brand" | "accent" | "neutral" | "warning" | "ink";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: "sm" | "md";
}

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  accent: "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200",
  neutral: "bg-white text-ink-soft ring-1 ring-inset ring-line",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  ink: "bg-ink text-white"
};

export function Badge({ tone = "neutral", size = "sm", className, ...props }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
