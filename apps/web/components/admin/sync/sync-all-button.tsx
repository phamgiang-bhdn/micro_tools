"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAllAction, type SyncAllResult } from "../../../app/admin/actions";

const STEP_LABELS: Record<string, string> = {
  crawler: "Pull deal mới",
  reconcile: "Đối soát đơn",
  coupon: "Sync mã giảm",
  top_products: "Snapshot top deal",
  commission_rank: "Pull commission rank",
  keyword_radar: "Pull keyword radar"
};

const STEPS = ["crawler", "reconcile", "coupon", "top_products", "commission_rank", "keyword_radar"];

/**
 * STORY-02: mega-button "Đồng bộ tất cả" — chạy 6 sync tuần tự qua 1 server action.
 * Hiển thị step result với ms duration. Refresh dashboard sau khi xong.
 */
export function SyncAllButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<SyncAllResult["results"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setResults(null);
    startTransition(async () => {
      try {
        const out = await syncAllAction();
        setResults(out.results);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="rounded-xl border border-admin-line bg-admin-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-admin-ink">🔄 Đồng bộ dữ liệu</h3>
          <p className="mt-0.5 text-xs text-admin-mute">
            Pull deal mới + đối soát đơn + sync mã + top deal + cơ hội tuần.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-admin-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Đang đồng bộ…" : "Đồng bộ tất cả"}
        </button>
      </div>

      {(pending || results) && (
        <ul className="mt-4 space-y-1.5 border-t border-admin-line pt-4 text-sm">
          {STEPS.map((name) => {
            const r = results?.[name];
            return (
              <li key={name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={
                    r
                      ? r.ok
                        ? "inline-block size-2.5 rounded-full bg-admin-success"
                        : "inline-block size-2.5 rounded-full bg-admin-danger"
                      : pending
                        ? "inline-block size-2.5 animate-pulse rounded-full bg-admin-line"
                        : "inline-block size-2.5 rounded-full bg-admin-line"
                  }
                />
                <span className="flex-1 text-admin-ink">{STEP_LABELS[name] ?? name}</span>
                {r ? (
                  <span className="text-xs text-admin-mute">{r.ms}ms{r.error ? ` — ${r.error}` : ""}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="mt-3 rounded-md bg-admin-danger-soft px-2 py-1 text-xs text-admin-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
