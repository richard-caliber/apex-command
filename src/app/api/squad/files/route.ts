import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:squad:v2";
const TOKEN = "apex-live-2026";

export async function PUT(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, files } = await req.json();
  if (!agentId || !Array.isArray(files)) {
    return NextResponse.json({ error: "agentId and files[] required" }, { status: 400 });
  }

  const data = await kv.get<Record<string, unknown>>(KV_KEY);
  if (!data || !Array.isArray((data as { agents?: unknown[] }).agents)) {
    return NextResponse.json({ error: "Squad data not found" }, { status: 404 });
  }

  const squadData = data as { agents: Record<string, unknown>[]; lastUpdated: string };
  const agent = squadData.agents.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Full replace of workspace_files for this agent
  agent.workspace_files = files.map((f: Record<string, string>) => ({
    path: f.path || "",
    description: f.description || "",
    owner: agentId,
    last_modified: f.last_modified || new Date().toISOString(),
    size: f.size || "",
    status: f.status || "current",
  }));
  agent.last_updated = new Date().toISOString();
  squadData.lastUpdated = new Date().toISOString();

  await kv.set(KV_KEY, squadData);
  return NextResponse.json({ ok: true, count: files.length });
}
