"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Design Tokens ── */
const C = {
  bg: "#0a0a0f", card: "#111118", border: "#1e1e2e",
  accent: "#00d4d4", warn: "#f59e0b", error: "#ef4444", success: "#22c55e",
  heading: "#ffffff", body: "#a0a0b0", muted: "#6b6b80",
  purple: "#a78bfa", blue: "#60a5fa", pink: "#f472b6", orange: "#fb923c",
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
  "blocked": { label: "Blocked", bg: "rgba(239,68,68,0.12)", color: C.error, dot: C.error },
  "failed": { label: "Failed", bg: "rgba(239,68,68,0.12)", color: C.error, dot: C.error },
  "winner": { label: "Winner", bg: "rgba(34,197,94,0.15)", color: C.success, dot: C.success },
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
  "Claude Code": C.orange, Ginge: C.pink, Architect: C.muted,
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
  const [data, setData] = useState<FlowData | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<number | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/map-room/flow-map");
      if (res.ok) setData(await res.json());
    } catch { /* fallback below */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold" style={{ color: C.heading }}>Flow Map</h2>
        <div className="text-sm animate-pulse" style={{ color: C.muted }}>Loading execution map...</div>
      </div>
    );
  }

  const nodes = data.nodes;

  // Build chains: find nodes that start chains (not referenced as next_node_id by anything)
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

  // Group chains by project and stage
  const chains = chainStarts.map((start) => ({
    start,
    chain: buildChain(start.id),
    project_id: start.project_id,
    stage: start.stage,
  }));

  // Filter
  const filtered = chains.filter((c) => {
    if (filterProject && c.project_id !== filterProject) return false;
    if (filterStage !== null && c.stage !== filterStage) return false;
    return true;
  });

  // Group by stage
  const byStage: Record<number, typeof filtered> = {};
  for (const c of filtered) {
    if (!byStage[c.stage]) byStage[c.stage] = [];
    byStage[c.stage].push(c);
  }

  // Summary panels
  const founderNodes = nodes.filter((n) => n.requires_founder_action && n.status !== "completed");
  const winningChains = chains.filter((c) => c.chain.some((n) => n.worked_state === "winner" || (n.worked_state === "worked" && n.review_score && n.review_score >= 8)));
  const brokenChains = chains.filter((c) => c.chain.some((n) => n.worked_state === "failed" || n.status === "blocked" || n.status === "failed"));

  const toggleStage = (id: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-expand stages that have data
  useEffect(() => {
    if (data) {
      const stagesWithData = new Set(filtered.map((c) => c.stage));
      setExpandedStages(stagesWithData);
    }
  }, [data, filterProject, filterStage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: C.heading }}>Flow Map</h2>
          <p className="text-sm mt-1" style={{ color: C.body }}>
            End-to-end execution map. Every task, prompt, output, review, and decision — connected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Project filter */}
          <select
            value={filterProject || ""}
            onChange={(e) => setFilterProject(e.target.value || null)}
            className="text-sm px-3 py-1.5 rounded-lg border cursor-pointer"
            style={{ background: C.card, borderColor: C.border, color: C.body }}
          >
            <option value="">All Projects</option>
            {Object.entries(PROJECTS).map(([id, p]) => (
              <option key={id} value={id}>{p.name}</option>
            ))}
          </select>
          {/* Stage filter */}
          <select
            value={filterStage ?? ""}
            onChange={(e) => setFilterStage(e.target.value === "" ? null : Number(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border cursor-pointer"
            style={{ background: C.card, borderColor: C.border, color: C.body }}
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ══════════ SUMMARY PANELS ══════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Needs Founder */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: founderNodes.length > 0 ? "rgba(245,158,11,0.4)" : C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.warn }}>NEEDS FOUNDER</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>
              {founderNodes.length}
            </span>
          </div>
          {founderNodes.length === 0 ? (
            <p className="text-xs" style={{ color: C.muted }}>No actions waiting on founder</p>
          ) : (
            <div className="space-y-2">
              {founderNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNode(n)}
                  className="w-full text-left rounded-lg px-3 py-2 transition-colors cursor-pointer"
                  style={{ background: "rgba(245,158,11,0.06)" }}
                >
                  <div className="text-xs font-medium" style={{ color: C.heading }}>{n.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                    {PROJECTS[n.project_id]?.name} · {n.owner} · {timeAgo(n.last_updated)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Winning Paths */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.success }}>WINNING PATHS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: C.success }}>
              {winningChains.length}
            </span>
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
                        <button
                          onClick={() => setSelectedNode(n)}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          style={{ background: "rgba(34,197,94,0.12)", color: C.success }}
                        >
                          {n.name.length > 20 ? n.name.slice(0, 18) + "…" : n.name}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: C.muted }}>
                    {PROJECTS[wc.project_id]?.name}
                    {wc.chain.find((n) => n.review_score) && ` · ${wc.chain.find((n) => n.review_score)?.review_score}/10`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broken Paths */}
        <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: brokenChains.length > 0 ? "rgba(239,68,68,0.3)" : C.border }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: C.error }}>BROKEN PATHS</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>
              {brokenChains.length}
            </span>
          </div>
          {brokenChains.length === 0 ? (
            <p className="text-xs" style={{ color: C.muted }}>No broken paths</p>
          ) : (
            <div className="space-y-2">
              {brokenChains.slice(0, 3).map((bc) => {
                const failedNode = bc.chain.find((n) => n.worked_state === "failed" || n.status === "blocked" || n.status === "failed");
                return (
                  <div key={bc.start.id} className="rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                    <div className="flex items-center gap-1 flex-wrap">
                      {bc.chain.slice(0, 4).map((n, i) => {
                        const isBroken = n.worked_state === "failed" || n.status === "blocked" || n.status === "failed";
                        return (
                          <span key={n.id} className="flex items-center gap-1">
                            {i > 0 && <span style={{ color: C.muted }}>→</span>}
                            <button
                              onClick={() => setSelectedNode(n)}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              style={{
                                background: isBroken ? "rgba(239,68,68,0.15)" : "rgba(107,107,128,0.1)",
                                color: isBroken ? C.error : C.body,
                              }}
                            >
                              {n.name.length > 18 ? n.name.slice(0, 16) + "…" : n.name}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    {failedNode?.blocker && (
                      <div className="text-[10px] mt-1" style={{ color: C.error }}>{failedNode.blocker}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════ STAGE LANES ══════════ */}
      <div className="space-y-3">
        {STAGES.map((stage) => {
          const stageChains = byStage[stage.id];
          if (!stageChains || stageChains.length === 0) return null;
          const isExpanded = expandedStages.has(stage.id);
          const totalNodes = stageChains.reduce((s, c) => s + c.chain.length, 0);
          const blockedCount = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.status === "blocked" || n.status === "failed").length, 0);
          const founderCount = stageChains.reduce((s, c) => s + c.chain.filter((n) => n.requires_founder_action && n.status !== "completed").length, 0);

          return (
            <div key={stage.id} className="rounded-xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
              {/* Stage Header */}
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors"
                style={{ color: C.heading }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}>
                    {stage.id}
                  </span>
                  <span className="font-semibold">{stage.label}</span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    {stageChains.length} chain{stageChains.length !== 1 ? "s" : ""} · {totalNodes} nodes
                  </span>
                  {blockedCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>
                      {blockedCount} blocked
                    </span>
                  )}
                  {founderCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>
                      {founderCount} needs founder
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: C.muted }}>{isExpanded ? "▼" : "▶"}</span>
              </button>

              {/* Chains */}
              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-5" style={{ borderColor: C.border }}>
                  {stageChains.map((chainData) => {
                    const proj = PROJECTS[chainData.project_id];
                    return (
                      <div key={chainData.start.id}>
                        {/* Chain project label */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2 h-2 rounded-full" style={{ background: proj?.color || C.muted }} />
                          <span className="text-xs font-semibold" style={{ color: proj?.color || C.body }}>{proj?.name || chainData.project_id}</span>
                        </div>

                        {/* Chain nodes */}
                        <div className="space-y-1 ml-1">
                          {chainData.chain.map((node, nodeIdx) => {
                            const typeConf = TYPE_CONFIG[node.type];
                            const statusConf = STATUS_CONFIG[node.status] || STATUS_CONFIG["not-started"];
                            const isLast = nodeIdx === chainData.chain.length - 1;

                            return (
                              <div key={node.id}>
                                <button
                                  onClick={() => setSelectedNode(node)}
                                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer group"
                                  style={{
                                    background: selectedNode?.id === node.id ? "rgba(0,212,212,0.08)" : "transparent",
                                    borderLeft: `3px solid ${node.requires_founder_action && node.status !== "completed" ? C.warn : statusConf.dot}`,
                                  }}
                                >
                                  {/* Type icon */}
                                  <span className="text-sm font-mono w-4 text-center flex-shrink-0" style={{ color: typeConf.color }}>
                                    {typeConf.icon}
                                  </span>

                                  {/* Type badge */}
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 w-16 text-center"
                                    style={{ background: `${typeConf.color}18`, color: typeConf.color }}>
                                    {typeConf.label}
                                  </span>

                                  {/* Name */}
                                  <span className="text-sm font-medium flex-1 min-w-0 truncate group-hover:text-white transition-colors" style={{ color: C.heading }}>
                                    {node.name}
                                  </span>

                                  {/* Owner */}
                                  <span className="text-[10px] font-medium flex-shrink-0" style={{ color: OWNER_COLORS[node.owner] || C.muted }}>
                                    {node.owner}
                                  </span>

                                  {/* Review score */}
                                  {node.review_score !== undefined && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{
                                        background: node.review_score >= 8 ? "rgba(34,197,94,0.15)" : node.review_score >= 6 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                                        color: node.review_score >= 8 ? C.success : node.review_score >= 6 ? C.warn : C.error,
                                      }}>
                                      {node.review_score}/10
                                    </span>
                                  )}

                                  {/* Status badge */}
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: statusConf.bg, color: statusConf.color }}>
                                    {statusConf.label}
                                  </span>

                                  {/* Founder flag */}
                                  {node.requires_founder_action && node.status !== "completed" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse flex-shrink-0"
                                      style={{ background: "rgba(245,158,11,0.2)", color: C.warn }}>
                                      👤
                                    </span>
                                  )}

                                  {/* Updated */}
                                  <span className="text-[10px] flex-shrink-0 w-14 text-right" style={{ color: C.muted }}>
                                    {timeAgo(node.last_updated)}
                                  </span>
                                </button>

                                {/* Connector arrow */}
                                {!isLast && (
                                  <div className="flex items-center ml-5 pl-3 py-0.5">
                                    <span className="text-xs" style={{ color: C.muted }}>↓</span>
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

      {/* Legend */}
      <div className="rounded-xl border p-4" style={{ background: C.card, borderColor: C.border }}>
        <div className="flex flex-wrap gap-4 justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold block mb-2" style={{ color: C.muted }}>Node Types</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                <span key={key} className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: `${conf.color}18`, color: conf.color }}>
                  {conf.icon} {conf.label}
                </span>
              ))}
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
        </div>
      </div>

      {/* ══════════ NODE DETAIL MODAL ══════════ */}
      {selectedNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedNode(null); }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative rounded-2xl border w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            style={{ background: C.bg, borderColor: C.border }}>

            {/* Modal Header */}
            <div className="sticky top-0 border-b px-6 py-4 flex items-start justify-between z-10" style={{ background: C.bg, borderColor: C.border }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: `${TYPE_CONFIG[selectedNode.type].color}18`, color: TYPE_CONFIG[selectedNode.type].color }}>
                    {TYPE_CONFIG[selectedNode.type].label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ ...(STATUS_CONFIG[selectedNode.status] || STATUS_CONFIG["not-started"]) }}>
                    {(STATUS_CONFIG[selectedNode.status] || STATUS_CONFIG["not-started"]).label}
                  </span>
                  {selectedNode.requires_founder_action && selectedNode.status !== "completed" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,158,11,0.2)", color: C.warn }}>
                      👤 Founder Action Required
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold" style={{ color: C.heading }}>{selectedNode.name}</h3>
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
              {/* Worked state */}
              {selectedNode.worked_state !== "unknown" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>Result</span>
                  <span className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{
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
                    <button
                      onClick={() => copyText(selectedNode.prompt_text!)}
                      className="text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer"
                      style={{
                        background: copied ? "rgba(34,197,94,0.1)" : C.card,
                        borderColor: copied ? "rgba(34,197,94,0.3)" : C.border,
                        color: copied ? C.success : C.body,
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed rounded-lg p-4 max-h-48 overflow-y-auto border"
                    style={{ background: "#08080d", color: C.body, borderColor: C.border }}>
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
                        <span className="text-2xl font-bold" style={{
                          color: selectedNode.review_score >= 8 ? C.success : selectedNode.review_score >= 6 ? C.warn : C.error,
                        }}>
                          {selectedNode.review_score}
                        </span>
                        <span className="text-sm" style={{ color: C.muted }}>/10</span>
                      </div>
                    )}
                    {selectedNode.review_notes && (
                      <p className="text-sm leading-relaxed" style={{ color: C.body }}>{selectedNode.review_notes}</p>
                    )}
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

              {/* Next node */}
              {selectedNode.next_node_id && (() => {
                const next = nodes.find((n) => n.id === selectedNode.next_node_id);
                if (!next) return null;
                return (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: C.muted }}>Next</span>
                    <button
                      onClick={() => setSelectedNode(next)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer"
                      style={{ background: C.card, borderColor: C.border }}
                    >
                      <span className="text-xs" style={{ color: C.accent }}>→</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${TYPE_CONFIG[next.type].color}18`, color: TYPE_CONFIG[next.type].color }}>
                        {TYPE_CONFIG[next.type].label}
                      </span>
                      <span className="text-sm font-medium" style={{ color: C.heading }}>{next.name}</span>
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
                  <span className="text-xs font-mono" style={{ color: C.body }}>
                    {new Date(selectedNode.last_updated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs py-4" style={{ color: C.muted }}>
        {nodes.length} nodes across {chains.length} execution chains · Last updated: {new Date(data.lastUpdated).toLocaleString("en-GB")}
      </div>
    </div>
  );
}
