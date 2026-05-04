import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1: read maproom:capabilities-v2 (canonical). The v2 store splits
// records across gaps[], research[], and boards[] — search all three.
const KV_KEY = "maproom:capabilities-v2";

interface IdEntry { id: string; [k: string]: unknown }
interface CapabilitiesData {
  gaps?: IdEntry[];
  research?: IdEntry[];
  boards?: IdEntry[];
  lastUpdated: string;
}

async function getData(): Promise<CapabilitiesData | null> {
  return kv.get<CapabilitiesData>(KV_KEY);
}

function findById(data: CapabilitiesData, id: string): { entry: IdEntry; arr: IdEntry[]; section: "gaps" | "research" | "boards" } | null {
  for (const section of ["gaps", "research", "boards"] as const) {
    const arr = data[section];
    if (!arr) continue;
    const entry = arr.find((e) => e.id === id);
    if (entry) return { entry, arr, section };
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hit = findById(data, id);
  if (!hit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ section: hit.section, ...hit.entry });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { id } = await params;
  const updates = await req.json();
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hit = findById(data, id);
  if (!hit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  Object.assign(hit.entry, updates, { updated_at: new Date().toISOString() });
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json({ section: hit.section, ...hit.entry });
}
