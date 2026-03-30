import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";

const KV_KEY = "apex:projects";
const TOKEN = "apex-live-2026";

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

async function getData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(KV_KEY);
  if (cached) return cached;
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  const seed = JSON.parse(raw) as ProjectData;
  await kv.set(KV_KEY, seed);
  return seed;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const task = (await req.json()) as Task;

  if (!task.text) {
    return NextResponse.json({ error: "Task text is required" }, { status: 400 });
  }

  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const newTask: Task = {
    text: task.text,
    owner: task.owner || "👤",
    priority: task.priority || "green",
    done: false,
  };

  project.tasks.push(newTask);
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);

  return NextResponse.json(newTask, { status: 201 });
}
