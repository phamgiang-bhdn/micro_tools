"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { formatMoney, formatNumber, normalizeProduct } from "../../lib/format";
import type { ProductItem, ProductView } from "../../lib/types";
import {
  approveExtractionAction,
  rejectExtractionAction,
  retryExtractionAction
} from "../../app/admin/actions";

interface RefineryEntry {
  id: string;
  rawContent: string;
  aiOutput: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  product: { id: string; name: string; network: string };
}

/**
 * Refinery list — UX cải tiến:
 * - Queue panel bên trái: scan nhanh hàng đợi, click để focus item.
 * - Workspace bên phải: 3 cột (raw / JSON edit / preview như user).
 * - Keyboard shortcuts: J/K điều hướng, A approve, R reject (trừ khi đang gõ trong input).
 * - Approve button bị disable nếu JSON không hợp lệ.
 */
export function RefineryList({ items }: { items: RefineryEntry[] }): React.ReactElement {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const focused = items[focusedIdx];
  const approveBtnRef = useRef<HTMLButtonElement>(null);
  const rejectBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target && /input|textarea|select/i.test(target.tagName);
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;
      if (items.length === 0) return;
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIdx((idx) => Math.min(items.length - 1, idx + 1));
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIdx((idx) => Math.max(0, idx - 1));
      } else if (event.key.toLowerCase() === "a") {
        approveBtnRef.current?.click();
      } else if (event.key.toLowerCase() === "r") {
        rejectBtnRef.current?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <article className="admin-card grid place-items-center p-12 text-center">
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-emerald-50 text-2xl">✓</span>
        <p className="mt-3 text-base font-semibold text-admin-ink">Hàng đợi sạch</p>
        <p className="mt-1 max-w-sm text-sm text-admin-mute">
          Không có bản AI extraction nào chờ duyệt. Khi crawler đẩy item mới, chúng sẽ xuất hiện ở đây.
        </p>
      </article>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <QueuePanel items={items} focusedIdx={focusedIdx} onFocus={setFocusedIdx} />
      {focused ? (
        <ReviewWorkspace
          key={focused.id}
          entry={focused}
          approveRef={approveBtnRef}
          rejectRef={rejectBtnRef}
          position={focusedIdx + 1}
          total={items.length}
        />
      ) : null}
    </div>
  );
}

