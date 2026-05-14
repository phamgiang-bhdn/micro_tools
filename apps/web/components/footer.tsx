import type React from "react";
import Link from "next/link";

export function Footer(): React.ReactElement {
  return (
    <footer className="mt-16 border-t border-line bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
              d.
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink">
              deal<span className="text-brand-600">vault</span>
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Tổng hợp ưu đãi từ các shop uy tín. Dữ liệu sản phẩm được cập nhật mỗi ngày để bạn chọn deal tốt nhất.
          </p>
        </div>
        <FooterColumn
          title="Khám phá"
          items={[
            { label: "Tất cả danh mục", href: "/" },
            { label: "Deal hot", href: "/?sort=top" }
          ]}
        />
        <FooterColumn
          title="Về chúng tôi"
          items={[
            { label: "Giới thiệu", href: "#" },
            { label: "Liên hệ", href: "#" }
          ]}
        />
        <FooterColumn
          title="Pháp lý"
          items={[
            { label: "Tuyên bố minh bạch", href: "#" },
            { label: "Chính sách bảo mật", href: "#" }
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-mute sm:px-6">
          <p>© {new Date().getFullYear()} dealvault. Mọi quyền được bảo lưu.</p>
          <p>
            Một số liên kết trên trang có thể giúp chúng tôi nhận hoa hồng. Giá hiển thị tại thời điểm cập nhật dữ
            liệu.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items
}: {
  title: string;
  items: { label: string; href: string }[];
}): React.ReactElement {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-mute">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="text-ink-soft hover:text-brand-700">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
