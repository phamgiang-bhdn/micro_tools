import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { BRAND } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Tuyên bố affiliate — ${BRAND.name}`,
  description: `Cách ${BRAND.name} kiếm doanh thu qua liên kết affiliate, và vì sao bạn không phải trả thêm phí.`,
  alternates: { canonical: "/tuyen-bo-affiliate" }
};

export default function AffiliateDisclosurePage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Pháp lý</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Tuyên bố affiliate</h1>
      </header>
      <div className="prose prose-neutral max-w-none">
        <p>
          {BRAND.name} là một trang đối chiếu giá có sử dụng <strong>liên kết affiliate</strong>. Khi bạn click vào nút &quot;Xem deal ngay&quot; trên trang này, chúng tôi chuyển bạn tới sàn (Shopee, Lazada, TikTok Shop, Tiki, Nguyễn Kim) qua một đường link có gắn mã định danh.
        </p>
        <h2>Chúng tôi nhận hoa hồng như thế nào</h2>
        <p>
          Nếu bạn mua sản phẩm trong vòng cookie window của sàn (thường 7-30 ngày tuỳ chương trình), sàn trả cho chúng tôi một khoản hoa hồng tỉ lệ với giá trị đơn hàng. Mức hoa hồng thường nằm trong khoảng 1-8% tuỳ ngành hàng.
        </p>
        <h2>Bạn KHÔNG phải trả thêm phí</h2>
        <p>
          Giá bạn trả cho sàn không thay đổi khi đi qua link {BRAND.name}. Khoản hoa hồng được sàn trích từ phần lợi nhuận của họ để thưởng cho kênh phân phối — chứ không cộng thêm vào hóa đơn của bạn.
        </p>
        <h2>Chính sách của chúng tôi</h2>
        <ul>
          <li>Không cookie stuffing, không clickjacking, không inject hidden iframe.</li>
          <li>Không nhận tiền để viết review giả mạo trung lập (sponsored content nếu có sẽ được ghi rõ).</li>
          <li>Không bán hay chia sẻ dữ liệu cá nhân của bạn với bên thứ ba ngoài mục đích vận hành site.</li>
        </ul>
        <p>
          Đọc thêm: <Link href="/chinh-sach-bao-mat">Chính sách bảo mật</Link> · <Link href="/ve-chung-toi#cach-chon-deal">Cách chúng tôi chọn deal</Link>.
        </p>
      </div>
    </article>
  );
}