function QueuePanel({
  items,
  focusedIdx,
  onFocus
}: {
  items: RefineryEntry[];
  focusedIdx: number;
  onFocus: (idx: number) => void;
}): React.ReactElement {
  return (
    <aside className="admin-card flex flex-col overflow-hidden p-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between border-b border-admin-line bg-admin-subtle/50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-admin-mute">Hàng đợi</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{items.length}</span>
      </div>
      <ul className="scrollbar-thin flex-1 divide-y divide-admin-line overflow-auto">
        {items.map((entry, idx) => {
          const active = idx === focusedIdx;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onFocus(idx)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  active ? "bg-admin-accent-soft/60" : "hover:bg-admin-subtle/60"
                }`}
              >
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  active ? "bg-admin-accent text-white" : "bg-admin-subtle text-admin-mute"
                }`}>
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`line-clamp-2 text-sm ${active ? "font-semibold text-admin-ink" : "text-admin-ink"}`}>
                    {entry.product.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-admin-mute">
                    <span className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono uppercase">
                      {entry.product.network}
                    </span>
                    <span>{relativeTime(entry.createdAt)}</span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function ReviewWorkspace({
  entry,
  approveRef,
  rejectRef,
  position,
  total
}: {
  entry: RefineryEntry;
  approveRef: React.RefObject<HTMLButtonElement | null>;
  rejectRef: React.RefObject<HTMLButtonElement | null>;
  position: number;
  total: number;
}): React.ReactElement {
  const initialText = JSON.stringify(entry.aiOutput ?? {}, null, 2);
  const [jsonText, setJsonText] = useState(initialText);
  const preview = useMemo(
    () => buildPreview(jsonText, entry.product.id, entry.product.name, entry.product.network),
    [jsonText, entry.product.id, entry.product.name, entry.product.network]
  );

  return (
    <article className="admin-card overflow-hidden p-0">
      {/* Header workspace */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line bg-admin-subtle/40 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">
            Đang duyệt · {position} / {total}
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-admin-ink">{entry.product.name}</h2>
          <p className="text-xs text-admin-mute">
            <span className="rounded bg-admin-subtle px-1.5 py-0.5 font-mono uppercase">{entry.product.network}</span>
            {" · "}
            {relativeTime(entry.createdAt)}
          </p>
        </div>
        <a
          href={`/admin/preview/${entry.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-admin-line bg-admin-surface px-3 py-1.5 text-xs font-medium text-admin-mute transition hover:border-admin-accent hover:text-admin-accent"
        >
          Mở trang chi tiết →
        </a>
      </header>

      <div className="grid gap-0 xl:grid-cols-3">
        {/* RAW */}
        <section className="border-b border-admin-line p-5 xl:border-b-0 xl:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">Raw content</p>
          <pre className="scrollbar-thin mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-admin-line bg-admin-subtle p-4 text-xs leading-relaxed text-admin-ink">
            {entry.rawContent}
          </pre>
        </section>

        {/* JSON EDITOR */}
        <section className="border-b border-admin-line p-5 xl:border-b-0 xl:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">AI output (JSON · sửa được)</p>
          <form action={approveExtractionAction} className="mt-2 space-y-3">
            <input type="hidden" name="extractionId" value={entry.id} />
            <input type="hidden" name="reviewer" value="admin" />
            <textarea
              name="aiOutput"
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              spellCheck={false}
              className="scrollbar-thin h-96 w-full rounded-xl border border-admin-line bg-admin-surface p-4 font-mono text-xs text-admin-ink focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
            />
            {!preview.ok ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                JSON không hợp lệ · {preview.error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                ref={approveRef}
                type="submit"
                disabled={!preview.ok}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-google transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckIcon /> Approve & sync
                <kbd className="ml-1 rounded bg-white/20 px-1 font-mono text-[10px]">A</kbd>
              </button>
            </div>
          </form>
          <div className="mt-2 flex flex-wrap gap-2">
            <form action={retryExtractionAction}>
              <input type="hidden" name="extractionId" value={entry.id} />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-4 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
              >
                <RetryIcon /> Retry AI
              </button>
            </form>
            <form action={rejectExtractionAction}>
              <input type="hidden" name="extractionId" value={entry.id} />
              <input type="hidden" name="reviewer" value="admin" />
              <input type="hidden" name="reason" value="Manual rejection from admin panel" />
              <button
                ref={rejectRef}
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-full border border-red-200 bg-white px-4 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                <XIcon /> Reject
                <kbd className="ml-1 rounded bg-red-50 px-1 font-mono text-[10px]">R</kbd>
              </button>
            </form>
          </div>
        </section>

        {/* PREVIEW */}
        <section className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">Preview như user thấy</p>
          {preview.ok ? (
            <PreviewCard view={preview.view} />
          ) : (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              <p className="font-semibold">JSON không hợp lệ — không thể preview & không thể Approve.</p>
              <p className="mt-1 font-mono">{preview.error}</p>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

type PreviewState =
  | { ok: true; view: ProductView }
  | { ok: false; error: string };

function buildPreview(
  jsonText: string,
  productId: string,
  productName: string,
  productNetwork: string
): PreviewState {
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(jsonText) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Output phải là object JSON." };
    }
    parsed = value as Record<string, unknown>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const fakeProduct: ProductItem = {
    id: productId,
    nicheId: "preview",
    network: productNetwork,
    name: productName,
    affiliateUrl: "#",
    scrapedData: parsed
  };
  return { ok: true, view: normalizeProduct(fakeProduct) };
}

function PreviewCard({ view }: { view: ProductView }): React.ReactElement {
  return (
    <div className="mt-2 space-y-3">
      <div className="overflow-hidden rounded-xl border border-admin-line bg-white shadow-card">
        <div className="relative aspect-square bg-canvas">
          {view.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.image} alt={view.name} className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-brand-50 via-white to-accent-50 text-2xl font-bold text-brand-700">
              {view.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {view.discountPercent && view.discountPercent > 0 ? (
            <span className="absolute left-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
              -{view.discountPercent}%
            </span>
          ) : null}
          {view.badge ? (
            <span className="absolute right-2 top-2 rounded-md bg-admin-ink/85 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {view.badge}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium text-admin-ink">{view.name}</p>
          {view.price !== undefined ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-sm font-bold text-brand-700 sm:text-base">{formatMoney(view.price, view.currency)}</span>
              {view.originalPrice && view.originalPrice > view.price ? (
                <span className="text-[11px] text-admin-mute line-through">
                  {formatMoney(view.originalPrice, view.currency)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-admin-mute">Liên hệ shop</p>
          )}
          {view.store ? <p className="text-[11px] text-admin-mute">{view.store}</p> : null}
          {view.rating !== undefined ? (
            <p className="text-[11px] text-admin-mute">
              <span className="text-amber-500">★</span> {view.rating.toFixed(1)}
              {view.reviewCount ? ` · ${formatNumber(view.reviewCount)} đánh giá` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {view.highlights && view.highlights.length > 0 ? (
        <div className="rounded-xl border border-admin-line bg-admin-subtle p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-admin-mute">Highlights</p>
          <ul className="mt-1.5 space-y-1 text-xs text-admin-ink">
            {view.highlights.slice(0, 4).map((entry, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-brand-500" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  return `${day} ngày trước`;
}

function CheckIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function XIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
  );
}

function RetryIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
