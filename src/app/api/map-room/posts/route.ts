import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:posts";
const TOKEN = "apex-live-2026";

interface Post {
  id: string;
  platform: "instagram" | "tiktok" | "reddit" | "x" | "youtube";
  project_id: string;
  hook: string;
  angle: string;
  cta_type: "hard" | "soft" | "value-only" | "engagement";
  owner: string;
  status: "planned" | "drafted" | "reviewed" | "scheduled" | "posted" | "analyzed";
  reviewed: boolean;
  posted: boolean;
  post_url: string;
  performance: string;
  created_at: string;
  updated_at: string;
}

interface PostsData {
  items: Post[];
  lastUpdated: string;
}

const SEED: PostsData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      id: "post-001",
      platform: "instagram",
      project_id: "caliber",
      hook: "This peptide reverses 10 years of joint damage",
      angle: "Education -- BPC-157 mechanism of action",
      cta_type: "soft",
      owner: "Atlas",
      status: "posted",
      reviewed: true,
      posted: true,
      post_url: "https://instagram.com/p/example1",
      performance: "1,247 reach | 89 saves | 4.2% engagement",
      created_at: "2026-03-25T10:00:00Z",
      updated_at: "2026-03-27T14:00:00Z",
    },
    {
      id: "post-002",
      platform: "instagram",
      project_id: "caliber",
      hook: "Why your gym recovery takes 3x longer than it should",
      angle: "Pain point -- slow recovery without peptides",
      cta_type: "value-only",
      owner: "Atlas",
      status: "reviewed",
      reviewed: true,
      posted: false,
      post_url: "",
      performance: "",
      created_at: "2026-03-28T09:00:00Z",
      updated_at: "2026-03-29T16:00:00Z",
    },
    {
      id: "post-003",
      platform: "tiktok",
      project_id: "caliber",
      hook: "3 signs your body is begging for this peptide",
      angle: "Listicle -- symptoms TB-500 addresses",
      cta_type: "engagement",
      owner: "Atlas",
      status: "drafted",
      reviewed: false,
      posted: false,
      post_url: "",
      performance: "",
      created_at: "2026-03-29T15:00:00Z",
      updated_at: "2026-03-29T15:00:00Z",
    },
    {
      id: "post-004",
      platform: "tiktok",
      project_id: "caliber",
      hook: "Stop wasting money on peptides that don't work",
      angle: "Contrarian -- quality vs cheap suppliers",
      cta_type: "hard",
      owner: "Ginge",
      status: "planned",
      reviewed: false,
      posted: false,
      post_url: "",
      performance: "",
      created_at: "2026-03-30T08:00:00Z",
      updated_at: "2026-03-30T08:00:00Z",
    },
  ],
};

async function getData(): Promise<PostsData> {
  const cached = await kv.get<PostsData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
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

  const body = await req.json();
  const data = await getData();
  const now = new Date().toISOString();

  const item: Post = {
    id: Date.now().toString(36),
    ...body,
    created_at: body.created_at || now,
    updated_at: now,
  };

  data.items.push(item);
  data.lastUpdated = now;
  await kv.set(KV_KEY, data);
  return NextResponse.json(item, { status: 201 });
}
