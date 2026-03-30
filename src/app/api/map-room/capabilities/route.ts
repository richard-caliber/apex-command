import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:capabilities";
const TOKEN = "apex-live-2026";

interface Capability {
  id: string;
  name: string;
  category: "ai" | "dev" | "marketing" | "sales" | "ops" | "research";
  description: string;
  tools: string[];
  owner: string;
  confidence: "proven" | "tested" | "experimental";
  last_used: string;
  created_at: string;
  updated_at: string;
}

interface CapabilitiesData {
  items: Capability[];
  lastUpdated: string;
}

const SEED: CapabilitiesData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "cap-001",
      name: "AI Content Pipeline",
      category: "ai",
      description: "End-to-end content generation: research brief -> copy -> quality gate -> image gen -> publish",
      tools: ["Claude Sonnet", "Claude Haiku", "DALL-E", "Meta Graph API"],
      owner: "Atlas",
      confidence: "proven",
      last_used: "2026-03-30",
      created_at: "2026-02-01",
      updated_at: "2026-03-30",
    },
    {
      id: "cap-002",
      name: "Full-Stack Web Development",
      category: "dev",
      description: "Next.js apps with Vercel deployment, KV storage, API routes, responsive UI",
      tools: ["Next.js", "Vercel", "Tailwind", "TypeScript", "Vercel KV"],
      owner: "Claude Code",
      confidence: "proven",
      last_used: "2026-03-30",
      created_at: "2026-01-15",
      updated_at: "2026-03-30",
    },
    {
      id: "cap-003",
      name: "Funnel Analytics & A/B Testing",
      category: "marketing",
      description: "PostHog integration, funnel analysis, feature flags for A/B tests, statistical significance checks",
      tools: ["PostHog", "Feature Flags", "Custom analytics"],
      owner: "Darwin",
      confidence: "tested",
      last_used: "2026-03-30",
      created_at: "2026-03-01",
      updated_at: "2026-03-30",
    },
    {
      id: "cap-004",
      name: "Automation Consulting",
      category: "sales",
      description: "Personalised audit reports, ROI projections, n8n workflow builds for small businesses",
      tools: ["n8n", "Claude Sonnet", "Resend", "Vercel"],
      owner: "Atlas",
      confidence: "tested",
      last_used: "2026-03-29",
      created_at: "2026-03-01",
      updated_at: "2026-03-29",
    },
    {
      id: "cap-005",
      name: "Deep Research & Citation",
      category: "research",
      description: "Thorough research briefs with verified sources, dosing protocols, competitor analysis",
      tools: ["Gemini 2.5 Pro", "Web search", "Manual verification"],
      owner: "Newton",
      confidence: "proven",
      last_used: "2026-03-28",
      created_at: "2026-02-15",
      updated_at: "2026-03-28",
    },
    {
      id: "cap-006",
      name: "Telegram Bot Development",
      category: "dev",
      description: "Full e-commerce bots with product catalogs, admin panels, payment integration",
      tools: ["Node.js", "Telegram Bot API", "Railway"],
      owner: "Claude Code",
      confidence: "proven",
      last_used: "2026-03-20",
      created_at: "2026-02-20",
      updated_at: "2026-03-20",
    },
  ],
};

async function getData(): Promise<CapabilitiesData> {
  const cached = await kv.get<CapabilitiesData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = await getData();
  const now = new Date().toISOString();

  const item: Capability = {
    id: Date.now().toString(36),
    ...body,
    created_at: body.created_at || now,
    updated_at: now,
  };

  data.items.push(item);
  data.lastUpdated = now;
  await kv.set(KV_KEY, data);
  return NextResponse.json(item, { status: 201 });
}
