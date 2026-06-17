import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService } from "../../services/ai.service";
import { deriveKeywords, matchByKeyword, normalizeText } from "../crawler/classification.types";

/** Product shape trả về client (đúng để normalizeProduct ở web đọc) + lý do AI. */
export interface AssistantProduct {
  id: string;
  nicheId: string | null;
  network: string;
  name: string;
  slug: string | null;
  scrapedData: Record<string, unknown>;
  priceIntel: unknown;
  updatedAt: string;
  shop: { id: string; slug: string; name: string; logoUrl: string | null; websiteUrl: string | null } | null;
  nicheSlug: string;
  reason: string;
}

export interface AssistantAnswer {
  query: string;
  niche: { slug: string; name: string } | null;
  intro: string;
  picks: AssistantProduct[];
  followups: string[];
}

interface AiAskOutput {
  intro?: string;
  picks?: Array<{ ref?: string; reason?: string }>;
  followups?: string[];
}

const MAX_CANDIDATES = 12;
const MAX_PICKS = 3;

/**
 * AI shopping assistant — trái tim "AI-visible". User hỏi tự nhiên → chọn niche (keyword) →
 * lấy candidate có giá + verdict thật → AI gợi ý 1-3 món + lý do bám nhu cầu. AI fail → fallback
 * deterministic (top discount) để KHÔNG bao giờ vỡ trải nghiệm.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async ask(query: string): Promise<AssistantAnswer> {
    const niche = await this.pickNiche(query);
    const products = await this.fetchCandidates(niche?.id ?? null);

    if (products.length === 0) {
      return {
        query,
        niche: niche ? { slug: niche.slug, name: niche.name } : null,
        intro: niche
          ? `Kho ${niche.name.toLowerCase()} đang được cập nhật — chưa có sản phẩm đã duyệt để gợi ý. Quay lại sau ít phút nhé.`
          : "Mình chưa rõ bạn cần nhóm sản phẩm nào. Thử mô tả cụ thể hơn (ví dụ: \"máy lọc nước cho nhà 4 người dưới 8 triệu\").",
        picks: [],
        followups: []
      };
    }

    const refMap = new Map<string, (typeof products)[number]>();
    products.forEach((p, i) => refMap.set(`P${i + 1}`, p));

    let output: AiAskOutput | null = null;
    try {
      output = await this.ai.generateJson<AiAskOutput>(this.buildPrompt(query, niche?.name ?? null, products), {
        label: "assistant-ask"
      });
    } catch (err: unknown) {
      this.logger.warn(`[assistant] AI fail, fallback deterministic: ${err instanceof Error ? err.message : String(err)}`);
    }

    const picks = this.resolvePicks(output, refMap, niche?.slug ?? "");
    const intro =
      typeof output?.intro === "string" && output.intro.trim()
        ? output.intro.trim()
        : niche
          ? `Vài ${niche.name.toLowerCase()} đáng cân nhắc theo nhu cầu của bạn:`
          : "Vài lựa chọn đáng cân nhắc:";
    const followups = Array.isArray(output?.followups)
      ? output.followups.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 3)
      : [];

    return {
      query,
      niche: niche ? { slug: niche.slug, name: niche.name } : null,
      intro,
      picks,
      followups
    };
  }

  private async pickNiche(query: string) {
    const niches = await this.prisma.niche.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, slug: true, name: true, keywords: true }
    });
    if (niches.length === 0) return null;
    const haystack = normalizeText(query);
    const matchers = niches.map((n) => ({ id: n.id, slug: n.slug, keywords: deriveKeywords(n.name, n.slug, n.keywords) }));
    const km = matchByKeyword(haystack, matchers);
    if (!km.best) return null;
    return niches.find((n) => n.id === km.best?.id) ?? null;
  }

  private async fetchCandidates(nicheId: string | null) {
    const rows = await this.prisma.product.findMany({
      where: { isPublic: true, ...(nicheId ? { nicheId } : {}) },
      take: MAX_CANDIDATES,
      orderBy: { updatedAt: "desc" },
      include: {
        shop: { select: { id: true, slug: true, name: true, logoUrl: true, websiteUrl: true } },
        niche: { select: { slug: true } }
      }
    });
    return rows;
  }

  private buildPrompt(
    query: string,
    nicheName: string | null,
    products: Array<{ name: string; scrapedData: unknown; priceIntel: unknown }>
  ): string {
    const candidates = products
      .map((p, i) => {
        const sd = (p.scrapedData ?? {}) as Record<string, unknown>;
        const price = pickNumber(sd, ["price", "salePrice", "currentPrice"]);
        const brand = pickString(sd, ["brand"]);
        const verdict = readVerdict(p.priceIntel);
        const parts = [`[P${i + 1}] ${p.name}`];
        if (price) parts.push(`giá ${price.toLocaleString("vi-VN")}đ`);
        if (brand) parts.push(brand);
        if (verdict) parts.push(`(${verdict})`);
        return parts.join(" · ");
      })
      .join("\n");

    return [
      "Bạn là trợ lý mua sắm AI cho người Việt. Tư vấn ngắn gọn, thật, KHÔNG marketing rỗng (cấm \"siêu phẩm\", \"tốt nhất\", \"đỉnh cao\").",
      nicheName ? `Nhóm sản phẩm: ${nicheName}.` : "",
      "",
      `Nhu cầu user: "${query}"`,
      "",
      "Danh sách sản phẩm có sẵn (CHỈ được gợi ý từ đây, dùng đúng ref Px):",
      candidates,
      "",
      "Trả JSON (KHÔNG markdown):",
      "{",
      '  "intro": "1-2 câu tóm tắt bạn hiểu nhu cầu + dẫn vào gợi ý",',
      '  "picks": [{ "ref": "P1", "reason": "1 câu vì sao hợp nhu cầu, bám chi tiết user nói" }],',
      '  "followups": ["câu hỏi gợi ý tiếp 1", "2", "3"]',
      "}",
      "",
      `Quy tắc: tối đa ${MAX_PICKS} picks, chọn món hợp nhất với nhu cầu (giá/đặc điểm). Nếu không món nào hợp → picks rỗng, intro giải thích. reason phải reference điều user nói.`
    ]
      .filter((l) => l.length > 0)
      .join("\n");
  }

  private resolvePicks(
    output: AiAskOutput | null,
    refMap: Map<string, Awaited<ReturnType<AssistantService["fetchCandidates"]>>[number]>,
    nicheSlug: string
  ): AssistantProduct[] {
    const toView = (p: Awaited<ReturnType<AssistantService["fetchCandidates"]>>[number], reason: string): AssistantProduct => ({
      id: p.id,
      nicheId: p.nicheId,
      network: p.network,
      name: p.name,
      slug: p.slug,
      scrapedData: (p.scrapedData ?? {}) as Record<string, unknown>,
      priceIntel: p.priceIntel,
      updatedAt: p.updatedAt.toISOString(),
      shop: p.shop,
      nicheSlug: p.niche?.slug ?? nicheSlug,
      reason
    });

    const aiPicks = Array.isArray(output?.picks) ? output.picks : [];
    const resolved: AssistantProduct[] = [];
    for (const pick of aiPicks) {
      if (resolved.length >= MAX_PICKS) break;
      const ref = typeof pick?.ref === "string" ? pick.ref.trim().toUpperCase() : "";
      const product = refMap.get(ref);
      if (!product || resolved.some((r) => r.id === product.id)) continue;
      resolved.push(toView(product, typeof pick?.reason === "string" ? pick.reason.trim() : ""));
    }

    // Fallback: AI không trả pick hợp lệ → lấy 3 candidate đầu (đã sort updatedAt) làm gợi ý.
    if (resolved.length === 0) {
      for (const p of Array.from(refMap.values()).slice(0, MAX_PICKS)) {
        resolved.push(toView(p, ""));
      }
    }
    return resolved;
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function readVerdict(priceIntel: unknown): string | null {
  if (!priceIntel || typeof priceIntel !== "object") return null;
  const verdict = (priceIntel as { verdict?: unknown }).verdict;
  switch (verdict) {
    case "GIA_TOT":
      return "giá tốt";
    case "DAY_GIA":
      return "đáy 90 ngày";
    case "GIA_AO":
      return "cảnh báo giá ảo";
    default:
      return null;
  }
}
