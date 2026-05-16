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

export interface CategoryWithProducts {
  id: string;
  slug: string;
  name: string;
  products: Array<{ id: string; name: string }>;
}

interface ArticlesTableProps {
  rows: ArticleAdminSummary[];
  categories: CategoryWithProducts[];
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const BULK_ACTIONS: Array<{ value: "publish" | "archive" | "delete"; label: string; confirm: string }> = [
  { value: "publish", label: "Đăng tất cả", confirm: "Đăng tất cả các bài đã chọn lên blog?" },
  { value: "archive", label: "Lưu trữ", confirm: "Chuyển các bài đã chọn vào lưu trữ?" },
  { value: "delete", label: "Xoá vĩnh viễn", confirm: "Xoá VĨNH VIỄN các bài đã chọn? Không thể hoàn tác." }
];

const EMPTY_GENERATE: ArticleGenerateInput = {
  type: "BUYING_GUIDE",
  topic: "",
  categoryId: undefined,
  productRef: undefined,
  pinnedProductIds: []
};

export function ArticlesTable({
  rows,
  categories
}: ArticlesTableProps): React.ReactElement {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = React.useState<string>("");
  const [bulkPending, setBulkPending] = React.useState(false);

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  };

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    const cfg = BULK_ACTIONS.find((b) => b.value === bulkAction);
    if (cfg && !window.confirm(`${cfg.confirm}\n\nÁp dụng cho ${selected.size} bài.`)) return;
    const fd = new FormData();
    fd.set("action", bulkAction);
    for (const id of selected) fd.append("ids", id);
    setBulkPending(true);
    try {
      await bulkArticleAction(fd);
      setSelected(new Set());
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
    if (data.categoryId) fd.set("categoryId", data.categoryId);
    if (data.productRef) fd.set("productRef", data.productRef);
    for (const id of data.pinnedProductIds) fd.append("pinnedProductIds", id);
    // generateArticleAction redirects → trang sẽ tự navigate. Dialog không cần đóng tay.
    await generateArticleAction(fd);
    return { ok: true };
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const columns: ColumnDef<ArticleAdminSummary>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Chọn tất cả"
          checked={allSelected}
          onChange={(e) => toggleAll(e.currentTarget.checked)}
          className="size-4 rounded border-admin-line text-admin-accent"
        />
      ),
      width: "40px",
      cell: (a) => (
        <input
          type="checkbox"
          aria-label={`Chọn bài ${a.title}`}
          checked={selected.has(a.id)}
          onChange={(e) => toggleOne(a.id, e.currentTarget.checked)}
          className="size-4 rounded border-admin-line text-admin-accent"
        />
      )
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
      key: "category",
      header: "Danh mục",
      hideOnMobile: true,
      cell: (a) => <span className="text-xs text-admin-mute">{a.category?.name ?? "—"}</span>
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
          categories={categories}
          onSubmit={handleGenerate}
        />
      </>
    );
  }

  return (
    <>
      <div className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-admin-mute">
              Đã chọn:{" "}
              <span className="font-semibold text-admin-ink">{selected.size}</span> / {rows.length}
            </span>
            {selected.size > 0 ? (
              <>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="h-8 rounded-md border border-admin-line bg-admin-surface px-2 pr-7 text-xs text-admin-ink"
                >
                  <option value="">Chọn hành động</option>
                  {BULK_ACTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <AdminButton
                  size="sm"
                  variant={bulkAction === "delete" ? "danger" : "primary"}
                  loading={bulkPending}
                  disabled={!bulkAction}
                  onClick={handleBulk}
                >
                  Áp dụng
                </AdminButton>
              </>
            ) : null}
          </div>
          <AdminButton size="sm" iconLeft={<Sparkles />} onClick={() => setCreateOpen(true)}>
            Tạo bài viết
          </AdminButton>
        </div>
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
        categories={categories}
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
  categories: CategoryWithProducts[];
  onSubmit: (data: ArticleGenerateInput) => Promise<{ ok: boolean }>;
}

function GenerateDialog({
  open,
  onOpenChange,
  categories,
  onSubmit
}: GenerateDialogProps): React.ReactElement {
  const categoryOptions = React.useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
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
      <CategoryProductFields categories={categories} categoryOptions={categoryOptions} />
      <Tooltip content="Pin tối đa 5 sản phẩm để AI ưu tiên đưa vào shortlist (chỉ với Cẩm nang).">
        <p className="sm:col-span-2 text-[11px] text-admin-mute">
          💡 Nếu chọn danh mục cho Cẩm nang, bạn có thể pin sản phẩm cụ thể ở trang chi tiết sau khi sinh.
        </p>
      </Tooltip>
    </FormDialog>
  );
}

function CategoryProductFields({
  categories,
  categoryOptions
}: {
  categories: CategoryWithProducts[];
  categoryOptions: Array<{ value: string; label: string }>;
}): React.ReactElement {
  // useFormContext sẵn có vì wrapper FormProvider trong FormDialog.
  const { watch } = useFormContext<ArticleGenerateInput>();
  const type = watch("type");
  return (
    <>
      <ControlledSelectField<ArticleGenerateInput>
        name="categoryId"
        label={`Danh mục ${type === "BUYING_GUIDE" ? "(bắt buộc)" : "(tuỳ chọn)"}`}
        options={categoryOptions}
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

