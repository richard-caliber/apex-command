import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:pipeline-tasks";
const TOKEN = "apex-live-2026";

/* ── Schema ── */
interface PipelineTask {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description: string;
  status: "not_started" | "in_progress" | "done" | "blocked" | "skipped";
  automation: "manual" | "semi-auto" | "fully-auto";
  owner: string;
  model: string;
  prompt_id: string;
  output: string;
  quality_gate: string;
  blocker: string | null;
  next_task: string;
  order: number;
  created_at: string;
  updated_at: string;
}

interface TaskStore {
  tasks: PipelineTask[];
  lastUpdated: string;
}

const VALID_STAGES = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];
const VALID_STATUSES = ["not_started", "in_progress", "done", "blocked", "skipped"];
const VALID_AUTOMATION = ["manual", "semi-auto", "fully-auto"];

/* ── Seed data — master template + Caliber project tasks ── */
const SEED: TaskStore = {
  lastUpdated: "2026-04-02T00:00:00Z",
  tasks: [
    // ── MASTER TEMPLATE TASKS (project_id = "_template") ──
    { id: "T-0.01", stage: "inbox", project_id: "_template", name: "Capture Idea", description: "Raw ideas need a single capture point", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "T-0.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-0.02", stage: "inbox", project_id: "_template", name: "Tag & Categorise", description: "Categorisation enables prioritisation", status: "not_started", automation: "semi-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-1.01", stage: "idea", project_id: "_template", name: "Write Problem Statement", description: "Forces clarity on what problem we solve", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder approval", blocker: null, next_task: "T-1.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-1.02", stage: "idea", project_id: "_template", name: "Score Opportunity", description: "Quantify potential before investing time", status: "not_started", automation: "semi-auto", owner: "newton", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Score 7+", blocker: null, next_task: "T-1.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-1.03", stage: "idea", project_id: "_template", name: "Kill or Proceed Decision", description: "Gate prevents wasted effort on weak ideas", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder decision", blocker: null, next_task: "", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-2.01", stage: "validation", project_id: "_template", name: "Extract Pain Signals", description: "Real language from real people validates demand", status: "not_started", automation: "fully-auto", owner: "newton", model: "claude-opus-4-6", prompt_id: "P-2.01", output: "", quality_gate: "Darwin 8/10+", blocker: null, next_task: "T-2.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-2.02", stage: "validation", project_id: "_template", name: "Competitor Analysis", description: "Know the landscape before entering it", status: "not_started", automation: "fully-auto", owner: "newton", model: "claude-opus-4-6", prompt_id: "P-2.02", output: "", quality_gate: "", blocker: null, next_task: "T-2.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-2.03", stage: "validation", project_id: "_template", name: "Market Sizing", description: "Size determines if the opportunity is worth pursuing", status: "not_started", automation: "semi-auto", owner: "newton", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Founder review", blocker: null, next_task: "T-2.04", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-2.04", stage: "validation", project_id: "_template", name: "Generate Hooks", description: "Hooks test whether pain translates to attention", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-2.04", output: "", quality_gate: "Darwin selects top 3", blocker: null, next_task: "", order: 4, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-3.01", stage: "design", project_id: "_template", name: "Define User Journey", description: "Map the complete experience before building anything", status: "not_started", automation: "semi-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Founder approval", blocker: null, next_task: "T-3.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-3.02", stage: "design", project_id: "_template", name: "Write Report Template", description: "Personalised reports convert browsers to buyers", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-3.02", output: "", quality_gate: "Darwin 8/10+", blocker: null, next_task: "T-3.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-3.03", stage: "design", project_id: "_template", name: "Build Landing Page", description: "The page IS the product for most businesses", status: "not_started", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "P-3.03", output: "", quality_gate: "<1s LCP", blocker: null, next_task: "", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-4.01", stage: "mvp", project_id: "_template", name: "Define MVP Scope", description: "Scope creep kills MVPs — define the minimum", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder sign-off", blocker: null, next_task: "T-4.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-4.02", stage: "mvp", project_id: "_template", name: "Build Core Feature", description: "Ship the one thing that matters", status: "not_started", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Works end-to-end", blocker: null, next_task: "T-4.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-4.03", stage: "mvp", project_id: "_template", name: "User Test", description: "Real users find real problems", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "5 users tested", blocker: null, next_task: "", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-5.01", stage: "traffic", project_id: "_template", name: "Create Carousel Copy", description: "Carousels drive saves and shares — the growth engine", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-5.01", output: "", quality_gate: "Darwin 8/10+", blocker: null, next_task: "T-5.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-5.02", stage: "traffic", project_id: "_template", name: "Quality Gate Review", description: "Catch weak content before it wastes reach", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "P-5.02", output: "", quality_gate: "8/10+ pass", blocker: null, next_task: "T-5.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-5.03", stage: "traffic", project_id: "_template", name: "Generate Images", description: "Visual content gets 2x engagement vs text-only", status: "not_started", automation: "semi-auto", owner: "atlas", model: "", prompt_id: "", output: "", quality_gate: "Brand check", blocker: null, next_task: "T-5.04", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-5.04", stage: "traffic", project_id: "_template", name: "Publish Content", description: "Consistent publishing builds algorithmic trust", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-5.04", output: "", quality_gate: "Post confirmed", blocker: null, next_task: "T-5.05", order: 4, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-5.05", stage: "traffic", project_id: "_template", name: "Analyze Performance", description: "Data-driven iteration beats guessing", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "T-5.01", order: 5, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-6.01", stage: "conversion", project_id: "_template", name: "Funnel Analysis", description: "Find the biggest leak before optimising", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-6.01", output: "", quality_gate: "", blocker: null, next_task: "T-6.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-6.02", stage: "conversion", project_id: "_template", name: "Design A/B Test", description: "Test before you invest — data beats opinions", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder approval", blocker: null, next_task: "T-6.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-6.03", stage: "conversion", project_id: "_template", name: "Implement Test", description: "Ship the variant fast so data starts flowing", status: "not_started", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Feature flag active", blocker: null, next_task: "T-6.04", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-6.04", stage: "conversion", project_id: "_template", name: "Wait for Results", description: "Statistical significance requires patience", status: "not_started", automation: "fully-auto", owner: "system", model: "", prompt_id: "", output: "", quality_gate: "1000 visitors/variant", blocker: null, next_task: "T-6.05", order: 4, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-6.05", stage: "conversion", project_id: "_template", name: "Scale Decision", description: "Only scale what is proven to work", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder", blocker: null, next_task: "T-6.01", order: 5, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-7.01", stage: "delivery", project_id: "_template", name: "Ship Order", description: "Fast delivery builds trust and repeat business", status: "not_started", automation: "semi-auto", owner: "atlas", model: "", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "T-7.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-7.02", stage: "delivery", project_id: "_template", name: "Collect Feedback", description: "Feedback reveals what metrics miss", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "7-day window", blocker: null, next_task: "T-7.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-7.03", stage: "delivery", project_id: "_template", name: "Review Support Issues", description: "Patterns in complaints reveal systemic problems", status: "not_started", automation: "semi-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Weekly", blocker: null, next_task: "T-7.04", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-7.04", stage: "delivery", project_id: "_template", name: "Improve Onboarding", description: "Better onboarding reduces support load and churn", status: "not_started", automation: "semi-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "T-7.05", order: 4, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-7.05", stage: "delivery", project_id: "_template", name: "Monitor Satisfaction", description: "CSAT is the leading indicator of retention", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Weekly", blocker: null, next_task: "T-7.01", order: 5, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    { id: "T-8.01", stage: "scale", project_id: "_template", name: "Identify Scale Levers", description: "Not everything scales — find what does", status: "not_started", automation: "manual", owner: "newton", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Founder review", blocker: null, next_task: "T-8.02", order: 1, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-8.02", stage: "scale", project_id: "_template", name: "Automate Processes", description: "Automation removes the founder from the critical path", status: "not_started", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "End-to-end test", blocker: null, next_task: "T-8.03", order: 2, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "T-8.03", stage: "scale", project_id: "_template", name: "Monitor & Iterate", description: "Scale breaks things — monitor continuously", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "Weekly review", blocker: null, next_task: "T-8.01", order: 3, created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },

    // ── CALIBER PEPTIDES PROJECT TASKS ──
    { id: "CAL-3.01", stage: "design", project_id: "caliber", name: "Define User Journey", description: "Map complete buyer experience from ad to checkout", status: "done", automation: "semi-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "", output: "User flow: Ad → Landing → Product → Cart → Checkout → Confirmation", quality_gate: "Founder approved", blocker: null, next_task: "CAL-3.02", order: 1, created_at: "2026-03-10T00:00:00Z", updated_at: "2026-03-15T00:00:00Z" },
    { id: "CAL-3.02", stage: "design", project_id: "caliber", name: "Build Landing Page", description: "Create conversion-optimised landing page", status: "done", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "P-3.03", output: "caliberpeptides.health — live, needs conversion pass", quality_gate: "Darwin review: 7/10", blocker: null, next_task: "CAL-4.01", order: 2, created_at: "2026-03-15T00:00:00Z", updated_at: "2026-03-20T00:00:00Z" },

    { id: "CAL-4.01", stage: "mvp", project_id: "caliber", name: "Define MVP Scope", description: "19 products, Stripe checkout, peptide info pages", status: "done", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "Scope locked: 19 products, static checkout, info pages", quality_gate: "Founder sign-off", blocker: null, next_task: "CAL-4.02", order: 1, created_at: "2026-03-16T00:00:00Z", updated_at: "2026-03-18T00:00:00Z" },
    { id: "CAL-4.02", stage: "mvp", project_id: "caliber", name: "Build Core Site", description: "Next.js site with 19 products and Stripe checkout", status: "done", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "", output: "Site live on Vercel — 19 products, working checkout", quality_gate: "Works end-to-end", blocker: null, next_task: "CAL-4.03", order: 2, created_at: "2026-03-18T00:00:00Z", updated_at: "2026-03-22T00:00:00Z" },
    { id: "CAL-4.03", stage: "mvp", project_id: "caliber", name: "User Test", description: "Test order flow with real users", status: "done", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "3 test orders placed successfully", quality_gate: "5 users tested", blocker: null, next_task: "CAL-5.01", order: 3, created_at: "2026-03-22T00:00:00Z", updated_at: "2026-03-25T00:00:00Z" },

    { id: "CAL-5.01", stage: "traffic", project_id: "caliber", name: "Create Carousel Copy", description: "BPC-157 carousel — 7 slides, educational", status: "blocked", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-5.01", output: "", quality_gate: "Darwin 8/10+", blocker: "Copy scored 6.5/10 — hook too long, needs rewrite", next_task: "CAL-5.02", order: 1, created_at: "2026-03-26T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },
    { id: "CAL-5.02", stage: "traffic", project_id: "caliber", name: "Quality Gate Review", description: "Review carousel against quality checklist", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "P-5.02", output: "", quality_gate: "8/10+ pass", blocker: null, next_task: "CAL-5.03", order: 2, created_at: "2026-03-26T00:00:00Z", updated_at: "2026-03-26T00:00:00Z" },
    { id: "CAL-5.03", stage: "traffic", project_id: "caliber", name: "Generate Images", description: "Create carousel images matching brand", status: "not_started", automation: "semi-auto", owner: "atlas", model: "", prompt_id: "", output: "", quality_gate: "Brand check", blocker: null, next_task: "CAL-5.04", order: 3, created_at: "2026-03-26T00:00:00Z", updated_at: "2026-03-26T00:00:00Z" },
    { id: "CAL-5.04", stage: "traffic", project_id: "caliber", name: "Publish Content", description: "Post carousel to Instagram", status: "not_started", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-5.04", output: "", quality_gate: "Post confirmed", blocker: null, next_task: "CAL-5.05", order: 4, created_at: "2026-03-26T00:00:00Z", updated_at: "2026-03-26T00:00:00Z" },
    { id: "CAL-5.05", stage: "traffic", project_id: "caliber", name: "Analyze Performance", description: "Track engagement metrics on first carousel", status: "not_started", automation: "fully-auto", owner: "darwin", model: "claude-opus-4-6", prompt_id: "", output: "", quality_gate: "", blocker: null, next_task: "CAL-5.01", order: 5, created_at: "2026-03-26T00:00:00Z", updated_at: "2026-03-26T00:00:00Z" },

    // ── GEMSNAP PROJECT TASKS ──
    { id: "GEM-6.01", stage: "conversion", project_id: "gemsnap", name: "Funnel Analysis", description: "Analyze scan-to-purchase funnel drop-offs", status: "done", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-6.01", output: "62% abandonment at checkout — single-page fix recommended", quality_gate: "", blocker: null, next_task: "GEM-6.02", order: 1, created_at: "2026-03-20T00:00:00Z", updated_at: "2026-03-25T00:00:00Z" },
    { id: "GEM-6.02", stage: "conversion", project_id: "gemsnap", name: "Design A/B Test", description: "Pricing display variant test", status: "done", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "Test spec: variant A (original) vs variant B (single page checkout)", quality_gate: "Founder approved", blocker: null, next_task: "GEM-6.03", order: 2, created_at: "2026-03-25T00:00:00Z", updated_at: "2026-03-28T00:00:00Z" },
    { id: "GEM-6.03", stage: "conversion", project_id: "gemsnap", name: "Implement Test", description: "Deploy A/B test variant", status: "done", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "", output: "Feature flag deployed — test live since March 30", quality_gate: "Feature flag active", blocker: null, next_task: "GEM-6.04", order: 3, created_at: "2026-03-28T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },
    { id: "GEM-6.04", stage: "conversion", project_id: "gemsnap", name: "Wait for Results", description: "Waiting for statistical significance on A/B test", status: "in_progress", automation: "fully-auto", owner: "system", model: "", prompt_id: "", output: "", quality_gate: "1000 visitors/variant", blocker: null, next_task: "GEM-6.05", order: 4, created_at: "2026-03-30T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
    { id: "GEM-6.05", stage: "conversion", project_id: "gemsnap", name: "Scale Decision", description: "Decide whether to scale ad spend", status: "not_started", automation: "manual", owner: "ginge", model: "", prompt_id: "", output: "", quality_gate: "Founder", blocker: null, next_task: "GEM-6.01", order: 5, created_at: "2026-03-30T00:00:00Z", updated_at: "2026-03-30T00:00:00Z" },

    // ── EDGE AUTO PROJECT TASKS ──
    { id: "EDGE-3.01", stage: "design", project_id: "edgeauto", name: "Define User Journey", description: "Map audit quiz to report to booking flow", status: "done", automation: "semi-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "", output: "Flow: Ad → Quiz → Report → Booking → Onboarding", quality_gate: "Founder approved", blocker: null, next_task: "EDGE-3.02", order: 1, created_at: "2026-03-15T00:00:00Z", updated_at: "2026-03-20T00:00:00Z" },
    { id: "EDGE-3.02", stage: "design", project_id: "edgeauto", name: "Write Report Template", description: "9-section personalised audit report", status: "done", automation: "fully-auto", owner: "atlas", model: "claude-opus-4-6", prompt_id: "P-3.02", output: "9-section template written — ready for build", quality_gate: "Darwin 8/10+", blocker: null, next_task: "EDGE-3.03", order: 2, created_at: "2026-03-20T00:00:00Z", updated_at: "2026-03-25T00:00:00Z" },
    { id: "EDGE-3.03", stage: "design", project_id: "edgeauto", name: "Build Report Page", description: "Next.js personalised audit report page", status: "in_progress", automation: "semi-auto", owner: "claude-code", model: "claude-opus-4-6", prompt_id: "P-3.03", output: "", quality_gate: "<1s LCP", blocker: null, next_task: "EDGE-4.01", order: 3, created_at: "2026-03-25T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" },
  ],
};

/* ── Data access ── */
async function getStore(): Promise<TaskStore> {
  const cached = await kv.get<TaskStore>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

async function saveStore(store: TaskStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(KV_KEY, store);
}

/* ── POST handler (action-based) ── */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  // ── LIST ──
  if (action === "list") {
    const store = await getStore();
    const { project_id, stage } = body;
    let tasks = store.tasks;
    if (project_id) tasks = tasks.filter((t) => t.project_id === project_id);
    if (stage) tasks = tasks.filter((t) => t.stage === stage);
    return NextResponse.json({ tasks, lastUpdated: store.lastUpdated });
  }

  // ── GET ──
  if (action === "get") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const store = await getStore();
    const task = store.tasks.find((t) => t.id === id);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(task);
  }

  // ── SEARCH ──
  if (action === "search") {
    const { q, project_id, stage, status, owner } = body;
    const store = await getStore();
    let tasks = store.tasks;
    if (project_id) tasks = tasks.filter((t) => t.project_id === project_id);
    if (stage) tasks = tasks.filter((t) => t.stage === stage);
    if (status) tasks = tasks.filter((t) => t.status === status);
    if (owner) tasks = tasks.filter((t) => t.owner === owner);
    if (q) {
      const lower = q.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.description.toLowerCase().includes(lower) ||
          t.id.toLowerCase().includes(lower)
      );
    }
    return NextResponse.json({ tasks, count: tasks.length });
  }

  // ── Writes require auth ──
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── SET (create or update) ──
  if (action === "set") {
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    if (fields.stage && !VALID_STAGES.includes(fields.stage)) {
      return NextResponse.json({ error: `Invalid stage. Valid: ${VALID_STAGES.join(", ")}` }, { status: 400 });
    }
    if (fields.status && !VALID_STATUSES.includes(fields.status)) {
      return NextResponse.json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (fields.automation && !VALID_AUTOMATION.includes(fields.automation)) {
      return NextResponse.json({ error: `Invalid automation. Valid: ${VALID_AUTOMATION.join(", ")}` }, { status: 400 });
    }

    const store = await getStore();
    const now = new Date().toISOString();
    const idx = store.tasks.findIndex((t) => t.id === id);

    if (idx >= 0) {
      const existing = store.tasks[idx];
      const { action: _a, ...cleanFields } = fields;
      store.tasks[idx] = { ...existing, ...cleanFields, id, updated_at: now };
    } else {
      const task: PipelineTask = {
        id,
        stage: fields.stage || "inbox",
        project_id: fields.project_id || "_template",
        name: fields.name || "",
        description: fields.description || "",
        status: fields.status || "not_started",
        automation: fields.automation || "manual",
        owner: fields.owner || "",
        model: fields.model || "",
        prompt_id: fields.prompt_id || "",
        output: fields.output || "",
        quality_gate: fields.quality_gate || "",
        blocker: fields.blocker || null,
        next_task: fields.next_task || "",
        order: fields.order || 0,
        created_at: now,
        updated_at: now,
      };
      store.tasks.push(task);
    }

    await saveStore(store);
    const saved = store.tasks.find((t) => t.id === id)!;
    return NextResponse.json(saved, { status: idx >= 0 ? 200 : 201 });
  }

  // ── DELETE ──
  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const store = await getStore();
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    store.tasks.splice(idx, 1);
    await saveStore(store);
    return NextResponse.json({ ok: true, deleted: id });
  }

  return NextResponse.json({ error: "Unknown action. Use: list, get, set, delete, search" }, { status: 400 });
}
