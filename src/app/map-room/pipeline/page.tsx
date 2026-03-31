"use client";

import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────── TYPES ─────────────────────────── */

interface WorkflowTask {
  id: string;
  name: string;
  lane: string;
  owner: string;
  why: string;
  prompt?: { text: string; version: string };
  expectedOutput?: string;
  qualityGate?: string;
  nextTask?: string;
  loopTo?: string;
  automationLevel: "Manual" | "Semi-Auto" | "Fully Auto";
  founderRequired: boolean;
}

interface ActiveProject {
  id: string;
  name: string;
  currentStage: number;
  status: "on-track" | "blocked" | "stalled";
  currentTaskId: string;
  completedTaskIds: string[];
  blockedTaskIds: string[];
  blockerNote?: string;
  missingOutputs: string[];
  nextAction: string;
}

/* ─────────────────────────── CONSTANTS ─────────────────────── */

const STAGES = [
  { id: -1, label: "Inbox" },
  { id: 0, label: "Idea" },
  { id: 1, label: "Validation" },
  { id: 2, label: "Design" },
  { id: 3, label: "MVP" },
  { id: 4, label: "Traffic" },
  { id: 5, label: "Conversion" },
  { id: 6, label: "Delivery" },
  { id: 7, label: "Scale" },
];

const TOKENS = {
  bg: "#0a0a0f",
  card: "#111118",
  border: "#1e1e2e",
  accent: "#00d4d4",
  warn: "#f59e0b",
  error: "#ef4444",
  success: "#22c55e",
  heading: "#ffffff",
  body: "#a0a0b0",
  muted: "#6b6b80",
  purple: "#a78bfa",
  blue: "#60a5fa",
  pink: "#f472b6",
  orange: "#fb923c",
};

const LANE_COLORS: Record<string, string> = {
  Research: TOKENS.blue,
  Content: TOKENS.purple,
  Design: TOKENS.pink,
  Dev: TOKENS.accent,
  QA: TOKENS.orange,
  Data: TOKENS.blue,
  Growth: TOKENS.success,
  Distribution: TOKENS.purple,
  Fulfilment: TOKENS.orange,
  Support: TOKENS.pink,
  Delivery: TOKENS.accent,
  Ops: TOKENS.muted,
};

