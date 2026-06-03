import type React from "react";
import { formatMoney, normalizeProduct } from "../../lib/format";
import type { ProductItem } from "../../lib/types";
import { AffiliateCta } from "./affiliate-cta";

interface Props {
  products: ProductItem[];
  schemaConfig?: Record<string, unknown>;
}

/**
 * Bảng so sánh cho BUYING_GUIDE: mỗi sản phẩm 1 cột.
 * Tự pick ra 3-4 spec quan trọng nhất từ schemaConfig.
 */
export function ComparisonTable({ products: raw, schemaConfig }: Props): React.ReactElement | null {
  if (raw.length < 2) return null;

  const products = raw.map((p) => ({ raw: p, view: normalizeProduct(p) }));

  // Lấy 4 spec đầu tiên trong schemaConfig (ưu tiên thứ tự khai báo)
  const specFields = schemaConfig ? Object.keys(schemaConfig).slice(0, 4) : [];

  return (
    <aside className="not-prose my-10 overflow-hidden rounded-3xl border border-line bg-card shadow-card">
      <header className="border-b border-line bg-canvas px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700">So sánh nhanh</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight text-ink">Đặt cạnh nhau</h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/40">
              <th className="sticky left-0 w-32 bg-canvas/40 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-mute" />
              {products.map(({ view, raw: r }) => (
                <th key={r.id} className="min-w-[180px] px-4 py-3 text-left">
                  <div className="flex flex-col gap-2">
                    <div className="overflow-hidden rounded-lg bg-canvas">
                      {view.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={view.image} alt={view.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="grid aspect-[4/3] w-full place-items-center bg-gradient-to-br from-primary-50 to-accent-50 text-2xl font-bold text-primary-700">
                          {view.brand?.[0] ?? "★"}
                        </div>
                      )}
                    </div>
                    {view.brand ? (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">{view.brand}</p>
                    ) : null}
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{view.name}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <td className="sticky left-0 bg-card/60 px-5 py-3 text-xs font-medium text-ink-mute">Giá</td>
              {products.map(({ view, raw: r }) => (
                <td key={r.id} className="px-4 py-3">
                  {view.price !== undefined ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-base font-bold text-primary-700">{formatMoney(view.price, view.currency)}</span>
                      {view.originalPrice && view.originalPrice > view.price ? (
                        <span className="text-[11px] text-ink-mute line-through">
                          {formatMoney(view.originalPrice, view.currency)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-ink-mute">—</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="sticky left-0 bg-card/60 px-5 py-3 text-xs font-medium text-ink-mute">Đánh giá</td>
              {products.map(({ view, raw: r }) => (
                <td key={r.id} className="px-4 py-3 text-sm">
                  {view.rating !== undefined ? (
                    <span className="inline-flex items-center gap-1 text-ink">
                      <span aria-hidden className="text-amber-500">★</span>
                      <span className="font-semibold">{view.rating.toFixed(1)}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-ink-mute">—</span>
                  )}
                </td>
              ))}
            </tr>
            {specFields.map((field) => (
              <tr key={field}>
                <td className="sticky left-0 bg-card/60 px-5 py-3 text-xs font-medium text-ink-mute">
                  {prettyName(field)}
                </td>
                {products.map(({ raw: r }) => {
                  const raw = (r.scrapedData ?? {}) as Record<string, unknown>;
                  const value = raw[field];
                  return (
                    <td key={r.id} className="px-4 py-3 text-sm text-ink">
                      {value === undefined || value === null ? (
                        <span className="text-xs text-ink-mute">—</span>
                      ) : (
                        formatSpec(value)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-canvas/30">
              <td className="sticky left-0 bg-canvas/30 px-5 py-3 text-xs font-medium text-ink-mute" />
              {products.map(({ raw: r, view }) => (
                <td key={r.id} className="px-4 py-3">
                  <AffiliateCta
                    productId={r.id}
                    affiliateUrl={r.affiliateUrl}
                    size="sm"
                    className="w-full justify-center"
                    label="Xem deal"
                    store={view.store}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </aside>
  );
}

function prettyName(field: string): string {
  const map: Record<string, string> = {
    suctionPower: "Lực hút (Pa)",
    batteryMinutes: "Pin (phút)",
    maxArea: "Diện tích (m²)",
    mopFunction: "Lau nhà",
    selfEmpty: "Tự đổ rác",
    mapping: "Bản đồ",
    appControl: "App",
    coverageArea: "Diện tích (m²)",
    cadr: "CADR",
    filterType: "Màng lọc",
    noiseDbMax: "Độ ồn (dB)",
    smartControl: "Smart Home",
    sensors: "Cảm biến"
  };
  if (map[field]) return map[field];
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function formatSpec(value: unknown): string {
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "number") return new Intl.NumberFormat("vi-VN").format(value);
  return String(value);
}
