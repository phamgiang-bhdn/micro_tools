/**
 * Niche classification — phân loại offer thô từ Accesstrade vào đúng niche ACTIVE.
 * Tier-1 keyword (pure, ở đây) → tier-2 AI (trong service, optional). Vì chỉ match với niche
 * ĐANG bật, đây thực chất là bộ lọc: đống merchant-wide co lại còn đúng niche bạn làm.
 */

export type ClassificationMethod = "keyword" | "ai" | "ambiguous" | "none";

export interface ClassificationResult {
  nicheId: string | null;
  nicheSlug: string | null;
  method: ClassificationMethod;
  score: number;
}

export interface NicheMatcher {
  id: string;
  slug: string;
  /** Phrase đã normalize (no-accent, lowercase). */
  keywords: string[];
}

export interface KeywordMatch {
  best: { id: string; slug: string; score: number } | null;
  ambiguous: boolean;
  candidates: Array<{ id: string; slug: string; score: number }>;
}

/** Bỏ dấu tiếng Việt + lowercase + chỉ giữ chữ/số/space. Dùng cho cả haystack lẫn keyword. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_KEYWORD_LEN = 4;
/** Ứng viên #2 đạt ≥ tỉ lệ này so với #1 → coi là mơ hồ, không tự gán (chờ AI / admin). */
const AMBIGUOUS_RATIO = 0.8;

/**
 * Suy keyword cho 1 niche: keyword admin set (ưu tiên) + segment từ name (tách theo / ( ) , -)
 * + cụm slug. Tất cả normalize. Cho phép niche chưa set keyword vẫn match được tên cơ bản.
 */
export function deriveKeywords(name: string, slug: string, adminKeywords: string[]): string[] {
  const set = new Set<string>();
  for (const k of adminKeywords) {
    const n = normalizeText(k);
    if (n.length >= 3) set.add(n);
  }
  for (const seg of name.split(/[/(),]|—|-/)) {
    const n = normalizeText(seg);
    if (n.length >= MIN_KEYWORD_LEN) set.add(n);
  }
  const slugPhrase = normalizeText(slug.replace(/-/g, " "));
  if (slugPhrase.length >= MIN_KEYWORD_LEN) set.add(slugPhrase);
  return [...set];
}

/**
 * Chấm điểm haystack với từng niche: score = tổng độ dài keyword khớp (phrase dài khớp = mạnh hơn).
 * Trả best + cờ ambiguous (khi #2 sát #1) + danh sách candidate score>0 (sorted desc).
 */
export function matchByKeyword(haystack: string, matchers: NicheMatcher[]): KeywordMatch {
  const scored = matchers
    .map((m) => {
      let score = 0;
      for (const kw of m.keywords) {
        if (kw.length > 0 && haystack.includes(kw)) score += kw.length;
      }
      return { id: m.id, slug: m.slug, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { best: null, ambiguous: false, candidates: [] };
  }
  const best = scored[0];
  const second = scored[1];
  const ambiguous = second !== undefined && second.score >= best.score * AMBIGUOUS_RATIO;
  return { best, ambiguous, candidates: scored };
}
