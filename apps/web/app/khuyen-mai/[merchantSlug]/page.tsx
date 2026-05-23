import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponCardV2 } from "../../../components/storefront/coupon-card";
import { fetchCouponsByMerchant } from "../../../lib/api";

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const now = new Date();
  const display = capitalize(merchantSlug);
  return {
    title: `Mã giảm giá ${display} tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
    description: `Tổng hợp mã giảm giá ${display} mới nhất, đã kiểm duyệt — cập nhật hàng ngày.`,
    alternates: { canonical: `/khuyen-mai/${merchantSlug}` }
  };
}

export default async function MerchantCouponsPage({ params }: PageProps): Promise<React.ReactElement> {
  const { merchantSlug } = await params;
  const coupons = await fetchCouponsByMerchant(merchantSlug, 100);
  if (coupons.length === 0) notFound();

  const display = coupons[0]?.merchantDisplay ?? capitalize(merchantSlug);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Mã giảm giá</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          {display} — {coupons.length} mã đang còn dùng
        </h1>
        <p className="text-sm text-ink-soft">
          Sao chép mã 1-tap rồi mở {display}. Mỗi mã có countdown thời gian thực, ưu tiên mã sắp hết hạn.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <CouponCardV2 key={c.id} coupon={c} />
        ))}
      </div>

      <p className="pt-2 text-sm">
        <Link href="/khuyen-mai" className="text-brand-700 hover:underline">
          ← Xem mã các shop khác
        </Link>
      </p>
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
