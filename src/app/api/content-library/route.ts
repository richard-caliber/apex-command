import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:content-library";
interface LibraryItem {
  id: string;
  project_id: string;
  title: string;
  format: string;
  platforms: string[];
  pillar: string;
  posted_date: string;
  images: string[];
  caption: string;
  metrics: { reach: number; likes: number; comments: number; saves: number; shares: number; engagement_rate: number };
  performance_tag: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Store { items: LibraryItem[]; lastUpdated: string }
const SEED: Store = { items: [], lastUpdated: new Date().toISOString() };

async function getStore(): Promise<Store> {
  const cached = await kv.get<Store>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: Store) {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  if (action === "list") {
    const store = await getStore();
    let items = store.items;
    if (body.project_id) items = items.filter((i) => i.project_id === body.project_id);
    return NextResponse.json({ items, lastUpdated: store.lastUpdated });
  }

  if (action === "get") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const store = await getStore();
    const item = store.items.find((i) => i.id === body.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  const unauthorized = requireWriteAuth(req);


  if (unauthorized) return unauthorized;

  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.items.findIndex((i) => i.id === id);
    if (idx >= 0) {
      const { action: _a, ...clean } = fields;
      store.items[idx] = { ...store.items[idx], ...clean, id, updated_at: now };
    } else {
      store.items.push({
        id, project_id: fields.project_id || "", title: fields.title || "",
        format: fields.format || "", platforms: fields.platforms || [],
        pillar: fields.pillar || "", posted_date: fields.posted_date || "",
        images: fields.images || [], caption: fields.caption || "",
        metrics: fields.metrics || { reach: 0, likes: 0, comments: 0, saves: 0, shares: 0, engagement_rate: 0 },
        performance_tag: fields.performance_tag || "average", notes: fields.notes || "",
        created_at: now, updated_at: now,
      });
    }
    await saveStore(store);
    return NextResponse.json(store.items.find((i) => i.id === id));
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const store = await getStore();
    store.items = store.items.filter((i) => i.id !== body.id);
    await saveStore(store);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
