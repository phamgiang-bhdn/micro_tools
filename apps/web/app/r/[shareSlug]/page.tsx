import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchToolSessionByShareSlug } from "../../../lib/api";
import { ExpiredSessionNotice } from "../../../components/storefront/expired-session-notice";
import { logDeadEnd } from "../../../lib/dead-end";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareSlug } = await params;
  const session = await fetchToolSessionByShareSlug(shareSlug);
  // STORY 1-1 (review #1): share hết hạn render 200 → phải noindex,nofollow để khỏi bị index
  // như thin-content (soft-404).
  if (!session) return { title: "Link không tồn tại", robots: { index: false, follow: false } };
  return {
    title: `AI gợi ý ${session.tool.niche.name} — DealVault`,
    description: `Xem 3 sản phẩm AI đã gợi ý cho 1 người dùng — bạn có hợp không?`,
    robots: { index: false, follow: true }
  };
}

/**
 * /r/[shareSlug] — viral share entry point.
 * Resolve share slug → redirect tới /ai/[toolSlug]/result/[sessionId] với `?source=share-link`.
 */
export default async function ShareRedirectPage({ params }: PageProps): Promise<React.ReactElement> {
  const { shareSlug } = await params;
  const session = await fetchToolSessionByShareSlug(shareSlug);

  // STORY 1-1: share link hết hạn → "phiên hết hạn" (không suy ra được tool → CTA về trang chủ)
  // thay vì 404 generic → giữ chút cơ hội kéo user vào lại.
  if (!session) {
    logDeadEnd("share-expired", { share: shareSlug });
    return <ExpiredSessionNotice toolSlug={null} />;
  }

  redirect(
    `/ai/${session.tool.slug}/result/${session.id}?source=share-link`
  );
}
