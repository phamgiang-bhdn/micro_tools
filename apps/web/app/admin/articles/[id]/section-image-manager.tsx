"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X, ExternalLink, Save, Trash2, Pencil } from "lucide-react";
import { AdminButton } from "../../../../components/admin/ui";

type ImageBlockShape = {
  type: "image";
  src?: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  attributionUrl?: string;
  width?: number;
  height?: number;
};

type AnyBlock = { type: string } & Record<string, unknown>;

interface Props {
  blocks: AnyBlock[];
  onBlocksChange: (next: AnyBlock[]) => void;
}

/**
 * Panel quản lý ảnh trong section — pattern dùng:
 * - List mỗi image block hiện có: thumb 80px + URL rút gọn + nút Đổi/Xoá.
 * - Nút "Thêm ảnh mới" mở dialog paste URL + alt/caption.
 * - "Đổi ảnh" reuse dialog tương tự, pre-fill data hiện tại.
 *
 * Mọi thay đổi gọi onBlocksChange ngay (parent giữ state + Lưu chung qua nút Save chính).
 * Không gọi server action trực tiếp — để workflow Save consistent với edit khác.
 */
export function SectionImageManager({ blocks, onBlocksChange }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null); // null = thêm mới
  const [form, setForm] = useState<ImageBlockShape>({ type: "image" });

  // Tìm tất cả image block + index của chúng trong blocks gốc (để patch chính xác).
  const imageBlocks: Array<{ block: ImageBlockShape; idx: number }> = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (b?.type === "image") imageBlocks.push({ block: b as ImageBlockShape, idx: i });
  }

  const openAdd = () => {
    setEditIdx(null);
    setForm({ type: "image", src: "", alt: "", caption: "", attribution: "", attributionUrl: "" });
    setDialogOpen(true);
  };

  const openEdit = (idx: number, block: ImageBlockShape) => {
    setEditIdx(idx);
    setForm({ ...block, type: "image" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.src || !form.src.trim()) return;
    const cleaned: ImageBlockShape = {
      type: "image",
      src: form.src.trim(),
      alt: form.alt?.trim() || undefined,
      caption: form.caption?.trim() || undefined,
      attribution: form.attribution?.trim() || undefined,
      attributionUrl: form.attributionUrl?.trim() || undefined
    };
    if (editIdx === null) {
      // Thêm mới — chèn sau prose block đầu tiên (nếu có), không có → cuối.
      const proseIdx = blocks.findIndex((b) => b?.type === "prose");
      const insertAt = proseIdx >= 0 ? proseIdx + 1 : blocks.length;
      const next = [...blocks];
      next.splice(insertAt, 0, cleaned as unknown as AnyBlock);
      onBlocksChange(next);
    } else {
      const next = blocks.map((b, i) => (i === editIdx ? (cleaned as unknown as AnyBlock) : b));
      onBlocksChange(next);
    }
    setDialogOpen(false);
  };

  const handleDelete = (idx: number) => {
    if (!confirm("Xoá ảnh khỏi section này?")) return;
    onBlocksChange(blocks.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-lg border border-admin-line bg-admin-surface">
      <div className="flex items-center justify-between gap-2 border-b border-admin-line px-3 py-2">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-admin-ink">
          <ImagePlus className="size-4 text-primary-600" /> Quản lý ảnh trong phần
          <span className="rounded bg-admin-subtle px-1.5 py-0.5 text-[10.5px] font-normal text-admin-mute">
            {imageBlocks.length} ảnh
          </span>
        </div>
        <AdminButton size="xs" variant="outline" onClick={openAdd}>
          <ImagePlus className="size-3" /> Thêm ảnh
        </AdminButton>
      </div>

      <div className="p-3">
        {imageBlocks.length === 0 ? (
          <p className="text-center text-[12px] text-admin-mute">
            Section này chưa có ảnh. Bấm &quot;Thêm ảnh&quot; để paste URL ảnh từ web (cellphones, tinhte, shopee…).
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {imageBlocks.map(({ block, idx }) => (
              <div key={idx} className="flex gap-2.5 rounded-md border border-admin-line bg-canvas p-2">
                <div className="size-20 shrink-0 overflow-hidden rounded-md border border-line bg-card-soft">
                  {block.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.src} alt={block.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12px] leading-snug text-admin-ink" title={block.src}>
                    {block.caption || block.alt || block.src || "(không caption)"}
                  </p>
                  {block.attribution ? (
                    <p className="mt-1 line-clamp-1 text-[10.5px] text-admin-mute">
                      Ảnh: {block.attribution}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(idx, block)}
                      className="inline-flex items-center gap-1 rounded border border-admin-line bg-admin-surface px-2 py-1 text-[10.5px] font-medium text-admin-ink transition hover:border-admin-accent hover:text-admin-accent"
                    >
                      <Pencil className="size-3" /> Đổi
                    </button>
                    {block.src ? (
                      <a
                        href={block.src}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-admin-line bg-admin-surface px-2 py-1 text-[10.5px] font-medium text-admin-mute transition hover:text-admin-ink"
                        title="Xem ảnh gốc"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="ml-auto inline-flex items-center gap-1 rounded p-1 text-admin-mute transition hover:bg-admin-danger-soft hover:text-admin-danger"
                      title="Xoá ảnh"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogOpen ? (
        <ImageDialog
          form={form}
          isEdit={editIdx !== null}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}

function ImageDialog({
  form,
  isEdit,
  onChange,
  onClose,
  onSave
}: {
  form: ImageBlockShape;
  isEdit: boolean;
  onChange: (patch: Partial<ImageBlockShape>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  // Escape close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const previewOk = !!form.src && /^https?:\/\//.test(form.src);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[14px] font-semibold text-admin-ink">
            {isEdit ? "Đổi ảnh trong phần" : "Thêm ảnh mới"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-admin-mute transition hover:bg-admin-subtle hover:text-admin-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[200px_1fr]">
          {/* Preview */}
          <div className="aspect-square overflow-hidden rounded-md border border-line bg-card-soft">
            {previewOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.src} alt="preview" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[11px] text-admin-mute">
                Paste URL để xem ảnh
              </div>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                URL ảnh *
              </label>
              <input
                type="url"
                value={form.src ?? ""}
                onChange={(e) => onChange({ src: e.target.value })}
                placeholder="https://cdn.tinhte.vn/image.jpg"
                className="mt-1 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none"
                autoFocus
              />
              <p className="mt-1 text-[10.5px] text-admin-mute">
                Mẹo: lấy ảnh từ cellphones, tinhte, genk, shopee — chuột phải ảnh → &quot;Copy image address&quot;.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                  Alt text
                </label>
                <input
                  type="text"
                  value={form.alt ?? ""}
                  onChange={(e) => onChange({ alt: e.target.value })}
                  placeholder="Mô tả ngắn cho SEO"
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                  Caption (hiển thị dưới ảnh)
                </label>
                <input
                  type="text"
                  value={form.caption ?? ""}
                  onChange={(e) => onChange({ caption: e.target.value })}
                  placeholder="VD: Cụm camera 200MP của Redmi Turbo 5"
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                  Nguồn (attribution)
                </label>
                <input
                  type="text"
                  value={form.attribution ?? ""}
                  onChange={(e) => onChange({ attribution: e.target.value })}
                  placeholder="VD: tinhte.vn"
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
                  Link nguồn (clickable)
                </label>
                <input
                  type="url"
                  value={form.attributionUrl ?? ""}
                  onChange={(e) => onChange({ attributionUrl: e.target.value })}
                  placeholder="https://tinhte.vn/bai-viet/..."
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-surface px-3 py-2 text-[12.5px] text-admin-ink focus:border-admin-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-admin-surface px-4 py-3">
          <AdminButton variant="ghost" size="sm" onClick={onClose}>
            Huỷ
          </AdminButton>
          <AdminButton variant="primary" size="sm" onClick={onSave} disabled={!previewOk}>
            <Save className="size-3.5" /> {isEdit ? "Lưu" : "Thêm"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
