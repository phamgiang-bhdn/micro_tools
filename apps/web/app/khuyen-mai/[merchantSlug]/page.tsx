import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CouponCard } from "../../../components/coupon-card";
import { fetchCouponsByMerchant } from "../../../lib/api";

export const revalidate = 1800; // 30 phút

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

export default async function MerchantCouponsPage({
  params
}: PageProps): Promise<React.ReactElement> {
  const { merchantSlug } = await params;
  const coupons = await fetchCouponsByMerchant(merchantSlug, 100);
  if (coupons.length === 0) {
    notFound();
  }

  const display =
    coupons[0]?.merchantDisplay ?? capitalize(merchantSlug);
  const now = new Date();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Khuyến mại
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Mã giảm giá {display} tháng {now.getMonth() + 1}/{now.getFullYear()}
        </h1>
        <p className="text-sm text-neutral-600">
          {coupons.length} mã đang chạy. Bấm "Nhận ưu đãi" để mở deal trên {display}.
        </p>
      </header>

      <div className="space-y-3">
        {coupons.map((c) => (
          <CouponCard key={c.id} coupon={c} />
        ))}
      </div>
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
