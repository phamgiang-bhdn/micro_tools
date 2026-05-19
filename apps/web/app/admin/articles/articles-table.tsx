"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import {
  Plus,
  ExternalLink,
  CheckCircle2,
  Archive,
  Copy,
  Sparkles
} from "lucide-react";
import {
  AdminButton,
  AdminEmptyState,
  DataTable,
  FormDialog,
  RowActions,
  StatusPill,
  Tooltip,
  ControlledTextField,
  ControlledSelectField,
  type ColumnDef
} from "../../../components/admin/ui";
import {
  ARTICLE_STATUS_META,
  ARTICLE_TYPE_META,
  ARTICLE_TYPE_OPTIONS
} from "../../../lib/admin/constants";
import {
  articleGenerateSchema,
  type ArticleGenerateInput
} from "../../../lib/admin/schemas";
import type { ArticleAdminSummary } from "../../../lib/types";
import {
  archiveArticleAction,
  deleteArticleAction,
  duplicateArticleAction,
  generateArticleAction,
  publishArticleAction,
  bulkArticleAction
} from "../actions";
import {
  BulkBar,
  selectionColumnRenderers,
  buildBulkConfirmMessage,
  type BulkAction
} from "../../../components/admin/bulk-bar";
import { useBulkSelection } from "../../../components/admin/use-bulk-selection";

export interface NicheWithProducts {
  id: string;
  slug: string;
  name: string;
  products: Array<{ id: string; name: string }>;
}

interface ArticlesTableProps {
  rows: ArticleAdminSummary[];
  niches: NicheWithProducts[];
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const ARTICLE_BULK_ACTIONS: BulkAction[] = [
  { value: "publish", label: "Đăng bài", confirm: "Đăng các bài đã chọn lên storefront?" },
  { value: "archive", label: "Lưu trữ", confirm: "Chuyển các bài đã chọn về ARCHIVED?" },
  {
    value: "delete",
    label: "Xoá bài",
    confirm: "Xoá các bài đã chọn? Không thể hoàn tác.",
    tone: "danger"
  }
];

const EMPTY_GENERATE: ArticleGenerateInput = {
  type: "BUYING_GUIDE",
  topic: "",
  nicheId: undefined,
  productRef: undefined,
  pinnedProductIds: []
};

export function ArticlesTable({
  rows,
  niches
}: ArticlesTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);

  // ---- Bulk selection ----
  const visibleIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useBulkSelection(visibleIds);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  const selectColumn = React.useMemo<ColumnDef<ArticleAdminSummary>>(() => {
    const r = selectionColumnRenderers<ArticleAdminSummary>({
      allSelected: selection.allSelected,
      toggleAll: selection.toggleAll,
      isSelected: selection.isSelected,
      toggleOne: selection.toggleOne,
      rowLabel: (row) => row.title
    });
    return { key: "_select", header: r.header, cell: r.cell, width: "44px", noTruncate: true };
  }, [selection.allSelected, selection.toggleAll, selection.isSelected, selection.toggleOne]);

  const applyBulk = async (): Promise<void> => {
    if (!bulkAction || selection.count === 0) return;
    const cfg = ARTICLE_BULK_ACTIONS.find((a) => a.value === bulkAction);
    const confirmMsg = buildBulkConfirmMessage(cfg, selection.count);
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBulkPending(true);
    try {
      const fd = new FormData();
      for (const id of selection.selected) fd.append("ids", id);
      fd.set("action", bulkAction);
      fd.set("reviewer", "admin");
      await bulkArticleAction(fd);
      selection.clear();
      setBulkAction("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk action thất bại");
    } finally {
      setBulkPending(false);
    }
  };

  const callSingle = async (action: typeof publishArticleAction, id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("reviewer", "admin");
    await action(fd);
    router.refresh();
  };

  const callDelete = async (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    await deleteArticleAction(fd);
    router.refresh();
  };

