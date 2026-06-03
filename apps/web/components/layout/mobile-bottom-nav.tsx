"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, BookOpen, Ticket, Bell } from "lucide-react";
import { cn } from "../../lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Active khi pathname match exact hoặc startsWith — fine-tune cho /khuyen-mai/:slug. */
  matchPrefix?: string;
  /** Click chỉ trigger handler (notification subscribe placeholder), không navigate. */
  onClick?: () => void;
}

const TABS: Tab[] = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/?sort=top", label: "Deal hot", icon: Flame, matchPrefix: "/deal-hot" },
  { href: "/blog", label: "Cẩm nang", icon: BookOpen, matchPrefix: "/blog" },
  { href: "/khuyen-mai", label: "Mã giảm", icon: Ticket, matchPrefix: "/khuyen-mai" },
  { href: "#", label: "Theo dõi", icon: Bell }
];

/**
 * Sticky bottom nav 5-tab, mobile-only (<lg). Ẩn trên `/admin/*`.
 * Padding-bottom 64px của body ở mobile-only do `app/layout.tsx` apply.
 *
 * Active state: pathname === href hoặc pathname.startsWith(matchPrefix). "Trang chủ" tab
 * chỉ active khi pathname === "/" để khỏi luôn highlight ở mọi page.
 */
export function MobileBottomNav(): React.ReactElement | null {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto grid h-14 max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isHome = tab.href === "/";
          const active = isHome
            ? pathname === "/"
            : pathname === tab.href || (tab.matchPrefix ? pathname?.startsWith(tab.matchPrefix) ?? false : false);

          const className = cn(
            "relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium leading-none",
            active ? "text-primary-700" : "text-ink-mute hover:text-ink"
          );
          const indicator = active ? (
            <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary-600" />
          ) : null;

          if (tab.label === "Theo dõi") {
            return (
              <li key={tab.label}>
                <button
                  type="button"
                  onClick={() => alert("Tính năng đăng ký deal sẽ ra trong tuần tới")}
                  aria-label={tab.label}
                  className={className}
                >
                  {indicator}
                  <Icon className="size-[22px]" />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={className}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                {indicator}
                <Icon className="size-[22px]" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
