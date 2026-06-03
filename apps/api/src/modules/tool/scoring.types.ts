/**
 * Tool module — shared types cho scoring engine + AI prompts + storefront.
 *
 * Tool config (Json columns) shape:
 * - Tool.quizSchema    → ToolQuizSchema
 * - Tool.scoringRules  → ToolScoringRules
 * - Tool.resultTemplate → ToolResultTemplate
 *
 * Admin Tool Builder UI validate qua zod schema khớp các interface dưới.
 */

export type QuizQuestionType = "single" | "multi" | "number" | "range" | "picture";

export interface QuizOption {
  /** Value lưu vào parsedAttributes — string/number. */
  value: string | number;
  /** Label hiển thị cho user. */
  label: string;
  /** Emoji/icon cho picture-type. Optional. */
  icon?: string;
}

export interface QuizQuestion {
  /** Stable id, dùng làm attribute key. */
  id: string;
  /** Câu hỏi VN tự nhiên (theo language buyer, KHÔNG spec engineer). */
  question: string;
  type: QuizQuestionType;
  /** Bắt buộc trả lời? 3 câu cốt lõi = required, 2 câu refine = optional. */
  required: boolean;
  /** Options cho single/multi/picture. */
  options?: QuizOption[];
  /** Default value pre-selected (UX optimization). */
  defaultValue?: string | number;
  /** Min/max cho number/range. */
  min?: number;
  max?: number;
  step?: number;
  /** Trọng số khi scoring. 1-10. Cao = quan trọng. */
  weight: number;
  /** Helper text dưới câu hỏi. */
  helper?: string;
}

export interface ToolQuizSchema {
  questions: QuizQuestion[];
}

export type ScoringMatchType =
  | "exact"
  | "range_overlap"
  | "gte"
  | "lte"
  | "string_contains"
  | "tag_match";

export interface ScoringRule {
  /** Khớp với QuizQuestion.id (= key trong parsedAttributes). */
  userAttribute: string;
  /** Dot-path vào product (vd "price" hoặc "scrapedData.recommendedHouseholdSize"). */
  productAttributePath: string;
  /** Weight 1-10 — quan trọng cỡ nào. */
  weight: number;
  matchType: ScoringMatchType;
  /** Optional params per matchType (vd: lte có tolerance). */
  params?: Record<string, unknown>;
}

export interface ToolScoringRules {
  rules: ScoringRule[];
  /** Penalty khi product không match attribute bắt buộc (vd: OOS). */
  hardFilters?: {
    productAttributePath: string;
    matchType: "exact" | "neq";
    value: unknown;
  }[];
}

export interface ToolResultTemplate {
  /** Top N product show ở result. Mặc định 3. */
  topN: number;
  /** Hierarchy: "1+2" (#1 prominent + 2 small) hoặc "equal" (3 equal). */
  hierarchy: "1+2" | "equal";
  /** Confidence label theo threshold. */
  confidenceLabels: {
    high: string; // score >= highThreshold
    medium: string; // score >= mediumThreshold
    low: string; // score < mediumThreshold
  };
  highThreshold: number; // default 0.85
  mediumThreshold: number; // default 0.65
}

/** Default templates dùng khi admin chưa fill — tránh null check khắp nơi. */
export const DEFAULT_RESULT_TEMPLATE: ToolResultTemplate = {
  topN: 3,
  hierarchy: "1+2",
  confidenceLabels: {
    high: "Rất phù hợp",
    medium: "Phù hợp",
    low: "Có thể cân nhắc"
  },
  highThreshold: 0.85,
  mediumThreshold: 0.65
};

// ─── Scoring engine output ─────────────────────────────────

export interface MatchedCriterion {
  /** Question/rule key. */
  attribute: string;
  /** Display label (lấy từ question.question để show "vì sao match"). */
  label: string;
  /** Weight contribution. */
  weight: number;
  /** True nếu khớp; false = không khớp (vẫn liệt kê để AI reasoning biết weak points). */
  matched: boolean;
}

export interface ScoredProduct {
  productId: string;
  /** Final score 0-1. */
  score: number;
  /** Label dạng text từ resultTemplate.confidenceLabels. */
  confidenceLabel: string;
  /** Breakdown per rule. */
  matchedCriteria: MatchedCriterion[];
  /** Total weight evaluated (cho debug). */
  maxScore: number;
  /** Earned score (cho debug). */
  earnedScore: number;
}
