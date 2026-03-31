"use client";

import { useState, useEffect } from "react";

/* ── Design Tokens ── */
const C = {
  bg: "#0a0a0f", card: "#111118", border: "#1e1e2e",
  accent: "#00d4d4", warn: "#f59e0b", error: "#ef4444", success: "#22c55e",
  heading: "#ffffff", body: "#a0a0b0", muted: "#6b6b80",
  purple: "#a78bfa", blue: "#60a5fa", pink: "#f472b6", orange: "#fb923c",
  passive: "#4a6fa5",
};

/* ── Types ── */
interface FlowNode {
  id: string;
  name: string;
  type: "task" | "prompt" | "output" | "review" | "decision";
  stage: number;
  project_id: string;
  owner: string;
  status: string;
  source: string;
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
  // v2 fields
  expects_prompt?: boolean;
  is_loop?: boolean;
  loop_label?: string;
  loop_back_to?: string;
  next_review?: string;
  wait_reason?: string;
  badges?: string[];
}

interface FlowData {
  nodes: FlowNode[];
  lastUpdated: string;
}

/* ── Constants ── */
const STAGES = [
  { id: -1, label: "Inbox" }, { id: 0, label: "Idea" }, { id: 1, label: "Validation" },
  { id: 2, label: "Design" }, { id: 3, label: "MVP" }, { id: 4, label: "Traffic" },
  { id: 5, label: "Conversion" }, { id: 6, label: "Delivery" }, { id: 7, label: "Scale" },
];

const PROJECTS: Record<string, { name: string; color: string }> = {
  caliber: { name: "Caliber Peptides", color: C.accent },
  gemsnap: { name: "GemSnap", color: C.purple },
  "edge-auto": { name: "Edge Auto", color: C.orange },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  "not-started": { label: "Not Started", bg: "rgba(107,107,128,0.12)", color: C.muted, dot: C.muted },
  "in-progress": { label: "In Progress", bg: "rgba(0,212,212,0.12)", color: C.accent, dot: C.accent },
  "completed": { label: "Completed", bg: "rgba(34,197,94,0.12)", color: C.success, dot: C.success },
  "waiting-founder": { label: "Waiting on Founder", bg: "rgba(245,158,11,0.15)", color: C.warn, dot: C.warn },
  "waiting-passive": { label: "Waiting (Passive)", bg: "rgba(74,111,165,0.15)", color: C.passive, dot: C.passive },
  "blocked": { label: "Blocked", bg: "rgba(239,68,68,0.12)", color: C.error, dot: C.error },
  "failed": { label: "Failed", bg: "rgba(239,68,68,0.12)", color: C.error, dot: C.error },
  "winner": { label: "Winner", bg: "rgba(34,197,94,0.15)", color: C.success, dot: C.success },
  "missing": { label: "Missing", bg: "rgba(239,68,68,0.15)", color: C.error, dot: C.error },
};

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  task: { icon: "▸", label: "TASK", color: C.accent },
  prompt: { icon: "⟩", label: "PROMPT", color: C.purple },
  output: { icon: "◈", label: "OUTPUT", color: C.blue },
  review: { icon: "◉", label: "REVIEW", color: C.warn },
  decision: { icon: "◆", label: "DECISION", color: C.pink },
};

const OWNER_COLORS: Record<string, string> = {
  Atlas: C.blue, Darwin: "#34d399", Newton: C.purple,
  "Claude Code": C.orange, Ginge: C.pink, Architect: C.muted, System: C.muted,
};

