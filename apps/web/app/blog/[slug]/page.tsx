import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { fetchArticleBySlug, fetchToolBySlug } from "../../../lib/api";
import { articleVisual, readingTime } from "../../../lib/article-format";
import { ComparisonTable } from "../../../components/article/comparison-table";
import { QuickPicks } from "../../../components/article/quick-picks";
import { SpecsTable } from "../../../components/article/specs-table";
import { VerdictCard } from "../../../components/article/verdict-card";

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
      images: article.products[0]?.scrapedData
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

  const tool = article.tool ? await fetchToolBySlug(article.tool.slug) : null;
  const schemaConfig = (tool?.schemaConfig ?? undefined) as Record<string, unknown> | undefined;

  const visual = articleVisual(article.type);
  const mins = readingTime(article.body);
  const dateStr = article.publishedAt ? dateFmt.format(new Date(article.publishedAt)) : "";

  const isReview = article.type === "REVIEW";
  const heroProduct = article.products[0];
  const heroImages = article.products.slice(0, 3).map((p) => {
    const sd = (p.scrapedData ?? {}) as Record<string, unknown>;
    return typeof sd.image === "string" ? sd.image : null;
  }).filter((img): img is string => Boolean(img));

  // Chèn 1 CTA inline sau H2 đầu tiên (nếu có heroProduct)
  const bodyParts = splitAfterFirstH2(article.body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt || article.metaDescription || undefined,
    datePublished: article.publishedAt,
    image: heroImages,
    author: { "@type": "Organization", name: "dealvault" },
    publisher: { "@type": "Organization", name: "dealvault" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${article.slug}` }
  };

  return (
    <article className="bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
              {article.tool ? (
                <>
                  <span>›</span>
                  <Link href={`/blog?tool=${article.tool.slug}`} className="hover:text-white">
                    {article.tool.name}
                  </Link>
                </>
              ) : null}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                <span aria-hidden>{visual.icon}</span>
                {visual.label}
              </span>
              {article.tool ? (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                  {article.tool.name}
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
              <span className="inline-flex items-center gap-1.5"><ClockIcon />Đọc ~{mins} phút</span>
            </div>
          </div>

          {/* Hero visual: ảnh sản phẩm thật */}
          <HeroVisual images={heroImages} isReview={isReview} fallbackIcon={visual.icon} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        {/* ───── TYPE-SPECIFIC: trên đầu body ───── */}
        {isReview && heroProduct ? (
          <VerdictCard product={heroProduct} excerpt={article.excerpt} />
        ) : null}
        {!isReview && article.products.length > 0 ? (
          <QuickPicks products={article.products} />
        ) : null}

        {/* ───── BODY ───── */}
        <div className="prose prose-slate max-w-none prose-headings:mt-10 prose-headings:font-semibold prose-h2:mt-12 prose-h2:text-2xl prose-h2:tracking-tight prose-h3:text-xl prose-p:leading-7 prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-li:marker:text-brand-500 prose-blockquote:border-l-4 prose-blockquote:border-brand-300 prose-blockquote:bg-card prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-blockquote:text-ink-soft prose-img:rounded-xl">
          <ReactMarkdown>{bodyParts.before}</ReactMarkdown>
        </div>

        {/* Inline CTA hoặc inline compact comparison sau H2 đầu */}
        {bodyParts.after ? (
          <>
            {!isReview && article.products.length >= 2 ? (
              <ComparisonTable products={article.products} schemaConfig={schemaConfig} />
            ) : null}
            <div className="prose prose-slate max-w-none prose-headings:mt-10 prose-headings:font-semibold prose-h2:mt-12 prose-h2:text-2xl prose-h2:tracking-tight prose-h3:text-xl prose-p:leading-7 prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-li:marker:text-brand-500 prose-blockquote:border-l-4 prose-blockquote:border-brand-300 prose-blockquote:bg-card prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-blockquote:text-ink-soft prose-img:rounded-xl">
              <ReactMarkdown>{bodyParts.after}</ReactMarkdown>
            </div>
          </>
        ) : null}

        {/* ───── TYPE-SPECIFIC: dưới body ───── */}
        {isReview && heroProduct ? (
          <SpecsTable product={heroProduct} schemaConfig={schemaConfig} />
        ) : null}

        {/* All products grid (fallback nếu không có verdict/quickpicks ở trên) */}
        {!isReview && article.products.length > 3 ? (
          <section className="mt-14">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Tất cả sản phẩm trong bài</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">Danh sách đầy đủ</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {article.products.slice(3).map((p) => (
                <CompactProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* AFFILIATE DISCLOSURE */}
        <aside className="mt-14 flex gap-4 rounded-2xl border border-line bg-card/60 p-5 shadow-sm">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <InfoIcon />
          </span>
          <div className="text-sm leading-6 text-ink-soft">
            <p className="font-semibold text-ink">Minh bạch về affiliate</p>
            <p className="mt-1">
              Bài này có liên kết affiliate — nếu bạn mua qua link, dealvault nhận hoa hồng từ đối tác mà bạn không phải trả thêm.
              Giá có thể đã thay đổi từ lúc viết, vui lòng kiểm tra lại trên trang đối tác.
            </p>
          </div>
        </aside>

        <div className="mt-10 flex justify-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
          >
            <BackArrowIcon /> Xem thêm bài viết khác
          </Link>
        </div>
      </main>
    </article>
  );
}

/**
 * Tách markdown body làm 2 phần tại heading H2 đầu tiên.
 * Trả về { before, after } — `before` luôn có, `after` có thể rỗng.
 */
function splitAfterFirstH2(body: string): { before: string; after: string } {
  // Tìm vị trí H2 thứ HAI (vì H2 đầu thường là "TL;DR" — không muốn cắt ngay đó)
  const matches = [...body.matchAll(/^##\s/gm)];
  if (matches.length < 2) return { before: body, after: "" };
  const secondH2 = matches[1].index ?? 0;
  return { before: body.slice(0, secondH2).trim(), after: body.slice(secondH2).trim() };
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

function CompactProductCard({ product }: { product: { id: string; name: string; scrapedData: Record<string, unknown> } }): React.ReactElement {
  const sd = product.scrapedData ?? {};
  const image = typeof sd.image === "string" ? sd.image : null;
  return (
    <div className="rounded-xl border border-line bg-card p-3 shadow-card">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={product.name} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-lg bg-gradient-to-br from-brand-50 to-accent-50 text-2xl font-bold text-brand-700">
          ★
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
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
