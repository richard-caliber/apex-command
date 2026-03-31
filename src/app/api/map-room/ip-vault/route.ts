import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:ip-vault-v2";
const TOKEN = "apex-live-2026";

interface VaultData {
  sections: {
    id: string;
    title: string;
    entries: Record<string, unknown>[];
  }[];
  lastUpdated: string;
}

const SEED: VaultData = {
  lastUpdated: "2026-03-31T06:00:00Z",
  sections: [
    {
      id: "winning-hooks",
      title: "Winning Hooks",
      entries: [
        { id: "wh-1", text: "Your body makes this peptide. Most people don't have enough.", platform: "Instagram", post_id: "CAL-IG-001", metric: "4.2% engagement rate (3x average)" },
        { id: "wh-2", text: "We scanned 10,000 gems. Here's what we found.", platform: "Instagram", post_id: "GEM-IG-001", metric: "6.1% CTR to checkout" },
      ],
    },
    {
      id: "winning-creatives",
      title: "Winning Creatives",
      entries: [],
    },
    {
      id: "prompt-versions",
      title: "Prompt Versions",
      entries: [],
    },
    {
      id: "channel-learnings",
      title: "Channel Learnings",
      entries: [
        { id: "cl-1", platform: "Instagram", learning: "Carousels outperform reels for education content by 3x engagement", evidence: "Compared 12 carousel posts vs 8 reels over Feb-Mar 2026. Avg carousel engagement 3.8%, avg reel engagement 1.2%.", date: "2026-03-25" },
      ],
    },
    {
      id: "funnel-learnings",
      title: "Funnel Learnings",
      entries: [],
    },
    {
      id: "failed-experiments",
      title: "Failed Experiments",
      entries: [
        { id: "fe-1", experiment_name: "Reddit organic for Caliber", hypothesis: "r/peptides community would engage with educational content and drive traffic", result: "3 posts removed for self-promotion, 1 shadowban warning. 0 conversions.", learning: "Reddit requires pure value-first approach. Need established account with karma. Not viable as primary channel for Caliber.", date: "2026-03-10" },
      ],
    },
    {
      id: "reusable-frameworks",
      title: "Reusable Frameworks",
      entries: [],
    },
    {
      id: "system-learnings",
      title: "System Learnings",
      entries: [],
    },
  ],
};

async function getData(): Promise<VaultData> {
  const cached = await kv.get<VaultData>(KV_KEY);
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
  const newId = Date.now().toString(36);

  if (body.action === "add" && body.sectionId) {
    const section = data.sections.find((s) => s.id === body.sectionId);
    if (section) {
      section.entries.push({ id: newId, ...body.entry });
    }
  } else if (body.action === "update" && body.sectionId && body.entryId) {
    const section = data.sections.find((s) => s.id === body.sectionId);
    if (section) {
      const idx = section.entries.findIndex((e) => e.id === body.entryId);
      if (idx >= 0) Object.assign(section.entries[idx], body.entry);
    }
  } else if (body.action === "delete" && body.sectionId && body.entryId) {
    const section = data.sections.find((s) => s.id === body.sectionId);
    if (section) {
      section.entries = section.entries.filter((e) => e.id !== body.entryId);
    }
  }

  data.lastUpdated = now;
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
