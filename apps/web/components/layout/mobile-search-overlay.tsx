"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Flame, Ticket, BookOpen } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const POPULAR_QUERIES = [
  "laptop gaming",
  "robot hút bụi",
  "tai nghe sony",
  "đồng hồ apple watch",
  "máy lọc không khí xiaomi",
  "kem chống nắng anessa",
  "iphone 15",
  "macbook m3"
];

const QUICK_LINKS = [
  { href: "/?sort=top", label: "Deal hot tuần", Icon: Flame },
  { href: "/khuyen-mai", label: "Mã giảm còn dùng", Icon: Ticket },
  { href: "/blog", label: "Cẩm nang mới", Icon: BookOpen }
];

/**
 * Full-screen mobile search. Auto-focus input on open; ESC/backdrop tap → close; submit
 * navigate `/?q=...` rồi close. Popular queries + quick links là static (chưa wired
 * search suggestion DB).
 */
export function MobileSearchOverlay({ open, onClose }: Props): React.ReactElement | null {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Tìm sản phẩm"
    >
      <div className="flex items-center gap-2 border-b border-line bg-canvas/95 px-3 py-2.5 backdrop-blur">
        <form onSubmit={submit} className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute">
            <Search className="size-4" />
          </span>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm deal, brand, danh mục…"
            aria-label="Tìm sản phẩm"
            className="h-11 w-full rounded-full border border-line bg-card pl-10 pr-3 text-sm text-ink placeholder:text-ink-mute focus:border-primary-300 focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </form>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng tìm kiếm"
          className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-card"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Section label="Tìm kiếm phổ biến">
          <div className="flex flex-wrap gap-2">
            {POPULAR_QUERIES.map((q) => (
              <Link
                key={q}
                href={`/?q=${encodeURIComponent(q)}`}
                onClick={onClose}
                className="inline-flex items-center rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-primary-300 hover:text-primary-700"
              >
                {q}
              </Link>
            ))}
          </div>
        </Section>

        <Section label="Truy cập nhanh">
          <div className="grid gap-2">
            {QUICK_LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-[14px] font-semibold text-ink hover:border-primary-300 hover:text-primary-700"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary-50 text-primary-700">
                  <Icon className="size-4" />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      {children}
    </div>
  );
}
