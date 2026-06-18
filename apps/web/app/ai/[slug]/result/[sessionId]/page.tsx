import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchToolBySlug, fetchToolSession } from "../../../../../lib/api";
import { normalizeProduct } from "../../../../../lib/format";
import { ExpiredSessionNotice } from "../../../../../components/storefront/expired-session-notice";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { logDeadEnd } from "../../../../../lib/dead-end";
import { ResultCards, type ResultCardsProps } from "./result-cards";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await fetchToolBySlug(slug);
  return {
    title: `Kết quả AI · ${tool?.name ?? "DealVault"}`,
    description: `AI gợi ý 3 sản phẩm phù hợp nhất với nhu cầu của bạn.`,
    robots: { index: false, follow: false } // Result pages per-user, không index
  };
}

export default async function ResultPage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug, sessionId } = await params;
  const session = await fetchToolSession(sessionId);

  // STORY 1-1: session không còn → "phiên hết hạn" (CTA làm lại quiz) thay vì 404 generic.
  if (!session) {
    logDeadEnd("session-expired", { session: sessionId });
    return <ExpiredSessionNotice toolSlug={slug} />;
  }
  // slug không khớp tool của session = URL bị sửa/sai → 404 thật.
  if (session.tool.slug !== slug) {
    notFound();
  }

  // Fetch product detail cho recommended IDs.
  // STORY 1-4 (+review): fetch niche MỘT lần (trước đây map N id → N fetch cùng 1 endpoint) →
  // tiết kiệm + làm `productFetchFailed` KHÔNG mơ hồ (1 fetch: lỗi hay không). null do find()
  // không thấy id = no-match, KHÔNG phải lỗi tải.
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
  let productFetchFailed = false;
  let nicheProducts: Array<{ id: string; [k: string]: unknown }> = [];
  try {
    const res = await fetch(`${apiBase}/niches/${session.tool.niche.slug}`, { cache: "no-store" });
    if (!res.ok) {
      productFetchFailed = true;
    } else {
      const niche = (await res.json()) as { products?: unknown[] };
      nicheProducts = (niche.products ?? []) as Array<{ id: string; [k: string]: unknown }>;
    }
  } catch {
    productFetchFailed = true;
  }
  const productList = session.recommendedProductIds
    .map((id) => nicheProducts.find((p) => p.id === id) ?? null)
    .filter(Boolean) as Array<{ id: string; [k: string]: unknown }>;

  // Dedupe + normalize
  const seen = new Set<string>();
  const normalized: ResultCardsProps["products"] = [];
  for (const p of productList) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const view = normalizeProduct(p as never);
    normalized.push({
      id: p.id,
      view,
      affiliateUrl: (p as { affiliateUrl?: string }).affiliateUrl ?? "",
      raw: p as Record<string, unknown>
    });
  }

  // Sort theo order of recommendedProductIds (top score first)
  normalized.sort(
    (a, b) =>
      session.recommendedProductIds.indexOf(a.id) - session.recommendedProductIds.indexOf(b.id)
  );

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-ink">
            🤖 DealVault
          </Link>
          <Link href={`/ai/${slug}`} className="text-xs text-ink-soft hover:text-ink">
            Làm lại quiz →
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
            <span className="inline-block size-1.5 rounded-full bg-white/80" />
            🤖 AI đã chọn cho bạn
          </div>
          <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            🤖 {normalized.length} {session.tool.niche.name.toLowerCase()} hợp với nhu cầu của bạn
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Dựa trên: <ProfileSummary attributes={session.parsedAttributes} />
          </p>
        </div>

        {normalized.length === 0 ? (
          productFetchFailed ? (
            // STORY 1-4: LỖI TẢI — reuse atom EmptyState tone="error" (cùng họ với các trạng thái khác).
            <div className="mt-10">
              <EmptyState
                tone="error"
                title="Không tải được gợi ý"
                description={
                  <p>
                    Có lỗi khi lấy dữ liệu sản phẩm.{" "}
                    <Link href={`/ai/${slug}/result/${sessionId}`} className="font-semibold text-primary-600 hover:underline">
                      Thử lại
                    </Link>{" "}
                    hoặc{" "}
                    <Link href={`/ai/${slug}`} className="font-semibold text-primary-600 hover:underline">
                      làm lại quiz
                    </Link>
                    .
                  </p>
                }
              />
            </div>
          ) : (
            // STORY 1-4: KHÔNG khớp (fetch OK, quiz không ra sản phẩm) — khác hẳn lỗi tải.
            <div className="mt-10 rounded-2xl border border-line bg-white p-8 text-center">
              <p className="text-base text-ink">
                Chưa có sản phẩm khớp nhu cầu của bạn.{" "}
                <Link href={`/ai/${slug}`} className="font-semibold text-primary-600 hover:underline">
                  Thử lại với nhu cầu khác →
                </Link>
              </p>
            </div>
          )
        ) : (
          <ResultCards
            products={normalized}
            session={session}
            toolSlug={slug}
          />
        )}

        <TrustSection toolSlug={slug} sessionTool={session.tool} />

        <p className="mt-8 text-center text-[11px] text-ink-soft">
          Affiliate disclosure: chúng tôi nhận hoa hồng từ sàn khi bạn mua qua link. AI rank theo độ
          phù hợp, không theo hoa hồng.
        </p>
      </section>
    </main>
  );
}

function ProfileSummary({ attributes }: { attributes: Record<string, unknown> }): React.ReactElement {
  const filtered = Object.entries(attributes).filter(
    ([k, v]) =>
      k !== "_confidence" &&
      v !== null &&
      v !== undefined &&
      v !== "" &&
      v !== "unknown"
  );
  if (filtered.length === 0) {
    return <span className="font-medium text-ink">nhu cầu của bạn</span>;
  }
  return (
    <span className="font-medium text-ink">
      {filtered
        .slice(0, 4)
        .map(([_, v]) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
        .join(" · ")}
    </span>
  );
}

function TrustSection({
  sessionTool
}: {
  toolSlug: string;
  sessionTool: { niche: { name: string } };
}): React.ReactElement {
  return (
    <section className="mt-10 rounded-2xl border border-line bg-white/60 p-5 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        🤖 AI dựa trên đâu?
      </h3>
      <ul className="mt-3 space-y-1.5 text-ink">
        <li className="flex items-start gap-2">
          <span className="text-primary-600">✓</span>
          <span>Database {sessionTool.niche.name.toLowerCase()} đã admin duyệt từng sản phẩm</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary-600">✓</span>
          <span>Spec từ trang chính hãng + crawler Accesstrade</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-primary-600">✓</span>
          <span>Giá hôm nay từ Tiki/Shopee/Lazada</span>
        </li>
      </ul>
    </section>
  );
}
