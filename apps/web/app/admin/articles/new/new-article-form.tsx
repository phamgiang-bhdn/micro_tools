"use client";

import type React from "react";
import { useFormStatus } from "react-dom";
import { generateArticleAction } from "../../actions";

interface ToolOption {
  id: string;
  name: string;
  slug: string;
  products: Array<{ id: string; name: string }>;
}

interface Props {
  tools: ToolOption[];
}

export function NewArticleForm({ tools }: Props): React.ReactElement {
  return (
    <form action={generateArticleAction} className="space-y-5 rounded-2xl border border-admin-line bg-admin-surface p-6">
      <FormBody tools={tools} />
    </form>
  );
}

function FormBody({ tools }: { tools: ToolOption[] }): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <>
      <fieldset disabled={pending} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-admin-ink">Loại bài</label>
          <p className="mt-0.5 text-xs text-admin-mute">Chọn loại để AI dùng prompt phù hợp.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-line p-3 hover:border-admin-accent has-[input:checked]:border-admin-accent has-[input:checked]:bg-admin-accent-soft">
              <input type="radio" name="type" value="BUYING_GUIDE" defaultChecked className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-admin-ink">Cẩm nang chọn mua</span>
                <span className="block text-xs text-admin-mute">Hướng dẫn theo tiêu chí. ROI SEO cao nhất.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-admin-line p-3 hover:border-admin-accent has-[input:checked]:border-admin-accent has-[input:checked]:bg-admin-accent-soft">
              <input type="radio" name="type" value="REVIEW" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-admin-ink">Review chi tiết</span>
                <span className="block text-xs text-admin-mute">Một sản phẩm cụ thể, có trải nghiệm.</span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-admin-ink">
            Chủ đề
          </label>
          <p className="mt-0.5 text-xs text-admin-mute">
            Mô tả ngắn cho AI biết viết về cái gì. Ví dụ: "Cách chọn robot hút bụi cho căn hộ có thú cưng".
          </p>
          <input
            id="topic"
            name="topic"
            required
            minLength={5}
            placeholder="Cách chọn máy lọc không khí cho phòng ngủ"
            className={input}
          />
        </div>

        <div>
          <label htmlFor="toolId" className="block text-sm font-medium text-admin-ink">
            Tool (tuỳ chọn)
          </label>
          <p className="mt-0.5 text-xs text-admin-mute">Gắn bài vào 1 micro-tool để filter blog theo danh mục.</p>
          <select id="toolId" name="toolId" defaultValue="" className={`${input} mt-2`}>
            <option value="">— Không gắn —</option>
            {tools.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-admin-ink">Sản phẩm gợi ý (tuỳ chọn)</label>
          <p className="mt-0.5 text-xs text-admin-mute">
            Chọn sản phẩm để AI nhắc tên trong bài. Cuối bài tự hiển thị card "Xem deal".
          </p>
          <div className="mt-2 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-admin-line bg-canvas p-3">
            {tools.map((tool) => (
              <fieldset key={tool.id}>
                <legend className="text-xs font-semibold uppercase tracking-wider text-admin-mute">{tool.name}</legend>
                <div className="mt-1 space-y-1">
                  {tool.products.map((product) => (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-admin-subtle"
                    >
                      <input type="checkbox" name="productIds" value={product.id} />
                      <span className="text-admin-ink">{product.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-admin-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <PendingHint />
        <SubmitButton />
      </div>
    </>
  );
}

function PendingHint(): React.ReactElement {
  const { pending } = useFormStatus();
  if (pending) {
    return (
      <p className="flex items-center gap-2 text-xs text-admin-accent">
        <SpinnerIcon />
        <span>AI đang viết... thường mất 15–30 giây, đôi khi tới 1 phút nếu Gemini bị rate-limit. Đừng đóng tab.</span>
      </p>
    );
  }
  return (
    <p className="text-xs text-admin-mute">
      Mất ~15–30 giây để AI sinh xong. Sau đó bạn duyệt ở trang chi tiết.
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
          Đang sinh bài...
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
