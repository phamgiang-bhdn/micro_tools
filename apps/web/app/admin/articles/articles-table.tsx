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
  ControlledTextareaField,
  ControlledSelectField,
  type ColumnDef
} from "../../../components/admin/ui";
import {
  BulkBar,
  selectionColumnRenderers,
  buildBulkConfirmMessage,
  type BulkAction
} from "../../../components/admin/bulk-bar";
import { useRowSelection } from "../../../components/admin/use-row-selection";
import {
  ARTICLE_STATUS_META,
  ARTICLE_TYPE_META,
  ARTICLE_TYPE_OPTIONS
} from "../../../lib/admin/constants";
import {
  articleGenerateSchema,
  type ArticleGenerateInput
} from "../../../lib/admin/schemas";
import type {
  ArticleAdminSummary,
  ArticleStatus,
  ArticleType
} from "../../../lib/types";
import {
  archiveArticleAction,
  bulkArticleAction,
  deleteArticleAction,
  duplicateArticleAction,
  generateArticleAction,
  publishArticleAction
} from "../actions";

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

const BULK_ACTIONS: BulkAction[] = [
  { value: "publish", label: "Đăng tất cả", confirm: "Đăng tất cả các bài đã chọn lên blog?" },
  { value: "archive", label: "Lưu trữ", confirm: "Chuyển các bài đã chọn vào lưu trữ?" },
  {
    value: "delete",
    label: "Xoá vĩnh viễn",
    confirm: "Xoá VĨNH VIỄN các bài đã chọn? Không thể hoàn tác.",
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
  const { selected, toggleOne, toggleAll, clear, allSelected } = useRowSelection(rows);
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    const cfg = BULK_ACTIONS.find((b) => b.value === bulkAction);
    const msg = buildBulkConfirmMessage(cfg, selected.size);
    if (msg && !window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("action", bulkAction);
    for (const id of selected) fd.append("ids", id);
    setBulkPending(true);
    try {
      await bulkArticleAction(fd);
      clear();
      setBulkAction("");
      router.refresh();
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

  const sel = selectionColumnRenderers<ArticleAdminSummary>({
    allSelected,
    toggleAll,
    isSelected: (id) => selected.has(id),
    toggleOne,
    rowLabel: (a) => `bài ${a.title}`
  });

  const columns: ColumnDef<ArticleAdminSummary>[] = [
    {
      key: "select",
      header: sel.header,
      width: "40px",
      cell: sel.cell
    },
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
      header: "Niche",
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
          selectedCount={selected.size}
          totalCount={rows.length}
          actions={BULK_ACTIONS}
          action={bulkAction}
          setAction={setBulkAction}
          onApply={handleBulk}
          pending={bulkPending}
          rightSlot={
            <AdminButton size="sm" iconLeft={<Sparkles />} onClick={() => setCreateOpen(true)}>
              Tạo bài viết
            </AdminButton>
          }
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          emptyState="Không có bài viết."
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
      description="AI sẽ sinh bản nháp dựa trên prompt template đang active. Bạn duyệt + chỉnh trước khi publish."
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

