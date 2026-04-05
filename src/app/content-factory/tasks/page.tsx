"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const TOKEN = "apex-live-2026";
const CONTENT_STAGES = new Set(["traffic", "conversion"]);
const CONTENT_PROJECT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

/* ── Types ── */
interface Task {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description: string;
  automation: string;
  owner: string;
  prompt_id: string;
  output: string;
  quality_gate: string;
  next_task: string;
  order: number;
  status: string;
  blocker: string | null;
}

interface Project { id: string; name: string; stage: string }

/* ── Constants ── */
const STAGES = [
  { id: "traffic", name: "Traffic", number: 4 },
  { id: "conversion", name: "Conversion", number: 5 },
];

const OWNERS: { id: string; emoji: string; label: string }[] = [
  { id: "atlas", emoji: "\u{1F9ED}", label: "Atlas" },
  { id: "newton", emoji: "\u{1F52C}", label: "Newton" },
  { id: "darwin", emoji: "\u{1F504}", label: "Darwin" },
  { id: "claude-code", emoji: "\u{1F4BB}", label: "Claude Code" },
  { id: "ginge", emoji: "\u{1F464}", label: "Ginge" },
  { id: "auto", emoji: "\u26A1", label: "Auto" },
];

function ownerInfo(id: string) { return OWNERS.find((o) => o.id === id) || { id, emoji: "\u2753", label: id }; }

const AUTO_COLORS: Record<string, { bg: string; text: string }> = {
  manual: { bg: "rgba(107,107,128,0.15)", text: "#6b6b80" },
  "semi-auto": { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  "fully-auto": { bg: "rgba(0,212,212,0.12)", text: "#00d4d4" },
};

const STATUS_DOT: Record<string, string> = {
  not_started: "#374151", in_progress: "#f59e0b", done: "#22c55e", blocked: "#ef4444", skipped: "#6b7280", continuous: "#a78bfa",
};

/* ── API helpers ── */
function apiPost(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

function apiWrite(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body) }).then((r) => r.json());
}

