import type React from "react";
import { Flame, ShieldAlert, TrendingDown } from "lucide-react";
import { cn } from "../../lib/utils";
import type { PriceIntel, PriceVerdict } from "../../lib/types";

type ActionableVerdict = Extract<PriceVerdict, "GIA_AO" | "DAY_GIA" | "GIA_TOT">;

const CONFIG: Record<
  ActionableVerdict,
  { label: string; className: string; Icon: typeof Flame }
> = {
  // Wedge "soi giá ảo": cảnh báo thật cho người mua, dù đang bán deal — đây là trust signal.
  GIA_AO: { label: "Giá ảo?", className: "bg-danger-soft text-danger-ink", Icon: ShieldAlert },
  DAY_GIA: { label: "Đáy 90 ngày", className: "bg-success-soft text-success-ink", Icon: Flame },
  GIA_TOT: { label: "Giá tốt", className: "bg-success-soft text-success-ink", Icon: TrendingDown }
};

/**
 * Badge verdict giá (V4). Chỉ hiện khi có tín hiệu đáng nói (giá ảo / đáy / giá tốt);
 * BINH_THUONG + THIEU_DU_LIEU → null (không thêm nhiễu). An toàn khi intel undefined.
 */
export function DealVerdictBadge({
  intel,
  size = "sm"
}: {
  intel?: PriceIntel | null;
  size?: "xs" | "sm";
}): React.ReactElement | null {
  if (!intel) return null;
  const cfg = CONFIG[intel.verdict as ActionableVerdict];
  if (!cfg) return null;

  const suffix =
    intel.verdict === "GIA_TOT" && intel.dropFromAvgPct && intel.dropFromAvgPct > 0
      ? ` -${intel.dropFromAvgPct}%`
      : "";
  const Icon = cfg.Icon;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold",
        size === "xs" ? "text-[0.625rem]" : "text-micro",
        cfg.className
      )}
      title={verdictTooltip(intel)}
    >
      <Icon className="size-3 shrink-0" />
      {cfg.label}
      {suffix}
    </span>
  );
}

function verdictTooltip(intel: PriceIntel): string {
  switch (intel.verdict) {
    case "GIA_AO":
      return "Giá niêm yết cao bất thường so với giá thực từng ghi nhận — cẩn thận giảm ảo.";
    case "DAY_GIA":
      return "Đang ở mức thấp nhất trong 90 ngày theo dõi.";
    case "GIA_TOT":
      return "Rẻ hơn mức trung bình gần đây.";
    default:
      return "";
  }
}
