"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "../lib/brand";

export function Footer(): React.ReactElement | null {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-20 border-t border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="border-b border-line pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
            Đối tác chính thức
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {BRAND.partners.map((p) => (
              <span
                key={p.slug}
                className="text-sm font-semibold text-ink-soft/80"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-10 pt-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-glow">
                d.
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold leading-tight tracking-tight text-ink">
                  deal<span className="text-brand-600">vault</span>
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-mute">
                  {BRAND.taglineShort}
                </span>
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              {BRAND.taglineLong}
            </p>
          </div>
          <FooterColumn
            title="Khám phá"
            items={[
              { label: "Tất cả danh mục", href: "/" },
              { label: "Deal hot hôm nay", href: "/deal-hot" },
              { label: "Mã giảm còn dùng", href: "/khuyen-mai" },
              { label: "Cẩm nang chọn mua", href: "/blog" }
            ]}
          />
          <FooterColumn
            title={`Về ${BRAND.name}`}
            items={[
              { label: `Vì sao chọn ${BRAND.name}`, href: "/ve-chung-toi" },
              { label: "Cách chúng tôi chọn deal", href: "/ve-chung-toi#cach-chon-deal" },
              { label: "Liên hệ", href: "/lien-he" }
            ]}
          />
          <FooterColumn
            title="Pháp lý"
            items={[
              { label: "Tuyên bố affiliate", href: "/tuyen-bo-affiliate" },
              { label: "Chính sách bảo mật", href: "/chinh-sach-bao-mat" },
              { label: "Điều khoản sử dụng", href: "/dieu-khoan" }
            ]}
          />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. {BRAND.taglineShort}.
          </p>
          <p className="max-w-md text-[11px] sm:text-right">
            Một số liên kết trên trang có thể giúp chúng tôi nhận hoa hồng. Giá hiển thị tại thời điểm cập nhật dữ liệu.
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
            <Link href={item.href} className="text-ink-soft transition hover:text-brand-700">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
