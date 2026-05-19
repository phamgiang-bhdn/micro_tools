import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatusPill } from "../../../../components/admin/ui";
import {
  ARTICLE_STATUS_META,
  ARTICLE_TYPE_META
} from "../../../../lib/admin/constants";
import { ArticleV2Client } from "./article-v2-client";

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

interface V2DetailDto {
  id: string;
  title: string;
  status: string;
  topic: string | null;
  wordCount: number | null;
  readabilityScore: number | null;
  revisionCount: number;
  aiRevisionCount: number;
  currentStageMessage: string | null;
  currentStageProgress: number | null;
  generationError: string | null;
  briefJson: Record<string, unknown> | null;
  outlineJson: Record<string, unknown> | null;
  evidenceFreshAt: string | null;
  slug: string;
  type: "BUYING_GUIDE" | "REVIEW";
  author: { id: string; name: string; slug: string } | null;
  sections: Array<{
    id: string;
    anchorSlug: string;
    heading: string;
    summary: string;
    order: number;
    status: string;
    wordCount: number;
    estimatedWords: number;
    blocks: unknown[];
    evidenceRefs: string[];
  }>;
  evidence: Array<{
    id: string;
    type: string;
    sourceUrl: string;
    sourceDomain: string;
    title: string | null;
    factCheckPassed: boolean;
    fetchedAt: string;
  }>;
  runs: Array<{
    id: string;
    stage: string;
    agent: string;
    success: boolean;
    errorReason: string | null;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminArticleDetail({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const v2Detail = await getJson<V2DetailDto>(`/admin/articles/${id}/v2-detail`);
  if (!v2Detail) notFound();

  const statusMeta = ARTICLE_STATUS_META[v2Detail.status as keyof typeof ARTICLE_STATUS_META];
  const typeMeta = ARTICLE_TYPE_META[v2Detail.type];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/articles"
        className="inline-flex items-center gap-1 text-xs text-admin-mute hover:text-admin-ink"
      >
        <ArrowLeft className="size-3" /> Quay lại danh sách
      </Link>
      <PageHeader
        eyebrow={typeMeta.label}
        title={v2Detail.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill tone={statusMeta?.tone ?? "info"} dot>
              {statusMeta?.label ?? v2Detail.status}
            </StatusPill>
            <code className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[11px] text-admin-mute">
              /blog/{v2Detail.slug}
            </code>
            {v2Detail.evidenceFreshAt ? (
              <span className="text-[11px] text-admin-mute">
                Evidence fresh: {new Date(v2Detail.evidenceFreshAt).toLocaleDateString("vi-VN")}
              </span>
            ) : null}
          </span>
        }
      />
      <ArticleV2Client article={v2Detail} />
    </div>
  );
}
