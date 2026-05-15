const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[admin] ${path} failed: ${text}`);
  }
  return (await res.json()) as T;
}
