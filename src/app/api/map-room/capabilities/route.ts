import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "maproom:capabilities-v2";
interface CapabilitiesData {
  gaps: {
    id: string;
    name: string;
    current_process: string;
    impact: string;
    approach: string;
    priority: string;
    status: string;
  }[];
  research: {
    id: string;
    tool_name: string;
    what_it_does: string;
    cost: string;
    complexity: string;
    notes: string;
    decision: string;
  }[];
  boards: {
    id: string;
    title: string;
    opportunities: {
      id: string;
      name: string;
      description: string;
      estimated_effort: string;
      estimated_impact: string;
      status: string;
    }[];
  }[];
  lastUpdated: string;
}

const SEED: CapabilitiesData = {
  lastUpdated: "2026-03-31T06:00:00Z",
  gaps: [
    {
      id: "gap-1",
      name: "Social posting automation",
      current_process: "Manual copy-paste to Instagram",
      impact: "Save 3+ hours/week, consistent posting schedule",
      approach: "integrate",
      priority: "high",
      status: "identified",
    },
    {
      id: "gap-2",
      name: "Competitor price monitoring",
      current_process: "Manual weekly check of competitor sites",
      impact: "Real-time pricing intelligence, faster reaction to market",
      approach: "build",
      priority: "medium",
      status: "researching",
    },
    {
      id: "gap-3",
      name: "Voice note transcription",
      current_process: "No process exists — ideas lost",
      impact: "Capture ideas on the go, feed into Ideas page automatically",
      approach: "buy",
      priority: "high",
      status: "identified",
    },
  ],
  research: [
    {
      id: "res-1",
      tool_name: "Later.com",
      what_it_does: "Social media scheduling with auto-publish to Instagram, TikTok, X",
      cost: "$25/month",
      complexity: "easy",
      notes: "Good for scheduling but doesn't generate content. Could pair with our AI pipeline.",
      decision: "revisit",
    },
    {
      id: "res-2",
      tool_name: "Whisper API",
      what_it_does: "OpenAI speech-to-text — transcribe voice notes to text",
      cost: "$0.006/minute",
      complexity: "easy",
      notes: "Fast, cheap, accurate. Could wire into Ideas page capture flow.",
      decision: "use",
    },
  ],
  boards: [
    {
      id: "board-social",
      title: "Social automation opportunities",
      opportunities: [
        { id: "opp-1", name: "Auto-schedule approved carousels", description: "Once quality gate passes, auto-queue for optimal posting time", estimated_effort: "2 days", estimated_impact: "High — removes manual scheduling bottleneck", status: "identified" },
      ],
    },
    {
      id: "board-data",
      title: "Data automation opportunities",
      opportunities: [
        { id: "opp-2", name: "PostHog → Data page sync", description: "Pull conversion metrics from PostHog API into Data page automatically", estimated_effort: "1 day", estimated_impact: "High — eliminates manual metric entry", status: "identified" },
      ],
    },
    {
      id: "board-content",
      title: "Content automation opportunities",
      opportunities: [
        { id: "opp-3", name: "Research → Carousel pipeline", description: "Newton research brief auto-triggers Atlas carousel generation", estimated_effort: "3 days", estimated_impact: "High — full content pipeline without manual handoff", status: "identified" },
      ],
    },
    {
      id: "board-fulfilment",
      title: "Fulfilment automation opportunities",
      opportunities: [],
    },
    {
      id: "board-external",
      title: "External insight mapping",
      opportunities: [],
    },
    {
      id: "board-testing",
      title: "Test automation bank",
      opportunities: [],
    },
  ],
};

async function getData(): Promise<CapabilitiesData> {
  const cached = await kv.get<CapabilitiesData>(KV_KEY);
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
  const newId = Date.now().toString(36);

  if (body.target === "gaps") {
    if (body.action === "add") {
      data.gaps.push({ id: newId, ...body.item });
    } else if (body.action === "update" && body.item?.id) {
      const idx = data.gaps.findIndex((g) => g.id === body.item.id);
      if (idx >= 0) Object.assign(data.gaps[idx], body.item);
    } else if (body.action === "delete" && body.itemId) {
      data.gaps = data.gaps.filter((g) => g.id !== body.itemId);
    }
  } else if (body.target === "research") {
    if (body.action === "add") {
      data.research.push({ id: newId, ...body.item });
    } else if (body.action === "update" && body.item?.id) {
      const idx = data.research.findIndex((r) => r.id === body.item.id);
      if (idx >= 0) Object.assign(data.research[idx], body.item);
    } else if (body.action === "delete" && body.itemId) {
      data.research = data.research.filter((r) => r.id !== body.itemId);
    }
  } else if (body.target === "boards") {
    const board = data.boards.find((b) => b.id === body.boardId);
    if (board) {
      if (body.action === "add") {
        board.opportunities.push({ id: newId, ...body.item });
      } else if (body.action === "delete" && body.itemId) {
        board.opportunities = board.opportunities.filter((o) => o.id !== body.itemId);
      }
    }
  }

  data.lastUpdated = now;
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
