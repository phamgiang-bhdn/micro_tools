import type React from "react";
import Link from "next/link";
import type { ArticleAdminSummary, ArticleStatus, ArticleType } from "../../../lib/types";

export const dynamic = "force-dynamic";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY }
  });
  if (!response.ok) throw new Error(`${path} failed: ${await response.text()}`);
  return (await response.json()) as T;
}

const TYPE_LABEL: Record<ArticleType, string> = {
  BUYING_GUIDE: "Cẩm nang",
  REVIEW: "Review"
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  GENERATING: "Đang sinh...",
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã đăng",
  ARCHIVED: "Đã lưu trữ",
  FAILED: "Sinh thất bại"
};

const STATUS_BADGE: Record<ArticleStatus, string> = {
  GENERATING: "bg-sky-50 text-sky-700 ring-sky-200",
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200"
};

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export default async function AdminArticlesPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { status, type } = await searchParams;
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const qs = params.toString();

  const articles = await getJson<ArticleAdminSummary[]>(`/admin/articles${qs ? `?${qs}` : ""}`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-admin-ink">Bài viết</h1>
          <p className="mt-1 text-sm text-admin-mute">
            AI sinh bản nháp → bạn duyệt nội dung → publish lên blog. Toàn bộ qua gate human review.
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-2 rounded-lg bg-admin-accent px-4 py-2 text-sm font-semibold text-white hover:bg-admin-accent/90"
        >
          <PlusIcon />
          Tạo bài mới
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/admin/articles" active={!status && !type}>
          Tất cả
        </FilterPill>
        <FilterPill href="/admin/articles?status=GENERATING" active={status === "GENERATING"}>
          Đang sinh
        </FilterPill>
        <FilterPill href="/admin/articles?status=DRAFT" active={status === "DRAFT"}>
          Bản nháp (cần duyệt)
        </FilterPill>
        <FilterPill href="/admin/articles?status=PUBLISHED" active={status === "PUBLISHED"}>
          Đã đăng
        </FilterPill>
        <FilterPill href="/admin/articles?status=FAILED" active={status === "FAILED"}>
          Lỗi
        </FilterPill>
        <FilterPill href="/admin/articles?status=ARCHIVED" active={status === "ARCHIVED"}>
          Đã lưu trữ
        </FilterPill>
        <span className="mx-2 self-center text-admin-mute">·</span>
        <FilterPill href={`/admin/articles?type=BUYING_GUIDE${status ? `&status=${status}` : ""}`} active={type === "BUYING_GUIDE"}>
          Cẩm nang
        </FilterPill>
        <FilterPill href={`/admin/articles?type=REVIEW${status ? `&status=${status}` : ""}`} active={type === "REVIEW"}>
          Review
        </FilterPill>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-admin-line bg-admin-surface p-10 text-center">
          <p className="text-sm text-admin-mute">Chưa có bài viết nào khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-line bg-admin-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-admin-line bg-admin-subtle text-left text-xs uppercase tracking-wider text-admin-mute">
              <tr>
                <th className="px-4 py-3 font-semibold">Tiêu đề</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Danh mục</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {articles.map((article) => (
                <tr key={article.id} className="transition hover:bg-admin-subtle/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articles/${article.id}`}
                      className="font-medium text-admin-ink hover:text-admin-accent"
                    >
                      {article.title}
                    </Link>
                    {article.excerpt ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-admin-mute">{article.excerpt}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-admin-mute">{TYPE_LABEL[article.type]}</td>
                  <td className="px-4 py-3 text-admin-mute">{article.category?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_BADGE[article.status]}`}
                    >
                      {STATUS_LABEL[article.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-mute">
                    {dateFmt.format(new Date(article.updatedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-admin-accent bg-admin-accent text-white"
          : "border-admin-line bg-admin-surface text-admin-mute hover:border-admin-accent hover:text-admin-accent"
      }`}
    >
      {children}
    </Link>
  );
}

function PlusIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
