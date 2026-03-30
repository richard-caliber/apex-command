import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";

const KV_KEY = "apex:projects";
const TOKEN = "apex-live-2026";

interface Project {
  id: string;
  [key: string]: unknown;
}

interface ProjectData {
  projects: Project[];
  lastUpdated: string;
}

async function getData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(KV_KEY);
  if (cached) return cached;
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  const seed = JSON.parse(raw) as ProjectData;
  await kv.set(KV_KEY, seed);
  return seed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const updates = await req.json();
  const data = await getData();
  const idx = data.projects.findIndex((p) => p.id === projectId);
  if (idx === -1) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  data.projects[idx] = { ...data.projects[idx], ...updates, id: projectId };
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);

  return NextResponse.json(data.projects[idx]);
}
