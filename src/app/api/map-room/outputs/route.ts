import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "maproom:outputs";
interface Output {
  id: string;
  name: string;
  project_id: string;
  linked_task_id: string;
  linked_prompt_id: string;
  text: string;
  status: "fresh" | "stale" | "failed";
  quality_score: number | null;
  owner: string;
  created_at: string;
  updated_at: string;
}

interface OutputsData {
  items: Output[];
  lastUpdated: string;
}

const SEED: OutputsData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "out-001",
      name: "BPC-157 Carousel Copy v3",
      project_id: "caliber",
      linked_task_id: "tsk-003",
      linked_prompt_id: "prm-001",
      text: "Slide 1: 'Your Gut Has a Secret Weapon' -- BPC-157\nSlide 2: BPC-157 is a pentadecapeptide derived from human gastric juice...\nSlide 7: CTA: DM us GUTFIX for the Peptide Bible",
      status: "stale",
      quality_score: 6.5,
      owner: "Atlas",
      created_at: "2026-03-30T06:00:00Z",
      updated_at: "2026-03-30T06:00:00Z",
    },
    {
      id: "out-002",
      name: "Peptide Research Brief -- BPC-157",
      project_id: "caliber",
      linked_task_id: "tsk-002",
      linked_prompt_id: "prm-004",
      text: "Overview: Body Protection Compound-157 is a synthetic pentadecapeptide...\nKey Findings: 1) Accelerates tendon healing... 2) Gut protective properties...\n[Full structured brief with 7 sources]",
      status: "fresh",
      quality_score: 8.5,
      owner: "Newton",
      created_at: "2026-03-28T10:00:00Z",
      updated_at: "2026-03-28T10:00:00Z",
    },
    {
      id: "out-003",
      name: "GemSnap Funnel Analysis Report",
      project_id: "gemsnap",
      linked_task_id: "tsk-004",
      linked_prompt_id: "prm-002",
      text: "Checkout is biggest leak (62% drop-off).\nHypothesis 1: Price reveal too late.\nHypothesis 2: Too many form fields.\nHypothesis 3: No trust signals.\nRecommended: Show price on question page (Variant B).",
      status: "fresh",
      quality_score: 8.0,
      owner: "Darwin",
      created_at: "2026-03-29T09:00:00Z",
      updated_at: "2026-03-29T09:00:00Z",
    },
    {
      id: "out-004",
      name: "Edge Auto Sample Audit Report",
      project_id: "edge-auto",
      linked_task_id: "tsk-001",
      linked_prompt_id: "prm-003",
      text: "Executive Summary: Your business is losing 18,200/year to manual processes...\n[Full 9-section report]\nDone-for-you: 4,000 flat fee.\nGuarantee: 12K minimum savings or free.",
      status: "fresh",
      quality_score: 9.0,
      owner: "Atlas",
      created_at: "2026-03-29T14:00:00Z",
      updated_at: "2026-03-29T14:00:00Z",
    },
  ],
};

async function getData(): Promise<OutputsData> {
  const cached = await kv.get<OutputsData>(KV_KEY);
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

  const item: Output = {
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
