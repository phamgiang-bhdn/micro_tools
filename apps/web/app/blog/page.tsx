import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticles, fetchCategories } from "../../lib/api";
import { EmptyState } from "../../components/ui/empty-state";
import { PageHero, PageSection, SectionHeading } from "../../components/ui/section";
import { FilterChip } from "../../components/ui/filter-chip";
import { ArticleCard, FeaturedArticleCard } from "../../components/storefront/article-card";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cẩm nang & Review — dealvault",
  description:
    "Hướng dẫn chọn mua, review chi tiết và so sánh sản phẩm — viết bởi đội ngũ dealvault dựa trên trải nghiệm thực tế.",
  alternates: { canonical: "/blog" }
};

interface BlogProps {
  searchParams: Promise<{ type?: string; category?: string }>;
}

export default async function BlogIndexPage({ searchParams }: BlogProps): Promise<React.ReactElement> {
  const { type, category: categorySlug } = await searchParams;
  const typeFilter =
    type === "BUYING_GUIDE" || type === "REVIEW" ? (type as "BUYING_GUIDE" | "REVIEW") : undefined;

  const [articles, { categories }] = await Promise.all([
    fetchArticles({ type: typeFilter, categorySlug, limit: 50 }),
    fetchCategories()
  ]);

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="bg-canvas">
      <PageHero
        size="md"
        mesh={false}
        className="bg-card"
        eyebrow={
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
            Cẩm nang dealvault
          </>
        }
        title={
          <>
            Đọc trước khi{" "}
            <span className="bg-gradient-to-r from-brand-600 to-orange-500 bg-clip-text text-transparent">
              xuống tiền
            </span>
            .
          </>
        }
        description="Hướng dẫn chọn mua, review từng sản phẩm và so sánh đa nguồn — tổng hợp để bạn quyết định trong 5 phút."
      />

      <PageSection padding="default">
        <FilterRow typeFilter={typeFilter} categorySlug={categorySlug} categories={categories} />

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
            {featured ? <FeaturedArticleCard article={featured} /> : null}
            {rest.length > 0 ? (
              <section className="mt-12">
                <SectionHeading
                  title="Tất cả bài viết"
                  description={`${rest.length} bài cùng chủ đề — đọc tiếp để chốt deal tự tin hơn.`}
                  size="sm"
                />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </PageSection>
    </div>
  );
}

interface FilterRowProps {
  typeFilter?: "BUYING_GUIDE" | "REVIEW";
  categorySlug?: string;
  categories: Array<{ id: string; slug: string; name: string }>;
}

function FilterRow({ typeFilter, categorySlug, categories }: FilterRowProps): React.ReactElement {
  const catSuffix = categorySlug ? `&category=${categorySlug}` : "";
  const typeSuffix = typeFilter ? `&type=${typeFilter}` : "";
  return (
    <div className="mb-8 space-y-3">
      <nav aria-label="Lọc theo loại bài" className="flex flex-wrap items-center gap-2">
        <FilterChip href="/blog" active={!typeFilter && !categorySlug} label="Tất cả" />
        <FilterChip
          href={`/blog?type=BUYING_GUIDE${catSuffix}`}
          active={typeFilter === "BUYING_GUIDE"}
          label="Cẩm nang chọn mua"
        />
        <FilterChip
          href={`/blog?type=REVIEW${catSuffix}`}
          active={typeFilter === "REVIEW"}
          label="Review"
        />
      </nav>
      {categories.length > 0 ? (
        <nav
          aria-label="Lọc theo danh mục"
          className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-ink-mute">
            Danh mục
          </span>
          <FilterChip
            href={typeFilter ? `/blog?type=${typeFilter}` : "/blog"}
            active={!categorySlug}
            label="Tất cả"
          />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              href={`/blog?category=${c.slug}${typeSuffix}`}
              active={categorySlug === c.slug}
              label={c.name}
            />
          ))}
        </nav>
      ) : null}
    </div>
  );
}
