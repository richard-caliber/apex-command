"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const TOKEN = "apex-live-2026";

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
}

interface Prompt {
  id: string;
  name: string;
  text?: string;
  prompt?: string | { role?: string; context?: string; objective?: string; constraints?: string; process?: string; outputFormat?: string; qualityBar?: string };
  category?: string;
  stage?: string;
  taskId?: string;
}

/* ── Constants ── */
const STAGES = [
  { id: "inbox", name: "Inbox", number: -1 },
  { id: "idea", name: "Idea", number: 0 },
  { id: "validation", name: "Validation", number: 1 },
  { id: "design", name: "Design", number: 2 },
  { id: "mvp", name: "MVP", number: 3 },
  { id: "traffic", name: "Traffic", number: 4 },
  { id: "conversion", name: "Conversion", number: 5 },
  { id: "delivery", name: "Delivery", number: 6 },
  { id: "scale", name: "Scale", number: 7 },
];

const OWNERS: { id: string; emoji: string; label: string }[] = [
  { id: "atlas", emoji: "\u{1F9ED}", label: "Atlas" },
  { id: "newton", emoji: "\u{1F52C}", label: "Newton" },
  { id: "darwin", emoji: "\u{1F504}", label: "Darwin" },
  { id: "claude-code", emoji: "\u{1F4BB}", label: "Claude Code" },
  { id: "ginge", emoji: "\u{1F464}", label: "Ginge" },
  { id: "auto", emoji: "\u26A1", label: "Auto" },
  { id: "system", emoji: "\u2699\uFE0F", label: "System" },
];

function ownerInfo(id: string) {
  return OWNERS.find((o) => o.id === id) || { id, emoji: "\u2753", label: id };
}

