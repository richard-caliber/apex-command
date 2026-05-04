import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1 read-shim: locates the project in apex:warroom:projects (canonical),
// then writes the new task back to the legacy apex:projects store. Full
// consolidation lands in Phase 6.
const READ_KEY = "apex:warroom:projects";
const WRITE_KEY = "apex:projects";
interface Task {
  text: string;
  owner: string;
  priority: string;
  done: boolean;
}

interface Project {
  id: string;
  tasks: Task[];
  [key: string]: unknown;
}

interface ProjectData {
  projects: Project[];
  lastUpdated: string;
}

async function getCanonicalProjects(): Promise<{ projects: { id: string }[] } | null> {
  return kv.get(READ_KEY);
}

async function getWriteData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(WRITE_KEY);
  if (cached) return cached;
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  const seed = JSON.parse(raw) as ProjectData;
  await kv.set(WRITE_KEY, seed);
  return seed;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { projectId } = await params;
  const task = (await req.json()) as Task;

  if (!task.text) {
    return NextResponse.json({ error: "Task text is required" }, { status: 400 });
  }

  // Existence check uses the canonical warroom store.
  const canonical = await getCanonicalProjects();
  const exists = canonical?.projects?.some((p) => p.id === projectId);
  if (!exists) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const data = await getWriteData();
  let project = data.projects.find((p) => p.id === projectId);
  if (!project) {
    // Project exists in warroom but not in legacy store — bootstrap a stub so
    // the task can land. Phase 6 retires the legacy store entirely.
    project = { id: projectId, tasks: [] } as Project;
    data.projects.push(project);
  }

  const newTask: Task = {
    text: task.text,
    owner: task.owner || "👤",
    priority: task.priority || "green",
    done: false,
  };

  project.tasks.push(newTask);
  data.lastUpdated = new Date().toISOString();
  await kv.set(WRITE_KEY, data);

  return NextResponse.json(newTask, { status: 201 });
}
