import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  adminGet,
  PageHeader,
  StatusPill
} from "../../../../components/admin/ui";
import { CATEGORY_STATUS_META } from "../../../../lib/admin/constants";
import { CategoryEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

interface CategoryDetail {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  _count: { products: number; articles: number };
}

async function fetchCategory(id: string): Promise<CategoryDetail | null> {
  try {
    return await adminGet<CategoryDetail>(`/admin/categories/${id}`);
  } catch (err) {
    if (err instanceof Error && /404|not found/i.test(err.message)) return null;
    throw err;
  }
}

export default async function CategoryEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const category = await fetchCategory(id);
  if (!category) notFound();

  const statusMeta = CATEGORY_STATUS_META[category.status];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-1 text-xs text-admin-mute hover:text-admin-ink"
      >
        <ArrowLeft className="size-3" /> Tất cả danh mục
      </Link>
      <PageHeader
        eyebrow="Sửa danh mục"
        title={category.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill tone={statusMeta.tone} dot>
              {statusMeta.label}
            </StatusPill>
            <span className="text-admin-mute">
              {category._count.products} sản phẩm · {category._count.articles} bài viết
            </span>
            <code className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[11px] text-admin-mute">
              {category.slug}
            </code>
          </span>
        }
      />
      <CategoryEditForm category={category} />
    </div>
  );
}
