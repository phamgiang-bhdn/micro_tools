import type React from "react";
import Link from "next/link";
import { fetchAllProductsFlat, fetchTools } from "../lib/api";
import { ProductCard } from "../components/product-card";
import { EmptyState } from "../components/ui/empty-state";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ tool?: string }>;
}

const CODE = "rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px] text-ink";

export default async function HomePage({ searchParams }: HomeProps): Promise<React.ReactElement> {
  const { tool: activeSlug } = await searchParams;
  const { tools, loadError } = await fetchTools();
  const allProducts = loadError ? [] : await fetchAllProductsFlat(tools);

  const filtered = activeSlug ? allProducts.filter((p) => p.toolSlug === activeSlug) : allProducts;
  const sorted = filtered.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Deal hôm nay
        </h1>
        <p className="text-sm text-ink-soft">Giá cập nhật từ các shop uy tín. Chạm vào sản phẩm để mua.</p>
      </section>

      {loadError ? (
        <EmptyState
          tone="error"
          title="Không kết nối được API"
          description={
            <div className="space-y-2 text-left">
              <p className="font-mono text-[11px] text-red-700">{loadError}</p>
              <p>
                Bật backend: <code className={CODE}>npm run dev:api</code>, kiểm tra{" "}
                <code className={CODE}>API_BASE_URL</code> trong <code className={CODE}>apps/web/.env</code>.
              </p>
            </div>
          }
        />
      ) : null}

      {tools.length > 0 ? (
        <nav aria-label="Lọc theo danh mục" className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          <ChipLink href="/" active={!activeSlug} label="Tất cả" count={allProducts.length} />
          {tools.map((tool) => (
            <ChipLink
              key={tool.id}
              href={`/?tool=${tool.slug}`}
              active={activeSlug === tool.slug}
              label={tool.name}
              count={tool._count?.products ?? 0}
            />
          ))}
        </nav>
      ) : null}

      {!loadError && sorted.length === 0 ? (
        <EmptyState
          tone="warning"
          title="Chưa có sản phẩm"
          description={
            <p>
              Chạy <code className={CODE}>npm run db:seed</code> rồi tải lại trang.
            </p>
          }
        />
      ) : null}

      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {sorted.map((product) => (
            <ProductCard key={product.id} product={product} toolSlug={product.toolSlug} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChipLink({
  href,
  active,
  label,
  count
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ink text-white shadow-card"
          : "border border-line bg-card text-ink-soft hover:border-brand-300 hover:text-brand-700"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? "text-white/70" : "text-ink-mute"}`}>{count}</span>
    </Link>
  );
}
