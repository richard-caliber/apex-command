import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:content-performance";
const TOKEN = "apex-live-2026";

interface PerformanceData {
  id: string;
  project_id: string;
  period: string;
  total_posts: number;
  avg_engagement_rate: number;
  total_reach: number;
  follower_growth: number;
  top_posts: { id: string; title: string; why: string }[];
  bottom_posts: { id: string; title: string; why: string }[];
  patterns: { working: string[]; not_working: string[] };
  by_pillar: Record<string, number>;
  by_format: Record<string, number>;
  best_day: string;
  best_time: string;
  remix_queue: { original_id: string; approach: string; status: string }[];
  created_at: string;
  updated_at: string;
}

interface Store { items: PerformanceData[]; lastUpdated: string }
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
        id, project_id: fields.project_id || "", period: fields.period || "",
        total_posts: fields.total_posts || 0, avg_engagement_rate: fields.avg_engagement_rate || 0,
        total_reach: fields.total_reach || 0, follower_growth: fields.follower_growth || 0,
        top_posts: fields.top_posts || [], bottom_posts: fields.bottom_posts || [],
        patterns: fields.patterns || { working: [], not_working: [] },
        by_pillar: fields.by_pillar || {}, by_format: fields.by_format || {},
        best_day: fields.best_day || "", best_time: fields.best_time || "",
        remix_queue: fields.remix_queue || [], created_at: now, updated_at: now,
      });
    }
    await saveStore(store);
    return NextResponse.json(store.items.find((i) => i.id === id));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
