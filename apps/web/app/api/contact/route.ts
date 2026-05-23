import { NextResponse } from "next/server";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    console.log("[contact] new message", {
      name: body?.name,
      email: body?.email,
      kind: body?.kind,
      message: typeof body?.message === "string" ? body.message.slice(0, 200) : null
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
