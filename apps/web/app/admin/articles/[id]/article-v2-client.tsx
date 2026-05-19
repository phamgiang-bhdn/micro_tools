"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  Database,
  Activity,
  Loader2
} from "lucide-react";
import { AdminButton, StatusPill, Tabs, TabsList, TabsTrigger, TabsContent } from "../../../../components/admin/ui";
import { PIPELINE_STAGES } from "../../../../lib/admin/constants";
import { BlockRenderer } from "../../../../components/article/blocks/block-renderer";
import type { ArticleBlock, ProductItem } from "../../../../lib/types";
import {
  approveArticleV2Action,
  retryArticleStageAction,
  requestArticleRevisionAction,
  updateSectionAction
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
  const [viewMode, setViewMode] = useState<"preview" | "json">("preview");
  const activeSection = article.sections.find((s) => s.id === activeSectionId) ?? null;

  // Live progress: poll mỗi 2s khi pipeline đang chạy. Auto refresh full page khi status đạt terminal.
  const [liveStatus, setLiveStatus] = useState<string>(article.status);
  const [liveMsg, setLiveMsg] = useState<string | null>(article.currentStageMessage);
  const [livePct, setLivePct] = useState<number | null>(article.currentStageProgress);
  const [liveAiRev, setLiveAiRev] = useState<number>(article.aiRevisionCount);
  const lastRefreshedStatusRef = useRef<string>(article.status);

  const isRunning = !TERMINAL_STATUSES.has(liveStatus);

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

  // Latest run per stage
  const latestRun = new Map<string, RunLite>();
  for (const r of article.runs) {
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

  const onResetSection = (sectionId: string) =>
    withToast(
      async () => {
        await updateSectionAction(article.id, sectionId, { status: "DRAFTING" });
        refresh();
      },
      { loading: "Đang đặt lại…", success: "Đã đặt lại thành chưa viết", error: "Lỗi" }
    );

  const brief = article.briefJson;
  const sectionsApproved = article.sections.filter((s) => s.status === "APPROVED").length;
  const sectionsWritten = article.sections.filter((s) => s.status === "WRITTEN").length;
  const evidenceByType = countByType(article.evidence);

  // Stage cuối cùng đã fail (để CTA "Chạy lại bước này")
  const lastFailedStage = article.runs.find((r) => r.finishedAt && !r.success)?.stage ?? null;
  const lastFailedError = article.runs.find((r) => r.finishedAt && !r.success)?.errorReason ?? null;

  return (
    <div className="space-y-5">
      {/* ────── BANNER TRẠNG THÁI ────── */}
      {isRunning ? (
        <LiveProgressBanner
          status={liveStatus}
          message={liveMsg}
          percent={livePct}
          aiRevisionCount={liveAiRev}
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
              <AdminButton variant="primary" size="sm" onClick={onApprove} disabled={pending}>
                <Check className="size-3.5" /> Duyệt &amp; Đăng bài
              </AdminButton>
            </>
          ) : (
            <span className="text-[12px] text-admin-mute">
              Đăng bài chỉ khả dụng khi đạt trạng thái <strong className="text-admin-ink">Chờ admin duyệt</strong>.
            </span>
          )}
        </div>
      </div>

      {/* ────── QUY TRÌNH 8 BƯỚC ────── */}
      <div className="admin-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="admin-section-title">Quy trình 8 bước</div>
            <p className="mt-0.5 text-[12px] text-admin-mute">
              Bấm vào ô để chạy lại bước đó. Vàng = đang chạy, xanh = thành công, đỏ = lỗi.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-admin-mute">
            <Stat label="Lần sửa" value={article.revisionCount} />
            <Stat label="Số từ" value={article.wordCount ?? "—"} />
            <Stat label="Độ dễ đọc" value={article.readabilityScore ?? "—"} />
          </div>
        </div>
        <ol className="flex flex-wrap items-stretch gap-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const state = stageState(stage.key);
            const run = latestRun.get(stage.key);
            return (
              <li key={stage.key} className="flex items-stretch gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRetryStage(stage.key)}
                  className={`group flex min-w-[120px] flex-col items-start gap-1 rounded-lg border bg-admin-surface px-3 py-2 text-left transition hover:border-admin-accent disabled:opacity-50 ${stateBorder(state)}`}
                  title={
                    run
                      ? `${stateLabel(state)}${run.durationMs ? ` · ${run.durationMs}ms` : ""}${run.errorReason ? `\n${run.errorReason}` : ""}`
                      : "Chưa chạy"
                  }
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-admin-mute">Bước {i + 1}</span>
                    <StageDot state={state} />
                  </div>
                  <span className="text-[13px] font-semibold text-admin-ink">{stage.label}</span>
                  <span className="text-[11px] text-admin-mute">
                    {run
                      ? state === "running"
                        ? "Đang chạy…"
                        : run.durationMs
                        ? `${run.durationMs}ms`
                        : stateLabel(state)
                      : "—"}
                  </span>
                  <span className="invisible flex items-center gap-1 text-[10.5px] text-admin-accent group-hover:visible">
                    <RefreshCw className="size-2.5" /> Chạy lại
                  </span>
                </button>
                {i < PIPELINE_STAGES.length - 1 ? <ChevronRight className="my-auto size-4 shrink-0 text-admin-mute" /> : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ────── TABS ────── */}
      <Tabs defaultValue="overview">
        <TabsList variant="underline" className="w-full">
          <TabsTrigger value="overview"><Sparkles className="size-3.5" /> Tổng quan</TabsTrigger>
          <TabsTrigger value="sections" badge={article.sections.length || undefined}>
            <Layers className="size-3.5" /> Các phần
          </TabsTrigger>
          <TabsTrigger value="evidence" badge={article.evidence.length || undefined}>
            <Database className="size-3.5" /> Nguồn dẫn
          </TabsTrigger>
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
        <TabsContent value="sections">
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
                  {article.sections.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSectionId(s.id)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition ${
                          activeSectionId === s.id
                            ? "bg-admin-accent-soft text-admin-accent-ink"
                            : "hover:bg-admin-subtle"
                        }`}
                      >
                        <span className="line-clamp-2 font-semibold leading-snug">
                          {s.order + 1}. {s.heading}
                        </span>
                        <div className="flex items-center gap-2 text-[10.5px]">
                          <SectionStatusPill status={s.status} />
                          <span className="text-admin-mute">
                            {s.wordCount}/{s.estimatedWords} từ
                          </span>
                          {s.evidenceRefs.length > 0 ? (
                            <span className="text-admin-mute">· {s.evidenceRefs.length} nguồn</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Chi tiết phần */}
              <div className="admin-card p-5">
                {activeSection ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-semibold leading-snug text-admin-ink">{activeSection.heading}</h3>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-admin-mute">{activeSection.summary}</p>
                      </div>
                      <SectionStatusPill status={activeSection.status} large />
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
                          onClick={() => setViewMode("json")}
                          className={`rounded px-2.5 py-1 ${viewMode === "json" ? "bg-admin-accent-soft text-admin-accent-ink" : "text-admin-mute hover:text-admin-ink"}`}
                        >
                          <FileText className="mr-1 inline size-3" /> Dữ liệu
                        </button>
                      </div>
                      <div className="ml-auto flex gap-2">
                        {activeSection.status === "WRITTEN" ? (
                          <AdminButton size="xs" variant="primary" onClick={() => onApproveSection(activeSection.id)} disabled={pending}>
                            <Check className="size-3" /> Duyệt phần này
                          </AdminButton>
                        ) : null}
                        {activeSection.status === "APPROVED" || activeSection.blocks.length === 0 ? (
                          <AdminButton size="xs" variant="outline" onClick={() => onResetSection(activeSection.id)} disabled={pending}>
                            Đặt lại để viết lại
                          </AdminButton>
                        ) : null}
                      </div>
                    </div>

                    {viewMode === "preview" ? (
                      activeSection.blocks.length === 0 ? (
                        <EmptyHint
                          icon={<AlertTriangle className="size-4" />}
                          text="Phần này chưa có nội dung — vui lòng chạy bước Viết bài."
                        />
                      ) : (
                        <div className="max-h-[640px] overflow-auto rounded-md border border-admin-line bg-white p-5">
                          <BlockRenderer
                            blocks={activeSection.blocks as ArticleBlock[]}
                            products={[] as ProductItem[]}
                          />
                        </div>
                      )
                    ) : (
                      <pre className="max-h-[640px] overflow-auto rounded-md border border-admin-line bg-admin-surface-2 p-3 text-[11.5px] leading-relaxed text-admin-ink">
                        {JSON.stringify(activeSection.blocks, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <EmptyHint icon={<AlertTriangle className="size-4" />} text="Chọn 1 phần bên trái để xem." />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== NGUỒN DẪN ===== */}
        <TabsContent value="evidence">
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
      <dt className="text-[11px] uppercase tracking-wide text-admin-mute">{label}</dt>
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
              <AdminButton size="sm" variant="primary" onClick={onRetry} disabled={disabled}>
                <RefreshCw className="size-3.5" /> Chạy lại "{stageLbl}"
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
              Bạn có thể sửa section trực tiếp ở tab "Các phần", hoặc chạy lại AI:
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton size="sm" variant="primary" onClick={onRetryWriter} disabled={disabled}>
              <RefreshCw className="size-3.5" /> Bảo AI viết lại
            </AdminButton>
            <AdminButton size="sm" variant="outline" onClick={onRetryCritic} disabled={disabled}>
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
  aiRevisionCount
}: {
  status: string;
  message: string | null;
  percent: number | null;
  aiRevisionCount: number;
}) {
  const stepIdx = STATUS_STEP_INDEX[status] ?? 0;
  const total = PIPELINE_STAGES.length;
  const currentLabel = PIPELINE_STAGES[stepIdx]?.label ?? "Đang chuẩn bị";
  // Overall % = (stepsHoànThành + percentBướcHiệnTại/100) / total × 100
  const stagePct = typeof percent === "number" ? Math.max(0, Math.min(100, percent)) : 0;
  const overall = Math.round(((stepIdx + stagePct / 100) / total) * 100);

  return (
    <div className="admin-card flex items-center gap-4 px-4 py-3">
      <Loader2 className="size-5 shrink-0 animate-spin text-admin-accent" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-admin-ink">
            Bước {stepIdx + 1}/{total}: {currentLabel}
          </span>
          <span className="text-[12px] tabular-nums font-semibold text-admin-accent">
            {overall}%
          </span>
          {aiRevisionCount > 0 ? (
            <span className="rounded bg-admin-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-admin-warning">
              AI sửa {aiRevisionCount}×
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-admin-ink/80">
          {message ?? "Đang khởi động…"}
        </p>
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
