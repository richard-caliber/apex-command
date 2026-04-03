"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/* ── Types ── */
interface Task {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description: string;
  status: "not_started" | "in_progress" | "done" | "blocked" | "skipped";
  automation: string;
  owner: string;
  prompt_id: string;
  output: string;
  quality_gate: string;
  blocker: string | null;
  next_task: string;
  order: number;
  updated_at: string;
}

/* ── Constants ── */
const STAGES = [
  { id: "inbox", label: "Inbox", num: -1 },
  { id: "idea", label: "Idea", num: 0 },
  { id: "validation", label: "Validation", num: 1 },
  { id: "design", label: "Design", num: 2 },
  { id: "mvp", label: "MVP", num: 3 },
  { id: "traffic", label: "Traffic", num: 4 },
  { id: "conversion", label: "Conversion", num: 5 },
  { id: "delivery", label: "Delivery", num: 6 },
  { id: "scale", label: "Scale", num: 7 },
];

const SC: Record<string, string> = {
  done: "#22c55e", in_progress: "#00d4d4", not_started: "#374151", blocked: "#ef4444", skipped: "#6b7280",
};

const SL: Record<string, string> = {
  done: "Complete", in_progress: "Active", not_started: "Pending", blocked: "Blocked", skipped: "Skipped",
};

const OE: Record<string, string> = {
  ginge: "\uD83D\uDC51", atlas: "\uD83E\uDDED", newton: "\uD83D\uDD2C", darwin: "\uD83D\uDD04", "claude-code": "\uD83D\uDCBB", auto: "\u26A1",
};

const LOOP_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

