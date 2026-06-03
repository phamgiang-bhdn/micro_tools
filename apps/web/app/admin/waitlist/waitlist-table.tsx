"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  DataTable,
  RowActions,
  StatusPill,
  type ColumnDef
} from "../../../components/admin/ui";
import { deleteWaitlistEntryAction } from "../actions";

export interface WaitlistRow {
  id: string;
  email: string;
  nicheId: string | null;
  nicheSlug: string;
  surveyAnswer: string | null;
  source: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
  niche?: { name: string; slug: string; status: "ACTIVE" | "INACTIVE" } | null;
}

interface WaitlistTableProps {
  rows: WaitlistRow[];
  filteredCount: number;
  totalCount: number;
  surveyBreakdown: { answer: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function WaitlistTable({
  rows,
  filteredCount,
  totalCount,
  surveyBreakdown,
  sourceBreakdown
}: WaitlistTableProps): React.ReactElement {
  const router = useRouter();

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Xoá entry này khỏi waitlist?")) return;
    const fd = new FormData();
    fd.set("id", id);
    try {
      await deleteWaitlistEntryAction(fd);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xoá thất bại");
    }
  };

  const columns: ColumnDef<WaitlistRow>[] = [
    {
      key: "email",
      header: "Email",
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-admin-ink">{r.email}</div>
          {r.surveyAnswer && (
            <div className="mt-0.5 text-xs text-admin-mute">↳ {r.surveyAnswer}</div>
          )}
        </div>
      )
    },
    {
      key: "niche",
      header: "Niche",
      hideOnMobile: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-mono text-xs text-admin-ink">{r.nicheSlug}</div>
          {r.niche && r.niche.status !== "ACTIVE" && (
            <StatusPill tone="warning">Niche INACTIVE</StatusPill>
          )}
        </div>
      )
    },
    {
      key: "source",
      header: "Source",
      hideOnMobile: true,
      cell: (r) => (
        <span className="font-mono text-xs text-admin-mute">{r.source ?? "—"}</span>
      )
    },
    {
      key: "notified",
      header: "Notified",
      align: "center",
      hideOnMobile: true,
      cell: (r) =>
        r.notified ? (
          <StatusPill tone="success">Sent</StatusPill>
        ) : (
          <StatusPill tone="neutral">—</StatusPill>
        )
    },
    {
      key: "createdAt",
      header: "Đăng ký",
      align: "right",
      cell: (r) => (
        <span className="font-mono text-xs text-admin-mute">
          {dateFmt.format(new Date(r.createdAt))}
        </span>
      )
    },
    {
      key: "_actions",
      header: "",
      align: "right",
      width: "44px",
      noTruncate: true,
      cell: (r) => (
        <RowActions
          items={[
            {
              label: "Xoá",
              icon: <Trash2 className="size-3.5" />,
              tone: "danger",
              onSelect: () => void handleDelete(r.id)
            }
          ]}
        />
      )
    }
  ];

  return (
    <div className="space-y-4">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        empty={
          <div className="py-8 text-center text-sm text-admin-mute">
            Chưa có signup nào. Share link <code className="font-mono">/coming-soon/[slug]</code> để bắt đầu validate.
          </div>
        }
      />

      <div className="text-xs text-admin-mute">
        Hiện {rows.length} / {filteredCount} (tổng {totalCount})
      </div>

      {surveyBreakdown.length > 0 && (
        <details className="rounded-lg border border-admin-line bg-admin-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium text-admin-ink">
            📊 Survey breakdown ({surveyBreakdown.length} đáp án)
          </summary>
          <ul className="mt-3 space-y-1">
            {surveyBreakdown.map((s) => (
              <li key={s.answer} className="flex items-center justify-between font-mono text-xs">
                <span className="text-admin-ink">{s.answer}</span>
                <span className="text-admin-accent">{s.count}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sourceBreakdown.length > 0 && (
        <details className="rounded-lg border border-admin-line bg-admin-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium text-admin-ink">
            🌐 Source breakdown ({sourceBreakdown.length} kênh)
          </summary>
          <ul className="mt-3 space-y-1">
            {sourceBreakdown.map((s) => (
              <li key={s.source} className="flex items-center justify-between font-mono text-xs">
                <span className="text-admin-ink">{s.source}</span>
                <span className="text-admin-accent">{s.count}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