  const handleGenerate = async (data: ArticleGenerateInput) => {
    const fd = new FormData();
    fd.set("type", data.type);
    fd.set("topic", data.topic);
    if (data.nicheId) fd.set("nicheId", data.nicheId);
    if (data.productRef) fd.set("productRef", data.productRef);
    for (const id of data.pinnedProductIds) fd.append("pinnedProductIds", id);
    // generateArticleAction redirects → trang sẽ tự navigate. Dialog không cần đóng tay.
    await generateArticleAction(fd);
    return { ok: true };
  };

  const columns: ColumnDef<ArticleAdminSummary>[] = [
    selectColumn,
    {
      key: "title",
      header: "Tiêu đề",
      cell: (a) => (
        <a
          href={`/admin/articles/${a.id}`}
          className="block min-w-0"
        >
          <div className="line-clamp-1 font-medium text-admin-ink hover:text-admin-accent">{a.title}</div>
          {a.excerpt ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-admin-mute">{a.excerpt}</p>
          ) : null}
        </a>
      )
    },
    {
      key: "type",
      header: "Loại",
      hideOnMobile: true,
      cell: (a) => <span className="text-xs text-admin-mute">{ARTICLE_TYPE_META[a.type].label}</span>
    },
    {
      key: "niche",
      header: "Ngành hàng",
      hideOnMobile: true,
      cell: (a) => <span className="text-xs text-admin-mute">{a.niche?.name ?? "—"}</span>
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (a) => {
        const meta = ARTICLE_STATUS_META[a.status];
        return (
          <StatusPill tone={meta.tone} dot pulse={a.status === "GENERATING"}>
            {meta.label}
          </StatusPill>
        );
      }
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      cell: (a) => (
        <span className="text-xs text-admin-mute">{dateFmt.format(new Date(a.updatedAt))}</span>
      )
    },
    {
      key: "actions",
      header: <span className="sr-only">Thao tác</span>,
      align: "right",
      width: "120px",
      cell: (a) => {
        const more = buildMoreActions(a, callSingle, router);
        return (
          <RowActions
            editHref={`/admin/articles/${a.id}`}
            editLabel="Sửa bài"
            onDelete={() => callDelete(a.id)}
            deleteConfirm={`Xoá bài "${a.title}"? Không thể hoàn tác.`}
            more={more}
          />
        );
      }
    }
  ];

  if (rows.length === 0) {
    return (
      <>
        <AdminEmptyState
          title="Không có bài viết khớp bộ lọc"
          description="Thử bỏ lọc hoặc bấm 'Tạo bài viết' để tạo bài mới — AI sẽ sinh bản nháp."
          action={
            <AdminButton size="md" iconLeft={<Sparkles />} onClick={() => setCreateOpen(true)}>
              Tạo bài viết
            </AdminButton>
          }
        />
        <GenerateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          niches={niches}
          onSubmit={handleGenerate}
        />
      </>
    );
  }

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <BulkBar
          selectedCount={selection.count}
          totalCount={rows.length}
          actions={ARTICLE_BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={applyBulk}
          pending={bulkPending}
          rightSlot={
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-admin-mute">{rows.length} bài viết</span>
              <AdminButton size="sm" iconLeft={<Sparkles />} onClick={() => setCreateOpen(true)}>
                Tạo bài viết
              </AdminButton>
            </div>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          emptyState="Không có bài viết."
          isRowHighlighted={(a) => selection.isSelected(a.id)}
        />
      </div>

      <GenerateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        niches={niches}
        onSubmit={handleGenerate}
      />
    </>
  );
}

