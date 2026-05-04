import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "maproom:tasks";
interface Task {
  id: string;
  name: string;
  project: string;
  project_id: string;
  owner: string;
  urgency: "critical" | "high" | "medium" | "low";
  status: "open" | "in-progress" | "blocked" | "done" | "cancelled";
  due_date: string;
  description: string;
  notes: string;
  overdue: boolean;
  created_at: string;
  updated_at: string;
}

interface TasksData {
  items: Task[];
  lastUpdated: string;
}

const SEED: TasksData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "tsk-001",
      name: "Build audit report page",
      project: "Edge Auto",
      project_id: "edge-auto",
      owner: "Claude Code",
      urgency: "critical",
      status: "in-progress",
      due_date: "2026-03-31",
      description: "Design and build the personalised audit report page with dark premium theme. Todd wants demo by April 3.",
      notes: "9-section copy template already written by Atlas. Focus on visual wrapper.",
      overdue: false,
      created_at: "2026-03-25",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-002",
      name: "Set up PostHog tracking",
      project: "Caliber Peptides",
      project_id: "caliber",
      owner: "Darwin",
      urgency: "critical",
      status: "open",
      due_date: "2026-03-28",
      description: "Install PostHog on all Caliber website pages and configure conversion funnels.",
      notes: "Need 7 days of data before baseline is meaningful.",
      overdue: true,
      created_at: "2026-03-20",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-003",
      name: "Write BPC-157 carousel",
      project: "Caliber Peptides",
      project_id: "caliber",
      owner: "Atlas",
      urgency: "high",
      status: "in-progress",
      due_date: "2026-03-29",
      description: "Create 7-slide Instagram carousel for BPC-157. Hook must be under 6 words, CTA approved format only.",
      notes: "Previous version scored 6.5/10 — hook too long, CTA wrong format. Reworking.",
      overdue: true,
      created_at: "2026-03-26",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-004",
      name: "Review GemSnap A/B test",
      project: "GemSnap",
      project_id: "gemsnap",
      owner: "Darwin",
      urgency: "high",
      status: "blocked",
      due_date: "2026-04-06",
      description: "Analyse 7-day A/B test results for pricing display variant. Need statistical significance before scaling ads.",
      notes: "Test started March 30. Earliest call date: April 6. Do NOT touch ads until then.",
      overdue: false,
      created_at: "2026-03-30",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-005",
      name: "Client onboarding call",
      project: "Edge Auto",
      project_id: "edge-auto",
      owner: "Ginge",
      urgency: "high",
      status: "open",
      due_date: "2026-04-03",
      description: "30-min onboarding call with first Edge Auto client. Identify top 3 pain points, agree on one priority automation.",
      notes: "Need to confirm client availability. Prepare onboarding brief beforehand.",
      overdue: false,
      created_at: "2026-03-28",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-006",
      name: "Competitor price check",
      project: "Caliber Peptides",
      project_id: "caliber",
      owner: "Unassigned",
      urgency: "medium",
      status: "open",
      due_date: "2026-04-05",
      description: "Survey UK peptide supplier pricing for top 10 products. Compare against Caliber pricing to ensure competitive positioning.",
      notes: "Check PeptideUK, Direct Peptides, UK Peptides Direct at minimum.",
      overdue: false,
      created_at: "2026-03-29",
      updated_at: "2026-03-29",
    },
    {
      id: "tsk-007",
      name: "Fix checkout funnel",
      project: "GemSnap",
      project_id: "gemsnap",
      owner: "Claude Code",
      urgency: "critical",
      status: "open",
      due_date: "2026-04-08",
      description: "Redesign checkout to single-page flow. Current 62% abandonment rate is killing revenue.",
      notes: "Wait for A/B test results before implementing. May inform which variant to build on.",
      overdue: false,
      created_at: "2026-03-30",
      updated_at: "2026-03-30",
    },
    {
      id: "tsk-008",
      name: "Create Caliber email sequence",
      project: "Caliber Peptides",
      project_id: "caliber",
      owner: "Newton",
      urgency: "medium",
      status: "open",
      due_date: "2026-04-10",
      description: "Write a 5-email welcome sequence for new Caliber Peptides subscribers. Educational tone, build trust, soft CTA on email 4.",
      notes: "Use research briefs as source material. Include peptide safety info.",
      overdue: false,
      created_at: "2026-03-30",
      updated_at: "2026-03-30",
    },
  ],
};

async function getData(): Promise<TasksData> {
  const cached = await kv.get<TasksData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const body = await req.json();
  const data = await getData();
  const now = new Date().toISOString();

  const item: Task = {
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
