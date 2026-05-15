import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { fetchCategories, fetchCategoryBySlug } from "../../../../lib/api";
import type { ArticleAdminDetail } from "../../../../lib/types";
import { PageHeader, StatusPill } from "../../../../components/admin/ui";
import {
  ARTICLE_STATUS_META,
  ARTICLE_TYPE_META
} from "../../../../lib/admin/constants";
import { ArticleEditorClient } from "./article-editor-client";
import { GeneratingScreen } from "./generating-screen";
import { ArticleHeaderActions } from "./header-actions";
import { ScheduleForm } from "./schedule-form";

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminArticleDetail({
  params
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const article = await getJson<ArticleAdminDetail>(`/admin/articles/${id}`);
  if (!article) notFound();

  if (article.status === "GENERATING") {
    return <GeneratingScreen articleId={article.id} topic={article.title} />;
  }

  const { categories } = await fetchCategories();
  const categoryDetails = await Promise.all(categories.map((c) => fetchCategoryBySlug(c.slug)));
  const productOptions = categoryDetails
    .filter((c) => c !== null)
    .flatMap((category) =>
      category!.products.map((p) => ({ id: p.id, name: p.name, categoryName: category!.name }))
    );

  const statusMeta = ARTICLE_STATUS_META[article.status];
  const typeMeta = ARTICLE_TYPE_META[article.type];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/articles"
        className="inline-flex items-center gap-1 text-xs text-admin-mute hover:text-admin-ink"
      >
        <ArrowLeft className="size-3" /> Quay lại danh sách
      </Link>

      <PageHeader
        eyebrow={typeMeta.label}
        title={article.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill tone={statusMeta.tone} dot>
              {statusMeta.label}
            </StatusPill>
            <code className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[11px] text-admin-mute">
              /blog/{article.slug}
            </code>
            {article.aiModel ? (
              <span className="text-[11px] text-admin-mute">AI: {article.aiModel}</span>
            ) : null}
            {article.aiPromptName ? (
              <span className="text-[11px] text-admin-mute">prompt: {article.aiPromptName}</span>
            ) : null}
          </span>
        }
        actions={
          <ArticleHeaderActions
            articleId={article.id}
            slug={article.slug}
            title={article.title}
            status={article.status}
          />
        }
      />

      {article.status === "DRAFT" ? (
        <ScheduleForm articleId={article.id} scheduledAt={article.scheduledAt} />
      ) : null}

      {article.status === "FAILED" && article.generationError ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">AI sinh bài thất bại</p>
            <pre className="mt-1 whitespace-pre-wrap text-xs">{article.generationError}</pre>
            <p className="mt-2 text-xs">Xoá bài này và tạo lại, hoặc tự fill nội dung tay.</p>
          </div>
        </div>
      ) : null}

      {article.products.length > 0 ? (
        <div className="admin-card p-4 text-sm">
          <div className="mb-2 font-semibold text-admin-ink">Sản phẩm gắn trong bài</div>
          <ul className="space-y-1">
            {article.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="text-admin-ink">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="text-admin-mute">{p.network}</span>
                  {!p.isPublic ? (
                    <StatusPill tone="warning">Chờ duyệt Refinery</StatusPill>
                  ) : (
                    <StatusPill tone="success">Public</StatusPill>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {article.products.some((p) => !p.isPublic) ? (
            <p className="mt-2 text-xs text-admin-mute">
              Sản phẩm &quot;Chờ duyệt&quot; sẽ ẨN trên storefront tới khi approve ở Refinery.
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
          categoryId: article.categoryId,
          productIds: article.productIds,
          hasBlocks: Array.isArray(article.blocks) && article.blocks.length > 0,
          coverImage: article.coverImage
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        products={productOptions}
      />
    </div>
  );
}
