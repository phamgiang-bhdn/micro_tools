import type React from "react";
import { cn } from "../../../lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-admin-success-soft text-admin-success ring-admin-success/20",
  warning: "bg-admin-warning-soft text-admin-warning ring-admin-warning/25",
  danger: "bg-admin-danger-soft text-admin-danger ring-admin-danger/25",
  info: "bg-admin-info-soft text-admin-info ring-admin-info/25",
  neutral: "bg-admin-subtle text-admin-mute ring-admin-line"
};

interface StatusPillProps {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  title?: string;
}

const DOT_COLOR: Record<Tone, string> = {
  success: "bg-admin-success",
  warning: "bg-admin-warning",
  danger: "bg-admin-danger",
  info: "bg-admin-info",
  neutral: "bg-admin-mute-soft"
};

export function StatusPill({ tone, children, dot, pulse, title }: StatusPillProps): React.ReactElement {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-relaxed ring-1 ring-inset",
        TONES[tone]
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", DOT_COLOR[tone], pulse ? "animate-pulse" : null)}
        />
      ) : null}
      {children}
    </span>
  );
}

const NETWORK_TONE: Record<string, Tone> = {
  ACCESSTRADE: "info",
  SHOPEE: "warning",
  TIKTOK: "danger",
  LAZADA: "neutral"
};

const NETWORK_RING: Record<string, string> = {
  ACCESSTRADE: "bg-blue-50 text-blue-700 ring-blue-200",
  SHOPEE: "bg-orange-50 text-orange-700 ring-orange-200",
  TIKTOK: "bg-pink-50 text-pink-700 ring-pink-200",
  LAZADA: "bg-purple-50 text-purple-700 ring-purple-200"
};

export function NetworkBadge({ network }: { network: string }): React.ReactElement {
  const cls = NETWORK_RING[network] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        cls
      )}
    >
      {network}
    </span>
  );
}

export { NETWORK_TONE };
