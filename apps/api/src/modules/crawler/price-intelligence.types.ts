/**
 * Price intelligence — deterministic verdict từ lịch sử giá (PriceSnapshot).
 * Đây là moat "soi deal thật/ảo": ChatGPT không có lịch sử giá VN real-time để phán.
 * KHÔNG dùng AI ở đây — pure + cheap + testable. (AI verdict là Phase 3 agent.)
 */

export type PriceVerdict =
  /** Giá hiện tại rẻ hơn rõ so với trung bình gần đây. */
  | "GIA_TOT"
  /** Giá niêm yết (anchor) thổi cao so với giá thực từng thấy → "giảm ảo". */
  | "GIA_AO"
  /** Chạm đáy giá trong cửa sổ 90 ngày. */
  | "DAY_GIA"
  /** Giá quanh mức bình thường. */
  | "BINH_THUONG"
  /** Chưa đủ lịch sử để phán (sản phẩm mới / mới theo dõi). */
  | "THIEU_DU_LIEU";

export interface PriceIntel {
  verdict: PriceVerdict;
  currentPrice: number | null;
  lowest30d: number | null;
  lowest90d: number | null;
  highest90d: number | null;
  avg30d: number | null;
  /** % rẻ hơn trung bình 30 ngày (dương = đang rẻ hơn TB). Null nếu thiếu data. */
  dropFromAvgPct: number | null;
  /** True khi current chạm đáy 90 ngày (trong ngưỡng dung sai). */
  isAtLowest: boolean;
  sampleCount: number;
  spanDays: number;
  firstSeenAt: string | null;
  computedAt: string;
}

export interface PriceObservation {
  /** Giá hiệu lực (giá người mua trả). */
  price: number;
  /** Giá niêm yết công bố (anchor) — để soi giảm ảo. */
  originalPrice: number | null;
  capturedAt: Date;
}

/** originalPrice > max giá thực * tỉ lệ này → coi anchor là ảo. */
const FAKE_ANCHOR_RATIO = 1.15;
/** current <= đáy90 * tỉ lệ này → coi như chạm đáy. */
const AT_LOWEST_TOLERANCE = 1.02;
/** current <= TB30 * tỉ lệ này → coi là giá tốt. */
const GOOD_DEAL_RATIO = 0.95;
/** Biên độ (max-min)/min tối thiểu để coi là có biến động thật — tránh gán "đáy" oan cho giá phẳng. */
const MIN_VARIATION = 0.05;
/** Cần tối thiểu chừng này snapshot + span ngày mới dám phán (tránh "ảo" oan ngày đầu). */
const MIN_SAMPLES = 3;
const MIN_SPAN_DAYS = 2;
const DAY_MS = 24 * 3_600_000;

const round = (n: number): number => Math.round(n);

/**
 * Phán verdict từ chuỗi observation. Pure — không I/O. `now` inject để test.
 * Thiếu dữ liệu (ít sample / span ngắn) → THIEU_DU_LIEU nhưng vẫn trả số đã tính được.
 */
export function classifyPrice(observations: PriceObservation[], now: Date = new Date()): PriceIntel {
  const computedAt = now.toISOString();
  const empty: PriceIntel = {
    verdict: "THIEU_DU_LIEU",
    currentPrice: null,
    lowest30d: null,
    lowest90d: null,
    highest90d: null,
    avg30d: null,
    dropFromAvgPct: null,
    isAtLowest: false,
    sampleCount: 0,
    spanDays: 0,
    firstSeenAt: null,
    computedAt
  };

  if (observations.length === 0) return empty;

  const sorted = [...observations].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const within90 = sorted.filter((o) => now.getTime() - o.capturedAt.getTime() <= 90 * DAY_MS);
  const series = within90.length > 0 ? within90 : sorted;

  const latest = series[series.length - 1];
  const current = latest.price;
  const latestOriginal = latest.originalPrice;

  const prices90 = series.map((o) => o.price);
  const lowest90d = Math.min(...prices90);
  const highest90d = Math.max(...prices90);

  const within30 = series.filter((o) => now.getTime() - o.capturedAt.getTime() <= 30 * DAY_MS);
  const prices30 = (within30.length > 0 ? within30 : series).map((o) => o.price);
  const lowest30d = Math.min(...prices30);
  const avg30d = prices30.reduce((s, p) => s + p, 0) / prices30.length;

  const spanDays = (latest.capturedAt.getTime() - series[0].capturedAt.getTime()) / DAY_MS;
  const sampleCount = series.length;
  const dropFromAvgPct = avg30d > 0 ? round(((avg30d - current) / avg30d) * 100) : null;
  const hasVariation = lowest90d > 0 && (highest90d - lowest90d) / lowest90d >= MIN_VARIATION;
  const isAtLowest = hasVariation && current <= lowest90d * AT_LOWEST_TOLERANCE;

  const base = {
    currentPrice: current,
    lowest30d,
    lowest90d,
    highest90d,
    avg30d: round(avg30d),
    dropFromAvgPct,
    isAtLowest,
    sampleCount,
    spanDays: round(spanDays),
    firstSeenAt: series[0].capturedAt.toISOString(),
    computedAt
  };

  // Chưa đủ lịch sử → không dám phán thật/ảo/đáy.
  if (sampleCount < MIN_SAMPLES || spanDays < MIN_SPAN_DAYS) {
    return { ...base, verdict: "THIEU_DU_LIEU" };
  }

  let verdict: PriceVerdict;
  if (latestOriginal !== null && latestOriginal > highest90d * FAKE_ANCHOR_RATIO) {
    verdict = "GIA_AO";
  } else if (isAtLowest) {
    verdict = "DAY_GIA";
  } else if (current <= avg30d * GOOD_DEAL_RATIO) {
    verdict = "GIA_TOT";
  } else {
    verdict = "BINH_THUONG";
  }

  return { ...base, verdict };
}
