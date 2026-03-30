import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:metrics";
const TOKEN = "apex-live-2026";

interface ProjectMetrics {
  project_id: string;
  project_name: string;
  stage: number;
  tasks_total: number;
  tasks_done: number;
  tasks_overdue: number;
  tasks_blocked: number;
  automation_score: string;
  top_blocker: string;
  health: "green" | "amber" | "red";
}

interface MetricsData {
  items: ProjectMetrics[];
  global: {
    total_projects: number;
    total_tasks: number;
    overdue_tasks: number;
    blocked_tasks: number;
    unassigned_tasks: number;
    heartbeat_issues: number;
    overall_health: "green" | "amber" | "red";
  };
  lastUpdated: string;
}

const SEED: MetricsData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  global: {
    total_projects: 3,
    total_tasks: 8,
    overdue_tasks: 2,
    blocked_tasks: 2,
    unassigned_tasks: 3,
    heartbeat_issues: 8,
    overall_health: "amber",
  },
  items: [
    {
      project_id: "caliber",
      project_name: "Caliber Peptides",
      stage: 4,
      tasks_total: 4,
      tasks_done: 0,
      tasks_overdue: 2,
      tasks_blocked: 1,
      automation_score: "3/7",
      top_blocker: "Website conversion rate unknown",
      health: "red",
    },
    {
      project_id: "gemsnap",
      project_name: "GemSnap",
      stage: 5,
      tasks_total: 2,
      tasks_done: 0,
      tasks_overdue: 0,
      tasks_blocked: 1,
      automation_score: "2/5",
      top_blocker: "A/B test results pending (7-day wait)",
      health: "amber",
    },
    {
      project_id: "edge-auto",
      project_name: "Edge Auto",
      stage: 2,
      tasks_total: 2,
      tasks_done: 0,
      tasks_overdue: 0,
      tasks_blocked: 0,
      automation_score: "1/4",
      top_blocker: "Report page not built -- demo needed by April 3",
      health: "amber",
    },
  ],
};

async function getData(): Promise<MetricsData> {
  const cached = await kv.get<MetricsData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = await getData();
  Object.assign(data, body);
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
