import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticles, fetchTools } from "../../lib/api";
import { articleVisual } from "../../lib/article-format";
import { EmptyState } from "../../components/ui/empty-state";
import type { ArticleSummary } from "../../lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cẩm nang & Review — dealvault",
  description:
    "Hướng dẫn chọn mua, review chi tiết và so sánh sản phẩm — viết bởi đội ngũ dealvault dựa trên trải nghiệm thực tế.",
  alternates: { canonical: "/blog" }
};

interface BlogProps {
  searchParams: Promise<{ type?: string; tool?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function BlogIndexPage({ searchParams }: BlogProps): Promise<React.ReactElement> {
  const { type, tool: toolSlug } = await searchParams;
  const typeFilter =
    type === "BUYING_GUIDE" || type === "REVIEW" ? (type as "BUYING_GUIDE" | "REVIEW") : undefined;

  const [articles, { tools }] = await Promise.all([
    fetchArticles({ type: typeFilter, toolSlug, limit: 50 }),
    fetchTools()
  ]);

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="bg-canvas">
      <header className="border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
                <span className="size-1.5 rounded-full bg-brand-500" /> Cẩm nang dealvault
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-5xl">
                Đọc trước khi <span className="bg-gradient-to-r from-brand-600 to-orange-500 bg-clip-text text-transparent">xuống tiền</span>.
              </h1>
              <p className="text-base text-ink-soft sm:text-lg">
                Hướng dẫn chọn mua, review từng sản phẩm và so sánh đa nguồn — tổng hợp lại để bạn quyết định trong 5 phút.
              </p>
            </div>
            <div className="hidden text-right text-xs text-ink-mute sm:block">
              <p>{articles.length} bài đang đăng</p>
              <p className="mt-1">Cập nhật bởi dealvault Team</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex flex-wrap items-center gap-2">
          <FilterChip href="/blog" active={!typeFilter && !toolSlug} label="Tất cả" />
          <FilterChip
            href={`/blog?type=BUYING_GUIDE${toolSlug ? `&tool=${toolSlug}` : ""}`}
            active={typeFilter === "BUYING_GUIDE"}
            label="Cẩm nang chọn mua"
          />
          <FilterChip
            href={`/blog?type=REVIEW${toolSlug ? `&tool=${toolSlug}` : ""}`}
            active={typeFilter === "REVIEW"}
            label="Review"
          />
          {tools.length > 0 ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-mute">Danh mục:</span>
              <FilterChip
                href={typeFilter ? `/blog?type=${typeFilter}` : "/blog"}
                active={!toolSlug}
                label="Tất cả"
              />
              {tools.map((t) => (
                <FilterChip
                  key={t.id}
                  href={`/blog?tool=${t.slug}${typeFilter ? `&type=${typeFilter}` : ""}`}
                  active={toolSlug === t.slug}
                  label={t.name}
                />
              ))}
            </div>
          ) : null}
        </nav>

        {articles.length === 0 ? (
          <EmptyState
            tone="warning"
            title="Chưa có bài viết phù hợp"
            description={
              <p>
                Vào{" "}
                <Link href="/admin/articles" className="text-brand-700 hover:underline">
                  admin/articles
                </Link>{" "}
                để tạo bài đầu tiên bằng AI, sau đó duyệt và publish.
              </p>
            }
          />
        ) : (
          <>
            {featured ? <FeaturedCard article={featured} /> : null}
            {rest.length > 0 ? (
              <section className="mt-12">
                <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mute">Tất cả bài viết</h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function FeaturedCard({ article }: { article: ArticleSummary }): React.ReactElement {
  const visual = articleVisual(article.type);
  const dateStr = article.publishedAt ? dateFmt.format(new Date(article.publishedAt)) : "";

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
          <div className={`flex size-full items-center justify-center bg-gradient-to-br ${visual.gradient} p-8 text-white`}>
            <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
            <div className="relative text-center">
              <span aria-hidden className="block text-7xl">{visual.icon}</span>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">{visual.label}</p>
            </div>
          </div>
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
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          {article.tool ? <span>{article.tool.name}</span> : null}
          {article.tool && dateStr ? <span aria-hidden>·</span> : null}
          {dateStr ? <span>{dateStr}</span> : null}
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink group-hover:text-brand-700 sm:text-3xl">
          {article.title}
        </h2>
        {article.excerpt ? <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-ink-soft">{article.excerpt}</p> : null}
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 transition-all">
          Đọc bài đầy đủ <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

function ArticleCard({ article }: { article: ArticleSummary }): React.ReactElement {
  const visual = articleVisual(article.type);
  const dateStr = article.publishedAt ? dateFmt.format(new Date(article.publishedAt)) : "";

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
            <span aria-hidden className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/40 via-black/10 to-transparent`} />
          </>
        ) : (
          <div className={`flex size-full items-center justify-center bg-gradient-to-br ${visual.gradient} p-6 text-white`}>
            <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_55%)]" />
            <span aria-hidden className="relative text-5xl">{visual.icon}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink shadow-sm">
          <span aria-hidden>{visual.icon}</span>
          {visual.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          {article.tool ? <span>{article.tool.name}</span> : null}
          {article.tool && dateStr ? <span aria-hidden>·</span> : null}
          {dateStr ? <span>{dateStr}</span> : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-ink group-hover:text-brand-700">
          {article.title}
        </h3>
        {article.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-soft">{article.excerpt}</p> : null}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-mute">
            <AvatarDot /> dealvault Team
          </span>
          <span className="font-semibold text-brand-700 group-hover:underline">Đọc tiếp →</span>
        </div>
      </div>
    </Link>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }): React.ReactElement {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ink text-white shadow-sm"
          : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
      }`}
    >
      {label}
    </Link>
  );
}

function AvatarDot(): React.ReactElement {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-orange-500 text-[9px] font-bold text-white">
      d
    </span>
  );
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
