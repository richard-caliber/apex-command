import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:pipeline-stages";
const TOKEN = "apex-live-2026";

/* ── Schema ── */
interface PipelineStage {
  id: string;
  name: string;
  order: number;
  objective: string;
  entry_criteria: string;
  exit_criteria: string;
  is_template: boolean;
}

interface StageStore {
  stages: PipelineStage[];
  lastUpdated: string;
}

/* ── Seed data — master stage definitions ── */
const SEED: StageStore = {
  lastUpdated: "2026-04-02T00:00:00Z",
  stages: [
    { id: "inbox", name: "Inbox", order: 0, objective: "Capture and triage incoming ideas", entry_criteria: "Any idea or signal", exit_criteria: "Tagged, categorised, and triaged", is_template: true },
    { id: "idea", name: "Idea", order: 1, objective: "Clarify the problem and score the opportunity", entry_criteria: "Idea captured and tagged", exit_criteria: "Problem statement written, opportunity scored 7+, go/no-go decided", is_template: true },
    { id: "validation", name: "Validation", order: 2, objective: "Prove demand exists with real signals", entry_criteria: "Idea approved by founder", exit_criteria: "Pain signals extracted, competitors mapped, hooks generated and tested", is_template: true },
    { id: "design", name: "Design", order: 3, objective: "Design the user experience and core deliverables", entry_criteria: "Validation passed — demand confirmed", exit_criteria: "User journey defined, templates written, landing page built", is_template: true },
    { id: "mvp", name: "MVP", order: 4, objective: "Build minimum viable product", entry_criteria: "Design approved", exit_criteria: "Product live, payment working, first test order", is_template: true },
    { id: "traffic", name: "Traffic", order: 5, objective: "Drive targeted traffic to the product", entry_criteria: "MVP live and tested", exit_criteria: "Content loop running, engagement metrics tracked, first 1000 visitors", is_template: true },
    { id: "conversion", name: "Conversion", order: 6, objective: "Optimise the funnel from visitor to buyer", entry_criteria: "Traffic flowing — 100+ daily visitors", exit_criteria: "A/B tests run, winning variant scaled, positive unit economics", is_template: true },
    { id: "delivery", name: "Delivery", order: 7, objective: "Deliver value and collect feedback", entry_criteria: "First paying customers", exit_criteria: "Orders fulfilled, feedback collected, CSAT 8+, support issues declining", is_template: true },
    { id: "scale", name: "Scale", order: 8, objective: "Scale what works and automate the founder out", entry_criteria: "Delivery stable, positive margins", exit_criteria: "Key processes automated, growth levers identified, founder time <5hrs/week", is_template: true },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<StageStore> {
  const cached = await kv.get<StageStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: StageStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

/* ── POST handler (action-based) ── */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── LIST ──
  if (action === "list") {
    const store = await getStore();
    return NextResponse.json({ stages: store.stages.sort((a, b) => a.order - b.order), lastUpdated: store.lastUpdated });
  }

  // ── GET ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const stage = store.stages.find((s) => s.id === id);
    if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(stage);
  }

  // ── Writes require auth ──
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── SET (create or update) ──
  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.stages.findIndex((s) => s.id === id);

    if (idx >= 0) {
      const existing = store.stages[idx];
      const { action: _a, ...cleanFields } = fields;
      store.stages[idx] = { ...existing, ...cleanFields, id };
    } else {
      const stage: PipelineStage = {
        id,
        name: fields.name || id,
        order: fields.order ?? store.stages.length,
        objective: fields.objective || "",
        entry_criteria: fields.entry_criteria || "",
        exit_criteria: fields.exit_criteria || "",
        is_template: fields.is_template ?? true,
      };
      store.stages.push(stage);
    }

    await saveStore(store);
    const saved = store.stages.find((s) => s.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const store = await getStore();
    const idx = store.stages.findIndex((s) => s.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    store.stages.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, set, delete" }, { status: 400 });
}
