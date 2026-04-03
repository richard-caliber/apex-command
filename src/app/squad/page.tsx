"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

/* ── Types ── */
interface WorkspaceFile {
  name: string;
  path?: string;
  description?: string;
  size: string;
  updated_at: string;
  owner?: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  title: string;
  department: string;
  reports_to: string;
  status: "active" | "idle" | "blocked" | "error";
  current_model: string;
  current_task: string;
  task_since: string;
  layout: { row: number; col: number; x: number; y: number; connects_to: string[] };
  workspace_files: WorkspaceFile[];
  last_updated?: string;
  last_synced?: string;
}

/* ── Constants ── */
const STATUS_DOT: Record<string, { color: string; label: string }> = {
  active: { color: "#22c55e", label: "Active" },
  idle: { color: "#f59e0b", label: "Idle" },
  blocked: { color: "#ef4444", label: "Blocked" },
  error: { color: "#ef4444", label: "Error" },
};

const DEPT_COLOR: Record<string, string> = {
  Command: "#d4a800",
  Operations: "#00d4d4",
  Research: "#60a5fa",
  Evolution: "#a78bfa",
};

/* ── Main Page ── */
export default function SquadPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<"squad" | "files">("squad");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/squad");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (_e) { /* retry */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  // Build unique connections
  const connections: [string, string][] = [];
  const seen = new Set<string>();
  for (const agent of agents) {
    for (const target of agent.layout?.connects_to || []) {
      const key = [agent.id, target].sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        connections.push([agent.id, target]);
      }
    }
  }

  return (
    <div className="min-h-dvh relative overflow-hidden" style={{ background: "#0a0a0f" }}>
      {/* Circuit board dot pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, #00d4d4 0.5px, transparent 0)",
        backgroundSize: "30px 30px",
      }} />

      {/* Header */}
      <header className="hidden sm:block relative z-20 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">APEX COMMAND CENTRE</h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompt Library</Link>
              <span className="text-sm text-white font-medium">Squad</span>
              <Link href="/vault" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Keys</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <Link href="/action-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Action Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono text-xs">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2">
              <span className="refresh-dot" />
              <span className="text-xs">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="relative z-20 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8" style={{ background: "#0d0d14" }}>
        <div className="max-w-[1800px] mx-auto flex items-center gap-1 py-2">
          {(["squad", "files"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer"
              style={{
                background: tab === t ? "rgba(0, 212, 212, 0.1)" : "transparent",
                color: tab === t ? "#00d4d4" : "#6b6b80",
                borderBottom: tab === t ? "2px solid #00d4d4" : "2px solid transparent",
              }}
            >
              {t === "squad" ? "Squad" : "Files"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10">
        {!agents.length ? (
          <div className="text-center text-[#475569] text-sm py-20">Loading squad...</div>
        ) : tab === "squad" ? (
          <NeuralNetView agents={agents} connections={connections} />
        ) : (
          <FilesTab agents={agents} />
        )}
      </main>

      <style jsx>{`
        .neural-line { animation: line-pulse 3s ease-in-out infinite; }
        @keyframes line-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
      `}</style>
    </div>
  );
}

/* ── Neural Net View ── */
function NeuralNetView({ agents, connections }: { agents: Agent[]; connections: [string, string][] }) {
  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8 relative">
      {/* SVG Connection Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {connections.map(([fromId, toId]) => {
          const from = agents.find((a) => a.id === fromId);
          const to = agents.find((a) => a.id === toId);
          if (!from?.layout || !to?.layout) return null;
          const isGinge = fromId === "ginge" || toId === "ginge";
          return (
            <g key={`${fromId}-${toId}`}>
              <line
                x1={from.layout.x} y1={from.layout.y} x2={to.layout.x} y2={to.layout.y}
                stroke={isGinge ? "#d4a80040" : "#00d4d420"} strokeWidth="0.6" filter="url(#glow)"
              />
              <line
                x1={from.layout.x} y1={from.layout.y} x2={to.layout.x} y2={to.layout.y}
                stroke={isGinge ? "#d4a800" : "#00d4d4"} strokeWidth="0.15" opacity="0.7" className="neural-line"
              />
              <circle r="0.4" fill={isGinge ? "#d4a800" : "#00d4d4"} opacity="0.9">
                <animateMotion dur={`${3 + Math.random() * 2}s`} repeatCount="indefinite"
                  path={`M${from.layout.x},${from.layout.y} L${to.layout.x},${to.layout.y}`} />
              </circle>
              <circle r="0.4" fill={isGinge ? "#d4a800" : "#00d4d4"} opacity="0.9">
                <animateMotion dur={`${3 + Math.random() * 2}s`} repeatCount="indefinite"
                  begin={`${1.5 + Math.random()}s`}
                  path={`M${to.layout.x},${to.layout.y} L${from.layout.x},${from.layout.y}`} />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Agent Nodes */}
      <div className="relative z-10 min-h-[800px] sm:min-h-[680px]">
        {agents.map((agent) => (
          <AgentNode key={agent.id} agent={agent} agents={agents} />
        ))}
      </div>
    </div>
  );
}

/* ── Agent Node ── */
function AgentNode({ agent, agents }: { agent: Agent; agents: Agent[] }) {
  const isGinge = agent.id === "ginge";
  const s = STATUS_DOT[agent.status] || STATUS_DOT.idle;
  const deptColor = DEPT_COLOR[agent.department] || "#6b6b80";
  const reportsToAgent = agents.find((a) => a.id === agent.reports_to);
  const fileCount = agent.workspace_files?.length || 0;

  const posStyle = agent.layout ? {
    left: `${agent.layout.x}%`,
    top: `${agent.layout.y}%`,
    transform: "translate(-50%, -50%)",
  } : {};

  const card = (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(17, 24, 39, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: isGinge ? "1.5px solid #d4a80050" : "1px solid #1e293b",
        boxShadow: isGinge
          ? "0 0 20px rgba(212, 168, 0, 0.12), 0 0 40px rgba(212, 168, 0, 0.04)"
          : "0 0 12px rgba(0, 212, 212, 0.06)",
      }}
    >
      <div className="p-4 space-y-2.5">
        {/* Name + emoji */}
        <div className="flex items-center gap-2.5">
          <span className={isGinge ? "text-3xl" : "text-2xl"}>{agent.emoji}</span>
          <div className="min-w-0">
            <h3 className={`font-bold ${isGinge ? "text-lg text-[#d4a800]" : "text-base text-white"} leading-tight`}>
              {agent.name}
            </h3>
            <p className="text-[11px] text-[#94a3b8] leading-tight">{agent.title}</p>
          </div>
        </div>

        {/* Badges: department + model */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: deptColor, background: `${deptColor}15`, border: `1px solid ${deptColor}30` }}>
            {agent.department}
          </span>
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: "#94a3b8", background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)" }}>
            {agent.current_model || "No model"}
          </span>
        </div>

        {/* Current task */}
        {agent.current_task && (
          <p className="text-xs text-[#cbd5e1] leading-relaxed">{agent.current_task}</p>
        )}

        {/* Bottom row: status, files, synced */}
        <div className="flex items-center gap-3 text-[10px] flex-wrap pt-0.5">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 5px ${s.color}80` }} />
            <span style={{ color: s.color }}>{s.label}</span>
          </span>
          {fileCount > 0 && (
            <span className="text-[#475569]">{fileCount} files</span>
          )}
          <span className="text-[#475569]">
            {(agent.last_synced || agent.last_updated) ? timeAgo(agent.last_synced || agent.last_updated || "") : "Never synced"}
          </span>
        </div>

        {/* Reports to */}
        {reportsToAgent && (
          <p className="text-[10px] text-[#475569]">
            Reports to: <span className="text-[#94a3b8]">{reportsToAgent.emoji} {reportsToAgent.name}</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: absolute */}
      <div className="absolute hidden sm:block" style={{ ...posStyle, width: isGinge ? "280px" : "260px", zIndex: 10 }}>
        {card}
      </div>
      {/* Mobile: stacked */}
      <div className="sm:hidden mb-4 relative">{card}</div>
    </>
  );
}

/* ── Files Tab ── */
function FilesTab({ agents }: { agents: Agent[] }) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const agentsWithFiles = agents.filter((a) => a.workspace_files?.length > 0);
  const totalFiles = agents.reduce((sum, a) => sum + (a.workspace_files?.length || 0), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">All Workspace Files</h2>
        <span className="text-xs text-[#475569] font-mono">{totalFiles} files across {agentsWithFiles.length} agents</span>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => {
          const files = agent.workspace_files || [];
          if (files.length === 0) return null;
          const isOpen = expandedAgent === agent.id;
          const isGinge = agent.id === "ginge";
          const deptColor = DEPT_COLOR[agent.department] || "#6b6b80";

          return (
            <div
              key={agent.id}
              className="rounded-xl border overflow-hidden"
              style={{ background: "#111827", borderColor: isOpen ? `${deptColor}40` : "#1e293b" }}
            >
              {/* Agent header */}
              <button
                onClick={() => setExpandedAgent(isOpen ? null : agent.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xl">{agent.emoji}</span>
                <div className="flex-1 text-left">
                  <span className={`text-sm font-bold ${isGinge ? "text-[#d4a800]" : "text-white"}`}>{agent.name}</span>
                  <span className="text-xs text-[#64748b] ml-2">{agent.title}</span>
                </div>
                <span className="text-xs text-[#475569] font-mono">{files.length} files</span>
                <span className="text-xs text-[#475569]">{isOpen ? "\u25B2" : "\u25BC"}</span>
              </button>

              {/* File list */}
              {isOpen && (
                <div className="border-t px-5 pb-4" style={{ borderColor: "#1e293b" }}>
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-[#475569]">
                        <th className="text-left py-1.5 font-semibold">File</th>
                        <th className="text-left py-1.5 font-semibold hidden sm:table-cell">Description</th>
                        <th className="text-left py-1.5 font-semibold">Size</th>
                        <th className="text-left py-1.5 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((f, i) => (
                        <tr key={i} className="border-t border-[#1e293b]/50 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4">
                            <span className="font-mono text-xs text-[#00d4d4]">{f.name || f.path}</span>
                          </td>
                          <td className="py-2 pr-4 text-xs text-[#64748b] hidden sm:table-cell">{f.description || "\u2014"}</td>
                          <td className="py-2 pr-4 text-xs text-[#475569] font-mono">{f.size}</td>
                          <td className="py-2 text-xs text-[#475569]">
                            {f.updated_at ? timeAgo(f.updated_at) : "\u2014"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
