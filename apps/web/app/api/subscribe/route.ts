import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();
      body = {
        email: form.get("email") || undefined,
        source: form.get("source") || "deal_hot_footer",
        preferredNiches: []
      };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.warn("[subscribe] proxy failure", error);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
