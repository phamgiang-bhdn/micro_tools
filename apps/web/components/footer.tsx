"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Footer chỉ render ở trang public. Admin có chrome riêng.
 */
export function Footer(): React.ReactElement | null {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-20 border-t border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-glow">
                d.
              </span>
              <span className="text-base font-semibold tracking-tight text-ink">
                deal<span className="text-brand-600">vault</span>
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              Tổng hợp ưu đãi từ các shop uy tín. Mỗi sản phẩm đều có giá gốc — giá ưu đãi rõ ràng để bạn so sánh nhanh.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1">
                <DotIcon className="text-accent-500" /> Cập nhật mỗi giờ
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1">
                <DotIcon className="text-brand-500" /> Affiliate minh bạch
              </span>
            </div>
          </div>
          <FooterColumn
            title="Khám phá"
            items={[
              { label: "Tất cả danh mục", href: "/" },
              { label: "Deal hot", href: "/?sort=top" },
              { label: "Mới về", href: "/?sort=newest" }
            ]}
          />
          <FooterColumn
            title="Về dealvault"
            items={[
              { label: "Giới thiệu", href: "#" },
              { label: "Liên hệ", href: "#" },
              { label: "Đối tác merchant", href: "#" }
            ]}
          />
          <FooterColumn
            title="Pháp lý"
            items={[
              { label: "Tuyên bố affiliate", href: "#" },
              { label: "Chính sách bảo mật", href: "#" },
              { label: "Điều khoản", href: "#" }
            ]}
          />
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-mute sm:px-6">
          <p>© {new Date().getFullYear()} dealvault. Mọi quyền được bảo lưu.</p>
          <p className="max-w-md text-right">
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

function DotIcon({ className = "" }: { className?: string }): React.ReactElement {
  return <span aria-hidden className={`size-1.5 rounded-full bg-current ${className}`} />;
}
