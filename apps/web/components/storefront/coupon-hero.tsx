import type React from "react";
import type { PublicCoupon } from "../../lib/api";

interface Props {
  coupons: PublicCoupon[];
}

function estimateSavings(coupons: PublicCoupon[]): string {
  let total = 0;
  for (const c of coupons) {
    if (c.discountAmount) total += Number(c.discountAmount) || 0;
    else if (c.discountPercent != null) total += c.discountPercent * 5000; // rough heuristic
  }
  if (total <= 0) return "—";
  if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)} tỷ ₫`;
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(0)} triệu ₫`;
  return `${total.toLocaleString("vi-VN")} ₫`;
}

export function CouponHero({ coupons }: Props): React.ReactElement {
  const now = new Date();
  const merchants = new Set(coupons.map((c) => c.merchantSlug).filter(Boolean));
  const savings = estimateSavings(coupons);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const time = now.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  return (
    <section className="rounded-3xl border border-line bg-gradient-to-br from-brand-50 via-card to-card p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Mã giảm giá</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">
        Mã giảm giá tháng {month}/{year} — đối chiếu {time}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        {coupons.length} mã đang còn dùng từ {merchants.size} cửa hàng. Đã giúp người mua tiết kiệm ước tính {savings}.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Mã đang còn" value={String(coupons.length)} />
        <Stat label="Cửa hàng" value={String(merchants.size)} />
        <Stat label="Tiết kiệm ước tính" value={savings} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
