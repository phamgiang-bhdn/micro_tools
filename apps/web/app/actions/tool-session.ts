"use server";

import { headers } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export interface ToolSessionInput {
  toolSlug: string;
  chatMessage?: string;
  quizAnswers?: Record<string, unknown>;
  source?: string;
  referrer?: string;
}

export interface ToolSessionResult {
  ok: boolean;
  needsQuiz?: boolean;
  reason?: string;
  sessionId?: string;
  shareSlug?: string;
  error?: string;
}

export async function submitToolSession(input: ToolSessionInput): Promise<ToolSessionResult> {
  if (!input.toolSlug) return { ok: false, error: "Thiếu tool slug" };
  if (!input.chatMessage && !input.quizAnswers) {
    return { ok: false, error: "Cần chat hoặc quiz answers" };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referer = requestHeaders.get("referer") ?? "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "0.0.0.0";

  try {
    const response = await fetch(`${API_BASE_URL}/tool/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolSlug: input.toolSlug,
        chatMessage: input.chatMessage,
        quizAnswers: input.quizAnswers,
        source: input.source,
        referrer: input.referrer ?? referer,
        ipAddress,
        userAgent
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[tool-session] submit failed", text);
      return { ok: false, error: "AI tạm thời lỗi, thử lại sau" };
    }

    const data = (await response.json()) as ToolSessionResult;
    return data;
  } catch (err) {
    console.error("[tool-session] network error", err);
    return { ok: false, error: "Lỗi kết nối, thử lại sau" };
  }
}
