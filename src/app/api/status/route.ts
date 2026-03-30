import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";

const KV_KEY = "apex:projects";
const TOKEN = "apex-live-2026";

interface ProjectData {
  projects: Record<string, unknown>[];
  lastUpdated: string;
}

async function getData(): Promise<ProjectData> {
  const cached = await kv.get<ProjectData>(KV_KEY);
  if (cached) return cached;

  // Seed from JSON file on first load
  const raw = await readFile(join(process.cwd(), "data", "projects.json"), "utf-8");
  const seed = JSON.parse(raw) as ProjectData;
  await kv.set(KV_KEY, seed);
  return seed;
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

  const body = (await req.json()) as ProjectData;
  body.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, body);
  return NextResponse.json({ ok: true });
}