const AUTO_COLORS: Record<string, { color: string; bg: string }> = {
  Manual: { color: TOKENS.muted, bg: "rgba(107,107,128,0.15)" },
  "Semi-Auto": { color: TOKENS.warn, bg: "rgba(245,158,11,0.15)" },
  "Fully Auto": { color: TOKENS.success, bg: "rgba(34,197,94,0.15)" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "on-track": { label: "On Track", color: TOKENS.success, bg: "rgba(34,197,94,0.1)" },
  blocked: { label: "Blocked", color: TOKENS.error, bg: "rgba(239,68,68,0.1)" },
  stalled: { label: "Stalled", color: TOKENS.warn, bg: "rgba(245,158,11,0.1)" },
};

/* ─────────────────────────── MASTER WORKFLOWS ─────────────────── */

const MASTER_WORKFLOWS: Record<number, WorkflowTask[]> = {
  [-1]: [
    { id: "inbox-1", name: "Capture Idea", lane: "Ops", owner: "Ginge", why: "Raw ideas need a single capture point", expectedOutput: "Idea card", qualityGate: "None", nextTask: "Tag & Categorise", automationLevel: "Manual", founderRequired: true },
    { id: "inbox-2", name: "Tag & Categorise", lane: "Ops", owner: "Atlas", why: "Categorisation enables prioritisation", expectedOutput: "Tagged idea", qualityGate: "None", nextTask: "Move to Idea stage", automationLevel: "Semi-Auto", founderRequired: false },
  ],
  [0]: [
    { id: "idea-1", name: "Write Problem Statement", lane: "Research", owner: "Ginge", why: "Forces clarity on what problem we solve", expectedOutput: "1-paragraph problem statement", qualityGate: "Founder approval", nextTask: "Score Opportunity", automationLevel: "Manual", founderRequired: true },
    { id: "idea-2", name: "Score Opportunity", lane: "Research", owner: "Newton", why: "Quantify potential before investing time", expectedOutput: "Opportunity score (1-10)", qualityGate: "Score 7+", nextTask: "Move to Validation", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "idea-3", name: "Kill or Proceed Decision", lane: "Ops", owner: "Ginge", why: "Gate prevents wasted effort on weak ideas", expectedOutput: "Go/No-go decision", qualityGate: "Founder decision", nextTask: "Move to Validation", automationLevel: "Manual", founderRequired: true },
  ],
  [1]: [
    { id: "val-1", name: "Extract Pain Signals", lane: "Research", owner: "Newton", why: "Real language from real people validates demand", prompt: { text: "Analyze Reddit, forums, and review sites for the target niche. Extract:\n1. Exact phrases people use to describe their pain\n2. Frequency of complaints\n3. Emotional intensity (1-10)\n4. Existing solutions mentioned and why they fail\n\nFormat as a Pain Language Bank with columns:\n| Pain Phrase | Source | Frequency | Intensity | Failed Solution |", version: "v1.2" }, expectedOutput: "Pain Language Bank", qualityGate: "Darwin 8/10+", nextTask: "Generate Hooks", automationLevel: "Fully Auto", founderRequired: false },
    { id: "val-2", name: "Competitor Analysis", lane: "Research", owner: "Newton", why: "Know the landscape before entering it", prompt: { text: "Research the top 10 competitors in this space. For each:\n1. Product name & URL\n2. Pricing model & price points\n3. Key features (top 5)\n4. Weaknesses (from reviews)\n5. Traffic estimate (SimilarWeb)\n6. Content strategy summary\n\nFormat as structured competitor matrix.", version: "v1.0" }, expectedOutput: "Competitor Report", qualityGate: "None", nextTask: "Market Sizing", automationLevel: "Fully Auto", founderRequired: false },
    { id: "val-3", name: "Market Sizing", lane: "Research", owner: "Newton", why: "Size determines if the opportunity is worth pursuing", expectedOutput: "TAM/SAM/SOM estimate", qualityGate: "Founder review", nextTask: "Stage Decision", automationLevel: "Semi-Auto", founderRequired: true },
    { id: "val-4", name: "Generate Hooks", lane: "Content", owner: "Atlas", why: "Hooks test whether pain translates to attention", prompt: { text: "Using the Pain Language Bank, generate 12 hook variants:\n- 4x Question hooks\n- 4x Statement hooks  \n- 4x Story hooks\n\nEach hook must:\n1. Use exact pain language from the bank\n2. Be under 15 words\n3. Create curiosity gap\n4. Feel native to the platform (Instagram/TikTok)\n\nRank by predicted engagement.", version: "v2.1" }, expectedOutput: "Hook Bank", qualityGate: "Darwin selects top 3", nextTask: "Test Hooks", automationLevel: "Fully Auto", founderRequired: false },
  ],
  [2]: [
    { id: "des-1", name: "Define User Journey", lane: "Design", owner: "Atlas", why: "Map the complete experience before building anything", expectedOutput: "User flow diagram", qualityGate: "Founder approval", nextTask: "Write Report Template", automationLevel: "Semi-Auto", founderRequired: true },
    { id: "des-2", name: "Write Report Template", lane: "Content", owner: "Atlas", why: "Personalised reports convert browsers to buyers", prompt: { text: "Generate a personalised audit report template with:\n1. Dynamic greeting using {name}\n2. 9 scored sections with {score}/10 ratings\n3. Personalised recommendations per section\n4. Executive summary paragraph\n5. Call-to-action with urgency element\n\nTone: Professional but direct. No fluff.\nFormat: HTML template with Tailwind classes.", version: "v1.3" }, expectedOutput: "Report template", qualityGate: "Darwin 8/10+", nextTask: "Build Report Page", automationLevel: "Fully Auto", founderRequired: false },
    { id: "des-3", name: "Build Report Page", lane: "Dev", owner: "Claude Code", why: "The report page IS the product for audit-style businesses", prompt: { text: "Build a modern Next.js page that renders personalised audit reports.\n\nRequirements:\n- Server-side rendering with dynamic data\n- 9-section layout with animated score reveals\n- Mobile-first responsive design\n- Print-friendly CSS\n- < 1 second LCP\n- Tailwind + inline styles only (no CSS files)\n\nStack: Next.js 14, TypeScript, Tailwind CSS", version: "v2.0" }, expectedOutput: "Deployed page", qualityGate: "<1s LCP", nextTask: "Client Demo", automationLevel: "Semi-Auto", founderRequired: false },
  ],
  [3]: [
    { id: "mvp-1", name: "Define MVP Scope", lane: "Dev", owner: "Ginge", why: "Scope creep kills MVPs — define the minimum", expectedOutput: "MVP feature list", qualityGate: "Founder sign-off", nextTask: "Build Core Feature", automationLevel: "Manual", founderRequired: true },
    { id: "mvp-2", name: "Build Core Feature", lane: "Dev", owner: "Claude Code", why: "Ship the one thing that matters", expectedOutput: "Deployed feature", qualityGate: "Works end-to-end", nextTask: "User Test", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "mvp-3", name: "User Test", lane: "QA", owner: "Ginge", why: "Real users find real problems", expectedOutput: "Feedback log", qualityGate: "5 users tested", nextTask: "Iterate or Advance", automationLevel: "Manual", founderRequired: true },
  ],
  [4]: [
    { id: "traf-1", name: "Create Carousel Copy", lane: "Content", owner: "Atlas", why: "Carousels drive saves and shares — the growth engine", prompt: { text: "Write a 7-slide Instagram carousel:\n\nSlide 1: Hook (use top hook from Hook Bank)\nSlide 2: Problem amplification\nSlide 3: Common mistake #1\nSlide 4: Common mistake #2  \nSlide 5: The shift / insight\nSlide 6: The solution framework\nSlide 7: CTA with urgency\n\nRules:\n- Max 30 words per slide\n- Each slide must standalone\n- Use power words from Pain Language Bank\n- End every slide with a reason to swipe", version: "v3.0" }, expectedOutput: "Carousel copy", qualityGate: "Darwin 8/10+", nextTask: "Quality Gate Review", automationLevel: "Fully Auto", founderRequired: false },
    { id: "traf-2", name: "Quality Gate Review", lane: "QA", owner: "Darwin", why: "Catch weak content before it goes live and wastes reach", prompt: { text: "Review this carousel against the quality checklist:\n\n1. Hook score (1-10): Does slide 1 stop the scroll?\n2. Flow score (1-10): Does each slide compel a swipe?\n3. Value score (1-10): Would someone save this?\n4. CTA score (1-10): Is the action clear?\n5. Brand score (1-10): Consistent voice and visual?\n\nOverall: Calculate average. Below 8 = FAIL with specific fixes.\nAbove 8 = PASS with optional improvements.", version: "v2.0" }, expectedOutput: "Rating + fixes", qualityGate: "8/10+ pass", nextTask: "Generate Images", automationLevel: "Fully Auto", founderRequired: false },
    { id: "traf-3", name: "Generate Images", lane: "Content", owner: "Atlas", why: "Visual content gets 2x engagement vs text-only", expectedOutput: "7 carousel images", qualityGate: "Brand check", nextTask: "Publish Content", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "traf-4", name: "Publish Content", lane: "Distribution", owner: "Atlas", why: "Consistent publishing builds algorithmic trust", prompt: { text: "Publish the carousel via Instagram Graph API:\n1. Upload images to container\n2. Create carousel container\n3. Publish with caption\n4. Verify post is live\n5. Log post ID, timestamp, and URL\n\nCaption rules:\n- First line = hook (no hashtags)\n- Line break after hook\n- 3-5 value bullets\n- CTA on final line\n- 20-30 hashtags in first comment", version: "v1.5" }, expectedOutput: "Live post", qualityGate: "Post confirmed", nextTask: "Analyze Performance", automationLevel: "Fully Auto", founderRequired: false },
    { id: "traf-5", name: "Analyze Performance", lane: "Data", owner: "Darwin", why: "Data-driven iteration beats guessing", expectedOutput: "Engagement metrics", qualityGate: "None", nextTask: "Create Carousel Copy", loopTo: "Create Carousel Copy", automationLevel: "Fully Auto", founderRequired: false },
  ],
  [5]: [
    { id: "conv-1", name: "Funnel Analysis", lane: "Data", owner: "Atlas", why: "Find the biggest leak before optimising", prompt: { text: "Analyze the full conversion funnel:\n1. Landing page views -> CTA clicks (% drop-off)\n2. CTA clicks -> Form starts (% drop-off)\n3. Form starts -> Form completes (% drop-off)\n4. Form completes -> Payment page (% drop-off)\n5. Payment page -> Purchase (% drop-off)\n\nFor each stage:\n- Current conversion rate\n- Industry benchmark\n- Gap analysis\n- Top 3 hypotheses for drop-off\n- Recommended fix (quick win vs structural)", version: "v1.0" }, expectedOutput: "Drop-off report", qualityGate: "None", nextTask: "Design A/B Test", automationLevel: "Fully Auto", founderRequired: false },
    { id: "conv-2", name: "Design A/B Test", lane: "Growth", owner: "Ginge", why: "Test before you invest — data beats opinions", expectedOutput: "Test spec", qualityGate: "Founder approval", nextTask: "Implement Test", automationLevel: "Manual", founderRequired: true },
    { id: "conv-3", name: "Implement Test", lane: "Dev", owner: "Claude Code", why: "Ship the variant fast so data starts flowing", expectedOutput: "Deployed variant", qualityGate: "Feature flag active", nextTask: "Wait for Results", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "conv-4", name: "Wait for Results", lane: "Data", owner: "System", why: "Statistical significance requires patience", expectedOutput: "Statistical results", qualityGate: "1000 visitors/variant", nextTask: "Scale Decision", automationLevel: "Fully Auto", founderRequired: false },
    { id: "conv-5", name: "Scale Decision", lane: "Growth", owner: "Ginge", why: "Only scale what is proven to work", expectedOutput: "Spend decision", qualityGate: "Founder", nextTask: "Funnel Analysis", loopTo: "Funnel Analysis", automationLevel: "Manual", founderRequired: true },
  ],
  [6]: [
    { id: "del-1", name: "Ship Order", lane: "Fulfilment", owner: "Atlas", why: "Fast delivery builds trust and repeat business", expectedOutput: "Tracking number", qualityGate: "None", nextTask: "Collect Feedback", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "del-2", name: "Collect Feedback", lane: "Support", owner: "Darwin", why: "Feedback reveals what metrics miss", expectedOutput: "Feedback log", qualityGate: "7-day window", nextTask: "Review Support Issues", automationLevel: "Fully Auto", founderRequired: false },
    { id: "del-3", name: "Review Support Issues", lane: "Support", owner: "Darwin", why: "Patterns in complaints reveal systemic problems", expectedOutput: "Issue report", qualityGate: "Weekly", nextTask: "Improve Onboarding", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "del-4", name: "Improve Onboarding", lane: "Delivery", owner: "Atlas", why: "Better onboarding reduces support load and churn", expectedOutput: "Updated process", qualityGate: "None", nextTask: "Monitor Satisfaction", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "del-5", name: "Monitor Satisfaction", lane: "Data", owner: "Darwin", why: "CSAT is the leading indicator of retention", expectedOutput: "CSAT score", qualityGate: "Weekly", nextTask: "Ship Order", loopTo: "Ship Order", automationLevel: "Fully Auto", founderRequired: false },
  ],
  [7]: [
    { id: "scale-1", name: "Identify Scale Levers", lane: "Growth", owner: "Newton", why: "Not everything scales — find what does", expectedOutput: "Scale lever map", qualityGate: "Founder review", nextTask: "Automate Processes", automationLevel: "Manual", founderRequired: true },
    { id: "scale-2", name: "Automate Processes", lane: "Dev", owner: "Claude Code", why: "Automation removes the founder from the critical path", expectedOutput: "Automation deployed", qualityGate: "End-to-end test", nextTask: "Monitor & Iterate", automationLevel: "Semi-Auto", founderRequired: false },
    { id: "scale-3", name: "Monitor & Iterate", lane: "Data", owner: "Darwin", why: "Scale breaks things — monitor continuously", expectedOutput: "Performance dashboard", qualityGate: "Weekly review", nextTask: "Identify Scale Levers", loopTo: "Identify Scale Levers", automationLevel: "Fully Auto", founderRequired: false },
  ],
};

const COMING_SOON_STAGES = new Set([-1, 0, 3, 7]);

/* ─────────────────────────── ACTIVE PROJECTS SEED ─────────────── */

const SEED_PROJECTS: ActiveProject[] = [
  {
    id: "caliber",
    name: "Caliber Peptides",
    currentStage: 4,
    status: "blocked",
    currentTaskId: "traf-1",
    completedTaskIds: [],
    blockedTaskIds: ["traf-1"],
    blockerNote: "Copy scored 6.5/10 — needs rewrite",
    missingOutputs: [],
    nextAction: "Rewrite carousel copy to hit 8/10+ quality gate",
  },
  {
    id: "gemsnap",
    name: "GemSnap",
    currentStage: 5,
    status: "stalled",
    currentTaskId: "conv-4",
    completedTaskIds: ["conv-1", "conv-2", "conv-3"],
    blockedTaskIds: [],
    blockerNote: undefined,
    missingOutputs: ["Statistical results"],
    nextAction: "Waiting for 1000 visitors per variant — passive",
  },
  {
    id: "edgeauto",
    name: "Edge Auto",
    currentStage: 2,
    status: "blocked",
    currentTaskId: "des-3",
    completedTaskIds: ["des-1"],
    blockedTaskIds: ["des-3"],
    blockerNote: "Design spec pending founder review",
    missingOutputs: ["Report template"],
    nextAction: "Complete report template before build can start",
  },
];

/* ─────────────────────────── COMPONENT ─────────────────────────── */

export default function PipelinePage() {
  const [activeStage, setActiveStage] = useState(4);
  const [projects, setProjects] = useState<ActiveProject[]>(SEED_PROJECTS);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Try to fetch live projects, fall back to seed data
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/map-room/projects", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setProjects(data);
        }
      })
      .catch(() => {
        // Silently fall back to seed data
      });
    return () => controller.abort();
  }, []);

  const togglePrompt = useCallback((taskId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const copyPrompt = useCallback((taskId: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(taskId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const stageWorkflow = MASTER_WORKFLOWS[activeStage] || [];
  const stageProjects = projects.filter((p) => p.currentStage === activeStage);
  const isComingSoon = COMING_SOON_STAGES.has(activeStage);
  const currentStageLabel = STAGES.find((s) => s.id === activeStage)?.label ?? "";

  // Count active projects per stage
  const projectCounts: Record<number, number> = {};
  for (const p of projects) {
    projectCounts[p.currentStage] = (projectCounts[p.currentStage] || 0) + 1;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Page Title ── */}
      <div>
        <h2 style={{ color: TOKENS.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>
          Pipeline
        </h2>
        <p style={{ color: TOKENS.body, fontSize: 14, margin: "4px 0 0" }}>
          Stage playbook + prompt library + live execution workspace
        </p>
      </div>

      {/* ── Stage Rail ── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {STAGES.map((stage) => {
          const isActive = stage.id === activeStage;
          const count = projectCounts[stage.id] || 0;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${isActive ? TOKENS.accent : TOKENS.border}`,
                background: isActive ? "rgba(0,212,212,0.1)" : TOKENS.card,
                color: isActive ? TOKENS.accent : TOKENS.body,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <span style={{ opacity: 0.5, fontSize: 11 }}>{stage.id === -1 ? "—" : stage.id}</span>
              {stage.label}
              {count > 0 && (
                <span
                  style={{
                    background: TOKENS.accent,
                    color: "#000",
                    fontSize: 10,
                    fontWeight: 800,
                    borderRadius: 99,
                    padding: "1px 7px",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── VIEW 1: Master Workflow ── */}
      <div
        style={{
          background: TOKENS.card,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${TOKENS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <h3 style={{ color: TOKENS.heading, fontSize: 16, fontWeight: 700, margin: 0 }}>
              Stage {activeStage === -1 ? "—" : activeStage}: {currentStageLabel} — Master Workflow
            </h3>
          </div>
          {isComingSoon && (
            <span
              style={{
                background: "rgba(245,158,11,0.15)",
                color: TOKENS.warn,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 6,
              }}
            >
              COMING SOON — Placeholder tasks
            </span>
          )}
          <span style={{ color: TOKENS.muted, fontSize: 12 }}>
            {stageWorkflow.length} task{stageWorkflow.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Task Rows */}
        <div>
          {stageWorkflow.map((task, idx) => {
            const isPromptOpen = expandedPrompts.has(task.id);
            const laneColor = LANE_COLORS[task.lane] || TOKENS.body;
            const autoStyle = AUTO_COLORS[task.automationLevel];

            return (
              <div key={task.id}>
                {/* Main row */}
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: `1px solid ${TOKENS.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* Row Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: TOKENS.muted, fontSize: 12, fontWeight: 600, minWidth: 20 }}>
                      {idx + 1}.
                    </span>
                    <span style={{ color: TOKENS.heading, fontSize: 14, fontWeight: 600 }}>
                      {task.name}
                    </span>
                    {/* Lane pill */}
                    <span
                      style={{
                        background: `${laneColor}22`,
                        color: laneColor,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 99,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {task.lane}
                    </span>
                    {/* Owner */}
                    <span style={{ color: TOKENS.body, fontSize: 12 }}>
                      {task.owner}
                    </span>
                    {/* Automation badge */}
                    <span
                      style={{
                        background: autoStyle.bg,
                        color: autoStyle.color,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {task.automationLevel}
                    </span>
                    {/* Founder badge */}
                    {task.founderRequired && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "rgba(167,139,250,0.15)",
                          color: TOKENS.purple,
                        }}
                      >
                        👤 Founder Required
                      </span>
                    )}
                    {/* Loop badge */}
                    {task.loopTo && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "rgba(0,212,212,0.1)",
                          color: TOKENS.accent,
                        }}
                      >
                        🔁 loops to {task.loopTo}
                      </span>
                    )}
                  </div>

                  {/* Details Row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr",
                      gap: 12,
                      paddingLeft: 30,
                      fontSize: 12,
                    }}
                  >
                    {/* Why */}
                    <div>
                      <span style={{ color: TOKENS.muted, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Why
                      </span>
                      <span style={{ color: TOKENS.body }}>{task.why}</span>
                    </div>
                    {/* Expected Output */}
                    <div>
                      <span style={{ color: TOKENS.muted, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Output
                      </span>
                      {task.expectedOutput ? (
                        <span style={{ color: TOKENS.body }}>{task.expectedOutput}</span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            color: TOKENS.warn,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          ⚠ Missing Output Definition
                        </span>
                      )}
                    </div>
                    {/* Quality Gate */}
                    <div>
                      <span style={{ color: TOKENS.muted, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Quality Gate
                      </span>
                      <span style={{ color: TOKENS.body }}>{task.qualityGate || "None"}</span>
                    </div>
                    {/* Next Task */}
                    <div>
                      <span style={{ color: TOKENS.muted, display: "block", marginBottom: 2, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Next
                      </span>
                      <span style={{ color: TOKENS.accent }}>{task.nextTask || "—"}</span>
                    </div>
                  </div>

                  {/* Prompt Row */}
                  <div style={{ paddingLeft: 30 }}>
                    {task.prompt ? (
                      <div>
                        <button
                          onClick={() => togglePrompt(task.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: TOKENS.accent,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "4px 0",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 10, transition: "transform 0.15s", transform: isPromptOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                            ▶
                          </span>
                          {isPromptOpen ? "Hide Prompt" : "Show Prompt"}
                          <span style={{ color: TOKENS.muted, fontWeight: 400, marginLeft: 4 }}>
                            {task.prompt.version}
                          </span>
                        </button>
                        {isPromptOpen && (
                          <div
                            style={{
                              marginTop: 8,
                              background: "#0a0a12",
                              border: `1px solid ${TOKENS.border}`,
                              borderRadius: 8,
                              padding: 16,
                              position: "relative",
                            }}
                          >
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                                fontSize: 12,
                                lineHeight: 1.6,
                                color: TOKENS.body,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {task.prompt.text}
                            </pre>
                            <button
                              onClick={() => copyPrompt(task.id, task.prompt!.text)}
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                background: copiedId === task.id ? "rgba(34,197,94,0.2)" : "rgba(0,212,212,0.1)",
                                border: `1px solid ${copiedId === task.id ? TOKENS.success : TOKENS.border}`,
                                color: copiedId === task.id ? TOKENS.success : TOKENS.accent,
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "4px 10px",
                                borderRadius: 6,
                                transition: "all 0.15s",
                              }}
                            >
                              {copiedId === task.id ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        style={{
                          background: "rgba(239,68,68,0.12)",
                          color: TOKENS.error,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 4,
                        }}
                      >
                        ❌ Missing Prompt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── VIEW 2: Active Projects ── */}
      <div
        style={{
          background: TOKENS.card,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${TOKENS.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>🚀</span>
          <h3 style={{ color: TOKENS.heading, fontSize: 16, fontWeight: 700, margin: 0 }}>
            Active Projects at {currentStageLabel}
          </h3>
          <span style={{ color: TOKENS.muted, fontSize: 12 }}>
            {stageProjects.length} project{stageProjects.length !== 1 ? "s" : ""}
          </span>
        </div>

        {stageProjects.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ color: TOKENS.muted, fontSize: 14, margin: 0 }}>
              No active projects at this stage. The workflow above is ready when a project arrives.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {stageProjects.map((project) => {
              const statusCfg = STATUS_CONFIG[project.status];
              const workflowTasks = MASTER_WORKFLOWS[project.currentStage] || [];

              return (
                <div
                  key={project.id}
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${TOKENS.border}`,
                  }}
                >
                  {/* Project Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ color: TOKENS.heading, fontSize: 15, fontWeight: 700 }}>
                      {project.name}
                    </span>
                    <span
                      style={{
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 10px",
                        borderRadius: 99,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: statusCfg.color,
                          display: "inline-block",
                        }}
                      />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Task Progress */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {workflowTasks.map((task) => {
                      const isCurrent = task.id === project.currentTaskId;
                      const isCompleted = project.completedTaskIds.includes(task.id);
                      const isBlocked = project.blockedTaskIds.includes(task.id);

                      let icon = "○";
                      let textColor = TOKENS.muted;
                      let bgColor = "transparent";

                      if (isCompleted) {
                        icon = "✅";
                        textColor = TOKENS.success;
                      } else if (isBlocked) {
                        icon = "🚩";
                        textColor = TOKENS.error;
                      } else if (isCurrent) {
                        icon = "▶";
                        textColor = TOKENS.accent;
                        bgColor = "rgba(0,212,212,0.06)";
                      }

                      return (
                        <div
                          key={task.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "5px 10px",
                            borderRadius: 6,
                            background: bgColor,
                            fontSize: 13,
                          }}
                        >
                          <span style={{ fontSize: 12, width: 20, flexShrink: 0 }}>{icon}</span>
                          <span style={{ color: isCurrent ? TOKENS.heading : textColor, fontWeight: isCurrent ? 600 : 400 }}>
                            {task.name}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "rgba(0,212,212,0.15)",
                                color: TOKENS.accent,
                                marginLeft: 4,
                              }}
                            >
                              CURRENT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Blocker + Missing Outputs + Next Action */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 10 }}>
                    {project.blockerNote && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                        <span style={{ color: TOKENS.error, fontWeight: 600, flexShrink: 0 }}>BLOCKER:</span>
                        <span style={{ color: TOKENS.error }}>{project.blockerNote}</span>
                      </div>
                    )}
                    {project.missingOutputs.length > 0 && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                        <span style={{ color: TOKENS.warn, fontWeight: 600, flexShrink: 0 }}>MISSING:</span>
                        <span style={{ color: TOKENS.warn }}>{project.missingOutputs.join(", ")}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
                      <span style={{ color: TOKENS.accent, fontWeight: 600, flexShrink: 0 }}>NEXT:</span>
                      <span style={{ color: TOKENS.accent }}>{project.nextAction}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
