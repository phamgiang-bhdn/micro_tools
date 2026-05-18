"use client";

import type React from "react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "../../lib/utils";

interface NavEntry {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  match: (pathname: string, tab: string | null) => boolean;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  entries: NavEntry[];
}

const NAV: NavGroup[] = [
  {
    id: "overview",
    label: "Tổng quan",
    entries: [
      {
        id: "war-room",
        label: "Bảng điều khiển",
        href: "/admin?tab=war-room",
        icon: <DashboardIcon />,
        match: (p, t) => p === "/admin" && (t === null || t === "war-room")
      },
      {
        id: "refinery",
        label: "Duyệt sản phẩm",
        href: "/admin?tab=refinery",
        icon: <RefineryIcon />,
        match: (p, t) => p === "/admin" && t === "refinery"
      }
    ]
  },
  {
    id: "accesstrade",
    label: "Accesstrade",
    entries: [
      {
        id: "campaigns",
        label: "Campaign",
        href: "/admin/campaigns",
        icon: <CampaignIcon />,
        match: (p) => p.startsWith("/admin/campaigns")
      },
      {
        id: "crawler-logs",
        label: "Nhật ký crawler",
        href: "/admin/crawler-logs",
        icon: <LogIcon />,
        match: (p) => p.startsWith("/admin/crawler-logs")
      },
      {
        id: "reconciliation",
        label: "Đối soát đơn",
        href: "/admin/reconciliation",
        icon: <ReconcileIcon />,
        match: (p) => p.startsWith("/admin/reconciliation")
      },
      {
        id: "prompt-studio",
        label: "Xưởng prompt AI",
        href: "/admin?tab=prompt-studio",
        icon: <PromptIcon />,
        match: (p, t) => p === "/admin" && t === "prompt-studio"
      }
    ]
  },
  {
    id: "catalog",
    label: "Catalog",
    entries: [
      {
        id: "niches",
        label: "Niche",
        href: "/admin/niches",
        icon: <CategoryIcon />,
        match: (p) => p.startsWith("/admin/niches")
      },
      {
        id: "categories",
        label: "Category (AT)",
        href: "/admin/categories",
        icon: <CategoryIcon />,
        match: (p) => p.startsWith("/admin/categories")
      },
      {
        id: "sources",
        label: "Nguồn bán",
        href: "/admin/sources",
        icon: <CategoryIcon />,
        match: (p) => p.startsWith("/admin/sources")
      },
      {
        id: "brands",
        label: "Thương hiệu",
        href: "/admin/brands",
        icon: <CategoryIcon />,
        match: (p) => p.startsWith("/admin/brands")
      },
      {
        id: "products",
        label: "Sản phẩm",
        href: "/admin/products",
        icon: <ProductIcon />,
        match: (p) => p.startsWith("/admin/products")
      },
      {
        id: "coupons",
        label: "Mã giảm giá",
        href: "/admin/coupons",
        icon: <CouponIcon />,
        match: (p) => p.startsWith("/admin/coupons")
      },
      {
        id: "articles",
        label: "Bài viết",
        href: "/admin/articles",
        icon: <ArticleIcon />,
        match: (p) => p.startsWith("/admin/articles")
      }
    ]
  },
  {
    id: "revenue",
    label: "Doanh thu",
    entries: [
      {
        id: "money-trail",
        label: "Dòng tiền",
        href: "/admin?tab=money-trail",
        icon: <CoinsIcon />,
        match: (p, t) => p === "/admin" && t === "money-trail"
      },
      {
        id: "analytics",
        label: "Thống kê",
        href: "/admin/analytics",
        icon: <ChartIcon />,
        match: (p) => p.startsWith("/admin/analytics")
      }
    ]
  }
];

const ALL_ENTRIES: NavEntry[] = NAV.flatMap((g) => g.entries);

export function AdminShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Suspense fallback={<AdminShellFallback>{children}</AdminShellFallback>}>
      <AdminShellInner>{children}</AdminShellInner>
    </Suspense>
  );
}

