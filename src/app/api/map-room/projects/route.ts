import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:projects";
const TOKEN = "apex-live-2026";

interface Project {
  id: string;
  name: string;
  description: string;
  current_stage: number;
  status: string;
  blockers: string[];
  owners: string[];
  automation_score: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface ProjectsData {
  items: Project[];
  lastUpdated: string;
}

const SEED: ProjectsData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "caliber",
      name: "Caliber Peptides",
      description: "Premium peptide education & e-commerce",
      current_stage: 4,
      status: "active",
      blockers: ["Website conversion rate unknown"],
      owners: ["Atlas", "Newton"],
      automation_score: "3/7",
      notes: "",
      created_at: "2026-01-15",
      updated_at: "2026-03-30",
    },
    {
      id: "gemsnap",
      name: "GemSnap",
      description: "AI gemstone identification app",
      current_stage: 5,
      status: "active",
      blockers: ["PostHog data pending"],
      owners: ["Claude Code", "Ginge"],
      automation_score: "2/5",
      notes: "",
      created_at: "2026-02-01",
      updated_at: "2026-03-30",
    },
    {
      id: "edge-auto",
      name: "Edge Auto",
      description: "Small business automation consultancy",
      current_stage: 2,
      status: "active",
      blockers: ["Report page not built"],
      owners: ["Atlas", "Ginge"],
      automation_score: "1/4",
      notes: "",
      created_at: "2026-03-01",
      updated_at: "2026-03-30",
    },
  ],
};

async function getData(): Promise<ProjectsData> {
  const cached = await kv.get<ProjectsData>(KV_KEY);
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

  const item: Project = {
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
