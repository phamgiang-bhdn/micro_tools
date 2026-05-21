import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchArticleBySlug, fetchNicheBySlug } from "../../../lib/api";
import { articleVisual, readingTime } from "../../../lib/article-format";
import { BlockRenderer } from "../../../components/article/blocks/block-renderer";
import { ArticleToc } from "../../../components/article/article-toc";
import { StickyProductCta } from "../../../components/article/sticky-product-cta";
import { ProductCardEnd } from "../../../components/article/product-card-end";
import { RelatedArticles } from "../../../components/article/related-articles";
import { ReadingProgress } from "../../../components/article/reading-progress";

export const revalidate = 300;

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
      url: `${SITE_URL}/blog/${article.slug}`,
      images: article.coverImage
        ? [article.coverImage]
        : article.products[0]?.scrapedData
          ? [(article.products[0].scrapedData as Record<string, unknown>).image as string].filter(Boolean) as string[]
          : undefined
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

  const niche = article.niche ? await fetchNicheBySlug(article.niche.slug) : null;
  const schemaConfig = (niche?.schemaConfig ?? undefined) as Record<string, unknown> | undefined;

  const visual = articleVisual(article.type);
  const fullText = (article.sections ?? []).map((s) => s.heading + "\n" + s.summary).join("\n") || article.body;
  const mins = readingTime(fullText);
  const dateStr = article.publishedAt ? dateFmt.format(new Date(article.publishedAt)) : "";
  // Hiện "Cập nhật: ..." nếu updatedAt khác publishedAt > 1 ngày. Pattern cellphones/sforum:
  // "Ngày cập nhật" là trust signal cho user biết bài còn fresh.
  const updatedAtRaw = (article as { updatedAt?: string }).updatedAt;
  const showUpdated = updatedAtRaw && article.publishedAt
    ? Math.abs(new Date(updatedAtRaw).getTime() - new Date(article.publishedAt).getTime()) > 24 * 60 * 60 * 1000
    : false;
  const updatedStr = showUpdated && updatedAtRaw ? dateFmt.format(new Date(updatedAtRaw)) : null;
  const related = ((article as { related?: typeof article[] }).related ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    type: "BUYING_GUIDE" | "REVIEW";
    publishedAt: string | null;
    niche: { slug: string; name: string } | null;
    coverImage: string | null;
  }>;
  const pinnedIds = ((article as { pinnedProductIds?: string[] }).pinnedProductIds ?? []);
  const featuredProducts = pinnedIds.length > 0
    ? article.products.filter((p) => pinnedIds.includes(p.id))
    : article.products.slice(0, 3);

  const productImages = article.products.slice(0, 3).map((p) => {
    const sd = (p.scrapedData ?? {}) as Record<string, unknown>;
    return typeof sd.image === "string" ? sd.image : null;
  }).filter((img): img is string => Boolean(img));
  const heroImages = article.coverImage ? [article.coverImage, ...productImages].slice(0, 3) : productImages;

  const hasSections = Array.isArray(article.sections) && article.sections.length > 0;

  // JSON-LD V2: Article + ItemList (TOC) + FAQPage (nếu có faq block) + Review (nếu type=REVIEW)
  const authorJsonLd = article.author
    ? { "@type": "Person", name: article.author.name, url: `${SITE_URL}/blog?author=${article.author.slug}` }
    : { "@type": "Organization", name: "dealvault" };

  const jsonLdParts: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.excerpt || article.metaDescription || undefined,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      image: heroImages,
      author: authorJsonLd,
      publisher: { "@type": "Organization", name: "dealvault", url: SITE_URL },
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${article.slug}` }
    }
  ];

  if (hasSections) {
    jsonLdParts.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: article.sections!.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.heading,
        url: `${SITE_URL}/blog/${article.slug}#${s.anchorSlug}`
      }))
    });

    // Gather FAQ items across sections
    const faqItems: Array<{ q: string; a: string }> = [];
    for (const s of article.sections!) {
      for (const b of s.blocks) {
        if (b && typeof b === "object" && (b as Record<string, unknown>).type === "faq") {
          const items = (b as { items?: Array<{ q?: string; a?: string }> }).items ?? [];
          for (const it of items) {
            if (it?.q && it?.a) faqItems.push({ q: it.q, a: it.a });
          }
        }
      }
    }
    if (faqItems.length > 0) {
      jsonLdParts.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a }
        }))
      });
    }
  }

  return (
    <article className="bg-canvas">
      {jsonLdParts.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}

      <ReadingProgress />

      {/* Thin brand stripe — giữ identity nhẹ, không choáng */}
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500" />

      {/* ───── HERO compact ───── */}
      <header className="border-b border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[1fr_280px] lg:items-center lg:gap-10">
          <div>
            <nav className="flex items-center gap-1.5 text-[11.5px] text-ink-mute">
              <Link href="/" className="hover:text-ink">Trang chủ</Link>
              <span aria-hidden>›</span>
              <Link href="/blog" className="hover:text-ink">Cẩm nang</Link>
              {article.niche ? (
                <>
                  <span aria-hidden>›</span>
                  <Link href={`/blog?category=${article.niche.slug}`} className="hover:text-ink">
                    {article.niche.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full ${visual.softBg} px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${visual.accent}`}>
                <span aria-hidden>{visual.icon}</span>
                {visual.label}
              </span>
              {article.niche ? (
                <span className="inline-flex items-center rounded-full bg-card-soft px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">
                  {article.niche.name}
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-ink sm:text-[28px] md:text-[30px]">
              {article.title}
            </h1>

            {article.excerpt ? (
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">{article.excerpt}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-soft">
              <div className="flex items-center gap-2">
                {article.author?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.author.avatarUrl} alt={article.author.name} className="size-7 rounded-full object-cover" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                    {article.author ? article.author.name.slice(0, 1) : "dv"}
                  </span>
                )}
                <span className="font-medium text-ink">{article.author?.name ?? "dealvault Team"}</span>
              </div>
              {dateStr ? (
                <>
                  <span aria-hidden className="text-ink-mute">·</span>
                  <span className="inline-flex items-center gap-1 text-ink-mute"><CalendarIcon />{dateStr}</span>
                </>
              ) : null}
              {updatedStr ? (
                <>
                  <span aria-hidden className="text-ink-mute">·</span>
                  <span className="text-ink-mute">Cập nhật {updatedStr}</span>
                </>
              ) : null}
              <span aria-hidden className="text-ink-mute">·</span>
              <span className="inline-flex items-center gap-1 text-ink-mute"><ClockIcon />~{mins} phút đọc</span>
              {hasSections ? (
                <>
                  <span aria-hidden className="text-ink-mute">·</span>
                  <span className="text-ink-mute">{article.sections!.length} phần</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Hero image nhỏ — 1 ảnh main, không collage. Mobile: hide. */}
          {heroImages.length > 0 ? (
            <div className="hidden overflow-hidden rounded-xl border border-line bg-card-soft lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImages[0]} alt="" className="aspect-[5/4] w-full object-cover" />
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
          <aside className="hidden lg:block">
            {hasSections ? <ArticleToc sections={article.sections!} /> : null}
          </aside>
          <div className="max-w-[760px]">
            {hasSections ? (
              article.sections!.map((section, idx) => (
                <section
                  key={section.id}
                  id={section.anchorSlug}
                  className="mb-14 scroll-mt-24"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-[12px] font-semibold tabular-nums text-brand-600">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-tight text-ink sm:text-[26px]">
                    {section.heading}
                  </h2>
                  <div className="mt-6">
                    <BlockRenderer
                      blocks={section.blocks}
                      products={article.products}
                      schemaConfig={schemaConfig}
                    />
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                Bài này chưa có nội dung sections — vui lòng quay lại sau.
              </div>
            )}

            {/* Product card end — pattern cellphones: chốt deal cuối bài với giá + nút Xem deal */}
            <ProductCardEnd products={featuredProducts} />

            {article.author ? (
              <aside className="mt-12 flex items-start gap-4 rounded-2xl border border-line bg-card/60 p-5">
                {article.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.author.avatarUrl} alt={article.author.name} className="size-12 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 font-bold">
                    {article.author.name.slice(0, 1)}
                  </span>
                )}
                <div className="text-sm leading-6 text-ink-soft">
                  <p className="font-semibold text-ink">{article.author.name}</p>
                  {article.author.bio ? <p className="mt-1">{article.author.bio}</p> : null}
                </div>
              </aside>
            ) : null}

            <aside className="mt-10 flex gap-4 rounded-2xl border border-line bg-card/60 p-5 shadow-sm">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <InfoIcon />
              </span>
              <div className="text-sm leading-6 text-ink-soft">
                <p className="font-semibold text-ink">Minh bạch về affiliate</p>
                <p className="mt-1">
                  Bài này có liên kết affiliate — nếu bạn mua qua link, dealvault nhận hoa hồng từ đối tác mà bạn không phải trả thêm.
                </p>
              </div>
            </aside>

            {/* Bài liên quan cùng niche — giữ user trong site, tăng pageview/session */}
            <RelatedArticles articles={related} currentNicheName={article.niche?.name} />

            <div className="mt-10 flex justify-center">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
              >
                <BackArrowIcon /> Xem thêm bài viết khác
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Floating CTA "Sản phẩm có trong bài" — hiển thị khi user scroll qua hero */}
      <StickyProductCta products={featuredProducts} articleId={article.id} />
    </article>
  );
}

function CalendarIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

function ClockIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function InfoIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v5h1" />
    </svg>
  );
}

function BackArrowIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
