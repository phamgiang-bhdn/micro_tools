import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { BRAND } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Về ${BRAND.name} — Cách chúng tôi chọn deal`,
  description: `${BRAND.name} là dự án giúp người Việt mua thông minh hơn. Cách chúng tôi đối chiếu giá, chọn nguồn chính hãng, và minh bạch về affiliate.`,
  alternates: { canonical: "/ve-chung-toi" }
};

export default function AboutPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Về chúng tôi</p>
        <h1 className="mt-1 text-3xl font-bold text-ink sm:text-4xl">{BRAND.name} là ai?</h1>
        <p className="mt-3 text-base text-ink-soft">
          {BRAND.taglineLong}
        </p>
      </header>

      <div className="prose prose-neutral max-w-none">
        <p>
          Chúng tôi là một team nhỏ ở Việt Nam, làm {BRAND.name} để giúp bạn tiết kiệm thời gian săn deal và tránh mua nhầm sản phẩm.
        </p>
        <p>
          Mỗi ngày các sàn lớn (Shopee, Lazada, TikTok Shop, Tiki, Nguyễn Kim) tung hàng nghìn ưu đãi — nhưng giá hiển thị thường đã bị nâng trước flash sale, mã giảm hết hạn nhanh, review trên sàn nhiều khi có sponsored thiếu khách quan. Bạn cần một nơi đối chiếu giá thật, lọc deal chính hãng, và link 1-click ra sàn.
        </p>
        <p>{BRAND.name} làm đúng việc đó.</p>

        <h2 id="cach-chon-deal">Cách chúng tôi chọn deal</h2>
        <p>
          Hệ thống chúng tôi pull dữ liệu từ API chính thức của các affiliate network. Sau đó:
        </p>
        <ol>
          <li>
            <strong>Lọc nguồn</strong>: chỉ giữ deal từ shop có badge Mall/Trading hoặc shop chính hãng — bỏ qua shop dạng &quot;reseller&quot; giá hên xui.
          </li>
          <li>
            <strong>Đối chiếu giá</strong>: so sánh giá sau giảm với giá gốc thật, không phải giá gốc đã được &quot;phù phép&quot; trước flash sale. Nếu chênh lệch &gt;20% so với giá thường ngày của sản phẩm, chúng tôi đánh badge &quot;Đối chiếu xong&quot;.
          </li>
          <li>
            <strong>Loại trùng</strong>: cùng 1 sản phẩm xuất hiện trên 3 sàn — chúng tôi pick deal giá tốt nhất, badge merchant rõ.
          </li>
          <li>
            <strong>Cập nhật giờ</strong>: giá đổi mỗi giờ. Mỗi card có ngày-giờ đối chiếu.
          </li>
        </ol>
        <p>
          {BRAND.name} không có &quot;siêu deal hôm nay duy nhất&quot;. Nếu bạn thấy site nào nói vậy, hãy nghi ngờ.
        </p>

        <h2>Bài viết &amp; review</h2>
        <p>
          Bên cạnh deal, chúng tôi viết cẩm nang chọn mua + review chi tiết các sản phẩm trong từng danh mục. Bài do team người viết, AI hỗ trợ chúng tôi nghiên cứu thông số, tổng hợp review tiếng Anh-Trung-Hàn, làm bảng so sánh. Nhưng góc nhìn, đánh giá ưu/nhược, recommendation cuối — tất cả là người. Mỗi bài đều có ngày cập nhật + tác giả + nguồn tham khảo.
        </p>

        <h2 id="affiliate">Affiliate hoạt động thế nào</h2>
        <p>
          Khi bạn click &quot;Xem deal ngay&quot; trên {BRAND.name}, chúng tôi gắn 1 mã định danh (32 ký tự) vào link và chuyển bạn tới sàn. Nếu bạn mua trong vòng cookie window của sàn (thường 7-30 ngày), sàn trả cho chúng tôi 1 khoản hoa hồng nhỏ — <strong>bạn không phải trả thêm phí gì</strong>.
        </p>
        <p>
          Hoa hồng này là tất cả doanh thu của chúng tôi — không có quảng cáo banner, không bán dữ liệu cá nhân, không trick affiliate kiểu cookie stuffing.
        </p>
        <p>
          Vì sao chúng tôi minh bạch: nếu chúng tôi đề xuất deal kém cho bạn, bạn không mua hoặc hủy đơn, hoa hồng = 0. Lợi ích của chúng tôi 100% align với việc giới thiệu đúng deal.
        </p>

        <h2>Liên hệ</h2>
        <ul>
          <li>Email: <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></li>
          <li>Trang liên hệ: <Link href="/lien-he">/lien-he</Link></li>
        </ul>
        <p>Đặt câu hỏi, gửi feedback, báo giá lỗi — chúng tôi đọc hết.</p>
      </div>
    </article>
  );
}
