import type React from "react";
import { formatMoney, formatShortDate } from "../../lib/format";
import type { PriceIntel } from "../../lib/types";
import { DealVerdictBadge } from "./deal-verdict-badge";

export interface PricePoint {
  capturedAt: string;
  price: number;
  originalPrice: number | null;
}

const W = 600;
const H = 140;
const PAD_X = 8;
const PAD_Y = 16;

/**
 * Lịch sử giá (V4) — SVG thuần, không thêm dependency chart. Hiện summary verdict + đường giá
 * + đánh dấu điểm đáy. Thiếu dữ liệu (<2 điểm) → note "đang xây lịch sử" (đúng trạng thái pre-launch).
 */
export function PriceHistoryChart({
  points,
  intel,
  currency = "VND"
}: {
  points: PricePoint[];
  intel?: PriceIntel | null;
  currency?: string;
}): React.ReactElement {
  const hasSeries = points.length >= 2;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas/70 px-5 py-3">
        <p className="text-sm font-semibold text-ink">Lịch sử giá</p>
        <DealVerdictBadge intel={intel} />
      </div>

      {intel && intel.verdict !== "THIEU_DU_LIEU" ? <IntelSummary intel={intel} currency={currency} /> : null}

      <div className="px-5 py-4">
        {hasSeries ? (
          <Sparkline points={points} currency={currency} />
        ) : (
          <p className="text-sm text-ink-soft">
            Đang xây lịch sử giá cho sản phẩm này — cần thêm vài ngày dữ liệu để chấm “giá thật/ảo”.
          </p>
        )}
      </div>
    </section>
  );
}

function IntelSummary({ intel, currency }: { intel: PriceIntel; currency: string }): React.ReactElement {
  const items: Array<{ label: string; value: string }> = [];
  if (intel.lowest90d !== null) items.push({ label: "Thấp nhất 90 ngày", value: formatMoney(intel.lowest90d, currency) });
  if (intel.avg30d !== null) items.push({ label: "Trung bình 30 ngày", value: formatMoney(intel.avg30d, currency) });
  if (intel.highest90d !== null) items.push({ label: "Cao nhất 90 ngày", value: formatMoney(intel.highest90d, currency) });
  if (items.length === 0) return <></>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-5 py-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:justify-start">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">{it.label}</dt>
          <dd className="text-sm font-semibold text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sparkline({ points, currency }: { points: PricePoint[]; currency: string }): React.ReactElement {
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const n = points.length;

  const x = (i: number): number => PAD_X + (i / (n - 1)) * (W - 2 * PAD_X);
  const y = (price: number): number => PAD_Y + (1 - (price - min) / range) * (H - 2 * PAD_Y);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - PAD_Y).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD_Y).toFixed(1)} Z`;

  const lowIdx = prices.indexOf(min);
  const first = points[0];
  const last = points[n - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Biểu đồ lịch sử giá">
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#priceFill)" />
        <path d={line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Đánh dấu điểm đáy */}
        <circle cx={x(lowIdx)} cy={y(min)} r="3.5" fill="#16a34a" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-mute">
        <span>{formatShortDate(first.capturedAt)}</span>
        <span className="font-medium text-success-ink">Đáy: {formatMoney(min, currency)}</span>
        <span>{formatShortDate(last.capturedAt)}</span>
      </div>
    </div>
  );
}
