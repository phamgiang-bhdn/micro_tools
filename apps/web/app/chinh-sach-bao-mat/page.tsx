import type { Metadata } from "next";
import type React from "react";
import { BRAND } from "../../lib/brand";

export const metadata: Metadata = {
  title: `Chính sách bảo mật — ${BRAND.name}`,
  description: `Cách ${BRAND.name} thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn.`,
  alternates: { canonical: "/chinh-sach-bao-mat" }
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-ink">Chính sách bảo mật</h1>
      <div className="prose prose-neutral mt-6 max-w-none">
        <p>
          {BRAND.name} tôn trọng quyền riêng tư của người dùng. Trang này tóm tắt cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
        </p>
        <h2>Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>Email (nếu bạn đăng ký nhận deal hoặc gửi form liên hệ).</li>
          <li>Thông tin click ẩn danh: IP, user agent, thời điểm — phục vụ tính hoa hồng affiliate.</li>
          <li>Cookie ẩn danh để đếm số lần truy cập + ngăn modal spam.</li>
        </ul>
        <h2>Mục đích sử dụng</h2>
        <ul>
          <li>Gửi email digest deal mỗi ngày (chỉ khi bạn đăng ký).</li>
          <li>Đo lường hiệu quả deal và tính hoa hồng từ sàn.</li>
          <li>Cải thiện trải nghiệm sử dụng.</li>
        </ul>
        <h2>Bên thứ ba</h2>
        <p>
          Chúng tôi không bán dữ liệu cá nhân. Liên kết affiliate có thể chia sẻ một số tham số click (mã định danh, không có dữ liệu cá nhân) với sàn để xác định nguồn click.
        </p>
        <h2>Quyền của bạn</h2>
        <p>
          Bạn có thể yêu cầu xem, sửa, hoặc xoá dữ liệu cá nhân của mình bằng cách email tới <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
        </p>
      </div>
    </article>
  );
}
