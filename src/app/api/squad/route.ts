import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:squad";
const TOKEN = "apex-live-2026";

interface Capability {
  name: string;
  detail: string;
}

interface Bot {
  emoji: string;
  name: string;
  role: string;
  capabilities: Capability[];
  status: string;
}

interface UpcomingItem {
  status: "blocked" | "in-progress" | "ready";
  name: string;
  unlocks: string;
  owner: string;
}

interface SquadData {
  bots: Bot[];
  upcoming: UpcomingItem[];
}

const SEED: SquadData = {
  bots: [
    {
      emoji: "🔬",
      name: "Newton",
      role: "Research & Intelligence",
      capabilities: [
        { name: "X/Twitter monitoring", detail: "via Xpoz" },
        { name: "Instagram account analysis", detail: "via Xpoz" },
        { name: "Reddit monitoring", detail: "via Xpoz" },
        { name: "TikTok trend tracking", detail: "via Xpoz" },
        { name: "YouTube video analysis", detail: "yt-dlp" },
        { name: "Web search + deep research", detail: "" },
        { name: "Competitor teardowns", detail: "" },
        { name: "Market analysis + pricing strategy", detail: "" },
      ],
      status: "All live",
    },
    {
      emoji: "🧭",
      name: "Atlas",
      role: "Strategy & Execution",
      capabilities: [
        { name: "Claude Code builds + Vercel deploys", detail: "" },
        { name: "Content creation", detail: "carousels + reels" },
        { name: "Apex dashboard updates via API", detail: "" },
        { name: "IG auto-publishing", detail: "Graph API" },
        { name: "Inter-squad coordination", detail: "" },
        { name: "Memory management", detail: "" },
      ],
      status: "All live",
    },
    {
      emoji: "🔄",
      name: "Darwin",
      role: "Optimisation & Systems",
      capabilities: [
        { name: "Content review + quality gates", detail: "" },
        { name: "Cron job management", detail: "" },
        { name: "Python script execution", detail: "" },
        { name: "System monitoring", detail: "" },
        { name: "n8n workflow design", detail: "" },
      ],
      status: "All live",
    },
  ],
  upcoming: [
    { status: "blocked", name: "WebMCP Chrome extension", unlocks: "Darwin gets browser control → Reddit posting automation", owner: "👤" },
    { status: "blocked", name: "Sign up xpoz.ai", unlocks: "Unlocks X/TikTok/IG/Reddit for all bots", owner: "👤" },
    { status: "blocked", name: "YouTube Data API key", unlocks: "Newton gets YouTube search + stats", owner: "👤" },
    { status: "blocked", name: "Create throwaway X account", unlocks: "Newton gets authenticated thread pulls", owner: "👤" },
    { status: "in-progress", name: "n8n cross-posting pipeline", unlocks: "Every IG post auto-distributes to TikTok + YouTube Shorts", owner: "🔄" },
    { status: "in-progress", name: "Twikit setup", unlocks: "Deep X thread analysis", owner: "🔬" },
    { status: "in-progress", name: "last30days.py unified", unlocks: "One command searches all platforms", owner: "🔬" },
    { status: "ready", name: "Blotato cross-posting", unlocks: "Content auto-distributes everywhere", owner: "🧭" },
    { status: "ready", name: "smux", unlocks: "Claude Code + Codex shared terminal", owner: "🧭" },
    { status: "ready", name: "Ruflo", unlocks: "Full agent swarm orchestration", owner: "🧭" },
  ],
};

async function getData(): Promise<SquadData> {
  const cached = await kv.get<SquadData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const existing = await getData();
  const merged = { ...existing, ...body };
  await kv.set(KV_KEY, merged);
  return NextResponse.json(merged);
}
