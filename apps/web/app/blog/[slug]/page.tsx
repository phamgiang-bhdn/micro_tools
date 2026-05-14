import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { fetchArticleBySlug } from "../../../lib/api";
import { normalizeProduct } from "../../../lib/format";
import { ProductCard } from "../../../components/product-card";

export const revalidate = 300;

const TYPE_LABEL: Record<string, string> = {
  BUYING_GUIDE: "Cẩm nang chọn mua",
  REVIEW: "Review chi tiết"
};

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3100";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);
  if (!article) return { title: "Bài viết không tồn tại — dealvault" };

  return {
    title: article.metaTitle || `${article.title} — dealvault`,
    description: article.metaDescription || article.excerpt || undefined,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt || undefined,
      url: `${SITE_URL}/blog/${article.slug}`
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt || undefined
    }
  };
}

export default async function ArticleDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const article = await fetchArticleBySlug(slug);
  if (!article) notFound();

  const relatedProducts = article.products.map(normalizeProduct);
  const toolSlug = article.tool?.slug;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || article.metaDescription || undefined,
    datePublished: article.publishedAt,
    author: { "@type": "Organization", name: "dealvault" },
    publisher: { "@type": "Organization", name: "dealvault" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${article.slug}` }
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-xs text-ink-mute">
        <Link href="/" className="hover:text-ink">
          Trang chủ
        </Link>
        <span> / </span>
        <Link href="/blog" className="hover:text-ink">
          Cẩm nang
        </Link>
        {article.tool ? (
          <>
            <span> / </span>
            <Link href={`/blog?tool=${article.tool.slug}`} className="hover:text-ink">
              {article.tool.name}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">
            {TYPE_LABEL[article.type] ?? article.type}
          </span>
          {article.tool ? <span>· {article.tool.name}</span> : null}
          {article.publishedAt ? <span>· {dateFmt.format(new Date(article.publishedAt))}</span> : null}
          <span>· dealvault Team</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{article.title}</h1>
        {article.excerpt ? <p className="text-lg leading-relaxed text-ink-soft">{article.excerpt}</p> : null}
      </header>

      <div className="prose prose-slate max-w-none prose-headings:mt-8 prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-a:text-brand-700 hover:prose-a:underline prose-strong:text-ink prose-img:rounded-xl">
        <ReactMarkdown>{article.body}</ReactMarkdown>
      </div>

      {relatedProducts.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="mb-4 text-xl font-semibold text-ink">Sản phẩm được nhắc trong bài</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {relatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                toolSlug={toolSlug ?? "san-pham"}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12 rounded-2xl border border-line bg-canvas/60 p-5 text-sm text-ink-mute">
        <p>
          <strong className="text-ink">Một ghi chú từ dealvault.</strong> Bài này có liên kết affiliate — nếu bạn mua qua link, dealvault nhận hoa hồng từ đối tác mà bạn không phải trả thêm. Chúng tôi chỉ giới thiệu thứ chúng tôi tin là đáng tiền.
        </p>
      </div>
    </article>
  );
}
