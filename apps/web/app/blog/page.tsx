import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticles, fetchTools } from "../../lib/api";
import { EmptyState } from "../../components/ui/empty-state";

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

const TYPE_LABEL: Record<string, string> = {
  BUYING_GUIDE: "Cẩm nang chọn mua",
  REVIEW: "Review chi tiết"
};

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function BlogIndexPage({ searchParams }: BlogProps): Promise<React.ReactElement> {
  const { type, tool: toolSlug } = await searchParams;
  const typeFilter =
    type === "BUYING_GUIDE" || type === "REVIEW" ? (type as "BUYING_GUIDE" | "REVIEW") : undefined;

  const [articles, { tools }] = await Promise.all([
    fetchArticles({ type: typeFilter, toolSlug, limit: 50 }),
    fetchTools()
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">Cẩm nang dealvault</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Đọc trước khi xuống tiền.
        </h1>
        <p className="max-w-2xl text-base text-ink-soft">
          Hướng dẫn chọn mua, review từng sản phẩm cụ thể và so sánh đa nguồn — tổng hợp lại để bạn quyết định trong 5 phút.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
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
              label="Mọi danh mục"
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
      </div>

      {articles.length === 0 ? (
        <EmptyState
          tone="warning"
          title="Chưa có bài viết phù hợp"
          description={
            <p>
              Vào <Link href="/admin/articles" className="text-brand-700 hover:underline">admin/articles</Link> để tạo bài
              đầu tiên bằng AI, sau đó duyệt và publish.
            </p>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                href={`/blog/${article.slug}`}
                className="group block h-full rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
              >
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">
                    {TYPE_LABEL[article.type] ?? article.type}
                  </span>
                  {article.tool ? <span>· {article.tool.name}</span> : null}
                  {article.publishedAt ? <span>· {dateFmt.format(new Date(article.publishedAt))}</span> : null}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-ink group-hover:text-brand-700">{article.title}</h2>
                {article.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{article.excerpt}</p> : null}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                  Đọc tiếp →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label
}: {
  href: string;
  active: boolean;
  label: string;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? "bg-ink text-white"
          : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
      }`}
    >
      {label}
    </Link>
  );
}
