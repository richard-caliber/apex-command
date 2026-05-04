import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1: read maproom:ip-vault-v2 (canonical). The v2 shape is
// { sections[].entries[] } — entry IDs are unique across sections.
const KV_KEY = "maproom:ip-vault-v2";

interface Entry { id: string; [k: string]: unknown }
interface Section { id: string; title?: string; entries: Entry[] }
interface VaultData {
  sections: Section[];
  lastUpdated: string;
}

async function getData(): Promise<VaultData | null> {
  return kv.get<VaultData>(KV_KEY);
}

function findEntry(data: VaultData, id: string): { entry: Entry; section: Section } | null {
  for (const section of data.sections || []) {
    const entry = (section.entries || []).find((e) => e.id === id);
    if (entry) return { entry, section };
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

  const hit = findEntry(data, id);
  if (!hit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ section_id: hit.section.id, ...hit.entry });
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

  const hit = findEntry(data, id);
  if (!hit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  Object.assign(hit.entry, updates, { updated_at: new Date().toISOString() });
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json({ section_id: hit.section.id, ...hit.entry });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { id } = await params;
  const data = await getData();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let removed = false;
  for (const section of data.sections || []) {
    const before = section.entries?.length ?? 0;
    section.entries = (section.entries || []).filter((e) => e.id !== id);
    if (before !== section.entries.length) removed = true;
  }
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
