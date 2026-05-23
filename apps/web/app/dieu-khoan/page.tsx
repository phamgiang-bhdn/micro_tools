import type { Metadata } from "next";
import type React from "react";
import { BRAND } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Điều khoản sử dụng — ${BRAND.name}`,
  description: `Điều khoản sử dụng dịch vụ ${BRAND.name}.`,
  alternates: { canonical: "/dieu-khoan" }
};

export default function TermsPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-ink">Điều khoản sử dụng</h1>
      <div className="prose prose-neutral mt-6 max-w-none">
        <p>
          Bằng việc truy cập và sử dụng {BRAND.name}, bạn đồng ý với các điều khoản dưới đây.
        </p>
        <h2>1. Dịch vụ</h2>
        <p>
          {BRAND.name} là trang tổng hợp ưu đãi và bài viết tham khảo. Chúng tôi không phải sàn thương mại điện tử, không bán hàng trực tiếp, không xử lý đơn hàng. Mọi giao dịch diễn ra trên sàn mà bạn được điều hướng đến.
        </p>
        <h2>2. Tính chính xác của thông tin</h2>
        <p>
          Chúng tôi nỗ lực giữ giá và mã giảm cập nhật chính xác, nhưng giá thật trên sàn có thể thay đổi bất kỳ lúc nào. Vui lòng kiểm tra lại giá trên sàn trước khi đặt mua.
        </p>
        <h2>3. Affiliate</h2>
        <p>
          Xem chi tiết tại <a href="/tuyen-bo-affiliate">Tuyên bố affiliate</a>.
        </p>
        <h2>4. Liên hệ</h2>
        <p>
          Mọi thắc mắc xin gửi về <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
        </p>
      </div>
    </article>
  );
}
