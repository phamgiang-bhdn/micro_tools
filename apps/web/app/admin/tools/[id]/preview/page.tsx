import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { adminGet, StatusPill } from "../../../../../components/admin/ui";
import { ToolPreviewClient } from "./tool-preview-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ToolDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  quizSchema: unknown;
  scoringRules: unknown;
  resultTemplate: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  niche: { id: string; slug: string; name: string; status: "ACTIVE" | "INACTIVE" };
  _count: { sessions: number };
}

export default async function ToolPreviewPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  let tool: ToolDetail;
  try {
    tool = await adminGet<ToolDetail>(`/admin/tools/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/tools/${id}`}
          className="inline-flex items-center gap-1 text-sm text-admin-mute hover:text-admin-ink"
        >
          <ArrowLeft className="size-3.5" /> Quay lại edit
        </Link>
        {tool.status === "PUBLISHED" && (
          <a
            href={`/ai/${tool.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Mở public
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-admin-ink">Preview: {tool.name}</h1>
        {tool.status === "DRAFT" && <StatusPill tone="neutral" dot>Draft (chưa public)</StatusPill>}
        {tool.status === "PUBLISHED" && <StatusPill tone="success" dot>Published</StatusPill>}
      </div>
      <p className="mt-1 text-sm text-admin-mute">
        Test quiz + scoring engine TRƯỚC khi publish. Submit ở đây KHÔNG tạo `QuizSession` row.
      </p>

      <div className="mt-6 rounded-3xl border border-admin-line bg-white p-6">
        <ToolPreviewClient
          toolId={tool.id}
          toolSlug={tool.slug}
          quizSchema={tool.quizSchema}
          scoringRules={tool.scoringRules}
          resultTemplate={tool.resultTemplate}
          nicheId={tool.niche.id}
          nicheSlug={tool.niche.slug}
        />
      </div>
    </div>
  );
}
