import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:automation-map";
const TOKEN = "apex-live-2026";

/* ── Schema ── */
interface AutomationEntry {
  id: string;
  category: "automated" | "semi-auto" | "manual" | "gap" | "tool-evaluation";
  name: string;
  description: string;
  project_id: string;
  owner: string;
  tools: string[];
  status: string;
  last_run: string;
  health: "healthy" | "degraded" | "failing" | "unknown";
  effort_to_automate: string | null;
  impact: string | null;
  notes: string;
  frequency?: string;
  time_per_instance?: string;
  suggested_approach?: string;
  cost?: string;
  build_alternative?: string;
  verdict?: "build" | "buy" | "skip" | "";
  created_at: string;
  updated_at: string;
}

interface Store {
  entries: AutomationEntry[];
  lastUpdated: string;
}

const VALID_CATEGORIES = ["automated", "semi-auto", "manual", "gap", "tool-evaluation"];
const VALID_HEALTH = ["healthy", "degraded", "failing", "unknown"];

const SEED: Store = {
  lastUpdated: "2026-04-03T00:00:00Z",
  entries: [
    // ── AUTOMATED ──
    { id: "auto-ig-posting", category: "automated", name: "IG Content Publishing", description: "Atlas posts carousels and reels via IG Graph API", project_id: "caliber", owner: "atlas", tools: ["IG Graph API", "post-carousel.sh", "post-reel.sh"], status: "active", last_run: "2026-04-01T14:30:00Z", health: "healthy", effort_to_automate: null, impact: null, notes: "", created_at: "2026-03-15T00:00:00Z", updated_at: "2026-04-01T14:30:00Z" },
    { id: "auto-content-review", category: "automated", name: "Content Quality Gate", description: "Darwin scores carousel copy against 5-point checklist automatically", project_id: "caliber", owner: "darwin", tools: ["claude-opus-4-6", "quality-gate-prompt"], status: "active", last_run: "2026-04-02T09:00:00Z", health: "healthy", effort_to_automate: null, impact: null, notes: "", created_at: "2026-03-20T00:00:00Z", updated_at: "2026-04-02T09:00:00Z" },
    { id: "auto-pain-extraction", category: "automated", name: "Pain Signal Extraction", description: "Newton scrapes Reddit/forums and extracts pain language bank", project_id: "_template", owner: "newton", tools: ["claude-opus-4-6", "reddit-api", "pain-extraction-prompt"], status: "active", last_run: "2026-03-28T10:00:00Z", health: "healthy", effort_to_automate: null, impact: null, notes: "", created_at: "2026-03-10T00:00:00Z", updated_at: "2026-03-28T10:00:00Z" },
    { id: "auto-competitor-scan", category: "automated", name: "Competitor Analysis", description: "Newton runs competitor matrix for new validation stage entries", project_id: "_template", owner: "newton", tools: ["claude-opus-4-6", "similarweb-api", "competitor-prompt"], status: "active", last_run: "2026-03-25T08:00:00Z", health: "degraded", effort_to_automate: null, impact: null, notes: "SimilarWeb API rate-limited on last 2 runs", created_at: "2026-03-10T00:00:00Z", updated_at: "2026-03-25T08:00:00Z" },
    { id: "auto-telegram-bot", category: "automated", name: "Telegram Commerce Bot", description: "Full e-commerce bot handling orders, admin posting, price lookups", project_id: "caliber", owner: "claude-code", tools: ["telegram-bot-api", "railway", "vercel-kv"], status: "active", last_run: "2026-04-03T00:00:00Z", health: "healthy", effort_to_automate: null, impact: null, notes: "GINGEPOKER pricing active", created_at: "2026-03-20T00:00:00Z", updated_at: "2026-04-03T00:00:00Z" },
    { id: "auto-apex-heartbeat", category: "automated", name: "Apex Heartbeat Monitor", description: "Checks all project endpoints every 5 minutes, surfaces status", project_id: "_template", owner: "system", tools: ["vercel-cron", "heartbeat-api"], status: "active", last_run: "2026-04-03T00:05:00Z", health: "healthy", effort_to_automate: null, impact: null, notes: "", created_at: "2026-03-25T00:00:00Z", updated_at: "2026-04-03T00:05:00Z" },

    // ── SEMI-AUTO ──
    { id: "semi-hook-gen", category: "semi-auto", name: "Hook Generation", description: "Atlas generates 12 hooks from pain bank — Ginge picks top 3", project_id: "_template", owner: "atlas", tools: ["claude-opus-4-6", "hook-gen-prompt"], status: "active", last_run: "2026-03-29T11:00:00Z", health: "unknown", effort_to_automate: "Low — Darwin could auto-select top 3 by predicted engagement", impact: null, notes: "Manual step: founder selects hooks", created_at: "2026-03-15T00:00:00Z", updated_at: "2026-03-29T11:00:00Z" },
    { id: "semi-image-gen", category: "semi-auto", name: "Carousel Image Generation", description: "Atlas generates images but needs brand-check approval", project_id: "caliber", owner: "atlas", tools: ["midjourney", "canva-api"], status: "active", last_run: "2026-03-30T15:00:00Z", health: "unknown", effort_to_automate: "Medium — need brand style model training", impact: null, notes: "Manual step: visual brand consistency check", created_at: "2026-03-18T00:00:00Z", updated_at: "2026-03-30T15:00:00Z" },
    { id: "semi-ab-test", category: "semi-auto", name: "A/B Test Implementation", description: "Claude Code builds variant, Ginge approves deploy", project_id: "_template", owner: "claude-code", tools: ["next.js", "feature-flags", "posthog"], status: "active", last_run: "2026-03-30T12:00:00Z", health: "unknown", effort_to_automate: "High — need automated test spec → code pipeline", impact: null, notes: "Manual step: founder approves test spec before deploy", created_at: "2026-03-25T00:00:00Z", updated_at: "2026-03-30T12:00:00Z" },
    { id: "semi-report-gen", category: "semi-auto", name: "Audit Report Generation", description: "Atlas generates personalised report, founder reviews before send", project_id: "edgeauto", owner: "atlas", tools: ["claude-opus-4-6", "report-template", "next.js"], status: "active", last_run: "2026-04-01T10:00:00Z", health: "unknown", effort_to_automate: "Low — just needs confidence threshold gate", impact: null, notes: "Manual step: founder quality check on personalisation", created_at: "2026-03-20T00:00:00Z", updated_at: "2026-04-01T10:00:00Z" },

    // ── MANUAL ──
    { id: "manual-client-calls", category: "manual", name: "Client Onboarding Calls", description: "30-min discovery call with new Edge Auto clients", project_id: "edgeauto", owner: "ginge", tools: [], status: "active", last_run: "", health: "unknown", effort_to_automate: "Very High", impact: "High — bottleneck on founder time", notes: "", frequency: "Per client", time_per_instance: "30 min", created_at: "2026-03-28T00:00:00Z", updated_at: "2026-03-28T00:00:00Z" },
    { id: "manual-price-check", category: "manual", name: "Competitor Price Monitoring", description: "Manual check of UK peptide supplier prices for top 10 products", project_id: "caliber", owner: "unassigned", tools: [], status: "active", last_run: "", health: "unknown", effort_to_automate: "Medium", impact: "Medium — competitive pricing keeps margins", notes: "", frequency: "Weekly", time_per_instance: "45 min", created_at: "2026-03-29T00:00:00Z", updated_at: "2026-03-29T00:00:00Z" },
    { id: "manual-email-sequences", category: "manual", name: "Email Sequence Writing", description: "5-email welcome sequence for new subscribers", project_id: "caliber", owner: "newton", tools: [], status: "active", last_run: "", health: "unknown", effort_to_automate: "Low", impact: "High — nurture converts browsers to buyers", notes: "", frequency: "Per product launch", time_per_instance: "2 hrs", created_at: "2026-03-30T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },
    { id: "manual-order-fulfilment", category: "manual", name: "Order Fulfilment", description: "Pack and ship peptide orders manually", project_id: "caliber", owner: "ginge", tools: [], status: "active", last_run: "", health: "unknown", effort_to_automate: "Very High", impact: "Critical at scale — blocks growth", notes: "Need 3PL evaluation", frequency: "Per order", time_per_instance: "15 min", created_at: "2026-03-15T00:00:00Z", updated_at: "2026-03-15T00:00:00Z" },

    // ── GAPS ──
    { id: "gap-posthog-setup", category: "gap", name: "PostHog Analytics Setup", description: "No tracking on Caliber — can't measure conversion funnel", project_id: "caliber", owner: "", tools: [], status: "missing", last_run: "", health: "unknown", effort_to_automate: "Low", impact: "Critical — flying blind without data", notes: "", suggested_approach: "Install PostHog snippet, configure 5 conversion events", created_at: "2026-03-30T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },
    { id: "gap-email-automation", category: "gap", name: "Email Welcome Sequence", description: "No automated email flow for new subscribers", project_id: "caliber", owner: "", tools: [], status: "missing", last_run: "", health: "unknown", effort_to_automate: "Medium", impact: "High — losing warm leads", notes: "", suggested_approach: "Resend or Loops for transactional + drip sequences", created_at: "2026-03-30T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },
    { id: "gap-seo-monitoring", category: "gap", name: "SEO Rank Tracking", description: "No keyword tracking for peptide content pages", project_id: "caliber", owner: "", tools: [], status: "missing", last_run: "", health: "unknown", effort_to_automate: "Low", impact: "Medium — need to know if SEO content works", notes: "", suggested_approach: "Ahrefs or SE Ranking API integration", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z" },

    // ── TOOL EVALUATIONS ──
    { id: "eval-resend", category: "tool-evaluation", name: "Resend (Email API)", description: "Developer-first email API for transactional + marketing emails", project_id: "_template", owner: "newton", tools: ["resend"], status: "evaluating", last_run: "", health: "unknown", effort_to_automate: null, impact: null, notes: "Free tier: 3000 emails/month. React Email for templates. Simple API. Verdict: strong buy for MVP stage.", cost: "$0 (free tier) → $20/mo at scale", build_alternative: "Custom SMTP + template engine", verdict: "buy", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z" },
    { id: "eval-posthog", category: "tool-evaluation", name: "PostHog (Analytics)", description: "Open-source product analytics with session replay and feature flags", project_id: "_template", owner: "darwin", tools: ["posthog"], status: "evaluating", last_run: "", health: "unknown", effort_to_automate: null, impact: null, notes: "Free tier: 1M events/month. Self-host or cloud. Session replay included. Already referenced in tasks.", cost: "$0 (free tier) → usage-based", build_alternative: "Custom event tracking + Vercel Analytics", verdict: "buy", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-01T00:00:00Z" },
    { id: "eval-3pl", category: "tool-evaluation", name: "3PL Fulfilment Partner", description: "Third-party logistics for peptide order fulfilment", project_id: "caliber", owner: "ginge", tools: [], status: "evaluating", last_run: "", health: "unknown", effort_to_automate: null, impact: null, notes: "Need UK-based, supplements-friendly 3PL. Research ShipBob UK, Huboo, James and James.", cost: "~$3-5 per order", build_alternative: "Manual fulfilment (current)", verdict: "", created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<Store> {
  const cached = await kv.get<Store>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: Store): Promise<void> {
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
    const { category, project_id } = body;
    let entries = store.entries;
    if (category) entries = entries.filter((e) => e.category === category);
    if (project_id) entries = entries.filter((e) => e.project_id === project_id);
    return NextResponse.json({ entries, lastUpdated: store.lastUpdated });
  }

  // ── GET ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entry);
  }

  // ── SEARCH ──
  if (action === "search") {
    const { q, category, project_id } = body;
    const store = await getStore();
    let entries = store.entries;
    if (category) entries = entries.filter((e) => e.category === category);
    if (project_id) entries = entries.filter((e) => e.project_id === project_id);
    if (q) {
      const lower = q.toLowerCase();
      entries = entries.filter((e) => e.name.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower));
    }
    return NextResponse.json({ entries, count: entries.length });
  }

  // ── Writes require auth ──
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── SET ──
  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (fields.category && !VALID_CATEGORIES.includes(fields.category)) {
      return NextResponse.json({ error: `Invalid category. Valid: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
    }
    if (fields.health && !VALID_HEALTH.includes(fields.health)) {
      return NextResponse.json({ error: `Invalid health. Valid: ${VALID_HEALTH.join(", ")}` }, { status: 400 });
    }

    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.entries.findIndex((e) => e.id === id);

    if (idx >= 0) {
      const existing = store.entries[idx];
      const { action: _a, ...clean } = fields;
      store.entries[idx] = { ...existing, ...clean, id, updated_at: now };
    } else {
      store.entries.push({
        id,
        category: fields.category || "manual",
        name: fields.name || "",
        description: fields.description || "",
        project_id: fields.project_id || "",
        owner: fields.owner || "",
        tools: fields.tools || [],
        status: fields.status || "active",
        last_run: fields.last_run || "",
        health: fields.health || "unknown",
        effort_to_automate: fields.effort_to_automate || null,
        impact: fields.impact || null,
        notes: fields.notes || "",
        frequency: fields.frequency,
        time_per_instance: fields.time_per_instance,
        suggested_approach: fields.suggested_approach,
        cost: fields.cost,
        build_alternative: fields.build_alternative,
        verdict: fields.verdict,
        created_at: now,
        updated_at: now,
      });
    }

    await saveStore(store);
    const saved = store.entries.find((e) => e.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const idx = store.entries.findIndex((e) => e.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    store.entries.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, set, delete, search" }, { status: 400 });
}
