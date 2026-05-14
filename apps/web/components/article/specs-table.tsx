import type React from "react";
import type { ProductItem } from "../../lib/types";

interface Props {
  product: ProductItem;
  /** Schema config của tool (Tool.schemaConfig) — quyết định field nào hiển thị. */
  schemaConfig?: Record<string, unknown>;
}

/**
 * Bảng thông số cho REVIEW. Dùng scrapedData + schemaConfig để xác định
 * field nào là spec (vs ảnh / mô tả / giá).
 */
export function SpecsTable({ product, schemaConfig }: Props): React.ReactElement | null {
  const raw = (product.scrapedData ?? {}) as Record<string, unknown>;

  // Lọc các field thuộc về spec dựa trên schemaConfig.
  // Nếu không có schemaConfig → fallback: lấy mọi field có type number|boolean|string
  // KHÔNG nằm trong blacklist (price, image, etc).
  const blacklist = new Set([
    "price",
    "originalPrice",
    "currency",
    "image",
    "imageUrl",
    "thumbnail",
    "store",
    "shop",
    "merchant",
    "seller",
    "rating",
    "stars",
    "score",
    "reviewCount",
    "reviews",
    "ratingCount",
    "badge",
    "brand",
    "description",
    "summary",
    "name",
    "category",
    "type",
    "highlights",
    "features",
    "perks",
    "benefits"
  ]);

  const fieldNames = schemaConfig
    ? Object.keys(schemaConfig)
    : Object.keys(raw).filter((k) => !blacklist.has(k));

  const rows = fieldNames
    .map((field) => ({ field, value: raw[field] }))
    .filter(({ value }) => value !== undefined && value !== null && value !== "");

  if (rows.length === 0) return null;

  return (
    <aside className="not-prose my-8 overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <header className="border-b border-line bg-canvas px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Thông số kỹ thuật</p>
        <h3 className="mt-0.5 text-base font-semibold text-ink">{product.name}</h3>
      </header>
      <dl className="divide-y divide-line">
        {rows.map(({ field, value }) => (
          <div key={field} className="grid grid-cols-[1fr_1.5fr] gap-3 px-5 py-2.5 text-sm sm:grid-cols-[200px_1fr]">
            <dt className="font-medium text-ink-mute">{prettyFieldName(field)}</dt>
            <dd className="text-ink">{formatSpecValue(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function prettyFieldName(field: string): string {
  const map: Record<string, string> = {
    suctionPower: "Lực hút",
    batteryMinutes: "Thời lượng pin",
    maxArea: "Diện tích tối đa",
    mopFunction: "Lau nhà",
    selfEmpty: "Tự đổ rác",
    mapping: "Công nghệ bản đồ",
    appControl: "Điều khiển qua app",
    coverageArea: "Diện tích phù hợp",
    cadr: "CADR",
    filterType: "Loại màng lọc",
    noiseDbMax: "Độ ồn tối đa",
    smartControl: "Smart Home",
    sensors: "Cảm biến"
  };
  if (map[field]) return map[field];
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatSpecValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") {
    return new Intl.NumberFormat("vi-VN").format(value);
  }
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }
  return String(value);
}
