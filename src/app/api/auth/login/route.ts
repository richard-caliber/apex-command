import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, verifyLoginToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const submitted = body?.token;
  if (!submitted || typeof submitted !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  if (!verifyLoginToken(submitted)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res);
  return res;
}
