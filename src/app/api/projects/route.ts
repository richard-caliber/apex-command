import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";
import { getAllProjects, getProject } from "@/lib/projects";

// Canonical project store. Reads go through src/lib/projects (single read path).
// Writes still target apex:warroom:projects directly.
const KV_KEY = "apex:warroom:projects";
/* ── Schema ── */
interface Project {
  id: string;
  name: string;
  description: string;
  stage: string;
  status: string;
  image_url: string;
  owner: string;
  blocker: string;
  tags: string[];
  url: string;
  metrics: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface ProjectStore {
  projects: Project[];
  lastUpdated: string;
}

// M3: aligned with MCP VALID_PROJECT_STAGES — drops "inbox" (projects start at
// "idea" once captured), adds "archived" (post-deprecation marker).
const VALID_STAGES = ["idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale", "archived"];
const VALID_STATUSES = ["active", "paused", "blocked", "completed"];

/* ── Seed data — migrated from War Room ── */
const SEED: ProjectStore = {
  lastUpdated: "2026-04-02T00:00:00Z",
  projects: [
    {
      id: "gemsnap",
      name: "GemSnap",
      description: "AI gemstone identification app",
      stage: "traffic",
      status: "active",
      image_url: "/images/gemsnap-card.jpg",
      owner: "atlas",
      blocker: "237 clicks, 0 conversions — awaiting PostHog data",
      tags: ["consumer", "ai", "mobile"],
      url: "",
      metrics: { mrr: "$0" },
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "caliber",
      name: "Caliber Peptides",
      description: "AI-powered peptide brand",
      stage: "conversion",
      status: "active",
      image_url: "/images/caliber-card.jpg",
      owner: "atlas",
      blocker: "Content live — chasing first sale",
      tags: ["ecommerce", "peptides", "crypto"],
      url: "https://caliber-site-delta.vercel.app",
      metrics: { orders: "0" },
      created_at: "2026-01-15T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "edge-auto",
      name: "Edge Auto",
      description: "Small business automation consultancy",
      stage: "mvp",
      status: "blocked",
      image_url: "/images/edgeauto-card.jpg",
      owner: "atlas",
      blocker: "Blocked on calendar + booking test",
      tags: ["b2b", "automation", "consulting"],
      url: "",
      metrics: { customers: "0" },
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "storyquest",
      name: "StoryQuest",
      description: "AI interactive storytelling for kids",
      stage: "mvp",
      status: "active",
      image_url: "/images/storyquest-card.jpg",
      owner: "newton",
      blocker: "Needs Stripe + SFX + TTS to ship",
      tags: ["consumer", "ai", "kids", "saas"],
      url: "",
      metrics: { users: "0" },
      created_at: "2026-02-15T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "repostai",
      name: "RepostAI",
      description: "AI social media repurposing tool",
      stage: "validation",
      status: "active",
      image_url: "/images/repostai-card.jpg",
      owner: "atlas",
      blocker: "Pre-launch — needs landing page + PH date",
      tags: ["saas", "social", "ai"],
      url: "",
      metrics: { mrr: "$0" },
      created_at: "2026-03-10T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "villas",
      name: "Phuket Villas",
      description: "Luxury villa sales platform for Phuket property",
      stage: "conversion",
      status: "active",
      image_url: "/images/villas-card.jpg",
      owner: "ginge",
      blocker: "Buyers delayed — marketing to agents",
      tags: ["property", "finance"],
      url: "",
      metrics: { value: "90M THB" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "squad",
      name: "The Squad",
      description: "AI agent team infrastructure",
      stage: "delivery",
      status: "active",
      image_url: "/images/squad-card.jpg",
      owner: "ginge",
      blocker: "System stable — 3 bots active",
      tags: ["infra", "ai", "agents"],
      url: "",
      metrics: { active_bots: "3" },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
    {
      id: "parliament",
      name: "Parliament Tracker",
      description: "AI-powered parliamentary accountability tool",
      stage: "validation",
      status: "paused",
      image_url: "/images/parliament-card.jpg",
      owner: "newton",
      blocker: "Newton evaluating feasibility",
      tags: ["govtech", "ai", "data"],
      url: "",
      metrics: { stage: "Research" },
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-04-02T00:00:00Z",
    },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<ProjectStore> {
  const cached = await kv.get<ProjectStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: ProjectStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

/* ── POST handler (action-based) ── */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── LIST ──
  if (action === "list") {
    const projects = await getAllProjects();
    if (projects.length === 0) {
      // Bootstrap: lib reports empty, fall through to seed once.
      const store = await getStore();
      return NextResponse.json(store);
    }
    const cached = await kv.get<ProjectStore>(KV_KEY);
    return NextResponse.json({ projects, lastUpdated: cached?.lastUpdated ?? new Date().toISOString() });
  }

  // ── GET ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  }

  // ── Writes require auth ──
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  // ── SET (create or update) ──
  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Validate stage if provided
    if (fields.stage && !VALID_STAGES.includes(fields.stage)) {
      return NextResponse.json({ error: `Invalid stage. Valid: ${VALID_STAGES.join(", ")}` }, { status: 400 });
    }
    // Validate status if provided
    if (fields.status && !VALID_STATUSES.includes(fields.status)) {
      return NextResponse.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.projects.findIndex((p) => p.id === id);

    if (idx >= 0) {
      // Update existing — merge fields
      const existing = store.projects[idx];
      const { action: _a, ...cleanFields } = fields;
      store.projects[idx] = { ...existing, ...cleanFields, id, updated_at: now };
    } else {
      // Create new
      const project: Project = {
        id,
        name: fields.name || id,
        description: fields.description || "",
        stage: fields.stage || "mvp",
        status: fields.status || "active",
        image_url: fields.image_url || "",
        owner: fields.owner || "",
        blocker: fields.blocker || "",
        tags: fields.tags || [],
        url: fields.url || "",
        metrics: fields.metrics || {},
        created_at: now,
        updated_at: now,
      };
      store.projects.push(project);
    }

    await saveStore(store);
    const saved = store.projects.find((p) => p.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const store = await getStore();
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    store.projects.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, set, delete" }, { status: 400 });
}
