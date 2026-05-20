import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { GeminiProvider } from "./ai-providers/gemini.provider";
import { OpenAICompatibleProvider } from "./ai-providers/openai-compatible.provider";
import { LLMProvider, LLMTransientError } from "./ai-providers/types";

/**
 * AI gateway — chọn provider qua env `AI_PROVIDER`:
 *   - "gemini" (default): cần GEMINI_API_KEY, GEMINI_MODEL.
 *   - "openai-compatible": cần AI_BASE_URL, AI_API_KEY, AI_MODEL.
 *     Dùng cho OpenAI/DeepSeek/Qwen/Moonshot/GLM/OpenRouter/OpenCode.ai…
 *
 * Switch provider không cần đổi code — chỉ sửa .env và restart.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private buildProvider(): LLMProvider {
    const kind = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();

    if (kind === "openai-compatible") {
      const baseUrl = process.env.AI_BASE_URL;
      const apiKey = process.env.AI_API_KEY;
      const model = process.env.AI_MODEL;
      if (!baseUrl || !apiKey || !model) {
        throw new Error(
          "AI_PROVIDER=openai-compatible cần đủ AI_BASE_URL, AI_API_KEY, AI_MODEL trong .env"
        );
      }
      return new OpenAICompatibleProvider(model, baseUrl, apiKey);
    }

    // Default: Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY chưa cấu hình (hoặc đổi AI_PROVIDER sang openai-compatible)");
    const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    return new GeminiProvider(model, apiKey);
  }

  get currentModel(): string {
    try {
      return this.buildProvider().modelId;
    } catch {
      return "unknown";
    }
  }

  async parseBySchema<T>(scrapedText: string, schema: Record<string, unknown>): Promise<T> {
    const prompt = [
      "Extract structured data from the content and return JSON ONLY.",
      "You must strictly follow the provided JSON schema.",
      "Do not include markdown or explanations.",
      `Schema: ${JSON.stringify(schema)}`,
      `Content: ${scrapedText.slice(0, 15000)}`
    ].join("\n\n");
    return this.callJsonModel<T>(prompt, { label: "parse-by-schema" });
  }

  async generateJson<T>(fullPrompt: string, opts?: AiCallOptions): Promise<T> {
    return this.callJsonModel<T>(fullPrompt, opts);
  }

  private async callJsonModel<T>(prompt: string, opts: AiCallOptions = {}): Promise<T> {
    const provider = this.buildProvider();
    const timeoutMs = opts.timeoutMs ?? Number(process.env.AI_DEFAULT_TIMEOUT_MS ?? 60_000);
    const label = opts.label ?? provider.name;
    try {
      const rawText = await provider.generateText(prompt, { timeoutMs, label });
      const cleaned = extractJsonPayload(rawText);
      if (cleaned === undefined) {
        throw new Error(`Provider ${provider.name} trả response trống / không phải JSON`);
      }
      return cleaned as T;
    } catch (error: unknown) {
      const transient = error instanceof LLMTransientError ? error : null;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider.name}[${label}] call failed (no retry): ${message}`);
      if (transient?.kind === "rate-limit") {
        throw new HttpException(`${provider.name} rate limit`, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (transient?.kind === "transient") {
        throw new HttpException(`${provider.name} service không khả dụng: ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
      }
      throw new Error(`AI call failed (${provider.name}): ${message}`);
    }
  }
}

export interface AiCallOptions {
  /** Per-call timeout (ms). Mặc định lấy env AI_DEFAULT_TIMEOUT_MS hoặc 60s. */
  timeoutMs?: number;
  /** Nhãn ngắn (vd "outline", "writer:section-3") để log/biết stage nào timeout. */
  label?: string;
}

/** Parse JSON từ raw text. Strip markdown fence nếu có. Tìm `{...}` hoặc `[...]` bao ngoài. */
function extractJsonPayload(text: string): unknown {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Tìm cặp ngoặc đầu/cuối — cho cả object và array
    const firstCurly = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let start = -1;
    let endChar = "";
    if (firstCurly >= 0 && (firstBracket < 0 || firstCurly < firstBracket)) {
      start = firstCurly;
      endChar = "}";
    } else if (firstBracket >= 0) {
      start = firstBracket;
      endChar = "]";
    }
    if (start < 0) return undefined;
    const end = cleaned.lastIndexOf(endChar);
    if (end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
