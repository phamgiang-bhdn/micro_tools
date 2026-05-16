import type React from "react";
import { cn } from "../../../lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200"
};

interface StatusPillProps {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  title?: string;
}

const DOT_COLOR: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400"
};

export function StatusPill({ tone, children, dot, pulse, title }: StatusPillProps): React.ReactElement {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
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
