"use client";

import * as React from "react";
import { Loader2, Play, AlertTriangle, X } from "lucide-react";
import { AdminButton } from "../../../components/admin/ui";
import {
  runCrawlerNowAction,
  getCrawlerProgressAction,
  type CrawlerCycleResult,
  type CrawlerProgress
} from "../actions";
import { notifyError } from "../../../lib/admin/notify";

const POLL_INTERVAL_MS = 800;

/**
 * Client button cho /admin/crawler-logs.
 * - Loading: progress bar `done/total`, label "merchant/niche đang chạy", elapsed timer.
 *   Poll `/admin/crawler/progress` mỗi 800ms để cập nhật.
 * - Done: panel breakdown per-assignment + nút dismiss.
 * - Error: toast + giữ panel cuối.
 */
export function RunCrawlerButton(): React.ReactElement {
  const [running, setRunning] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [progress, setProgress] = React.useState<CrawlerProgress | null>(null);
  const [result, setResult] = React.useState<CrawlerCycleResult | null>(null);

  React.useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setElapsedMs(0);
    setProgress(null);

    const timerId = setInterval(() => setElapsedMs(Date.now() - start), 200);
    const pollId = setInterval(async () => {
      try {
        const p = await getCrawlerProgressAction();
        setProgress(p);
      } catch {
        // ignore — polling lỗi không cần spam UI
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timerId);
      clearInterval(pollId);
    };
  }, [running]);

  async function handleRun(): Promise<void> {
    setRunning(true);
    setResult(null);
    try {
      const r = await runCrawlerNowAction();
      setResult(r);
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <div className="flex w-full flex-col items-end gap-3">
      <AdminButton
        type="button"
        size="md"
        onClick={handleRun}
        disabled={running}
        iconLeft={running ? <Loader2 className="animate-spin" /> : <Play />}
      >
        {running ? "Đang lấy…" : "▶ Lấy sản phẩm ngay"}
      </AdminButton>

      {running ? (
        <div className="w-full max-w-[560px] rounded-xl border border-admin-line bg-admin-surface p-3 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
            <span className="flex items-center gap-1.5 font-medium text-admin-ink">
              <Loader2 className="size-3.5 animate-spin" />
              {progress?.currentLabel ?? "Đang khởi tạo…"}
            </span>
            <span className="font-mono text-[11.5px] text-admin-mute">
              {progress ? `${progress.done}/${progress.total}` : "—"} · {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-admin-subtle">
            <div
              className="h-full rounded-full bg-admin-accent transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {!running && result ? <ResultPanel result={result} onDismiss={() => setResult(null)} /> : null}
    </div>
  );
}

function ResultPanel({
  result,
  onDismiss
}: {
  result: CrawlerCycleResult;
  onDismiss: () => void;
}): React.ReactElement {
  const allFailed = result.fetched > 0 && result.passedFilter === 0;
  const noFetch = result.fetched === 0;

  return (
    <div className="w-full max-w-[640px] rounded-xl border border-admin-line bg-admin-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-admin-line/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-admin-ink">
          {noFetch || allFailed ? (
            <AlertTriangle className="size-4 text-amber-600" />
          ) : null}
          Kết quả cycle vừa chạy
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-admin-mute hover:bg-admin-subtle hover:text-admin-ink"
          aria-label="Đóng"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-2 text-[12px]">
          <Stat label="Fetched" value={result.fetched} />
          <Stat label="Qua filter" value={result.passedFilter} />
          <Stat label="Mới (+)" value={result.created} tone="success" />
          <Stat label="Cập nhật (~)" value={result.updated} tone="muted" />
        </div>

        {result.campaigns.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-admin-line">
            <table className="w-full text-[12px]">
              <thead className="bg-admin-subtle/60 text-[11px] uppercase tracking-wide text-admin-mute">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Campaign</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Fetched</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Routed</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Filter fail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line/70">
                {result.campaigns.map((c) => (
                  <tr key={c.campaignId}>
                    <td className="px-2.5 py-1.5">
                      <div className="font-mono text-[11.5px] text-admin-ink">{c.merchantSlug}</div>
                      <div className="text-[11px] text-admin-mute">{c.campaignName}</div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{c.fetched}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">
                      <span
                        className={
                          c.routed > 0 ? "font-semibold text-emerald-600" : "text-admin-mute"
                        }
                      >
                        {c.routed}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono">
                      <span className={c.failedFilter > 0 ? "text-amber-600" : "text-admin-mute"}>
                        {c.failedFilter}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-admin-line bg-admin-subtle/40 px-3 py-3 text-[12px] text-admin-mute">
            Không có assignment nào eligible. Vào{" "}
            <a href="/admin/campaigns" className="font-medium text-admin-accent underline">
              /admin/campaigns
            </a>{" "}
            để approve + assign Niche cho ít nhất 1 Campaign.
          </div>
        )}

        {result.created > 0 || result.updated > 0 ? (
          <div className="mt-3 flex justify-end">
            <a
              href="/admin/products?page=1"
              className="text-[12px] font-medium text-admin-accent hover:underline"
            >
              → Xem sản phẩm vừa thêm
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "success" | "muted";
}): React.ReactElement {
  const valueClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "muted"
        ? "text-admin-mute"
        : "text-admin-ink";
  return (
    <div className="rounded-lg border border-admin-line bg-admin-subtle/30 px-2.5 py-1.5">
      <div className="text-[10.5px] uppercase tracking-wide text-admin-mute">{label}</div>
      <div className={`font-mono text-[15px] font-semibold ${valueClass}`}>
        {value.toLocaleString("vi-VN")}
      </div>
    </div>
  );
}
