import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:ideas";
const TOKEN = "apex-live-2026";

interface Idea {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  status: "raw" | "exploring" | "validated" | "parked" | "killed";
  source: string;
  potential_revenue: string;
  effort: "low" | "medium" | "high";
  notes: string;
  created_at: string;
  updated_at: string;
}

interface IdeasData {
  items: Idea[];
  lastUpdated: string;
}

const SEED: IdeasData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "repost-ai",
      name: "RepostAI",
      summary: "AI tool that repurposes long-form content into platform-specific social posts automatically",
      tags: ["SaaS", "AI", "content"],
      status: "exploring",
      source: "Internal brainstorm",
      potential_revenue: "$5K MRR",
      effort: "high",
      notes: "Could use Claude API for content transformation. Need to validate demand first.",
      created_at: "2026-03-10",
      updated_at: "2026-03-28",
    },
    {
      id: "parliament-tracker",
      name: "Parliament Tracker",
      summary: "Live dashboard tracking MP votes, contradictions, and attendance with D3 chamber visualisation",
      tags: ["civic-tech", "data", "visualisation"],
      status: "validated",
      source: "Side project",
      potential_revenue: "Sponsorship model",
      effort: "medium",
      notes: "Already live on Vercel with 70 MPs. Contradiction detection working. Could monetise via media partnerships.",
      created_at: "2026-02-15",
      updated_at: "2026-03-30",
    },
    {
      id: "comic-creator",
      name: "Comic Creator",
      summary: "AI-powered comic strip generator from text prompts with consistent character styles",
      tags: ["consumer", "AI", "creative"],
      status: "raw",
      source: "App Factory list",
      potential_revenue: "$2K MRR",
      effort: "high",
      notes: "Character consistency is the hard problem. Could use LoRA fine-tuning.",
      created_at: "2026-03-20",
      updated_at: "2026-03-20",
    },
    {
      id: "peptide-stack-builder",
      name: "Peptide Stack Builder",
      summary: "Interactive tool that recommends peptide stacks based on user goals (recovery, cognition, etc.)",
      tags: ["health", "tool", "Caliber"],
      status: "exploring",
      source: "Caliber Peptides extension",
      potential_revenue: "Lead gen for Caliber",
      effort: "low",
      notes: "Could be a free tool on the Caliber site to drive traffic and build email list.",
      created_at: "2026-03-15",
      updated_at: "2026-03-29",
    },
    {
      id: "villa-investor",
      name: "Villa Investor Platform",
      summary: "Marketplace connecting villa owners with fractional investors for renovation projects",
      tags: ["proptech", "marketplace", "investment"],
      status: "parked",
      source: "Philippines connections",
      potential_revenue: "$10K+ per deal",
      effort: "high",
      notes: "Complex regulatory requirements. Parked until Caliber and GemSnap are generating revenue.",
      created_at: "2026-02-20",
      updated_at: "2026-03-15",
    },
    {
      id: "market-intel",
      name: "Market Intel as a Service",
      summary: "Automated competitor monitoring and market intelligence reports delivered weekly via AI agents",
      tags: ["SaaS", "AI", "B2B"],
      status: "raw",
      source: "Edge Auto spin-off",
      potential_revenue: "$3K MRR",
      effort: "medium",
      notes: "Natural extension of Edge Auto. Could use the same agent pipeline to monitor competitors for clients.",
      created_at: "2026-03-25",
      updated_at: "2026-03-25",
    },
  ],
};

async function getData(): Promise<IdeasData> {
  const cached = await kv.get<IdeasData>(KV_KEY);
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

  const item: Idea = {
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
