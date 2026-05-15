"use client";

import type React from "react";
import { useFormStatus } from "react-dom";
import { useMemo, useState } from "react";
import { generateArticleAction } from "../../actions";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  products: Array<{ id: string; name: string }>;
}

interface Props {
  categories: CategoryOption[];
}

export function NewArticleForm({ categories }: Props): React.ReactElement {
  return (
    <form action={generateArticleAction} className="space-y-5 rounded-2xl border border-admin-line bg-admin-surface p-6">
      <FormBody categories={categories} />
    </form>
  );
}

function FormBody({ categories }: { categories: CategoryOption[] }): React.ReactElement {
  const { pending } = useFormStatus();
  const [type, setType] = useState<"BUYING_GUIDE" | "REVIEW">("BUYING_GUIDE");
  const [categoryId, setCategoryId] = useState<string>("");
  const [pinned, setPinned] = useState<string[]>([]);

  const selectedCategory = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);
  const productsForPin = selectedCategory?.products ?? [];

  return (
    <>
      <fieldset disabled={pending} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-admin-ink">Loại bài</label>
          <p className="mt-0.5 text-xs text-admin-mute">Chọn loại để AI dùng prompt phù hợp.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-line p-3 hover:border-admin-accent has-[input:checked]:border-admin-accent has-[input:checked]:bg-admin-accent-soft">
              <input
                type="radio"
                name="type"
                value="BUYING_GUIDE"
                checked={type === "BUYING_GUIDE"}
                onChange={() => setType("BUYING_GUIDE")}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-admin-ink">Cẩm nang chọn mua</span>
                <span className="block text-xs text-admin-mute">AI tự shortlist sản phẩm trong danh mục. Bắt buộc chọn danh mục.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-line p-3 hover:border-admin-accent has-[input:checked]:border-admin-accent has-[input:checked]:bg-admin-accent-soft">
              <input
                type="radio"
                name="type"
                value="REVIEW"
                checked={type === "REVIEW"}
                onChange={() => setType("REVIEW")}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-admin-ink">Review chi tiết</span>
                <span className="block text-xs text-admin-mute">Bài review 1 sản phẩm cụ thể.</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-admin-ink">
            Chủ đề
          </label>
          <p className="mt-0.5 text-xs text-admin-mute">
            Mô tả cho AI biết góc nhìn của bài. Ví dụ: &quot;Robot hút bụi cho căn hộ có thú cưng&quot;.
          </p>
          <input
            id="topic"
            name="topic"
            required
            minLength={5}
            placeholder={type === "REVIEW" ? "Trải nghiệm sau 1 tháng dùng…" : "Cách chọn máy lọc không khí cho phòng ngủ"}
            className={input}
          />
        </div>

        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-admin-ink">
            Danh mục {type === "BUYING_GUIDE" ? "(bắt buộc)" : "(tuỳ chọn)"}
          </label>
          <p className="mt-0.5 text-xs text-admin-mute">
            AI sẽ chỉ shortlist sản phẩm thuộc danh mục này. Bài sẽ hiện trong filter blog theo danh mục.
          </p>
          <select
            id="categoryId"
            name="categoryId"
            required={type === "BUYING_GUIDE"}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPinned([]);
            }}
            className={`${input} mt-2`}
          >
            <option value="">— Chọn danh mục —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {type === "REVIEW" && (
          <div>
            <label htmlFor="productRef" className="block text-sm font-medium text-admin-ink">
              Sản phẩm review (bắt buộc)
            </label>
            <p className="mt-0.5 text-xs text-admin-mute">
              Gõ tên, slug, hoặc paste URL affiliate. Gợi ý từ DB hiện ra khi gõ.
            </p>
            <input
              id="productRef"
              name="productRef"
              required
              list="product-suggestions"
              placeholder="Roborock S8 Pro Ultra…"
              className={`${input} mt-2`}
            />
            <datalist id="product-suggestions">
              {(selectedCategory?.products ?? categories.flatMap((c) => c.products)).map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        )}

        {type === "BUYING_GUIDE" && selectedCategory && productsForPin.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-admin-ink">
              Pin sản phẩm (tuỳ chọn, tối đa 5)
            </label>
            <p className="mt-0.5 text-xs text-admin-mute">
              Sản phẩm bạn muốn AI bắt buộc nhắc tới trong bài (vd sản phẩm mới ra hoặc đang sale). Để trống = AI tự shortlist.
            </p>
            <PinnedProductPicker
              products={productsForPin}
              value={pinned}
              onChange={setPinned}
              maxSelectable={5}
            />
            {pinned.map((id) => (
              <input key={id} type="hidden" name="pinnedProductIds" value={id} />
            ))}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Mẹo:</strong> AI có thể phát hiện sản phẩm mới ngoài DB qua web search và tự kéo vào pipeline Refinery
          (status PENDING_REVIEW). Sau khi sinh xong, vào{" "}
          <a href="/admin" className="underline">Refinery</a> để duyệt sản phẩm mới.
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-admin-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <PendingHint />
        <SubmitButton />
      </div>
    </>
  );
}

function PinnedProductPicker({
  products,
  value,
  onChange,
  maxSelectable
}: {
  products: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  maxSelectable: number;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [products, query]);

  const toggle = (id: string): void => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else if (value.length < maxSelectable) {
      onChange([...value, id]);
    }
  };

  const selected = products.filter((p) => value.includes(p.id));

  return (
    <div className="mt-2 space-y-2">
      <input
        type="search"
        placeholder="Gõ tên sản phẩm để tìm..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={input}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1 rounded-full bg-admin-accent-soft px-2.5 py-1 text-xs font-medium text-admin-accent hover:bg-admin-accent hover:text-white"
            >
              {p.name} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-admin-line bg-canvas p-1.5">
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-xs text-admin-mute">Không tìm thấy sản phẩm.</p>
        )}
        {filtered.map((p) => {
          const checked = value.includes(p.id);
          const disabled = !checked && value.length >= maxSelectable;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(p.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition hover:bg-admin-subtle disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? "bg-admin-accent-soft text-admin-accent" : "text-admin-ink"
              }`}
            >
              <span className="truncate text-left">{p.name}</span>
              {checked && <span className="text-xs">✓</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-admin-mute">
        Đã pin {value.length}/{maxSelectable}.
      </p>
    </div>
  );
}

function PendingHint(): React.ReactElement {
  const { pending } = useFormStatus();
  if (pending) {
    return (
      <p className="flex items-center gap-2 text-xs text-admin-accent">
        <SpinnerIcon />
        <span>Đang khởi tạo bài. Sẽ chuyển sang trang detail để theo dõi tiến trình.</span>
      </p>
    );
  }
  return (
    <p className="text-xs text-admin-mute">
      AI chạy nền ~30s–2 phút (nếu cần khám phá sản phẩm mới). Bạn theo dõi ở trang detail.
    </p>
  );
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-admin-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-admin-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <SpinnerIcon />
          Đang khởi tạo...
        </>
      ) : (
        <>
          <SparkleIcon />
          Sinh bằng AI
        </>
      )}
    </button>
  );
}

const input =
  "w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20 disabled:opacity-60";

function SparkleIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 2 14 8l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
    </svg>
  );
}

function SpinnerIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
