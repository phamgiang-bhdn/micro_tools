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

  const isReview = article.type === "REVIEW";
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

      {/* ───── HERO ───── */}
      <header className={`relative overflow-hidden bg-gradient-to-br ${visual.gradient} text-white`}>
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(255,255,255,0.18),transparent_50%)]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-12">
          <div>
            <nav className="mb-5 flex items-center gap-1.5 text-xs text-white/80">
              <Link href="/" className="hover:text-white">Trang chủ</Link>
              <span>›</span>
              <Link href="/blog" className="hover:text-white">Cẩm nang</Link>
              {article.niche ? (
                <>
                  <span>›</span>
                  <Link href={`/blog?category=${article.niche.slug}`} className="hover:text-white">
                    {article.niche.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                <span aria-hidden>{visual.icon}</span>
                {visual.label}
              </span>
              {article.niche ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  {article.niche.name}
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-[2.75rem]">
              {article.title}
            </h1>

            {article.excerpt ? (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">{article.excerpt}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/85">
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-white text-sm font-bold text-ink shadow-md">dv</span>
                <div>
                  <p className="font-semibold text-white">dealvault Team</p>
                  <p className="text-xs text-white/70">Biên tập viên</p>
                </div>
              </div>
              <span aria-hidden className="h-6 w-px bg-white/30" />
              {dateStr ? (
                <span className="inline-flex items-center gap-1.5"><CalendarIcon />{dateStr}</span>
              ) : null}
              {updatedStr ? (
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  · Cập nhật {updatedStr}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5"><ClockIcon />Đọc ~{mins} phút</span>
            </div>
          </div>

          {/* Hero visual: ảnh sản phẩm thật */}
          <HeroVisual images={heroImages} isReview={isReview} fallbackIcon={visual.icon} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            {hasSections ? <ArticleToc sections={article.sections!} /> : null}
          </aside>
          <div>
            {hasSections ? (
              article.sections!.map((section) => (
                <section
                  key={section.id}
                  id={section.anchorSlug}
                  className="mb-12 scroll-mt-24"
                >
                  <h2 className="text-2xl font-bold tracking-tight text-ink">{section.heading}</h2>
                  <div className="mt-5">
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

function HeroVisual({
  images,
  isReview,
  fallbackIcon
}: {
  images: string[];
  isReview: boolean;
  fallbackIcon: string;
}): React.ReactElement {
  if (images.length === 0) {
    return (
      <div className="hidden aspect-[4/5] place-items-center self-center rounded-3xl bg-white/15 backdrop-blur-sm lg:grid">
        <span aria-hidden className="select-none text-[160px] font-bold leading-none text-white/40">
          {fallbackIcon}
        </span>
      </div>
    );
  }

  if (isReview) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-white/15 shadow-2xl shadow-black/20 backdrop-blur-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" className="aspect-square w-full object-cover lg:aspect-[4/5]" />
      </div>
    );
  }

  // BUYING_GUIDE — collage 3 ảnh xếp xen kẽ
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="col-span-2 overflow-hidden rounded-2xl bg-white/15 shadow-xl shadow-black/20 backdrop-blur-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" className="aspect-[16/10] w-full object-cover" />
      </div>
      {images[1] ? (
        <div className="overflow-hidden rounded-2xl bg-white/15 shadow-lg shadow-black/15 backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[1]} alt="" className="aspect-square w-full object-cover" />
        </div>
      ) : null}
      {images[2] ? (
        <div className="overflow-hidden rounded-2xl bg-white/15 shadow-lg shadow-black/15 backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[2]} alt="" className="aspect-square w-full object-cover" />
        </div>
      ) : null}
    </div>
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
