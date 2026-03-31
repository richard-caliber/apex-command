import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:heartbeat-v2";
const TOKEN = "apex-live-2026";

interface HeartbeatData {
  lastRun: string;
  status: "all-clear" | "issues-found" | "critical";
  nextRun: string | null;
  sections: {
    id: string;
    title: string;
    items: Record<string, unknown>[];
  }[];
  lastUpdated: string;
}

const SEED: HeartbeatData = {
  lastRun: "2026-03-31T06:00:00Z",
  status: "issues-found",
  nextRun: null,
  lastUpdated: "2026-03-31T06:00:00Z",
  sections: [
    {
      id: "failed-checks",
      title: "Failed Checks",
      items: [
        {
          id: "hb-fc-1",
          name: "Caliber IG post frequency",
          severity: "warning",
          expected: "3 posts/week",
          actual: "1 post/week",
          suggested: "Increase carousel output or schedule backup content",
        },
      ],
    },
    {
      id: "missed-tasks",
      title: "Missed Tasks",
      items: [
        {
          id: "hb-mt-1",
          name: "Build Edge Auto report page",
          severity: "critical",
          project: "Edge Auto",
          owner: "Claude Code",
          due: "2026-03-28",
          days_overdue: 3,
        },
        {
          id: "hb-mt-2",
          name: "Review GemSnap A/B test results",
          severity: "warning",
          project: "GemSnap",
          owner: "Atlas",
          due: "2026-03-29",
          days_overdue: 2,
        },
      ],
    },
    {
      id: "missing-data",
      title: "Missing Data",
      items: [
        {
          id: "hb-md-1",
          name: "Caliber website conversion rate",
          needed_for: "Traffic stage decisions",
          expected_source: "PostHog",
        },
        {
          id: "hb-md-2",
          name: "Edge Auto client list",
          needed_for: "MVP stage progress",
          expected_source: "Manual entry",
        },
      ],
    },
    {
      id: "unreviewed-posts",
      title: "Unreviewed Posts",
      items: [
        {
          id: "hb-up-1",
          title: "BPC-157 The Healing Peptide",
          platform: "Instagram",
          posted: "2026-03-27",
          days_since: 4,
        },
      ],
    },
    {
      id: "stale-outputs",
      title: "Stale Outputs",
      items: [
        {
          id: "hb-so-1",
          name: "Caliber competitor pricing report",
          project: "Caliber Peptides",
          stage: "Research",
          last_updated: "2026-03-20",
          days_stale: 11,
        },
      ],
    },
    {
      id: "unresolved-bottlenecks",
      title: "Unresolved Bottlenecks",
      items: [
        {
          id: "hb-bn-1",
          name: "PostHog integration not configured",
          project: "GemSnap",
          stage: "Conversion",
          flagged: "2026-03-25",
          owner: "Claude Code",
        },
      ],
    },
  ],
};

async function getData(): Promise<HeartbeatData> {
  const cached = await kv.get<HeartbeatData>(KV_KEY);
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

  if (body.action === "resolve" && body.itemId) {
    for (const section of data.sections) {
      section.items = section.items.filter((i) => i.id !== body.itemId);
    }
  }

  if (body.action === "run") {
    data.lastRun = now;
    data.status = data.sections.some((s) => s.items.length > 0) ? "issues-found" : "all-clear";
  }

  data.lastUpdated = now;
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
