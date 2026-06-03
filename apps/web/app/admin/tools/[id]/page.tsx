import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { adminGet, StatusPill } from "../../../../components/admin/ui";
import { ToolForm } from "../tool-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ToolDetail {
  id: string;
  slug: string;
  nicheId: string;
  name: string;
  description: string | null;
  tagline: string | null;
  quizSchema: unknown;
  scoringRules: unknown;
  resultTemplate: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  niche: { id: string; slug: string; name: string; status: "ACTIVE" | "INACTIVE" };
  _count: { sessions: number; clickLogs: number };
}

export default async function EditToolPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  let tool: ToolDetail;
  try {
    tool = await adminGet<ToolDetail>(`/admin/tools/${id}`);
  } catch {
    notFound();
  }
  const niches = await adminGet<{ id: string; slug: string; name: string; status: string }[]>(
    "/admin/niches"
  );

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link href="/admin/tools" className="text-sm text-admin-mute hover:text-admin-ink">
        ← Tool builder
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-admin-ink">{tool.name}</h1>
        {tool.status === "PUBLISHED" && (
          <StatusPill tone="success" dot>
            Published
          </StatusPill>
        )}
        {tool.status === "DRAFT" && <StatusPill tone="neutral" dot>Draft</StatusPill>}
        {tool.status === "ARCHIVED" && <StatusPill tone="warning" dot>Archived</StatusPill>}
        {tool.status === "PUBLISHED" && (
          <a
            href={`/ai/${tool.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-admin-accent hover:underline"
          >
            <ExternalLink className="size-3.5" />
            /ai/{tool.slug}
          </a>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-admin-mute">
        <span>Niche: {tool.niche.name}</span>
        {tool.niche.status !== "ACTIVE" && (
          <StatusPill tone="warning">Niche INACTIVE</StatusPill>
        )}
        <span>·</span>
        <span>{tool._count.sessions.toLocaleString("vi-VN")} sessions</span>
        <span>·</span>
        <span>{tool._count.clickLogs.toLocaleString("vi-VN")} clicks</span>
      </div>

      <div className="mt-6 rounded-2xl border border-admin-line bg-admin-surface p-6">
        <ToolForm
          niches={niches}
          initial={{
            id: tool.id,
            slug: tool.slug,
            nicheId: tool.nicheId,
            name: tool.name,
            description: tool.description ?? "",
            tagline: tool.tagline ?? "",
            quizSchemaJson: JSON.stringify(tool.quizSchema, null, 2),
            scoringRulesJson: JSON.stringify(tool.scoringRules, null, 2),
            resultTemplateJson: JSON.stringify(tool.resultTemplate, null, 2),
            seoTitle: tool.seoTitle ?? "",
            seoDescription: tool.seoDescription ?? ""
          }}
        />
      </div>
    </div>
  );
}
