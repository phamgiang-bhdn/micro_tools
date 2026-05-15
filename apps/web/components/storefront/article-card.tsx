import type React from "react";
import Link from "next/link";
import { articleVisual } from "../../lib/article-format";
import { Icon } from "../ui/icon";
import type { ArticleSummary } from "../../lib/types";

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function ArticleMeta({ article }: { article: ArticleSummary }): React.ReactElement {
  const dateStr = article.publishedAt ? dateFmt.format(new Date(article.publishedAt)) : "";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
      {article.category ? <span>{article.category.name}</span> : null}
      {article.category && dateStr ? <span aria-hidden>·</span> : null}
      {dateStr ? <span>{dateStr}</span> : null}
    </div>
  );
}

function ArticleVisualOverlay({
  visual,
  size
}: {
  visual: ReturnType<typeof articleVisual>;
  size: "lg" | "md";
}): React.ReactElement {
  return (
    <div className={`flex size-full items-center justify-center bg-gradient-to-br ${visual.gradient} p-${size === "lg" ? "8" : "6"} text-white`}>
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
      <div className="relative text-center">
        <span aria-hidden className={size === "lg" ? "block text-7xl" : "block text-5xl"}>
          {visual.icon}
        </span>
        {size === "lg" ? (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">{visual.label}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FeaturedArticleCard({ article }: { article: ArticleSummary }): React.ReactElement {
  const visual = articleVisual(article.type);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid overflow-hidden rounded-3xl border border-line bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-pop md:grid-cols-5"
    >
      <div className="relative aspect-[5/3] overflow-hidden md:col-span-2 md:aspect-auto">
        {article.coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImage}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition duration-500 group-hover:scale-105"
            />
            <span aria-hidden className={`absolute inset-0 bg-gradient-to-tr ${visual.gradient} mix-blend-multiply opacity-25`} />
          </>
        ) : (
          <ArticleVisualOverlay visual={visual} size="lg" />
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm">
          <span aria-hidden>{visual.icon}</span>
          {visual.label}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
          Bài nổi bật
        </span>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8 md:col-span-3">
        <ArticleMeta article={article} />
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink group-hover:text-brand-700 sm:text-3xl">
          {article.title}
        </h2>
        {article.excerpt ? (
          <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-ink-soft">{article.excerpt}</p>
        ) : null}
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-all group-hover:gap-2">
          Đọc bài đầy đủ <Icon name="arrow-right" size="sm" />
        </span>
      </div>
    </Link>
  );
}

export function ArticleCard({ article }: { article: ArticleSummary }): React.ReactElement {
  const visual = articleVisual(article.type);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {article.coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImage}
              alt={article.title}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition duration-500 group-hover:scale-105"
            />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
          </>
        ) : (
          <ArticleVisualOverlay visual={visual} size="md" />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm">
          <span aria-hidden>{visual.icon}</span>
          {visual.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <ArticleMeta article={article} />
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-ink group-hover:text-brand-700">
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-soft">{article.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-mute">
            <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-orange-500 text-[9px] font-bold text-white">
              d
            </span>
            dealvault Team
          </span>
          <span className="font-semibold text-brand-700 group-hover:underline">Đọc tiếp →</span>
        </div>
      </div>
    </Link>
  );
}
