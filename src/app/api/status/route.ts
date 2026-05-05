import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";
import { getAllProjects, getProjectStoreLastUpdated } from "@/lib/projects";

// GET reads canonical apex:warroom:projects via the projects lib.
// POST still writes to legacy apex:projects (full retirement in Phase 6).
const WRITE_KEY = "apex:projects";

interface ProjectData {
  projects: Record<string, unknown>[];
  lastUpdated: string;
}

export async function GET() {
  const projects = await getAllProjects();
  const lastUpdated = await getProjectStoreLastUpdated();
  return NextResponse.json({ projects, lastUpdated });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const body = (await req.json()) as ProjectData;
  body.lastUpdated = new Date().toISOString();
  await kv.set(WRITE_KEY, body);
  return NextResponse.json({ ok: true });
}
