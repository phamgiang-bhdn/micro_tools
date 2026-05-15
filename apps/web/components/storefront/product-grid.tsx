import type React from "react";
import { ProductCard } from "../product-card";
import type { ProductView } from "../../lib/types";

interface ProductGridProps {
  /** Sản phẩm. Mỗi item phải kèm `categorySlug` để build URL. */
  products: Array<ProductView & { slug?: string | null; categorySlug: string }>;
  /** Bật animation fade-up stagger. */
  animate?: boolean;
}

/**
 * Lưới sản phẩm chuẩn: 2 / 3 / 4 / 5 cột theo breakpoint.
 * Tách ra để mọi danh sách (home, category, search) cùng layout.
 */
export function ProductGrid({ products, animate = true }: ProductGridProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product, idx) => (
        <div
          key={product.id}
          className={animate ? "animate-fade-up" : undefined}
          style={animate ? { animationDelay: `${Math.min(idx * 30, 300)}ms` } : undefined}
        >
          <ProductCard product={product} categorySlug={product.categorySlug} />
        </div>
      ))}
    </div>
  );
}
