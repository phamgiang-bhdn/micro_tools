"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { submitWaitlistAction } from "../../actions/waitlist";

interface WaitlistFormProps {
  nicheSlug: string;
  nicheName: string;
  source?: string;
  surveyOptions: string[];
}

export function WaitlistForm({
  nicheSlug,
  nicheName,
  source,
  surveyOptions
}: WaitlistFormProps): React.ReactElement {
  const [email, setEmail] = useState("");
  const [surveyAnswer, setSurveyAnswer] = useState<string>("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitWaitlistAction({
        email,
        nicheSlug,
        surveyAnswer,
        source,
        honeypot
      });
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Có lỗi xảy ra");
      }
    });
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
        <div className="text-3xl">✓</div>
        <h3 className="mt-2 text-lg font-semibold text-ink">
          Đã ghi tên bạn vào waitlist!
        </h3>
        <p className="mt-2 text-sm text-ink-soft">
          Mình sẽ email cho bạn ngay khi AI tool {nicheName.toLowerCase()} sẵn sàng.
        </p>
        <ShareBox nicheName={nicheName} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="company"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {surveyOptions.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-ink">
            Bạn đang cần chọn loại nào?
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {surveyOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSurveyAnswer(opt)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  surveyAnswer === opt
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-line bg-white text-ink hover:border-primary-600"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="waitlist-email" className="block text-sm font-semibold text-ink">
          Email của bạn
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-xl border border-line px-4 py-3 text-base text-ink outline-none focus:border-primary-600"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <Button type="submit" variant="brand" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Đang gửi..." : "🔔 Thông báo cho tôi khi launch"}
      </Button>

      <p className="text-center text-xs text-ink-soft">
        Mình chỉ email khi có deal phù hợp. Không spam, có nút unsubscribe.
      </p>
    </form>
  );
}

function ShareBox({ nicheName }: { nicheName: string }): React.ReactElement {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Sắp có AI giúp chọn ${nicheName} — DealVault`;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("✓ Đã copy link!");
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="text-sm font-medium text-ink">Chia sẻ cho bạn bè cùng đăng ký:</p>
      <div className="mt-3 flex justify-center gap-3">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink hover:border-primary-600"
        >
          Facebook
        </a>
        <a
          href={`https://zalo.me/share?u=${encodeURIComponent(shareUrl)}&t=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink hover:border-primary-600"
        >
          Zalo
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink hover:border-primary-600"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
