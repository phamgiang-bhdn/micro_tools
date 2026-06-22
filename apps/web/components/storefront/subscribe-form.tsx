"use client";

import * as React from "react";
import { getCookie, setCookie } from "../../lib/cookies";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubscribeFormProps {
  /** Nguồn lead để backend phân loại (vd "home_empty", "modal_home"). */
  source: string;
  /** Niche quan tâm (modal truyền vào; inline để rỗng). */
  preferredNiches?: string[];
  /** Slot giữa email và nút — vd niche-picker của modal. */
  children?: React.ReactNode;
  submitLabel?: string;
  /** Gọi khi đăng ký thành công (vd modal đóng sau delay). */
  onSuccess?: () => void;
  className?: string;
}

/**
 * Lõi đăng ký nhận deal — DÙNG CHUNG giữa subscribe-modal (auto popup) và CTA inline ở home empty-state.
 * Sở hữu: email + honeypot + validate + POST /api/subscribe + cookie `dv_subscribed`.
 * KHÔNG chứa niche-picker (modal-specific) — truyền qua `children` + `preferredNiches`.
 */
export function SubscribeForm({
  source,
  preferredNiches = [],
  children,
  submitLabel = "Đăng ký nhận deal",
  onSuccess,
  className
}: SubscribeFormProps): React.ReactElement {
  const [email, setEmail] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  // AC5/story: đã đăng ký rồi → không nag form trống lại.
  React.useEffect(() => {
    if (getCookie("dv_subscribed") === "1") setStatus("success");
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    // Honeypot: bot điền field ẩn → short-circuit, KHÔNG gọi API (mirror waitlist action).
    if (honeypot.length > 0) {
      setStatus("success");
      return;
    }
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setErrorMsg("Email không hợp lệ");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value, source, preferredNiches })
        });
        if (!res.ok) throw new Error("subscribe failed");
        setCookie("dv_subscribed", "1", 365);
        setStatus("success");
        onSuccess?.();
      } catch {
        setStatus("error");
        // GIỮ email đã gõ (không reset) → user retry được.
        setErrorMsg("Đăng ký lỗi, thử lại sau ít phút.");
      }
    });
  };

  if (status === "success") {
    return (
      <p className={className} role="status">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success-ink">
          Đã đăng ký — sẽ báo bạn deal đầu tiên.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {/* Honeypot ẩn khỏi người dùng, bot có xu hướng điền. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      />
      <input
        type="email"
        name="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@cua-ban.com"
        aria-label="Email nhận deal"
        className="h-11 w-full rounded-xl border border-border bg-canvas px-4 text-sm text-ink outline-none ring-focus placeholder:text-ink-mute focus:border-primary-400"
      />
      {children}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700 disabled:opacity-60"
      >
        {isPending ? "Đang gửi…" : submitLabel}
      </button>
      {status === "error" ? <p className="text-sm font-medium text-danger-ink">{errorMsg}</p> : null}
    </form>
  );
}
