import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:prompts:v2";
export interface PromptContent {
  role: string;
  context: string;
  objective: string;
  constraints: string;
  process: string;
  outputFormat: string;
  qualityBar: string;
}

export interface PromptRecord {
  id: string;
  name: string;
  stage?: string;
  taskId?: string;
  category: string;
  owner: string;
  model: string;
  version: number;
  tags: string[];
  prompt: PromptContent;
  usage: {
    timesUsed: number;
    lastUsed: string | null;
    lastEditedBy: string;
  };
  created_at: string;
  updated_at: string;
}

interface PromptsData {
  items: PromptRecord[];
  lastUpdated: string;
}

const SEED: PromptsData = {
  items: [],
  lastUpdated: new Date().toISOString(),
};

async function getData(): Promise<PromptsData> {
  const cached = await kv.get<PromptsData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ── Read operations (no auth) ──
  if (action === "list") {
    const data = await getData();
    return NextResponse.json(data.items);
  }

  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const data = await getData();
    const item = data.items.find((p) => p.id === id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  // ── Write operations (auth required) ──
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  switch (action) {
    case "set": {
      const { id, name, stage, taskId, category, owner, model, tags, prompt: promptContent } = body;
      if (!id || !name) return NextResponse.json({ error: "id and name required" }, { status: 400 });

      const data = await getData();
      const now = new Date().toISOString();
      const existing = data.items.find((p) => p.id === id);

      if (existing) {
        Object.assign(existing, {
          name, category: category || existing.category, owner: owner || existing.owner,
          model: model || existing.model, tags: tags || existing.tags,
          prompt: promptContent || existing.prompt,
          version: (existing.version || 0) + 1,
          updated_at: now,
        });
        if (stage !== undefined) existing.stage = stage;
        if (taskId !== undefined) existing.taskId = taskId;
        if (body.usage) Object.assign(existing.usage, body.usage);
        existing.usage.lastEditedBy = owner || existing.owner;
      } else {
        data.items.push({
          id, name,
          stage: stage || undefined,
          taskId: taskId || undefined,
          category: category || "general",
          owner: owner || "ginge",
          model: model || "claude-sonnet-4-6",
          version: 1,
          tags: tags || [],
          prompt: promptContent || { role: "", context: "", objective: "", constraints: "", process: "", outputFormat: "", qualityBar: "" },
          usage: { timesUsed: 0, lastUsed: null, lastEditedBy: owner || "ginge" },
          created_at: now,
          updated_at: now,
        });
      }

      data.lastUpdated = now;
      await kv.set(KV_KEY, data);
      return NextResponse.json({ ok: true });
    }

    case "delete": {
      const { id: delId } = body;
      if (!delId) return NextResponse.json({ error: "id required" }, { status: 400 });
      const data = await getData();
      data.items = data.items.filter((p) => p.id !== delId);
      data.lastUpdated = new Date().toISOString();
      await kv.set(KV_KEY, data);
      return NextResponse.json({ ok: true });
    }

    case "search": {
      const { query } = body;
      if (!query) return NextResponse.json([]);
      const data = await getData();
      const q = query.toLowerCase();
      const results = data.items.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t: string) => t.toLowerCase().includes(q)) ||
        Object.values(p.prompt).some((v) => typeof v === "string" && v.toLowerCase().includes(q))
      );
      return NextResponse.json(results);
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// Keep GET for backwards compat
export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}
