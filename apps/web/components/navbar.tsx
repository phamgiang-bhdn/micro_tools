import type React from "react";
import Link from "next/link";
import { Button } from "./ui/button";

export function Navbar(): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-1 py-0.5 ring-focus">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white shadow-glow">
            d.
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            deal<span className="text-brand-600">vault</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/">Khám phá</NavLink>
          <NavLink href="/?sort=top">Deal hot</NavLink>
          <NavLink href="/admin">Admin</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="brand" size="sm" className="hidden sm:inline-flex">
            <Link href="/">Săn deal</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="sm:hidden">
            <Link href="/">Deal</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-canvas hover:text-ink"
    >
      {children}
    </Link>
  );
}
