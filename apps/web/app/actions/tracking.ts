"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { detectChannelFromInputs } from "../../lib/channel-detect";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export interface TrackingInput {
  productId: string;
  affiliateUrl: string;
  /** STORY-07: signal cho A/B uplift coupon-inline pill. */
  hasInlineCoupon?: boolean;
  /** Tool tracking (AI-visible refactor). Có khi click từ /ai/[slug]/result/[id]. */
  toolId?: string;
  quizSessionId?: string;
  /** Sàn user chọn click (tiki | shopee | lazada | tiktokshop) — multi-network. */
  marketplace?: string;
}

export interface TrackingResult {
  trackingCode: string;
  finalUrl: string;
}

/**
 * Form-action wrapper: đọc productId + affiliateUrl từ hidden inputs, gọi
 * createTrackingRedirect rồi redirect ngay. Dùng cho inline CTA trong article body.
 */
export async function trackAndRedirectAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "");
  const hasInlineCoupon = formData.get("hasInlineCoupon") === "1";
  if (!productId || !affiliateUrl) return;
  const tracked = await createTrackingRedirect({ productId, affiliateUrl, hasInlineCoupon });
  if (!tracked.finalUrl) return;
  redirect(tracked.finalUrl);
}

/**
 * Top-snapshot outbound: TopProductSnapshot không có Product row trong DB nên không thể tạo
 * ClickLog. Vẫn append `utm_source=<trackingCode>` để AT attribute conversion ở mức network.
 * Phase sau: bảng riêng cho nguồn này.
 */
export async function trackTopSnapshotRedirectAction(formData: FormData): Promise<void> {
  const affiliateUrl = String(formData.get("affiliateUrl") ?? "");
  if (!affiliateUrl) return;
  let finalUrl = affiliateUrl;
  try {
    const trackingCode = randomUUID().replace(/-/g, "");
    const parsed = new URL(affiliateUrl);
    parsed.searchParams.set("utm_source", trackingCode);
    // STORY-06: sub1 = channel cho cross-network attribution.
    const channel = await resolveChannelForRequest();
    parsed.searchParams.set("sub1", channel);
    finalUrl = parsed.toString();
  } catch {
    /* parse fail → redirect raw */
  }
  redirect(finalUrl);
}

const TRACKING_TIMEOUT_MS = 4000;

/**
 * POST `/tracking/click` để tạo ClickLog rồi build affiliate URL với `utm_source=<code>` + `sub1=<channel>`.
 *
 * Fail mode (timeout > 4s, network error, non-ok response): KHÔNG throw. Trả về
 * `{ trackingCode: "", finalUrl: affiliateUrl + sub1 }` để user vẫn complete được mua —
 * chỉ mất attribution row, KHÔNG vỡ outbound.
 */
export async function createTrackingRedirect(input: TrackingInput): Promise<TrackingResult> {
  // STORY 1-3: validate URL hợp lệ NGAY tại nguồn — bắt rỗng, whitespace-only ("  ") LẪN
  // malformed-non-rỗng ("not a url"). Nếu không, các nhánh fallback bên dưới sẽ trả lại chuỗi
  // rác → buyAction redirect rác (cùng lớp lỗi story muốn diệt). finalUrl="" là tín hiệu cho caller.
  if (!isHttpUrl(input.affiliateUrl)) {
    return { trackingCode: "", finalUrl: "" };
  }

  const trackingCode = randomUUID().replace(/-/g, "");

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  const referer = requestHeaders.get("referer");
  const ipAddress = forwardedFor.split(",")[0]?.trim() || "0.0.0.0";

  // STORY-06: detect channel, persist cookie 30 days for first-touch.
  const cookieStore = await cookies();
  const detection = detectChannelFromInputs({
    cookieValue: cookieStore.get("dv_channel")?.value,
    referer
  });
  if (!cookieStore.get("dv_channel") && detection.channel !== "direct") {
    cookieStore.set("dv_channel", detection.channel, {
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      path: "/"
    });
  }

  let response: Response | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRACKING_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE_URL}/tracking/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: input.productId,
        trackingCode,
        ipAddress,
        userAgent,
        channel: detection.channel,
        attributionSource: detection.source,
        hasInlineCoupon: Boolean(input.hasInlineCoupon),
        toolId: input.toolId,
        quizSessionId: input.quizSessionId,
        marketplace: input.marketplace
      }),
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error: unknown) {
    clearTimeout(timeout);
    console.warn("[tracking] fallback to direct redirect", {
      productId: input.productId,
      reason: error instanceof Error ? error.message : String(error)
    });
    return {
      trackingCode: "",
      finalUrl: appendSub1(input.affiliateUrl, detection.channel)
    };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    console.warn("[tracking] fallback to direct redirect", {
      productId: input.productId,
      status: response.status
    });
    return {
      trackingCode: "",
      finalUrl: appendSub1(input.affiliateUrl, detection.channel)
    };
  }

  try {
    const parsedUrl = new URL(input.affiliateUrl);
    parsedUrl.searchParams.set("utm_source", trackingCode);
    parsedUrl.searchParams.set("sub1", detection.channel);
    return { trackingCode, finalUrl: parsedUrl.toString() };
  } catch {
    return { trackingCode, finalUrl: input.affiliateUrl };
  }
}

/** STORY 1-3: URL hợp lệ = parse được + protocol http/https. Chặn rỗng/whitespace/malformed. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function appendSub1(url: string, channel: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("sub1", channel);
    return u.toString();
  } catch {
    return url;
  }
}

async function resolveChannelForRequest(): Promise<string> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  return detectChannelFromInputs({
    cookieValue: cookieStore.get("dv_channel")?.value,
    referer: requestHeaders.get("referer")
  }).channel;
}
