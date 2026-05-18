import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  adminGet,
  PageHeader,
  StatusPill
} from "../../../../components/admin/ui";
import { NICHE_STATUS_META } from "../../../../lib/admin/constants";
import { NicheEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

interface NicheDetail {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  schemaConfig: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  _count: { products: number; articles: number };
}

async function fetchNiche(id: string): Promise<NicheDetail | null> {
  try {
    return await adminGet<NicheDetail>(`/admin/niches/${id}`);
  } catch (err) {
    if (err instanceof Error && /404|not found/i.test(err.message)) return null;
    throw err;
  }
}

export default async function NicheEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const niche = await fetchNiche(id);
  if (!niche) notFound();

  const statusMeta = NICHE_STATUS_META[niche.status];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/niches"
        className="inline-flex items-center gap-1 text-xs text-admin-mute hover:text-admin-ink"
      >
        <ArrowLeft className="size-3" /> Tất cả niche
      </Link>
      <PageHeader
        eyebrow="Sửa niche"
        title={niche.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill tone={statusMeta.tone} dot>
              {statusMeta.label}
            </StatusPill>
            <span className="text-admin-mute">
              {niche._count.products} sản phẩm · {niche._count.articles} bài viết
            </span>
            <code className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[11px] text-admin-mute">
              {niche.slug}
            </code>
          </span>
        }
      />
      <NicheEditForm niche={niche} />
    </div>
  );
}
