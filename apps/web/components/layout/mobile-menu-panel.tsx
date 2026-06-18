"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, X, Flame, Clock, BookOpen, Info, Mail, ScrollText, type LucideIcon } from "lucide-react";
import { CURATED_NICHES } from "../../lib/curated-niches";

interface Props {
  open: boolean;
  onClose: () => void;
}

const HOT_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/?sort=top", label: "Deal hot tuần", icon: Flame },
  { href: "/khuyen-mai", label: "Mã giảm đang còn", icon: Clock },
  { href: "/blog", label: "Cẩm nang chọn mua", icon: BookOpen }
];

const OTHER_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/#trust", label: "Vì sao dealvault", icon: Info },
  { href: "/lien-he", label: "Liên hệ", icon: Mail },
  { href: "/chinh-sach-affiliate", label: "Chính sách affiliate", icon: ScrollText }
];

/**
 * Slide-in panel từ trái. Body scroll lock + ESC close + backdrop click close + auto-close
 * khi navigate (pathname đổi). Focus đầu (close button) khi open để keyboard user nắm rõ vị trí.
 */
export function MobileMenuPanel({ open, onClose }: Props): React.ReactElement | null {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Auto-close khi user nhấn link → navigate đổi pathname → panel disappear.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu chính"
    >
      <button
        type="button"
        aria-label="Đóng menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-fade-in"
      />
      <aside className="relative ml-0 flex h-full w-[88vw] max-w-sm flex-col overflow-y-auto bg-canvas shadow-2xl animate-slide-in-left">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-card"
            autoFocus
          >
            <X className="size-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-600 text-sm font-bold text-white">
              d.
            </span>
            <span>
              deal<span className="text-primary-600">vault</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => alert("Tính năng đăng ký deal sẽ ra trong tuần tới")}
            aria-label="Đăng ký nhận thông báo deal"
            className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-card"
          >
            <Bell className="size-5" />
          </button>
        </div>

        <Section label="Hot">
          {HOT_LINKS.map((l) => (
            <MenuLink key={l.href} href={l.href} icon={l.icon} label={l.label} />
          ))}
        </Section>

        <Section label="Danh mục ưu tiên">
          {CURATED_NICHES.map((n) => (
            <MenuLink
              key={n.slug}
              href={`/categories/${n.slug}`}
              icon={n.Icon}
              label={n.displayName}
            />
          ))}
          <Link
            href="/#all-niches"
            className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-line px-3 py-2 text-body-sm font-semibold text-primary-700 hover:bg-card"
          >
            Xem tất cả danh mục →
          </Link>
        </Section>

        <Section label="Khác">
          {OTHER_LINKS.map((l) => (
            <MenuLink key={l.href} href={l.href} icon={l.icon} label={l.label} />
          ))}
        </Section>

        <p className="px-4 pb-6 pt-2 text-micro text-ink-mute">
          © dealvault · Khuyến mãi cập nhật mỗi giờ
        </p>
      </aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="border-b border-line/70 px-4 py-3">
      <p className="mb-2 text-micro font-bold uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon: Icon
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-body-sm font-medium text-ink hover:bg-card hover:text-primary-700"
    >
      <span aria-hidden className="grid size-7 shrink-0 place-items-center text-ink-mute">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
