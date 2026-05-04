import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

// Phase 1: canonical squad store is apex:squad:v4. The v2 key was empty/orphaned.
const KV_KEY = "apex:squad:v4";
export async function PUT(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

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

  // Full replace of workspace_files for this agent. v4 schema requires
  // { name, size, updated_at } and accepts optional { path, description, owner, status }.
  const now = new Date().toISOString();
  agent.workspace_files = files.map((f: Record<string, string>) => {
    const path = f.path || "";
    const name = f.name || (path ? path.split(/[\\/]/).pop() || path : "");
    return {
      name,
      path,
      description: f.description || "",
      owner: agentId,
      size: f.size || "",
      updated_at: f.updated_at || f.last_modified || now,
      status: (f.status as "current" | "stale" | "orphan") || "current",
    };
  });
  agent.last_updated = now;
  squadData.lastUpdated = now;

  await kv.set(KV_KEY, squadData);
  return NextResponse.json({ ok: true, count: files.length });
}
