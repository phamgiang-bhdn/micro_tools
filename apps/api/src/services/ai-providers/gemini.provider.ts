import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, LLMTransientError } from "./types";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(
    public readonly modelId: string,
    private readonly apiKey: string
  ) {}

  async generateText(prompt: string): Promise<string> {
    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: this.modelId,
      generationConfig: { responseMimeType: "application/json" }
    });
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/429|rate limit|quota/i.test(msg)) throw new LLMTransientError(msg, "rate-limit");
      if (/503|service unavailable|high demand|500 internal|504 gateway|fetch failed|ECONNRESET|timeout/i.test(msg)) {
        throw new LLMTransientError(msg, "transient");
      }
      throw error;
    }
  }
}
