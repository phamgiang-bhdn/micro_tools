import type React from "react";
import { ShoppingCart, Star } from "lucide-react";
import type { ProductItem } from "../../../lib/types";
import { normalizeProduct, formatMoney } from "../../../lib/format";
import { trackAndRedirectAction } from "../../../app/actions/tracking";

interface Props {
  product: ProductItem;
  angle?: string;
}

/**
 * Mini product card in-flow giữa các section bài viết. Khác `product-card-end` ở chỗ:
 * card này nằm ngay trong dòng đọc, ngắn gọn — chỉ ảnh + tên + giá + 1 CTA.
 * Mục đích: chốt deal ngay khi user đang đọc phần liên quan, không phải đợi đến cuối bài.
 */
export function ProductSlotBlock({ product, angle }: Props): React.ReactElement {
  const pv = normalizeProduct(product);
  return (
    <aside className="relative my-4 overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/60 to-white p-4 shadow-sm sm:p-5">
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-white">
        <ShoppingCart className="size-3" /> Deal
      </span>

      <div className="flex gap-4">
        <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-card-soft sm:w-28">
          {pv.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pv.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="flex flex-1 flex-col">
          <p className="line-clamp-2 text-body-sm font-semibold leading-snug text-ink">{product.name}</p>

          {angle ? (
            <p className="mt-1 line-clamp-2 text-caption leading-snug text-ink-soft">{angle}</p>
          ) : null}

          {typeof pv.rating === "number" && pv.rating > 0 ? (
            <div className="mt-1.5 flex items-center gap-1 text-micro text-amber-700">
              <Star className="size-3 fill-amber-500 stroke-amber-500" />
              <span className="font-semibold">{pv.rating.toFixed(1)}</span>
              {pv.reviewCount ? <span className="text-ink-mute">· {pv.reviewCount.toLocaleString("vi-VN")} đánh giá</span> : null}
            </div>
          ) : null}

          <div className="mt-2 flex items-baseline gap-2">
            {typeof pv.price === "number" && pv.price > 0 ? (
              <span className="text-body-lg font-bold text-primary-700">{formatMoney(pv.price)}</span>
            ) : (
              <span className="text-caption text-ink-mute">Liên hệ</span>
            )}
            {typeof pv.originalPrice === "number" && pv.originalPrice > (pv.price ?? 0) ? (
              <span className="text-caption text-ink-mute line-through">{formatMoney(pv.originalPrice)}</span>
            ) : null}
            {typeof pv.discountPercent === "number" && pv.discountPercent > 0 ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-micro font-bold text-red-700">
                -{pv.discountPercent}%
              </span>
            ) : null}
          </div>

          <form action={trackAndRedirectAction} className="mt-3 w-fit">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="affiliateUrl" value={product.affiliateUrl ?? ""} />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-body-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md"
            >
              Xem deal ↗
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
