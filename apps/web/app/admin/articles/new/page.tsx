import type React from "react";
import Link from "next/link";
import { fetchTools, fetchToolBySlug } from "../../../../lib/api";
import { generateArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewArticlePage(): Promise<React.ReactElement> {
  const { tools } = await fetchTools();
  const toolDetails = await Promise.all(tools.map((t) => fetchToolBySlug(t.slug)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href="/admin/articles" className="text-xs text-admin-mute hover:text-admin-ink">
          ← Quay lại danh sách
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-admin-ink">Tạo bài viết mới</h1>
        <p className="mt-1 text-sm text-admin-mute">
          AI sẽ sinh bản nháp dựa trên prompt template đang active. Sau đó bạn duyệt + chỉnh trước khi publish.
        </p>
      </header>

      <form action={generateArticleAction} className="space-y-5 rounded-2xl border border-admin-line bg-admin-surface p-6">
        <div>
          <label className="block text-sm font-medium text-admin-ink">Loại bài</label>
          <p className="mt-0.5 text-xs text-admin-mute">
            Chọn loại để AI dùng prompt phù hợp.
          </p>
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
            Mô tả ngắn gọn cho AI biết viết về cái gì. Ví dụ: "Cách chọn robot hút bụi cho căn hộ có thú cưng".
          </p>
          <input
            id="topic"
            name="topic"
            required
            minLength={5}
            placeholder="Cách chọn máy lọc không khí cho phòng ngủ"
            className="mt-2 w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink placeholder:text-admin-mute focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          />
        </div>

        <div>
          <label htmlFor="toolId" className="block text-sm font-medium text-admin-ink">
            Tool (tuỳ chọn)
          </label>
          <p className="mt-0.5 text-xs text-admin-mute">Gắn bài vào 1 micro-tool để filter blog theo danh mục.</p>
          <select
            id="toolId"
            name="toolId"
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-admin-line bg-admin-surface px-3 py-2.5 text-sm text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          >
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
            Chọn sản phẩm để AI nhắc tên trong bài. Cuối bài tự hiển thị card sản phẩm có CTA "Xem deal".
          </p>
          <div className="mt-2 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-admin-line bg-canvas p-3">
            {toolDetails.filter(Boolean).map((tool) =>
              tool ? (
                <fieldset key={tool.id}>
                  <legend className="text-xs font-semibold uppercase tracking-wider text-admin-mute">
                    {tool.name}
                  </legend>
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
              ) : null
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-admin-line pt-5">
          <p className="text-xs text-admin-mute">
            Mất ~10–30 giây để AI sinh xong. Sau đó bạn duyệt ở trang chi tiết.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-admin-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-admin-accent/90 disabled:opacity-50"
          >
            <SparkleIcon />
            Sinh bằng AI
          </button>
        </div>
      </form>
    </div>
  );
}

function SparkleIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 2 14 8l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
    </svg>
  );
}
