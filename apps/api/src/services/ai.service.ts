import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly modelName = "gemini-1.5-flash";

  private createClient(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    return new GoogleGenerativeAI(apiKey);
  }

  async parseBySchema<T>(scrapedText: string, schema: Record<string, unknown>): Promise<T> {
    const client = this.createClient();
    const model = client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const prompt = [
      "Extract structured data from the content and return JSON ONLY.",
      "You must strictly follow the provided JSON schema.",
      "Do not include markdown or explanations.",
      `Schema: ${JSON.stringify(schema)}`,
      `Content: ${scrapedText.slice(0, 15000)}`
    ].join("\n\n");

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const parsedJson = JSON.parse(responseText) as unknown;
        const validated = z.record(z.unknown()).safeParse(parsedJson);
        if (!validated.success) {
          throw new Error(`Invalid JSON shape from Gemini: ${validated.error.message}`);
        }
        return parsedJson as T;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimit = /429|rate limit|quota/i.test(message);

        if (isRateLimit && attempt < maxAttempts) {
          const backoffMs = attempt * 1200;
          this.logger.warn(`Gemini rate limited, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        if (isRateLimit) {
          throw new HttpException("Gemini API rate limit exceeded after retries", HttpStatus.TOO_MANY_REQUESTS);
        }

        this.logger.error("Failed to parse Gemini response JSON", message);
        throw new Error(`Gemini parsing failed: ${message}`);
      }
    }

    throw new Error("Unexpected AI parser state");
  }
}
