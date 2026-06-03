"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, MessageSquare, ListChecks } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { submitToolSession } from "../../actions/tool-session";

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  required: boolean;
  weight: number;
  options?: { value: string | number; label: string; icon?: string }[];
  defaultValue?: string | number;
}

interface ToolHeroProps {
  toolSlug: string;
  toolName: string;
  nicheName: string;
  heroQuestions: QuizQuestion[];
  allQuestions: QuizQuestion[];
  source?: string;
}

const PLACEHOLDER_BY_NICHE: Record<string, string> = {
  default: "Vd: Nhà 4 người, dùng nước máy, tầm 8tr, cần lau ướt được..."
};

export function ToolHero({
  toolSlug,
  toolName,
  nicheName,
  heroQuestions,
  allQuestions,
  source
}: ToolHeroProps): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = React.useState<"quiz" | "chat">("quiz");
  const [answers, setAnswers] = React.useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of heroQuestions) {
      if (q.defaultValue !== undefined) init[q.id] = q.defaultValue;
    }
    return init;
  });
  const [chatMessage, setChatMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [thinking, setThinking] = React.useState<string[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string>("");

  const placeholder = PLACEHOLDER_BY_NICHE[toolSlug] ?? PLACEHOLDER_BY_NICHE.default;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    setThinking([]);

    // Optimistic "AI thinking" stream — fake progressive UX so user doesn't bounce on 3s wait.
    const steps =
      mode === "chat"
        ? [
            "🔍 Đang phân tích nhu cầu của bạn...",
            `📦 Đang quét sản phẩm trong database ${nicheName.toLowerCase()}...`,
            "🤖 AI đang chấm điểm và xếp hạng..."
          ]
        : [
            "📦 Đang lọc sản phẩm theo nhu cầu của bạn...",
            "🤖 AI đang viết lý do gợi ý cho từng sản phẩm..."
          ];
    let stepIdx = 0;
    const tickRef = { current: 0 } as { current: ReturnType<typeof setInterval> | 0 };
    tickRef.current = setInterval(() => {
      if (stepIdx < steps.length) {
        setThinking((prev) => [...prev, steps[stepIdx]!]);
        stepIdx += 1;
      }
    }, 700);

    try {
      const result = await submitToolSession({
        toolSlug,
        chatMessage: mode === "chat" ? chatMessage.trim() : undefined,
        quizAnswers: mode === "quiz" ? answers : undefined,
        source
      });

      clearInterval(tickRef.current as ReturnType<typeof setInterval>);

      if (!result.ok) {
        if (result.needsQuiz) {
          setErrorMsg("AI chưa hiểu mô tả — vui lòng dùng quiz hoặc mô tả cụ thể hơn.");
          setMode("quiz");
        } else {
          setErrorMsg(result.error ?? "Có lỗi xảy ra, thử lại sau.");
        }
        setSubmitting(false);
        return;
      }

      router.push(`/ai/${toolSlug}/result/${result.sessionId}`);
    } catch (err) {
      clearInterval(tickRef.current as ReturnType<typeof setInterval>);
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định");
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="mt-8 rounded-3xl border border-line bg-white p-8 shadow-card">
        <div className="text-center">
          <Sparkles className="mx-auto size-8 animate-pulse text-primary-600" />
          <h2 className="mt-3 text-lg font-semibold text-ink">AI đang phân tích...</h2>
          <p className="mt-1 text-xs text-ink-soft">Chỉ mất vài giây.</p>
        </div>
        <ul className="mt-6 space-y-2 text-sm text-ink">
          {thinking.map((step, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 animate-in fade-in slide-in-from-left-2 duration-300"
            >
              {step}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ListChecks className="size-4 text-primary-600" />
          Trả lời nhanh 3 câu
        </div>

        <div className="mt-4 space-y-5">
          {heroQuestions.map((q, idx) => (
            <QuestionBlock
              key={q.id}
              index={idx + 1}
              total={heroQuestions.length}
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}
        </div>

        {mode === "quiz" && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-soft">
              {heroQuestions.length < allQuestions.length && (
                <>Sau đó tinh chỉnh thêm {allQuestions.length - heroQuestions.length} câu nếu cần.</>
              )}
            </p>
            <Button type="submit" variant="brand" size="lg" disabled={submitting}>
              🤖 Hỏi AI →
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-ink-soft">
        <div className="h-px flex-1 bg-line" />
        <span>Hoặc mô tả tự nhiên</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MessageSquare className="size-4 text-primary-600" />
          Mô tả nhu cầu bằng câu của bạn
        </label>
        <textarea
          className="mt-3 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-primary-600"
          rows={2}
          value={chatMessage}
          onChange={(e) => {
            setChatMessage(e.target.value);
            if (e.target.value.length > 0) setMode("chat");
            else setMode("quiz");
          }}
          placeholder={placeholder}
          maxLength={2000}
        />
        {mode === "chat" && (
          <div className="mt-3 flex justify-end">
            <Button type="submit" variant="brand" size="md" disabled={submitting || chatMessage.trim().length < 5}>
              🤖 Gửi cho AI →
            </Button>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink">
          {errorMsg}
        </p>
      )}
    </form>
  );
}

function QuestionBlock({
  index,
  total,
  question,
  value,
  onChange
}: {
  index: number;
  total: number;
  question: QuizQuestion;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}): React.ReactElement {
  const options = question.options ?? [];

  return (
    <div>
      <div className="text-sm font-medium text-ink">
        <span className="mr-2 text-xs text-ink-soft">
          {index}/{total}
        </span>
        {question.question}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              type="button"
              key={String(opt.value)}
              onClick={() => onChange(opt.value)}
              className={
                selected
                  ? "rounded-full border border-primary-600 bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink transition hover:border-primary-600 hover:text-primary-600"
              }
            >
              {opt.icon && <span className="mr-1">{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
