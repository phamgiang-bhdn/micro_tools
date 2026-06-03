import { Injectable, Logger } from "@nestjs/common";
import {
  DEFAULT_RESULT_TEMPLATE,
  MatchedCriterion,
  ScoredProduct,
  ScoringRule,
  ToolQuizSchema,
  ToolResultTemplate,
  ToolScoringRules
} from "./scoring.types";

/**
 * Lightweight product shape scoring engine cần — không depend Prisma model thẳng
 * để dễ test bằng fixture.
 */
export interface ScoreableProduct {
  id: string;
  name: string;
  /** Raw scrapedData (per-niche dynamic Json). */
  scrapedData: Record<string, unknown> | unknown;
  /** Top-level fields có thể được rule reference. */
  [key: string]: unknown;
}

@Injectable()
export class ToolScoringService {
  private readonly logger = new Logger(ToolScoringService.name);

  /**
   * Chấm điểm products theo userAttributes + tool scoringRules.
   * Trả về top N sorted by score desc.
   *
   * Deterministic — KHÔNG dùng AI. AI chỉ generate reasoning ở step sau.
   */
  scoreProducts(args: {
    quizSchema: ToolQuizSchema;
    scoringRules: ToolScoringRules;
    resultTemplate?: Partial<ToolResultTemplate>;
    userAttributes: Record<string, unknown>;
    products: ScoreableProduct[];
  }): ScoredProduct[] {
    const template: ToolResultTemplate = {
      ...DEFAULT_RESULT_TEMPLATE,
      ...args.resultTemplate
    };

    // Build label lookup từ quizSchema (cho matchedCriteria.label).
    const labelByAttr = new Map<string, string>();
    for (const q of args.quizSchema.questions) {
      labelByAttr.set(q.id, q.question);
    }

    const candidates: ScoredProduct[] = [];

    for (const product of args.products) {
      if (!this.passesHardFilters(product, args.scoringRules.hardFilters)) {
        continue;
      }

      const matchedCriteria: MatchedCriterion[] = [];
      let maxScore = 0;
      let earnedScore = 0;

      for (const rule of args.scoringRules.rules) {
        const userValue = args.userAttributes[rule.userAttribute];
        const productValue = this.getNested(product, rule.productAttributePath);

        // User không trả lời / "Không rõ" → skip rule (không tính cả max lẫn earned).
        if (userValue === undefined || userValue === null || userValue === "" || userValue === "unknown") {
          continue;
        }

        maxScore += rule.weight;
        const matched = this.evaluate(userValue, productValue, rule);
        if (matched) {
          earnedScore += rule.weight;
        }

        matchedCriteria.push({
          attribute: rule.userAttribute,
          label: labelByAttr.get(rule.userAttribute) ?? rule.userAttribute,
          weight: rule.weight,
          matched
        });
      }

      const score = maxScore > 0 ? earnedScore / maxScore : 0;
      const confidenceLabel = this.labelFor(score, template);

      candidates.push({
        productId: product.id,
        score,
        confidenceLabel,
        matchedCriteria,
        maxScore,
        earnedScore
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const topN = Math.max(1, template.topN ?? 3);
    return candidates.slice(0, topN);
  }

  // ── private helpers ──────────────────────────────────────

  private passesHardFilters(
    product: ScoreableProduct,
    filters?: ToolScoringRules["hardFilters"]
  ): boolean {
    if (!filters || filters.length === 0) return true;
    for (const f of filters) {
      const val = this.getNested(product, f.productAttributePath);
      if (f.matchType === "exact" && val !== f.value) return false;
      if (f.matchType === "neq" && val === f.value) return false;
    }
    return true;
  }

  private evaluate(userValue: unknown, productValue: unknown, rule: ScoringRule): boolean {
    if (productValue === undefined || productValue === null) {
      return false;
    }

    switch (rule.matchType) {
      case "exact":
        return this.normalizeForCompare(userValue) === this.normalizeForCompare(productValue);

      case "gte":
        return Number(productValue) >= Number(userValue);

      case "lte":
        return Number(productValue) <= Number(userValue);

      case "string_contains": {
        const u = String(userValue).toLowerCase();
        const p = String(productValue).toLowerCase();
        return p.includes(u) || u.includes(p);
      }

      case "tag_match": {
        const userTags = Array.isArray(userValue) ? userValue.map(String) : [String(userValue)];
        const productTags = Array.isArray(productValue)
          ? productValue.map(String)
          : [String(productValue)];
        return userTags.some((u) => productTags.some((p) => p.toLowerCase() === u.toLowerCase()));
      }

      case "range_overlap":
        return this.rangeOverlap(userValue, productValue);

      default:
        return false;
    }
  }

  /**
   * "3-4" overlaps với "2-5" → true.
   * Số đơn vd 4 overlaps với "3-5" → true.
   */
  private rangeOverlap(a: unknown, b: unknown): boolean {
    const ra = this.parseRange(a);
    const rb = this.parseRange(b);
    if (!ra || !rb) return false;
    return ra.min <= rb.max && rb.min <= ra.max;
  }

  private parseRange(v: unknown): { min: number; max: number } | null {
    if (typeof v === "number") return { min: v, max: v };
    if (typeof v !== "string") return null;
    const m = v.match(/^(\d+(?:\.\d+)?)(?:[-–~](\d+(?:\.\d+)?|\+))?$/);
    if (!m) {
      const n = Number(v);
      return Number.isFinite(n) ? { min: n, max: n } : null;
    }
    const min = Number(m[1]);
    const max = m[2] === "+" ? Number.POSITIVE_INFINITY : m[2] ? Number(m[2]) : min;
    return { min, max };
  }

  private normalizeForCompare(v: unknown): string {
    if (v === null || v === undefined) return "";
    return String(v).trim().toLowerCase();
  }

  private getNested(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== "object") return undefined;
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur === null || cur === undefined) return undefined;
      if (typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
  }

  private labelFor(score: number, template: ToolResultTemplate): string {
    if (score >= template.highThreshold) return template.confidenceLabels.high;
    if (score >= template.mediumThreshold) return template.confidenceLabels.medium;
    return template.confidenceLabels.low;
  }
}
