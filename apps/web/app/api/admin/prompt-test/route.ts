import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const response = await fetch(`${API_BASE_URL}/admin/prompts/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-role": ADMIN_ROLE,
        "x-admin-key": ADMIN_API_KEY
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const raw = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: raw || "Prompt test failed" }, { status: response.status });
    }

    return NextResponse.json(JSON.parse(raw));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prompt test request failed" },
      { status: 500 }
    );
  }
}
