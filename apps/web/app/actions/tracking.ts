"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export interface TrackingInput {
  productId: string;
  affiliateUrl: string;
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
  if (!productId || !affiliateUrl) return;
  const tracked = await createTrackingRedirect({ productId, affiliateUrl });
  redirect(tracked.finalUrl);
}

export async function createTrackingRedirect(input: TrackingInput): Promise<TrackingResult> {
  try {
    const trackingCode = randomUUID().replace(/-/g, "");
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
    const userAgent = requestHeaders.get("user-agent") ?? "unknown";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || "0.0.0.0";

    const response = await fetch(`${API_BASE_URL}/tracking/click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId: input.productId,
        trackingCode,
        ipAddress,
        userAgent
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Track click failed (${response.status}): ${text}`);
    }

    const parsedUrl = new URL(input.affiliateUrl);
    parsedUrl.searchParams.set("utm_source", trackingCode);

    return {
      trackingCode,
      finalUrl: parsedUrl.toString()
    };
  } catch (error: unknown) {
    console.error("createTrackingRedirect failed:", error);
    throw new Error("Unable to create tracking redirect");
  }
}
