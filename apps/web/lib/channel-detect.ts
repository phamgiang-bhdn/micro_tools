/**
 * Channel attribution detection (STORY-06).
 *
 * Priority order:
 * 1. utm_source query param (highest — explicit campaign signal).
 * 2. Cookie `dv_channel` (first-touch persisted 30 ngày).
 * 3. HTTP Referer header (best-effort domain match).
 * 4. Default "direct" — không referer + không cookie + không utm.
 */
export type Channel = "organic" | "fb" | "zalo" | "email" | "direct" | "other";

export type AttributionSource = "utm_param" | "cookie" | "referer" | "default";

export interface ChannelDetection {
  channel: Channel;
  source: AttributionSource;
}

const FB_DOMAINS = /facebook|fb\.me|fb\.com|instagram/i;
const ZALO_DOMAINS = /zalo\.me|chat\.zalo/i;
const GOOGLE_DOMAINS = /google\.|googleusercontent|googleadservices/i;
const SEARCH_ENGINES = /bing\.|yahoo\.|duckduckgo|coccoc/i;

export function detectChannelFromInputs(opts: {
  utmSource?: string | null;
  cookieValue?: string | null;
  referer?: string | null;
}): ChannelDetection {
  if (opts.utmSource) {
    const utm = opts.utmSource.toLowerCase();
    if (utm === "fb" || utm === "facebook") return { channel: "fb", source: "utm_param" };
    if (utm === "zalo") return { channel: "zalo", source: "utm_param" };
    if (utm === "email" || utm === "newsletter" || utm === "digest") {
      return { channel: "email", source: "utm_param" };
    }
    if (utm === "organic" || utm === "seo") return { channel: "organic", source: "utm_param" };
  }

  if (opts.cookieValue && isChannel(opts.cookieValue)) {
    return { channel: opts.cookieValue, source: "cookie" };
  }

  if (opts.referer) {
    try {
      const url = new URL(opts.referer);
      const host = url.hostname.toLowerCase();
      if (FB_DOMAINS.test(host)) return { channel: "fb", source: "referer" };
      if (ZALO_DOMAINS.test(host)) return { channel: "zalo", source: "referer" };
      if (GOOGLE_DOMAINS.test(host) || SEARCH_ENGINES.test(host)) {
        return { channel: "organic", source: "referer" };
      }
      if (!host.includes("dealvault") && host !== "localhost") {
        return { channel: "other", source: "referer" };
      }
    } catch {
      /* parse fail — fall through */
    }
  }

  return { channel: "direct", source: "default" };
}

function isChannel(v: string): v is Channel {
  return ["organic", "fb", "zalo", "email", "direct", "other"].includes(v);
}
