/** Interface mọi LLM provider phải implement. */
export interface LLMProvider {
  readonly name: string;
  readonly modelId: string;

  /** Gọi model, prompt là full string, expect JSON output. Trả raw text — caller parse JSON. */
  generateText(prompt: string): Promise<string>;
}

/** Lỗi tạm thời (rate limit, 503) — runner retry với backoff. */
export class LLMTransientError extends Error {
  constructor(
    message: string,
    public readonly kind: "rate-limit" | "transient"
  ) {
    super(message);
    this.name = "LLMTransientError";
  }
}
