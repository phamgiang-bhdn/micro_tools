import { Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Embedding helper cho uniqueness check (Brief Builder) + section dedup (Critic).
 * Provider mặc định: Gemini text-embedding-004 (free tier ~ 1500 RPM).
 * Fallback: trả vector zero để pipeline không crash khi GEMINI_API_KEY thiếu.
 */

const logger = new Logger("EmbeddingUtil");

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const c = getClient();
  if (!c) {
    logger.warn("GEMINI_API_KEY missing — embedding returns zero vector");
    return [];
  }
  try {
    const model = c.getGenerativeModel({ model: "text-embedding-004" });
    const res = await model.embedContent(text);
    return res.embedding.values ?? [];
  } catch (err) {
    logger.warn(`Embedding failed: ${(err as Error).message}`);
    return [];
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
