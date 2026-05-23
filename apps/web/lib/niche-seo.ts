// Helpers cho niche page SEO copy: H1 dynamic theo time, auto-gen intro paragraph.
//
// Lý do tách file: page render dài, các helper này cần test riêng & dùng cả ở
// `generateMetadata` (title) lẫn page body (H1). Đặt cạnh format.ts.

interface NicheLite {
  name: string;
  slug: string;
}

export function buildNicheTitle(niche: NicheLite, productCount: number, now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Top N pattern — chỉ apply khi có ≥5 product để không "Top 3" hơi gượng.
  const cap = productCount >= 10 ? 10 : productCount >= 5 ? productCount : 0;
  if (cap > 0) return `Top ${cap} ${niche.name} đáng mua tháng ${month}/${year}`;
  return `${niche.name} — Deal tốt nhất tháng ${month}/${year}`;
}

export function buildNicheMetaTitle(niche: NicheLite, productCount: number, now: Date = new Date()): string {
  return `${buildNicheTitle(niche, productCount, now)} | dealvault`;
}

export function buildNicheMetaDescription(
  niche: NicheLite,
  productCount: number,
  topDiscount: number
): string {
  if (productCount === 0) {
    return `${niche.name} đang được cập nhật. Xem các danh mục khác đang có deal tốt trên dealvault.`;
  }
  const disc = topDiscount > 0 ? `Giảm sâu nhất tới -${topDiscount}%.` : "";
  return `So sánh ${productCount} ${niche.name.toLowerCase()} từ Lazada, Shopee, TikTok Shop. ${disc} Giá đối chiếu hàng giờ, click thẳng ra sàn.`.trim();
}

export function autoIntro(
  niche: NicheLite,
  count: number,
  lastUpdatedRelative: string,
  topDiscount: number
): string {
  if (count === 0) {
    return `${niche.name} đang được cập nhật. Trong lúc đợi, xem các danh mục đang có nhiều deal tốt bên dưới — hoặc đọc cẩm nang chọn mua từ team biên tập.`;
  }
  const discountClause = topDiscount > 0
    ? ` Mức giảm sâu nhất hiện tại là ${topDiscount}%.`
    : "";
  return `Tổng hợp ${count} ${niche.name.toLowerCase()} đang giảm giá tại Lazada, Shopee, TikTok Shop và các shop chính hãng.${discountClause} Giá được đối chiếu ${lastUpdatedRelative} — bạn xem nhanh, so sánh chéo, click thẳng ra sàn không cần đăng ký.`;
}

/**
 * Top spec column từ Niche.schemaConfig — filter những key có data trong ≥3 row.
 * Trả max 5 column tên đã chuẩn hoá để render comparison table header.
 */
export function pickComparisonColumns(
  schemaConfig: Record<string, unknown> | null | undefined,
  rows: Array<Record<string, unknown>>,
  maxColumns = 5
): string[] {
  if (!schemaConfig) return [];
  const keys = Object.keys(schemaConfig).filter((k) => typeof schemaConfig[k] === "string");
  // Threshold linh hoạt: ≥3 row có giá trị, hoặc ít nhất 1 nếu tổng row < 3.
  const minPresent = Math.min(3, rows.length);
  const ranked = keys
    .map((key) => {
      const present = rows.filter((r) => {
        const v = r[key];
        return v !== null && v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v));
      }).length;
      return { key, present };
    })
    .filter((c) => c.present >= minPresent)
    .sort((a, b) => b.present - a.present)
    .slice(0, maxColumns)
    .map((c) => c.key);
  return ranked;
}

const SPEC_LABEL_VN: Record<string, string> = {
  cpu: "CPU",
  chipset: "Chipset",
  chip: "Chip",
  gpu: "GPU",
  ramGb: "RAM",
  storageGb: "SSD",
  screenInches: "Màn hình",
  refreshRateHz: "Tần số",
  batteryHours: "Pin",
  batteryMah: "Pin",
  batteryDays: "Pin",
  weightKg: "Cân nặng",
  weightGram: "Cân nặng",
  chargingW: "Sạc",
  mainCameraMp: "Camera",
  os: "OS",
  panelType: "Panel",
  resolution: "Phân giải",
  resolutionMax: "Phân giải",
  connection: "Kết nối",
  layout: "Layout",
  switchType: "Switch",
  driverSizeMm: "Driver",
  anc: "ANC",
  bluetoothVersion: "Bluetooth",
  waterproofIp: "Chống nước",
  waterproofMeters: "Chống nước",
  outputW: "Công suất",
  suctionPower: "Lực hút",
  maxArea: "Diện tích",
  mopFunction: "Lau nhà",
  selfEmpty: "Tự đổ rác",
  coverageArea: "Diện tích",
  cadr: "CADR",
  noiseDbMax: "Tiếng ồn",
  filterType: "Lọc",
  skinType: "Loại da",
  volumeMl: "Dung tích",
  keyIngredients: "Hoạt chất",
  spf: "SPF",
  heartRate: "Nhịp tim",
  spo2: "SpO2",
  gps: "GPS",
  ecg: "ECG"
};

export function formatSpecLabel(key: string): string {
  if (SPEC_LABEL_VN[key]) return SPEC_LABEL_VN[key];
  // Fallback: camelCase → "Camel Case"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function formatSpecValue(value: unknown, key: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") {
    if (key === "ramGb" || key === "storageGb") return `${value}GB`;
    if (key === "screenInches") return `${value}"`;
    if (key === "refreshRateHz") return `${value}Hz`;
    if (key === "batteryHours") return `${value}h`;
    if (key === "batteryDays") return `${value} ngày`;
    if (key === "batteryMah") return `${value}mAh`;
    if (key === "weightKg") return `${value}kg`;
    if (key === "weightGram") return `${value}g`;
    if (key === "chargingW" || key === "outputW") return `${value}W`;
    if (key === "mainCameraMp") return `${value}MP`;
    if (key === "spf") return `SPF ${value}`;
    if (key === "volumeMl") return `${value}ml`;
    if (key === "noiseDbMax") return `≤${value}dB`;
    if (key === "waterproofMeters") return `${value}m`;
    if (key === "coverageArea" || key === "maxArea") return `${value}m²`;
    if (key === "cadr") return `${value} m³/h`;
    if (key === "suctionPower") return `${value}Pa`;
    return String(value);
  }
  if (typeof value === "string") return value;
  return "—";
}
