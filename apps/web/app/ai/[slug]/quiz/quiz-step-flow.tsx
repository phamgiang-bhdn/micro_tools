"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { submitToolSession } from "../../../actions/tool-session";

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  required: boolean;
  weight: number;
  options?: { value: string | number; label: string; icon?: string }[];
  defaultValue?: string | number;
  helper?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface QuizStepFlowProps {
  toolSlug: string;
  toolName: string;
  nicheName: string;
  questions: QuizQuestion[];
  source?: string;
}

export function QuizStepFlow({
  toolSlug,
  nicheName,
  questions,
  source
}: QuizStepFlowProps): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      if (q.defaultValue !== undefined) init[q.id] = q.defaultValue;
    }
    return init;
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center">
        <p className="text-sm text-ink-soft">Quiz chưa được cấu hình.</p>
      </div>
    );
  }

  const current = questions[step]!;
  const isLast = step === questions.length - 1;
  const total = questions.length;
  const progress = ((step + 1) / total) * 100;
  const hasAnswer = answers[current.id] !== undefined && answers[current.id] !== "";

  const goNext = (): void => {
    if (!current.required || hasAnswer) {
      setStep((s) => Math.min(s + 1, total - 1));
    }
  };

  const goBack = (): void => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (): Promise<void> => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      const result = await submitToolSession({
        toolSlug,
        quizAnswers: answers,
        source
      });
      if (!result.ok) {
        setErrorMsg(result.error ?? "Có lỗi xảy ra");
        setSubmitting(false);
        return;
      }
      router.push(`/ai/${toolSlug}/result/${result.sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định");
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-card">
        <Sparkles className="mx-auto size-8 animate-pulse text-google-blue" />
        <h2 className="mt-3 text-lg font-semibold text-ink">AI đang phân tích nhu cầu...</h2>
        <p className="mt-1 text-xs text-ink-soft">Mất vài giây để xếp hạng sản phẩm.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span>
            Câu {step + 1}/{total}
          </span>
          <span>{nicheName}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-brand-gradient transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{current.question}</h2>
        {current.helper && (
          <p className="mt-1.5 text-sm text-ink-soft">{current.helper}</p>
        )}
        {!current.required && (
          <p className="mt-1.5 text-xs text-ink-soft">(Không bắt buộc — có thể bỏ qua)</p>
        )}

        <div className="mt-6">
          {current.type === "single" || current.type === "picture" ? (
            <SingleChoice
              question={current}
              value={answers[current.id]}
              onChange={(v) => {
                setAnswers((a) => ({ ...a, [current.id]: v }));
                if (!isLast) setTimeout(goNext, 250);
              }}
            />
          ) : current.type === "number" ? (
            <NumberInput
              question={current}
              value={answers[current.id] as number | undefined}
              onChange={(v) => setAnswers((a) => ({ ...a, [current.id]: v }))}
            />
          ) : (
            <div className="text-sm text-ink-soft">
              Question type "{current.type}" chưa hỗ trợ ở quiz step. Trả lời ở hero.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
          <ChevronLeft className="size-4" /> Quay lại
        </Button>
        {isLast ? (
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={handleSubmit}
            disabled={current.required && !hasAnswer}
          >
            🤖 Xem kết quả AI →
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={goNext}
            disabled={current.required && !hasAnswer}
          >
            Tiếp <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {!current.required && !hasAnswer && !isLast && (
        <button
          type="button"
          onClick={goNext}
          className="mx-auto block text-sm text-ink-soft hover:text-ink hover:underline"
        >
          Bỏ qua câu này →
        </button>
      )}

      {errorMsg && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function SingleChoice({
  question,
  value,
  onChange
}: {
  question: QuizQuestion;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}): React.ReactElement {
  const options = question.options ?? [];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            type="button"
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={
              selected
                ? "flex items-center gap-3 rounded-2xl border-2 border-google-blue bg-google-blue/5 p-4 text-left transition"
                : "flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-4 text-left transition hover:border-google-blue"
            }
          >
            {opt.icon && <span className="text-2xl">{opt.icon}</span>}
            <span className="text-base font-medium text-ink">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NumberInput({
  question,
  value,
  onChange
}: {
  question: QuizQuestion;
  value: number | undefined;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      min={question.min}
      max={question.max}
      step={question.step ?? 1}
      placeholder="Nhập số..."
      className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-lg text-ink outline-none focus:border-google-blue"
    />
  );
}
