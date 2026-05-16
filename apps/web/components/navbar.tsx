"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";

/**
 * Header công khai (storefront).
 * - Logo + nav primary + ô search nhanh + CTA "Săn deal".
 * - Mobile: thu gọn search thành icon → expand drawer; nav primary cuộn ngang.
 * - Trang admin: ẩn navbar này (admin có shell riêng).
 */
export function Navbar(): React.ReactElement | null {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (pathname?.startsWith("/admin")) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    const target = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    router.push(target);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-0.5 ring-focus">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-glow">
            d.
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-ink sm:inline">
            deal<span className="text-brand-600">vault</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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
        </nav>

        <form onSubmit={submit} className="ml-auto flex flex-1 items-center md:max-w-md">
          <div className={`relative w-full transition-all ${open ? "block" : "hidden md:block"}`}>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute">
              <Icon name="search" size="md" />
            </span>
            <input
              ref={inputRef}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm deal, brand, danh mục…"
              className="h-10 w-full rounded-full border border-line bg-canvas pl-10 pr-12 text-sm text-ink placeholder:text-ink-mute focus:border-brand-300 focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xoá tìm kiếm"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-mute hover:bg-line hover:text-ink"
              >
                <Icon name="close" size="sm" />
              </button>
            ) : null}
          </div>
        </form>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Tìm kiếm"
            className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-canvas md:hidden"
          >
            <Icon name="search" size="md" />
          </button>
          <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
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
