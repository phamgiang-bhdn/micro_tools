import { GoogleGenerativeAI } from "@google/generative-ai";
import { GenerateOptions, LLMProvider, LLMTransientError } from "./types";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(
    public readonly modelId: string,
    private readonly apiKey: string
  ) {}

  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: this.modelId,
      generationConfig: { responseMimeType: "application/json" }
    });
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const label = opts.label ?? "gemini";
    // timeoutMs <= 0 → tắt timeout, chạy thoải mái (admin có thể đợi 5-10 phút nếu muốn).
    if (timeoutMs <= 0) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: unknown) {
        return mapGeminiError(error);
      }
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new LLMTransientError(`${label} timeout sau ${timeoutMs}ms`, "transient")),
        timeoutMs
      );
    });
    try {
      const result = await Promise.race([model.generateContent(prompt), timeout]);
      return result.response.text();
    } catch (error: unknown) {
      if (error instanceof LLMTransientError) throw error;
      return mapGeminiError(error);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function mapGeminiError(error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|quota/i.test(msg)) throw new LLMTransientError(msg, "rate-limit");
  if (/503|service unavailable|high demand|500 internal|504 gateway|fetch failed|ECONNRESET|timeout|abort/i.test(msg)) {
    throw new LLMTransientError(msg, "transient");
  }
  throw error instanceof Error ? error : new Error(msg);
}
