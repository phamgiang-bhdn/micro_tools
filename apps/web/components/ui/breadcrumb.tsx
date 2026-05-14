import type React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }): React.ReactElement {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="rounded px-1 py-0.5 hover:bg-white/70 hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-ink" : "px-1"}>{item.label}</span>
              )}
              {!isLast ? (
                <span aria-hidden className="text-ink-mute">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
