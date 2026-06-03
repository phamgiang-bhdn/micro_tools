import type React from "react";
import Link from "next/link";
import { Mail, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  adminGet,
  FilterBar,
  ListPageShell,
  NativeFilterSelect,
  StatusPill
} from "../../../../components/admin/ui";
import { DripFlushButton } from "./drip-flush-button";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Pending" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" }
];

interface DripRow {
  id: string;
  email: string;
  quizSessionId: string | null;
  toolId: string | null;
  productId: string | null;
  dripType: string;
  scheduledFor: string;
  sentAt: string | null;
  status: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
  payload: { productName?: string; nicheName?: string; shareSlug?: string } | null;
  errorReason: string | null;
  createdAt: string;
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

function statusPill(s: DripRow["status"]): React.ReactElement {
  if (s === "SENT") return <StatusPill tone="success">Sent</StatusPill>;
  if (s === "PENDING") return <StatusPill tone="neutral">Pending</StatusPill>;
  if (s === "FAILED") return <StatusPill tone="danger">Failed</StatusPill>;
  return <StatusPill tone="warning">Cancelled</StatusPill>;
}

export default async function EmailDripPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { status = "" } = await searchParams;
  const rows = await adminGet<DripRow[]>(
    `/admin/tools/email-drip${status ? `?status=${status}` : ""}`
  );

  const total = rows.length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const due = rows.filter((r) => r.status === "PENDING" && new Date(r.scheduledFor) <= new Date())
    .length;
  const sent = rows.filter((r) => r.status === "SENT").length;
  const failed = rows.filter((r) => r.status === "FAILED").length;

  return (
    <ListPageShell
      eyebrow="Story 6.5 — Post-click drip"
      title="Email drip queue"
      subtitle={
        <span>
          Auto-enqueue khi user click affiliate có email. Cron 9h sáng flush PENDING due.{" "}
          {!process.env.RESEND_API_KEY && (
            <span className="font-medium text-orange-600">
              ⚠ Chưa set RESEND_API_KEY → drip chỉ log to console.
            </span>
          )}
        </span>
      }
      actions={<DripFlushButton />}
      overview={[
        { label: "Tổng (period)", value: total.toLocaleString("vi-VN"), icon: <Mail className="size-4" /> },
        {
          label: "Pending due ngay",
          value: due.toLocaleString("vi-VN"),
          tone: due > 0 ? "warning" : "neutral",
          icon: <Clock className="size-4" />
        },
        {
          label: "Sent",
          value: sent.toLocaleString("vi-VN"),
          tone: "success",
          icon: <CheckCircle2 className="size-4" />
        },
        {
          label: "Failed",
          value: failed.toLocaleString("vi-VN"),
          tone: failed > 0 ? "danger" : "neutral",
          icon: <AlertTriangle className="size-4" />
        }
      ]}
      filter={
        <FilterBar resetHref="/admin/tools/email-drip">
          <NativeFilterSelect
            label="Status"
            name="status"
            defaultValue={status}
            options={STATUS_OPTIONS}
          />
        </FilterBar>
      }
      table={
        <div className="overflow-x-auto rounded-2xl border border-admin-line bg-admin-surface">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-admin-mute">
              Chưa có drip nào trong queue.{" "}
              <Link href="/admin/tools" className="text-admin-accent hover:underline">
                ← Quay lại Tool list
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-admin-line bg-admin-bg text-xs uppercase tracking-wide text-admin-mute">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Scheduled</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-admin-line last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-admin-ink">{r.email}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="rounded-full bg-admin-bg px-2 py-0.5 font-mono text-admin-ink">
                        {r.dripType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-admin-mute">
                      {r.payload?.productName ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-admin-mute">
                      {dateFmt.format(new Date(r.scheduledFor))}
                    </td>
                    <td className="px-3 py-2">{statusPill(r.status)}</td>
                    <td className="px-3 py-2 text-xs text-admin-mute">
                      {r.errorReason ? (
                        <span className="text-red-600" title={r.errorReason}>
                          {r.errorReason.slice(0, 40)}
                        </span>
                      ) : r.sentAt ? (
                        <span>Sent {dateFmt.format(new Date(r.sentAt))}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      }
    />
  );
}
