"use server";

import { redirect } from "next/navigation";
import { createTrackingRedirect } from "./tracking";

/** Server action cho nút "Xem deal". Dùng qua .bind(null, productId, affiliateUrl) để bind args. */
export async function affiliateRedirectAction(
  productId: string,
  affiliateUrl: string
): Promise<void> {
  const tracked = await createTrackingRedirect({ productId, affiliateUrl });
  redirect(tracked.finalUrl);
}