/* ── Fallback Data ── */
const FALLBACK: FlowData = {
  lastUpdated: new Date().toISOString(),
  nodes: [
    // ── CALIBER: Validation chain (worked) ──
    { id: "cal-t1", name: "Peptide Research Brief", type: "task", stage: 1, project_id: "caliber", owner: "Newton", status: "completed", source: "stage", next_node_id: "cal-p1", requires_founder_action: false, worked_state: "worked", expects_prompt: true, last_updated: "2026-03-28T10:00:00Z" },
    { id: "cal-p1", name: "Research Prompt v2", type: "prompt", stage: 1, project_id: "caliber", owner: "Newton", status: "completed", source: "manual", next_node_id: "cal-o1", requires_founder_action: false, worked_state: "worked", prompt_text: "You are a world-class biochemistry researcher. Research [PEPTIDE NAME] thoroughly. Cover: mechanism of action with citations, clinical trial data, dosing protocols from community sources, UK competitor pricing, market trend analysis.", last_updated: "2026-03-28T10:00:00Z" },
    { id: "cal-o1", name: "BPC-157 Research Brief", type: "output", stage: 1, project_id: "caliber", owner: "Newton", status: "completed", source: "agent", next_node_id: "cal-r1", requires_founder_action: false, worked_state: "worked", output_text: "Comprehensive 2,400-word brief with 7 cited sources. Covers mechanism of action, 4 clinical studies, community dosing protocols, UK competitor pricing, 4 content angles.", last_updated: "2026-03-28T11:00:00Z" },
    { id: "cal-r1", name: "Research Quality Review", type: "review", stage: 1, project_id: "caliber", owner: "Darwin", status: "completed", source: "agent", next_node_id: "cal-d1", requires_founder_action: false, worked_state: "worked", review_score: 8.5, review_notes: "All 7 sources verified. Dosing data from credible forums. 4 strong content angles.", last_updated: "2026-03-28T11:30:00Z" },
    { id: "cal-d1", name: "Proceed to Carousel", type: "decision", stage: 1, project_id: "caliber", owner: "Atlas", status: "completed", source: "agent", requires_founder_action: false, worked_state: "worked", decision_notes: "Research scored 8.5/10. Approved for carousel generation.", last_updated: "2026-03-28T12:00:00Z" },

    // ── CALIBER: Traffic chain (failed — carousel loop) ──
    { id: "cal-t2", name: "Generate Carousel Copy", type: "task", stage: 4, project_id: "caliber", owner: "Atlas", status: "failed", source: "stage", next_node_id: "cal-p2", requires_founder_action: false, worked_state: "failed", expects_prompt: true, blocker: "Copy scored 6.5/10 — hook too long, CTA not approved format", is_loop: true, loop_label: "Content Loop", loop_back_to: "cal-t2", last_updated: "2026-03-30T06:00:00Z" },
    { id: "cal-p2", name: "Carousel Copy Prompt v3", type: "prompt", stage: 4, project_id: "caliber", owner: "Atlas", status: "completed", source: "manual", next_node_id: "cal-o2", requires_founder_action: false, worked_state: "unknown", prompt_text: "You are the #1 scientific copywriter specializing in peptide education. Write a 7-slide Instagram carousel. Slide 1: Hook + peptide name (6 words max). Slides 2-6: Educational. Slide 7: CTA — 'DM us [KEYWORD]' or 'Link in bio'.", last_updated: "2026-03-30T05:00:00Z" },
    { id: "cal-o2", name: "BPC-157 Carousel Copy v3", type: "output", stage: 4, project_id: "caliber", owner: "Atlas", status: "failed", source: "agent", next_node_id: "cal-r2", requires_founder_action: false, worked_state: "failed", output_text: "7-slide carousel generated. Hook: 15 words (FAILED, max 6). CTA: 'Shop now' (FAILED — not approved format).", last_updated: "2026-03-30T06:00:00Z" },
    { id: "cal-r2", name: "Carousel Quality Gate", type: "review", stage: 4, project_id: "caliber", owner: "Darwin", status: "completed", source: "agent", next_node_id: "cal-d2", requires_founder_action: false, worked_state: "failed", review_score: 6.5, review_notes: "INSTANT REJECT: Hook 15 words (max 6). CTA not approved. Must fix before re-review.", last_updated: "2026-03-30T06:30:00Z" },
    { id: "cal-d2", name: "Rewrite Required", type: "decision", stage: 4, project_id: "caliber", owner: "Atlas", status: "in-progress", source: "agent", requires_founder_action: false, worked_state: "unknown", decision_notes: "Looping back to rewrite. Atlas to fix hook (<6 words) and CTA (approved format).", loop_back_to: "cal-t2", is_loop: true, loop_label: "Content Loop", last_updated: "2026-03-30T07:00:00Z" },

    // ── CALIBER: Traffic — Winning hooks (past) ──
    { id: "cal-wt1", name: "Generate Hooks", type: "task", stage: 4, project_id: "caliber", owner: "Atlas", status: "completed", source: "decision", next_node_id: "cal-wo1", requires_founder_action: false, worked_state: "winner", expects_prompt: true, last_updated: "2026-03-16T10:00:00Z", badges: ["🔁"] },
    // Missing prompt example — task expects prompt but none linked
    { id: "cal-wo1", name: "12 Hook Variants", type: "output", stage: 4, project_id: "caliber", owner: "Atlas", status: "completed", source: "agent", requires_founder_action: false, worked_state: "winner", output_text: "12 hooks generated. Top: 'Your body makes this peptide.' (4.2% engagement). 2 selected for carousel production.", last_updated: "2026-03-16T11:00:00Z" },

    // ── CALIBER: Traffic — Post → Analyze loop ──
    { id: "cal-post1", name: "Publish Content", type: "task", stage: 4, project_id: "caliber", owner: "Atlas", status: "completed", source: "stage", next_node_id: "cal-analyze1", requires_founder_action: false, worked_state: "worked", is_loop: true, loop_label: "Content Loop", loop_back_to: "cal-post1", last_updated: "2026-03-27T14:00:00Z" },
    { id: "cal-analyze1", name: "Analyze Post Performance", type: "task", stage: 4, project_id: "caliber", owner: "Darwin", status: "waiting-passive", source: "stage", next_node_id: "cal-decide1", requires_founder_action: false, worked_state: "unknown", wait_reason: "Waiting for 48h of engagement data", next_review: "Review in 24h", badges: ["⏱"], last_updated: "2026-03-29T10:00:00Z" },
    { id: "cal-decide1", name: "Create Variations or New", type: "decision", stage: 4, project_id: "caliber", owner: "Atlas", status: "not-started", source: "review", requires_founder_action: false, worked_state: "unknown", decision_notes: "If engagement >3%, create variations. If <2%, try new angle.", loop_back_to: "cal-post1", is_loop: true, loop_label: "Content Loop", last_updated: "2026-03-29T10:00:00Z" },

    // ── GEMSNAP: Conversion — A/B test (passive waiting) ──
    { id: "gem-t1", name: "Analyze Funnel Drop-Off", type: "task", stage: 5, project_id: "gemsnap", owner: "Atlas", status: "completed", source: "stage", next_node_id: "gem-p1", requires_founder_action: false, worked_state: "worked", expects_prompt: true, last_updated: "2026-03-29T09:00:00Z" },
    { id: "gem-p1", name: "Funnel Analysis Prompt v1", type: "prompt", stage: 5, project_id: "gemsnap", owner: "Atlas", status: "completed", source: "manual", next_node_id: "gem-o1", requires_founder_action: false, worked_state: "worked", prompt_text: "Using PostHog session data, analyze the GemSnap funnel. Calculate drop-off at each stage. Identify biggest leak. Recommend 1 A/B test.", last_updated: "2026-03-29T09:00:00Z" },
    { id: "gem-o1", name: "Funnel Analysis Report", type: "output", stage: 5, project_id: "gemsnap", owner: "Atlas", status: "completed", source: "agent", next_node_id: "gem-d1", requires_founder_action: false, worked_state: "worked", output_text: "Checkout biggest leak (62% drop-off). Recommended: show price on question page.", last_updated: "2026-03-29T10:00:00Z" },
    { id: "gem-d1", name: "Run A/B Test", type: "decision", stage: 5, project_id: "gemsnap", owner: "Ginge", status: "completed", source: "founder", next_node_id: "gem-t2", requires_founder_action: false, worked_state: "worked", decision_notes: "Approved: show price on question page. 50/50 split. Hold ad spend at $10/day.", last_updated: "2026-03-30T08:00:00Z" },
    { id: "gem-t2", name: "Implement A/B Test", type: "task", stage: 5, project_id: "gemsnap", owner: "Claude Code", status: "completed", source: "decision", next_node_id: "gem-wait1", requires_founder_action: false, worked_state: "worked", last_updated: "2026-03-30T08:30:00Z" },
    { id: "gem-wait1", name: "Wait for Test Results", type: "task", stage: 5, project_id: "gemsnap", owner: "System", status: "waiting-passive", source: "stage", next_node_id: "gem-t3", requires_founder_action: false, worked_state: "unknown", wait_reason: "Waiting for 1,000 visitors per variant for statistical significance", next_review: "Review on April 6", badges: ["⏱", "⚠️"], last_updated: "2026-03-31T07:00:00Z" },
    { id: "gem-t3", name: "Scale Ad Spend Decision", type: "decision", stage: 5, project_id: "gemsnap", owner: "Ginge", status: "waiting-founder", source: "stage", requires_founder_action: true, worked_state: "unknown", blocker: "A/B test still running — ROAS 1.4x at $10/day", notes: "If ROAS > 2x → $25/day. If ROAS > 3x → $50/day. If < 1x → pause.", is_loop: true, loop_label: "Optimization Loop", loop_back_to: "gem-t1", next_review: "Review weekly", last_updated: "2026-03-31T07:00:00Z" },

    // ── EDGE AUTO: Design — blocked + missing prompt ──
    { id: "edge-t1", name: "Build Audit Report Page", type: "task", stage: 2, project_id: "edge-auto", owner: "Claude Code", status: "blocked", source: "stage", next_node_id: "edge-p1", requires_founder_action: false, worked_state: "unknown", expects_prompt: true, blocker: "Design spec not finalised — need layout approval", last_updated: "2026-03-30T14:00:00Z" },
    { id: "edge-p1", name: "Audit Report Prompt v1", type: "prompt", stage: 2, project_id: "edge-auto", owner: "Atlas", status: "completed", source: "manual", next_node_id: "edge-o1", requires_founder_action: false, worked_state: "worked", prompt_text: "Generate a personalized automation audit. Calculate annual loss. Identify 5 automations. Include £4K offer + £12K guarantee.", last_updated: "2026-03-29T14:00:00Z" },
    { id: "edge-o1", name: "Sample Audit Report", type: "output", stage: 2, project_id: "edge-auto", owner: "Atlas", status: "completed", source: "agent", next_node_id: "edge-r1", requires_founder_action: false, worked_state: "worked", output_text: "9/10 — 5 automations identified. Total projected savings: £18K/yr.", last_updated: "2026-03-29T15:00:00Z" },
    { id: "edge-r1", name: "Report Quality Check", type: "review", stage: 2, project_id: "edge-auto", owner: "Darwin", status: "completed", source: "agent", next_node_id: "edge-d1", requires_founder_action: false, worked_state: "worked", review_score: 9, review_notes: "Strong report. Savings realistic. Ready for client use.", last_updated: "2026-03-29T16:00:00Z" },
    { id: "edge-d1", name: "Approve Report Template", type: "decision", stage: 2, project_id: "edge-auto", owner: "Ginge", status: "waiting-founder", source: "review", next_node_id: "edge-t2", requires_founder_action: true, worked_state: "unknown", decision_notes: "Report scored 9/10. Needs founder sign-off on guarantee wording and pricing.", next_review: "Review by April 3", last_updated: "2026-03-30T10:00:00Z" },
    { id: "edge-t2", name: "Client Onboarding Call", type: "task", stage: 2, project_id: "edge-auto", owner: "Ginge", status: "not-started", source: "stage", requires_founder_action: true, worked_state: "unknown", expects_prompt: true, notes: "30-min call with Todd. Blocked until report approved.", last_updated: "2026-03-30T10:00:00Z" },

    // ── CALIBER: Delivery loop ──
    { id: "del-t1", name: "Ship Order", type: "task", stage: 6, project_id: "caliber", owner: "Atlas", status: "completed", source: "stage", next_node_id: "del-t2", requires_founder_action: false, worked_state: "worked", is_loop: true, loop_label: "Delivery Loop", loop_back_to: "del-t1", last_updated: "2026-03-28T08:00:00Z" },
    { id: "del-t2", name: "Collect Feedback", type: "task", stage: 6, project_id: "caliber", owner: "Darwin", status: "waiting-passive", source: "stage", next_node_id: "del-t3", requires_founder_action: false, worked_state: "unknown", wait_reason: "Waiting for 7-day post-delivery feedback window", next_review: "Review daily", badges: ["⏱", "🔁"], last_updated: "2026-03-30T08:00:00Z" },
    { id: "del-t3", name: "Review Support Issues", type: "task", stage: 6, project_id: "caliber", owner: "Darwin", status: "not-started", source: "stage", next_node_id: "del-t4", requires_founder_action: false, worked_state: "unknown", next_review: "Review weekly", badges: ["🔁"], last_updated: "2026-03-30T08:00:00Z" },
    { id: "del-t4", name: "Improve Onboarding", type: "task", stage: 6, project_id: "caliber", owner: "Atlas", status: "not-started", source: "feedback", next_node_id: "del-t5", requires_founder_action: false, worked_state: "unknown", badges: ["🔁"], last_updated: "2026-03-30T08:00:00Z" },
    { id: "del-t5", name: "Monitor Satisfaction", type: "task", stage: 6, project_id: "caliber", owner: "Darwin", status: "waiting-passive", source: "stage", requires_founder_action: false, worked_state: "unknown", wait_reason: "Continuous: checking CSAT and repeat purchase rate", next_review: "Review weekly", is_loop: true, loop_label: "Delivery Loop", loop_back_to: "del-t1", badges: ["⏱", "🔁"], last_updated: "2026-03-30T08:00:00Z" },
  ],
};

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Main Page ── */
export default function FlowMapPage() {
  const [data, setData] = useState<FlowData>(FALLBACK);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<number | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set([1, 2, 4, 5, 6]));
  const [copied, setCopied] = useState(false);
  const [hidePassive, setHidePassive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/map-room/flow-map");
        if (!res.ok) return;
        const text = await res.text();
        if (!text.startsWith("{")) return;
        const json = JSON.parse(text);
        if (!cancelled && json && Array.isArray(json.nodes)) setData(json);
      } catch { /* keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Inject missing prompt nodes ──
  const enrichedNodes: FlowNode[] = [];
  for (const node of data.nodes) {
    enrichedNodes.push(node);
    // If task expects a prompt but next node is NOT a prompt, inject missing
    if (node.type === "task" && node.expects_prompt && node.next_node_id) {
      const nextNode = data.nodes.find((n) => n.id === node.next_node_id);
      if (nextNode && nextNode.type !== "prompt") {
        const missingId = `missing-prompt-${node.id}`;
        enrichedNodes.push({
          id: missingId, name: "Missing Prompt", type: "prompt",
          stage: node.stage, project_id: node.project_id, owner: "System",
          status: "missing", source: "system", next_node_id: node.next_node_id,
          requires_founder_action: false, worked_state: "failed",
          blocker: `Task "${node.name}" expects a prompt but none is linked`,
          badges: ["❌"], last_updated: node.last_updated,
        });
        // Patch the original node to point to missing prompt
        node.next_node_id = missingId;
      }
    }
    // If task expects prompt but has NO next node and no prompt after it
    if (node.type === "task" && node.expects_prompt && !node.next_node_id) {
      const missingId = `missing-prompt-${node.id}`;
      enrichedNodes.push({
        id: missingId, name: "Missing Prompt", type: "prompt",
        stage: node.stage, project_id: node.project_id, owner: "System",
        status: "missing", source: "system",
        requires_founder_action: false, worked_state: "failed",
        blocker: `Task "${node.name}" expects a prompt but none exists`,
        badges: ["❌"], last_updated: node.last_updated,
      });
      node.next_node_id = missingId;
    }
  }

  const nodes = hidePassive ? enrichedNodes.filter((n) => n.status !== "waiting-passive") : enrichedNodes;

  // Build chains
  const referencedIds = new Set(nodes.map((n) => n.next_node_id).filter(Boolean));
  const chainStarts = nodes.filter((n) => !referencedIds.has(n.id));

  function buildChain(startId: string): FlowNode[] {
    const chain: FlowNode[] = [];
    let current = nodes.find((n) => n.id === startId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      if (current.next_node_id) {
        current = nodes.find((n) => n.id === current!.next_node_id);
      } else break;
    }
    return chain;
  }

  const chains = chainStarts.map((start) => ({
    start, chain: buildChain(start.id), project_id: start.project_id, stage: start.stage,
  }));

  const filtered = chains.filter((c) => {
    if (filterProject && c.project_id !== filterProject) return false;
    if (filterStage !== null && c.stage !== filterStage) return false;
    return true;
  });

  const byStage: Record<number, typeof filtered> = {};
  for (const c of filtered) {
    if (!byStage[c.stage]) byStage[c.stage] = [];
    byStage[c.stage].push(c);
  }

  // Summary data
  const allNodes = enrichedNodes;
  const founderNodes = allNodes.filter((n) => (n.requires_founder_action || n.status === "waiting-founder") && n.status !== "completed");
  const missingPrompts = allNodes.filter((n) => n.status === "missing");
  const winningChains = chains.filter((c) => c.chain.some((n) => n.worked_state === "winner" || (n.worked_state === "worked" && n.review_score && n.review_score >= 8)));
  const brokenChains = chains.filter((c) => c.chain.some((n) => n.worked_state === "failed" || n.status === "blocked" || n.status === "failed" || n.status === "missing"));
  const passiveCount = allNodes.filter((n) => n.status === "waiting-passive").length;
  const loopCount = allNodes.filter((n) => n.is_loop).length;

  const toggleStage = (id: number) => {
    setExpandedStages((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: C.heading }}>Flow Map</h2>
          <p className="text-sm mt-1" style={{ color: C.body }}>
            Living execution system. Tasks, prompts, outputs, reviews, decisions — all connected.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hide passive toggle */}
          <button
            onClick={() => setHidePassive(!hidePassive)}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer"
            style={{
              background: hidePassive ? "rgba(0,212,212,0.1)" : C.card,
              borderColor: hidePassive ? "rgba(0,212,212,0.3)" : C.border,
              color: hidePassive ? C.accent : C.muted,
            }}
          >
            {hidePassive ? "Showing Active Only" : "Hide Passive Nodes"}
            {passiveCount > 0 && <span className="ml-1 text-[10px] opacity-60">({passiveCount})</span>}
          </button>
          <select value={filterProject || ""} onChange={(e) => setFilterProject(e.target.value || null)}
            className="text-sm px-3 py-1.5 rounded-lg border cursor-pointer"
            style={{ background: C.card, borderColor: C.border, color: C.body }}>
            <option value="">All Projects</option>
            {Object.entries(PROJECTS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
          </select>
          <select value={filterStage ?? ""} onChange={(e) => setFilterStage(e.target.value === "" ? null : Number(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border cursor-pointer"
            style={{ background: C.card, borderColor: C.border, color: C.body }}>
            <option value="">All Stages</option>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── SUMMARY PANELS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Needs Founder */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: founderNodes.length > 0 ? "rgba(245,158,11,0.4)" : C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.warn }}>NEEDS FOUNDER</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>{founderNodes.length}</span>
          </div>
          {founderNodes.length === 0 ? (
            <p className="text-xs" style={{ color: C.muted }}>No actions waiting on founder</p>
          ) : (
            <div className="space-y-2">
              {founderNodes.slice(0, 4).map((n) => (
                <button key={n.id} onClick={() => setSelectedNode(n)} className="w-full text-left rounded-lg px-3 py-2 transition-colors cursor-pointer" style={{ background: "rgba(245,158,11,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${TYPE_CONFIG[n.type]?.color || C.muted}18`, color: TYPE_CONFIG[n.type]?.color || C.muted }}>{TYPE_CONFIG[n.type]?.label || n.type}</span>
                    <span className="text-xs font-medium" style={{ color: C.heading }}>{n.name}</span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{PROJECTS[n.project_id]?.name} · {n.owner}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Winning Paths */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.success }}>WINNING PATHS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: C.success }}>{winningChains.length}</span>
          </div>
          {winningChains.length === 0 ? (
            <p className="text-xs" style={{ color: C.muted }}>No winning paths detected yet</p>
          ) : (
            <div className="space-y-2">
              {winningChains.slice(0, 3).map((wc) => (
                <div key={wc.start.id} className="rounded-lg px-3 py-2" style={{ background: "rgba(34,197,94,0.06)" }}>
                  <div className="flex items-center gap-1 flex-wrap">
                    {wc.chain.filter((n) => n.worked_state === "worked" || n.worked_state === "winner").slice(0, 4).map((n, i) => (
                      <span key={n.id} className="flex items-center gap-1">
                        {i > 0 && <span style={{ color: C.muted }}>→</span>}
                        <button onClick={() => setSelectedNode(n)} className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer" style={{ background: "rgba(34,197,94,0.12)", color: C.success }}>
                          {n.name.length > 20 ? n.name.slice(0, 18) + "…" : n.name}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: C.muted }}>{PROJECTS[wc.project_id]?.name}{wc.chain.find((n) => n.review_score) && ` · ${wc.chain.find((n) => n.review_score)?.review_score}/10`}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broken Paths */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: brokenChains.length > 0 ? "rgba(239,68,68,0.3)" : C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.error }}>BROKEN PATHS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>{brokenChains.length}</span>
            {missingPrompts.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>❌ {missingPrompts.length} missing prompt{missingPrompts.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {brokenChains.length === 0 ? (
            <p className="text-xs" style={{ color: C.muted }}>No broken paths</p>
          ) : (
            <div className="space-y-2">
              {brokenChains.slice(0, 3).map((bc) => {
                const failedNode = bc.chain.find((n) => n.worked_state === "failed" || n.status === "blocked" || n.status === "failed" || n.status === "missing");
                return (
                  <div key={bc.start.id} className="rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                    <div className="flex items-center gap-1 flex-wrap">
                      {bc.chain.slice(0, 5).map((n, i) => {
                        const isBroken = n.worked_state === "failed" || n.status === "blocked" || n.status === "failed" || n.status === "missing";
                        return (
                          <span key={n.id} className="flex items-center gap-1">
                            {i > 0 && <span style={{ color: C.muted }}>→</span>}
                            <button onClick={() => setSelectedNode(n)} className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer"
                              style={{ background: isBroken ? "rgba(239,68,68,0.15)" : "rgba(107,107,128,0.1)", color: isBroken ? C.error : C.body }}>
                              {n.status === "missing" ? "❌ " : ""}{n.name.length > 16 ? n.name.slice(0, 14) + "…" : n.name}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    {failedNode?.blocker && <div className="text-[10px] mt-1" style={{ color: C.error }}>{failedNode.blocker}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── System Stats ── */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total Nodes", value: allNodes.length, color: C.accent },
          { label: "Chains", value: chains.length, color: C.accent },
          { label: "Loops", value: loopCount, color: C.purple },
          { label: "Passive", value: passiveCount, color: C.passive },
          { label: "Missing Prompts", value: missingPrompts.length, color: missingPrompts.length > 0 ? C.error : C.muted },
        ].map((s) => (
          <div key={s.label} className="rounded-lg px-3 py-2 border" style={{ background: C.card, borderColor: C.border }}>
            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>{s.label}</span>
            <span className="text-base font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── STAGE LANES ── */}
      <div className="space-y-3">
        {STAGES.map((stage) => {
          const stageChains = byStage[stage.id];
          if (!stageChains || stageChains.length === 0) return null;
          const isExpanded = expandedStages.has(stage.id);
          const totalNodes = stageChains.reduce((s, c) => s + c.chain.length, 0);
          const blockedCount = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.status === "blocked" || n.status === "failed" || n.status === "missing").length, 0);
          const founderCount = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.requires_founder_action && n.status !== "completed").length, 0);
          const loopsInStage = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.is_loop).length, 0);
          const passiveInStage = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.status === "waiting-passive").length, 0);

          return (
            <div key={stage.id} className="rounded-xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
              <button onClick={() => toggleStage(stage.id)} className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors" style={{ color: C.heading }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}>{stage.id}</span>
                  <span className="font-semibold">{stage.label}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{stageChains.length} chain{stageChains.length !== 1 ? "s" : ""} · {totalNodes} nodes</span>
                  {loopsInStage > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: C.purple }}>🔁 {loopsInStage} loop nodes</span>}
                  {passiveInStage > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(74,111,165,0.15)", color: C.passive }}>⏱ {passiveInStage} waiting</span>}
                  {blockedCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>{blockedCount} blocked</span>}
                  {founderCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>{founderCount} needs founder</span>}
                </div>
                <span className="text-xs" style={{ color: C.muted }}>{isExpanded ? "▼" : "▶"}</span>
              </button>

              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-5" style={{ borderColor: C.border }}>
                  {stageChains.map((chainData) => {
                    const proj = PROJECTS[chainData.project_id];
                    const hasLoop = chainData.chain.some((n) => n.is_loop);
                    const loopLabel = chainData.chain.find((n) => n.loop_label)?.loop_label;
                    return (
                      <div key={chainData.start.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2 h-2 rounded-full" style={{ background: proj?.color || C.muted }} />
                          <span className="text-xs font-semibold" style={{ color: proj?.color || C.body }}>{proj?.name || chainData.project_id}</span>
                          {hasLoop && loopLabel && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: C.purple }}>
                              🔁 {loopLabel}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 ml-1">
                          {chainData.chain.map((node, nodeIdx) => {
                            const typeConf = TYPE_CONFIG[node.type] || TYPE_CONFIG.task;
                            const statusConf = STATUS_CONFIG[node.status] || STATUS_CONFIG["not-started"];
                            const isLast = nodeIdx === chainData.chain.length - 1;
                            const isMissing = node.status === "missing";
                            const isPassive = node.status === "waiting-passive";

                            return (
                              <div key={node.id}>
                                <button
                                  onClick={() => setSelectedNode(node)}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all cursor-pointer group"
                                  style={{
                                    background: selectedNode?.id === node.id ? "rgba(0,212,212,0.08)" : isMissing ? "rgba(239,68,68,0.04)" : isPassive ? "rgba(74,111,165,0.04)" : "transparent",
                                    borderLeft: `3px solid ${isMissing ? C.error : node.requires_founder_action && node.status !== "completed" ? C.warn : statusConf.dot}`,
                                    opacity: isMissing ? 0.85 : 1,
                                  }}
                                >
                                  {/* Type icon */}
                                  <span className="text-sm font-mono w-4 text-center flex-shrink-0" style={{ color: isMissing ? C.error : typeConf.color }}>
                                    {isMissing ? "✕" : typeConf.icon}
                                  </span>

                                  {/* Type badge */}
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 w-16 text-center"
                                    style={{ background: isMissing ? "rgba(239,68,68,0.15)" : `${typeConf.color}18`, color: isMissing ? C.error : typeConf.color }}>
                                    {isMissing ? "MISSING" : typeConf.label}
                                  </span>

                                  {/* Name */}
                                  <span className="text-sm font-medium flex-1 min-w-0 truncate group-hover:text-white transition-colors"
                                    style={{ color: isMissing ? C.error : C.heading, textDecoration: isMissing ? "line-through" : "none" }}>
                                    {isMissing ? "❌ " : ""}{node.name}
                                  </span>

                                  {/* Badges */}
                                  {node.badges && node.badges.length > 0 && (
                                    <span className="flex items-center gap-0.5 flex-shrink-0">
                                      {node.badges.map((b, i) => <span key={i} className="text-[10px]">{b}</span>)}
                                    </span>
                                  )}

                                  {/* Next review */}
                                  {node.next_review && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(74,111,165,0.12)", color: C.passive }}>
                                      ⏱ {node.next_review}
                                    </span>
                                  )}

                                  {/* Owner */}
                                  <span className="text-[10px] font-medium flex-shrink-0" style={{ color: OWNER_COLORS[node.owner] || C.muted }}>{node.owner}</span>

                                  {/* Review score */}
                                  {node.review_score !== undefined && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{ background: node.review_score >= 8 ? "rgba(34,197,94,0.15)" : node.review_score >= 6 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)", color: node.review_score >= 8 ? C.success : node.review_score >= 6 ? C.warn : C.error }}>
                                      {node.review_score}/10
                                    </span>
                                  )}

                                  {/* Status */}
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: statusConf.bg, color: statusConf.color }}>
                                    {statusConf.label}
                                  </span>

                                  {/* Founder */}
                                  {node.requires_founder_action && node.status !== "completed" && (
                                    <span className="text-[10px] px-1 rounded-full font-bold animate-pulse flex-shrink-0" style={{ color: C.warn }}>👤</span>
                                  )}

                                  {/* Time */}
                                  <span className="text-[10px] flex-shrink-0 w-12 text-right" style={{ color: C.muted }}>{timeAgo(node.last_updated)}</span>
                                </button>

                                {/* Connector */}
                                {!isLast && (
                                  <div className="flex items-center ml-5 pl-3 py-0.5 gap-1">
                                    {node.loop_back_to ? (
                                      <span className="text-xs" style={{ color: C.purple }}>↓ 🔁</span>
                                    ) : (
                                      <span className="text-xs" style={{ color: C.muted }}>↓</span>
                                    )}
                                  </div>
                                )}

                                {/* Loop back indicator at end of chain */}
                                {isLast && node.loop_back_to && (
                                  <div className="flex items-center ml-5 pl-3 py-1 gap-2">
                                    <span className="text-xs" style={{ color: C.purple }}>↩ 🔁</span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: C.purple }}>
                                      Loops back to start
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: C.border }}>
        <div className="flex flex-wrap gap-6 justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold block mb-2" style={{ color: C.muted }}>Node Types</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                <span key={key} className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: `${conf.color}18`, color: conf.color }}>{conf.icon} {conf.label}</span>
              ))}
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>✕ MISSING</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold block mb-2" style={{ color: C.muted }}>Statuses</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                <span key={key} className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: conf.dot }} />
                  <span style={{ color: conf.color }}>{conf.label}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold block mb-2" style={{ color: C.muted }}>Badges</span>
            <div className="flex flex-wrap gap-2 text-[10px]" style={{ color: C.body }}>
              <span>🔁 Loop</span> <span>⏱ Scheduled</span> <span>❌ Missing</span> <span>⚠️ Needs Input</span> <span>👤 Founder</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── NODE DETAIL MODAL ── */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedNode(null); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative rounded-2xl border w-full max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: C.bg, borderColor: C.border }}>
            {/* Header */}
            <div className="sticky top-0 border-b px-6 py-4 flex items-start justify-between z-10" style={{ background: C.bg, borderColor: C.border }}>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: selectedNode.status === "missing" ? "rgba(239,68,68,0.15)" : `${(TYPE_CONFIG[selectedNode.type] || TYPE_CONFIG.task).color}18`, color: selectedNode.status === "missing" ? C.error : (TYPE_CONFIG[selectedNode.type] || TYPE_CONFIG.task).color }}>
                    {selectedNode.status === "missing" ? "MISSING" : (TYPE_CONFIG[selectedNode.type] || TYPE_CONFIG.task).label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...(STATUS_CONFIG[selectedNode.status] || STATUS_CONFIG["not-started"]) }}>
                    {(STATUS_CONFIG[selectedNode.status] || STATUS_CONFIG["not-started"]).label}
                  </span>
                  {selectedNode.requires_founder_action && selectedNode.status !== "completed" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,158,11,0.2)", color: C.warn }}>👤 Founder Action Required</span>
                  )}
                  {selectedNode.is_loop && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(167,139,250,0.12)", color: C.purple }}>🔁 {selectedNode.loop_label || "Loop"}</span>
                  )}
                  {selectedNode.badges?.map((b, i) => <span key={i} className="text-[10px]">{b}</span>)}
                </div>
                <h3 className="text-lg font-bold" style={{ color: selectedNode.status === "missing" ? C.error : C.heading }}>
                  {selectedNode.status === "missing" ? "❌ " : ""}{selectedNode.name}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: C.body }}>
                  <span>{PROJECTS[selectedNode.project_id]?.name}</span>
                  <span style={{ color: C.muted }}>·</span>
                  <span style={{ color: OWNER_COLORS[selectedNode.owner] || C.body }}>{selectedNode.owner}</span>
                  <span style={{ color: C.muted }}>·</span>
                  <span>Stage {selectedNode.stage}</span>
                  <span style={{ color: C.muted }}>·</span>
                  <span>{timeAgo(selectedNode.last_updated)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-xl leading-none cursor-pointer p-1" style={{ color: C.muted }}>✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Wait reason */}
              {selectedNode.wait_reason && (
                <div className="rounded-lg border p-4" style={{ background: "rgba(74,111,165,0.06)", borderColor: "rgba(74,111,165,0.2)" }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.passive }}>Waiting For</div>
                  <p className="text-sm" style={{ color: C.heading }}>{selectedNode.wait_reason}</p>
                  {selectedNode.next_review && (
                    <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.passive }}>⏱ {selectedNode.next_review}</p>
                  )}
                </div>
              )}

              {/* Next review (standalone) */}
              {!selectedNode.wait_reason && selectedNode.next_review && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(74,111,165,0.08)" }}>
                  <span className="text-xs" style={{ color: C.passive }}>⏱ {selectedNode.next_review}</span>
                </div>
              )}

              {/* Worked state */}
              {selectedNode.worked_state !== "unknown" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Result</span>
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{
                    background: selectedNode.worked_state === "worked" ? "rgba(34,197,94,0.15)" : selectedNode.worked_state === "winner" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.15)",
                    color: selectedNode.worked_state === "failed" ? C.error : C.success,
                  }}>
                    {selectedNode.worked_state === "winner" ? "🏆 Winner" : selectedNode.worked_state === "worked" ? "✓ Worked" : "✗ Failed"}
                  </span>
                </div>
              )}

              {/* Blocker */}
              {selectedNode.blocker && (
                <div className="rounded-lg border p-4" style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.error }}>Blocker</div>
                  <p className="text-sm" style={{ color: C.heading }}>{selectedNode.blocker}</p>
                </div>
              )}

              {/* Prompt text */}
              {selectedNode.prompt_text && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Prompt</span>
                    <button onClick={() => copyText(selectedNode.prompt_text!)} className="text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer"
                      style={{ background: copied ? "rgba(34,197,94,0.1)" : C.card, borderColor: copied ? "rgba(34,197,94,0.3)" : C.border, color: copied ? C.success : C.body }}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed rounded-lg p-4 max-h-48 overflow-y-auto border" style={{ background: "#08080d", color: C.body, borderColor: C.border }}>
                    {selectedNode.prompt_text}
                  </pre>
                </div>
              )}

              {/* Output text */}
              {selectedNode.output_text && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Output</span>
                  <div className="rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}>
                    <p className="text-sm leading-relaxed" style={{ color: C.body }}>{selectedNode.output_text}</p>
                  </div>
                </div>
              )}

              {/* Review */}
              {(selectedNode.review_score !== undefined || selectedNode.review_notes) && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Review</span>
                  <div className="rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}>
                    {selectedNode.review_score !== undefined && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold" style={{ color: selectedNode.review_score >= 8 ? C.success : selectedNode.review_score >= 6 ? C.warn : C.error }}>{selectedNode.review_score}</span>
                        <span className="text-sm" style={{ color: C.muted }}>/10</span>
                      </div>
                    )}
                    {selectedNode.review_notes && <p className="text-sm leading-relaxed" style={{ color: C.body }}>{selectedNode.review_notes}</p>}
                  </div>
                </div>
              )}

              {/* Decision */}
              {selectedNode.decision_notes && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Decision</span>
                  <div className="rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}>
                    <p className="text-sm leading-relaxed" style={{ color: C.body }}>{selectedNode.decision_notes}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedNode.notes && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Notes</span>
                  <p className="text-sm" style={{ color: C.body }}>{selectedNode.notes}</p>
                </div>
              )}

              {/* Loop info */}
              {selectedNode.loop_back_to && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(167,139,250,0.06)" }}>
                  <span className="text-xs" style={{ color: C.purple }}>🔁 This node loops back — {selectedNode.loop_label || "continuous cycle"}</span>
                </div>
              )}

              {/* Next node */}
              {selectedNode.next_node_id && (() => {
                const next = nodes.find((n) => n.id === selectedNode.next_node_id);
                if (!next) return null;
                return (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Next</span>
                    <button onClick={() => setSelectedNode(next)} className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer" style={{ background: C.card, borderColor: C.border }}>
                      <span className="text-xs" style={{ color: C.accent }}>→</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: next.status === "missing" ? "rgba(239,68,68,0.15)" : `${(TYPE_CONFIG[next.type] || TYPE_CONFIG.task).color}18`, color: next.status === "missing" ? C.error : (TYPE_CONFIG[next.type] || TYPE_CONFIG.task).color }}>
                        {next.status === "missing" ? "MISSING" : (TYPE_CONFIG[next.type] || TYPE_CONFIG.task).label}
                      </span>
                      <span className="text-sm font-medium" style={{ color: next.status === "missing" ? C.error : C.heading }}>{next.name}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: C.border }}>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Source</span>
                  <span className="text-xs" style={{ color: C.body }}>{selectedNode.source}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Last Updated</span>
                  <span className="text-xs font-mono" style={{ color: C.body }}>{new Date(selectedNode.last_updated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs py-4" style={{ color: C.muted }}>
        {allNodes.length} nodes · {chains.length} chains · {loopCount} loop nodes · {passiveCount} passive · Last updated: {new Date(data.lastUpdated).toLocaleString("en-GB")}
      </div>
    </div>
  );
}
