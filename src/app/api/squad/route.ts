import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { readFile } from "fs/promises";
import { join } from "path";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:squad:v4";
export interface WorkspaceFile {
  name: string;
  path?: string;
  description?: string;
  owner?: string;
  size: string;
  updated_at: string;
  status?: "current" | "stale" | "orphan";
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  title: string;
  department: string;
  reports_to: string;
  status: "active" | "idle" | "blocked" | "error";
  current_model: string;
  model_strategy: string;
  current_task: string;
  task_since: string;
  layout: { row: number; col: number; x: number; y: number; connects_to: string[] };
  preferred_models?: { light: string; normal: string; deep: string };
  identity_text?: string;
  soul_text: string;
  capabilities_text?: string;
  responsibilities_text?: string;
  memory_text: string;
  memory_updated_at?: string;
  workspace_files: WorkspaceFile[];
  current_tasks?: { id: string; text: string; status: string; project?: string }[];
  output_log?: { timestamp: string; task_id: string; task_name: string; summary: string; status: string }[];
  blockers?: { description: string; waiting_on: string; since?: string }[];
  last_action?: string;
  last_updated: string;
}

export interface SquadData {
  agents: Agent[];
  lastUpdated: string;
}

// Ginge — the human founder node
const GINGE: Agent = {
  id: "ginge",
  name: "Ginge",
  emoji: "\uD83D\uDC51",
  role: "Founder & Commander",
  title: "The Boss",
  department: "Command",
  reports_to: "",
  status: "active",
  current_model: "Human Brain",
  model_strategy: "Delegates to agents, reviews outputs, makes final calls",
  current_task: "Building Apex Command Centre",
  task_since: new Date().toISOString(),
  layout: { row: 0, col: 1, x: 50, y: 8, connects_to: ["atlas", "newton", "darwin", "jimmy"] },
  soul_text: "",
  memory_text: "",
  workspace_files: [],
  last_updated: new Date().toISOString(),
};

// Layout positions for the 4 AI agents — org-chart style
const LAYOUTS: Record<string, Agent["layout"]> = {
  atlas:  { row: 1, col: 1, x: 50, y: 42, connects_to: ["ginge", "newton", "darwin", "jimmy"] },
  newton: { row: 2, col: 0, x: 16, y: 78, connects_to: ["ginge", "atlas"] },
  jimmy:  { row: 2, col: 1, x: 50, y: 78, connects_to: ["atlas"] },
  darwin: { row: 2, col: 2, x: 84, y: 78, connects_to: ["ginge", "atlas"] },
};

async function buildSeed(): Promise<SquadData> {
  try {
    const raw = await readFile(join(process.cwd(), "data", "squad.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const agents: Agent[] = [GINGE];

    for (const a of parsed.agents || []) {
      agents.push({
        ...a,
        layout: LAYOUTS[a.id] || { row: 3, col: 1, x: 50, y: 90, connects_to: [] },
        last_updated: a.task_since || new Date().toISOString(),
        memory_updated_at: a.task_since || "",
      });
    }

    return { agents, lastUpdated: new Date().toISOString() };
  } catch {
    // Fallback if file not found
    return {
      agents: [GINGE],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function getData(): Promise<SquadData> {
  const cached = await kv.get<SquadData>(KV_KEY);
  if (cached) return cached;
  const seed = await buildSeed();
  await kv.set(KV_KEY, seed);
  return seed;
}

export async function GET() {
  return NextResponse.json(await getData());
}

export async function PUT(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;
  const body = await req.json();
  body.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, body);
  return NextResponse.json(body);
}

export async function PATCH(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { agentId, ...updates } = await req.json();
  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const data = await getData();
  const agent = data.agents.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if ("memory_text" in updates && updates.memory_text !== agent.memory_text) {
    updates.memory_updated_at = new Date().toISOString();
  }

  Object.assign(agent, updates, { last_updated: new Date().toISOString() });
  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json(agent);
}
