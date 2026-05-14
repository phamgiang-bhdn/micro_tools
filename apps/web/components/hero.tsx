import type React from "react";
import Link from "next/link";
import { Button } from "./ui/button";

interface HeroProps {
  toolCount: number;
  productCount: number;
}

export function Hero({ toolCount, productCount }: HeroProps): React.ReactElement {
  return (
    <section className="relative overflow-hidden rounded-4xl border border-line bg-card shadow-card-lg">
      <div className="absolute inset-0 bg-hero-mesh" aria-hidden />
      <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:px-14">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            <span className="size-1.5 rounded-full bg-brand-500" /> So sánh · Săn deal · Tracking
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Săn deal đỉnh, <span className="text-gradient-brand">mua đâu cũng rẻ nhất</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Hệ thống tự động crawl ưu đãi, trích dữ liệu sản phẩm bằng AI và đo conversion theo từng cú click — để bạn
            ra quyết định mua hàng nhanh, đúng giá, không lăn tăn.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild variant="brand" size="lg">
              <Link href="#tools">Khám phá micro-tool</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#deals">Xem deal hot</Link>
            </Button>
          </div>
          <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 text-left">
            <Stat label="Micro-tool" value={toolCount} suffix="" />
            <Stat label="Sản phẩm" value={productCount} suffix="" />
            <Stat label="Đối tác" value={6} suffix="+" />
          </dl>
        </div>
        <div className="relative hidden lg:block">
          <FloatingCardStack />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-ink">
        {value}
        {suffix}
      </dd>
    </div>
  );
}

function FloatingCardStack(): React.ReactElement {
  return (
    <div className="relative h-80">
      <div className="absolute right-0 top-0 w-72 rotate-3 rounded-2xl border border-line bg-white p-4 shadow-card-lg">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-brand-gradient" />
          <div>
            <p className="text-sm font-semibold text-ink">Hot Deal</p>
            <p className="text-xs text-ink-mute">Cập nhật mỗi 15 phút</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-3/4 rounded-full bg-brand-100" />
        <div className="mt-2 h-2 w-1/2 rounded-full bg-line" />
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-brand-700">-42%</span>
          <span className="text-xs text-ink-soft">vs giá niêm yết</span>
        </div>
      </div>
      <div className="absolute left-2 top-28 w-64 -rotate-2 rounded-2xl border border-line bg-white p-4 shadow-card-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">Conversion tracking</p>
        <div className="mt-3 flex items-end gap-1">
          {[40, 70, 55, 90, 60, 100, 80].map((h, idx) => (
            <div
              key={idx}
              className="w-4 rounded-t bg-accent-gradient"
              style={{ height: `${h * 0.7}px` }}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 right-6 w-60 rotate-1 rounded-2xl border border-line bg-white p-4 shadow-card-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">AI extract</p>
        <p className="mt-2 text-sm font-medium text-ink">→ giá, voucher, điểm thưởng</p>
      </div>
    </div>
  );
}
