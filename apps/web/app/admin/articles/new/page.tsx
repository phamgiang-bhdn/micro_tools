import type React from "react";
import Link from "next/link";
import { fetchTools, fetchToolBySlug } from "../../../../lib/api";
import { NewArticleForm } from "./new-article-form";

export const dynamic = "force-dynamic";

export default async function NewArticlePage(): Promise<React.ReactElement> {
  const { tools } = await fetchTools();
  const toolDetails = await Promise.all(tools.map((t) => fetchToolBySlug(t.slug)));

  const toolOptions = toolDetails
    .filter((t) => t !== null)
    .map((tool) => ({
      id: tool!.id,
      slug: tool!.slug,
      name: tool!.name,
      products: tool!.products.map((p) => ({ id: p.id, name: p.name }))
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/admin/articles" className="text-xs text-admin-mute hover:text-admin-ink">
          ← Quay lại danh sách
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-admin-ink">Tạo bài viết mới</h1>
        <p className="mt-1 text-sm text-admin-mute">
          AI sẽ sinh bản nháp dựa trên prompt template đang active. Sau đó bạn duyệt + chỉnh trước khi publish.
        </p>
      </header>

      <NewArticleForm tools={toolOptions} />
    </div>
  );
}
