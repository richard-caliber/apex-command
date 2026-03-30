import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:posts";
const TOKEN = "apex-live-2026";

interface PostsData {
  items: Record<string, unknown>[];
  lastUpdated: string;
}

async function getData(): Promise<PostsData | null> {
  return kv.get<PostsData>(KV_KEY);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = data.items.find((i) => i.id === id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const updates = await req.json();
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = data.items.find((i) => i.id === id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  Object.assign(item, updates, { updated_at: new Date().toISOString() });
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json(item);
}
