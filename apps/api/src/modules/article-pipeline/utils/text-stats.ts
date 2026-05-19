/**
 * Text statistics + duplication helpers cho Article V2.
 * Tất cả hoạt động trên text tiếng Việt (lowercase, strip dấu khi cần).
 */

export function wordCount(text: string): number {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Flesch reading ease (adapted) — tiếng Việt thô.
 * Score cao = dễ đọc. Mục tiêu blog: 60-80.
 */
export function readability(text: string): number {
  const words = wordCount(text);
  if (words === 0) return 0;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const syllables = Math.max(words, Math.floor(words * 1.4)); // tiếng Việt trung bình ~1.4 syllable/word
  return Math.max(0, Math.min(100, 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)));
}

/**
 * Strip dấu tiếng Việt + lowercase + chuẩn hoá whitespace để so sánh n-gram.
 */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sinh n-gram (size từ 3-5). Trả về Set string. */
export function ngrams(text: string, size: number): Set<string> {
  const tokens = normalizeForCompare(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.add(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

/**
 * Tính tỉ lệ n-gram của bài mới trùng với corpus (PUBLISHED articles).
 * Trả 0-1; >0.15 nghĩa là quá nhiều phrase trùng.
 */
export function ngramOverlapRatio(text: string, corpus: string[], size = 4): number {
  const target = ngrams(text, size);
  if (target.size === 0) return 0;
  const corpusGrams = new Set<string>();
  for (const c of corpus) {
    for (const g of ngrams(c, size)) corpusGrams.add(g);
  }
  let hits = 0;
  for (const g of target) {
    if (corpusGrams.has(g)) hits += 1;
  }
  return hits / target.size;
}

/**
 * Phát hiện cliché phrases. Lấy list từ DB PromptTemplate "phrase-blacklist" (Sprint 2.9 seed)
 * hoặc fallback default dưới đây.
 */
export const DEFAULT_PHRASE_BLACKLIST = [
  "trong thời đại công nghệ 4.0",
  "không thể phủ nhận",
  "không thể phủ nhận rằng",
  "qua đó có thể thấy",
  "tóm lại",
  "đáng đồng tiền bát gạo",
  "tối ưu hóa trải nghiệm",
  "trải nghiệm tuyệt vời",
  "nâng tầm trải nghiệm",
  "đỉnh cao của công nghệ",
  "lựa chọn hoàn hảo",
  "siêu phẩm",
  "không thể bỏ qua",
  "đắc lực",
  "đồng hành cùng bạn",
  "cuộc sống hiện đại",
  "ngày càng phổ biến",
  "ngày càng được ưa chuộng"
];

export function findBlacklistedPhrases(text: string, blacklist: string[]): string[] {
  const norm = normalizeForCompare(text);
  const hits: string[] = [];
  for (const phrase of blacklist) {
    const np = normalizeForCompare(phrase);
    if (np && norm.includes(np)) hits.push(phrase);
  }
  return hits;
}
