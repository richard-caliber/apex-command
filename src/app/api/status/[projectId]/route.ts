import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1 read-shim: reads canonical store apex:warroom:projects.
// Writes still go to the legacy apex:projects key — full migration in Phase 6.
const READ_KEY = "apex:warroom:projects";
const WRITE_KEY = "apex:projects";
interface Project {
  id: string;
  [key: string]: unknown;
}

interface ProjectData {
  projects: Project[];
  lastUpdated: string;
}

async function getReadData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(READ_KEY);
  if (cached) return cached;
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  return JSON.parse(raw) as ProjectData;
}

async function getWriteData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(WRITE_KEY);
  if (cached) return cached;
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  const seed = JSON.parse(raw) as ProjectData;
  await kv.set(WRITE_KEY, seed);
  return seed;
}

// Map a project record from the canonical warroom shape to the legacy
// shape this endpoint has historically returned (image, statusLine, keyMetric).
// Tasks live only in the legacy store, so we side-load them from apex:projects.
function toLegacyShape(canonical: Project, legacy: Project | undefined) {
  const metrics = (canonical.metrics ?? {}) as Record<string, string>;
  const firstMetricKey = Object.keys(metrics)[0];
  const keyMetric = firstMetricKey
    ? { label: firstMetricKey.replace(/_/g, " "), value: metrics[firstMetricKey] }
    : (legacy?.keyMetric ?? { label: "", value: "" });
  return {
    id: canonical.id,
    name: canonical.name,
    image: (canonical.image_url as string) || (legacy?.image as string) || "",
    stage: canonical.stage,
    status: canonical.status,
    statusLine: (canonical.blocker as string) || (legacy?.statusLine as string) || "",
    bottleneck: (canonical.blocker as string) || (legacy?.bottleneck as string) || "",
    keyMetric,
    overdueTasks: (legacy?.overdueTasks as number) ?? 0,
    blockedTasks: (legacy?.blockedTasks as number) ?? 0,
    tasks: (legacy?.tasks as unknown[]) ?? [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const [readData, writeData] = await Promise.all([getReadData(), getWriteData()]);
  const project = readData.projects.find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const legacy = writeData.projects.find((p) => p.id === projectId);
  return NextResponse.json(toLegacyShape(project, legacy));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { projectId } = await params;
  const updates = await req.json();
  const data = await getWriteData();
  const idx = data.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  data.projects[idx] = { ...data.projects[idx], ...updates, id: projectId };
  data.lastUpdated = new Date().toISOString();
  await kv.set(WRITE_KEY, data);

  return NextResponse.json(data.projects[idx]);
}