function buildMoreActions(
  a: ArticleAdminSummary,
  callSingle: (action: typeof publishArticleAction, id: string) => Promise<void>,
  router: ReturnType<typeof useRouter>
): Array<{
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void | Promise<void>;
  tone?: "default" | "danger";
}> {
  const items: Array<{
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void | Promise<void>;
    tone?: "default" | "danger";
  }> = [];
  if (a.status === "PUBLISHED") {
    items.push({
      label: "Xem live",
      icon: <ExternalLink />,
      onSelect: () => {
        window.open(`/blog/${a.slug}`, "_blank", "noopener,noreferrer");
      }
    });
  }
  if (a.status !== "PUBLISHED" && a.status !== "GENERATING") {
    items.push({
      label: "Đăng bài",
      icon: <CheckCircle2 />,
      onSelect: () => callSingle(publishArticleAction, a.id)
    });
  }
  if (a.status !== "ARCHIVED" && a.status !== "GENERATING") {
    items.push({
      label: "Lưu trữ",
      icon: <Archive />,
      onSelect: () => callSingle(archiveArticleAction, a.id)
    });
  }
  items.push({
    label: "Nhân bản",
    icon: <Copy />,
    onSelect: async () => {
      const fd = new FormData();
      fd.set("id", a.id);
      await duplicateArticleAction(fd);
      router.refresh();
    }
  });
  return items;
}

interface GenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niches: NicheWithProducts[];
  onSubmit: (data: ArticleGenerateInput) => Promise<{ ok: boolean }>;
}

function GenerateDialog({
  open,
  onOpenChange,
  niches,
  onSubmit
}: GenerateDialogProps): React.ReactElement {
  const nicheOptions = React.useMemo(
    () => niches.map((c) => ({ value: c.id, label: c.name })),
    [niches]
  );

  return (
    <FormDialog<ArticleGenerateInput>
      open={open}
      onOpenChange={onOpenChange}
      title="Tạo bài viết AI"
      size="xl"
      schema={articleGenerateSchema}
      defaultValues={EMPTY_GENERATE}
      resetOnOpen
      onSubmit={onSubmit}
      submitLabel="Sinh bản nháp"
    >
      <ControlledSelectField<ArticleGenerateInput>
        name="type"
        label="Loại bài"
        options={ARTICLE_TYPE_OPTIONS}
        required
        fullRow
        hint="Cẩm nang: AI shortlist sản phẩm trong danh mục. Review: bài về 1 sản phẩm cụ thể."
      />
      <ControlledTextField<ArticleGenerateInput>
        name="topic"
        label="Chủ đề"
        required
        fullRow
        placeholder="Robot hút bụi cho căn hộ có thú cưng"
        hint="Mô tả góc nhìn của bài để AI viết đúng tone."
      />
      <NicheProductFields niches={niches} nicheOptions={nicheOptions} />
      <Tooltip content="Pin tối đa 5 sản phẩm để AI ưu tiên đưa vào shortlist (chỉ với Cẩm nang).">
        <p className="sm:col-span-2 text-[11px] text-admin-mute">
          💡 Nếu chọn niche cho Cẩm nang, bạn có thể pin sản phẩm cụ thể ở trang chi tiết sau khi sinh.
        </p>
      </Tooltip>
    </FormDialog>
  );
}

function NicheProductFields({
  niches,
  nicheOptions
}: {
  niches: NicheWithProducts[];
  nicheOptions: Array<{ value: string; label: string }>;
}): React.ReactElement {
  // useFormContext sẵn có vì wrapper FormProvider trong FormDialog.
  const { watch } = useFormContext<ArticleGenerateInput>();
  const type = watch("type");
  return (
    <>
      <ControlledSelectField<ArticleGenerateInput>
        name="nicheId"
        label={`Niche ${type === "BUYING_GUIDE" ? "(bắt buộc)" : "(tuỳ chọn)"}`}
        options={nicheOptions}
        allowEmpty
        emptyLabel="— Không gắn —"
        fullRow={type === "REVIEW"}
      />
      {type === "REVIEW" ? (
        <ControlledTextField<ArticleGenerateInput>
          name="productRef"
          label="Sản phẩm (slug / URL / tên)"
          required
          fullRow
          placeholder="ecovacs-deebot-x2-omni hoặc URL"
          hint="AI sẽ tìm match trong DB. Cần exact để khớp sản phẩm publish."
        />
      ) : null}
    </>
  );
}

