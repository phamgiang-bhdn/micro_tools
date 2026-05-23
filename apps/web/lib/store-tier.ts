// Suy luận tier shop từ tên store/merchant — dùng để render badge trust signal.
// Mapping hard-coded ban đầu; nếu cần tinh chỉnh per-niche → move sang DB
// `Niche.storeBadgeConfig` (chưa cần).

export type StoreTier = "mall" | "regular" | null;

const MALL_REGEX = /(laz ?mall|shopee ?mall|tiki ?trading|official|preferred)/i;

export function inferStoreTier(storeStr?: string | null): StoreTier {
  if (!storeStr) return null;
  if (MALL_REGEX.test(storeStr)) return "mall";
  return "regular";
}

export interface StoreBadge {
  label: string;
  tier: StoreTier;
  /** Tailwind background class (chỉ shorthand — component có thể override). */
  toneClass: string;
}

/**
 * Trả về badge user-facing per AC2 mapping table. Null nếu không có store.
 *
 * Order check QUAN TRỌNG: nhánh "mall" phải check trước nhánh "marketplace" thường
 * vì "Shopee Mall" cũng match "shopee". Same cho Lazada/Tiki.
 */
export function formatStoreBadge(storeStr?: string | null): StoreBadge | null {
  if (!storeStr) return null;
  const s = storeStr.toLowerCase();

  if (/(laz ?mall)/.test(s) || (s.includes("lazada") && (s.includes("mall") || s.includes("lazmall"))))
    return mall("LazMall");
  if (s.includes("shopee") && (s.includes("mall") || s.includes("preferred"))) return mall("Shopee Mall");
  if (s.includes("tiki") && (s.includes("trading") || s.includes("official"))) return mall("Tiki Trading");

  if (s.includes("lazada")) return regular("Lazada", "bg-red-500/90 text-white");
  if (s.includes("shopee")) return regular("Shopee", "bg-orange-500/90 text-white");
  if (s.includes("tiki")) return regular("Tiki", "bg-blue-500/90 text-white");
  if (s.includes("tiktok")) return regular("TikTok Shop", "bg-ink/90 text-white");
  if (s.includes("fptshop") || s.includes("fpt shop") || s.includes("fpt")) return regular("FPT Shop", "bg-red-600/90 text-white");
  if (s.includes("nguyen kim") || s.includes("nguyenkim")) return regular("Nguyễn Kim", "bg-red-700/90 text-white");
  if (s.includes("dien may xanh") || s.includes("thegioididong") || s.includes("dienmayxanh"))
    return regular("Điện Máy Xanh", "bg-sky-600/90 text-white");

  return regular(storeStr, "bg-ink/80 text-white");
}

function mall(label: string): StoreBadge {
  return { label, tier: "mall", toneClass: "bg-amber-400 text-ink" };
}

function regular(label: string, tone: string): StoreBadge {
  return { label, tier: "regular", toneClass: tone };
}
