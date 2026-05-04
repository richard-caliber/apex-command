import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1 read-shim: GET reads the canonical apex:warroom:projects store and
// projects each record into the maproom shape. Writes still target the legacy
// maproom:projects key (deprecated, full migration lands in Phase 6).
const READ_KEY = "apex:warroom:projects";
const KV_KEY = "maproom:projects";
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

interface CanonicalProject {
  id: string;
  name: string;
  description: string;
  stage: string;
  status: string;
  blocker: string;
  owner: string;
  updated_at?: string;
  created_at?: string;
}

const STAGE_INDEX: Record<string, number> = {
  inbox: 0, idea: 1, validation: 2, design: 3, mvp: 4,
  traffic: 5, conversion: 6, delivery: 7, scale: 8,
};

function toMapRoomShape(p: CanonicalProject, legacy?: Project): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    current_stage: legacy?.current_stage ?? STAGE_INDEX[p.stage?.toLowerCase()] ?? 0,
    status: p.status ?? "active",
    blockers: legacy?.blockers ?? (p.blocker ? [p.blocker] : []),
    owners: legacy?.owners ?? (p.owner ? [p.owner] : []),
    automation_score: legacy?.automation_score ?? "",
    notes: legacy?.notes ?? "",
    created_at: p.created_at ?? legacy?.created_at ?? "",
    updated_at: p.updated_at ?? legacy?.updated_at ?? "",
  };
}

export async function GET() {
  const [canonicalStore, legacyStore] = await Promise.all([
    kv.get<{ projects: CanonicalProject[] }>(READ_KEY),
    getData(),
  ]);
  if (!canonicalStore?.projects?.length) {
    return NextResponse.json(legacyStore);
  }
  const legacyById = new Map(legacyStore.items.map((i) => [i.id, i]));
  const items = canonicalStore.projects.map((p) => toMapRoomShape(p, legacyById.get(p.id)));
  return NextResponse.json({ items, lastUpdated: legacyStore.lastUpdated });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

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
