import { ArticleStatus, ArticleType } from "@prisma/client";

export enum PipelineStageName {
  BRIEF_BUILDER = "brief-builder",
  RESEARCH = "research",
  REVIEW_SCRAPER = "review-scraper",
  OUTLINE = "outline",
  IMAGE = "image",
  WRITER = "writer",
  CRITIC = "critic",
  FACT_CHECK = "fact-check"
}

export const STAGE_ORDER: PipelineStageName[] = [
  PipelineStageName.BRIEF_BUILDER,
  PipelineStageName.RESEARCH,
  PipelineStageName.REVIEW_SCRAPER,
  PipelineStageName.OUTLINE,
  PipelineStageName.IMAGE,
  PipelineStageName.WRITER,
  PipelineStageName.CRITIC,
  PipelineStageName.FACT_CHECK
];

/** Status sau khi stage hoàn thành thành công (next state). */
export const STAGE_SUCCESS_STATUS: Record<PipelineStageName, ArticleStatus> = {
  [PipelineStageName.BRIEF_BUILDER]: ArticleStatus.RESEARCHING,
  [PipelineStageName.RESEARCH]: ArticleStatus.REVIEWS_SCRAPED,
  [PipelineStageName.REVIEW_SCRAPER]: ArticleStatus.OUTLINE_READY,
  [PipelineStageName.OUTLINE]: ArticleStatus.IMAGES_READY,
  [PipelineStageName.IMAGE]: ArticleStatus.DRAFTING,
  [PipelineStageName.WRITER]: ArticleStatus.SELF_CRITIQUED,
  [PipelineStageName.CRITIC]: ArticleStatus.FACT_CHECKED,
  [PipelineStageName.FACT_CHECK]: ArticleStatus.PENDING_REVIEW
};

/** Article status hợp lệ làm input cho stage (state khi stage được phép chạy). */
export const STAGE_INPUT_STATUS: Record<PipelineStageName, ArticleStatus[]> = {
  [PipelineStageName.BRIEF_BUILDER]: [ArticleStatus.DRAFT_BRIEF, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.RESEARCH]: [ArticleStatus.RESEARCHING, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.REVIEW_SCRAPER]: [ArticleStatus.REVIEWS_SCRAPED, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.OUTLINE]: [ArticleStatus.OUTLINE_READY, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.IMAGE]: [ArticleStatus.IMAGES_READY, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.WRITER]: [ArticleStatus.DRAFTING, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.CRITIC]: [ArticleStatus.SELF_CRITIQUED, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED],
  [PipelineStageName.FACT_CHECK]: [ArticleStatus.FACT_CHECKED, ArticleStatus.NEEDS_REVISION, ArticleStatus.FAILED]
};

export type ReportProgress = (message: string, percent?: number) => Promise<void>;

export interface StageContext {
  articleId: string;
  type: ArticleType;
  /** Nếu stage cần input riêng (vd Brief Builder cần topic ban đầu). */
  initialInput?: {
    topic?: string;
    nicheId?: string | null;
    productRef?: string | null;
    pinnedProductIds?: string[];
  };
  /** Callback để stage update progress hiển thị realtime cho admin UI. Runner inject. */
  reportProgress?: ReportProgress;
}

/**
 * Reverse map status → stage cần chạy tiếp. Dùng cho `runUntilHitl` để xác định
 * stage kế cận (xử lý đúng case loop-back: critic set status DRAFTING → chạy lại WRITER).
 */
export const STATUS_TO_STAGE: Partial<Record<ArticleStatus, PipelineStageName>> = {
  [ArticleStatus.DRAFT_BRIEF]: PipelineStageName.BRIEF_BUILDER,
  [ArticleStatus.RESEARCHING]: PipelineStageName.RESEARCH,
  [ArticleStatus.REVIEWS_SCRAPED]: PipelineStageName.REVIEW_SCRAPER,
  [ArticleStatus.OUTLINE_READY]: PipelineStageName.OUTLINE,
  [ArticleStatus.IMAGES_READY]: PipelineStageName.IMAGE,
  [ArticleStatus.DRAFTING]: PipelineStageName.WRITER,
  [ArticleStatus.SELF_CRITIQUED]: PipelineStageName.CRITIC,
  [ArticleStatus.FACT_CHECKED]: PipelineStageName.FACT_CHECK
};

export interface StageRunResult {
  stage: PipelineStageName;
  nextStatus: ArticleStatus;
  durationMs: number;
  outputSummary: Record<string, unknown>;
  /** Nếu stage cần loop lại (vd critic flag → writer revise) → next stage override. */
  loopBackTo?: PipelineStageName;
}

/** Mỗi stage implement interface này. Pipeline runner gọi `run(ctx)`. */
export interface PipelineStage {
  readonly name: PipelineStageName;
  readonly agent: string;
  run(ctx: StageContext): Promise<Omit<StageRunResult, "stage" | "durationMs">>;
}

/** Voice profile schema — Author.voiceProfile (Json). */
export interface VoiceProfile {
  tone: "serious" | "witty" | "technical" | "conversational" | "storytelling";
  vocabRange: "casual" | "neutral" | "formal";
  sentenceLength: "short" | "medium" | "long" | "mixed";
  englishLoanwords: "minimal" | "moderate" | "frequent";
  openingPatterns: HookPattern[];
  quirks: string[];
}

export type HookPattern =
  | "contrarian"
  | "anecdote"
  | "stat"
  | "news"
  | "scenario"
  | "question"
  | "myth-bust"
  | "vivid";

export const HOOK_PATTERNS: HookPattern[] = [
  "contrarian",
  "anecdote",
  "stat",
  "news",
  "scenario",
  "question",
  "myth-bust",
  "vivid"
];

export type LayoutVariant =
  | "magazine"
  | "technical"
  | "narrative"
  | "comparison-heavy"
  | "listicle";

export const LAYOUT_VARIANTS: LayoutVariant[] = [
  "magazine",
  "technical",
  "narrative",
  "comparison-heavy",
  "listicle"
];

export type IntentKind =
  | "transactional"
  | "commercial-investigation"
  | "comparison"
  | "informational";

/** Brief schema — Article.briefJson (Json). */
export interface ArticleBrief {
  thesis: string;
  intent: IntentKind;
  targetKeywords: string[];
  competitorUrls: string[];
  persona: {
    name: string;
    painPoint: string;
    budget?: string;
    expertise: "novice" | "intermediate" | "expert";
  };
  layoutVariant: LayoutVariant;
  targetDepth: "shallow" | "medium" | "deep-dive";
  authorId: string;
  hookPattern: HookPattern;
}

export interface OutlineSectionSpec {
  anchorSlug: string;
  heading: string;
  summary: string;
  intent: string;
  evidenceRefs: string[];
  blockTypeHints: string[];
  isRequired: boolean;
  estimatedWords: number;
}

export interface ArticleOutline {
  sections: OutlineSectionSpec[];
  totalEstimatedWords: number;
}
