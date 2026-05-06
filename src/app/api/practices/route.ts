import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { getAllPractices, getPractice, getPracticesLastUpdated, type Practice } from "@/lib/practices";

const KV_KEY = "apex:practices:v1";

interface PracticesStore {
  items: Practice[];
  lastUpdated: string;
}

const VALID_SOURCES = new Set(["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]);

async function getStore(): Promise<PracticesStore> {
  const cached = await kv.get<PracticesStore>(KV_KEY);
  return cached ?? { items: [], lastUpdated: new Date().toISOString() };
}

async function saveStore(store: PracticesStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  if (action === "list") {
    const items = await getAllPractices();
    const lastUpdated = await getPracticesLastUpdated();
    return NextResponse.json({ items, lastUpdated });
  }

  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const item = await getPractice(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  if (action === "search") {
    const { query, tag, category } = body as { query?: string; tag?: string; category?: string };
    const all = await getAllPractices();
    const q = (query || "").toLowerCase().trim();
    const matches = all.filter((it) => {
      const tags = it.tags ?? [];
      if (tag && !tags.includes(tag)) return false;
      if (category && it.category !== category) return false;
      if (q) {
        const hay = `${it.title} ${it.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return NextResponse.json({ items: matches });
  }

  // Writes require auth
  const unauthorized = requireWriteAuth(req);
  if (unauthorized) return unauthorized;

  if (action === "set") {
    const { title, content, category } = body as { title?: string; content?: string; category?: string };
    if (!title || !content || !category) {
      return NextResponse.json({ error: "title, content, and category are required" }, { status: 400 });
    }
    const tags = Array.isArray(body.tags) ? (body.tags as string[]) : [];
    const scope = typeof body.scope === "string" && body.scope.length > 0 ? body.scope : "all_agents";
    const source = typeof body.source === "string" && VALID_SOURCES.has(body.source) ? body.source : "manual";

    const store = await getStore();
    const now = new Date().toISOString();
    const id = typeof body.id === "string" && body.id.length > 0 ? body.id : `manual-${randomUUID()}`;
    const existing = store.items.find((x) => x.id === id);
    if (existing) {
      existing.title = title;
      existing.content = content;
      existing.category = category;
      existing.tags = tags;
      existing.scope = scope;
      existing.source = source;
      existing.updated_at = now;
      await saveStore(store);
      return NextResponse.json(existing);
    }
    const item: Practice = {
      id,
      category,
      title,
      content,
      tags,
      scope,
      source,
      created_at: now,
      updated_at: now,
    };
    store.items.push(item);
    await saveStore(store);
    return NextResponse.json(item, { status: 201 });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const before = store.items.length;
    store.items = store.items.filter((x) => x.id !== id);
    if (store.items.length === before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, search, set, delete" }, { status: 400 });
}
