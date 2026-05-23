"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { MobileMenuPanel } from "./layout/mobile-menu-panel";
import { MobileSearchOverlay } from "./layout/mobile-search-overlay";
import { BRAND } from "../lib/brand";

/**
 * Header công khai (storefront). Responsive:
 * - Desktop ≥lg: hamburger ẩn, nav primary + search inline + Săn deal + Admin button.
 * - Mobile <lg: hamburger trái + logo + search icon (mở overlay full-screen).
 *
 * Sticky bottom nav (mobile-only) mount ở `app/layout.tsx`, không trong file này.
 * Hidden hoàn toàn trên `/admin/*`.
 */
export function Navbar(): React.ReactElement | null {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [desktopQuery, setDesktopQuery] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync desktop search input khi URL thay đổi.
  useEffect(() => {
    setDesktopQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  if (pathname?.startsWith("/admin")) return null;

  function submitDesktop(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = desktopQuery.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-canvas lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-0.5 ring-focus">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-glow">
              d.
            </span>
            <span className="hidden flex-col sm:flex">
              <span className="text-base font-semibold leading-tight tracking-tight text-ink">
                deal<span className="text-brand-600">vault</span>
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-ink-mute lg:block">
                {BRAND.taglineShort}
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            <NavLink href="/" active={pathname === "/" && !searchParams.get("sort")}>
              Khám phá
            </NavLink>
            <NavLink href="/?sort=top" active={searchParams.get("sort") === "top"}>
              Deal hot
            </NavLink>
            <NavLink href="/?sort=newest" active={searchParams.get("sort") === "newest"}>
              Mới về
            </NavLink>
            <NavLink href="/blog" active={pathname?.startsWith("/blog") ?? false}>
              Cẩm nang
            </NavLink>
            <NavLink href="/khuyen-mai" active={pathname?.startsWith("/khuyen-mai") ?? false}>
              Mã giảm
            </NavLink>
          </nav>

          {/* Desktop search */}
          <form onSubmit={submitDesktop} className="ml-auto hidden flex-1 items-center lg:flex lg:max-w-md">
            <div className="relative w-full">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute">
                <Icon name="search" size="md" />
              </span>
              <input
                ref={inputRef}
                type="search"
                name="q"
                value={desktopQuery}
                onChange={(event) => setDesktopQuery(event.target.value)}
                placeholder="Tìm deal, brand, danh mục…"
                className="h-10 w-full rounded-full border border-line bg-canvas pl-10 pr-12 text-sm text-ink placeholder:text-ink-mute focus:border-brand-300 focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {desktopQuery ? (
                <button
                  type="button"
                  onClick={() => setDesktopQuery("")}
                  aria-label="Xoá tìm kiếm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-mute hover:bg-line hover:text-ink"
                >
                  <Icon name="close" size="sm" />
                </button>
              ) : null}
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
            {/* Mobile search trigger → open overlay */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Tìm kiếm"
              className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-canvas lg:hidden"
            >
              <Icon name="search" size="md" />
            </button>

            <Button asChild variant="brand" size="sm" className="hidden lg:inline-flex">
              <Link href="/?sort=top">
                <Icon name="flame" size="md" />
                <span>Săn deal</span>
              </Link>
            </Button>
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-admin-accent hover:text-admin-accent lg:inline-flex"
              title="Admin Console"
            >
              <Icon name="shield" size="sm" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <MobileMenuPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavLink({
  href,
  children,
  active
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
