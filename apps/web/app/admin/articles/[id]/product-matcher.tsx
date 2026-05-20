"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Search, ShoppingBag, X, Sparkles, Loader2 } from "lucide-react";
import { AdminButton } from "../../../../components/admin/ui";
import {
  listArticleSlotsAction,
  searchProductsForSlotAction,
  assignArticleSlotAction,
  type ArticleSlotDto,
  type SlotProductDto,
  type SlotProductSearchHit
} from "../../actions";
import { withToast } from "../../../../lib/admin/notify";

interface Props {
  articleId: string;
  nicheId: string | null;
}

interface AssignedMap {
  [productId: string]: SlotProductDto;
}

/**
 * Tab "Gắn sản phẩm" — workflow topic-first:
 * 1. Writer sinh product_slot rỗng với `hint` mô tả Product cần gắn.
 * 2. Admin xem hint → tìm Product trong DB qua search box → bấm "Gắn".
 * 3. Storefront block-renderer render mini-card cho slot đã gắn, ẩn slot còn rỗng.
 *
 * Mục tiêu UX: 1 màn 2 cột — slot list trái + search/picker phải.
 * Click slot → highlight + autofocus search với hint preset; pick product → assign + next slot.
 */
export function ProductMatcher({ articleId, nicheId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slots, setSlots] = useState<ArticleSlotDto[]>([]);
  const [assigned, setAssigned] = useState<AssignedMap>({});
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SlotProductSearchHit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const activeSlot = slots[activeSlotIdx] ?? null;
  const assignedCount = useMemo(() => slots.filter((s) => Boolean(s.productId)).length, [slots]);

  const refresh = async () => {
    const res = await listArticleSlotsAction(articleId);
    setSlots(res.slots);
    const map: AssignedMap = {};
    for (const p of res.assignedProducts) map[p.id] = p;
    setAssigned(map);
    setLoaded(true);
  };

  useEffect(() => {
    refresh().catch((err) => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // Auto-search khi đổi slot: dùng hint làm initial query.
  useEffect(() => {
    if (!activeSlot) return;
    const initial = activeSlot.hint.split(/\s+/).slice(0, 3).join(" ");
    setSearch(initial);
    void doSearch(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlotIdx, activeSlot?.slotKey]);

  const doSearch = async (q: string) => {
    setSearching(true);
    try {
      const res = await searchProductsForSlotAction({ search: q || undefined, nicheId, limit: 30 });
      setHits(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const onAssign = (productId: string) => {
    if (!activeSlot) return;
    startTransition(async () => {
      const ok = await withToast(
        () => assignArticleSlotAction(articleId, activeSlot.sectionId, activeSlot.slotKey, productId),
        { loading: "Đang gắn sản phẩm…", success: "Đã gắn", error: "Gắn thất bại" }
      );
      if (ok === null) return;
      await refresh();
      // Auto-jump tới slot trống tiếp theo để admin lướt nhanh.
      const next = slots.findIndex((s, i) => i > activeSlotIdx && !s.productId);
      if (next >= 0) setActiveSlotIdx(next);
      router.refresh();
    });
  };

  const onClear = () => {
    if (!activeSlot) return;
    startTransition(async () => {
      const ok = await withToast(
        () => assignArticleSlotAction(articleId, activeSlot.sectionId, activeSlot.slotKey, null),
        { loading: "Đang xoá gắn kết…", success: "Đã xoá", error: "Xoá thất bại" }
      );
      if (ok === null) return;
      await refresh();
      router.refresh();
    });
  };

  if (!loaded) {
    return (
      <div className="admin-card flex items-center gap-2 p-6 text-[13px] text-admin-mute">
        <Loader2 className="size-4 animate-spin" /> Đang tải danh sách slot…
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="admin-card p-6 text-[13px] text-admin-mute">
        <p>Bài này chưa có product_slot nào. Pipeline Writer cần chạy xong (status từ DRAFTING trở đi).</p>
        <p className="mt-1.5">Nếu writer chạy xong mà vẫn rỗng → AI có thể skip slot ở bài có topic chung chung không nhắc sản phẩm cụ thể. Có thể edit tay từng section ở tab &quot;Các phần&quot;.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="admin-card flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="admin-section-title">Tiến độ gắn sản phẩm</div>
          <p className="mt-0.5 text-[12px] text-admin-mute">
            <strong className="text-admin-ink">{assignedCount}</strong>/{slots.length} slot đã gắn ·
            {slots.length - assignedCount > 0 ? (
              <span className="ml-1 text-amber-700">còn {slots.length - assignedCount} slot trống</span>
            ) : (
              <span className="ml-1 text-emerald-700">đã đầy đủ ✓</span>
            )}
          </p>
        </div>
        <div className="text-[11.5px] text-admin-mute">
          Storefront chỉ hiển thị slot đã gắn — slot trống ẩn tự động.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Slot list */}
        <div className="admin-card p-2">
          <div className="admin-section-title mb-2 px-2 pt-1">Danh sách slot</div>
          <ol className="space-y-1">
            {slots.map((s, i) => {
              const p = s.productId ? assigned[s.productId] : null;
              const isActive = i === activeSlotIdx;
              return (
                <li key={`${s.sectionId}-${s.slotKey}`}>
                  <button
                    type="button"
                    onClick={() => setActiveSlotIdx(i)}
                    className={`flex w-full flex-col items-start gap-1 rounded-md px-2.5 py-2 text-left text-[12.5px] transition ${
                      isActive ? "bg-admin-accent-soft text-admin-accent-ink" : "hover:bg-admin-subtle"
                    }`}
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="rounded bg-admin-subtle px-1.5 py-0.5 text-[10.5px] font-semibold text-admin-ink">
                        §{s.sectionOrder + 1}
                      </span>
                      <span className="line-clamp-1 flex-1 font-semibold leading-snug">{s.sectionHeading}</span>
                      {p ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <span className="text-[10.5px] font-semibold text-amber-700">trống</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11.5px] text-admin-mute">
                      <Sparkles className="mr-1 inline size-3" />
                      {s.hint || "(chưa có gợi ý)"}
                    </p>
                    {p ? (
                      <p className="line-clamp-1 text-[11.5px] text-emerald-700">→ {p.name}</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Picker */}
        <div className="admin-card p-4">
          {!activeSlot ? (
            <p className="text-[13px] text-admin-mute">Chọn 1 slot bên trái để bắt đầu gắn.</p>
          ) : (
            <>
              <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                <div className="flex items-start gap-2 text-[12.5px]">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">AI gợi ý</p>
                    <p className="mt-0.5 text-admin-ink">{activeSlot.hint}</p>
                    {activeSlot.angle ? (
                      <p className="mt-1 text-[11.5px] italic text-admin-mute">Spin: &quot;{activeSlot.angle}&quot;</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {activeSlot.productId && assigned[activeSlot.productId] ? (
                <div className="mb-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <ProductThumb product={assigned[activeSlot.productId]} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Đang gắn</p>
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-admin-ink">
                      {assigned[activeSlot.productId].name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClear}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[11.5px] font-medium text-admin-mute transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                  >
                    <X className="size-3" /> Bỏ gắn
                  </button>
                </div>
              ) : null}

              {/* Search */}
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
                <Search className="size-4 text-admin-mute" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void doSearch(search);
                    }
                  }}
                  placeholder="Tìm tên Product theo gợi ý…"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-admin-mute"
                />
                <AdminButton variant="ghost" size="sm" onClick={() => void doSearch(search)} disabled={searching}>
                  {searching ? <Loader2 className="size-3.5 animate-spin" /> : "Tìm"}
                </AdminButton>
              </div>

              {/* Hits */}
              {searching && hits.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-[13px] text-admin-mute">
                  <Loader2 className="size-4 animate-spin" /> Đang tìm sản phẩm…
                </div>
              ) : hits.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line p-6 text-center text-[13px] text-admin-mute">
                  Không tìm thấy. Thử từ khoá khác hoặc bỏ filter niche.
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {hits.map((p) => {
                    const isCurrent = activeSlot.productId === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={pending || isCurrent}
                          onClick={() => onAssign(p.id)}
                          className={`flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition ${
                            isCurrent
                              ? "border-emerald-300 bg-emerald-50/40"
                              : "border-line bg-canvas hover:border-brand-300 hover:bg-brand-50/30"
                          } disabled:opacity-50`}
                        >
                          <ProductThumb product={p as unknown as SlotProductDto} />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-admin-ink">
                              {p.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-admin-mute">
                              {p.niche ? <span>{p.niche.name}</span> : null}
                              {!p.isPublic ? (
                                <span className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-800">
                                  Riêng tư
                                </span>
                              ) : null}
                            </div>
                            <PriceLine raw={p.scrapedData} />
                          </div>
                          {isCurrent ? (
                            <Check className="size-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Link2 className="size-3.5 shrink-0 text-admin-mute" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductThumb({ product }: { product: SlotProductDto }) {
  const raw = (product.scrapedData ?? {}) as Record<string, unknown>;
  const img =
    (typeof raw.image === "string" && raw.image) ||
    (typeof raw.imageUrl === "string" && raw.imageUrl) ||
    (typeof raw.thumbnail === "string" && raw.thumbnail) ||
    null;
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-md border border-line bg-admin-subtle">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-admin-mute">
          <ShoppingBag className="size-4" />
        </div>
      )}
    </div>
  );
}

function PriceLine({ raw }: { raw: Record<string, unknown> }) {
  const price = pickNum(raw, ["price", "salePrice", "currentPrice"]);
  const original = pickNum(raw, ["originalPrice", "listPrice"]);
  if (!price) return null;
  const discountPct =
    original && original > price ? Math.round(((original - price) / original) * 100) : 0;
  return (
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="text-[12px] font-bold text-brand-700">
        {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(price)}
      </span>
      {original && original > price ? (
        <span className="text-[10.5px] text-admin-mute line-through">
          {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(original)}
        </span>
      ) : null}
      {discountPct > 0 ? (
        <span className="rounded bg-red-100 px-1 py-0.5 text-[9.5px] font-bold text-red-700">-{discountPct}%</span>
      ) : null}
    </div>
  );
}

function pickNum(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "number" && v > 0) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}
