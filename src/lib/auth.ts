import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const SESSION_COOKIE = "apex_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getApiToken(): string {
  const t = process.env.APEX_API_TOKEN;
  if (!t) throw new Error("APEX_API_TOKEN is not configured");
  return t;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Gate every write route with this. Accepts either:
 *   - `Authorization: Bearer <APEX_API_TOKEN>` header (external agents, scripts, OpenClaw VM)
 *   - `apex_session` HttpOnly cookie set by /api/auth/login (browser sessions)
 *
 * Returns a 401 NextResponse on failure, or `null` on success.
 */
export function requireWriteAuth(req: NextRequest): NextResponse | null {
  let token: string;
  try {
    token = getApiToken();
  } catch {
    return NextResponse.json({ error: "Server auth not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), token)) {
    return null;
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && safeEqual(cookie, token)) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function setSessionCookie(res: NextResponse): void {
  const token = getApiToken();
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function verifyLoginToken(submitted: string): boolean {
  let token: string;
  try {
    token = getApiToken();
  } catch {
    return false;
  }
  return safeEqual(submitted, token);
}
