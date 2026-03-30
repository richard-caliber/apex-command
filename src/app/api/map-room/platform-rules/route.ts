import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:platform-rules";
const TOKEN = "apex-live-2026";

interface PlatformRule {
  platform: string;
  max_hashtags: number;
  max_caption_length: number;
  ideal_post_times: string[];
  content_rules: string[];
  cta_rules: string[];
  formatting_rules: string[];
  notes: string;
}

interface PlatformRulesData {
  items: PlatformRule[];
  lastUpdated: string;
}

const SEED: PlatformRulesData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  items: [
    {
      platform: "instagram-reels",
      max_hashtags: 5,
      max_caption_length: 2200,
      ideal_post_times: ["07:00-09:00 PHT", "18:00-20:00 PHT"],
      content_rules: [
        "Hook in first 3 seconds -- text overlay required",
        "Max 60 seconds for Reels, 90 seconds if tutorial format",
        "No medical claims -- educational only",
        "Must include Caliber Peptides watermark on all frames",
        "Background must be dark teal #0a1a1e or darker",
        "Text overlays: white bold all-caps, teal accent #00d4d4 on keywords",
      ],
      cta_rules: [
        "Approved CTAs only: 'DM us [KEYWORD] for the Peptide Bible' or 'Link in bio'",
        "No 'Buy now' or direct sales language",
        "Soft CTA preferred for educational content",
        "Hard CTA only for promotional posts (max 1 per week)",
      ],
      formatting_rules: [
        "Aspect ratio: 9:16 for Reels, 1:1 for carousels",
        "Caption: Bold opening statement, educational body, 3-5 hashtags",
        "Always include #CaliberPeptides",
        "Tag location: United Kingdom",
        "No competitor mentions in captions",
      ],
      notes: "Instagram is the primary platform for Caliber. Focus on educational carousels and Reels. Aim for 3 posts per week minimum.",
    },
    {
      platform: "instagram-carousel",
      max_hashtags: 5,
      max_caption_length: 2200,
      ideal_post_times: ["07:00-09:00 PHT", "12:00-13:00 PHT", "18:00-20:00 PHT"],
      content_rules: [
        "Exactly 7 slides per carousel",
        "Slide 1: Hook + peptide name (6 words max)",
        "Slides 2-6: Educational content with data",
        "Slide 7: CTA slide",
        "Consistent brand colours across all slides",
        "Peptide name must appear on cover slide",
      ],
      cta_rules: [
        "Slide 7 CTA: 'DM us [KEYWORD] for the Peptide Bible' or 'Link in bio'",
        "Caption CTA should match slide 7 CTA",
      ],
      formatting_rules: [
        "1080x1080 per slide",
        "Dark teal background #0a1a1e",
        "White bold all-caps text",
        "Teal accent #00d4d4 on key words",
        "Caliber Peptides logo watermark bottom-right",
      ],
      notes: "Carousels are highest-performing format. Average 450 reach per carousel. Must pass quality gate (8/10+) before publishing.",
    },
    {
      platform: "tiktok",
      max_hashtags: 5,
      max_caption_length: 4000,
      ideal_post_times: ["11:00-13:00 PHT", "19:00-21:00 PHT"],
      content_rules: [],
      cta_rules: [],
      formatting_rules: [],
      notes: "TikTok strategy still being defined. Placeholder rules -- to be filled after first 10 posts and performance review.",
    },
    {
      platform: "x",
      max_hashtags: 2,
      max_caption_length: 280,
      ideal_post_times: [],
      content_rules: [],
      cta_rules: [],
      formatting_rules: [],
      notes: "Not actively posting on X yet. Placeholder for future use.",
    },
    {
      platform: "youtube",
      max_hashtags: 15,
      max_caption_length: 5000,
      ideal_post_times: [],
      content_rules: [],
      cta_rules: [],
      formatting_rules: [],
      notes: "Not actively posting on YouTube yet. Placeholder for future use.",
    },
  ],
};

async function getData(): Promise<PlatformRulesData> {
  const cached = await kv.get<PlatformRulesData>(KV_KEY);
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
  const data: PlatformRulesData = {
    items: body.items || body,
    lastUpdated: new Date().toISOString(),
  };
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
