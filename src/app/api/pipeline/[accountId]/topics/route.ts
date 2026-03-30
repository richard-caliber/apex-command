import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:pipeline";
const TOKEN = "apex-live-2026";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;
  const topic = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kv.get<any>(KV_KEY);
  if (!data) return NextResponse.json({ error: "No pipeline data" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = data.accounts.find((a: any) => a.id === accountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  if (!account.topics) account.topics = [];
  account.topics.push(topic);
  await kv.set(KV_KEY, data);
  return NextResponse.json(topic, { status: 201 });
}
