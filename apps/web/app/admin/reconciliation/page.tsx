import type React from "react";
import { runReconciliationNowAction } from "../actions";
import {
  adminGet,
  AdminButton,
  DataTable,
  PageHeader,
  Pagination,
  StatusPill,
  paginateRows,
  type ColumnDef
} from "../../../components/admin/ui";

export const dynamic = "force-dynamic";

interface ReconciliationLogRow {
  id: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  syncWindowStart: string;
  syncWindowEnd: string;
  fetched: number;
  matched: number;
  updated: number;
  unmatched: number;
  success: boolean;
  errorReason: string | null;
  durationMs: number | null;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 25;

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export default async function ReconciliationLogsPage({
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { page = "1" } = await searchParams;
  const logs = await adminGet<ReconciliationLogRow[]>("/admin/reconciliation/logs?limit=100");
  const lastSuccess = logs.find((l) => l.success);
  const lastFailure = logs.find((l) => !l.success && l.finishedAt);

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(logs, pageNum, PAGE_SIZE);
  const buildHref = (p: number): string =>
    p > 1 ? `/admin/reconciliation?page=${p}` : "/admin/reconciliation";

  const columns: ColumnDef<ReconciliationLogRow>[] = [
    {
      key: "startedAt",
      header: "Bắt đầu",
      cell: (l) => (
        <span className="font-mono text-xs text-admin-ink">
          {dateFmt.format(new Date(l.startedAt))}
        </span>
      )
    },
    {
      key: "trigger",
      header: "Trigger",
      hideOnMobile: true,
      cell: (l) => (
        <span className="rounded-full bg-admin-subtle px-2 py-0.5 text-[11px] font-semibold text-admin-mute">
          {l.triggeredBy}
        </span>
      )
    },
    {
      key: "window",
      header: "Cửa sổ sync",
      hideOnMobile: true,
      cell: (l) => (
        <span className="font-mono text-[11px] text-admin-mute">
          {dateFmt.format(new Date(l.syncWindowStart))} → {dateFmt.format(new Date(l.syncWindowEnd))}
        </span>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (l) =>
        l.finishedAt === null ? (
          <StatusPill tone="info" dot pulse>
            Đang chạy
          </StatusPill>
        ) : l.success ? (
          <StatusPill tone="success">✓ Thành công</StatusPill>
        ) : (
          <StatusPill tone="danger" title={l.errorReason ?? ""}>
            ✕ Lỗi
          </StatusPill>
        )
    },
    {
      key: "fetched",
      header: "Fetched",
      align: "right",
      cell: (l) => <span className="text-admin-ink">{l.fetched}</span>
    },
    {
      key: "matched",
      header: "Matched",
      align: "right",
      cell: (l) => <span className="text-admin-ink">{l.matched}</span>
    },
    {
      key: "updated",
      header: "Updated",
      align: "right",
      cell: (l) => <span className="font-semibold text-emerald-600">~{l.updated}</span>
    },
    {
      key: "unmatched",
      header: "Unmatched",
      align: "right",
      cell: (l) => (
        <span className={l.unmatched > 0 ? "font-semibold text-amber-600" : "text-admin-mute"}>
          {l.unmatched}
        </span>
      )
    },
    {
      key: "duration",
      header: "Thời gian",
      align: "right",
      hideOnMobile: true,
      cell: (l) => (
        <span className="font-mono text-xs text-admin-mute">
          {l.durationMs ? `${(l.durationMs / 1000).toFixed(1)}s` : "—"}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reconciliation"
        title="Đối soát doanh thu"
        subtitle={
          <span>
            Lần thành công cuối:{" "}
            <span className="font-medium text-admin-ink">
              {lastSuccess ? dateFmt.format(new Date(lastSuccess.startedAt)) : "—"}
            </span>
            {lastFailure ? (
              <>
                {" · "}
                <span className="text-rose-600">
                  Lỗi gần nhất: {dateFmt.format(new Date(lastFailure.startedAt))}
                </span>
              </>
            ) : null}
          </span>
        }
        actions={
          <form action={runReconciliationNowAction}>
            <AdminButton type="submit" size="md">
              ▶ Chạy reconcile ngay
            </AdminButton>
          </form>
        }
      />

      <div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(l) => l.id}
          caption={
            <>
              Tổng: <span className="font-semibold text-admin-ink">{logs.length}</span> lượt chạy
              (tối đa 100)
            </>
          }
          emptyState="Chưa có lượt chạy nào — chờ cron 30 phút hoặc bấm Chạy ngay."
        />
        <div className="rounded-b-xl border-x border-b border-admin-line bg-admin-surface">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            buildHref={buildHref}
            total={logs.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>
    </div>
  );
}
