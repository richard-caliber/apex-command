import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const TOKEN = "apex-live-2026";

interface ProjectTask {
  id: string;
  text: string;
  owner: string;
  priority: "red" | "amber" | "green";
  status: "todo" | "in-progress" | "done" | "blocked";
  blockedBy?: string;
}

interface ProjectDetail {
  id: string;
  tasks: ProjectTask[];
  [key: string]: unknown;
}

function kvKey(id: string) {
  return `apex:project:${id}`;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, taskId } = await params;
  const data = await kv.get<ProjectDetail>(kvKey(id));
  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const taskIdx = data.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx === -1) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updates = await req.json();
  data.tasks[taskIdx] = { ...data.tasks[taskIdx], ...updates, id: taskId };
  await kv.set(kvKey(id), data);

  return NextResponse.json(data.tasks[taskIdx]);
}
