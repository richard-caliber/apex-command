import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:content-strategy";
const TOKEN = "apex-live-2026";

interface ContentStrategy {
  id: string;
  project_id: string;
  approved_by: string;
  approved_at: string;
  pillars: { name: string; description: string; pct: number; examples: string[] }[];
  schedule: { frequency: string; days: string[]; times: string[]; format_rotation: Record<string, string>; batch_day: string };
  rules: { voice: string; visual: string; caption_formula: string; hashtags: string[]; never_post: string[] };
  production: { step: string; owner: string; time: string; tools: string[] }[];
  scaling: { trigger: string; threshold: string; action: string }[];
  ideas: { title: string; format: string; pillar: string; hook: string; effort: string; used: boolean }[];
  metrics: { weekly: string[]; targets_30d: Record<string, string>; targets_60d: Record<string, string>; targets_90d: Record<string, string>; kill_criteria: string[] };
  created_at: string;
  updated_at: string;
}

interface Store { items: ContentStrategy[]; lastUpdated: string }

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
    return NextResponse.json({ items: store.items, lastUpdated: store.lastUpdated });
  }

  if (action === "get") {
    if (!body.id && !body.project_id) return NextResponse.json({ error: "id or project_id required" }, { status: 400 });
    const store = await getStore();
    const item = body.project_id
      ? store.items.find((i) => i.project_id === body.project_id)
      : store.items.find((i) => i.id === body.id);
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
        id, project_id: fields.project_id || "", approved_by: fields.approved_by || "",
        approved_at: fields.approved_at || now,
        pillars: fields.pillars || [], schedule: fields.schedule || { frequency: "", days: [], times: [], format_rotation: {}, batch_day: "monday" },
        rules: fields.rules || { voice: "", visual: "", caption_formula: "", hashtags: [], never_post: [] },
        production: fields.production || [], scaling: fields.scaling || [],
        ideas: fields.ideas || [], metrics: fields.metrics || { weekly: [], targets_30d: {}, targets_60d: {}, targets_90d: {}, kill_criteria: [] },
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
