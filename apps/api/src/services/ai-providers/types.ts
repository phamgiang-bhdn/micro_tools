/** Interface mọi LLM provider phải implement. */
export interface LLMProvider {
  readonly name: string;
  readonly modelId: string;

  /** Gọi model, prompt là full string, expect JSON output. Trả raw text — caller parse JSON. */
  generateText(prompt: string, opts?: GenerateOptions): Promise<string>;
}

export interface GenerateOptions {
  /** Hard deadline ms. Mặc định 60s. Khi vượt → throw LLMTransientError("transient"). */
  timeoutMs?: number;
  /** Label gắn vào lỗi để biết stage nào hết giờ. */
  label?: string;
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
