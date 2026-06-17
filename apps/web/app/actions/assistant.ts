"use server";

import type { ProductItem } from "../../lib/types";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export type AssistantPick = ProductItem & { nicheSlug: string; reason: string };

export interface AssistantAnswer {
  query: string;
  niche: { slug: string; name: string } | null;
  intro: string;
  picks: AssistantPick[];
  followups: string[];
}

export type AssistantResult = AssistantAnswer | { error: string };

/**
 * Gọi AI assistant. Trả về câu trả lời có cấu trúc (intro + picks + followups) hoặc {error}.
 * Không throw lên UI — lỗi → object error để component hiện thông báo nhẹ.
 */
export async function askAssistant(query: string): Promise<AssistantResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { error: "Hãy mô tả nhu cầu cụ thể hơn." };
  try {
    const res = await fetch(`${API_BASE_URL}/assistant/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
      cache: "no-store"
    });
    if (!res.ok) return { error: "Trợ lý AI tạm gián đoạn, thử lại sau giây lát." };
    return (await res.json()) as AssistantAnswer;
  } catch {
    return { error: "Không kết nối được trợ lý AI. Kiểm tra mạng và thử lại." };
  }
}
