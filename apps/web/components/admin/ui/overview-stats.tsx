import type React from "react";
import { cn } from "../../../lib/utils";

/**
 * Khung overview chuẩn cho mọi list page. Render grid KPI gọn, mỗi item:
 *  - label  : nhãn ngắn
 *  - value  : con số chính
 *  - hint?  : ghi chú nhỏ dưới (so kỳ trước…)
 *  - tone?  : neutral | success | warning | danger | info
 *
 * Mặc định grid 2/4 cột (sm/lg). Có thể override `cols`.
 */
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export interface OverviewStat {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}

interface OverviewStatsProps {
  items: OverviewStat[];
  /** Số cột mặc định ở `lg`. Mặc định 4. */
  cols?: 2 | 3 | 4 | 5;
  className?: string;
}

const TONE_RING: Record<Tone, string> = {
  neutral: "bg-admin-subtle text-admin-mute",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700"
};

const COL_CLASS: Record<NonNullable<OverviewStatsProps["cols"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5"
};

export function OverviewStats({
  items,
  cols = 4,
  className
}: OverviewStatsProps): React.ReactElement {
  return (
    <div className={cn("grid gap-3", COL_CLASS[cols], className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className="admin-card flex items-start gap-3 p-4"
        >
          {it.icon ? (
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                TONE_RING[it.tone ?? "neutral"]
              )}
            >
              {it.icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
              {it.label}
            </p>
            <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-admin-ink">
              {it.value}
            </p>
            {it.hint ? <p className="mt-0.5 text-xs text-admin-mute">{it.hint}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