function AdminShellFallback({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex min-h-screen bg-admin-bg text-admin-ink">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-admin-line bg-admin-surface lg:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 h-14 border-b border-admin-line bg-admin-surface/85 backdrop-blur-md" />
        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname, tab]);

  return (
    <div className="flex min-h-screen bg-admin-bg text-admin-ink">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-admin-line bg-admin-surface lg:flex">
        <SidebarContent pathname={pathname} tab={tab} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-admin-ink/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-64 border-r border-admin-line bg-admin-surface shadow-xl">
            <SidebarContent pathname={pathname} tab={tab} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-admin-line bg-admin-surface/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-admin-mute hover:bg-admin-subtle lg:hidden"
          >
            <MenuIcon />
          </button>
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className="hidden items-center gap-2 text-sm text-admin-mute lg:flex">
              <Crumb pathname={pathname} tab={tab} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-admin-line bg-admin-surface px-3 py-1.5 text-xs font-medium text-admin-mute transition hover:border-admin-accent hover:text-admin-accent sm:inline-flex"
            >
              <ExternalIcon /> Xem trang khách
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              Vận hành
            </span>
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  tab,
  onNavigate
}: {
  pathname: string;
  tab: string | null;
  onNavigate?: () => void;
}): React.ReactElement {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-admin-line px-4">
        <Link href="/admin" className="flex items-center gap-2" onClick={onNavigate}>
          <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-white shadow-glow-sm">
            d.
          </span>
          <span className="text-sm font-semibold tracking-tight text-admin-ink">
            deal<span className="text-brand-600">vault</span>
            <span className="ml-1 rounded-full bg-admin-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-admin-mute">
              admin
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV.map((group) => (
          <div key={group.id}>
            <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-admin-mute">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.entries.map((entry) => {
                const active = entry.match(pathname, tab);
                return (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-admin-accent-soft text-admin-accent-ink shadow-sm shadow-admin-accent/5"
                        : "text-admin-mute hover:bg-admin-subtle hover:text-admin-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-md transition-colors",
                        active
                          ? "bg-admin-accent text-white shadow-sm shadow-admin-accent/30"
                          : "bg-admin-subtle text-admin-mute group-hover:bg-admin-surface group-hover:text-admin-ink"
                      )}
                    >
                      {entry.icon}
                    </span>
                    <span className="flex-1">{entry.label}</span>
                    {entry.badge ? (
                      <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {entry.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-admin-line p-3">
        <div className="rounded-lg bg-admin-subtle p-3 text-xs">
          <p className="font-semibold text-admin-ink">Phím tắt (Refinery)</p>
          <ul className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-admin-mute">
            <li>
              <Kbd>A</Kbd> Duyệt
            </li>
            <li>
              <Kbd>R</Kbd> Từ chối
            </li>
            <li>
              <Kbd>J</Kbd> Bài tiếp
            </li>
            <li>
              <Kbd>K</Kbd> Bài trước
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="rounded border border-admin-line bg-white px-1 py-0.5 font-mono text-[10px] text-admin-ink">
      {children}
    </kbd>
  );
}

function Crumb({ pathname, tab }: { pathname: string; tab: string | null }): React.ReactElement {
  const current = ALL_ENTRIES.find((entry) => entry.match(pathname, tab));
  const group = NAV.find((g) => g.entries.some((e) => e === current));
  return (
    <>
      <span className="text-admin-mute">Admin</span>
      <span aria-hidden>›</span>
      {group ? (
        <>
          <span className="text-admin-mute">{group.label}</span>
          <span aria-hidden>›</span>
        </>
      ) : null}
      <span className="font-semibold text-admin-ink">{current?.label ?? "Trung tâm điều hành"}</span>
    </>
  );
}

function MenuIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function ExternalIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function DashboardIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function RefineryIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M4 4h16l-3 7v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7Z" />
      <path d="m9 13 3 3 3-3" />
    </svg>
  );
}

function PromptIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function CoinsIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <circle cx="9" cy="9" r="6" />
      <path d="M21 14a6 6 0 0 1-6 6c-2 0-3.8-1-4.9-2.5" />
      <path d="M9 6v6M7 9h4" />
    </svg>
  );
}

function CategoryIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

function ProductIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 7 12 3l9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function CouponIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M11 8v8" strokeDasharray="2 2" />
    </svg>
  );
}

function ChartIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 3v18h18" />
      <path d="M7 14v4M11 10v8M15 6v12M19 12v6" />
    </svg>
  );
}

function CampaignIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3 4V5L6 9H5a2 2 0 0 0-2 2Z" />
      <path d="M14 5v14M18 8v8" />
    </svg>
  );
}

function LogIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function ReconcileIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ArticleIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M4 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-2-1V5Z" />
      <path d="M9 8h5M9 12h5" />
    </svg>
  );
}
