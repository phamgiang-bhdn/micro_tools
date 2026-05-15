import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchTools, fetchToolBySlug } from "../../../../lib/api";
import type { ArticleAdminDetail, ArticleStatus } from "../../../../lib/types";
import { archiveArticleAction, publishArticleAction } from "../../actions";
import { ArticleEditorClient } from "./article-editor-client";
import { GeneratingScreen } from "./generating-screen";

export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path} failed: ${await response.text()}`);
  return (await response.json()) as T;
}

const STATUS_BADGE: Record<ArticleStatus, string> = {
  GENERATING: "bg-sky-50 text-sky-700 ring-sky-200",
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200"
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  GENERATING: "AI đang sinh nội dung...",
  DRAFT: "Bản nháp — chưa public",
  PUBLISHED: "Đã đăng",
  ARCHIVED: "Đã lưu trữ",
  FAILED: "Sinh bài thất bại"
};

const TYPE_LABEL: Record<string, string> = {
  BUYING_GUIDE: "Cẩm nang chọn mua",
  REVIEW: "Review chi tiết"
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminArticleDetail({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const article = await getJson<ArticleAdminDetail>(`/admin/articles/${id}`);
  if (!article) notFound();

  if (article.status === "GENERATING") {
    return <GeneratingScreen articleId={article.id} topic={article.title} />;
  }

  const { tools } = await fetchTools();
  const toolDetails = await Promise.all(tools.map((t) => fetchToolBySlug(t.slug)));
  const productOptions = toolDetails
    .filter((t) => t !== null)
    .flatMap((tool) =>
      tool!.products.map((p) => ({ id: p.id, name: p.name, toolName: tool!.name }))
    );

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/articles" className="text-xs text-admin-mute hover:text-admin-ink">
          ← Quay lại danh sách
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
              <span className="rounded bg-admin-subtle px-1.5 py-0.5">
                {TYPE_LABEL[article.type] ?? article.type}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${STATUS_BADGE[article.status]}`}
              >
                {STATUS_LABEL[article.status]}
              </span>
              {article.aiModel ? <span>· AI: {article.aiModel}</span> : null}
              {article.aiPromptName ? <span>· prompt: {article.aiPromptName}</span> : null}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-admin-ink">{article.title}</h1>
            <p className="mt-1 text-xs text-admin-mute">
              /blog/{article.slug}
              {article.status === "PUBLISHED" ? (
                <Link
                  href={`/blog/${article.slug}`}
                  target="_blank"
                  className="ml-2 text-admin-accent hover:underline"
                >
                  Xem live ↗
                </Link>
              ) : null}
            </p>
          </div>

          <div className="flex gap-2">
            {article.status !== "PUBLISHED" ? (
              <form action={publishArticleAction}>
                <input type="hidden" name="id" value={article.id} />
                <input type="hidden" name="reviewer" value="admin" />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Publish
                </button>
              </form>
            ) : null}
            {article.status !== "ARCHIVED" ? (
              <form action={archiveArticleAction}>
                <input type="hidden" name="id" value={article.id} />
                <input type="hidden" name="reviewer" value="admin" />
                <button
                  type="submit"
                  className="rounded-lg border border-admin-line bg-admin-surface px-4 py-2 text-sm font-semibold text-admin-mute hover:border-rose-200 hover:text-rose-700"
                >
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      {article.status === "FAILED" && article.generationError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>AI sinh bài thất bại:</strong>
          <pre className="mt-1 whitespace-pre-wrap text-xs">{article.generationError}</pre>
          <p className="mt-2 text-xs">Xoá bài này và tạo lại, hoặc tự fill nội dung tay.</p>
        </div>
      ) : null}

      {article.products.length > 0 ? (
        <div className="rounded-lg border border-admin-line bg-admin-surface p-4 text-sm">
          <div className="mb-2 font-semibold text-admin-ink">Sản phẩm gắn trong bài</div>
          <ul className="space-y-1">
            {article.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="text-admin-ink">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="text-admin-mute">{p.network}</span>
                  {!p.isPublic ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200">
                      Chờ duyệt Refinery
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      Public
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {article.products.some((p) => !p.isPublic) ? (
            <p className="mt-2 text-xs text-admin-mute">
              Sản phẩm &quot;Chờ duyệt&quot; sẽ ẨN trên storefront tới khi bạn approve ở Refinery.
            </p>
          ) : null}
        </div>
      ) : null}

      <ArticleEditorClient
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          body: article.body,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          toolId: article.toolId,
          productIds: article.productIds,
          hasBlocks: Array.isArray(article.blocks) && article.blocks.length > 0,
          coverImage: article.coverImage
        }}
        tools={tools.map((t) => ({ id: t.id, name: t.name }))}
        products={productOptions}
      />
    </div>
  );
}
