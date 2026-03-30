"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Types ── */
interface StageTask {
  id: string;
  name: string;
  owner: string;
  status: "open" | "in-progress" | "blocked" | "done" | "cancelled";
  due: string;
  urgency: "critical" | "high" | "medium" | "low";
}

interface StagePrompt {
  id: string;
  name: string;
  version: string;
  text: string;
  updated_at: string;
}

interface StageOutput {
  id: string;
  name: string;
  text: string;
  timestamp: string;
  status: "fresh" | "stale" | "failed";
  linked_task_id: string;
  quality_score: number | null;
}

interface MissingItem {
  field_name: string;
  why_it_matters: string;
  expected_source: string;
}

interface PipelineProject {
  id: string;
  name: string;
  current_stage: number;
  status: "on-track" | "blocked" | "stalled";
  owners: string[];
  blocker_summary: string;
  stage_objective: string;
  stage_tasks: StageTask[];
  stage_prompts: StagePrompt[];
  outputs: StageOutput[];
  missing_items: MissingItem[];
  notes: string;
  automation_score: { automated: number; total: number };
}

/* ── Constants ── */
const STAGES = [
  { id: -1, label: "Idea Inbox" },
  { id: 0, label: "Idea" },
  { id: 1, label: "Validation" },
  { id: 2, label: "Design" },
  { id: 3, label: "MVP" },
  { id: 4, label: "Traffic" },
  { id: 5, label: "Conversion" },
  { id: 6, label: "Scale" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "on-track": { label: "On Track", color: "#22c55e", bg: "rgba(34,197,94,0.1)", dot: "#22c55e" },
  blocked: { label: "Blocked", color: "#ef4444", bg: "rgba(239,68,68,0.1)", dot: "#ef4444" },
  stalled: { label: "Stalled", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", dot: "#f59e0b" },
};

const URGENCY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  high: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  medium: { color: "#00d4d4", bg: "rgba(0,212,212,0.15)" },
  low: { color: "#6b6b80", bg: "rgba(107,107,128,0.15)" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#a0a0b0", bg: "rgba(160,160,176,0.1)" },
  "in-progress": { label: "In Progress", color: "#00d4d4", bg: "rgba(0,212,212,0.1)" },
  blocked: { label: "Blocked", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  done: { label: "Done", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  cancelled: { label: "Cancelled", color: "#6b6b80", bg: "rgba(107,107,128,0.1)" },
};

const OUTPUT_STATUS: Record<string, { color: string; bg: string }> = {
  fresh: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  stale: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  failed: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const OWNER_COLORS: Record<string, string> = {
  Atlas: "#60a5fa",
  Darwin: "#34d399",
  Newton: "#a78bfa",
  "Claude Code": "#fb923c",
  Architect: "#f472b6",
  Founder: "#fbbf24",
  Ginge: "#f472b6",
  Unassigned: "#f59e0b",
};

/* ── Fallback Data ── */
const FALLBACK_PROJECTS: PipelineProject[] = [
  {
    id: "caliber", name: "Caliber Peptides", current_stage: 4, status: "blocked",
    owners: ["Atlas", "Darwin", "Ginge"], blocker_summary: "Website conversion rate unknown",
    stage_objective: "Drive qualified traffic to website and measure conversion funnel.",
    stage_tasks: [
      { id: "cal-t1", name: "Set up PostHog tracking", owner: "Claude Code", status: "done", due: "2026-03-25", urgency: "critical" },
      { id: "cal-t2", name: "Launch carousel campaign", owner: "Atlas", status: "in-progress", due: "2026-03-28", urgency: "high" },
      { id: "cal-t3", name: "Write SEO articles", owner: "Newton", status: "open", due: "2026-04-05", urgency: "medium" },
    ],
    stage_prompts: [{ id: "cal-p1", name: "Carousel Copy Generator", version: "v3 — 2026-03-29", text: "You are the #1 scientific copywriter...", updated_at: "2026-03-29T14:30:00Z" }],
    outputs: [{ id: "cal-o1", name: "BPC-157 Carousel Copy", text: "Slide 1: 'Your Gut Has a Secret Weapon'...", timestamp: "2026-03-30T06:00:00Z", status: "stale", linked_task_id: "cal-t2", quality_score: 6.5 }],
    missing_items: [{ field_name: "Conversion rate baseline", why_it_matters: "Cannot evaluate traffic quality", expected_source: "PostHog (Darwin)" }],
    notes: "Focus on PostHog data this week.", automation_score: { automated: 2, total: 5 },
  },
  {
    id: "gemsnap", name: "GemSnap", current_stage: 5, status: "blocked",
    owners: ["Claude Code", "Ginge", "Atlas"], blocker_summary: "PostHog data pending",
    stage_objective: "Achieve 5% checkout conversion rate. Currently at 2.1%.",
    stage_tasks: [
      { id: "gem-t1", name: "A/B test pricing display", owner: "Claude Code", status: "done", due: "2026-03-28", urgency: "critical" },
      { id: "gem-t2", name: "Analyze A/B test results", owner: "Darwin", status: "blocked", due: "2026-04-04", urgency: "critical" },
    ],
    stage_prompts: [{ id: "gem-p1", name: "Funnel Analysis Prompt", version: "v2 — 2026-03-29", text: "Analyze the GemSnap funnel...", updated_at: "2026-03-29T09:00:00Z" }],
    outputs: [{ id: "gem-o1", name: "Funnel Analysis Report", text: "Checkout is biggest leak (62% drop-off)...", timestamp: "2026-03-29T09:00:00Z", status: "fresh", linked_task_id: "gem-t1", quality_score: 8.0 }],
    missing_items: [{ field_name: "A/B test results", why_it_matters: "Cannot decide pricing without data", expected_source: "PostHog" }],
    notes: "Variant B live. 50/50 split running.", automation_score: { automated: 1, total: 5 },
  },
  {
    id: "edge-auto", name: "Edge Auto", current_stage: 2, status: "blocked",
    owners: ["Ginge", "Claude Code", "Atlas"], blocker_summary: "Report page not built",
    stage_objective: "Complete personalised audit report page design.",
    stage_tasks: [
      { id: "edge-t1", name: "Design report page", owner: "Claude Code", status: "in-progress", due: "2026-03-31", urgency: "critical" },
      { id: "edge-t2", name: "Write report copy template", owner: "Atlas", status: "done", due: "2026-03-28", urgency: "high" },
    ],
    stage_prompts: [{ id: "edge-p1", name: "Audit Report Generator", version: "v2 — 2026-03-29", text: "Generate a personalized automation audit...", updated_at: "2026-03-29T14:00:00Z" }],
    outputs: [{ id: "edge-o1", name: "Sample Audit Report", text: "Your business is losing £18,200/year...", timestamp: "2026-03-29T14:00:00Z", status: "fresh", linked_task_id: "edge-t2", quality_score: 9.0 }],
    missing_items: [{ field_name: "Report page design", why_it_matters: "Client cannot visualise the product", expected_source: "Claude Code" }],
    notes: "Todd wants demo by April 3.", automation_score: { automated: 1, total: 4 },
  },
];

/* ── Page Component ── */
export default function PipelinePage() {
  const [projects, setProjects] = useState<PipelineProject[]>(FALLBACK_PROJECTS);
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set());
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [editingObjective, setEditingObjective] = useState<string | null>(null);
  const [objectiveDrafts, setObjectiveDrafts] = useState<Record<string, string>>({});

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/map-room/projects");
      if (res.ok) {
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
      }
    } catch {
      // Use fallback data
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = activeStage !== null
    ? projects.filter((p) => p.current_stage === activeStage)
    : projects;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const togglePrompt = (id: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleOutput = (id: string) => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyPromptText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditPrompt = (id: string, text: string) => {
    setEditingPrompt(id);
    setPromptDrafts((prev) => ({ ...prev, [id]: text }));
  };

  const savePromptEdit = (id: string) => {
    // In production, this would POST to the API
    setEditingPrompt(null);
  };

  const stageLabel = (id: number) => STAGES.find((s) => s.id === id)?.label ?? `Stage ${id}`;

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const isOverdue = (due: string, status: string) => {
    if (status === "done" || status === "cancelled") return false;
    return new Date(due) < new Date();
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold" style={{ color: "#ffffff" }}>Pipeline</h2>
        <p className="text-sm mt-1" style={{ color: "#6b6b80" }}>
          Stage-by-stage execution view — the operational core
        </p>
      </div>

      {/* ── Stage Rail ── */}
      <div className="mb-8 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 min-w-max pb-2">
          <button
            onClick={() => setActiveStage(null)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeStage === null ? "rgba(0,212,212,0.15)" : "transparent",
              color: activeStage === null ? "#00d4d4" : "#6b6b80",
              border: `1px solid ${activeStage === null ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`,
            }}
          >
            All
          </button>
          {STAGES.map((stage) => {
            const count = projects.filter((p) => p.current_stage === stage.id).length;
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(isActive ? null : stage.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={{
                  background: isActive ? "rgba(0,212,212,0.15)" : "#111118",
                  color: isActive ? "#00d4d4" : "#a0a0b0",
                  border: `1px solid ${isActive ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`,
                }}
              >
                <span className="font-mono text-xs" style={{ color: "#6b6b80" }}>{stage.id}</span>
                <span>{stage.label}</span>
                {count > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                    style={{ background: "rgba(0,212,212,0.2)", color: "#00d4d4" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Project Pipeline Cards ── */}
      <div className="space-y-4">
        {filteredProjects.length === 0 && (
          <div className="text-center py-16" style={{ color: "#6b6b80" }}>
            No projects at this stage
          </div>
        )}

        {filteredProjects.map((project) => {
          const isExpanded = expandedProject === project.id;
          const sc = STATUS_CONFIG[project.status];
          const sectionKey = (section: string) => `${project.id}-${section}`;

          return (
            <div
              key={project.id}
              className="rounded-xl overflow-hidden"
              style={{ background: "#111118", border: "1px solid #1e1e2e" }}
            >
              {/* Card Header — Always Visible */}
              <button
                onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                className="w-full px-6 py-5 flex items-center gap-4 transition-colors text-left cursor-pointer"
                style={{ borderBottom: isExpanded ? "1px solid #1e1e2e" : "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Project Name + Stage Badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <h3 className="text-lg font-bold" style={{ color: "#ffffff" }}>{project.name}</h3>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}
                    >
                      Stage {project.current_stage} — {stageLabel(project.current_stage)}
                    </span>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                      {sc.label}
                    </span>
                  </div>
                  {/* Owners */}
                  <div className="flex items-center gap-2 mb-1">
                    {project.owners.map((o) => (
                      <span key={o} className="text-xs font-medium" style={{ color: OWNER_COLORS[o] || "#a0a0b0" }}>
                        {o}
                      </span>
                    ))}
                  </div>
                  {/* Blocker */}
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    <span style={{ color: "#6b6b80" }}>Blocker:</span> {project.blocker_summary}
                  </p>
                </div>

                {/* Expand indicator */}
                <div className="flex-shrink-0 text-lg" style={{ color: "#6b6b80" }}>
                  {isExpanded ? "▲" : "▼"}
                </div>
              </button>

              {/* Card Expanded — Accordion Sections */}
              {isExpanded && (
                <div className="px-6 py-4 space-y-3">

                  {/* ── Stage Objective ── */}
                  <AccordionSection
                    title="Stage Objective"
                    badge="✏️ Manual"
                    isOpen={expandedSections.has(sectionKey("objective"))}
                    onToggle={() => toggleSection(sectionKey("objective"))}
                  >
                    {editingObjective === project.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={objectiveDrafts[project.id] ?? project.stage_objective}
                          onChange={(e) => setObjectiveDrafts((d) => ({ ...d, [project.id]: e.target.value }))}
                          className="w-full rounded-lg px-4 py-3 text-sm resize-y focus:outline-none"
                          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#a0a0b0", minHeight: 80 }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingObjective(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingObjective(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ color: "#6b6b80" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm leading-relaxed" style={{ color: "#a0a0b0" }}>
                          {project.stage_objective}
                        </p>
                        <button
                          onClick={() => {
                            setEditingObjective(project.id);
                            setObjectiveDrafts((d) => ({ ...d, [project.id]: project.stage_objective }));
                          }}
                          className="flex-shrink-0 text-xs px-2 py-1 rounded"
                          style={{ color: "#6b6b80" }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </AccordionSection>

                  {/* ── Stage Tasks ── */}
                  <AccordionSection
                    title="Stage Tasks"
                    badge="✏️ Manual + 🤖 Agent"
                    count={project.stage_tasks.length}
                    isOpen={expandedSections.has(sectionKey("tasks"))}
                    onToggle={() => toggleSection(sectionKey("tasks"))}
                  >
                    <div className="space-y-2">
                      {project.stage_tasks.map((task) => {
                        const ts = TASK_STATUS_CONFIG[task.status];
                        const urg = URGENCY_CONFIG[task.urgency];
                        const overdue = isOverdue(task.due, task.status);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg"
                            style={{
                              background: "#0a0a0f",
                              borderLeft: overdue ? "3px solid #f59e0b" : "3px solid transparent",
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer"
                              style={{
                                borderColor: task.status === "done" ? "#22c55e" : "#1e1e2e",
                                background: task.status === "done" ? "rgba(34,197,94,0.2)" : "transparent",
                              }}
                            >
                              {task.status === "done" && <span style={{ color: "#22c55e", fontSize: 10 }}>✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span
                                className="text-sm font-medium"
                                style={{
                                  color: task.status === "done" ? "#6b6b80" : "#ffffff",
                                  textDecoration: task.status === "done" ? "line-through" : "none",
                                }}
                              >
                                {task.name}
                              </span>
                            </div>
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: OWNER_COLORS[task.owner] || "#a0a0b0" }}>
                              {task.owner}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: urg.bg, color: urg.color }}
                            >
                              {task.urgency}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: ts.bg, color: ts.color }}
                            >
                              {ts.label}
                            </span>
                            <span
                              className="text-xs font-mono flex-shrink-0"
                              style={{ color: overdue ? "#f59e0b" : "#6b6b80" }}
                            >
                              {new Date(task.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              {overdue && " ⚠"}
                            </span>
                          </div>
                        );
                      })}
                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        style={{ border: "1px dashed #1e1e2e", color: "#6b6b80" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#00d4d4";
                          e.currentTarget.style.color = "#00d4d4";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#1e1e2e";
                          e.currentTarget.style.color = "#6b6b80";
                        }}
                      >
                        + Add Task
                      </button>
                    </div>
                  </AccordionSection>

                  {/* ── Stage Prompts ── */}
                  <AccordionSection
                    title="Stage Prompts"
                    badge="✏️ Manual"
                    count={project.stage_prompts.length}
                    isOpen={expandedSections.has(sectionKey("prompts"))}
                    onToggle={() => toggleSection(sectionKey("prompts"))}
                    critical
                  >
                    <div className="space-y-3">
                      {project.stage_prompts.map((prompt) => {
                        const isPromptExpanded = expandedPrompts.has(prompt.id);
                        const isEditing = editingPrompt === prompt.id;
                        return (
                          <div
                            key={prompt.id}
                            className="rounded-lg overflow-hidden"
                            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                          >
                            {/* Prompt Header */}
                            <button
                              onClick={() => togglePrompt(prompt.id)}
                              className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer"
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.3)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium" style={{ color: "#ffffff" }}>
                                  {prompt.name}
                                </span>
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                                  style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4" }}
                                >
                                  {prompt.version}
                                </span>
                              </div>
                              <span style={{ color: "#6b6b80", fontSize: 12 }}>
                                {isPromptExpanded ? "▲" : "▼"}
                              </span>
                            </button>

                            {/* Prompt Body — Hidden by Default */}
                            {isPromptExpanded && (
                              <div className="px-4 pb-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <button
                                    onClick={() => copyPromptText(prompt.id, isEditing ? (promptDrafts[prompt.id] ?? prompt.text) : prompt.text)}
                                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                                    style={{
                                      background: copiedId === prompt.id ? "rgba(34,197,94,0.15)" : "rgba(30,30,46,0.5)",
                                      color: copiedId === prompt.id ? "#22c55e" : "#a0a0b0",
                                      border: `1px solid ${copiedId === prompt.id ? "rgba(34,197,94,0.3)" : "#1e1e2e"}`,
                                    }}
                                  >
                                    {copiedId === prompt.id ? "Copied!" : "Copy"}
                                  </button>
                                  {!isEditing ? (
                                    <button
                                      onClick={() => startEditPrompt(prompt.id, prompt.text)}
                                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                                      style={{ background: "rgba(30,30,46,0.5)", color: "#a0a0b0", border: "1px solid #1e1e2e" }}
                                    >
                                      Edit
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => savePromptEdit(prompt.id)}
                                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                                      style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}
                                    >
                                      Save
                                    </button>
                                  )}
                                </div>
                                {isEditing ? (
                                  <textarea
                                    value={promptDrafts[prompt.id] ?? prompt.text}
                                    onChange={(e) => setPromptDrafts((d) => ({ ...d, [prompt.id]: e.target.value }))}
                                    className="w-full rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:outline-none"
                                    style={{
                                      background: "#070710",
                                      border: "1px solid rgba(0,212,212,0.3)",
                                      color: "#a0a0b0",
                                      minHeight: 200,
                                    }}
                                  />
                                ) : (
                                  <pre
                                    className="text-sm font-mono leading-relaxed whitespace-pre-wrap rounded-lg px-4 py-3 max-h-64 overflow-y-auto"
                                    style={{ background: "#070710", color: "#a0a0b0", border: "1px solid #1e1e2e" }}
                                  >
                                    {prompt.text}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionSection>

                  {/* ── Outputs ── */}
                  <AccordionSection
                    title="Outputs"
                    badge="🤖 Agent-generated"
                    count={project.outputs.length}
                    isOpen={expandedSections.has(sectionKey("outputs"))}
                    onToggle={() => toggleSection(sectionKey("outputs"))}
                  >
                    <div className="space-y-3">
                      {project.outputs.map((output) => {
                        const isOutputExpanded = expandedOutputs.has(output.id);
                        const os = OUTPUT_STATUS[output.status];
                        return (
                          <div
                            key={output.id}
                            className="rounded-lg overflow-hidden"
                            style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                          >
                            <button
                              onClick={() => toggleOutput(output.id)}
                              className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer"
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.3)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-medium" style={{ color: "#ffffff" }}>{output.name}</span>
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: os.bg, color: os.color }}
                                >
                                  {output.status}
                                </span>
                                {output.quality_score !== null && (
                                  <span className="text-[10px] font-mono" style={{ color: "#6b6b80" }}>
                                    🤖 Darwin: {output.quality_score}/10
                                  </span>
                                )}
                                <span className="text-[10px]" style={{ color: "#6b6b80" }}>
                                  {timeAgo(output.timestamp)}
                                </span>
                              </div>
                              <span style={{ color: "#6b6b80", fontSize: 12 }}>
                                {isOutputExpanded ? "▲" : "▼"}
                              </span>
                            </button>
                            {isOutputExpanded && (
                              <div className="px-4 pb-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-[10px]" style={{ color: "#6b6b80" }}>
                                    Task: {output.linked_task_id}
                                  </span>
                                  <button
                                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                                    style={{ background: "rgba(30,30,46,0.5)", color: "#6b6b80", border: "1px solid #1e1e2e" }}
                                  >
                                    ⚙️ Rerun
                                  </button>
                                </div>
                                <pre
                                  className="text-sm font-mono leading-relaxed whitespace-pre-wrap rounded-lg px-4 py-3 max-h-48 overflow-y-auto"
                                  style={{ background: "#070710", color: "#a0a0b0", border: "1px solid #1e1e2e" }}
                                >
                                  {output.text}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionSection>

                  {/* ── Missing Items ── */}
                  <AccordionSection
                    title="Missing Items"
                    badge="⚙️ Future automation"
                    count={project.missing_items.length}
                    isOpen={expandedSections.has(sectionKey("missing"))}
                    onToggle={() => toggleSection(sectionKey("missing"))}
                    warning={project.missing_items.length > 0}
                  >
                    <div className="space-y-2">
                      {project.missing_items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-4 py-3 rounded-lg"
                          style={{ background: "#0a0a0f", borderLeft: "3px solid #f59e0b" }}
                        >
                          <span style={{ color: "#f59e0b", fontSize: 14 }}>⚠</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block" style={{ color: "#ffffff" }}>
                              {item.field_name}
                            </span>
                            <span className="text-xs block mt-0.5" style={{ color: "#a0a0b0" }}>
                              {item.why_it_matters}
                            </span>
                            <span className="text-[10px] block mt-1" style={{ color: "#6b6b80" }}>
                              Source: {item.expected_source}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionSection>

                  {/* ── Notes ── */}
                  <AccordionSection
                    title="Notes"
                    badge="✏️ Manual"
                    isOpen={expandedSections.has(sectionKey("notes"))}
                    onToggle={() => toggleSection(sectionKey("notes"))}
                  >
                    {editingNotes === project.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={notesDrafts[project.id] ?? project.notes}
                          onChange={(e) => setNotesDrafts((d) => ({ ...d, [project.id]: e.target.value }))}
                          className="w-full rounded-lg px-4 py-3 text-sm resize-y focus:outline-none"
                          style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#a0a0b0", minHeight: 100 }}
                          placeholder="Add notes for this stage..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ color: "#6b6b80" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm leading-relaxed" style={{ color: "#a0a0b0" }}>
                          {project.notes || "No notes yet."}
                        </p>
                        <button
                          onClick={() => {
                            setEditingNotes(project.id);
                            setNotesDrafts((d) => ({ ...d, [project.id]: project.notes }));
                          }}
                          className="flex-shrink-0 text-xs px-2 py-1 rounded"
                          style={{ color: "#6b6b80" }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </AccordionSection>

                  {/* ── Automation Score ── */}
                  <AccordionSection
                    title="Automation Score"
                    badge="🔌 Placeholder"
                    isOpen={expandedSections.has(sectionKey("automation"))}
                    onToggle={() => toggleSection(sectionKey("automation"))}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-3 rounded-full overflow-hidden" style={{ background: "#0a0a0f" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(project.automation_score.automated / project.automation_score.total) * 100}%`,
                              background: "linear-gradient(90deg, #00d4d4, #22c55e)",
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-mono font-medium" style={{ color: "#00d4d4" }}>
                        {project.automation_score.automated} of {project.automation_score.total} tasks automated
                      </span>
                    </div>
                  </AccordionSection>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Accordion Section Component ── */
function AccordionSection({
  title,
  badge,
  count,
  isOpen,
  onToggle,
  children,
  critical,
  warning,
}: {
  title: string;
  badge: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  critical?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: isOpen ? "rgba(17,17,24,0.5)" : "transparent",
        border: `1px solid ${isOpen ? "#1e1e2e" : "transparent"}`,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: "#ffffff" }}>{title}</span>
          {count !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: "#1e1e2e", color: "#a0a0b0" }}>
              {count}
            </span>
          )}
          {warning && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
              Needs attention
            </span>
          )}
          {critical && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              Sensitive
            </span>
          )}
          <span className="text-[10px]" style={{ color: "#6b6b80" }}>{badge}</span>
        </div>
        <span style={{ color: "#6b6b80", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
