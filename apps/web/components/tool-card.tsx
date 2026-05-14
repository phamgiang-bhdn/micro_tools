import type React from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import type { ToolItem } from "../lib/types";

const ICONS = ["🛍️", "💳", "✈️", "🏠", "📱", "🎮", "💄", "🍽️", "🚗", "📚"] as const;

function pickIcon(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return ICONS[hash % ICONS.length];
}

export function ToolCard({ tool }: { tool: ToolItem }): React.ReactElement {
  const count = tool._count?.products ?? 0;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-2xl ring-1 ring-brand-100">
          <span aria-hidden>{pickIcon(tool.slug)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink group-hover:text-brand-700">{tool.name}</h3>
          <p className="truncate text-xs text-ink-mute">/{tool.slug}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Badge tone="accent">{count} sản phẩm</Badge>
        <span className="text-sm font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
          So sánh →
        </span>
      </div>
    </Link>
  );
}
