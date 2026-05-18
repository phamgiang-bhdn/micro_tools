import type React from "react";
import {
  adminGet,
  DataTable,
  PageHeader,
  Pagination,
  StatusPill,
  paginateRows,
  type ColumnDef
} from "../../../components/admin/ui";
import { RunCrawlerButton } from "./run-crawler-button";

export const dynamic = "force-dynamic";

interface CrawlerLogRow {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  passedFilter: number;
  created: number;
  updated: number;
  skipped: number;
  success: boolean;
  errorReason: string | null;
  durationMs: number | null;
  triggeredBy: string | null;
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

export default async function CrawlerLogsPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { page = "1" } = await searchParams;
  const logs = await adminGet<CrawlerLogRow[]>("/admin/crawler/logs?limit=200");
  const lastSuccess = logs.find((l) => l.success);
  const lastFailure = logs.find((l) => !l.success && l.finishedAt);

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const { items, totalPages, safePage } = paginateRows(logs, pageNum, PAGE_SIZE);
  const buildHref = (p: number): string => (p > 1 ? `/admin/crawler-logs?page=${p}` : "/admin/crawler-logs");

  const columns: ColumnDef<CrawlerLogRow>[] = [
    {
      key: "startedAt",
      header: "Bắt đầu",
      cell: (l) => (
        <span className="font-mono text-xs text-admin-ink">{dateFmt.format(new Date(l.startedAt))}</span>
      )
    },
    {
      key: "trigger",
      header: "Trigger",
      hideOnMobile: true,
      cell: (l) => (
        <span className="rounded-full bg-admin-subtle px-2 py-0.5 text-[11px] font-semibold text-admin-mute">
          {l.triggeredBy ?? "—"}
        </span>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (l) =>
        l.finishedAt === null ? (
          <StatusPill tone="info" dot pulse>Đang chạy</StatusPill>
        ) : l.success ? (
          <StatusPill tone="success">✓ Thành công</StatusPill>
        ) : (
          <StatusPill tone="danger" title={l.errorReason ?? ""}>✕ Lỗi</StatusPill>
        )
    },
    {
      key: "fetched",
      header: "Fetched",
      align: "right",
      hideOnMobile: true,
      cell: (l) => <span className="text-admin-ink">{l.fetched}</span>
    },
    {
      key: "passed",
      header: "Qua filter",
      align: "right",
      hideOnMobile: true,
      cell: (l) => <span className="text-admin-ink">{l.passedFilter}</span>
    },
    {
      key: "created",
      header: "Mới",
      align: "right",
      cell: (l) => <span className="font-semibold text-emerald-600">+{l.created}</span>
    },
    {
      key: "updated",
      header: "Cập nhật",
      align: "right",
      hideOnMobile: true,
      cell: (l) => <span className="text-admin-mute">~{l.updated}</span>
    },
    {
      key: "duration",
      header: "Thời gian",
      align: "right",
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
        eyebrow="Vận hành"
        title="Nhật ký lấy sản phẩm"
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
        actions={<RunCrawlerButton />}
      />

      <div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(l) => l.id}
          caption={
            <>
              Tổng: <span className="font-semibold text-admin-ink">{logs.length}</span> lượt chạy (tối đa 200)
            </>
          }
          emptyState="Chưa có lượt chạy nào."
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
