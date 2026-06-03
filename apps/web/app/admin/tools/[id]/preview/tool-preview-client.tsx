"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AdminButton } from "../../../../../components/admin/ui";
import { previewToolScoreAction } from "../../../actions";

interface QuizQuestion {
  id: string;
  question: string;
  type: string;
  required: boolean;
  weight: number;
  options?: { value: string | number; label: string; icon?: string }[];
  defaultValue?: string | number;
}

interface ToolPreviewClientProps {
  toolId: string;
  toolSlug: string;
  quizSchema: unknown;
  scoringRules: unknown;
  resultTemplate: unknown;
  nicheId: string;
  nicheSlug: string;
}

interface PreviewResult {
  ok: boolean;
  error?: string;
  scored?: {
    productId: string;
    score: number;
    confidenceLabel: string;
    matchedCriteria: { attribute: string; label: string; weight: number; matched: boolean }[];
    maxScore: number;
    earnedScore: number;
  }[];
  products?: { id: string; name: string; scrapedData: Record<string, unknown> }[];
}

export function ToolPreviewClient({
  toolId,
  toolSlug,
  quizSchema,
  nicheSlug
}: ToolPreviewClientProps): React.ReactElement {
  const schema = quizSchema as { questions: QuizQuestion[] };
  const questions = schema.questions ?? [];

  const [answers, setAnswers] = React.useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const q of questions) {
      if (q.defaultValue !== undefined) init[q.id] = q.defaultValue;
    }
    return init;
  });
  const [result, setResult] = React.useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setResult(null);
    try {
      const r = await previewToolScoreAction({
        toolId,
        toolSlug,
        nicheId,
        nicheSlug,
        userAttributes: answers
      });
      setResult(r);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-admin-mute">
          1. Trả lời quiz như user
        </h2>
        <div className="mt-3 space-y-5">
          {questions.map((q) => (
            <div key={q.id}>
              <label className="block text-sm font-semibold text-admin-ink">
                {q.question}
                {!q.required && (
                  <span className="ml-1 text-xs font-normal text-admin-mute">(optional)</span>
                )}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(q.options ?? []).map((opt) => {
                  const selected = answers[q.id] === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() =>
                        setAnswers((a) => ({
                          ...a,
                          [q.id]: selected ? "" : opt.value
                        }))
                      }
                      className={
                        selected
                          ? "rounded-full border-2 border-admin-accent bg-admin-accent/10 px-3 py-1.5 text-sm text-admin-accent"
                          : "rounded-full border-2 border-admin-line bg-white px-3 py-1.5 text-sm text-admin-ink hover:border-admin-accent"
                      }
                    >
                      {opt.icon && <span className="mr-1">{opt.icon}</span>}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <AdminButton onClick={handleSubmit} disabled={submitting} variant="primary">
            <Sparkles className="size-4" />
            {submitting ? "Đang chấm điểm..." : "Run scoring engine"}
          </AdminButton>
          <span className="text-xs text-admin-mute">Không tạo QuizSession row.</span>
        </div>
      </div>

      {result && (
        <div className="border-t border-admin-line pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-admin-mute">
            2. Kết quả scoring
          </h2>

          {!result.ok && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {result.error}
            </p>
          )}

          {result.ok && result.scored && result.scored.length > 0 && (
            <ol className="mt-3 space-y-3">
              {result.scored.map((s, idx) => {
                const product = result.products?.find((p) => p.id === s.productId);
                const scorePct = Math.round(s.score * 100);
                return (
                  <li
                    key={s.productId}
                    className="rounded-xl border border-admin-line bg-admin-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-admin-mute">
                          <span className="font-mono">#{idx + 1}</span>
                          <span className="font-medium text-admin-accent">{s.confidenceLabel}</span>
                          <span>·</span>
                          <span>
                            Score: <strong>{scorePct}%</strong> ({s.earnedScore}/{s.maxScore})
                          </span>
                        </div>
                        <h3 className="mt-1 font-semibold text-admin-ink">
                          {product?.name ?? "(product not found)"}
                        </h3>
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-admin-mute hover:text-admin-ink">
                        Match breakdown ({s.matchedCriteria.length} tiêu chí)
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs">
                        {s.matchedCriteria.map((c) => (
                          <li
                            key={c.attribute}
                            className={
                              c.matched
                                ? "flex items-center justify-between text-green-700"
                                : "flex items-center justify-between text-red-600"
                            }
                          >
                            <span>
                              {c.matched ? "✓" : "✗"} {c.label}{" "}
                              <span className="font-mono text-admin-mute">(w={c.weight})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>

                    {product?.scrapedData && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-admin-mute hover:text-admin-ink">
                          Product scrapedData
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-admin-bg p-2 font-mono text-[10px] text-admin-ink">
                          {JSON.stringify(product.scrapedData, null, 2)}
                        </pre>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {result.ok && (!result.scored || result.scored.length === 0) && (
            <p className="mt-3 text-sm text-admin-mute">
              Không product nào match — kiểm tra niche có ≥1 product PUBLISHED + hardFilters không
              quá nghiêm.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
