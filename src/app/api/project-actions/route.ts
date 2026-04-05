import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:project-actions";
const TOKEN = "apex-live-2026";

/* ── Schema ── */
export interface ProjectAction {
  id: string;           // A-{slug}-{nnn}  e.g. A-cal-001
  project_id: string;
  name: string;
  description: string;
  owner: string;
  priority: "urgent" | "high" | "medium";
  deadline: string;     // ISO date or ""
  type: "one-off" | "recurring";
  status: "not_started" | "in_progress" | "done";
  created_at: string;
  updated_at: string;
}

interface ActionStore {
  actions: ProjectAction[];
  lastUpdated: string;
}

const VALID_PRIORITIES = ["urgent", "high", "medium"];
const VALID_TYPES = ["one-off", "recurring"];
const VALID_STATUSES = ["not_started", "in_progress", "done"];

const SEED: ActionStore = {
  lastUpdated: "2026-04-04T00:00:00Z",
  actions: [
    // Caliber Peptides
    { id: "A-cal-001", project_id: "caliber", name: "Fix Stripe webhook 307 redirect", description: "Bare domain redirects causing webhook failures — switch to www URLs", owner: "claude-code", priority: "urgent", deadline: "2026-04-06", type: "one-off", status: "in_progress", created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-04T00:00:00Z" },
    { id: "A-cal-002", project_id: "caliber", name: "Rewrite BPC-157 carousel hook", description: "Darwin scored 6.5/10 — hook too long, needs punchy rewrite", owner: "atlas", priority: "high", deadline: "2026-04-07", type: "one-off", status: "not_started", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
    { id: "A-cal-003", project_id: "caliber", name: "Weekly content publish cycle", description: "Post 2 carousels + 1 reel per week to Instagram", owner: "atlas", priority: "medium", deadline: "", type: "recurring", status: "in_progress", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-04T00:00:00Z" },

    // GemSnap
    { id: "A-gem-001", project_id: "gemsnap", name: "Implement blurred paywall gate", description: "Show blurred gem report behind paywall to drive conversions", owner: "claude-code", priority: "urgent", deadline: "2026-04-05", type: "one-off", status: "not_started", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
    { id: "A-gem-002", project_id: "gemsnap", name: "Build referral sharing cards", description: "Generate shareable gem cards for viral loop", owner: "jimmy", priority: "high", deadline: "2026-04-08", type: "one-off", status: "not_started", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
    { id: "A-gem-003", project_id: "gemsnap", name: "Monitor A/B test results", description: "Check conversion data weekly until statistical significance", owner: "darwin", priority: "medium", deadline: "", type: "recurring", status: "in_progress", created_at: "2026-03-30T00:00:00Z", updated_at: "2026-04-04T00:00:00Z" },

    // Edge Auto
    { id: "A-edge-001", project_id: "edgeauto", name: "Finish 9-section report page build", description: "Complete the personalised audit report — £4K implementation", owner: "claude-code", priority: "urgent", deadline: "2026-04-07", type: "one-off", status: "in_progress", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-04T00:00:00Z" },
    { id: "A-edge-002", project_id: "edgeauto", name: "Set up quiz-to-report data flow", description: "Connect quiz answers to report generation pipeline", owner: "newton", priority: "high", deadline: "2026-04-10", type: "one-off", status: "not_started", created_at: "2026-04-03T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<ActionStore> {
  const cached = await kv.get<ActionStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: ActionStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

/* ── POST handler ── */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── LIST (filter by project_id or id prefix) ──
  if (action === "list") {
    const store = await getStore();
    let actions = store.actions;
    const { project_id, id_prefix, include_done } = body;
    if (project_id) actions = actions.filter((a) => a.project_id === project_id);
    if (id_prefix) actions = actions.filter((a) => a.id.startsWith(id_prefix));
    // By default hide completed one-off actions
    if (!include_done) {
      actions = actions.filter((a) => !(a.type === "one-off" && a.status === "done"));
    }
    // Sort: priority (urgent > high > medium), then deadline (earliest first, empty last)
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2 };
    actions.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 9;
      const pb = priorityOrder[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
    return NextResponse.json({ actions, lastUpdated: store.lastUpdated });
  }

  // ── GET ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const item = store.actions.find((a) => a.id === id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
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
    if (!id.startsWith("A-")) return NextResponse.json({ error: "Project action IDs must start with A-" }, { status: 400 });
    if (fields.priority && !VALID_PRIORITIES.includes(fields.priority)) {
      return NextResponse.json({ error: `Invalid priority. Valid: ${VALID_PRIORITIES.join(", ")}` }, { status: 400 });
    }
    if (fields.type && !VALID_TYPES.includes(fields.type)) {
      return NextResponse.json({ error: `Invalid type. Valid: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    if (fields.status && !VALID_STATUSES.includes(fields.status)) {
      return NextResponse.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.actions.findIndex((a) => a.id === id);

    if (idx >= 0) {
      const { action: _a, ...cleanFields } = fields;
      store.actions[idx] = { ...store.actions[idx], ...cleanFields, id, updated_at: now };
    } else {
      const item: ProjectAction = {
        id,
        project_id: fields.project_id || "",
        name: fields.name || "",
        description: fields.description || "",
        owner: fields.owner || "",
        priority: fields.priority || "medium",
        deadline: fields.deadline || "",
        type: fields.type || "one-off",
        status: fields.status || "not_started",
        created_at: now,
        updated_at: now,
      };
      store.actions.push(item);
    }

    await saveStore(store);
    const saved = store.actions.find((a) => a.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const idx = store.actions.findIndex((a) => a.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    store.actions.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
