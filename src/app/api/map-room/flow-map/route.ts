import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:flow-map";

interface FlowNode {
  id: string;
  name: string;
  type: "task" | "prompt" | "output" | "review" | "decision";
  stage: number;
  project_id: string;
  owner: string;
  status: "not-started" | "in-progress" | "completed" | "waiting-founder" | "blocked" | "failed" | "winner";
  source: string;
  prompt_id?: string;
  output_id?: string;
  review_id?: string;
  next_node_id?: string;
  requires_founder_action: boolean;
  worked_state: "worked" | "failed" | "unknown" | "winner";
  blocker?: string;
  notes?: string;
  prompt_text?: string;
  output_text?: string;
  review_score?: number;
  review_notes?: string;
  decision_notes?: string;
  last_updated: string;
}

interface FlowMapData {
  nodes: FlowNode[];
  lastUpdated: string;
}

const SEED: FlowMapData = {
  lastUpdated: "2026-04-01T08:00:00Z",
  nodes: [
    // ── CALIBER PEPTIDES: Stage 4 Traffic ──
    // Chain 1: Research → Copy → Quality Gate → Images → Publish
    {
      id: "cal-t1", name: "Peptide Research Brief", type: "task", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "stage", next_node_id: "cal-p1",
      requires_founder_action: false, worked_state: "worked",
      notes: "Research BPC-157 thoroughly with citations",
      last_updated: "2026-03-28T10:00:00Z",
    },
    {
      id: "cal-p1", name: "Research Prompt v2", type: "prompt", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "manual", next_node_id: "cal-o1",
      requires_founder_action: false, worked_state: "worked",
      prompt_text: "You are a world-class biochemistry researcher. Research [PEPTIDE NAME] thoroughly. Cover: mechanism of action with citations, clinical trial data, dosing protocols from community sources, UK competitor pricing, market trend analysis. Output a structured brief with sections: Overview, Key Findings (numbered), Dosing Protocols, Competitor Pricing, Content Strategy Recommendations, Sources (verified URLs). Every claim must have a source.",
      last_updated: "2026-03-28T10:00:00Z",
    },
    {
      id: "cal-o1", name: "BPC-157 Research Brief", type: "output", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "agent", next_node_id: "cal-r1",
      requires_founder_action: false, worked_state: "worked",
      output_text: "Comprehensive 2,400-word brief with 7 cited sources. Covers: mechanism of action (gastric pentadecapeptide), 4 clinical studies, community dosing protocols (250-500mcg SC), UK competitor pricing (£28-£45/5mg), 4 content angles identified.",
      last_updated: "2026-03-28T11:00:00Z",
    },
    {
      id: "cal-r1", name: "Research Quality Review", type: "review", stage: 1, project_id: "caliber",
      owner: "Darwin", status: "completed", source: "agent", next_node_id: "cal-d1",
      requires_founder_action: false, worked_state: "worked",
      review_score: 8.5, review_notes: "All 7 sources verified. Dosing data from credible forums. Competitor pricing current. 4 strong content angles. Minor: add one more UK-specific competitor.",
      last_updated: "2026-03-28T11:30:00Z",
    },
    {
      id: "cal-d1", name: "Proceed to Carousel", type: "decision", stage: 1, project_id: "caliber",
      owner: "Atlas", status: "completed", source: "agent", next_node_id: "cal-t2",
      requires_founder_action: false, worked_state: "worked",
      decision_notes: "Research scored 8.5/10. Approved for carousel generation. Using content angle: 'Your body makes this peptide — most people don't have enough.'",
      last_updated: "2026-03-28T12:00:00Z",
    },
    {
      id: "cal-t2", name: "Generate Carousel Copy", type: "task", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "failed", source: "stage", next_node_id: "cal-p2",
      requires_founder_action: false, worked_state: "failed",
      blocker: "Copy scored 6.5/10 — hook too long, CTA not approved format",
      last_updated: "2026-03-30T06:00:00Z",
    },
    {
      id: "cal-p2", name: "Carousel Copy Prompt v3", type: "prompt", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "completed", source: "manual", next_node_id: "cal-o2",
      requires_founder_action: false, worked_state: "unknown",
      prompt_text: "You are the #1 scientific copywriter specializing in peptide education. Write a 7-slide Instagram carousel about [PEPTIDE NAME] using this research brief. Slide 1: Hook + peptide name (6 words max, curiosity gap). Slides 2-6: Educational content using research data. Slide 7: CTA — must be one of: 'DM us [KEYWORD] for the Peptide Bible' OR 'Link in bio'. Caption: Open with bold statement, educational tone, 3-5 hashtags including #CaliberPeptides.",
      last_updated: "2026-03-30T05:00:00Z",
    },
    {
      id: "cal-o2", name: "BPC-157 Carousel Copy v3", type: "output", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "failed", source: "agent", next_node_id: "cal-r2",
      requires_founder_action: false, worked_state: "failed",
      output_text: "7-slide carousel generated. Hook: 'Your body already makes this healing peptide but here's why you don't have enough' (15 words — FAILED, max 6). CTA: 'Shop now at caliberpeptides.com' (FAILED — not approved format).",
      last_updated: "2026-03-30T06:00:00Z",
    },
    {
      id: "cal-r2", name: "Carousel Quality Gate", type: "review", stage: 4, project_id: "caliber",
      owner: "Darwin", status: "completed", source: "agent", next_node_id: "cal-d2",
      requires_founder_action: false, worked_state: "failed",
      review_score: 6.5, review_notes: "INSTANT REJECT: Hook 15 words (max 6). CTA not approved format ('Shop now' not in approved list). Strengths: good educational content, correct teal branding. Must fix hook and CTA before re-review.",
      last_updated: "2026-03-30T06:30:00Z",
    },
    {
      id: "cal-d2", name: "Rewrite Required", type: "decision", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "in-progress", source: "agent", next_node_id: "cal-t2",
      requires_founder_action: false, worked_state: "unknown",
      decision_notes: "Carousel copy failed quality gate. Looping back to Generate Carousel Copy task. Atlas to rewrite with hook under 6 words and approved CTA.",
      last_updated: "2026-03-30T07:00:00Z",
    },

    // ── GEMSNAP: Stage 5 Conversion ──
    {
      id: "gem-t1", name: "Analyze Funnel Drop-Off", type: "task", stage: 5, project_id: "gemsnap",
      owner: "Atlas", status: "completed", source: "stage", next_node_id: "gem-p1",
      requires_founder_action: false, worked_state: "worked",
      last_updated: "2026-03-29T09:00:00Z",
    },
    {
      id: "gem-p1", name: "Funnel Analysis Prompt v1", type: "prompt", stage: 5, project_id: "gemsnap",
      owner: "Atlas", status: "completed", source: "manual", next_node_id: "gem-o1",
      requires_founder_action: false, worked_state: "worked",
      prompt_text: "Using PostHog session data, analyze the GemSnap funnel: landing page views → question answered → checkout initiated → payment completed. Calculate drop-off rate at each stage. Identify biggest leak. Generate 3 hypotheses for why they drop off. Recommend 1 immediate A/B test.",
      last_updated: "2026-03-29T09:00:00Z",
    },
    {
      id: "gem-o1", name: "Funnel Analysis Report", type: "output", stage: 5, project_id: "gemsnap",
      owner: "Atlas", status: "completed", source: "agent", next_node_id: "gem-d1",
      requires_founder_action: false, worked_state: "worked",
      output_text: "Checkout is biggest leak (62% drop-off). Hypothesis 1: price reveal too late — users don't see cost until checkout. Hypothesis 2: trust signals missing at checkout. Hypothesis 3: too many form fields. Recommended A/B test: show price on question page (variant B).",
      last_updated: "2026-03-29T10:00:00Z",
    },
    {
      id: "gem-d1", name: "Run A/B Test", type: "decision", stage: 5, project_id: "gemsnap",
      owner: "Ginge", status: "completed", source: "founder", next_node_id: "gem-t2",
      requires_founder_action: false, worked_state: "worked",
      decision_notes: "Approved: show price on question page. Deploy as variant B with 50/50 split via PostHog feature flag. Hold ad spend at $10/day until test concludes (~April 6).",
      last_updated: "2026-03-30T08:00:00Z",
    },
    {
      id: "gem-t2", name: "Implement A/B Test Variant", type: "task", stage: 5, project_id: "gemsnap",
      owner: "Claude Code", status: "completed", source: "decision", next_node_id: "gem-t3",
      requires_founder_action: false, worked_state: "worked",
      notes: "Variant B deployed with early price reveal. Feature flag active, 50/50 split running.",
      last_updated: "2026-03-30T08:30:00Z",
    },
    {
      id: "gem-t3", name: "Scale Ad Spend Decision", type: "task", stage: 5, project_id: "gemsnap",
      owner: "Ginge", status: "waiting-founder", source: "stage", next_node_id: undefined,
      requires_founder_action: true, worked_state: "unknown",
      blocker: "A/B test still running — need results before scaling. ROAS currently 1.4x at $10/day.",
      notes: "Review after April 6 when test has statistical significance.",
      last_updated: "2026-03-31T07:00:00Z",
    },

    // ── EDGE AUTO: Stage 2 Design ──
    {
      id: "edge-t1", name: "Build Audit Report Page", type: "task", stage: 2, project_id: "edge-auto",
      owner: "Claude Code", status: "blocked", source: "stage", next_node_id: "edge-p1",
      requires_founder_action: false, worked_state: "unknown",
      blocker: "Design spec not finalised — need 9-section layout approval from Ginge",
      last_updated: "2026-03-30T14:00:00Z",
    },
    {
      id: "edge-p1", name: "Audit Report Prompt v1", type: "prompt", stage: 2, project_id: "edge-auto",
      owner: "Atlas", status: "completed", source: "manual", next_node_id: "edge-o1",
      requires_founder_action: false, worked_state: "worked",
      prompt_text: "You are the world's best automation strategist for small businesses. Given this business profile: [employees, hours/week manual work, hourly rate, revenue], generate a personalized automation audit. Calculate annual loss to manual work. Identify 5 specific automation opportunities. Estimate savings per opportunity. Show DIY complexity. Present the done-for-you offer (£4,000 flat, 4-week implementation). Include guarantee: £12K minimum savings or free.",
      last_updated: "2026-03-29T14:00:00Z",
    },
    {
      id: "edge-o1", name: "Sample Audit Report", type: "output", stage: 2, project_id: "edge-auto",
      owner: "Atlas", status: "completed", source: "agent", next_node_id: "edge-r1",
      requires_founder_action: false, worked_state: "worked",
      output_text: "9/10 — strong report. 5 automations identified: invoice processing (£4.2K/yr), lead follow-up (£3.8K/yr), appointment scheduling (£2.1K/yr), report generation (£5.2K/yr), stock alerts (£2.7K/yr). Total projected savings: £18K/yr.",
      last_updated: "2026-03-29T15:00:00Z",
    },
    {
      id: "edge-r1", name: "Report Quality Check", type: "review", stage: 2, project_id: "edge-auto",
      owner: "Darwin", status: "completed", source: "agent", next_node_id: "edge-d1",
      requires_founder_action: false, worked_state: "worked",
      review_score: 9, review_notes: "Strong report. Savings projections realistic. Guarantee clearly stated. Tone is consultant not salesman. Ready for client-facing use.",
      last_updated: "2026-03-29T16:00:00Z",
    },
    {
      id: "edge-d1", name: "Approve Report Template", type: "decision", stage: 2, project_id: "edge-auto",
      owner: "Ginge", status: "waiting-founder", source: "review", next_node_id: "edge-t2",
      requires_founder_action: true, worked_state: "unknown",
      decision_notes: "Report template scored 9/10. Needs founder sign-off on: 1) guarantee wording, 2) pricing structure, 3) page design direction. Todd demo target: April 3.",
      last_updated: "2026-03-30T10:00:00Z",
    },
    {
      id: "edge-t2", name: "Client Onboarding Call", type: "task", stage: 2, project_id: "edge-auto",
      owner: "Ginge", status: "not-started", source: "stage", next_node_id: undefined,
      requires_founder_action: true, worked_state: "unknown",
      notes: "30-min call with Todd. Blocked until report page is approved and built.",
      last_updated: "2026-03-30T10:00:00Z",
    },

    // ── CALIBER: Winning path (past) ──
    {
      id: "cal-win-t1", name: "Extract Pain Signals", type: "task", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "stage", next_node_id: "cal-win-p1",
      requires_founder_action: false, worked_state: "worked",
      last_updated: "2026-03-15T10:00:00Z",
    },
    {
      id: "cal-win-p1", name: "Demand Signal Prompt v1", type: "prompt", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "manual", next_node_id: "cal-win-o1",
      requires_founder_action: false, worked_state: "worked",
      prompt_text: "Analyze r/peptides, r/biohacking, and peptide forums. Extract: top 10 pain points people mention, exact language they use, questions asked about BPC-157. Output as a Pain Language Bank grouped by theme.",
      last_updated: "2026-03-15T10:00:00Z",
    },
    {
      id: "cal-win-o1", name: "Pain Language Bank", type: "output", stage: 1, project_id: "caliber",
      owner: "Newton", status: "completed", source: "agent", next_node_id: "cal-win-r1",
      requires_founder_action: false, worked_state: "worked",
      output_text: "42 pain signals extracted across 3 themes: gut healing (18), injury recovery (14), general wellness (10). Top phrase: 'tired of spending money on peptides that don't work'. Strong demand signal for education-first content.",
      last_updated: "2026-03-15T12:00:00Z",
    },
    {
      id: "cal-win-r1", name: "Pain Bank Quality Review", type: "review", stage: 1, project_id: "caliber",
      owner: "Darwin", status: "completed", source: "agent", next_node_id: "cal-win-d1",
      requires_founder_action: false, worked_state: "worked",
      review_score: 8.5, review_notes: "Strong extraction. Language is authentic and usable. Themes well-categorised. Ready for hook generation.",
      last_updated: "2026-03-15T13:00:00Z",
    },
    {
      id: "cal-win-d1", name: "Proceed to Hook Generation", type: "decision", stage: 1, project_id: "caliber",
      owner: "Atlas", status: "completed", source: "review", next_node_id: "cal-win-t2",
      requires_founder_action: false, worked_state: "worked",
      decision_notes: "Pain bank approved. Use 'gut healing' theme for first carousel batch. Generate hooks using exact customer language.",
      last_updated: "2026-03-15T14:00:00Z",
    },
    {
      id: "cal-win-t2", name: "Generate Hooks", type: "task", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "completed", source: "decision", next_node_id: "cal-win-o2",
      requires_founder_action: false, worked_state: "winner",
      last_updated: "2026-03-16T10:00:00Z",
    },
    {
      id: "cal-win-o2", name: "12 Hook Variants", type: "output", stage: 4, project_id: "caliber",
      owner: "Atlas", status: "completed", source: "agent", next_node_id: undefined,
      requires_founder_action: false, worked_state: "winner",
      output_text: "12 hooks generated. Top performers: 'Your body makes this peptide.' (4.2% engagement), 'The peptide doctors won't talk about.' (3.8% engagement). 2 selected for carousel production.",
      last_updated: "2026-03-16T11:00:00Z",
    },
  ],
};

async function getData(): Promise<FlowMapData> {
  const cached = await kv.get<FlowMapData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}
