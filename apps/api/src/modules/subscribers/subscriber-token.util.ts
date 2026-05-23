import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

function getSecret(): string {
  return process.env.SUBSCRIBER_TOKEN_SECRET ?? process.env.ADMIN_API_KEY ?? "change-me";
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function createConfirmationToken(subscriberId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${subscriberId}.${expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest();
  return `${base64url(Buffer.from(payload, "utf8"))}.${base64url(sig)}`;
}

export function verifyConfirmationToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const payload = fromBase64url(parts[0]).toString("utf8");
    const sig = fromBase64url(parts[1]);
    const expected = createHmac("sha256", getSecret()).update(payload).digest();
    if (expected.length !== sig.length || !timingSafeEqual(expected, sig)) return null;
    const [subscriberId, expiresStr] = payload.split(".");
    const expiresAt = Number(expiresStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
    if (!subscriberId) return null;
    return subscriberId;
  } catch {
    return null;
  }
}
