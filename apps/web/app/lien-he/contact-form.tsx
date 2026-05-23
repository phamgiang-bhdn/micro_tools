"use client";

import type React from "react";
import { useState } from "react";

const KINDS = [
  { value: "bug", label: "Báo giá lỗi" },
  { value: "suggest", label: "Đề xuất sản phẩm" },
  { value: "partner", label: "Hợp tác" },
  { value: "other", label: "Khác" }
];

export function ContactForm(): React.ReactElement {
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          kind: fd.get("kind"),
          message: fd.get("message")
        })
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("ok");
      setMessage("Đã nhận tin nhắn của bạn. Chúng tôi sẽ trả lời qua email trong 1-2 ngày làm việc.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Gửi không thành công. Vui lòng thử lại hoặc email trực tiếp cho chúng tôi.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <Field label="Họ tên" name="name" required />
      <Field label="Email" name="email" type="email" required />
      <div>
        <label className="text-sm font-semibold text-ink">Loại liên hệ</label>
        <select
          name="kind"
          required
          className="mt-1 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
          defaultValue="bug"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-semibold text-ink">Tin nhắn</label>
        <textarea
          name="message"
          required
          rows={5}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {status === "submitting" ? "Đang gửi…" : "Gửi tin nhắn"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}): React.ReactElement {
  return (
    <div>
      <label className="text-sm font-semibold text-ink">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink"
      />
    </div>
  );
}
