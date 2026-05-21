import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock } from "lucide-react";
import { BlockRenderer } from "../../../../../components/article/blocks/block-renderer";
import { ArticleToc } from "../../../../../components/article/article-toc";
import { ReadingProgress } from "../../../../../components/article/reading-progress";
import { readingTime } from "../../../../../lib/article-format";
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

  // Reading time: gộp text từ heading + summary + plain text trong blocks
  // (chỉ approx — đủ chính xác để hiển thị "~7 phút đọc").
  const fullText = article.sections
    .map((s) => {
      const blockText = (s.blocks ?? [])
        .map((b) => {
          if (!b || typeof b !== "object") return "";
          const obj = b as Record<string, unknown>;
          if (typeof obj.markdown === "string") return obj.markdown;
          if (typeof obj.body === "string") return obj.body;
          if (typeof obj.text === "string") return obj.text;
          if (typeof obj.summary === "string") return obj.summary;
          return "";
        })
        .join("\n");
      return `${s.heading}\n${s.summary}\n${blockText}`;
    })
    .join("\n");
  const mins = readingTime(fullText);

  return (
    <article className="bg-canvas">
      <ReadingProgress />
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

      {/* Thin brand accent ở top — giữ identity nhẹ, không choáng */}
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500" />

      <header className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
          {article.niche ? (
            <span className="inline-flex items-center rounded-full bg-card-soft px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-soft">
              {article.niche.name}
            </span>
          ) : null}
          <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-ink sm:text-[26px]">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-soft">{article.excerpt}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-soft">
            {article.author ? (
              <div className="flex items-center gap-2">
                {article.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.author.avatarUrl} alt={article.author.name} className="size-7 rounded-full object-cover" />
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                    {article.author.name.slice(0, 1)}
                  </span>
                )}
                <span className="font-medium text-ink">{article.author.name}</span>
              </div>
            ) : null}
            {article.author ? <span aria-hidden className="text-ink-mute">·</span> : null}
            <span className="inline-flex items-center gap-1 text-ink-mute">
              <Clock className="size-3.5" /> ~{mins} phút đọc
            </span>
            <span aria-hidden className="text-ink-mute">·</span>
            <span className="text-ink-mute">{article.sections.length} phần</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
          <aside className="hidden lg:block">
            {hasSections ? <ArticleToc sections={article.sections} /> : null}
          </aside>
          <div className="max-w-[760px]">
            {hasSections ? (
              article.sections.map((section, idx) => (
                <section
                  key={section.id}
                  id={section.anchorSlug}
                  className="mb-14 scroll-mt-24 first:mt-0"
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
