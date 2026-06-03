"use client";

import * as React from "react";
import { Loader2, Bookmark, X } from "lucide-react";

interface InterstitialRedirectProps {
  open: boolean;
  onClose: () => void;
  destination: string;
  marketplace: string;
  saveLink?: string;
  saveLabel?: string;
}

const MARKETPLACE_LABEL: Record<string, string> = {
  tiki: "Tiki",
  shopee: "Shopee",
  lazada: "Lazada",
  tiktokshop: "TikTok Shop",
  default: "trang sản phẩm"
};

/**
 * Story 4.10 — Interstitial 2s trước khi redirect Tiki/Shopee.
 * Cho user cơ hội lưu link result trước khi mất context.
 *
 * Caller phải gọi createTrackingRedirect TRƯỚC khi mount interstitial (ClickLog đã ghi
 * trước; interstitial chỉ là UI delay).
 */
export function InterstitialRedirect({
  open,
  onClose,
  destination,
  marketplace,
  saveLink,
  saveLabel = "Lưu kết quả AI để quay lại so sánh"
}: InterstitialRedirectProps): React.ReactElement | null {
  const [countdown, setCountdown] = React.useState(2);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setCountdown(2);
    setSaved(false);

    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick);
          window.location.href = destination;
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [open, destination]);

  const handleSaveLink = async (): Promise<void> => {
    if (!saveLink) return;
    try {
      await navigator.clipboard.writeText(saveLink);
      setSaved(true);
    } catch {
      /* clipboard blocked */
    }
  };

  if (!open) return null;

  const label = MARKETPLACE_LABEL[marketplace.toLowerCase()] ?? MARKETPLACE_LABEL.default;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-ink-soft hover:bg-canvas"
          aria-label="Đóng"
        >
          <X className="size-4" />
        </button>

        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-google-blue" />
          <h3 className="mt-3 text-base font-semibold text-ink">
            Đang chuyển sang {label}...
          </h3>
          <p className="mt-1 text-xs text-ink-soft">
            Còn {countdown}s · Bấm bất kỳ đâu ngoài để hủy
          </p>
        </div>

        {saveLink && (
          <div className="mt-5 rounded-xl border border-google-blue/20 bg-google-blue/5 p-4 text-center">
            <p className="text-sm text-ink">{saveLabel}</p>
            <button
              type="button"
              onClick={handleSaveLink}
              disabled={saved}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-google-blue px-4 py-2 text-sm font-medium text-white disabled:bg-accent disabled:text-white hover:bg-google-blue-hover"
            >
              {saved ? (
                <>✓ Đã copy link!</>
              ) : (
                <>
                  <Bookmark className="size-3.5" /> Copy link kết quả
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Backdrop click cancels redirect */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 -z-10 cursor-default"
        aria-label="Hủy redirect"
      />
    </div>
  );
}
