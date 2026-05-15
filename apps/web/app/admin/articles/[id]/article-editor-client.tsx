"use client";

import type React from "react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { updateArticleAction } from "../../actions";

interface ToolOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  toolName: string;
}

export interface ArticleEditorInitial {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
  toolId: string | null;
  productIds: string[];
  hasBlocks?: boolean;
  coverImage?: string | null;
}

interface Props {
  initial: ArticleEditorInitial;
  tools: ToolOption[];
  products: ProductOption[];
}

export function ArticleEditorClient({ initial, tools, products }: Props): React.ReactElement {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [body, setBody] = useState(initial.body);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    try {
      await updateArticleAction(formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-2xl border border-admin-line bg-admin-surface p-6"
    >
      <input type="hidden" name="id" value={initial.id} />

      {initial.hasBlocks ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Bài này dùng blocks JSON</strong> làm source-of-truth khi render storefront.
          Chỉnh sửa textarea Markdown bên dưới <strong>KHÔNG</strong> đổi nội dung public — chỉ
          dùng làm fallback SEO. Để chỉnh nội dung thật, mở Prompt Studio sửa prompt rồi sinh lại
          bài, hoặc chờ tính năng block-level editor (Iter 2).
        </div>
      ) : null}

      {initial.coverImage ? (
        <div className="flex items-center gap-3 rounded-lg border border-admin-line bg-canvas p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={initial.coverImage}
            alt="Cover"
            className="size-16 rounded object-cover"
          />
          <div className="text-xs text-admin-mute">
            <p className="font-semibold text-admin-ink">Cover image (auto-pick)</p>
            <p className="mt-0.5 break-all">{initial.coverImage}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiêu đề" htmlFor="title" hint="60–70 ký tự cho SEO tốt.">
          <input
            id="title"
            name="title"
            defaultValue={initial.title}
            required
            className={input}
          />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="URL bài: /blog/<slug>">
          <input id="slug" name="slug" defaultValue={initial.slug} required className={input} />
        </Field>
      </div>

      <Field label="Excerpt" htmlFor="excerpt" hint="Hiển thị ở card blog list. 140–160 ký tự.">
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={initial.excerpt ?? ""}
          className={input}
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-admin-ink">Nội dung (Markdown)</label>
          <div className="flex rounded-lg border border-admin-line p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("edit")}
              className={`rounded px-3 py-1 font-medium ${
                tab === "edit" ? "bg-admin-ink text-white" : "text-admin-mute hover:text-admin-ink"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`rounded px-3 py-1 font-medium ${
                tab === "preview" ? "bg-admin-ink text-white" : "text-admin-mute hover:text-admin-ink"
              }`}
            >
              Preview
            </button>
          </div>
        </div>
        {tab === "edit" ? (
          <textarea
            name="body"
            rows={20}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className={`${input} font-mono text-[13px] leading-6`}
          />
        ) : (
          <>
            <input type="hidden" name="body" value={body} />
            <div className="prose prose-slate max-w-none rounded-lg border border-admin-line bg-canvas p-5 prose-headings:font-semibold prose-h2:text-2xl prose-h3:text-xl prose-a:text-brand-700 prose-strong:text-ink">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta title (SEO)" htmlFor="metaTitle" hint="≤ 60 ký tự. Có thể khác title hiển thị.">
          <input
            id="metaTitle"
            name="metaTitle"
            defaultValue={initial.metaTitle ?? ""}
            className={input}
          />
        </Field>
        <Field label="Meta description (SEO)" htmlFor="metaDescription" hint="≤ 160 ký tự.">
          <textarea
            id="metaDescription"
            name="metaDescription"
            rows={2}
            defaultValue={initial.metaDescription ?? ""}
            className={input}
          />
        </Field>
      </div>

      <Field label="Tool gắn kèm" htmlFor="toolId">
        <select id="toolId" name="toolId" defaultValue={initial.toolId ?? ""} className={input}>
          <option value="">— Không gắn —</option>
          {tools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <label className="block text-sm font-medium text-admin-ink">Sản phẩm liên quan</label>
        <p className="mt-0.5 text-xs text-admin-mute">
          Hiển thị card ở cuối bài. Tick lại để cập nhật.
        </p>
        <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-admin-line bg-canvas p-3">
          {products.map((product) => (
            <label
              key={product.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-admin-subtle"
            >
              <input
                type="checkbox"
                name="productIds"
                value={product.id}
                defaultChecked={initial.productIds.includes(product.id)}
              />
              <span className="text-admin-ink">{product.name}</span>
              <span className="text-xs text-admin-mute">— {product.toolName}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-admin-line pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-admin-line bg-admin-surface px-4 py-2 text-sm font-semibold text-admin-ink transition hover:bg-admin-subtle disabled:opacity-50"
        >
          {pending ? "Đang lưu..." : "Lưu chỉnh sửa"}
        </button>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20";

function Field({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-admin-ink">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-admin-mute">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
