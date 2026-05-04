import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:ideas-commentary";
interface Commentary {
  id: string;
  agent: string;
  emoji: string;
  text: string;
  updated_at: string;
}

const SEED: Commentary[] = [
  {
    id: "commentary-atlas",
    agent: "atlas",
    emoji: "\ud83e\udded",
    text: "We have 8 projects in the pipeline. BirdSnap and PlantSnap are the fastest to launch \u2014 same engine as GemSnap, just swap the model. Priority: get GemSnap converting first, then clone the funnel.",
    updated_at: "2026-04-03T11:40:00Z",
  },
  {
    id: "commentary-newton",
    agent: "newton",
    emoji: "\ud83d\udd2c",
    text: "Birding apps have 85M US users. PlantSnap has 50M downloads proving demand. Research priority: identifier app market sizing, conversion benchmarks, and API cost modelling for scaled inference.",
    updated_at: "2026-04-03T11:40:00Z",
  },
  {
    id: "commentary-darwin",
    agent: "darwin",
    emoji: "\ud83d\udd04",
    text: "3 of our 20 ideas are clones of GemSnap\u2019s model. If GemSnap can\u2019t convert, cloning it won\u2019t help. Fix the funnel first, then scale. Focus energy on conversion data before expanding the portfolio.",
    updated_at: "2026-04-03T11:40:00Z",
  },
];

async function getCommentaries(): Promise<Commentary[]> {
  const cached = await kv.get<Commentary[]>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  if (action === "list") {
    const commentaries = await getCommentaries();
    return NextResponse.json(commentaries);
  }

  if (action === "set") {
    const unauthorized = requireWriteAuth(req);

    if (unauthorized) return unauthorized;

    const { commentaries } = body as { commentaries: Commentary[] };
    if (!commentaries || !Array.isArray(commentaries)) {
      return NextResponse.json({ error: "Missing commentaries array" }, { status: 400 });
    }

    const existing = await getCommentaries();
    for (const c of commentaries) {
      const idx = existing.findIndex((e) => e.id === c.id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...c, updated_at: new Date().toISOString() };
      } else {
        existing.push({ ...c, updated_at: new Date().toISOString() });
      }
    }

    await kv.set(KV_KEY, existing);
    return NextResponse.json(existing);
  }

  return NextResponse.json({ error: "Unknown action. Use: list, set" }, { status: 400 });
}
