"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import type { ProductItem } from "../../lib/types";
import { normalizeProduct, formatMoney } from "../../lib/format";
import { trackAndRedirectAction } from "../../app/actions/tracking";

interface Props {
  products: ProductItem[];
  articleId: string;
}

/**
 * Floating CTA góc phải dưới — pattern cellphones/sforum. Chỉ hiện sau khi user
 * scroll > 600px (đã đọc qua hero). Click → submit form action tracking → redirect
 * affiliate URL. Form submit hoạt động trong client component; trade off animation
 * feel để giữ attribution chuẩn (ClickLog row mỗi click).
 */
export function StickyProductCta({ products, articleId }: Props) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (products.length === 0) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Xem sản phẩm trong bài"
        className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 transition-all hover:bg-primary-700 hover:shadow-xl sm:bottom-8 sm:right-8 sm:px-5 ${
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <ShoppingCart className="size-4" />
        <span className="hidden sm:inline">Sản phẩm có trong bài</span>
        <span className="sm:hidden">Mua hàng</span>
        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-micro font-bold">{products.length}</span>
      </button>

      {/* Slide-up panel */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-canvas p-5 shadow-2xl sm:m-6 sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">Sản phẩm trong bài viết</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-card text-ink-mute hover:bg-line"
                aria-label="Đóng"
              >
                <X className="size-4" />
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {products.map((p) => {
                const pv = normalizeProduct(p);
                return (
                  <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-card">
                    <form action={trackAndRedirectAction} data-article-id={articleId}>
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="affiliateUrl" value={p.affiliateUrl ?? ""} />
                      <button
                        type="submit"
                        className="flex w-full gap-3 p-3 text-left transition hover:bg-card-soft"
                      >
                        {pv.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={pv.image}
                            alt={p.name}
                            loading="lazy"
                            className="size-20 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="size-20 shrink-0 rounded-md bg-line" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-body-sm font-semibold leading-snug text-ink">{p.name}</p>
                          <div className="mt-1 flex items-baseline gap-2">
                            {typeof pv.price === "number" && pv.price > 0 ? (
                              <span className="text-body font-bold text-primary-700">{formatMoney(pv.price)}</span>
                            ) : null}
                            {typeof pv.originalPrice === "number" && pv.originalPrice > (pv.price ?? 0) ? (
                              <span className="text-micro text-ink-mute line-through">{formatMoney(pv.originalPrice)}</span>
                            ) : null}
                            {typeof pv.discountPercent === "number" && pv.discountPercent > 0 ? (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-micro font-bold text-red-700">
                                -{pv.discountPercent}%
                              </span>
                            ) : null}
                          </div>
                          <span className="mt-1 inline-block text-micro font-medium text-primary-700">Xem deal ↗</span>
                        </div>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
