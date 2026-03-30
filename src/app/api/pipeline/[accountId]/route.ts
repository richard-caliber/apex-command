import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:pipeline";
const TOKEN = "apex-live-2026";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;
  const updates = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kv.get<any>(KV_KEY);
  if (!data) return NextResponse.json({ error: "No pipeline data" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idx = data.accounts.findIndex((a: any) => a.id === accountId);
  if (idx === -1) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  data.accounts[idx] = { ...data.accounts[idx], ...updates, id: accountId };
  await kv.set(KV_KEY, data);
  return NextResponse.json(data.accounts[idx]);
}
