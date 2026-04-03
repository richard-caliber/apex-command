import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:content-queue";
const TOKEN = "apex-live-2026";

interface QueueItem {
  id: string;
  project_id: string;
  title: string;
  format: string;
  platforms: string[];
  pillar: string;
  scheduled_date: string;
  status: string;
  pipeline_step: string;
  backburner: boolean;
  created_at: string;
  updated_at: string;
}

interface Store { items: QueueItem[]; lastUpdated: string }
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

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        pillar: fields.pillar || "", scheduled_date: fields.scheduled_date || "",
        status: fields.status || "draft", pipeline_step: fields.pipeline_step || "research",
        backburner: fields.backburner ?? false, created_at: now, updated_at: now,
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
