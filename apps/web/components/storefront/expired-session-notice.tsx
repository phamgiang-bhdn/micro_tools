import type React from "react";
import Link from "next/link";

interface Props {
  /** Tool slug nếu suy ra được (từ URL result page) → CTA "Làm lại quiz". Null (share link) → CTA về trang chủ. */
  toolSlug: string | null;
}

/**
 * STORY 1-1: trạng thái "phiên gợi ý đã hết hạn" — thay cho 404 generic khi session/share
 * không còn. Copy phải KHÁC rõ với not-found ("đường dẫn không đúng") và empty-state:
 * ở đây nội dung là phù du (per-user, hết hạn), nên hướng user làm lại quiz.
 */
export function ExpiredSessionNotice({ toolSlug }: Props): React.ReactElement {
  const ctaHref = toolSlug ? `/ai/${toolSlug}` : "/";
  const ctaLabel = toolSlug ? "Làm lại quiz →" : "Về trang chủ →";

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-1.5 text-xs font-medium text-ink">
          ⏳ Phiên đã hết hạn
        </div>
        <h1 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">Phiên gợi ý đã hết hạn</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Kết quả AI chỉ giữ trong thời gian ngắn cho mỗi lượt. Bạn làm lại trong 60 giây để nhận
          gợi ý mới nhất kèm giá hôm nay nhé.
        </p>
        <Link
          href={ctaHref}
          className="mt-6 inline-flex items-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          {ctaLabel}
        </Link>
      </div>
    </main>
  );
}
