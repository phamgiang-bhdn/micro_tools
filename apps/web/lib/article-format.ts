import type { ArticleType } from "./types";

/**
 * Phân loại gradient + icon theo type. Dùng cho cover blog không cần ảnh thật.
 */
export function articleVisual(type: ArticleType): {
  gradient: string;
  softBg: string;
  accent: string;
  icon: string;
  label: string;
} {
  if (type === "REVIEW") {
    return {
      gradient: "from-amber-400 via-orange-500 to-rose-500",
      softBg: "bg-orange-50",
      accent: "text-orange-700",
      icon: "★",
      label: "Review chi tiết"
    };
  }
  return {
    gradient: "from-indigo-500 via-sky-500 to-cyan-500",
    softBg: "bg-sky-50",
    accent: "text-sky-700",
    icon: "❖",
    label: "Cẩm nang chọn mua"
  };
}

/**
 * Đếm số chữ (xấp xỉ — đếm whitespace), ước lượng thời gian đọc.
 * Người Việt đọc trung bình ~200 từ/phút (chậm hơn tiếng Anh).
 */
export function readingTime(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_>~`-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
}

export function authorInitials(): string {
  return "dv";
}
