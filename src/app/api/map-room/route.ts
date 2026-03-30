import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:map-room";
const TOKEN = "apex-live-2026";

export interface MapTask {
  id: string;
  name: string;
  project_id: string;
  stage: string;
  owner: string;
  model: string;
  timing: string;
  mega_prompt: string;
  success_criteria: string[];
  dependencies_input: string[];
  dependencies_output: string[];
  last_run: string | null;
  last_result: string;
  execution_count: number;
  status: "on-track" | "at-risk" | "blocked";
  editable: boolean;
  self_trigger: boolean;
}

export interface MapProject {
  id: string;
  name: string;
  current_stage: string;
  blocker: string;
  tasks: MapTask[];
}

interface MapRoomData {
  projects: MapProject[];
  lastUpdated: string;
}

const SEED_DATA: MapRoomData = {
  lastUpdated: "2026-03-30T14:20:00Z",
  projects: [
    {
      id: "caliber",
      name: "Caliber Peptides",
      current_stage: "research",
      blocker: "Carousel copy scoring 6.5/10 — needs stronger hooks and approved CTAs",
      tasks: [
        {
          id: "cal-001",
          name: "Peptide Research Brief",
          project_id: "caliber",
          stage: "research",
          owner: "Newton",
          model: "gemini-2.5-pro",
          timing: "on-demand",
          mega_prompt: `You are a world-class biochemistry researcher. Research [PEPTIDE NAME] thoroughly. Cover: mechanism of action with citations, clinical trial data, dosing protocols from community sources, UK competitor pricing, market trend analysis. Output a structured brief with sections: Overview, Key Findings (numbered), Dosing Protocols, Competitor Pricing, Content Strategy Recommendations, Sources (verified URLs). Every claim must have a source.`,
          success_criteria: ["Minimum 5 cited sources", "Dosing data included", "Competitor prices checked"],
          dependencies_input: [],
          dependencies_output: ["cal-002"],
          last_run: "2026-03-28T10:00:00Z",
          last_result: "8.5/10 — comprehensive brief with 7 sources, dosing protocols included",
          execution_count: 4,
          status: "on-track",
          editable: true,
          self_trigger: false,
        },
        {
          id: "cal-002",
          name: "Research Quality Review",
          project_id: "caliber",
          stage: "research",
          owner: "Darwin",
          model: "claude-haiku",
          timing: "on-demand",
          mega_prompt: `Review this research brief for accuracy, completeness, and content-readiness. Check: Are all sources real URLs? Are dosing protocols from credible community sources? Is competitor pricing current? Are there at least 3 strong content angles? Rate 1-10. If <8, specify what's missing.`,
          success_criteria: ["All sources verified", "Rating 8/10+", "Content angles identified"],
          dependencies_input: ["cal-001"],
          dependencies_output: ["cal-003"],
          last_run: "2026-03-28T11:30:00Z",
          last_result: "8/10 — all sources verified, 4 content angles identified",
          execution_count: 4,
          status: "on-track",
          editable: true,
          self_trigger: false,
        },
        {
          id: "cal-003",
          name: "Generate Carousel Copy",
          project_id: "caliber",
          stage: "content-creation",
          owner: "Atlas",
          model: "claude-sonnet",
          timing: "2x-per-week",
          mega_prompt: `You are the #1 scientific copywriter specializing in peptide education. Write a 7-slide Instagram carousel about [PEPTIDE NAME] using this research brief. Slide 1: Hook + peptide name (6 words max, curiosity gap). Slides 2-6: Educational content using research data. Slide 7: CTA — must be one of: 'DM us [KEYWORD] for the Peptide Bible' OR 'Link in bio'. Caption: Open with bold statement, educational tone, 3-5 hashtags including #CaliberPeptides. Include image generation prompts for each slide using this aesthetic: dark teal #0a1a1e background, white bold caps text, teal accent #00d4d4, Caliber Peptides watermark bottom-right, cinematic product photography style.`,
          success_criteria: ["Hook under 6 words", "Peptide name on slide 1", "Approved CTA only", "Image prompts included"],
          dependencies_input: ["cal-002"],
          dependencies_output: ["cal-004"],
          last_run: "2026-03-30T06:00:00Z",
          last_result: "6.5/10 (needs improvement — hook too long, CTA not approved format)",
          execution_count: 3,
          status: "at-risk",
          editable: true,
          self_trigger: false,
        },
        {
          id: "cal-004",
          name: "Carousel Quality Gate",
          project_id: "caliber",
          stage: "content-creation",
          owner: "Darwin",
          model: "claude-haiku",
          timing: "on-demand",
          mega_prompt: `Review this carousel against the Caliber content checklist. Check every item: Background deep teal? Logo watermark present? White bold caps text? Teal accent colour used? Peptide name on cover slide? Hook under 6 words? CTA is approved format only (DM keyword or link in bio)? No medical claims? 3-5 hashtags? Rate 1-10. INSTANT REJECT if: no peptide name on cover, unapproved CTA, medical claim. Output: RATING, STRENGTHS, GAP, FIX, APPROVED Yes/No.`,
          success_criteria: ["No instant-reject triggers", "Rating 8/10+", "All checklist items pass"],
          dependencies_input: ["cal-003"],
          dependencies_output: ["cal-005"],
          last_run: null,
          last_result: "Awaiting carousel copy v4",
          execution_count: 0,
          status: "blocked",
          editable: true,
          self_trigger: false,
        },
        {
          id: "cal-005",
          name: "Generate Carousel Images",
          project_id: "caliber",
          stage: "content-creation",
          owner: "Atlas",
          model: "dall-e/midjourney",
          timing: "on-demand",
          mega_prompt: `Generate 7 Instagram carousel images (1080x1080) using these prompts. Every image must have: dark teal background #0a1a1e, white bold all-caps text overlay, teal accent #00d4d4 on key words, Caliber Peptides logo watermark bottom-right. Product shots use: 'Single dark glass pharmaceutical vial, white printed label clearly reading [PEPTIDE] [DOSE], CALIBER brand below, teal LED rim light on dark polished stone surface, ultra shallow depth of field, cinematic product photography, 4K sharp'`,
          success_criteria: ["All 7 slides generated", "Brand colours correct", "Text legible at thumbnail size"],
          dependencies_input: ["cal-004"],
          dependencies_output: ["cal-006"],
          last_run: null,
          last_result: "Pending quality gate approval",
          execution_count: 0,
          status: "blocked",
          editable: true,
          self_trigger: false,
        },
        {
          id: "cal-006",
          name: "Publish Carousel",
          project_id: "caliber",
          stage: "content-creation",
          owner: "Atlas",
          model: "meta-graph-api",
          timing: "on-demand",
          mega_prompt: `Publish the approved carousel to Instagram account 17841443094144184 using the Graph API. Post all slides as a carousel container. Include the approved caption. Schedule for optimal time (07:00-09:00 or 18:00-20:00 Manila time). Verify post is live and log the post ID.`,
          success_criteria: ["Post live on IG", "All slides present", "Caption correct", "Post ID logged"],
          dependencies_input: ["cal-005"],
          dependencies_output: [],
          last_run: null,
          last_result: "Pending image generation",
          execution_count: 0,
          status: "blocked",
          editable: true,
          self_trigger: false,
        },
      ],
    },
    {
      id: "edge-auto",
      name: "Edge Auto",
      current_stage: "mvp-build",
      blocker: "Client onboarding call not yet scheduled — need to confirm availability",
      tasks: [
        {
          id: "edge-001",
          name: "Generate Audit Report",
          project_id: "edge-auto",
          stage: "mvp-build",
          owner: "Atlas",
          model: "claude-sonnet",
          timing: "on-demand",
          mega_prompt: `You are the world's best automation strategist for small businesses. Given this business profile: [employees, hours/week manual work, hourly rate, revenue], generate a personalized automation audit. Calculate annual loss to manual work. Identify 5 specific automation opportunities. Estimate savings per opportunity. Show DIY complexity. Present the done-for-you offer (£4,000 flat, 4-week implementation). Include guarantee: £12K minimum savings or free. Tone: consultant, not salesman. Data-driven.`,
          success_criteria: ["5 automations identified", "Savings calculated", "Guarantee included"],
          dependencies_input: [],
          dependencies_output: ["edge-002"],
          last_run: "2026-03-29T14:00:00Z",
          last_result: "9/10 — strong report, 5 automations with £18K projected savings",
          execution_count: 2,
          status: "on-track",
          editable: true,
          self_trigger: false,
        },
        {
          id: "edge-002",
          name: "Build Client Website",
          project_id: "edge-auto",
          stage: "mvp-build",
          owner: "Claude Code",
          model: "claude-sonnet",
          timing: "on-demand",
          mega_prompt: `Build a modern Next.js website for [CLIENT BUSINESS]. Requirements: responsive, fast (<1s LCP), contact form with email delivery via Resend, SEO meta tags, professional design. Deploy to Vercel. Test contact form end-to-end.`,
          success_criteria: ["Deployed to Vercel", "Contact form working", "LCP under 1 second"],
          dependencies_input: ["edge-001"],
          dependencies_output: ["edge-003"],
          last_run: null,
          last_result: "Awaiting client confirmation",
          execution_count: 0,
          status: "at-risk",
          editable: true,
          self_trigger: false,
        },
        {
          id: "edge-003",
          name: "Client Onboarding",
          project_id: "edge-auto",
          stage: "mvp-build",
          owner: "Ginge",
          model: "human",
          timing: "on-demand",
          mega_prompt: `30-min onboarding call. Identify top 3 pain points. Agree on ONE priority automation. Define success metric (hours saved/leads captured). Confirm all access needed. Send written brief: what we build, what we don't, success criteria.`,
          success_criteria: ["One automation agreed", "Success metric defined", "Written brief sent"],
          dependencies_input: ["edge-002"],
          dependencies_output: ["edge-004"],
          last_run: null,
          last_result: "Not yet scheduled",
          execution_count: 0,
          status: "blocked",
          editable: true,
          self_trigger: false,
        },
        {
          id: "edge-004",
          name: "Build & Deploy Automation",
          project_id: "edge-auto",
          stage: "mvp-build",
          owner: "Atlas",
          model: "n8n",
          timing: "on-demand",
          mega_prompt: `Build the agreed automation in n8n. Internal test: runs without errors. Demo to client. Deploy to live. Document what it does and how to manage it. Measure baseline vs automated: time saved.`,
          success_criteria: ["Automation runs error-free", "Client has seen demo", "Baseline measured"],
          dependencies_input: ["edge-003"],
          dependencies_output: [],
          last_run: null,
          last_result: "Pending onboarding",
          execution_count: 0,
          status: "blocked",
          editable: true,
          self_trigger: false,
        },
      ],
    },
    {
      id: "gemsnap",
      name: "GemSnap",
      current_stage: "review-optimize",
      blocker: "Funnel drop-off at checkout — 62% abandon rate, need A/B test",
      tasks: [
        {
          id: "gem-001",
          name: "Analyze Funnel Drop-Off",
          project_id: "gemsnap",
          stage: "review-optimize",
          owner: "Atlas",
          model: "claude-sonnet",
          timing: "weekly",
          mega_prompt: `Using PostHog session data, analyze the GemSnap funnel: landing page views → question answered → checkout initiated → payment completed. Calculate drop-off rate at each stage. Identify biggest leak. Generate 3 hypotheses for why they drop off. Recommend 1 immediate A/B test.`,
          success_criteria: ["Drop-off rates calculated", "Biggest leak identified", "A/B test recommended"],
          dependencies_input: [],
          dependencies_output: ["gem-002"],
          last_run: "2026-03-29T09:00:00Z",
          last_result: "Checkout is biggest leak (62% drop-off). Hypothesis: price reveal too late. Recommended: show price on question page.",
          execution_count: 3,
          status: "on-track",
          editable: true,
          self_trigger: false,
        },
        {
          id: "gem-002",
          name: "Iterate Landing Page",
          project_id: "gemsnap",
          stage: "review-optimize",
          owner: "Claude Code",
          model: "claude-sonnet",
          timing: "on-demand",
          mega_prompt: `Based on funnel analysis, implement the recommended A/B test variant on the GemSnap landing page. Change only the identified leak point. Deploy as a variant. Set up PostHog feature flag for 50/50 split.`,
          success_criteria: ["Variant deployed", "Feature flag active", "50/50 split confirmed"],
          dependencies_input: ["gem-001"],
          dependencies_output: ["gem-003"],
          last_run: "2026-03-30T08:00:00Z",
          last_result: "Variant B deployed with early price reveal. Feature flag active, 50/50 split running.",
          execution_count: 1,
          status: "on-track",
          editable: true,
          self_trigger: false,
        },
        {
          id: "gem-003",
          name: "Scale Ad Spend",
          project_id: "gemsnap",
          stage: "review-optimize",
          owner: "Ginge",
          model: "meta-ads",
          timing: "daily",
          mega_prompt: `Review GemSnap ad performance. Current: $10/day. If ROAS > 2x, increase to $25/day. If ROAS > 3x, increase to $50/day. If ROAS < 1x, pause and diagnose. Check: CPC, CTR, conversion rate, cost per acquisition.`,
          success_criteria: ["ROAS calculated", "Spend decision made", "Metrics logged"],
          dependencies_input: ["gem-002"],
          dependencies_output: [],
          last_run: "2026-03-30T07:00:00Z",
          last_result: "ROAS 1.4x — holding at $10/day until A/B test concludes",
          execution_count: 5,
          status: "at-risk",
          editable: true,
          self_trigger: false,
        },
      ],
    },
  ],
};

async function getData(): Promise<MapRoomData> {
  const cached = await kv.get<MapRoomData>(KV_KEY);
  if (cached) return cached;

  await kv.set(KV_KEY, SEED_DATA);
  return SEED_DATA;
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

  const body = (await req.json()) as MapRoomData;
  body.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, body);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, updates } = await req.json();
  const data = await getData();

  for (const project of data.projects) {
    const task = project.tasks.find((t) => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      break;
    }
  }

  data.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, data);
  return NextResponse.json({ ok: true });
}
