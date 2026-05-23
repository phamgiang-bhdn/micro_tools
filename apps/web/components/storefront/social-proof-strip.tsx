import type React from "react";
import { Icon } from "../ui/icon";
import { formatNumber } from "../../lib/format";

interface Props {
  verifiedDealCount: number;
  activeCouponCount: number;
  lastUpdatedAt: Date | null;
}

const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit"
});

/**
 * 3 fact ngắn dưới hero — trust signal chính cho user VN landing lần đầu.
 * Mobile: stack 3 dòng; desktop: chip ngang. KHÔNG sticky để fold đầu không bị overlap.
 */
export function SocialProofStrip({
  verifiedDealCount,
  activeCouponCount,
  lastUpdatedAt
}: Props): React.ReactElement {
  const facts: Array<{ label: string }> = [
    { label: `${formatNumber(verifiedDealCount)} deal đã đối chiếu giá` },
    { label: `${formatNumber(activeCouponCount)} mã giảm còn dùng` },
    {
      label: lastUpdatedAt
        ? `Cập nhật ${timeFmt.format(lastUpdatedAt)}`
        : "Đang cập nhật liên tục"
    }
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-card/70 p-3 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-1.5 sm:p-3.5">
      {facts.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft sm:text-sm">
          <Icon name="check" size="sm" className="text-emerald-600" />
          {f.label}
        </span>
      ))}
    </div>
  );
}
