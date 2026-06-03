"use server";

import { headers } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export interface SubmitWaitlistInput {
  email: string;
  nicheSlug: string;
  surveyAnswer?: string;
  source?: string;
  honeypot?: string;
}

export interface SubmitWaitlistResult {
  ok: boolean;
  error?: string;
}

export async function submitWaitlistAction(input: SubmitWaitlistInput): Promise<SubmitWaitlistResult> {
  if (input.honeypot && input.honeypot.length > 0) {
    return { ok: true };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email không hợp lệ" };
  }
  if (!input.nicheSlug) {
    return { ok: false, error: "Thiếu thông tin niche" };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "0.0.0.0";

  try {
    const response = await fetch(`${API_BASE_URL}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        nicheSlug: input.nicheSlug,
        surveyAnswer: input.surveyAnswer?.trim() || undefined,
        source: input.source?.trim() || undefined,
        ipAddress,
        userAgent
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return { ok: false, error: "Đăng ký thất bại, thử lại sau" };
    }
    return { ok: true };
  } catch (error: unknown) {
    console.error("[waitlist] submit failed", error);
    return { ok: false, error: "Lỗi kết nối, thử lại sau" };
  }
}
