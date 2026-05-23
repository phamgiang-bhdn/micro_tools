import { ImageResponse } from "next/og";
import { isValidYmd, formatVnDate, todayVN } from "../../../lib/date";

export const runtime = "edge";
export const alt = "Deal hot dealvault";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ date?: string }> | { date?: string };
}

export default async function OgImage({ params }: Props): Promise<ImageResponse> {
  const resolved = await Promise.resolve(params);
  const raw = resolved?.date;
  const date = isValidYmd(raw) ? raw : todayVN();
  const dateLabel = formatVnDate(date);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: "linear-gradient(135deg,#fff5f0 0%,#ffe1cc 50%,#ff8a4d 100%)",
          fontFamily: "system-ui,sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#ee1f12",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800
            }}
          >
            d.
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a" }}>dealvault</span>
            <span style={{ fontSize: 16, color: "#666" }}>Săn deal khôn — đối chiếu giá thật</span>
          </div>
        </div>

        <div style={{ marginTop: 80, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#c2410c" }}>🔥 DEAL HOT</span>
          <span style={{ fontSize: 88, fontWeight: 800, color: "#1a1a1a", marginTop: 12, lineHeight: 1 }}>
            Top 10 deal {dateLabel}
          </span>
          <span style={{ fontSize: 32, color: "#444", marginTop: 24 }}>
            Đã đối chiếu giá. Mua 1-tap qua đối tác chính thức.
          </span>
        </div>

        <div style={{ marginTop: "auto", fontSize: 22, color: "#666" }}>
          dealvault.vn/deal-hot/{date}
        </div>
      </div>
    ),
    { ...size }
  );
}
