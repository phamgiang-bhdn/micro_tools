import { LLMProvider, LLMTransientError } from "./types";

/**
 * Provider cho mọi API tương thích OpenAI Chat Completions:
 * OpenAI, DeepSeek, Qwen/DashScope, Moonshot, GLM, OpenRouter, OpenCode.ai, …
 *
 * Yêu cầu env: AI_BASE_URL (vd https://api.deepseek.com/v1), AI_API_KEY, AI_MODEL.
 * Endpoint gọi: `${baseUrl}/chat/completions` — chuẩn OpenAI v1.
 *
 * `forceJson=true` thêm `response_format: { type: "json_object" }`. Provider nào không
 * hỗ trợ field này sẽ ignore — caller vẫn parse JSON từ text trả về (đa số model tốt
 * trả JSON đúng khi prompt yêu cầu).
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";

  constructor(
    public readonly modelId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly forceJson = true
  ) {}

  async generateText(prompt: string): Promise<string> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý AI. Khi được yêu cầu output JSON, trả về JSON thuần (không markdown fence, không lời mở đầu). Tiếng Việt nếu không yêu cầu khác."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    };
    if (this.forceJson) {
      body.response_format = { type: "json_object" };
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new LLMTransientError(`Network error: ${msg}`, "transient");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new LLMTransientError(`HTTP 429: ${text.slice(0, 200)}`, "rate-limit");
      if (res.status >= 500) throw new LLMTransientError(`HTTP ${res.status}: ${text.slice(0, 200)}`, "transient");
      // 400/401/403 = lỗi config / prompt — không retry
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (data.error?.message) {
      throw new Error(`Provider error: ${data.error.message}`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("Provider trả response rỗng");
    }
    return content;
  }
}
