import type { Metadata } from "next";
import type React from "react";
import { BRAND } from "../../lib/brand";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: `Liên hệ ${BRAND.name}`,
  description: `Gửi câu hỏi, đề xuất sản phẩm, báo giá lỗi tới team ${BRAND.name}.`,
  alternates: { canonical: "/lien-he" }
};

export default function ContactPage(): React.ReactElement {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Liên hệ</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Gửi tin nhắn cho {BRAND.name}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Email trực tiếp: <a className="text-brand-700 hover:underline" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
        </p>
      </header>
      <ContactForm />
    </article>
  );
}
