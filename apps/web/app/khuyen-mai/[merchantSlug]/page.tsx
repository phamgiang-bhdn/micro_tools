import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CouponCardV2 } from "../../../components/storefront/coupon-card";
import { MerchantNoCouponsNotice } from "../../../components/storefront/merchant-no-coupons-notice";
import { fetchCouponsByMerchant, fetchMerchantExists } from "../../../lib/api";
import { logDeadEnd } from "../../../lib/dead-end";

export const revalidate = 1800;

// STORY 1-1 (review #4): 1 fetch coupon dùng chung cho generateMetadata + body — React.cache dedup
// trong 1 request render → noindex (metadata) và render (body) suy từ CÙNG dữ liệu, không lệch
// nhau, không gọi API 2 lần với limit khác nhau.
const getMerchantCoupons = cache((slug: string) => fetchCouponsByMerchant(slug, 100));

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { merchantSlug } = await params;
  const now = new Date();
  const display = capitalize(merchantSlug);
  // STORY 1-1: noindex CÓ ĐIỀU KIỆN — chỉ khi đang 0 mã active (trang mỏng). Khi có mã lại
  // tự index (ISR re-render). Tránh soft-404. Dùng chung fetch với body (review #4) nên không lệch.
  const coupons = await getMerchantCoupons(merchantSlug);
  return {
    title: `Mã giảm giá ${display} tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
    description: `Tổng hợp mã giảm giá ${display} mới nhất, đã kiểm duyệt — cập nhật hàng ngày.`,
    alternates: { canonical: `/khuyen-mai/${merchantSlug}` },
    robots: coupons.length > 0 ? undefined : { index: false }
  };
}

export default async function MerchantCouponsPage({ params }: PageProps): Promise<React.ReactElement> {
  const { merchantSlug } = await params;
  const coupons = await getMerchantCoupons(merchantSlug);

  // STORY 1-1 (decision B): 0 mã active → phân biệt merchant thật (tạm hết mã → "chưa có mã")
  // vs slug lạ (→ 404). merchant === null nghĩa là API lỗi/không xác định được — KHÔNG 404
  // (có thể là merchant thật, review #2) → degrade về trang "chưa có mã".
  if (coupons.length === 0) {
    const merchant = await fetchMerchantExists(merchantSlug);
    if (merchant && !merchant.exists) {
      notFound();
    }
    logDeadEnd("coupon-merchant-empty", { slug: merchantSlug });
    return <MerchantNoCouponsNotice display={merchant?.display ?? capitalize(merchantSlug)} />;
  }

  const display = coupons[0]?.merchantDisplay ?? capitalize(merchantSlug);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Mã giảm giá</p>
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
        <Link href="/khuyen-mai" className="text-primary-700 hover:underline">
          ← Xem mã các shop khác
        </Link>
      </p>
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
