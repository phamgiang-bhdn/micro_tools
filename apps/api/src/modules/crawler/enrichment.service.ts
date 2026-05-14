import { Injectable, Logger } from "@nestjs/common";
import { AiService } from "../../services/ai.service";
import { NormalizedOffer } from "./dto/normalized-offer.dto";

const ENRICH_SCHEMA = {
  name: "string",
  description: "string",
  highlights: "string[]",
  badge: "string"
};

interface EnrichOutput {
  name?: string;
  description?: string;
  highlights?: string[];
  badge?: string;
}

/**
 * Dùng Gemini viết lại tên + mô tả + highlights bằng tiếng Việt mượt cho người mua hàng.
 * Tắt qua env CRAWLER_AI_ENRICH=false hoặc khi không có GEMINI_API_KEY.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(private readonly ai: AiService) {}

  isEnabled(): boolean {
    return process.env.CRAWLER_AI_ENRICH !== "false" && Boolean(process.env.GEMINI_API_KEY);
  }

  async enrich(offer: NormalizedOffer): Promise<NormalizedOffer> {
    if (!this.isEnabled()) return offer;
    try {
      const seed = [
        offer.name,
        offer.brand ? `Brand: ${offer.brand}` : "",
        offer.store ? `Shop: ${offer.store}` : "",
        offer.description ?? "",
        offer.discountPercent ? `Giảm ${offer.discountPercent}%` : ""
      ]
        .filter(Boolean)
        .join("\n");

      const enriched = await this.ai.parseBySchema<EnrichOutput>(
        `Bạn là copywriter cho site so sánh giá Việt Nam. Viết lại sản phẩm sau bằng tiếng Việt tự nhiên cho người mua hàng:\n- name: ngắn, giữ model number, không marketing thái quá\n- description: 1-2 câu súc tích\n- highlights: 2-4 gạch đầu dòng ngắn (mỗi dòng <60 ký tự)\n- badge: nếu có deal đặc biệt (vd "Bán chạy", "Giảm sâu"), nếu không trả ""\n\nKHÔNG trả markdown. Chỉ JSON đúng schema.\n\n---\n${seed}`,
        ENRICH_SCHEMA
      );

      return {
        ...offer,
        name: enriched.name?.trim() || offer.name,
        description: enriched.description?.trim() || offer.description,
        highlights: enriched.highlights && enriched.highlights.length > 0 ? enriched.highlights : offer.highlights,
        badge: enriched.badge?.trim() || offer.badge
      };
    } catch (error: unknown) {
      this.logger.warn(`Enrich skipped (${offer.externalId}): ${error instanceof Error ? error.message : error}`);
      return offer;
    }
  }
}
