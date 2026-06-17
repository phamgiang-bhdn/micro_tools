"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Search, ShoppingCart, Sparkles } from "lucide-react";
import { formatMoney, normalizeProduct } from "../../lib/format";
import { trackAndRedirectAction } from "../../app/actions/tracking";
import { askAssistant, type AssistantAnswer, type AssistantPick } from "../../app/actions/assistant";
import { DealVerdictBadge } from "./deal-verdict-badge";

const EXAMPLES = [
  "máy lọc nước cho nhà 4 người dưới 8 triệu",
  "robot hút bụi nhà có thú cưng",
  "kem chống nắng cho da dầu"
];

const THINKING_STEPS = [
  "Đang hiểu nhu cầu của bạn…",
  "Đang đối chiếu giá hôm nay…",
  "Đang chọn sản phẩm hợp nhất…"
];

type Status = "idle" | "thinking" | "done" | "error";

/**
 * AI shopping assistant — trung tâm storefront (clean như Google). 1 ô hỏi → AI trả lời:
 * reasoning hiện dần (streaming-feel) → intro + 1-3 gợi ý có verdict giá + lý do → câu hỏi tiếp.
 */
export function AiAssistant(): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [answer, setAnswer] = React.useState<AssistantAnswer | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [step, setStep] = React.useState(0);

  // Reasoning steps chạy dần khi đang chờ AI (cảm giác "AI đang suy nghĩ").
  React.useEffect(() => {
    if (status !== "thinking") return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 900);
    return () => clearInterval(id);
  }, [status]);

  const run = React.useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setStatus("thinking");
    setAnswer(null);
    setErrorMsg("");
    const res = await askAssistant(trimmed);
    if ("error" in res) {
      setErrorMsg(res.error);
      setStatus("error");
    } else {
      setAnswer(res);
      setStatus("done");
    }
  }, []);

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void run(query);
  };

  const askFollowup = (q: string): void => {
    setQuery(q);
    void run(q);
  };

  return (
    <section className="relative bg-surface">
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-12 sm:pt-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[34px] sm:leading-tight">
            Hỏi AI nên mua gì
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">
            Mô tả nhu cầu — AI gợi ý sản phẩm hợp nhất, kèm <span className="font-medium text-ink">giá thật &amp; cảnh báo giá ảo</span>.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6">
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 shadow-card-md ring-1 ring-border transition focus-within:ring-2 focus-within:ring-primary-400">
            <Search className="size-5 shrink-0 text-ink-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bạn cần mua gì?"
              aria-label="Mô tả nhu cầu mua sắm"
              className="h-9 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-mute"
            />
            <button
              type="submit"
              disabled={status === "thinking" || query.trim().length < 2}
              aria-label="Hỏi AI"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-40 ring-focus"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </form>

        {status === "idle" ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => askFollowup(ex)}
                className="rounded-full bg-canvas px-3 py-1.5 text-[12.5px] text-ink-soft ring-1 ring-border transition hover:text-primary-700 hover:ring-primary-300"
              >
                {ex}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          {status === "thinking" ? <ThinkingBlock step={step} /> : null}
          {status === "error" ? (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{errorMsg}</p>
          ) : null}
          {status === "done" && answer ? <AnswerBlock answer={answer} onFollowup={askFollowup} /> : null}
        </div>
      </div>
    </section>
  );
}

function ThinkingBlock({ step }: { step: number }): React.ReactElement {
  return (
    <div className="rounded-2xl bg-canvas p-4 ring-1 ring-border">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary-700">
        <Sparkles className="size-4 animate-pulse" /> 🤖 AI đang phân tích
      </p>
      <ul className="mt-3 space-y-1.5">
        {THINKING_STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 text-[13.5px] transition ${
              i <= step ? "text-ink" : "text-ink-mute/50"
            }`}
          >
            <span className={`size-1.5 rounded-full ${i < step ? "bg-success" : i === step ? "bg-primary-500" : "bg-border-strong"}`} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerBlock({
  answer,
  onFollowup
}: {
  answer: AssistantAnswer;
  onFollowup: (q: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-primary-50 p-4 ring-1 ring-primary-200">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-700">
          <Sparkles className="size-3.5" /> 🤖 AI gợi ý
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{answer.intro}</p>
      </div>

      {answer.picks.length > 0 ? (
        <div className="space-y-3">
          {answer.picks.map((pick) => (
            <AssistantPickCard key={pick.id} pick={pick} />
          ))}
        </div>
      ) : null}

      {answer.followups.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.followups.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFollowup(f)}
              className="rounded-full bg-canvas px-3 py-1.5 text-[12.5px] text-ink-soft ring-1 ring-border transition hover:text-primary-700 hover:ring-primary-300"
            >
              {f}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssistantPickCard({ pick }: { pick: AssistantPick }): React.ReactElement {
  const view = normalizeProduct(pick);
  const detailHref = `/categories/${pick.nicheSlug}/${pick.slug ?? pick.id}`;

  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border transition hover:ring-primary-300">
      <Link href={detailHref} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-canvas ring-focus sm:size-28">
        {view.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.image} alt={view.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-ink-mute">—</div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={detailHref} className="ring-focus">
          <p className="line-clamp-2 text-[14px] font-medium leading-snug text-ink hover:text-primary-700">
            {view.name}
          </p>
        </Link>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          {view.price !== undefined ? (
            <span className="text-[16px] font-bold text-ink">{formatMoney(view.price, view.currency)}</span>
          ) : (
            <span className="text-sm font-medium text-ink-soft">Liên hệ shop</span>
          )}
          {view.originalPrice && view.price && view.originalPrice > view.price ? (
            <span className="text-[11px] text-ink-mute line-through">{formatMoney(view.originalPrice, view.currency)}</span>
          ) : null}
          <DealVerdictBadge intel={view.priceIntel} size="xs" />
        </div>

        {pick.reason ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">
            <span className="font-medium text-primary-700">🤖 </span>
            {pick.reason}
          </p>
        ) : null}

        {pick.affiliateUrl ? (
          <form action={trackAndRedirectAction} className="mt-auto pt-2">
            <input type="hidden" name="productId" value={pick.id} />
            <input type="hidden" name="affiliateUrl" value={pick.affiliateUrl} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cta-500 px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-cta-400 ring-focus"
            >
              <ShoppingCart className="size-3.5" /> Xem deal
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
