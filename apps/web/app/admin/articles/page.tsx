import type React from "react";
import { FileText, FileCheck2, FilePen, AlertTriangle } from "lucide-react";
import {
  adminGet,
  FilterPills,
  ListPageShell
} from "../../../components/admin/ui";
import { fetchNiches, fetchNicheBySlug } from "../../../lib/api";
import {
  ARTICLE_STATUS_OPTIONS,
  ARTICLE_TYPE_OPTIONS,
  ADMIN_PARAMS
} from "../../../lib/admin/constants";
import type { ArticleAdminSummary } from "../../../lib/types";
import { ArticlesTable, type NicheWithProducts } from "./articles-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string }>;
}

export default async function AdminArticlesPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { status, type } = await searchParams;
  const params = new URLSearchParams();
  if (status) params.set(ADMIN_PARAMS.status, status);
  if (type) params.set(ADMIN_PARAMS.type, type);
  const qs = params.toString();

  const [articles, { niches: nicheList }] = await Promise.all([
    adminGet<ArticleAdminSummary[]>(`/admin/articles${qs ? `?${qs}` : ""}`),
    fetchNiches()
  ]);
  const nicheDetails = await Promise.all(nicheList.map((c) => fetchNicheBySlug(c.slug)));
  const niches: NicheWithProducts[] = nicheDetails
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      products: c.products.map((p) => ({ id: p.id, name: p.name }))
    }));

  const statusFor = (key?: string): string =>
    `/admin/articles${key ? `?${ADMIN_PARAMS.status}=${key}` : ""}${type ? `${key ? "&" : "?"}${ADMIN_PARAMS.type}=${type}` : ""}`;
  const typeFor = (key?: string): string =>
    `/admin/articles${status ? `?${ADMIN_PARAMS.status}=${status}` : ""}${key ? `${status ? "&" : "?"}${ADMIN_PARAMS.type}=${key}` : ""}`;

  const statusPills = [
    { href: statusFor(undefined), label: "Tất cả", active: !status },
    ...ARTICLE_STATUS_OPTIONS.map((s) => ({
      href: statusFor(s.value),
      label: s.label,
      active: status === s.value
    }))
  ];
  const typePills = [
    { href: typeFor(undefined), label: "Mọi loại", active: !type },
    ...ARTICLE_TYPE_OPTIONS.map((t) => ({
      href: typeFor(t.value),
      label: t.label,
      active: type === t.value
    }))
  ];

  const published = articles.filter((a) => a.status === "PUBLISHED").length;
  const pending = articles.filter((a) => a.status === "PENDING_REVIEW").length;
  const inFlight = articles.filter((a) => ["DRAFT_BRIEF","RESEARCHING","REVIEWS_SCRAPED","OUTLINE_READY","IMAGES_READY","DRAFTING","SELF_CRITIQUED","FACT_CHECKED"].includes(a.status)).length;
  const failed = articles.filter((a) => a.status === "FAILED" || a.status === "NEEDS_REVISION").length;

  return (
    <ListPageShell
      eyebrow="Nội dung"
      title="Bài viết"
      subtitle="AI sinh bản nháp qua 8 bước → admin duyệt từng phần → đăng lên blog."
      overview={[
        {
          label: "Tổng bài",
          value: articles.length.toLocaleString("vi-VN"),
          icon: <FileText className="size-4" />
        },
        {
          label: "Đã đăng",
          value: published.toLocaleString("vi-VN"),
          tone: "success",
          icon: <FileCheck2 className="size-4" />
        },
        {
          label: "Chờ duyệt",
          value: pending.toLocaleString("vi-VN"),
          tone: pending > 0 ? "warning" : "neutral",
          icon: <FilePen className="size-4" />
        },
        {
          label: "Đang xử lý / lỗi",
          value: (inFlight + failed).toLocaleString("vi-VN"),
          tone: failed > 0 ? "danger" : inFlight > 0 ? "info" : "neutral",
          icon: <AlertTriangle className="size-4" />
        }
      ]}
      filter={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills pills={statusPills} />
          <FilterPills pills={typePills} />
        </div>
      }
      table={<ArticlesTable rows={articles} niches={niches} />}
    />
  );
}
