import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:projects";
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
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const body = (await req.json()) as ProjectData;
  body.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, body);
  return NextResponse.json({ ok: true });
}
