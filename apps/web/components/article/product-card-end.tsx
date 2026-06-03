import type React from "react";
import { ShoppingCart, Sparkles, Flame, ShieldCheck } from "lucide-react";
import type { ProductItem } from "../../lib/types";
import { normalizeProduct, formatMoney } from "../../lib/format";
import { trackAndRedirectAction } from "../../app/actions/tracking";

interface Props {
  products: ProductItem[];
}

/**
 * Card cuối bài — chốt deal. Tone positive nghiêng-mua:
 * - Title "Deal được khuyên dùng trong bài" (KHÔNG "Sản phẩm được nhắc")
 * - Badge "Top 1" cho item đầu, "Đáng mua" cho item có discount cao
 * - Mỗi card nhấn giá tốt + urgency khi có khuyến mãi
 * - Trust signal cuối: "Mua qua link không tốn thêm phí"
 */
export function ProductCardEnd({ products }: Props): React.ReactElement | null {
  if (products.length === 0) return null;
  const top = products.slice(0, 3);

  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/50 to-card shadow-sm">
      <div className="border-b border-primary-100 bg-gradient-to-r from-primary-100/60 to-transparent px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary-600 text-white">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink sm:text-lg">Deal được khuyên dùng trong bài</h2>
            <p className="text-[11.5px] text-ink-soft">
              Lựa chọn đã được team dealvault test, đối chiếu giá thực tế
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
        {top.map((p, idx) => {
          const pv = normalizeProduct(p);
          const hasHotDeal = typeof pv.discountPercent === "number" && pv.discountPercent >= 15;
          const isTop = idx === 0;
          return (
            <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-canvas shadow-sm transition hover:border-primary-300 hover:shadow-md">
              {isTop || hasHotDeal ? (
                <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                  {isTop ? <><Sparkles className="size-2.5" /> Top 1</> : <><Flame className="size-2.5" /> Đáng mua</>}
                </span>
              ) : null}
              <div className="aspect-square bg-card-soft">
                {pv.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pv.image}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{p.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  {typeof pv.price === "number" && pv.price > 0 ? (
                    <span className="text-[17px] font-bold text-primary-700">{formatMoney(pv.price)}</span>
                  ) : (
                    <span className="text-[12px] text-ink-mute">Liên hệ</span>
                  )}
                  {typeof pv.originalPrice === "number" && pv.originalPrice > (pv.price ?? 0) ? (
                    <span className="text-[11.5px] text-ink-mute line-through">{formatMoney(pv.originalPrice)}</span>
                  ) : null}
                </div>
                {typeof pv.discountPercent === "number" && pv.discountPercent > 0 ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="inline-flex w-fit items-center rounded bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700">
                      -{pv.discountPercent}%
                    </span>
                    {hasHotDeal ? (
                      <span className="text-[10.5px] font-semibold text-red-600">Sale mạnh hôm nay</span>
                    ) : null}
                  </div>
                ) : null}
                <form action={trackAndRedirectAction} className="mt-3">
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="affiliateUrl" value={p.affiliateUrl ?? ""} />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary-600 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md group-hover:bg-primary-700"
                  >
                    <ShoppingCart className="size-3.5" /> Xem deal ngay ↗
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-primary-100 bg-primary-50/30 px-5 py-2.5 sm:px-6">
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Mua qua link không tốn thêm phí — dealvault nhận hoa hồng nhỏ từ đối tác để duy trì nội dung.
        </p>
      </div>
    </section>
  );
}
