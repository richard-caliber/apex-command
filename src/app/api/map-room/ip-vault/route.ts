import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:ip-vault";
const TOKEN = "apex-live-2026";

interface IPItem {
  id: string;
  name: string;
  type: "framework" | "prompt" | "process" | "template" | "method" | "dataset";
  project_id: string;
  description: string;
  content: string;
  tags: string[];
  reusable: boolean;
  created_at: string;
  updated_at: string;
}

interface IPVaultData {
  items: IPItem[];
  lastUpdated: string;
}

const SEED: IPVaultData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "ip-001",
      name: "7-Stage Project Pipeline",
      type: "framework",
      project_id: "apex",
      description: "The core framework for tracking projects from idea to scale. Each stage has clear entry/exit criteria.",
      content: "Stage -1: Idea Inbox | Stage 0: Idea | Stage 1: Validation | Stage 2: Design | Stage 3: MVP | Stage 4: Traffic | Stage 5: Conversion | Stage 6: Scale",
      tags: ["framework", "core", "reusable"],
      reusable: true,
      created_at: "2026-01-01",
      updated_at: "2026-03-30",
    },
    {
      id: "ip-002",
      name: "Carousel Quality Gate Checklist",
      type: "process",
      project_id: "caliber",
      description: "Mandatory checklist before any carousel can be published. Prevents brand-damaging content going live.",
      content: "1. Background deep teal? 2. Logo watermark present? 3. White bold caps text? 4. Teal accent colour? 5. Peptide name on cover? 6. Hook under 6 words? 7. CTA approved format? 8. No medical claims? 9. 3-5 hashtags?",
      tags: ["quality", "content", "caliber"],
      reusable: true,
      created_at: "2026-03-15",
      updated_at: "2026-03-29",
    },
    {
      id: "ip-003",
      name: "Edge Auto Guarantee Formula",
      type: "method",
      project_id: "edge-auto",
      description: "The guarantee structure that de-risks the offer: 12K minimum savings in Year 1 or the implementation is free.",
      content: "Calculate: (hours_saved_per_week * hourly_rate * 52) + (leads_captured * avg_deal_value * close_rate). If projected > 12000, guarantee applies. If actual < 12000 after 12 months, full refund.",
      tags: ["sales", "guarantee", "edge-auto"],
      reusable: true,
      created_at: "2026-03-01",
      updated_at: "2026-03-28",
    },
    {
      id: "ip-004",
      name: "AI Agent Squad Structure",
      type: "framework",
      project_id: "apex",
      description: "The squad model: Atlas (strategy/content), Darwin (QA/analysis), Newton (research), Jimmy (chaos agent), with Ginge as founder/builder.",
      content: "Atlas: Strategy, content generation, publishing. Darwin: Quality gates, analysis, reviews. Newton: Deep research, citations, data. Jimmy: Creative disruption, unconventional ideas. Ginge: Founder decisions, human tasks, final approvals.",
      tags: ["framework", "core", "agents"],
      reusable: true,
      created_at: "2026-01-15",
      updated_at: "2026-03-30",
    },
  ],
};

async function getData(): Promise<IPVaultData> {
  const cached = await kv.get<IPVaultData>(KV_KEY);
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

  const item: IPItem = {
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