/* ── Component ── */
export default function ContentTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const fetchAll = useCallback(async () => {
    const [projData] = await Promise.all([
      apiPost("/api/projects", { action: "list" }),
    ]);
    const allProjects: Project[] = projData?.projects || [];
    const filtered = allProjects.filter((p: Project) => CONTENT_PROJECT_STAGES.has(p.stage));
    setProjects(filtered);
    if (!selectedProject && filtered.length > 0) setSelectedProject(filtered[0].id);
  }, [selectedProject]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch tasks when project changes
  useEffect(() => {
    if (!selectedProject) return;
    apiPost("/api/tasks", { action: "list", project_id: selectedProject }).then((data) => {
      if (data?.tasks) {
        setTasks(data.tasks.filter((t: Task) => CONTENT_STAGES.has(t.stage)).sort((a: Task, b: Task) => a.order - b.order));
      }
    });
  }, [selectedProject]);

  async function changeOwner(taskId: string, owner: string) {
    setEditingOwner(null);
    await apiWrite("/api/tasks", { action: "set", id: taskId, owner });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, owner } : t)));
  }

  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.stage === s.id).length,
  }));

  // Next undone task — only from the project's CURRENT stage
  const currentProject = projects.find((p) => p.id === selectedProject);
  const currentStage = currentProject?.stage || "";
  const currentStageTasks = tasks.filter((t) => t.stage === currentStage);
  const nextTask = currentStageTasks.find((t) => t.status !== "done" && t.status !== "in_progress" && t.status !== "skipped" && t.blocker !== "continuous");
  const allCurrentStageActive = !nextTask && currentStageTasks.length > 0 && currentStageTasks.every((t) => t.status === "done" || t.status === "in_progress");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Content Tasks</h1>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white cursor-pointer focus:outline-none focus:border-[#00d4d4] [&>option]:bg-[#0a0a0f] [&>option]:text-white">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Next undone task highlight */}
      {nextTask ? (
        <div className="rounded-xl p-4" style={{ background: "rgba(0,212,212,0.04)", border: "1px solid rgba(0,212,212,0.2)" }}>
          <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#00d4d4" }}>Next Task</div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono" style={{ color: "#00d4d4" }}>{nextTask.id}</span>
            <span className="text-sm font-semibold text-white">{nextTask.name}</span>
            <span className="text-xs" style={{ color: "#94a3b8" }}>{ownerInfo(nextTask.owner).emoji} {nextTask.owner}</span>
          </div>
          {nextTask.description && <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{nextTask.description}</p>}
        </div>
      ) : allCurrentStageActive ? (
        <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "#f59e0b" }}>Stage Gate</div>
          <span className="text-sm text-white">All tasks active — review stage gate.</span>
        </div>
      ) : null}

      {/* Stage navigation */}
      <div className="flex items-center gap-2">
        {stageCounts.map((s) => (
          <button key={s.id} onClick={() => sectionRefs.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: s.count > 0 ? "rgba(0,212,212,0.08)" : "rgba(30,30,46,0.6)", color: s.count > 0 ? "#00d4d4" : "#4a4a5e", border: `1px solid ${s.count > 0 ? "rgba(0,212,212,0.2)" : "#1e1e2e"}` }}>
            Stage {s.number}: {s.name}
            <span className="text-[10px] font-mono opacity-70">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Task list by stage */}
      {STAGES.map((stage) => {
        const stageTasks = tasks.filter((t) => t.stage === stage.id);
        return (
          <section key={stage.id} ref={(el) => { sectionRefs.current[stage.id] = el; }} className="scroll-mt-4">
            <div className="flex items-center gap-2 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#00d4d4" }}>
                Stage {stage.number}: {stage.name}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "#4a4a5e" }}>{stageTasks.length}</span>
              <div className="flex-1 h-px" style={{ background: "rgba(0,212,212,0.1)" }} />
            </div>

            {stageTasks.length === 0 && (
              <div className="py-1.5 pl-4 text-[11px] italic" style={{ color: "#2a2a3e" }}>No tasks</div>
            )}

            {stageTasks.map((task) => {
              const ow = ownerInfo(task.owner);
              const ac = AUTO_COLORS[task.automation] || AUTO_COLORS.manual;
              const isNext = task.id === nextTask?.id;

              return (
                <div key={task.id} style={{ borderLeft: isNext ? "3px solid #00d4d4" : "3px solid transparent" }}>
                  <div className="flex items-center gap-3 py-1.5 px-2 rounded transition-colors hover:bg-white/[0.02] group"
                    style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                    {/* Status dot */}
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[task.status] || "#374151" }} />

                    {/* Task ID */}
                    <span className="text-[11px] font-mono font-bold flex-shrink-0" style={{ color: "#00d4d4", minWidth: "56px" }}>{task.id}</span>

                    {/* Task name */}
                    <span className="flex-1 min-w-0 text-xs truncate" style={{ color: "#e0e0ee" }} title={task.description || task.name}>
                      {task.name}
                    </span>

                    {/* Automation badge */}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase"
                      style={{ background: ac.bg, color: ac.text }}>
                      {task.automation === "fully-auto" ? "auto" : task.automation === "semi-auto" ? "semi" : "manual"}
                    </span>

                    {/* Owner */}
                    <div className="relative flex-shrink-0">
                      <button onClick={() => setEditingOwner(editingOwner === task.id ? null : task.id)}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                        style={{ background: "rgba(107,107,128,0.1)", color: "#a0a0b0" }}>
                        <span>{ow.emoji}</span><span>{ow.label}</span>
                      </button>
                      {editingOwner === task.id && (
                        <div className="absolute right-0 top-full mt-1 z-30 rounded-lg py-1 shadow-xl"
                          style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", minWidth: "140px" }}>
                          {OWNERS.map((o) => (
                            <button key={o.id} onClick={() => changeOwner(task.id, o.id)}
                              className="w-full text-left px-3 py-1.5 text-[11px] cursor-pointer hover:bg-white/[0.05] flex items-center gap-2"
                              style={{ color: o.id === task.owner ? "#00d4d4" : "#a0a0b0", background: "transparent", border: "none" }}>
                              <span>{o.emoji}</span><span>{o.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Prompt toggle */}
                    <button onClick={() => setExpandedPrompt(expandedPrompt === task.id ? null : task.id)}
                      className="text-[11px] flex-shrink-0 cursor-pointer transition-colors px-2 py-0.5 rounded"
                      style={{ color: task.prompt_id ? "#a0a0b0" : "#3a3a4e", background: expandedPrompt === task.id ? "rgba(0,212,212,0.08)" : "transparent", border: "none" }}>
                      {task.prompt_id ? (expandedPrompt === task.id ? "\uD83D\uDCDC \u25B2" : "\uD83D\uDCDC \u25BC") : "\u26A0\uFE0F No prompt"}
                    </button>
                  </div>

                  {/* Output for done tasks */}
                  {task.status === "done" && task.output && expandedPrompt === task.id && (
                    <div className="ml-[68px] mr-2 mb-2 mt-1 rounded-lg px-4 py-3" style={{ background: "rgba(0,212,212,0.04)", border: "1px solid rgba(0,212,212,0.1)" }}>
                      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#a0a0b0", fontFamily: "inherit" }}>{task.output}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
