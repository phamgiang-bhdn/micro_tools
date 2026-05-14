import type React from "react";
import Link from "next/link";
import { fetchFeaturedProducts, fetchTools } from "../lib/api";
import { Hero } from "../components/hero";
import { ToolCard } from "../components/tool-card";
import { ProductCard } from "../components/product-card";
import { SectionHeading } from "../components/ui/section-heading";
import { EmptyState } from "../components/ui/empty-state";
import { Button } from "../components/ui/button";

export const revalidate = 300;

const CODE = "rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px] text-ink";

export default async function HomePage(): Promise<React.ReactElement> {
  const { tools, loadError } = await fetchTools();
  const featured = loadError ? [] : await fetchFeaturedProducts(tools, 8);
  const totalProducts = tools.reduce((acc, tool) => acc + (tool._count?.products ?? 0), 0);

  return (
    <div className="space-y-16">
      <Hero toolCount={tools.length} productCount={totalProducts} />

      {loadError ? (
        <EmptyState
          tone="error"
          title="Không kết nối được API"
          description={
            <div className="space-y-2 text-left">
              <p className="font-mono text-[11px] text-red-700">{loadError}</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  Khởi động backend: <code className={CODE}>npm run dev:api</code> (cổng 4000).
                </li>
                <li>
                  Kiểm tra <code className={CODE}>apps/web/.env</code> →{" "}
                  <code className={CODE}>API_BASE_URL=http://localhost:4000/api/v1</code>.
                </li>
                <li>
                  Nếu API đã chạy mà vẫn trống: <code className={CODE}>npm run db:seed</code> rồi F5.
                </li>
              </ul>
            </div>
          }
        />
      ) : null}

      <section id="tools" className="space-y-6 scroll-mt-24">
        <SectionHeading
          eyebrow="Micro-tools"
          title="Chọn cuộc chiến của bạn"
          description="Mỗi micro-tool tập trung vào một thị trường: thẻ tín dụng, đồ điện tử, du lịch… Càng chuyên — càng dễ chuyển đổi."
        />
        {!loadError && tools.length === 0 ? (
          <EmptyState
            tone="warning"
            title="Chưa có tool ACTIVE"
            description={
              <p>
                Chạy <code className={CODE}>npm run db:seed</code> rồi reload trang.
              </p>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </section>

      <section id="deals" className="space-y-6 scroll-mt-24">
        <SectionHeading
          eyebrow="Deal hot"
          title="Giảm sâu nhất hôm nay"
          description="Tổng hợp sản phẩm giảm giá mạnh nhất từ các micro-tool. Cập nhật mỗi 5 phút."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="#tools">Xem tất cả →</Link>
            </Button>
          }
        />
        {featured.length === 0 ? (
          <EmptyState
            tone="info"
            title="Chưa có deal nổi bật"
            description="Hãy chạy lại seed hoặc đợi cron crawl bổ sung dữ liệu."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} toolSlug={product.toolSlug} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-card p-8 shadow-card sm:p-12">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          <Trust title="AI extract" body="Bóc tách giá, voucher, tính năng từ trang gốc — không phải copy tay." />
          <Trust title="Tracking chính xác" body="Mỗi click sinh ra một mã duy nhất + webhook đối soát đơn hàng." />
          <Trust title="Human review" body="Mọi dữ liệu AI đều qua bước duyệt để chống giá ảo, voucher hết hạn." />
        </div>
      </section>
    </div>
  );
}

function Trust({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div>
      <p className="text-sm font-semibold text-brand-700">{title}</p>
      <p className="mt-1.5 text-sm text-ink-soft">{body}</p>
    </div>
  );
}
