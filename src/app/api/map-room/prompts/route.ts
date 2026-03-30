import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:prompts";
const TOKEN = "apex-live-2026";

interface Prompt {
  id: string;
  name: string;
  project_id: string;
  version: string;
  text: string;
  owner: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface PromptsData {
  items: Prompt[];
  lastUpdated: string;
}

const SEED: PromptsData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "prm-001",
      name: "Carousel Copy Generator",
      project_id: "caliber",
      version: "v3",
      text: "You are the #1 scientific copywriter specializing in peptide education. Write a 7-slide Instagram carousel about [PEPTIDE NAME] using this research brief. Slide 1: Hook + peptide name (6 words max, curiosity gap). Slides 2-6: Educational content using research data. Slide 7: CTA. Caption: Open with bold statement, educational tone, 3-5 hashtags including #CaliberPeptides.",
      owner: "Atlas",
      tags: ["content", "instagram", "caliber"],
      created_at: "2026-03-10",
      updated_at: "2026-03-29",
    },
    {
      id: "prm-002",
      name: "Funnel Analysis Prompt",
      project_id: "gemsnap",
      version: "v2",
      text: "Using PostHog session data, analyze the GemSnap funnel: landing page views -> question answered -> checkout initiated -> payment completed. Calculate drop-off rate at each stage. Identify biggest leak. Generate 3 hypotheses for why they drop off. Recommend 1 immediate A/B test with expected impact.",
      owner: "Darwin",
      tags: ["analytics", "gemsnap", "conversion"],
      created_at: "2026-03-15",
      updated_at: "2026-03-29",
    },
    {
      id: "prm-003",
      name: "Audit Report Generator",
      project_id: "edge-auto",
      version: "v2",
      text: "You are the world's best automation strategist for small businesses. Given business profile: [employees, hours/week manual work, hourly rate, revenue]. Generate a personalized automation audit with 9 sections: Executive Summary, Current State Analysis, Automation Opportunity Map (5 automations), ROI Projection, Implementation Roadmap, DIY Complexity Score, Done-For-You Offer, Guarantee, Next Steps.",
      owner: "Atlas",
      tags: ["sales", "edge-auto", "report"],
      created_at: "2026-03-20",
      updated_at: "2026-03-29",
    },
    {
      id: "prm-004",
      name: "SEO Article Writer",
      project_id: "caliber",
      version: "v1",
      text: "Write a 1,500-word SEO-optimized article about [PEPTIDE NAME] for the Caliber Peptides website. Structure: H1 title with primary keyword, H2 sections for mechanism of action, benefits, dosing, FAQ. Tone: Authoritative yet accessible. No medical claims. Include internal links to product pages. Meta description under 155 chars.",
      owner: "Newton",
      tags: ["seo", "content", "caliber"],
      created_at: "2026-03-27",
      updated_at: "2026-03-27",
    },
  ],
};

async function getData(): Promise<PromptsData> {
  const cached = await kv.get<PromptsData>(KV_KEY);
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

  const item: Prompt = {
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
