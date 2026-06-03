import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fetchToolSessionByShareSlug } from "../../../lib/api";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareSlug } = await params;
  const session = await fetchToolSessionByShareSlug(shareSlug);
  if (!session) return { title: "Link không tồn tại" };
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
  if (!session) notFound();

  redirect(
    `/ai/${session.tool.slug}/result/${session.id}?source=share-link`
  );
}
