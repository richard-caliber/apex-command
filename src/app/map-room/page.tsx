"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ── Types ── */
interface MapTask {
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

interface MapProject {
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

/* ── Constants ── */
const TOKEN = "apex-live-2026";

const STAGES = [
  { id: "idea", name: "Idea", desc: "Problem identified, opportunity spotted. Define the concept and validate demand." },
  { id: "research", name: "Research", desc: "Deep dive — market analysis, competitor intel, technical feasibility, audience profiling." },
  { id: "mvp-build", name: "MVP Build", desc: "Build the minimum viable product. Ship fast, get real users, collect data." },
  { id: "review-optimize", name: "Review & Optimize", desc: "Analyze performance. Fix leaks. A/B test. Iterate until metrics hit targets." },
  { id: "get-customer", name: "Get Customer", desc: "Outreach, ads, funnels, partnerships. Convert attention into paying customers." },
  { id: "deliver-retain", name: "Deliver & Retain", desc: "Fulfill the promise. Onboard, support, delight. Reduce churn, increase LTV." },
  { id: "scale-ascend", name: "Scale & Ascend", desc: "Systematize what works. Hire, automate, expand channels. Grow revenue 10x." },
  { id: "automated-cash-flow", name: "Automated Cash Flow", desc: "Fully autonomous revenue engine. Agents run ops. Human oversight only." },
];

const STAGE_INDEX: Record<string, number> = {};
STAGES.forEach((s, i) => { STAGE_INDEX[s.id] = i; });

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "on-track": { label: "On Track", color: "text-green-400", bg: "bg-green-500/10", dot: "bg-green-400" },
  "at-risk": { label: "At Risk", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  "blocked": { label: "Blocked", color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
};

const OWNER_COLORS: Record<string, string> = {
  Atlas: "text-blue-400",
  Darwin: "text-emerald-400",
  Newton: "text-purple-400",
  "Claude Code": "text-orange-400",
  Ginge: "text-pink-400",
};

/* ── Main Page ── */
export default function MapRoomPage() {
  const [data, setData] = useState<MapRoomData | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["idea"]));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<MapTask | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/map-room");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openTask = (task: MapTask) => {
    setSelectedTask(task);
    setPromptDraft(task.mega_prompt);
    setEditingPrompt(false);
    setCopied(false);
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(promptDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const savePrompt = async () => {
    if (!selectedTask) return;
    await fetch("/api/map-room", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ taskId: selectedTask.id, updates: { mega_prompt: promptDraft } }),
    });
    setSelectedTask({ ...selectedTask, mega_prompt: promptDraft });
    setEditingPrompt(false);
    fetchData();
  };

  const getProjectStageIndex = (stage: string) => STAGE_INDEX[stage] ?? -1;

  const stageName = (id: string) => STAGES.find((s) => s.id === id)?.name ?? id;

  const findTaskName = (taskId: string): string => {
    if (!data) return taskId;
    for (const p of data.projects) {
      const t = p.tasks.find((t) => t.id === taskId);
      if (t) return t.name;
    }
    return taskId;
  };

  const timeAgo = (iso: string | null): string => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1 hour ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-dvh relative">
      <Particles />

      {/* Header */}
      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Pipeline</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompts</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/ideas" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Ideas</Link>
              <span className="text-sm text-white font-medium">Map Room</span>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
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

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── MASTER JOURNEY MAP ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-[#f1f5f9] mb-4 flex items-center gap-2">
            <span className="text-[#64748b]">0 → 100</span> Master Journey
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((stage, i) => (
              <button
                key={stage.id}
                onClick={() => toggleStage(stage.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                  expandedStages.has(stage.id)
                    ? "bg-[#1e293b] border-[#334155] text-white"
                    : "bg-[#111827] border-[#1e293b] text-[#94a3b8] hover:border-[#334155] hover:text-white"
                }`}
              >
                <span className="text-xs font-mono text-[#475569] w-4">{i}</span>
                <span className="text-sm font-medium">{stage.name}</span>
                <span className="text-xs text-[#475569]">{expandedStages.has(stage.id) ? "▼" : "▶"}</span>
              </button>
            ))}
          </div>
          {STAGES.filter((s) => expandedStages.has(s.id)).map((stage) => (
            <div key={stage.id} className="mt-3 ml-1 pl-4 border-l-2 border-[#1e293b]">
              <p className="text-sm text-[#94a3b8]">
                <span className="font-semibold text-[#cbd5e1]">{stage.name}:</span> {stage.desc}
              </p>
            </div>
          ))}
        </section>

        {/* ── PROJECT JOURNEYS ── */}
        <section>
          <h2 className="text-lg font-bold text-[#f1f5f9] mb-4">Project Journeys</h2>

          {!data && (
            <div className="text-sm text-[#64748b] animate-pulse">Loading projects...</div>
          )}

          <div className="space-y-4">
            {data?.projects.map((project) => {
              const stageIdx = getProjectStageIndex(project.current_stage);
              const isExpanded = expandedProjects.has(project.id);
              const taskStats = {
                total: project.tasks.length,
                onTrack: project.tasks.filter((t) => t.status === "on-track").length,
                atRisk: project.tasks.filter((t) => t.status === "at-risk").length,
                blocked: project.tasks.filter((t) => t.status === "blocked").length,
              };

              return (
                <div key={project.id} className="rounded-xl bg-[#111827] border border-[#1e293b] overflow-hidden">
                  {/* Project Header */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#1e293b]/30 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-bold text-white">{project.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e293b] text-[#94a3b8] font-medium">
                          {stageName(project.current_stage)}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b] truncate">{project.blocker}</p>
                    </div>

                    {/* Task counts */}
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      {taskStats.onTrack > 0 && (
                        <span className="flex items-center gap-1 text-green-400">
                          <span className="w-2 h-2 rounded-full bg-green-400" />
                          {taskStats.onTrack}
                        </span>
                      )}
                      {taskStats.atRisk > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          {taskStats.atRisk}
                        </span>
                      )}
                      {taskStats.blocked > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          {taskStats.blocked}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex gap-0.5">
                        {STAGES.map((s, i) => (
                          <div
                            key={s.id}
                            className={`w-5 h-2 rounded-sm transition-colors ${
                              i <= stageIdx
                                ? i === stageIdx
                                  ? "bg-blue-500"
                                  : "bg-blue-500/40"
                                : "bg-[#1e293b]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[#475569] w-4">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {/* Expanded: Task List */}
                  {isExpanded && (
                    <div className="border-t border-[#1e293b] px-5 py-3">
                      <div className="space-y-2">
                        {project.tasks.map((task) => {
                          const badge = STATUS_BADGE[task.status];
                          return (
                            <button
                              key={task.id}
                              onClick={() => openTask(task)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1e293b]/50 transition-colors cursor-pointer text-left group"
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${badge.dot}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-[#f1f5f9] group-hover:text-white font-medium">
                                  {task.name}
                                </span>
                              </div>
                              <span className={`text-xs font-medium ${OWNER_COLORS[task.owner] || "text-[#94a3b8]"}`}>
                                {task.owner}
                              </span>
                              <span className="text-xs text-[#475569] font-mono w-16 text-right">
                                {task.model.length > 12 ? task.model.slice(0, 12) + "…" : task.model}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-xs text-[#475569]">→</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="relative z-10 text-center text-xs text-[#475569] py-6">
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "—"}
        {" · "}Auto-refreshes every 60s
      </footer>

      {/* ── TASK DETAIL MODAL ── */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedTask(null); setEditingPrompt(false); } }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#0d1117] border border-[#1e293b] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0d1117] border-b border-[#1e293b] px-6 py-4 flex items-start justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedTask.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-[#64748b]">{stageName(selectedTask.stage)}</span>
                  <span className="text-[#334155]">·</span>
                  <span className={OWNER_COLORS[selectedTask.owner] || "text-[#94a3b8]"}>{selectedTask.owner}</span>
                  <span className="text-[#334155]">·</span>
                  <span className="text-[#94a3b8] font-mono">{selectedTask.model}</span>
                  <span className="text-[#334155]">·</span>
                  <span className="text-[#64748b]">{selectedTask.timing}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedTask(null); setEditingPrompt(false); }}
                className="text-[#64748b] hover:text-white transition-colors text-xl leading-none cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Status & Execution */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(() => {
                  const badge = STATUS_BADGE[selectedTask.status];
                  return (
                    <div className="bg-[#111827] rounded-lg px-3 py-2">
                      <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Status</div>
                      <div className={`text-sm font-medium flex items-center gap-1.5 ${badge.color}`}>
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </div>
                    </div>
                  );
                })()}
                <div className="bg-[#111827] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Last Run</div>
                  <div className="text-sm text-[#cbd5e1]">{timeAgo(selectedTask.last_run)}</div>
                </div>
                <div className="bg-[#111827] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Runs</div>
                  <div className="text-sm text-[#cbd5e1]">{selectedTask.execution_count}</div>
                </div>
                <div className="bg-[#111827] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Timing</div>
                  <div className="text-sm text-[#cbd5e1]">{selectedTask.timing}</div>
                </div>
              </div>

              {/* Last Result */}
              <div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Last Result</div>
                <p className="text-sm text-[#cbd5e1] bg-[#111827] rounded-lg px-4 py-3">{selectedTask.last_result}</p>
              </div>

              {/* Mega Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Mega Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyPrompt}
                      className={`text-xs px-3 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        copied
                          ? "bg-green-500/10 border-green-500/30 text-green-400"
                          : "bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569]"
                      }`}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    {!editingPrompt ? (
                      <button
                        onClick={() => setEditingPrompt(true)}
                        className="text-xs px-3 py-1 rounded-lg border bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569] cursor-pointer font-medium transition-all"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={savePrompt}
                        className="text-xs px-3 py-1 rounded-lg border bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 cursor-pointer font-medium transition-all"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
                {editingPrompt ? (
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    className="w-full h-64 bg-[#0a0e1a] border border-[#334155] rounded-lg p-4 text-sm text-[#cbd5e1] font-mono leading-relaxed resize-y focus:outline-none focus:border-blue-500/50"
                  />
                ) : (
                  <pre className="text-sm text-[#cbd5e1] whitespace-pre-wrap font-mono leading-relaxed bg-[#0a0e1a] rounded-lg p-4 max-h-64 overflow-y-auto border border-[#1e293b]">
                    {selectedTask.mega_prompt}
                  </pre>
                )}
              </div>

              {/* Success Criteria */}
              <div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Success Criteria</div>
                <ul className="space-y-1.5">
                  {selectedTask.success_criteria.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[#cbd5e1]">
                      <span className="w-4 h-4 rounded border border-[#334155] flex items-center justify-center text-[10px] text-[#475569] flex-shrink-0">
                        {i + 1}
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dependencies */}
              {(selectedTask.dependencies_input.length > 0 || selectedTask.dependencies_output.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedTask.dependencies_input.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Depends On</div>
                      <div className="space-y-1">
                        {selectedTask.dependencies_input.map((dep) => (
                          <div key={dep} className="text-xs text-[#94a3b8] bg-[#111827] rounded px-3 py-1.5">
                            ← {findTaskName(dep)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTask.dependencies_output.length > 0 && (
                    <div>
                      <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Feeds Into</div>
                      <div className="space-y-1">
                        {selectedTask.dependencies_output.map((dep) => (
                          <div key={dep} className="text-xs text-[#94a3b8] bg-[#111827] rounded px-3 py-1.5">
                            → {findTaskName(dep)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1e293b]">
                <button className="text-xs px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors cursor-pointer">
                  Run Task
                </button>
                <button
                  onClick={() => setEditingPrompt(true)}
                  className="text-xs px-4 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] font-medium hover:text-white transition-colors cursor-pointer"
                >
                  Edit Prompt
                </button>
                <button className="text-xs px-4 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] font-medium hover:text-white transition-colors cursor-pointer">
                  View History
                </button>
                <button className="text-xs px-4 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] font-medium hover:text-white transition-colors cursor-pointer">
                  Analyze Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Particles ── */
function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
        />
      ))}
    </div>
  );
}
