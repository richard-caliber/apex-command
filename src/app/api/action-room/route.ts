import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_FEED = "apex:action-room:feed";
const KV_SUGGESTIONS = "apex:action-room:suggestions";
const TOKEN = "apex-live-2026";

interface FeedEntry {
  id: string;
  project_id: string;
  agent: string;
  action: string;
  timestamp: string;
  link: string;
  category: string;
}

interface Suggestion {
  id: string;
  project_id: string;
  text: string;
  type: "next_task" | "blocked" | "quick_win" | "info";
  updated_at: string;
}

async function getFeed(): Promise<FeedEntry[]> {
  return (await kv.get<FeedEntry[]>(KV_FEED)) || [];
}

async function getSuggestions(): Promise<Suggestion[]> {
  return (await kv.get<Suggestion[]>(KV_SUGGESTIONS)) || [];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── Read operations (no auth) ──

  if (action === "feed-list") {
    const feed = await getFeed();
    const projectId = body.project_id as string | undefined;
    const filtered = projectId ? feed.filter((e) => e.project_id === projectId) : feed;
    return NextResponse.json(filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }

  if (action === "suggestions-list") {
    const suggestions = await getSuggestions();
    const projectId = body.project_id as string | undefined;
    const filtered = projectId ? suggestions.filter((s) => s.project_id === projectId) : suggestions;
    return NextResponse.json(filtered);
  }

  // ── Write operations (auth required) ──
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (action === "feed-add") {
    const { id, project_id, agent, action: entryAction, link, category } = body;
    if (!id || !project_id) {
      return NextResponse.json({ error: "Missing id or project_id" }, { status: 400 });
    }
    const entry: FeedEntry = {
      id,
      project_id,
      agent: agent || "atlas",
      action: entryAction || "",
      timestamp: body.timestamp || new Date().toISOString(),
      link: link || "",
      category: category || "general",
    };
    const feed = await getFeed();
    feed.push(entry);
    // Keep last 500 entries max
    if (feed.length > 500) feed.splice(0, feed.length - 500);
    await kv.set(KV_FEED, feed);
    return NextResponse.json(entry, { status: 201 });
  }

  if (action === "suggestions-set") {
    const { project_id, suggestions } = body;
    if (!project_id || !Array.isArray(suggestions)) {
      return NextResponse.json({ error: "Missing project_id or suggestions array" }, { status: 400 });
    }
    const all = await getSuggestions();
    // Replace suggestions for this project
    const others = all.filter((s) => s.project_id !== project_id);
    const now = new Date().toISOString();
    const newSuggestions = suggestions.map((s: Suggestion) => ({
      ...s,
      project_id,
      updated_at: now,
    }));
    const merged = [...others, ...newSuggestions];
    await kv.set(KV_SUGGESTIONS, merged);
    return NextResponse.json(newSuggestions);
  }

  return NextResponse.json({ error: "Unknown action. Use: feed-list, feed-add, suggestions-list, suggestions-set" }, { status: 400 });
}
