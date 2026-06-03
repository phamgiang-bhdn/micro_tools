"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, Send, Archive, Trash2, BarChart3 } from "lucide-react";
import {
  DataTable,
  RowActions,
  StatusPill,
  type ColumnDef
} from "../../../components/admin/ui";
import { publishToolAction, archiveToolAction, deleteToolAction } from "../actions";

export interface ToolRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  nicheId: string;
  niche?: { slug: string; name: string; status: "ACTIVE" | "INACTIVE" } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number; clickLogs: number };
}

interface ToolsTableProps {
  rows: ToolRow[];
  niches: { id: string; slug: string; name: string; status: string }[];
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function statusPill(status: ToolRow["status"]): React.ReactElement {
  if (status === "PUBLISHED") return <StatusPill tone="success" dot>Published</StatusPill>;
  if (status === "DRAFT") return <StatusPill tone="neutral" dot>Draft</StatusPill>;
  return <StatusPill tone="warning" dot>Archived</StatusPill>;
}

export function ToolsTable({ rows, niches }: ToolsTableProps): React.ReactElement {
  const router = useRouter();
  const nicheById = React.useMemo(() => {
    const m = new Map<string, { slug: string; name: string; status: string }>();
    for (const n of niches) m.set(n.id, n);
    return m;
  }, [niches]);

  const handlePublish = async (id: string): Promise<void> => {
    if (!window.confirm("Publish tool này lên storefront công khai?")) return;
    const fd = new FormData();
    fd.set("id", id);
    try {
      await publishToolAction(fd);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Publish thất bại");
    }
  };

  const handleArchive = async (id: string): Promise<void> => {
    if (!window.confirm("Archive (ẩn khỏi storefront)?")) return;
    const fd = new FormData();
    fd.set("id", id);
    try {
      await archiveToolAction(fd);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Archive thất bại");
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("Xoá tool VĨNH VIỄN? Chỉ xoá được khi chưa có session.")) return;
    const fd = new FormData();
    fd.set("id", id);
    try {
      await deleteToolAction(fd);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xoá thất bại");
    }
  };

  const columns: ColumnDef<ToolRow>[] = [
    {
      key: "name",
      header: "Tên",
      cell: (t) => {
        const niche = t.niche ?? nicheById.get(t.nicheId);
        return (
          <div className="min-w-0">
            <Link
              href={`/admin/tools/${t.id}`}
              className="font-medium text-admin-ink hover:text-admin-accent"
            >
              {t.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-admin-mute">
              <span className="font-mono">/ai/{t.slug}</span>
              {niche && (
                <>
                  <span>·</span>
                  <span>{niche.name}</span>
                  {niche.status !== "ACTIVE" && (
                    <StatusPill tone="warning">Niche INACTIVE</StatusPill>
                  )}
                </>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => statusPill(t.status)
    },
    {
      key: "sessions",
      header: "Sessions",
      align: "right",
      hideOnMobile: true,
      cell: (t) => (
        <span className="font-mono text-xs text-admin-ink">
          {t._count?.sessions?.toLocaleString("vi-VN") ?? 0}
        </span>
      )
    },
    {
      key: "clicks",
      header: "Clicks",
      align: "right",
      hideOnMobile: true,
      cell: (t) => (
        <span className="font-mono text-xs text-admin-ink">
          {t._count?.clickLogs?.toLocaleString("vi-VN") ?? 0}
        </span>
      )
    },
    {
      key: "updated",
      header: "Cập nhật",
      align: "right",
      hideOnMobile: true,
      cell: (t) => (
        <span className="font-mono text-xs text-admin-mute">
          {dateFmt.format(new Date(t.updatedAt))}
        </span>
      )
    },
    {
      key: "_actions",
      header: "",
      align: "right",
      width: "44px",
      noTruncate: true,
      cell: (t) => (
        <RowActions
          items={[
            {
              label: "Sửa",
              href: `/admin/tools/${t.id}`,
              icon: <Eye className="size-3.5" />
            },
            {
              label: "Analytics",
              href: `/admin/tools/${t.id}/analytics`,
              icon: <BarChart3 className="size-3.5" />
            },
            {
              label: "Preview public",
              href: `/ai/${t.slug}`,
              icon: <ExternalLink className="size-3.5" />,
              target: "_blank"
            },
            ...(t.status !== "PUBLISHED"
              ? [
                  {
                    label: "Publish",
                    icon: <Send className="size-3.5" />,
                    onSelect: () => void handlePublish(t.id)
                  }
                ]
              : []),
            ...(t.status !== "ARCHIVED"
              ? [
                  {
                    label: "Archive",
                    icon: <Archive className="size-3.5" />,
                    onSelect: () => void handleArchive(t.id)
                  }
                ]
              : []),
            {
              label: "Xoá",
              icon: <Trash2 className="size-3.5" />,
              tone: "danger",
              onSelect: () => void handleDelete(t.id)
            }
          ]}
        />
      )
    }
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(t) => t.id}
      empty={
        <div className="py-8 text-center text-sm text-admin-mute">
          Chưa có Tool nào.{" "}
          <Link href="/admin/tools/new" className="font-medium text-admin-accent hover:underline">
            Tạo Tool đầu tiên →
          </Link>
        </div>
      }
    />
  );
}
