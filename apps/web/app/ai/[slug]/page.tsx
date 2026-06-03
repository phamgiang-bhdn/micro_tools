import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchToolBySlug } from "../../../lib/api";
import { ToolHero } from "./tool-hero";
import { SessionRestoreBanner } from "../../../components/storefront/session-restore-banner";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string }>;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  required: boolean;
  weight: number;
  options?: { value: string | number; label: string; icon?: string }[];
  defaultValue?: string | number;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await fetchToolBySlug(slug);
  if (!tool) return { title: "Tool không tìm thấy" };

  const title = tool.seoTitle ?? `${tool.name} — DealVault`;
  const description =
    tool.seoDescription ??
    tool.description ??
    `AI giúp chọn ${tool.niche.name.toLowerCase()} phù hợp với nhu cầu của bạn trong 60 giây.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/ai/${slug}`
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    },
    alternates: {
      canonical: `/ai/${slug}`
    }
  };
}

export default async function ToolLandingPage({
  params,
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const { source } = await searchParams;
  const tool = await fetchToolBySlug(slug);

  if (!tool) notFound();

  const schema = tool.quizSchema as { questions: QuizQuestion[] };
  const heroQuestions = (schema.questions ?? []).filter((q) => q.required).slice(0, 3);
  const allQuestions = schema.questions ?? [];

  const tagline = tool.tagline ?? `🤖 AI chọn ${tool.niche.name.toLowerCase()} trong 60 giây`;

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold text-ink">
            🤖 DealVault
          </Link>
          <nav className="flex gap-4 text-sm text-ink-soft">
            <Link href="/blog" className="hover:text-ink">
              Blog
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{tagline}</h1>
          {tool.description && (
            <p className="mt-2 text-sm text-ink-soft sm:text-base">{tool.description}</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          <Badge>✓ Không quảng cáo</Badge>
          <Badge>✓ Spec verified</Badge>
          <Badge>✓ Cập nhật hàng tuần</Badge>
        </div>

        <SessionRestoreBanner currentToolSlug={tool.slug} />

        <ToolHero
          toolSlug={tool.slug}
          toolName={tool.name}
          nicheName={tool.niche.name}
          heroQuestions={heroQuestions}
          allQuestions={allQuestions}
          source={source}
        />

        <div className="mt-4 text-center">
          <Link
            href={`/ai/${slug}/quiz`}
            className="text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            Hoặc làm quiz từng câu một →
          </Link>
        </div>

        <section className="mt-10 rounded-2xl bg-white/60 p-5 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Tool hoạt động như nào?
          </h3>
          <ol className="mt-3 space-y-2 text-ink">
            <li>
              <span className="font-bold text-google-blue">1.</span> Trả lời 3 câu (hoặc mô tả tự nhiên).
            </li>
            <li>
              <span className="font-bold text-google-blue">2.</span> AI phân tích từ database spec thật + giá hôm nay.
            </li>
            <li>
              <span className="font-bold text-google-blue">3.</span> Nhận 3 gợi ý kèm lý do AI giải thích vì sao hợp với
              bạn.
            </li>
          </ol>
        </section>

        <p className="mt-6 text-center text-[11px] text-ink-soft">
          Affiliate disclosure: chúng tôi nhận hoa hồng từ sàn khi bạn mua qua link, nhưng đề xuất
          dựa trên spec + nhu cầu của bạn, không theo số tiền hoa hồng.
        </p>
      </section>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-ink-soft">
      {children}
    </span>
  );
}
