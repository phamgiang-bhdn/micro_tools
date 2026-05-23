"use server";

import { redirect } from "next/navigation";
import { createTrackingRedirect } from "./tracking";

/** Server action cho nút "Xem deal". Dùng qua .bind(null, productId, affiliateUrl) để bind args. */
export async function affiliateRedirectAction(
  productId: string,
  affiliateUrl: string
): Promise<void> {
  const tracked = await createTrackingRedirect({ productId, affiliateUrl });
  // finalUrl="" chỉ xảy ra khi affiliateUrl input rỗng — early return tránh redirect("") crash.
  if (!tracked.finalUrl) return;
  redirect(tracked.finalUrl);
}
