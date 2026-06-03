"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCookie, incrementCookie, setCookie } from "../../lib/cookies";

const POPULAR_NICHES = [
  { slug: "laptop", label: "Laptop" },
  { slug: "tai-nghe-tws", label: "Tai nghe TWS" },
  { slug: "robot-hut-bui-lau-nha", label: "Robot hút bụi" },
  { slug: "may-loc-khong-khi", label: "Máy lọc không khí" },
  { slug: "my-pham-skincare", label: "Mỹ phẩm" }
];

export function SubscribeModal(): React.ReactElement | null {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    if (/bot|crawl|spider|googlebot/i.test(navigator.userAgent)) return;

    // Increment visit count on every mount
    const visits = incrementCookie("dv_visits", 90);
    const subscribed = getCookie("dv_subscribed") === "1";
    const dismissed = getCookie("dv_modal_dismissed") === "1";
    const clicked = parseInt(getCookie("dv_clicked") ?? "0", 10) || 0;

    if (subscribed || dismissed) return;
    if (visits < 2 && clicked < 1) return;

    const timer = setTimeout(() => setOpen(true), 8000);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!open) return null;

  function toggleNiche(slug: string) {
    setPicked((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= 3) return cur;
      return [...cur, slug];
    });
  }

  function close(reason: "dismiss" | "ok") {
    setOpen(false);
    if (reason === "dismiss") setCookie("dv_modal_dismissed", "1", 30);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "modal_home", preferredNiches: picked })
      });
      if (!res.ok) throw new Error("subscribe failed");
      setCookie("dv_subscribed", "1", 365);
      setMessage({
        kind: "ok",
        text: `Đã gửi link xác nhận tới ${email}. Mở email để confirm đăng ký.`
      });
      setTimeout(() => close("ok"), 2500);
    } catch {
      setMessage({ kind: "error", text: "Đăng ký không thành công. Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close("dismiss");
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">📧 Nhận deal sớm</p>
            <h2 className="mt-1 text-xl font-bold text-ink">Nhận deal sớm nhất</h2>
          </div>
          <button
            type="button"
            onClick={() => close("dismiss")}
            aria-label="Đóng"
            className="grid size-8 place-items-center rounded-full text-ink-mute hover:bg-canvas"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-ink-soft">
          Mỗi 7:00 sáng, chúng tôi gửi top 5 deal hot + mã giảm còn dùng trong 24h. Không spam, huỷ bất kỳ lúc nào.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="vidu@gmail.com"
            className="h-11 w-full rounded-full border border-line bg-canvas px-4 text-sm"
          />

          <div>
            <p className="text-xs font-semibold text-ink-soft">Quan tâm danh mục: (tối đa 3)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR_NICHES.map((n) => {
                const active = picked.includes(n.slug);
                return (
                  <button
                    key={n.slug}
                    type="button"
                    onClick={() => toggleNiche(n.slug)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active ? "bg-primary-600 text-white" : "border border-line bg-canvas text-ink-soft hover:border-primary-300"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? "Đang gửi…" : "Đăng ký nhận deal"}
          </button>

          {message ? (
            <p className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
              {message.text}
            </p>
          ) : null}

          <p className="text-[11px] text-ink-mute">
            Bằng việc đăng ký, bạn đồng ý với{" "}
            <a href="/chinh-sach-bao-mat" className="underline">
              chính sách bảo mật
            </a>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
