import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";
const ADMIN_ROLE = process.env.ADMIN_ROLE ?? "admin";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "change-me";

/**
 * Polling endpoint cho article-v2-client. Trước đây gọi qua server action
 * (`getArticleProgressAction`), Next encode thành POST → log Web ồn mỗi 2s.
 * Route Handler này là GET thuần → log gọn, không gây revalidate cache.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/admin/articles/${id}/progress`, {
      method: "GET",
      headers: { "x-admin-role": ADMIN_ROLE, "x-admin-key": ADMIN_API_KEY },
      cache: "no-store"
    });
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || "progress poll failed" }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
