"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  Database,
  Activity,
  Loader2,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  X
} from "lucide-react";
import { AdminButton, StatusPill, Tabs, TabsList, TabsTrigger, TabsContent } from "../../../../components/admin/ui";
import { PIPELINE_STAGES } from "../../../../lib/admin/constants";
import { BlockRenderer } from "../../../../components/article/blocks/block-renderer";
import type { ArticleBlock, ProductItem } from "../../../../lib/types";
import { ProductMatcher } from "./product-matcher";
import { SectionImageManager } from "./section-image-manager";
import { BriefPanel } from "./brief-panel";
import { BlockFormDispatcher } from "./block-editors";
import {
  approveArticleV2Action,
  retryArticleStageAction,
  refreshArticleEvidenceAction,
  continueArticlePipelineAction,
  requestArticleRevisionAction,
  updateSectionAction,
  deleteSectionAction,
  reorderSectionsAction
} from "../../actions";
import type { ArticleProgressDto } from "../../actions";
import { withToast } from "../../../../lib/admin/notify";

interface RunLite {
  id: string;
  stage: string;
  agent: string;
  success: boolean;
  errorReason: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface EvidenceLite {
  id: string;
  type: string;
  sourceUrl: string;
  sourceDomain: string;
  title: string | null;
  factCheckPassed: boolean;
  fetchedAt: string;
}

interface SectionLite {
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
}

interface AuthorLite {
  id: string;
  name: string;
  slug: string;
}

interface ArticleV2 {
  id: string;
  slug: string;
  title: string;
  status: string;
  nicheId: string | null;
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
  pauseAtOutline?: boolean;
  author: AuthorLite | null;
  sections: SectionLite[];
  evidence: EvidenceLite[];
  runs: RunLite[];
}

const TERMINAL_STATUSES = new Set([
  "PENDING_REVIEW",
  "NEEDS_REVISION",
  "PUBLISHED",
  "ARCHIVED",
  "FAILED"
]);

type StageState = "ok" | "running" | "fail" | "pending";

export function ArticleV2Client({ article }: { article: ArticleV2 }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(article.sections[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"preview" | "edit" | "json">("preview");
  const activeSection = article.sections.find((s) => s.id === activeSectionId) ?? null;

  // Live progress: poll mỗi 2s khi pipeline đang chạy. Auto refresh full page khi status đạt terminal.
  const [liveStatus, setLiveStatus] = useState<string>(article.status);
  const [liveMsg, setLiveMsg] = useState<string | null>(article.currentStageMessage);
  const [livePct, setLivePct] = useState<number | null>(article.currentStageProgress);
  const [liveAiRev, setLiveAiRev] = useState<number>(article.aiRevisionCount);
  const [liveStageStartedAt, setLiveStageStartedAt] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<RunLite[]>(article.runs);
  const lastRefreshedStatusRef = useRef<string>(article.status);

  // Paused gate: pipeline đã dừng ở IMAGES_READY chờ admin duyệt outline — không phải "đang chạy".
  const isPausedAtOutline = !!article.pauseAtOutline && liveStatus === "IMAGES_READY";
  const isRunning = !TERMINAL_STATUSES.has(liveStatus) && !isPausedAtOutline;

  useEffect(() => {
    // Luôn poll, không phụ thuộc initial status: nếu trang load lúc FAILED và admin bấm retry,
    // polling phải tự kích hoạt khi status đổi non-terminal — đừng tắt vĩnh viễn từ đầu.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        // GET route handler — tránh POST từ server action (gây log ồn + revalidate path).
        const res = await fetch(`/api/admin/articles/${article.id}/progress`, {
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`progress ${res.status}`);
        const data = (await res.json()) as ArticleProgressDto;
        if (cancelled) return;
        const newStatus = data.article.status;
        setLiveStatus(newStatus);
        setLiveMsg(data.article.currentStageMessage);
        setLivePct(data.article.currentStageProgress);
        setLiveAiRev(data.article.aiRevisionCount);
        setLiveStageStartedAt(data.article.currentStageStartedAt);
        // Cập nhật runs theo từng tick để grid 8 bước đổi state real-time (xanh/vàng/đỏ).
        // Poll DTO trả last 8 runs đã đủ cho grid; tab "Nhật ký" full history vẫn dùng
        // article.runs từ server render.
        setLiveRuns(data.runs);

        // Khi status chuyển terminal sau khi đang chạy → reload page để lấy section/evidence/runs đầy đủ.
        if (
          TERMINAL_STATUSES.has(newStatus) &&
          lastRefreshedStatusRef.current !== newStatus
        ) {
          lastRefreshedStatusRef.current = newStatus;
          router.refresh();
        }
        // Nhịp poll: 2s khi đang chạy, 6s khi terminal (đợi admin retry).
        const nextDelay = TERMINAL_STATUSES.has(newStatus) ? 6000 : 2000;
        timer = setTimeout(tick, nextDelay);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };

    timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [article.id, router]);

  // Latest run per stage — dùng liveRuns (poll 2s/lần) để grid 8 bước cập nhật real-time,
  // không phải snapshot lúc server render. Sort theo startedAt desc rồi map first-seen per stage.
  const latestRun = new Map<string, RunLite>();
  const sortedLive = [...liveRuns].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  for (const r of sortedLive) {
    if (!latestRun.has(r.stage)) latestRun.set(r.stage, r);
  }
  const stageState = (key: string): StageState => {
    const r = latestRun.get(key);
    if (!r) return "pending";
    if (!r.finishedAt) return "running";
    return r.success ? "ok" : "fail";
  };

  const refresh = () => startTransition(() => router.refresh());

  const onRetryStage = (stage: string) =>
    withToast(
      async () => {
        await retryArticleStageAction(article.id, stage);
        refresh();
      },
      { loading: "Đang chạy lại bước…", success: "Đã chạy lại", error: "Chạy lại thất bại" }
    );

  const onApprove = () =>
    withToast(
      async () => {
        await approveArticleV2Action(article.id);
        refresh();
      },
      { loading: "Đang đăng bài…", success: "Đã đăng bài", error: "Đăng thất bại" }
    );

  const onRequestRevision = () => {
    const reason = window.prompt("Lý do cần sửa thủ công?");
    if (!reason?.trim()) return;
    withToast(
      async () => {
        await requestArticleRevisionAction(article.id, reason.trim());
        refresh();
      },
      { loading: "Đang chuyển sang cần sửa…", success: "Đã chuyển", error: "Lỗi" }
    );
  };

  const onApproveSection = (sectionId: string) =>
    withToast(
      async () => {
        await updateSectionAction(article.id, sectionId, { status: "APPROVED" });
        refresh();
      },
      { loading: "Đang duyệt…", success: "Đã duyệt phần này", error: "Lỗi" }
    );

  const onRefreshEvidence = () =>
    withToast(
      async () => {
        await refreshArticleEvidenceAction(article.id);
        refresh();
      },
      { loading: "Đang refresh nguồn dẫn…", success: "Đã kích hoạt refresh, đợi Tavily…", error: "Refresh thất bại" }
    );

  const onContinuePipeline = () =>
    withToast(
      async () => {
        await continueArticlePipelineAction(article.id);
        refresh();
      },
      { loading: "Đang tiếp tục…", success: "Pipeline tiếp tục viết bài", error: "Lỗi tiếp tục" }
    );

  const onResetSection = (sectionId: string) =>
    withToast(
      async () => {
        await updateSectionAction(article.id, sectionId, { status: "DRAFTING" });
        refresh();
      },
      { loading: "Đang đặt lại…", success: "Đã đặt lại thành chưa viết", error: "Lỗi" }
    );

  const onSaveSection = (
    sectionId: string,
    patch: { heading?: string; summary?: string; blocks?: unknown[] }
  ) =>
    withToast(
      async () => {
        await updateSectionAction(article.id, sectionId, patch);
        refresh();
      },
      { loading: "Đang lưu…", success: "Đã lưu phần", error: "Lưu thất bại" }
    );

  const onDeleteSection = (sectionId: string) => {
    if (!window.confirm("Xoá phần này? Hành động không thể hoàn tác.")) return;
    withToast(
      async () => {
        await deleteSectionAction(article.id, sectionId);
        setActiveSectionId((cur) => (cur === sectionId ? null : cur));
        refresh();
      },
      { loading: "Đang xoá…", success: "Đã xoá phần", error: "Xoá thất bại" }
    );
  };

  const onMoveSection = (sectionId: string, direction: -1 | 1) => {
    const idx = article.sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= article.sections.length) return;
    const ids = article.sections.map((s) => s.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    withToast(
      async () => {
        await reorderSectionsAction(article.id, ids);
        refresh();
      },
      { loading: "Đang sắp xếp…", success: "Đã đổi thứ tự", error: "Lỗi" }
    );
  };

  const brief = article.briefJson;
  const sectionsApproved = article.sections.filter((s) => s.status === "APPROVED").length;
  const sectionsWritten = article.sections.filter((s) => s.status === "WRITTEN").length;
  const evidenceByType = countByType(article.evidence);

  // Stage cuối cùng đã fail (để CTA "Chạy lại bước này"). Dùng sortedLive để fail mới nhất ưu tiên.
  const lastFailedStage = sortedLive.find((r) => r.finishedAt && !r.success)?.stage ?? null;
  const lastFailedError = sortedLive.find((r) => r.finishedAt && !r.success)?.errorReason ?? null;

  return (
    <div className="space-y-5">
      {/* ────── BANNER TRẠNG THÁI ────── */}
      {isRunning ? (
        <LiveProgressBanner
          status={liveStatus}
          message={liveMsg}
          percent={livePct}
          aiRevisionCount={liveAiRev}
          stageStartedAt={liveStageStartedAt}
        />
      ) : liveStatus === "FAILED" ? (
        <FailedBanner
          failedStage={lastFailedStage}
          errorReason={article.generationError ?? lastFailedError}
          onRetry={lastFailedStage ? () => onRetryStage(lastFailedStage) : null}
          onRestart={() => onRetryStage("brief-builder")}
          disabled={pending}
        />
      ) : liveStatus === "NEEDS_REVISION" ? (
        <NeedsRevisionBanner
          reason={article.generationError}
          onRetryWriter={() => onRetryStage("writer")}
          onRetryCritic={() => onRetryStage("critic")}
          disabled={pending}
        />
      ) : null}

      {/* ────── THANH HÀNH ĐỘNG ────── */}
      <div className="admin-card flex flex-wrap items-center gap-3 p-3">
        <a
          href={`/admin/articles/${article.id}/preview`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-admin-line bg-admin-surface px-3 py-1.5 text-[12.5px] font-medium text-admin-ink transition hover:border-admin-accent hover:text-admin-accent"
        >
          <Eye className="size-3.5" /> Xem trước bài
        </a>
        <div className="ml-auto flex items-center gap-2">
          {article.status === "PENDING_REVIEW" ? (
            <>
              <AdminButton variant="outline" size="sm" onClick={onRequestRevision} disabled={pending}>
                Cần sửa thủ công
              </AdminButton>
              <AdminButton variant="primary" size="sm" iconLeft={<Check />} onClick={onApprove} disabled={pending}>
                Duyệt &amp; Đăng bài
              </AdminButton>
            </>
          ) : (
            <span className="text-[12px] text-admin-mute">
              Đăng bài chỉ khả dụng khi đạt trạng thái <strong className="text-admin-ink">Chờ admin duyệt</strong>.
            </span>
          )}
        </div>
      </div>

      {/* ────── PAUSE-AT-OUTLINE GATE ────── */}
      {article.pauseAtOutline && liveStatus === "IMAGES_READY" ? (
        <div className="admin-card flex flex-wrap items-center gap-3 border-l-4 border-l-admin-info px-4 py-3">
          <Sparkles className="size-5 shrink-0 text-admin-info" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-admin-ink">Dàn ý sẵn sàng — chờ duyệt</div>
            <p className="mt-0.5 text-[12px] text-admin-mute">
              Pipeline đang tạm dừng để bạn rà dàn ý. Mở tab <strong>&quot;Các phần&quot;</strong> để sửa heading, đổi thứ tự, xoá section không cần.
              Khi xong, bấm <strong>&quot;Tiếp tục viết bài&quot;</strong> — AI sẽ chạy Image + Writer + Critic theo dàn ý đã chốt.
            </p>
          </div>
          <AdminButton size="sm" variant="primary" iconLeft={<Check />} onClick={onContinuePipeline} disabled={pending}>
            Tiếp tục viết bài
          </AdminButton>
        </div>
      ) : null}

      {/* ────── MID-PIPELINE PAUSED (sau khi retry 1 stage) ──────
          Retry-stage giờ chỉ chạy 1 bước rồi dừng (không cascade). Khi status ở giữa
          pipeline (không terminal, không running, không pauseAtOutline), hiện CTA
          "Tiếp tục pipeline" để admin chủ động chạy đến PENDING_REVIEW. */}
      {!isRunning &&
      !TERMINAL_STATUSES.has(liveStatus) &&
      liveStatus !== "DRAFT_BRIEF" &&
      !(article.pauseAtOutline && liveStatus === "IMAGES_READY") ? (
        <div className="admin-card flex flex-wrap items-center gap-3 border-l-4 border-l-admin-accent px-4 py-3">
          <ChevronRight className="size-5 shrink-0 text-admin-accent" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-admin-ink">Pipeline đang tạm dừng giữa chừng</div>
            <p className="mt-0.5 text-[12px] text-admin-mute">
              Bước vừa chạy đã xong. Bấm để AI chạy tiếp các bước còn lại đến khi sẵn sàng đăng.
            </p>
          </div>
          <AdminButton size="sm" variant="primary" iconLeft={<ChevronRight />} onClick={onContinuePipeline} disabled={pending}>
            Tiếp tục pipeline
          </AdminButton>
        </div>
      ) : null}

      {/* ────── HINT EVIDENCE CŨ ────── */}
      {daysAgoNum(article.evidenceFreshAt) > 30 && article.evidence.length > 0 && !isRunning ? (
        <div className="admin-card flex flex-wrap items-center gap-3 border-l-4 border-l-admin-warning px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-admin-warning" />
          <div className="flex-1 min-w-0 text-[12.5px] text-admin-ink/85">
            Nguồn dẫn đã cũ ({daysAgo(article.evidenceFreshAt)} ngày). Nếu chạy lại Writer, bài có thể vẫn dựa trên data lỗi thời —
            khuyến nghị refresh evidence trước.
          </div>
          <AdminButton size="xs" variant="outline" iconLeft={<RefreshCw />} onClick={onRefreshEvidence} disabled={pending}>
            Refresh trước
          </AdminButton>
        </div>
      ) : null}

      {/* ────── PRE-PUBLISH CHECKLIST ────── */}
      {liveStatus === "PENDING_REVIEW" ? (
        <PrePublishChecklist
          sections={article.sections}
          onApprove={onApprove}
          pending={pending}
        />
      ) : null}

      {/* ────── PIPELINE STRIP ────── */}
      <PipelineStrip
        stageState={stageState}
        latestRun={latestRun}
        pending={pending}
        onRetryStage={onRetryStage}
        wordCount={article.wordCount}
        revisionCount={article.revisionCount}
        sectionsWritten={sectionsWritten}
        sectionsTotal={article.sections.length}
      />

      {/* ────── TABS ────── default = sections (workspace chính) ────── */}
      <Tabs defaultValue="sections">
        <TabsList variant="underline" className="w-full">
          <TabsTrigger value="sections" badge={article.sections.length || undefined}>
            <Layers className="size-3.5" /> Các phần
          </TabsTrigger>
          <TabsTrigger value="products" badge={countProductSlots(article.sections) || undefined}>
            <ShoppingBag className="size-3.5" /> Gắn sản phẩm
          </TabsTrigger>
          <TabsTrigger value="evidence" badge={article.evidence.length || undefined}>
            <Database className="size-3.5" /> Nguồn dẫn
          </TabsTrigger>
          <TabsTrigger value="overview"><Sparkles className="size-3.5" /> Chi tiết bài</TabsTrigger>
          <TabsTrigger value="runs" badge={article.runs.length || undefined}>
            <Activity className="size-3.5" /> Nhật ký
          </TabsTrigger>
        </TabsList>

        {/* ===== TỔNG QUAN ===== */}
        <TabsContent value="overview" className="space-y-4">
          {/* CHỈ SỐ NHANH */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Phần đã viết"
              value={`${sectionsWritten}/${article.sections.length}`}
              tone="info"
            />
            <KpiCard
              label="Phần đã duyệt"
              value={`${sectionsApproved}/${article.sections.length}`}
              tone="success"
            />
            <KpiCard
              label="Nguồn dẫn"
              value={article.evidence.length}
              sub={`Dữ kiện ${evidenceByType.FACT ?? 0} · Ảnh ${evidenceByType.IMAGE ?? 0} · Đánh giá ${evidenceByType.REVIEW ?? 0}`}
              tone="neutral"
            />
            <KpiCard
              label="Tổng số từ"
              value={article.wordCount ?? 0}
              sub={`~${Math.ceil((article.wordCount ?? 0) / 220)} phút đọc`}
              tone="info"
            />
          </div>

          {/* ĐỊNH HƯỚNG BÀI */}
          <div className="admin-card p-5">
            <div className="admin-section-title mb-3">Định hướng bài</div>
            {brief ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
                <Field label="Luận điểm" value={String(brief.thesis ?? "")} full />
                <Field label="Ý đồ" value={intentLabel(String(brief.intent ?? ""))} />
                <Field label="Độ dài mục tiêu" value={depthLabel(String(brief.targetDepth ?? ""))} />
                <Field label="Bố cục" value={layoutLabel(String(brief.layoutVariant ?? ""))} />
                <Field label="Kiểu mở bài" value={hookLabel(String(brief.hookPattern ?? ""))} />
                <Field
                  label="Từ khoá SEO"
                  value={Array.isArray(brief.targetKeywords) ? (brief.targetKeywords as string[]).join(", ") : ""}
                  full
                />
                {brief.persona && typeof brief.persona === "object" ? (
                  <>
                    <Field label="Người đọc" value={(brief.persona as Record<string, string>).name ?? ""} />
                    <Field
                      label="Trình độ"
                      value={expertiseLabel((brief.persona as Record<string, string>).expertise ?? "")}
                    />
                    <Field
                      label="Vấn đề người đọc"
                      value={(brief.persona as Record<string, string>).painPoint ?? ""}
                      full
                    />
                  </>
                ) : null}
              </dl>
            ) : (
              <EmptyHint icon={<AlertTriangle className="size-4" />} text="Bước Định hướng chưa chạy xong." />
            )}
          </div>

          {/* TÁC GIẢ */}
          {article.author ? (
            <div className="admin-card p-4 text-[13px]">
              <div className="admin-section-title mb-2">Tác giả</div>
              <p className="text-admin-ink"><strong>{article.author.name}</strong> ({article.author.slug})</p>
            </div>
          ) : null}
        </TabsContent>

        {/* ===== CÁC PHẦN ===== */}
        <TabsContent value="sections" className="space-y-4">
          {/* Brief panel — định hướng bài, visual hierarchy: label bold + value normal */}
          <BriefPanel
            brief={brief as Parameters<typeof BriefPanel>[0]["brief"]}
            authorName={article.author?.name}
          />

          {article.sections.length === 0 ? (
            <div className="admin-card p-6">
              <EmptyHint icon={<AlertTriangle className="size-4" />} text="Chưa có phần nào. Vui lòng chạy bước 4 (Dàn ý)." />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
              {/* Danh sách phần */}
              <div className="admin-card p-3">
                <div className="admin-section-title mb-2 px-1">Danh sách phần</div>
                <ol className="space-y-1">
                  {article.sections.map((s, idx) => (
                    <li key={s.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveSectionId(s.id)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 pr-12 text-left text-[12.5px] transition ${
                          activeSectionId === s.id
                            ? "bg-admin-accent-soft text-admin-accent-ink"
                            : "hover:bg-admin-subtle"
                        }`}
                      >
                        <span className="line-clamp-2 font-semibold leading-snug">
                          {s.order + 1}. {s.heading}
                        </span>
                        <div className="flex items-center gap-2 text-[10.5px] text-admin-ink">
                          <SectionStatusPill status={s.status} />
                          <span>
                            {s.wordCount}/{s.estimatedWords} từ
                          </span>
                          {s.evidenceRefs.length > 0 ? (
                            <span>· {s.evidenceRefs.length} nguồn</span>
                          ) : null}
                        </div>
                      </button>
                      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onMoveSection(s.id, -1); }}
                          disabled={idx === 0 || pending}
                          className="rounded p-1 text-admin-mute hover:bg-admin-subtle hover:text-admin-ink disabled:opacity-30"
                          title="Đưa lên"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onMoveSection(s.id, 1); }}
                          disabled={idx === article.sections.length - 1 || pending}
                          className="rounded p-1 text-admin-mute hover:bg-admin-subtle hover:text-admin-ink disabled:opacity-30"
                          title="Đưa xuống"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDeleteSection(s.id); }}
                          disabled={pending}
                          className="rounded p-1 text-admin-mute hover:bg-admin-danger-soft hover:text-admin-danger disabled:opacity-30"
                          title="Xoá phần"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Chi tiết phần */}
              <div className="admin-card p-5">
                {activeSection ? (
                  <SectionDetailPane
                    section={activeSection}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    pending={pending}
                    onApprove={() => onApproveSection(activeSection.id)}
                    onReset={() => onResetSection(activeSection.id)}
                    onSave={(patch) => onSaveSection(activeSection.id, patch)}
                  />
                ) : (
                  <EmptyHint icon={<AlertTriangle className="size-4" />} text="Chọn 1 phần bên trái để xem." />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== GẮN SẢN PHẨM ===== */}
        <TabsContent value="products" className="space-y-3">
          <ProductMatcher articleId={article.id} nicheId={article.nicheId} />
        </TabsContent>

        {/* ===== NGUỒN DẪN ===== */}
        <TabsContent value="evidence" className="space-y-3">
          <div className="admin-card flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="admin-section-title">Trạng thái nguồn dẫn</div>
              <p className="mt-0.5 text-[12px] text-admin-mute">
                {article.evidenceFreshAt ? (
                  <>
                    Cập nhật lần cuối:{" "}
                    <span className="font-medium text-admin-ink">
                      {new Date(article.evidenceFreshAt).toLocaleString("vi-VN")}
                    </span>{" "}
                    · {daysAgo(article.evidenceFreshAt)} ngày trước
                    {daysAgoNum(article.evidenceFreshAt) > 30 ? (
                      <span className="ml-2 rounded bg-admin-warning-soft px-1.5 py-0.5 text-[10.5px] font-medium text-admin-warning">
                        Có thể cũ
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Chưa có thời điểm refresh — bấm nút để cào Tavily lần đầu."
                )}
              </p>
            </div>
            <AdminButton size="sm" variant="outline" iconLeft={<RefreshCw />} onClick={onRefreshEvidence} disabled={pending || isRunning}>
              Refresh nguồn dẫn
            </AdminButton>
          </div>
          {article.evidence.length === 0 ? (
            <div className="admin-card p-6">
              <EmptyHint
                icon={<AlertTriangle className="size-4" />}
                text="Chưa có nguồn dẫn. Bước Tra cứu / Ảnh / Đánh giá chưa cào được gì. Kiểm tra TAVILY_API_KEY + UNSPLASH_ACCESS_KEY trong .env."
              />
            </div>
          ) : (
            <div className="admin-card overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead className="bg-admin-subtle text-admin-mute">
                  <tr>
                    <th className="px-4 py-2 text-left">Loại</th>
                    <th className="px-4 py-2 text-left">Tiêu đề</th>
                    <th className="px-4 py-2 text-left">Tên miền</th>
                    <th className="px-4 py-2 text-left">Đã đối chiếu</th>
                    <th className="px-4 py-2 text-right">Nguồn</th>
                  </tr>
                </thead>
                <tbody>
                  {article.evidence.map((e) => (
                    <tr key={e.id} className="border-t border-admin-line">
                      <td className="px-4 py-2"><StatusPill tone="info" dot>{evidenceTypeLabel(e.type)}</StatusPill></td>
                      <td className="px-4 py-2"><span className="line-clamp-2">{e.title ?? "(không có tiêu đề)"}</span></td>
                      <td className="px-4 py-2 font-mono text-[11.5px] text-admin-mute">{e.sourceDomain}</td>
                      <td className="px-4 py-2">
                        <StatusPill tone={e.factCheckPassed ? "success" : "warning"} dot>
                          {e.factCheckPassed ? "Đã đối chiếu" : "Chưa đối chiếu"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <a
                          href={e.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-admin-accent hover:underline"
                        >
                          Mở <ExternalLink className="size-2.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ===== NHẬT KÝ ===== */}
        <TabsContent value="runs">
          {article.runs.length === 0 ? (
            <div className="admin-card p-6">
              <EmptyHint icon={<AlertTriangle className="size-4" />} text="Chưa có lượt chạy nào." />
            </div>
          ) : (
            <div className="admin-card overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead className="bg-admin-subtle text-admin-mute">
                  <tr>
                    <th className="px-4 py-2 text-left">Bước</th>
                    <th className="px-4 py-2 text-left">Tác nhân</th>
                    <th className="px-4 py-2 text-right">Thời lượng</th>
                    <th className="px-4 py-2 text-left">Trạng thái</th>
                    <th className="px-4 py-2 text-left">Lỗi</th>
                    <th className="px-4 py-2 text-right">Thời điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {article.runs.map((r) => {
                    const state: StageState = !r.finishedAt ? "running" : r.success ? "ok" : "fail";
                    return (
                      <tr key={r.id} className="border-t border-admin-line">
                        <td className="px-4 py-2 font-medium text-admin-ink">{stageLabel(r.stage)}</td>
                        <td className="px-4 py-2 font-mono text-[11.5px] text-admin-mute">{r.agent}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-admin-mute">{r.durationMs ? `${r.durationMs}ms` : "—"}</td>
                        <td className="px-4 py-2">
                          <StatusPill tone={state === "ok" ? "success" : state === "running" ? "warning" : "danger"} dot>
                            {stateLabel(state)}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-2 text-admin-danger">
                          <span className="line-clamp-2">{r.errorReason ?? ""}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-admin-mute">{new Date(r.startedAt).toLocaleString("vi-VN")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────── helpers ──────────

function stateBorder(state: StageState): string {
  switch (state) {
    case "ok":
      return "border-admin-success/40";
    case "running":
      return "border-admin-warning/50";
    case "fail":
      return "border-admin-danger/40";
    default:
      return "border-admin-line";
  }
}

function StageDot({ state }: { state: StageState }) {
  const cls =
    state === "ok"
      ? "bg-admin-success"
      : state === "running"
      ? "bg-admin-warning animate-pulse"
      : state === "fail"
      ? "bg-admin-danger"
      : "bg-admin-line";
  return <span className={`size-2 rounded-full ${cls}`} />;
}

function SectionStatusPill({ status, large }: { status: string; large?: boolean }) {
  const map: Record<string, "info" | "success" | "warning" | "neutral" | "danger"> = {
    DRAFTING: "warning",
    WRITTEN: "info",
    APPROVED: "success",
    FAILED: "danger"
  };
  return (
    <StatusPill tone={map[status] ?? "neutral"} dot>
      {large ? sectionStatusLabel(status) : sectionStatusShort(status)}
    </StatusPill>
  );
}

function sectionStatusLabel(s: string): string {
  switch (s) {
    case "DRAFTING":
      return "Chưa viết";
    case "WRITTEN":
      return "Đã viết, chờ duyệt";
    case "APPROVED":
      return "Đã duyệt";
    case "FAILED":
      return "Lỗi";
    default:
      return s;
  }
}

function sectionStatusShort(s: string): string {
  switch (s) {
    case "DRAFTING":
      return "Chưa viết";
    case "WRITTEN":
      return "Chờ duyệt";
    case "APPROVED":
      return "Đã duyệt";
    case "FAILED":
      return "Lỗi";
    default:
      return s;
  }
}

function stateLabel(state: StageState): string {
  switch (state) {
    case "ok":
      return "Thành công";
    case "running":
      return "Đang chạy";
    case "fail":
      return "Lỗi";
    default:
      return "Chưa chạy";
  }
}

function stageLabel(key: string): string {
  const item = PIPELINE_STAGES.find((p) => p.key === key);
  return item?.label ?? key;
}

function evidenceTypeLabel(t: string): string {
  switch (t) {
    case "FACT":
      return "Dữ kiện";
    case "REVIEW":
      return "Đánh giá";
    case "IMAGE":
      return "Ảnh";
    case "PRICE":
      return "Giá";
    case "SPEC":
      return "Thông số";
    case "NEWS":
      return "Tin tức";
    default:
      return t;
  }
}

function intentLabel(v: string): string {
  switch (v) {
    case "transactional":
      return "Mua hàng";
    case "commercial-investigation":
      return "Cân nhắc trước mua";
    case "comparison":
      return "So sánh";
    case "informational":
      return "Tham khảo";
    default:
      return v;
  }
}

function depthLabel(v: string): string {
  switch (v) {
    case "shallow":
      return "Ngắn (800–1200 từ)";
    case "medium":
      return "Vừa (1500–2200 từ)";
    case "deep-dive":
      return "Dài (2500+ từ)";
    default:
      return v;
  }
}

function layoutLabel(v: string): string {
  switch (v) {
    case "magazine":
      return "Tạp chí";
    case "technical":
      return "Kỹ thuật";
    case "narrative":
      return "Kể chuyện";
    case "comparison-heavy":
      return "Thiên về so sánh";
    case "listicle":
      return "Danh sách";
    default:
      return v;
  }
}

function hookLabel(v: string): string {
  switch (v) {
    case "contrarian":
      return "Phản biện";
    case "anecdote":
      return "Mẩu chuyện";
    case "stat":
      return "Số liệu sốc";
    case "news":
      return "Tin nóng";
    case "scenario":
      return "Tình huống";
    case "question":
      return "Câu hỏi";
    case "myth-bust":
      return "Phá vỡ định kiến";
    case "vivid":
      return "Mô tả sống động";
    default:
      return v;
  }
}

function expertiseLabel(v: string): string {
  switch (v) {
    case "novice":
      return "Người mới";
    case "intermediate":
      return "Đã tìm hiểu";
    case "expert":
      return "Chuyên gia";
    default:
      return v;
  }
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded-md bg-admin-subtle px-2.5 py-1 text-[11.5px]">
      <span className="text-admin-mute">{label}:</span>{" "}
      <strong className="text-admin-ink">{value}</strong>
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-admin-success/30 bg-admin-success-soft"
      : tone === "warning"
      ? "border-admin-warning/30 bg-admin-warning-soft"
      : tone === "danger"
      ? "border-admin-danger/30 bg-admin-danger-soft"
      : tone === "info"
      ? "border-admin-info/30 bg-admin-info-soft"
      : "border-admin-line bg-admin-surface";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-admin-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold text-admin-ink">{value}</p>
      {sub ? <p className="mt-1 text-[11.5px] text-admin-mute">{sub}</p> : null}
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-admin-ink">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-admin-ink">
        {value || <span className="text-admin-mute">—</span>}
      </dd>
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-admin-line bg-admin-surface-2 p-4 text-[13px] text-admin-mute">
      <span className="mt-0.5 shrink-0 text-admin-warning">{icon}</span>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

function countByType(items: EvidenceLite[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of items) out[e.type] = (out[e.type] ?? 0) + 1;
  return out;
}

/** Status → bước số (1..8). Khớp PIPELINE_STAGES order, dùng cho progress bar tổng thể. */
const STATUS_STEP_INDEX: Record<string, number> = {
  DRAFT_BRIEF: 0,
  RESEARCHING: 1,
  REVIEWS_SCRAPED: 2,
  OUTLINE_READY: 3,
  IMAGES_READY: 4,
  DRAFTING: 5,
  SELF_CRITIQUED: 6,
  FACT_CHECKED: 7
};

function FailedBanner({
  failedStage,
  errorReason,
  onRetry,
  onRestart,
  disabled
}: {
  failedStage: string | null;
  errorReason: string | null;
  onRetry: (() => void) | null;
  onRestart: () => void;
  disabled: boolean;
}) {
  const stageLbl = failedStage
    ? PIPELINE_STAGES.find((p) => p.key === failedStage)?.label ?? failedStage
    : null;
  return (
    <div className="admin-card border-l-4 border-l-admin-danger p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-admin-danger" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-semibold text-admin-ink">
              Pipeline lỗi {stageLbl ? `tại bước "${stageLbl}"` : ""}
            </span>
          </div>
          {errorReason ? (
            <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-admin-ink/80">
              {errorReason}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && failedStage ? (
              <AdminButton size="sm" variant="primary" iconLeft={<RefreshCw />} onClick={onRetry} disabled={disabled}>
                Chạy lại &quot;{stageLbl}&quot;
              </AdminButton>
            ) : null}
            <AdminButton size="sm" variant="outline" onClick={onRestart} disabled={disabled}>
              Bắt đầu lại từ bước 1
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function NeedsRevisionBanner({
  reason,
  onRetryWriter,
  onRetryCritic,
  disabled
}: {
  reason: string | null;
  onRetryWriter: () => void;
  onRetryCritic: () => void;
  disabled: boolean;
}) {
  return (
    <div className="admin-card border-l-4 border-l-admin-warning p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-admin-warning" />
        <div className="flex-1 min-w-0">
          <span className="text-[13.5px] font-semibold text-admin-ink">
            Cần sửa thủ công
          </span>
          {reason ? (
            <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-admin-ink/80">
              {reason}
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] leading-relaxed text-admin-mute">
              Critic flag lỗi nặng sau 2 vòng revise, hoặc fact-check pass rate dưới 60%.
              Bạn có thể sửa section trực tiếp ở tab &quot;Các phần&quot;, hoặc chạy lại AI:
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AdminButton size="sm" variant="primary" iconLeft={<RefreshCw />} onClick={onRetryWriter} disabled={disabled}>
              Bảo AI viết lại
            </AdminButton>
            <AdminButton size="sm" variant="outline" iconLeft={<RefreshCw />} onClick={onRetryCritic} disabled={disabled}>
              Chạy lại Critic
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveProgressBanner({
  status,
  message,
  percent,
  aiRevisionCount,
  stageStartedAt
}: {
  status: string;
  message: string | null;
  percent: number | null;
  aiRevisionCount: number;
  stageStartedAt: string | null;
}) {
  const stepIdx = STATUS_STEP_INDEX[status] ?? 0;
  const total = PIPELINE_STAGES.length;
  const currentLabel = PIPELINE_STAGES[stepIdx]?.label ?? "Đang chuẩn bị";
  const stagePct = typeof percent === "number" ? Math.max(0, Math.min(100, percent)) : 0;
  const overall = Math.round(((stepIdx + stagePct / 100) / total) * 100);

  // Tick 1s để render elapsed time. Nếu stage chạy > 60s mà progress đứng → warn.
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsedSec = stageStartedAt ? Math.floor((now - new Date(stageStartedAt).getTime()) / 1000) : 0;
  const stuck = elapsedSec > 60 && stagePct < 5;

  return (
    <div className={`admin-card flex items-center gap-4 px-4 py-3 ${stuck ? "border-l-4 border-l-admin-warning" : ""}`}>
      <Loader2 className="size-5 shrink-0 animate-spin text-admin-accent" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[13px] font-semibold text-admin-ink">
            Bước {stepIdx + 1}/{total}: {currentLabel}
          </span>
          <span className="text-[12px] tabular-nums font-semibold text-admin-accent">{overall}%</span>
          {stageStartedAt ? (
            <span className="text-[11.5px] tabular-nums text-admin-mute">
              · đang chạy {formatElapsed(elapsedSec)}
            </span>
          ) : null}
          {aiRevisionCount > 0 ? (
            <span className="rounded bg-admin-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-admin-warning">
              AI sửa {aiRevisionCount}×
            </span>
          ) : null}
          {stuck ? (
            <span className="rounded bg-admin-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-admin-warning">
              Có vẻ đang chậm — đợi thêm hoặc kiểm tra log API
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-admin-ink/80">{message ?? "Đang khởi động…"}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-admin-line">
          <div
            className="h-full bg-admin-accent transition-all duration-500"
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ────────── Section editor ──────────

type AnyBlock = { type: string } & Record<string, unknown>;

function SectionDetailPane({
  section,
  viewMode,
  setViewMode,
  pending,
  onApprove,
  onReset,
  onSave
}: {
  section: SectionLite;
  viewMode: "preview" | "edit" | "json";
  setViewMode: (m: "preview" | "edit" | "json") => void;
  pending: boolean;
  onApprove: () => void;
  onReset: () => void;
  onSave: (patch: { heading?: string; summary?: string; blocks?: unknown[] }) => Promise<unknown> | void;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [summary, setSummary] = useState(section.summary);
  const [blocks, setBlocks] = useState<AnyBlock[]>(() => (section.blocks as AnyBlock[]) ?? []);
  // Reset khi đổi section.
  useEffect(() => {
    setHeading(section.heading);
    setSummary(section.summary);
    setBlocks((section.blocks as AnyBlock[]) ?? []);
  }, [section.id, section.heading, section.summary, section.blocks]);

  const dirty =
    heading !== section.heading ||
    summary !== section.summary ||
    JSON.stringify(blocks) !== JSON.stringify(section.blocks);

  const handleSave = () => {
    const patch: { heading?: string; summary?: string; blocks?: unknown[] } = {};
    if (heading !== section.heading) patch.heading = heading;
    if (summary !== section.summary) patch.summary = summary;
    if (JSON.stringify(blocks) !== JSON.stringify(section.blocks)) patch.blocks = blocks;
    if (Object.keys(patch).length === 0) return;
    onSave(patch);
  };

  const updateBlock = (idx: number, patch: Partial<AnyBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? ({ ...b, ...patch } as AnyBlock) : b)));
  };
  const removeBlock = (idx: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveBlock = (idx: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const addProse = () => {
    setBlocks((prev) => [...prev, { type: "prose", markdown: "" }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {viewMode === "edit" ? (
            <>
              <input
                type="text"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                className="w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[15px] font-semibold text-admin-ink focus:border-admin-accent focus:outline-none"
                placeholder="Tiêu đề phần"
              />
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="mt-2 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] leading-relaxed text-admin-ink focus:border-admin-accent focus:outline-none"
                placeholder="Tóm tắt phần — chỉ dùng cho TOC hover & meta, KHÔNG hiển thị trong bài"
              />
            </>
          ) : (
            <h3 className="text-[16px] font-semibold leading-snug text-admin-ink">{section.heading}</h3>
          )}
        </div>
        <SectionStatusPill status={section.status} large />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-admin-line pt-3">
        <div className="inline-flex rounded-md border border-admin-line bg-admin-surface p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`rounded px-2.5 py-1 ${viewMode === "preview" ? "bg-admin-accent-soft text-admin-accent-ink" : "text-admin-mute hover:text-admin-ink"}`}
          >
            <Eye className="mr-1 inline size-3" /> Xem trước
          </button>
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={`rounded px-2.5 py-1 ${viewMode === "edit" ? "bg-admin-accent-soft text-admin-accent-ink" : "text-admin-mute hover:text-admin-ink"}`}
          >
            <Pencil className="mr-1 inline size-3" /> Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            className={`rounded px-2.5 py-1 ${viewMode === "json" ? "bg-admin-accent-soft text-admin-accent-ink" : "text-admin-mute hover:text-admin-ink"}`}
          >
            <FileText className="mr-1 inline size-3" /> Dữ liệu
          </button>
        </div>
        <div className="ml-auto flex gap-2">
          {viewMode === "edit" && dirty ? (
            <AdminButton size="xs" variant="primary" iconLeft={<Check />} onClick={handleSave} disabled={pending}>
              Lưu thay đổi
            </AdminButton>
          ) : null}
          {section.status === "WRITTEN" && viewMode !== "edit" ? (
            <AdminButton size="xs" variant="primary" iconLeft={<Check />} onClick={onApprove} disabled={pending}>
              Duyệt phần này
            </AdminButton>
          ) : null}
          {section.status === "APPROVED" || section.blocks.length === 0 ? (
            <AdminButton size="xs" variant="outline" onClick={onReset} disabled={pending}>
              Đặt lại để viết lại
            </AdminButton>
          ) : null}
        </div>
      </div>

      {viewMode === "preview" ? (
        section.blocks.length === 0 ? (
          <EmptyHint
            icon={<AlertTriangle className="size-4" />}
            text="Phần này chưa có nội dung — vui lòng chạy bước Viết bài."
          />
        ) : (
          <div className="max-h-[640px] overflow-auto rounded-md border border-admin-line bg-white">
            <div className="mx-auto max-w-[720px] px-6 py-8">
              <BlockRenderer
                blocks={section.blocks as ArticleBlock[]}
                products={[] as ProductItem[]}
              />
            </div>
          </div>
        )
      ) : viewMode === "edit" ? (
        <div className="space-y-3">
          {/* Image manager: paste URL tay khi Tavily/product không có ảnh phù hợp */}
          <SectionImageManager blocks={blocks} onBlocksChange={setBlocks} />

          {blocks.length === 0 ? (
            <EmptyHint
              icon={<AlertTriangle className="size-4" />}
              text='Chưa có block nào. Bấm "Thêm đoạn văn" để bắt đầu viết tay.'
            />
          ) : (
            blocks.map((block, idx) => (
              <BlockEditor
                key={idx}
                block={block}
                isFirst={idx === 0}
                isLast={idx === blocks.length - 1}
                onChange={(patch) => updateBlock(idx, patch)}
                onRemove={() => removeBlock(idx)}
                onMove={(dir) => moveBlock(idx, dir)}
              />
            ))
          )}
          <button
            type="button"
            onClick={addProse}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-admin-line bg-admin-surface px-3 py-2.5 text-[12.5px] text-admin-mute transition hover:border-admin-accent hover:text-admin-accent"
          >
            <Plus className="size-3.5" /> Thêm đoạn văn (prose)
          </button>
        </div>
      ) : (
        <pre className="max-h-[640px] overflow-auto rounded-md border border-admin-line bg-admin-surface-2 p-3 text-[11.5px] leading-relaxed text-admin-ink">
          {JSON.stringify(section.blocks, null, 2)}
        </pre>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove
}: {
  block: AnyBlock;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<AnyBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-md border border-admin-line bg-admin-surface">
      <div className="flex items-center gap-2 border-b border-admin-line px-3 py-1.5 text-[12px]">
        <span className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-admin-ink">
          {blockTypeLabel(block.type)}
        </span>
        <div className="ml-auto flex gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded p-1 text-admin-ink hover:bg-admin-subtle disabled:opacity-30"
            title="Đưa lên"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded p-1 text-admin-ink hover:bg-admin-subtle disabled:opacity-30"
            title="Đưa xuống"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-admin-ink hover:bg-admin-danger-soft hover:text-admin-danger"
            title="Xoá block"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <BlockFormDispatcher
          block={block as { type: string } & Record<string, unknown>}
          onChange={(next) => onChange(next as Partial<AnyBlock>)}
        />
      </div>
    </div>
  );
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  prose: "Đoạn văn",
  image: "Ảnh",
  callout: "Callout",
  pros_cons: "Ưu / nhược",
  verdict: "Kết luận",
  faq: "FAQ",
  hero_quote: "Quote mở bài",
  review_quote: "Review",
  citation: "Trích nguồn",
  criteria_grid: "Bảng tiêu chí",
  product_slot: "Slot sản phẩm",
  product_spotlight: "Spotlight sản phẩm",
  comparison: "So sánh"
};
function blockTypeLabel(t: string): string {
  return BLOCK_TYPE_LABELS[t] ?? t;
}

/** Đếm tổng product_slot block trong tất cả sections để hiển thị badge tab "Gắn sản phẩm". */
function countProductSlots(sections: Array<{ blocks: unknown[] }>): number {
  let total = 0;
  for (const s of sections) {
    if (!Array.isArray(s.blocks)) continue;
    for (const b of s.blocks) {
      if (b && typeof b === "object" && (b as { type?: unknown }).type === "product_slot") total += 1;
    }
  }
  return total;
}

function daysAgoNum(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
function daysAgo(iso: string | null | undefined): number {
  const n = daysAgoNum(iso);
  return n === Infinity ? 0 : n;
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}p${s.toString().padStart(2, "0")}`;
}

/**
 * Pipeline strip compact — 1 row 8 pips thay vì cards to. Highlight stage hiện tại
 * (running > fail > "stage cuối ok + 1"). Bấm pip → retry stage. Meta inline trên đầu
 * (số phần đã viết / số từ / lần sửa).
 */
function PipelineStrip({
  stageState,
  latestRun,
  pending,
  onRetryStage,
  wordCount,
  revisionCount,
  sectionsWritten,
  sectionsTotal
}: {
  stageState: (key: string) => StageState;
  latestRun: Map<string, RunLite>;
  pending: boolean;
  onRetryStage: (stage: string) => void;
  wordCount: number | null;
  revisionCount: number;
  sectionsWritten: number;
  sectionsTotal: number;
}) {
  const stages = PIPELINE_STAGES;
  const runningIdx = stages.findIndex((s) => stageState(s.key) === "running");
  const failedIdx = stages.findIndex((s) => stageState(s.key) === "fail");
  const okCount = stages.filter((s) => stageState(s.key) === "ok").length;
  const highlightIdx =
    runningIdx >= 0 ? runningIdx : failedIdx >= 0 ? failedIdx : Math.min(okCount, stages.length - 1);

  return (
    <div className="admin-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="text-admin-mute">
          Quy trình:{" "}
          <strong className="text-admin-ink">
            {okCount}/{stages.length}
          </strong>{" "}
          bước
        </span>
        <span aria-hidden className="text-admin-mute">·</span>
        <span className="text-admin-mute">
          Phần đã viết:{" "}
          <strong className="text-admin-ink">
            {sectionsWritten}/{sectionsTotal}
          </strong>
        </span>
        <span aria-hidden className="text-admin-mute">·</span>
        <span className="text-admin-mute">
          Số từ: <strong className="text-admin-ink">{wordCount ?? "—"}</strong>
        </span>
        <span aria-hidden className="text-admin-mute">·</span>
        <span className="text-admin-mute">
          Lần sửa: <strong className="text-admin-ink">{revisionCount}</strong>
        </span>
        <span className="ml-auto text-[10.5px] text-admin-mute">
          Bấm pip để chạy lại bước đó
        </span>
      </div>

      <ol className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {stages.map((s, i) => {
          const state = stageState(s.key);
          const isActive = i === highlightIdx;
          const run = latestRun.get(s.key);
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onRetryStage(s.key)}
                className={`group block w-full rounded-md border bg-admin-surface px-2 py-1.5 text-left transition hover:border-admin-accent disabled:opacity-50 ${stateBorder(state)} ${isActive ? "ring-2 ring-admin-accent/30" : ""}`}
                title={
                  run
                    ? `${stateLabel(state)}${run.durationMs ? ` · ${run.durationMs}ms` : ""}${run.errorReason ? `\n${run.errorReason}` : ""}`
                    : "Chưa chạy"
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wider text-admin-mute">
                    B{i + 1}
                  </span>
                  <StageDot state={state} />
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11.5px] font-medium text-admin-ink">
                  {s.label}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Checklist tự động khi article ở status PENDING_REVIEW. Quét sections + blocks để
 * báo admin biết bài còn thiếu gì trước khi đăng (ảnh, slot sản phẩm, verdict).
 * Pattern: admin không phải click 3 tab mới biết hiện trạng → quyết nhanh.
 */
function PrePublishChecklist({
  sections,
  onApprove,
  pending
}: {
  sections: SectionLite[];
  onApprove: () => void;
  pending: boolean;
}) {
  const totalSections = sections.length;
  const writtenSections = sections.filter((s) => s.status === "WRITTEN" || s.status === "APPROVED").length;

  // Section cần ảnh (theo blockTypeHints) vs section đã có image block với src
  const sectionsNeedingImage = sections.filter((s) => {
    const hints = (s as { blockTypeHints?: string[] }).blockTypeHints ?? [];
    return hints.some((t) => t === "image" || t === "image_gallery");
  }).length;
  const sectionsWithImage = sections.filter((s) => {
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];
    return blocks.some((b) => {
      if (!b || typeof b !== "object") return false;
      const obj = b as Record<string, unknown>;
      return obj.type === "image" && typeof obj.src === "string" && obj.src.length > 0;
    });
  }).length;

  // Product slot tổng / đã gắn
  let totalSlots = 0;
  let filledSlots = 0;
  for (const s of sections) {
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];
    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      const obj = b as Record<string, unknown>;
      if (obj.type === "product_slot") {
        totalSlots += 1;
        if (typeof obj.productId === "string" && obj.productId.length > 0) filledSlots += 1;
      }
    }
  }

  // Có verdict block?
  const hasVerdict = sections.some((s) => {
    const blocks = Array.isArray(s.blocks) ? s.blocks : [];
    return blocks.some((b) => b && typeof b === "object" && (b as Record<string, unknown>).type === "verdict");
  });

  const items: Array<{ ok: boolean; label: string; hint?: string }> = [
    {
      ok: writtenSections === totalSections && totalSections > 0,
      label:
        writtenSections === totalSections
          ? `Tất cả ${totalSections} phần đã viết`
          : `${writtenSections}/${totalSections} phần đã viết`,
      hint: writtenSections < totalSections ? "Còn phần chưa viết — mở tab Các phần" : undefined
    },
    {
      ok: sectionsNeedingImage === 0 || sectionsWithImage >= sectionsNeedingImage,
      label:
        sectionsNeedingImage === 0
          ? "Không có section nào cần ảnh"
          : `${sectionsWithImage}/${sectionsNeedingImage} section có ảnh`,
      hint:
        sectionsNeedingImage > 0 && sectionsWithImage < sectionsNeedingImage
          ? "Mở Các phần → Chỉnh sửa → Quản lý ảnh để gắn"
          : undefined
    },
    {
      ok: totalSlots === 0 || filledSlots === totalSlots,
      label:
        totalSlots === 0
          ? "Không có slot sản phẩm cần gắn"
          : `${filledSlots}/${totalSlots} slot sản phẩm đã gắn`,
      hint:
        totalSlots > filledSlots ? "Mở tab Gắn sản phẩm để chọn product cho slot" : undefined
    },
    {
      ok: hasVerdict,
      label: hasVerdict ? "Có block kết luận (verdict)" : "Chưa có block kết luận",
      hint: !hasVerdict
        ? "Khuyến nghị thêm verdict ở section cuối — tăng conversion"
        : undefined
    }
  ];

  const allOk = items.every((i) => i.ok);

  return (
    <div
      className={`admin-card overflow-hidden border-l-4 ${allOk ? "border-l-admin-success" : "border-l-admin-warning"}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-full ${allOk ? "bg-admin-success-soft text-admin-success" : "bg-admin-warning-soft text-admin-warning"}`}
        >
          {allOk ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-admin-ink">
            {allOk ? "Bài sẵn sàng đăng" : "Cần kiểm tra trước khi đăng"}
          </div>
          <ul className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                {it.ok ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-admin-success" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-admin-warning" />
                )}
                <div className="min-w-0 flex-1">
                  <span className={it.ok ? "text-admin-ink/80" : "font-medium text-admin-ink"}>
                    {it.label}
                  </span>
                  {it.hint && !it.ok ? (
                    <span className="ml-1 text-admin-mute">— {it.hint}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <AdminButton
          size="sm"
          variant={allOk ? "primary" : "outline"}
          iconLeft={<Check />}
          onClick={onApprove}
          disabled={pending}
        >
          Đăng bài
        </AdminButton>
      </div>
    </div>
  );
}
