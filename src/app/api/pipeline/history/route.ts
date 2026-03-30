import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const TOKEN = "apex-live-2026";

function kvKey(accountId: string, date: string) {
  return `apex:pipeline:${accountId}:${date}`;
}

// GET /api/pipeline/history?account=caliber&date=2026-03-28
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account");
  const date = req.nextUrl.searchParams.get("date");
  if (!accountId || !date) {
    return NextResponse.json({ error: "account and date params required" }, { status: 400 });
  }

  const snapshot = await kv.get<Record<string, unknown>>(kvKey(accountId, date));
  if (!snapshot) {
    return NextResponse.json({ error: "No snapshot for this date" }, { status: 404 });
  }
  return NextResponse.json(snapshot);
}

// POST /api/pipeline/history — save a day's snapshot
// Body: { account: "caliber", date: "2026-03-29", topic: "...", grid: {...} }
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { account, date, ...snapshot } = body;
  if (!account || !date) {
    return NextResponse.json({ error: "account and date fields required" }, { status: 400 });
  }

  await kv.set(kvKey(account, date), snapshot);
  return NextResponse.json({ ok: true });
}
