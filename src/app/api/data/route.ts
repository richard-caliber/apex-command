import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:data:v1";
const TOKEN = "apex-live-2026";

export interface Metric {
  id: string;
  project_id: string;
  section: "traffic" | "conversion" | "revenue" | "retention" | "qualitative";
  name: string;
  value: string;
  state: "good" | "warning" | "poor" | "missing";
  source: string;
  updated_at: string;
  metric_action: string;
  blocked_decision: string | null;
}

interface DataStore {
  metrics: Metric[];
  lastUpdated: string;
}

const SEED: DataStore = { metrics: [], lastUpdated: new Date().toISOString() };

async function getData(): Promise<DataStore> {
  const cached = await kv.get<DataStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  return NextResponse.json(await getData());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "list") {
    const data = await getData();
    let items = data.metrics;
    if (body.project_id) items = items.filter((m) => m.project_id === body.project_id);
    if (body.section) items = items.filter((m) => m.section === body.section);
    return NextResponse.json(items);
  }

  if (action === "get") {
    const data = await getData();
    const item = data.metrics.find((m) => m.id === body.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  // Writes require auth
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getData();
  const now = new Date().toISOString();

  if (action === "set") {
    const { id, project_id, section, name, value, state, source, metric_action, blocked_decision } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const existing = data.metrics.find((m) => m.id === id);
    if (existing) {
      if (project_id !== undefined) existing.project_id = project_id;
      if (section !== undefined) existing.section = section;
      if (name !== undefined) existing.name = name;
      if (value !== undefined) existing.value = value;
      if (state !== undefined) existing.state = state;
      if (source !== undefined) existing.source = source;
      if (metric_action !== undefined) existing.metric_action = metric_action;
      if (blocked_decision !== undefined) existing.blocked_decision = blocked_decision;
      existing.updated_at = now;
    } else {
      data.metrics.push({
        id,
        project_id: project_id || "",
        section: section || "traffic",
        name: name || id,
        value: value || "",
        state: state || "missing",
        source: source || "",
        updated_at: now,
        metric_action: metric_action || "",
        blocked_decision: blocked_decision || null,
      });
    }

    data.lastUpdated = now;
    await kv.set(KV_KEY, data);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    data.metrics = data.metrics.filter((m) => m.id !== body.id);
    data.lastUpdated = now;
    await kv.set(KV_KEY, data);
    return NextResponse.json({ ok: true });
  }

  // Bulk set — for agent automation
  if (action === "bulk-set") {
    const items: Partial<Metric>[] = body.items;
    if (!Array.isArray(items)) return NextResponse.json({ error: "items array required" }, { status: 400 });

    for (const item of items) {
      if (!item.id) continue;
      const existing = data.metrics.find((m) => m.id === item.id);
      if (existing) {
        Object.assign(existing, item, { updated_at: now });
      } else {
        data.metrics.push({
          id: item.id,
          project_id: item.project_id || "",
          section: item.section || "traffic",
          name: item.name || item.id,
          value: item.value || "",
          state: item.state || "missing",
          source: item.source || "",
          updated_at: now,
          metric_action: item.metric_action || "",
          blocked_decision: item.blocked_decision || null,
        });
      }
    }

    data.lastUpdated = now;
    await kv.set(KV_KEY, data);
    return NextResponse.json({ ok: true, count: items.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
