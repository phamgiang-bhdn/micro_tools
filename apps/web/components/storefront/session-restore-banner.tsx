"use client";

import * as React from "react";
import Link from "next/link";
import { X, RotateCw } from "lucide-react";

interface LastSession {
  sessionId: string;
  shareSlug: string | null;
  toolSlug: string;
  nicheSlug: string;
  nicheName: string;
  timestamp: number;
}

const STORAGE_KEY = "dealvault:last-session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Đọc last QuizSession từ localStorage. Show banner cho user trên homepage /
 * tool page. Click → đi lại result page. Skip TTL > 7 ngày.
 *
 * Story 4.11 — Re-engagement asset, không cookie (Safari ITP block).
 */
export function SessionRestoreBanner({
  currentToolSlug
}: {
  currentToolSlug?: string;
}): React.ReactElement | null {
  const [session, setSession] = React.useState<LastSession | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LastSession;
      if (!parsed.sessionId || !parsed.toolSlug) return;
      if (Date.now() - parsed.timestamp > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      // Don't show if user is already viewing this tool's hero
      if (currentToolSlug && parsed.toolSlug === currentToolSlug) {
        const onResultPage = window.location.pathname.includes("/result/");
        if (!onResultPage) {
          setSession(parsed);
        }
        return;
      }
      setSession(parsed);
    } catch {
      /* localStorage blocked or parse error */
    }
  }, [currentToolSlug]);

  const handleDismiss = (): void => {
    setDismissed(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* blocked */
    }
  };

  if (!session || dismissed) return null;

  const hoursAgo = Math.max(1, Math.round((Date.now() - session.timestamp) / (60 * 60 * 1000)));
  const relTime = hoursAgo < 24 ? `${hoursAgo} giờ trước` : `${Math.round(hoursAgo / 24)} ngày trước`;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary-600/30 bg-primary-600/5 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <RotateCw className="size-4 shrink-0 text-primary-600" />
        <span className="truncate text-ink">
          👋 Bạn đã làm quiz <strong>{session.nicheName}</strong> {relTime}.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/ai/${session.toolSlug}/result/${session.sessionId}`}
          className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
        >
          Xem lại kết quả
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1 text-ink-soft hover:bg-white/50 hover:text-ink"
          aria-label="Đóng"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