/* ── Main ── */
export default function FlowMapPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("_template");
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [tR, pR] = await Promise.all([
        fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) }),
        fetch("/api/status"),
      ]);
      if (tR.ok) { const d = await tR.json(); setTasks(d.tasks || []); }
      if (pR.ok) { const d = await pR.json(); setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))); }
    } catch (_e) { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => tasks.filter((t) => t.project_id === selectedProject), [tasks, selectedProject]);

  const stageStats = useMemo(() => STAGES.map((stage) => {
    const st = filtered.filter((t) => t.stage === stage.id);
    const done = st.filter((t) => t.status === "done").length;
    const blocked = st.filter((t) => t.status === "blocked").length;
    const inProg = st.filter((t) => t.status === "in_progress").length;
    const total = st.length;
    const dom = blocked > 0 ? "blocked" : inProg > 0 ? "in_progress" : done === total && total > 0 ? "done" : "not_started";
    return { ...stage, tasks: st, done, blocked, inProg, total, dom };
  }), [filtered]);

  const founderBlocked = useMemo(() => filtered.filter((t) => t.status === "blocked" && t.owner === "ginge"), [filtered]);
  const stuckTasks = useMemo(() => filtered.filter((t) => t.status === "in_progress" && (Date.now() - new Date(t.updated_at).getTime()) > 48 * 3600000), [filtered]);
  const winningStages = useMemo(() => stageStats.filter((s) => s.total > 0 && s.done === s.total), [stageStats]);

  const totalT = tasks.length;
  const withP = tasks.filter((t) => t.prompt_id).length;
  const withO = tasks.filter((t) => t.output).length;
  const autoT = tasks.filter((t) => t.automation === "fully-auto" || t.automation === "semi-auto").length;
  const autoPct = totalT > 0 ? Math.round((autoT / totalT) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Flow Map</h1>
        <select value={selectedProject} onChange={(e) => { setSelectedProject(e.target.value); setExpandedStage(null); }}
          className="text-sm bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-white cursor-pointer focus:outline-none focus:border-[#00d4d4]">
          <option value="_template">Blueprint (Template)</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-[#475569] text-center py-20">Loading flow...</p>
      ) : (
        <>
          {/* Alert Panels */}
          {selectedProject !== "_template" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AlertPanel title="Needs Founder" color="#f59e0b" items={founderBlocked.length > 0 ? founderBlocked.map((t) => `${t.name}`) : null} />
              <AlertPanel title="Winning Paths" color="#22c55e" items={winningStages.length > 0 ? winningStages.map((s) => `${s.label} — ${s.done}/${s.total}`) : null} />
              <AlertPanel title="Broken Paths" color="#ef4444" items={stuckTasks.length > 0 ? stuckTasks.map((t) => `${t.name} — ${timeAgo(t.updated_at)}`) : null} />
            </div>
          )}

          {/* ── THE FLOW ── */}
          <div className="relative rounded-2xl border border-[#1e293b]/60 overflow-hidden" style={{ background: "#080810" }}>
            {/* Circuit texture */}
            <div className="absolute inset-0 opacity-[0.025]" style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, #00d4d4 0.5px, transparent 0)",
              backgroundSize: "20px 20px",
            }} />
            {/* Horizontal scan line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute w-full h-[1px] opacity-[0.04]" style={{
                background: "linear-gradient(90deg, transparent, #00d4d4, transparent)",
                animation: "scanline 8s ease-in-out infinite",
              }} />
            </div>

            {/* SVG Flow Layer */}
            <div className="relative z-10 px-4 sm:px-8 py-10">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  {/* Main pipeline SVG */}
                  <svg viewBox="0 0 900 120" className="w-full" style={{ minHeight: "120px" }}>
                    <defs>
                      <filter id="nodeGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      <filter id="lineGlow">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                      {/* Animated gradient for lines */}
                      <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00d4d4" stopOpacity="0.2" />
                        <stop offset="50%" stopColor="#00d4d4" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#00d4d4" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>

                    {/* Connection lines between stages */}
                    {stageStats.map((_, i) => {
                      if (i >= stageStats.length - 1) return null;
                      const x1 = 50 + i * 100 + 35;
                      const x2 = 50 + (i + 1) * 100 - 35;
                      const y = 55;
                      return (
                        <g key={`line-${i}`}>
                          {/* Glow line */}
                          <line x1={x1} y1={y} x2={x2} y2={y} stroke="#00d4d4" strokeWidth="3" opacity="0.08" filter="url(#lineGlow)" />
                          {/* Main line */}
                          <line x1={x1} y1={y} x2={x2} y2={y} stroke="#00d4d4" strokeWidth="1" opacity="0.25" />
                          {/* Flowing particle 1 */}
                          <circle r="2" fill="#00d4d4" opacity="0.7" filter="url(#lineGlow)">
                            <animateMotion dur={`${2 + i * 0.2}s`} repeatCount="indefinite" path={`M${x1},${y} L${x2},${y}`} />
                          </circle>
                          {/* Flowing particle 2 (offset) */}
                          <circle r="1.5" fill="#00d4d4" opacity="0.4">
                            <animateMotion dur={`${2.5 + i * 0.15}s`} repeatCount="indefinite" begin={`${1 + i * 0.1}s`} path={`M${x1},${y} L${x2},${y}`} />
                          </circle>
                        </g>
                      );
                    })}

                    {/* Loop arcs for stages 4-7 */}
                    {stageStats.map((stage, i) => {
                      if (!LOOP_STAGES.has(stage.id)) return null;
                      const cx = 50 + i * 100;
                      const color = SC[stage.dom];
                      return (
                        <g key={`loop-${i}`}>
                          <path
                            d={`M${cx - 20},${30} A20,15 0 1,1 ${cx + 20},${30}`}
                            fill="none" stroke={color} strokeWidth="0.8" opacity="0.3"
                            strokeDasharray="3 3"
                          />
                          <circle r="1.5" fill={color} opacity="0.6">
                            <animateMotion dur="3s" repeatCount="indefinite"
                              path={`M${cx - 20},${30} A20,15 0 1,1 ${cx + 20},${30}`} />
                          </circle>
                        </g>
                      );
                    })}

                    {/* Stage nodes */}
                    {stageStats.map((stage, i) => {
                      const cx = 50 + i * 100;
                      const cy = 55;
                      const color = SC[stage.dom];
                      const isHovered = hoveredStage === stage.id;
                      const isExpanded = expandedStage === stage.id;
                      const isActive = stage.dom === "in_progress" || stage.dom === "blocked";
                      const scale = isHovered ? 1.08 : 1;

                      return (
                        <g key={stage.id}
                          style={{ cursor: "pointer", transform: `scale(${scale})`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 0.2s ease" }}
                          onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                          onMouseEnter={() => setHoveredStage(stage.id)}
                          onMouseLeave={() => setHoveredStage(null)}
                        >
                          {/* Outer glow ring */}
                          <circle cx={cx} cy={cy} r="34" fill="none" stroke={color} strokeWidth="1.5" opacity={isActive ? "0.4" : "0.15"} filter="url(#nodeGlow)">
                            {isActive && (
                              <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" />
                            )}
                          </circle>

                          {/* Node background */}
                          <circle cx={cx} cy={cy} r="30" fill="#0a0e1a" stroke={color} strokeWidth={isExpanded ? "2" : "1.2"} opacity="1" />

                          {/* Inner fill */}
                          <circle cx={cx} cy={cy} r="28" fill={`${color}08`} />

                          {/* Stage label */}
                          <text x={cx} y={cy - 5} textAnchor="middle" fill={color} fontSize="9" fontWeight="700" letterSpacing="0.5" style={{ textTransform: "uppercase" }}>
                            {stage.label}
                          </text>

                          {/* Count */}
                          <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                            {stage.total > 0 ? `${stage.done}/${stage.total}` : "\u2014"}
                          </text>

                          {/* Status dot */}
                          <circle cx={cx + 22} cy={cy - 22} r="4" fill={color} opacity="0.8">
                            {isActive && (
                              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                            )}
                          </circle>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* ── Expanded Stage ── */}
              {expandedStage && (
                <ExpandedStage
                  stage={stageStats.find((s) => s.id === expandedStage)!}
                  allTasks={filtered}
                />
              )}
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total Tasks", value: totalT },
              { label: "With Prompts", value: withP },
              { label: "With Outputs", value: withO },
              { label: "Automation", value: `${autoPct}%` },
              { label: "Project Tasks", value: filtered.length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[#1e293b]/50 px-4 py-3 text-center relative overflow-hidden"
                style={{ background: "rgba(17, 24, 39, 0.6)", backdropFilter: "blur(8px)" }}>
                <div className="absolute inset-0 opacity-[0.02]" style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, #00d4d4 0.5px, transparent 0)",
                  backgroundSize: "16px 16px",
                }} />
                <div className="relative z-10">
                  <div className="text-xl font-bold text-white font-mono">{s.value}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes scanline {
          0% { top: -2px; }
          50% { top: 100%; }
          100% { top: -2px; }
        }
      `}</style>
    </div>
  );
}

/* ── Expanded Stage ── */
function ExpandedStage({ stage, allTasks }: {
  stage: { id: string; label: string; tasks: Task[] };
  allTasks: Task[];
}) {
  const sorted = [...stage.tasks].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <div className="mt-6 pt-4 border-t border-[#1e293b]/40">
        <p className="text-xs text-[#475569] italic text-center py-6">No tasks in {stage.label}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-[#1e293b]/40">
      <div className="text-[10px] uppercase tracking-widest text-[#64748b] font-bold mb-4">{stage.label} Task Flow</div>
      <div className="overflow-x-auto pb-3">
        <div className="flex items-center gap-0.5 min-w-max">
          {sorted.map((task, i) => {
            const color = SC[task.status];
            const isActive = task.status === "in_progress" || task.status === "blocked";
            const brokenNext = task.next_task && !allTasks.some((t) => t.id === task.next_task);

            return (
              <div key={task.id} className="flex items-center" style={{
                animation: `fadeSlideIn 0.3s ease forwards`,
                animationDelay: `${i * 0.06}s`,
                opacity: 0,
              }}>
                {/* Task node */}
                <div className="rounded-xl px-3.5 py-3 min-w-[150px] max-w-[190px] relative"
                  style={{
                    background: `${color}06`,
                    border: `1px solid ${color}35`,
                    boxShadow: isActive
                      ? `0 0 12px ${color}20, 0 0 24px ${color}08, inset 0 0 8px ${color}05`
                      : `0 0 6px ${color}08`,
                  }}>
                  {/* Status ring */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                  }}>
                    {isActive && (
                      <div className="absolute inset-0 rounded-full" style={{
                        background: color,
                        animation: "pulse-dot 2s ease-in-out infinite",
                      }} />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[9px] font-mono text-[#475569]">{task.id}</span>
                    {task.prompt_id && <span className="text-[8px]" title="Has prompt">📋</span>}
                    {task.output && <span className="text-[8px]" title="Has output">📄</span>}
                  </div>
                  <p className="text-[10px] text-[#cbd5e1] leading-snug mb-1.5 line-clamp-2">{task.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-semibold" style={{ color }}>{SL[task.status]}</span>
                    {task.owner && <span className="text-[9px]">{OE[task.owner] || task.owner}</span>}
                  </div>
                </div>

                {/* Arrow */}
                {i < sorted.length - 1 && (
                  <svg width="28" height="12" viewBox="0 0 28 12" className="flex-shrink-0">
                    <line x1="2" y1="6" x2="22" y2="6"
                      stroke={brokenNext ? "#ef4444" : "#00d4d4"}
                      strokeWidth="1"
                      opacity={brokenNext ? "0.5" : "0.2"}
                      strokeDasharray={brokenNext ? "3 2" : "none"}
                      filter="url(#lineGlow)"
                    />
                    <polygon points="22,3 26,6 22,9"
                      fill={brokenNext ? "#ef4444" : "#00d4d4"}
                      opacity={brokenNext ? "0.4" : "0.3"} />
                    {!brokenNext && (
                      <circle r="1.2" fill="#00d4d4" opacity="0.6">
                        <animateMotion dur={`${1 + i * 0.1}s`} repeatCount="indefinite" path="M2,6 L22,6" />
                      </circle>
                    )}
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ── Alert Panel ── */
function AlertPanel({ title, color, items }: { title: string; color: string; items: string[] | null }) {
  const empty = !items;
  return (
    <div className="rounded-xl border p-3.5 relative overflow-hidden" style={{
      background: "rgba(17, 24, 39, 0.7)",
      borderColor: `${color}25`,
      boxShadow: `inset 0 0 20px ${color}05`,
    }}>
      <h3 className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color }}>{title}</h3>
      {empty ? (
        <p className="text-xs text-[#475569] italic">{title === "Needs Founder" ? "Nothing blocked on you" : title === "Winning Paths" ? "No completed stages yet" : "No stalled tasks"}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <p key={i} className="text-xs text-[#cbd5e1] leading-relaxed">{item}</p>
          ))}
        </div>
      )}
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
