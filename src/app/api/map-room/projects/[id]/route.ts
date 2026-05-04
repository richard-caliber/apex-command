import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1 read-shim: GET reads canonical apex:warroom:projects and projects
// the record into the maproom shape. Writes still target maproom:projects
// (deprecated; full migration in Phase 6).
const READ_KEY = "apex:warroom:projects";
const KV_KEY = "maproom:projects";
interface ProjectsData {
  items: Record<string, unknown>[];
  lastUpdated: string;
}

async function getData(): Promise<ProjectsData | null> {
  return kv.get<ProjectsData>(KV_KEY);
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

function toMapRoomShape(p: CanonicalProject, legacy?: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    current_stage: (legacy?.current_stage as number | undefined) ?? STAGE_INDEX[p.stage?.toLowerCase()] ?? 0,
    status: p.status ?? "active",
    blockers: (legacy?.blockers as string[] | undefined) ?? (p.blocker ? [p.blocker] : []),
    owners: (legacy?.owners as string[] | undefined) ?? (p.owner ? [p.owner] : []),
    automation_score: (legacy?.automation_score as string | undefined) ?? "",
    notes: (legacy?.notes as string | undefined) ?? "",
    created_at: p.created_at ?? (legacy?.created_at as string) ?? "",
    updated_at: p.updated_at ?? (legacy?.updated_at as string) ?? "",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [canonicalStore, legacyStore] = await Promise.all([
    kv.get<{ projects: CanonicalProject[] }>(READ_KEY),
    getData(),
  ]);
  const canonicalProject = canonicalStore?.projects?.find((p) => p.id === id);
  if (!canonicalProject) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const legacyItem = legacyStore?.items?.find((i) => i.id === id);
  return NextResponse.json(toMapRoomShape(canonicalProject, legacyItem));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { id } = await params;
  const updates = await req.json();
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = data.items.find((i) => i.id === id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  Object.assign(item, updates, { updated_at: new Date().toISOString() });
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json(item);
}
