import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { NormalizedOffer } from "./dto/normalized-offer.dto";
import {
  ClassificationResult,
  deriveKeywords,
  matchByKeyword,
  NicheMatcher,
  normalizeText
} from "./classification.types";

export interface ActiveNiche {
  id: string;
  slug: string;
  name: string;
  keywords: string[];
}

const NONE: ClassificationResult = { nicheId: null, nicheSlug: null, method: "none", score: 0 };

/**
 * V4: phân loại offer thô vào niche ACTIVE. Tier-1 keyword (rẻ, deterministic) → tier-2 AI
 * (chỉ khi `CLASSIFY_AI_ENABLED=true` và keyword không rõ). AI 1 attempt, fail → none (không retry).
 * Service CHỈ gợi ý nicheId — HITL vẫn duyệt trước khi public (xem ImportService gating).
 */
@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  /** Load 1 lần đầu mỗi crawl cycle → truyền vào classify() để né query per-offer. */
  async loadActiveNiches(): Promise<ActiveNiche[]> {
    return this.prisma.niche.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, slug: true, name: true, keywords: true }
    });
  }

  async classify(offer: NormalizedOffer, niches: ActiveNiche[]): Promise<ClassificationResult> {
    if (niches.length === 0) return NONE;

    const haystack = normalizeText(
      [offer.name, offer.category, offer.atCategorySlug, offer.brand, offer.description]
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .join(" ")
    );
    if (haystack.length === 0) return NONE;

    const matchers: NicheMatcher[] = niches.map((n) => ({
      id: n.id,
      slug: n.slug,
      keywords: deriveKeywords(n.name, n.slug, n.keywords)
    }));

    const km = matchByKeyword(haystack, matchers);

    // Khớp rõ 1 niche → gán luôn (deterministic, đủ tin để qua auto-approve).
    if (km.best && !km.ambiguous) {
      return { nicheId: km.best.id, nicheSlug: km.best.slug, method: "keyword", score: km.best.score };
    }

    // None hoặc mơ hồ → thử AI nếu bật. Thu hẹp ứng viên cho AI nếu mơ hồ.
    if (this.aiEnabled()) {
      const pool =
        km.ambiguous && km.candidates.length > 0
          ? niches.filter((n) => km.candidates.some((c) => c.id === n.id))
          : niches;
      const ai = await this.classifyByAi(offer, pool);
      if (ai) return ai;
    }

    return { nicheId: null, nicheSlug: null, method: km.ambiguous ? "ambiguous" : "none", score: km.best?.score ?? 0 };
  }

  private aiEnabled(): boolean {
    return (process.env.CLASSIFY_AI_ENABLED ?? "false").toLowerCase() === "true";
  }

  private async classifyByAi(offer: NormalizedOffer, niches: ActiveNiche[]): Promise<ClassificationResult | null> {
    const list = niches.map((n) => `- ${n.slug}: ${n.name}`).join("\n");
    const prompt = [
      "Phân loại sản phẩm vào ĐÚNG 1 niche dưới đây, hoặc null nếu không khớp rõ.",
      "Chỉ chọn khi chắc chắn; mơ hồ → null (thà bỏ sót còn hơn gán sai).",
      "",
      "Niches:",
      list,
      "",
      "Sản phẩm:",
      `- Tên: ${offer.name}`,
      offer.category ? `- Danh mục: ${offer.category}` : "",
      offer.brand ? `- Thương hiệu: ${offer.brand}` : "",
      "",
      'Trả JSON: {"nicheSlug": "<slug>" | null}'
    ]
      .filter((l) => l.length > 0)
      .join("\n");

    try {
      const out = await this.ai.generateJson<{ nicheSlug?: string | null }>(prompt, {
        label: "classify-offer"
      });
      const slug = typeof out?.nicheSlug === "string" ? out.nicheSlug.trim() : null;
      if (!slug) return null;
      const niche = niches.find((n) => n.slug === slug);
      if (!niche) return null;
      return { nicheId: niche.id, nicheSlug: niche.slug, method: "ai", score: 0 };
    } catch (err: unknown) {
      this.logger.warn(
        `[classify] AI fail cho "${offer.name.slice(0, 60)}": ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }
}
