import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:heartbeat:v3";
/* ── Schema ── */
interface RunEntry {
  timestamp: string;
  status: "ran_ok" | "failed";
  duration_ms: number | null;
  error?: string;
}

interface CronJob {
  id: string;
  name: string;
  description: string;
  owner: "newton" | "darwin" | "atlas";
  schedule: string;
  category: "content" | "data" | "review" | "automation";
  last_run: string | null;
  last_status: "ran_ok" | "failed" | "not_configured" | "running" | "paused";
  next_run: string | null;
  duration_ms: number | null;
  enabled: boolean;
  history: RunEntry[];
}

interface HeartbeatStore {
  jobs: CronJob[];
  lastUpdated: string;
}

const VALID_STATUSES = ["ran_ok", "failed", "not_configured", "running", "paused"];
const VALID_CATEGORIES = ["content", "data", "review", "automation"];

/* ── Seed: All 16 cron jobs ── */
const SEED: HeartbeatStore = {
  lastUpdated: new Date().toISOString(),
  jobs: [
    // Content Pipeline (5)
    {
      id: "cron-newton-research",
      name: "Newton Research Batch",
      description: "Research all topics for the week",
      owner: "newton",
      schedule: "Weekly Monday 9:00am GMT+8",
      category: "content",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-darwin-review-research",
      name: "Darwin Review Research",
      description: "Review all research outputs",
      owner: "darwin",
      schedule: "Weekly Monday 11:00am GMT+8",
      category: "content",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-atlas-create-content",
      name: "Atlas Create Content",
      description: "Create all assets from approved research",
      owner: "atlas",
      schedule: "Weekly Monday 1:00pm GMT+8",
      category: "content",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-darwin-review-content",
      name: "Darwin Review Content",
      description: "Review all created assets",
      owner: "darwin",
      schedule: "Weekly Monday 4:00pm GMT+8",
      category: "content",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-publish-ig",
      name: "Publish IG Post",
      description: "Post next approved item from queue",
      owner: "atlas",
      schedule: "Tue-Sat 2:30pm GMT+8",
      category: "content",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    // Data Collection (4)
    {
      id: "cron-ig-data",
      name: "IG Data Pull",
      description: "Pull followers/reach/engagement via Graph API",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "data",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-posthog-data",
      name: "PostHog Data Pull",
      description: "Pull sessions/funnels/conversion data",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "data",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-stripe-data",
      name: "Stripe Data Pull",
      description: "Pull revenue/MRR/transactions",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "data",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-content-metrics",
      name: "Content Metrics Pull",
      description: "Pull per-post IG performance",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "data",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    // Reviews (3)
    {
      id: "cron-data-review",
      name: "Data Review & Insights",
      description: "Review metrics, write Decision Panel insights",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "review",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-content-perf-review",
      name: "Content Performance Review",
      description: "Tag winners/flops, extract patterns",
      owner: "atlas",
      schedule: "Weekly Monday",
      category: "review",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-pipeline-status",
      name: "Pipeline Status Check",
      description: "Flag blocked/stale/overdue tasks",
      owner: "darwin",
      schedule: "Daily 8:00am GMT+8",
      category: "review",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    // Automation (4)
    {
      id: "cron-automation-audit",
      name: "Automation Audit",
      description: "Compare manual vs automated, update Automation Map",
      owner: "darwin",
      schedule: "Weekly Monday",
      category: "automation",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-health-check",
      name: "Cron Health Check",
      description: "Verify all crons running, flag failures",
      owner: "atlas",
      schedule: "Daily 8:00am GMT+8",
      category: "automation",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-vault-sync",
      name: "Research → Vault Sync",
      description: "Push Newton's output to IP Vault",
      owner: "atlas",
      schedule: "After each research task",
      category: "automation",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
    {
      id: "cron-tool-discovery",
      name: "Tool Discovery",
      description: "Scan for new automation tools",
      owner: "newton",
      schedule: "Monthly 1st",
      category: "automation",
      last_run: null, last_status: "not_configured", next_run: null, duration_ms: null, enabled: true, history: [],
    },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<HeartbeatStore> {
  const cached = await kv.get<HeartbeatStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: HeartbeatStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

/* ── POST handler (action-based) ── */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── LIST (public read) ──
  if (action === "list") {
    const store = await getStore();
    const { category } = body;
    let jobs = store.jobs;
    if (category && VALID_CATEGORIES.includes(category)) {
      jobs = jobs.filter((j) => j.category === category);
    }
    return NextResponse.json({ jobs, lastUpdated: store.lastUpdated });
  }

  // ── GET (public read) ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const job = store.jobs.find((j) => j.id === id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(job);
  }

  // ── Writes require auth ──
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  // ── SET (create or update cron job) ──
  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (fields.category && !VALID_CATEGORIES.includes(fields.category)) {
      return NextResponse.json({ error: `Invalid category. Valid: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    }
    if (fields.last_status && !VALID_STATUSES.includes(fields.last_status)) {
      return NextResponse.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const store = await getStore();
    const idx = store.jobs.findIndex((j) => j.id === id);
    const { action: _a, ...clean } = fields;

    if (idx >= 0) {
      // If recording a run, push to history
      if (clean.last_status && (clean.last_status === "ran_ok" || clean.last_status === "failed")) {
        const entry: RunEntry = {
          timestamp: clean.last_run || new Date().toISOString(),
          status: clean.last_status,
          duration_ms: clean.duration_ms ?? null,
          ...(clean.error ? { error: clean.error } : {}),
        };
        const history = [...(store.jobs[idx].history || []), entry].slice(-10);
        store.jobs[idx] = { ...store.jobs[idx], ...clean, id, history };
      } else {
        store.jobs[idx] = { ...store.jobs[idx], ...clean, id };
      }
    } else {
      store.jobs.push({
        id,
        name: clean.name || "",
        description: clean.description || "",
        owner: clean.owner || "atlas",
        schedule: clean.schedule || "",
        category: clean.category || "automation",
        last_run: clean.last_run || null,
        last_status: clean.last_status || "not_configured",
        next_run: clean.next_run || null,
        duration_ms: clean.duration_ms ?? null,
        enabled: clean.enabled !== false,
        history: [],
      });
    }

    await saveStore(store);
    const saved = store.jobs.find((j) => j.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const idx = store.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    store.jobs.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, set, delete" }, { status: 400 });
}
