import { kv } from "@vercel/kv";

const KV_KEY = "apex:practices:v1";

export interface Practice {
  id: string;
  category: string;
  title: string;
  content: string;
  tags?: string[];
  scope?: string;
  source?: string;
  origin_store?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PracticeFilter {
  category?: string;
  tag?: string;
  source?: string;
  scope?: string;
}

interface PracticeStoreShape {
  items?: Practice[];
  lastUpdated?: string;
}

type RawPractices = Practice[] | PracticeStoreShape | string | null;

async function loadAll(): Promise<{ items: Practice[]; lastUpdated: string }> {
  const raw = (await kv.get(KV_KEY)) as RawPractices;
  if (raw === null || raw === undefined) {
    return { items: [], lastUpdated: new Date().toISOString() };
  }
  let parsed: Practice[] | PracticeStoreShape = raw as Practice[] | PracticeStoreShape;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as Practice[] | PracticeStoreShape;
    } catch (e) {
      throw new Error(`Failed to parse ${KV_KEY} as JSON: ${(e as Error).message}`);
    }
  }
  if (Array.isArray(parsed)) {
    return { items: parsed, lastUpdated: new Date().toISOString() };
  }
  const items = parsed.items ?? [];
  return { items, lastUpdated: parsed.lastUpdated ?? new Date().toISOString() };
}

export async function getAllPractices(filter?: PracticeFilter): Promise<Practice[]> {
  const { items } = await loadAll();
  let result = items;
  if (filter?.category) result = result.filter((p) => p.category === filter.category);
  if (filter?.tag) result = result.filter((p) => Array.isArray(p.tags) && p.tags.includes(filter.tag!));
  if (filter?.source) result = result.filter((p) => p.source === filter.source);
  if (filter?.scope) result = result.filter((p) => p.scope === filter.scope);
  return result;
}

export async function getPractice(id: string): Promise<Practice | null> {
  if (!id) return null;
  const { items } = await loadAll();
  return items.find((p) => p.id === id) ?? null;
}

export async function getPracticesLastUpdated(): Promise<string> {
  const { lastUpdated } = await loadAll();
  return lastUpdated;
}
