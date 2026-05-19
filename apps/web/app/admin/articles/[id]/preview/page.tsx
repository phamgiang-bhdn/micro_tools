import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlockRenderer } from "../../../../../components/article/blocks/block-renderer";
import { ArticleToc } from "../../../../../components/article/article-toc";
import type { ArticleBlock, ArticleSectionPublic } from "../../../../../lib/types";

export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface PreviewDto {
  id: string;
  slug: string;
  title: string;
  status: string;
  excerpt: string | null;
  coverImage: string | null;
  author: { id: string; name: string; bio: string | null; avatarUrl: string | null } | null;
  niche: { slug: string; name: string } | null;
  sections: ArticleSectionPublic[];
}

async function getDetail(id: string): Promise<PreviewDto | null> {
  const res = await fetch(`${API_BASE_URL}/admin/articles/${id}/v2-detail`, {
    cache: "no-store",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as PreviewDto;
}

export default async function ArticlePreviewPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const article = await getDetail(id);
  if (!article) notFound();

  const hasSections = article.sections.length > 0;

  return (
    <article className="bg-canvas">
      <div className="sticky top-0 z-50 border-b border-admin-line bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="font-semibold">
            🔒 Xem trước — bài chưa đăng (trạng thái: {article.status}). Chỉ admin thấy.
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/articles/${id}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="size-3" /> Quay lại trình soạn
            </Link>
            {article.status === "PUBLISHED" ? (
              <Link
                href={`/blog/${article.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Xem bản đăng <ExternalLink className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <header className="bg-gradient-to-br from-brand-500 to-accent-500 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          {article.niche ? (
            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm">
              {article.niche.name}
            </span>
          ) : null}
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-[2.75rem]">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">{article.excerpt}</p>
          ) : null}
          {article.author ? (
            <div className="mt-6 flex items-center gap-3 text-sm">
              {article.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={article.author.avatarUrl} alt={article.author.name} className="size-10 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-white text-sm font-bold text-ink shadow">
                  {article.author.name.slice(0, 1)}
                </span>
              )}
              <div>
                <p className="font-semibold">{article.author.name}</p>
                <p className="text-xs text-white/70">Tác giả</p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            {hasSections ? <ArticleToc sections={article.sections} /> : null}
          </aside>
          <div>
            {hasSections ? (
              article.sections.map((section) => (
                <section key={section.id} id={section.anchorSlug} className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-bold tracking-tight text-ink">{section.heading}</h2>
                  {section.summary ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{section.summary}</p>
                  ) : null}
                  <div className="mt-5">
                    {section.blocks.length > 0 ? (
                      <BlockRenderer blocks={section.blocks as ArticleBlock[]} products={[]} />
                    ) : (
                      <p className="rounded-md border border-dashed border-line bg-card/60 p-4 text-sm text-ink-soft">
                        (Phần này chưa có nội dung — bước Viết bài chưa chạy hoặc bị đặt lại)
                      </p>
                    )}
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                Bài chưa có phần nào — bước Dàn ý chưa chạy. Vui lòng quay lại trình soạn và bấm bước 4.
              </div>
            )}
          </div>
        </div>
      </main>
    </article>
  );
}
