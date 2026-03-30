import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { Prompt } from "../route";

const KV_KEY = "apex:prompts";
const TOKEN = "apex-live-2026";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const data = await kv.get<Prompt[]>(KV_KEY);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const idx = data.findIndex((p) => p.id === id);
  if (idx === -1) return NextResponse.json({ error: "Prompt not found" }, { status: 404 });

  data[idx] = { ...data[idx], ...body, id };
  await kv.set(KV_KEY, data);
  return NextResponse.json(data[idx]);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await kv.get<Prompt[]>(KV_KEY);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filtered = data.filter((p) => p.id !== id);
  if (filtered.length === data.length) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  await kv.set(KV_KEY, filtered);
  return NextResponse.json({ ok: true });
}