const AUTO_COLORS: Record<string, { bg: string; text: string }> = {
  manual: { bg: "rgba(107,107,128,0.15)", text: "#6b6b80" },
  "semi-auto": { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  "fully-auto": { bg: "rgba(0,212,212,0.12)", text: "#00d4d4" },
};

/* ── API helpers ── */
async function apiPost(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiWrite(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ── Component ── */
export default function TaskLibraryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const fetchAll = useCallback(async () => {
    const [taskData, promptData] = await Promise.all([
      apiPost("/api/tasks", { action: "list", project_id: "_template" }),
      apiPost("/api/prompts", { action: "list" }),
    ]);
    if (taskData?.tasks) {
      setTasks(taskData.tasks.filter((t: Task) => !t.id.startsWith("A-")).sort((a: Task, b: Task) => a.order - b.order));
    }
    if (Array.isArray(promptData)) {
      setPrompts(promptData);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Save helpers ── */
  async function saveName(taskId: string, name: string) {
    setEditingName(null);
    if (!name.trim()) return;
    await apiWrite("/api/tasks", { action: "set", id: taskId, name: name.trim() });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, name: name.trim() } : t)));
  }

  async function saveOwner(taskId: string, owner: string) {
    setEditingOwner(null);
    await apiWrite("/api/tasks", { action: "set", id: taskId, owner });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, owner } : t)));
  }

  async function addTask(stage: string) {
    if (!newTaskName.trim()) return;
    const stageTasks = tasks.filter((t) => t.stage === stage);
    const maxOrder = stageTasks.length > 0 ? Math.max(...stageTasks.map((t) => t.order)) : 0;
    const stageNum = STAGES.find((s) => s.id === stage)?.number ?? 0;
    const taskNum = `T-${stageNum + 2}.${String(maxOrder + 1).padStart(2, "0")}`;
    const result = await apiWrite("/api/tasks", {
      action: "set",
      id: taskNum,
      stage,
      project_id: "_template",
      name: newTaskName.trim(),
      owner: "ginge",
      automation: "manual",
      order: maxOrder + 1,
    });
    if (result && !result.error) {
      setTasks((prev) => [...prev, result].sort((a: Task, b: Task) => a.order - b.order));
    }
    setNewTaskName("");
    setAddingTo(null);
  }

  function scrollToStage(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getPrompt(promptId: string): Prompt | undefined {
    return prompts.find((p) => p.id === promptId);
  }

  function getPromptText(p: Prompt): string {
    // Handle string prompt field
    if (typeof p.prompt === "string" && p.prompt) return p.prompt;
    // Handle object prompt field (PromptContent)
    if (p.prompt && typeof p.prompt === "object") {
      const parts = [p.prompt.role, p.prompt.context, p.prompt.objective, p.prompt.process, p.prompt.outputFormat, p.prompt.constraints, p.prompt.qualityBar].filter(Boolean);
      if (parts.length > 0) return parts.join("\n\n");
    }
    // Fallback to text field
    if (p.text) return p.text;
    return "Prompt content not loaded";
  }

  /* ── Stage counts ── */
  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.stage === s.id).length,
  }));

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── STAGE RAIL ── */}
      <nav className="overflow-x-auto scrollbar-hide -mx-1 mb-5">
        <div className="flex items-center gap-1 min-w-max px-1 py-2">
          {stageCounts.map((stage, i) => (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => scrollToStage(stage.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: stage.count > 0 ? "rgba(0,212,212,0.12)" : "rgba(30,30,46,0.6)",
                  border: `1px solid ${stage.count > 0 ? "rgba(0,212,212,0.3)" : "rgba(30,30,46,0.8)"}`,
                  color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                }}
              >
                <span className="text-xs font-semibold">{stage.name}</span>
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold"
                  style={{
                    background: stage.count > 0 ? "rgba(0,212,212,0.25)" : "rgba(107,107,128,0.15)",
                    color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                  }}
                >
                  {stage.count}
                </span>
              </button>
              {i < stageCounts.length - 1 && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mx-0.5">
                  <path d="M7 5L13 10L7 15" stroke="#2a2a3e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* ── STAGE SECTIONS ── */}
      <div className="space-y-0">
        {STAGES.map((stage) => {
          const stageTasks = tasks.filter((t) => t.stage === stage.id);

          return (
            <section
              key={stage.id}
              ref={(el) => { sectionRefs.current[stage.id] = el; }}
              className="scroll-mt-4"
            >
              {/* Stage heading */}
              <div
                className="flex items-center gap-2 py-2.5 sticky top-0 z-10"
                style={{ background: "var(--bg-primary, #0a0e1a)" }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#00d4d4" }}>
                  Stage {stage.number}: {stage.name}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "#4a4a5e" }}>
                  {stageTasks.length}
                </span>
                <div className="flex-1 h-px" style={{ background: "rgba(0,212,212,0.1)" }} />
                <button
                  onClick={() => { setAddingTo(addingTo === stage.id ? null : stage.id); setNewTaskName(""); }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-colors"
                  style={{ color: "#4a4a5e", background: addingTo === stage.id ? "rgba(0,212,212,0.1)" : "transparent" }}
                >
                  + Add Task
                </button>
              </div>

              {/* Task rows */}
              {stageTasks.length === 0 && addingTo !== stage.id && (
                <div className="py-1.5 pl-4 text-[11px] italic" style={{ color: "#2a2a3e" }}>
                  No tasks
                </div>
              )}

              {stageTasks.map((task) => {
                const ow = ownerInfo(task.owner);
                const ac = AUTO_COLORS[task.automation] || AUTO_COLORS.manual;
                const hasPrompt = task.prompt_id && task.prompt_id.length > 0;
                const isExpanded = expandedPrompt === task.id;
                const prompt = hasPrompt ? getPrompt(task.prompt_id) : undefined;

                return (
                  <div key={task.id}>
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 py-1.5 px-2 rounded transition-colors hover:bg-white/[0.02] group"
                      style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}
                    >
                      {/* Task number */}
                      <span
                        className="text-[11px] font-mono font-bold flex-shrink-0"
                        style={{ color: "#00d4d4", minWidth: "56px" }}
                      >
                        {task.id}
                      </span>

                      {/* Task name — click to edit */}
                      {editingName === task.id ? (
                        <input
                          autoFocus
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onBlur={() => saveName(task.id, editNameValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveName(task.id, editNameValue);
                            if (e.key === "Escape") setEditingName(null);
                          }}
                          className="flex-1 min-w-0 text-xs bg-transparent border-b outline-none py-0.5"
                          style={{ color: "#f1f5f9", borderColor: "#00d4d4" }}
                        />
                      ) : (
                        <span
                          className="flex-1 min-w-0 text-xs truncate cursor-pointer hover:underline"
                          style={{ color: "#e0e0ee" }}
                          onClick={() => { setEditingName(task.id); setEditNameValue(task.name); }}
                          title={task.description || task.name}
                        >
                          {task.name}
                        </span>
                      )}

                      {/* Automation badge */}
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 uppercase"
                        style={{ background: ac.bg, color: ac.text }}
                      >
                        {task.automation === "fully-auto" ? "auto" : task.automation === "semi-auto" ? "semi" : "manual"}
                      </span>

                      {/* Owner — click to change */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setEditingOwner(editingOwner === task.id ? null : task.id)}
                          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                          style={{ background: "rgba(107,107,128,0.1)", color: "#a0a0b0" }}
                        >
                          <span>{ow.emoji}</span>
                          <span>{ow.label}</span>
                        </button>
                        {editingOwner === task.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-30 rounded-lg py-1 shadow-xl"
                            style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", minWidth: "140px" }}
                          >
                            {OWNERS.map((o) => (
                              <button
                                key={o.id}
                                onClick={() => saveOwner(task.id, o.id)}
                                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer transition-colors hover:bg-white/[0.05]"
                                style={{ color: o.id === task.owner ? "#00d4d4" : "#a0a0b0" }}
                              >
                                <span>{o.emoji}</span>
                                <span>{o.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Prompt toggle */}
                      <button
                        onClick={() => setExpandedPrompt(isExpanded ? null : task.id)}
                        className="text-[11px] flex-shrink-0 cursor-pointer transition-colors px-2 py-0.5 rounded"
                        style={{
                          color: hasPrompt ? "#a0a0b0" : "#3a3a4e",
                          background: isExpanded ? "rgba(0,212,212,0.08)" : "transparent",
                        }}
                      >
                        {hasPrompt
                          ? isExpanded ? "\u{1F4DC} Prompt \u25B2" : "\u{1F4DC} Prompt \u25BC"
                          : "\u26A0\uFE0F No prompt"}
                      </button>
                    </div>

                    {/* Prompt expansion */}
                    {isExpanded && (
                      <div
                        className="ml-[68px] mr-2 mb-2 mt-1 rounded-lg px-4 py-3"
                        style={{ background: "rgba(0,212,212,0.04)", border: "1px solid rgba(0,212,212,0.1)" }}
                      >
                        {prompt ? (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold" style={{ color: "#00d4d4" }}>
                                {prompt.name}
                              </span>
                              <a
                                href="/prompts"
                                className="text-[10px] underline"
                                style={{ color: "#4a4a5e" }}
                              >
                                View in Prompt Library
                              </a>
                            </div>
                            <pre
                              className="text-[11px] leading-relaxed whitespace-pre-wrap"
                              style={{ color: "#a0a0b0" }}
                            >
                              {getPromptText(prompt)}
                            </pre>
                          </>
                        ) : hasPrompt ? (
                          <span className="text-[11px]" style={{ color: "#6b6b80" }}>
                            Prompt {task.prompt_id} — not found in library
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "#f59e0b" }}>
                            No prompt linked — add one from the Prompt Library
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add task input */}
              {addingTo === stage.id && (
                <div className="flex items-center gap-2 py-2 px-2">
                  <span className="text-[11px] font-mono" style={{ color: "#3a3a4e", minWidth: "56px" }}>
                    NEW
                  </span>
                  <input
                    autoFocus
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTask(stage.id);
                      if (e.key === "Escape") { setAddingTo(null); setNewTaskName(""); }
                    }}
                    placeholder="Task name..."
                    className="flex-1 text-xs bg-transparent border-b outline-none py-0.5"
                    style={{ color: "#f1f5f9", borderColor: "#2a2a3e" }}
                  />
                  <button
                    onClick={() => addTask(stage.id)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer"
                    style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingTo(null); setNewTaskName(""); }}
                    className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                    style={{ color: "#6b6b80" }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fadeIn 0.5s ease-out; }
      `}</style>
    </div>
  );
}
