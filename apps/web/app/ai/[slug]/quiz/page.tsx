import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchToolBySlug } from "../../../../lib/api";
import { QuizStepFlow } from "./quiz-step-flow";

export const dynamic = "force-dynamic";

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
  helper?: string;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await fetchToolBySlug(slug);
  return {
    title: `Quiz · ${tool?.name ?? "DealVault AI"}`,
    description: `Trả lời ${tool?.niche.name.toLowerCase() ?? "câu hỏi"} từng câu một — AI gợi ý sản phẩm hợp.`,
    robots: { index: false, follow: false }
  };
}

export default async function QuizPage({
  params,
  searchParams
}: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const { source } = await searchParams;
  const tool = await fetchToolBySlug(slug);
  if (!tool) notFound();

  const schema = tool.quizSchema as { questions: QuizQuestion[] };
  const questions = schema.questions ?? [];

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href={`/ai/${slug}`} className="text-sm text-ink-soft hover:text-ink">
            ← Hero
          </Link>
          <Link href="/" className="text-sm font-semibold text-ink">
            🤖 DealVault
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <QuizStepFlow
          toolSlug={slug}
          toolName={tool.name}
          nicheName={tool.niche.name}
          questions={questions}
          source={source}
        />
      </section>
    </main>
  );
}
