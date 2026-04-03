"use client";

import { useState, useEffect, useRef } from "react";

/* ─────────────────────────── TYPES ─────────────────────────── */

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

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  objective: string;
  entry_criteria: string;
  exit_criteria: string;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  status: string;
}

/* ─────────────────────────── CONSTANTS ─────────────────────── */

const STAGE_ORDER = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];

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

const STATUS_CFG: Record<string, { icon: string; label: string; color: string }> = {
  not_started: { icon: "\u2B1C", label: "Not Started", color: TOKENS.muted },
  in_progress: { icon: "\uD83D\uDFE1", label: "In Progress", color: TOKENS.warn },
  done: { icon: "\u2705", label: "Done", color: TOKENS.success },
  blocked: { icon: "\uD83D\uDD34", label: "Blocked", color: TOKENS.error },
  skipped: { icon: "\u26A0\uFE0F", label: "Skipped", color: TOKENS.warn },
};

const OWNER_EMOJI: Record<string, string> = {
  ginge: "\uD83D\uDC51",
  atlas: "\uD83C\uDFAF",
  darwin: "\uD83D\uDD2C",
  newton: "\uD83E\uDDE0",
  "claude-code": "\uD83E\uDD16",
  system: "\u2699\uFE0F",
};

const FALLBACK_STAGES: PipelineStage[] = [
  { id: "inbox", name: "Inbox", order: 0, objective: "Capture and triage incoming ideas", entry_criteria: "Any idea or signal", exit_criteria: "Tagged and triaged" },
  { id: "idea", name: "Idea", order: 1, objective: "Clarify the problem and score the opportunity", entry_criteria: "Idea captured", exit_criteria: "Problem statement, score 7+" },
  { id: "validation", name: "Validation", order: 2, objective: "Prove demand exists with real signals", entry_criteria: "Idea approved", exit_criteria: "Pain signals, competitors mapped" },
  { id: "design", name: "Design", order: 3, objective: "Design the user experience", entry_criteria: "Validation passed", exit_criteria: "User journey defined, templates written" },
  { id: "mvp", name: "MVP", order: 4, objective: "Build minimum viable product", entry_criteria: "Design approved", exit_criteria: "Product live, payment working" },
  { id: "traffic", name: "Traffic", order: 5, objective: "Drive targeted traffic", entry_criteria: "MVP live", exit_criteria: "Content loop running" },
  { id: "conversion", name: "Conversion", order: 6, objective: "Optimise funnel", entry_criteria: "Traffic flowing", exit_criteria: "A/B tested, positive economics" },
  { id: "delivery", name: "Delivery", order: 7, objective: "Deliver value and collect feedback", entry_criteria: "Paying customers", exit_criteria: "CSAT 8+" },
  { id: "scale", name: "Scale", order: 8, objective: "Scale and automate", entry_criteria: "Delivery stable", exit_criteria: "Processes automated" },
];

/* ─────────────────────────── COMPONENT ─────────────────────────── */

export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES);
  const [projectTasks, setProjectTasks] = useState<PipelineTask[]>([]);
  const [templateTasks, setTemplateTasks] = useState<PipelineTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isTemplateView = selectedProject === "_template";

  /* ── Fetch stages + projects on mount ── */
  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch("/api/pipeline-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }), signal: ac.signal }).then((r) => r.json()).catch(() => null),
      fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }), signal: ac.signal }).then((r) => r.json()).catch(() => null),
    ]).then(([stageData, projData]) => {
      if (stageData?.stages) setStages(stageData.stages.sort((a: PipelineStage, b: PipelineStage) => a.order - b.order));
      if (projData?.projects) setProjects(projData.projects);
      setLoading(false);
    });
    return () => ac.abort();
  }, []);

  /* ── Fetch tasks when project changes ── */
  useEffect(() => {
    if (!selectedProject) { setProjectTasks([]); setTemplateTasks([]); setExpandedStages(new Set()); return; }
    const ac = new AbortController();
    const h = { "Content-Type": "application/json" };
    const post = (pid: string) => fetch("/api/tasks", { method: "POST", headers: h, body: JSON.stringify({ action: "list", project_id: pid }), signal: ac.signal }).then((r) => r.json()).catch(() => null);

    if (selectedProject === "_template") {
      post("_template").then((data) => {
        if (data?.tasks) setTemplateTasks(data.tasks);
        setProjectTasks([]);
        setExpandedStages(new Set());
      });
    } else {
      // Always fetch BOTH project tasks and template tasks
      Promise.all([post(selectedProject), post("_template")]).then(([projData, tmplData]) => {
        if (projData?.tasks) setProjectTasks(projData.tasks);
        else setProjectTasks([]);
        if (tmplData?.tasks) setTemplateTasks(tmplData.tasks);
        else setTemplateTasks([]);
        const proj = projects.find((p) => p.id === selectedProject);
        if (proj?.stage) setExpandedStages(new Set([proj.stage]));
        else setExpandedStages(new Set());
      });
    }

    return () => ac.abort();
  }, [selectedProject, projects]);

  /* ── Derived state ── */
  const project = projects.find((p) => p.id === selectedProject);
  const currentStageId = project?.stage || "";
  const currentStageIdx = STAGE_ORDER.indexOf(currentStageId);

  // Which stages to show
  const visibleStages = isTemplateView
    ? stages // Template: show all 9
    : stages.filter((s) => {
        const idx = STAGE_ORDER.indexOf(s.id);
        if (idx < 0) return false;
        if (currentStageIdx < 0) return true;
        return idx <= currentStageIdx + 1; // completed + current + next
      });

  // Tasks for a stage — project tasks if they exist, otherwise template fallback
  type DisplayTask = PipelineTask & { _fromTemplate?: boolean };
  const tasksForStage = (stageId: string): DisplayTask[] => {
    if (isTemplateView) {
      return templateTasks.filter((t) => t.stage === stageId).sort((a, b) => a.order - b.order);
    }
    const projStage = projectTasks.filter((t) => t.stage === stageId);
    if (projStage.length > 0) {
      return projStage.sort((a, b) => a.order - b.order);
    }
    // No project-specific tasks — fall back to template, marked as not_started
    return templateTasks
      .filter((t) => t.stage === stageId)
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ ...t, status: "not_started" as const, output: "", blocker: null, _fromTemplate: true }));
  };

  // Missed/skipped tasks from earlier stages (project tasks only)
  const missedTasks = projectTasks.filter((t) => {
    const stageIdx = STAGE_ORDER.indexOf(t.stage);
    return stageIdx < currentStageIdx && t.status === "skipped";
  });

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  };

  const scrollToStage = (stageId: string) => {
    stageRefs.current[stageId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Also expand it
    setExpandedStages((prev) => new Set(prev).add(stageId));
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: TOKENS.muted }}>
        Loading pipeline...
      </div>
    );
  }

  /* ── No project selected: clean empty state ── */
  if (!selectedProject) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: TOKENS.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>Pipeline</h2>
            <p style={{ color: TOKENS.body, fontSize: 14, margin: "4px 0 0" }}>Project execution tracker</p>
          </div>
          <ProjectDropdown projects={projects} value={selectedProject} onChange={setSelectedProject} />
        </div>
        <div style={{
          background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: 12,
          padding: "80px 40px", textAlign: "center",
        }}>
          <p style={{ color: TOKENS.muted, fontSize: 48, margin: "0 0 16px" }}>{"\uD83D\uDCCB"}</p>
          <p style={{ color: TOKENS.heading, fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Select a project to view its pipeline
          </p>
          <p style={{ color: TOKENS.muted, fontSize: 14, margin: 0 }}>
            Choose a project from the dropdown above to see its stage progression, tasks, and outputs.
          </p>
        </div>
      </div>
    );
  }

  /* ── Project / Template selected ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ color: TOKENS.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>Pipeline</h2>
          <p style={{ color: TOKENS.body, fontSize: 14, margin: "4px 0 0" }}>
            {isTemplateView
              ? "Master template \u2014 blueprint for all projects"
              : `${project?.name || selectedProject} \u2014 currently at ${stages.find((s) => s.id === currentStageId)?.name || currentStageId || "unknown"}`
            }
          </p>
        </div>
        <ProjectDropdown projects={projects} value={selectedProject} onChange={setSelectedProject} />
      </div>

      {/* ── Stage Rail ── */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {visibleStages.map((stage) => {
          const idx = STAGE_ORDER.indexOf(stage.id);
          const isCurrent = !isTemplateView && stage.id === currentStageId;
          const isCompleted = !isTemplateView && idx < currentStageIdx;
          const isNext = !isTemplateView && idx === currentStageIdx + 1;
          const count = tasksForStage(stage.id).length;

          let borderColor = TOKENS.border;
          let textColor = TOKENS.body;
          let bg = TOKENS.card;
          if (isCurrent) { borderColor = TOKENS.accent; textColor = TOKENS.accent; bg = "rgba(0,212,212,0.08)"; }
          else if (isCompleted) { borderColor = TOKENS.success; textColor = TOKENS.success; bg = "rgba(34,197,94,0.06)"; }
          else if (isNext) { textColor = TOKENS.muted; }

          return (
            <button
              key={stage.id}
              onClick={() => scrollToStage(stage.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${borderColor}`, background: bg, color: textColor,
                cursor: "pointer", fontSize: 13, fontWeight: isCurrent ? 700 : 500, whiteSpace: "nowrap",
              }}
            >
              {isCompleted && <span style={{ fontSize: 11 }}>{"\u2705"}</span>}
              {isNext && <span style={{ fontSize: 11 }}>{"\uD83D\uDD12"}</span>}
              {stage.name}
              {count > 0 && (
                <span style={{
                  background: isCurrent ? TOKENS.accent : isCompleted ? TOKENS.success : TOKENS.muted,
                  color: "#000", fontSize: 10, fontWeight: 800,
                  borderRadius: 99, padding: "1px 7px", minWidth: 18, textAlign: "center",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Missed/Skipped Tasks ── */}
      {!isTemplateView && missedTasks.length > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.06)", border: `1px solid rgba(245,158,11,0.3)`,
          borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>{"\u26A0\uFE0F"}</span>
            <h3 style={{ color: TOKENS.warn, fontSize: 14, fontWeight: 700, margin: 0 }}>Skipped Tasks from Earlier Stages</h3>
          </div>
          {missedTasks.map((task) => (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
              borderBottom: `1px solid rgba(245,158,11,0.15)`, fontSize: 13,
            }}>
              <span style={{ color: TOKENS.warn, fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>{task.id}</span>
              <span style={{ color: TOKENS.muted, fontSize: 11, textTransform: "uppercase" }}>
                {stages.find((s) => s.id === task.stage)?.name || task.stage}
              </span>
              <span style={{ color: TOKENS.heading, fontWeight: 500 }}>{task.name}</span>
              <span style={{ color: TOKENS.warn, fontSize: 11, marginLeft: "auto" }}>{"\u26A0\uFE0F"} Skipped</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Stage Sections (collapsed by default) ── */}
      {visibleStages.map((stage) => {
        const idx = STAGE_ORDER.indexOf(stage.id);
        const isCurrent = !isTemplateView && stage.id === currentStageId;
        const isCompleted = !isTemplateView && idx < currentStageIdx;
        const isNext = !isTemplateView && idx === currentStageIdx + 1;
        const stageTasks = tasksForStage(stage.id);
        const doneCount = stageTasks.filter((t) => t.status === "done").length;
        const isExpanded = expandedStages.has(stage.id);

        // Header accent colour
        const headerColor = isCompleted ? TOKENS.success : isCurrent ? TOKENS.accent : isNext ? TOKENS.muted : TOKENS.body;

        return (
          <div
            key={stage.id}
            ref={(el) => { stageRefs.current[stage.id] = el; }}
            style={{
              background: "rgba(17,17,24,0.7)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${isCompleted ? "rgba(34,197,94,0.3)" : isNext ? "rgba(107,107,128,0.2)" : TOKENS.border}`,
              borderRadius: 12,
              overflow: "hidden",
              opacity: isNext ? 0.5 : 1,
            }}
          >
            {/* ── Collapsed Stage Header (always visible) ── */}
            <div
              onClick={() => !isNext && toggleStage(stage.id)}
              style={{
                padding: "14px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: isNext ? "default" : "pointer",
                background: isCompleted ? "rgba(34,197,94,0.04)" : isNext ? "rgba(107,107,128,0.04)" : "transparent",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Expand arrow */}
                <span style={{
                  color: TOKENS.accent, fontSize: 10,
                  transition: "transform 0.15s",
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>
                  {isNext ? "\uD83D\uDD12" : "\u25B6"}
                </span>
                {isCompleted && <span style={{ fontSize: 13 }}>{"\u2705"}</span>}
                {isCurrent && <span style={{ fontSize: 13 }}>{"\u25B6\uFE0F"}</span>}
                <span style={{ color: headerColor, fontSize: 15, fontWeight: 700 }}>
                  Stage {stage.order}: {stage.name}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
                <span style={{ color: TOKENS.muted }}>
                  {stageTasks.length} task{stageTasks.length !== 1 ? "s" : ""}
                </span>
                <span style={{ color: headerColor, fontWeight: 600 }}>
                  {doneCount} complete
                </span>
                {isNext && <span style={{ color: TOKENS.muted, fontWeight: 600 }}>LOCKED</span>}
              </div>
            </div>

            {/* ── Expanded Task List ── */}
            {isExpanded && !isNext && (
              <div style={{ borderTop: `1px solid ${TOKENS.border}` }}>
                {stageTasks.length === 0 ? (
                  <p style={{ color: TOKENS.muted, fontSize: 13, padding: "20px", margin: 0 }}>
                    No tasks for this stage yet.
                  </p>
                ) : (
                  stageTasks.map((task) => (
                    <TaskRow key={task.id} task={task} compact={isCompleted} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── PROJECT DROPDOWN ─────────────────────────── */

function ProjectDropdown({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
        padding: "8px 16px", color: TOKENS.heading, fontSize: 13, fontWeight: 600,
        cursor: "pointer", minWidth: 200,
      }}
    >
      <option value="">Select a project...</option>
      <option value="_template">All Projects (Template)</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

/* ─────────────────────────── TASK ROW ─────────────────────────── */

function TaskRow({ task, compact }: { task: PipelineTask & { _fromTemplate?: boolean }; compact?: boolean }) {
  const [outputExpanded, setOutputExpanded] = useState(false);
  const cfg = STATUS_CFG[task.status] || STATUS_CFG.not_started;
  const emoji = OWNER_EMOJI[task.owner] || "\uD83D\uDC64";
  const isFromTemplate = !!(task as { _fromTemplate?: boolean })._fromTemplate;
  const borderLeft = isFromTemplate ? "3px solid transparent" : task.status === "blocked" ? `3px solid ${TOKENS.error}` : task.status === "done" ? `3px solid ${TOKENS.success}` : "3px solid transparent";
  const hasDoneOutput = task.status === "done" && task.output;

  const templateBadge = isFromTemplate ? (
    <span style={{
      background: "rgba(107,107,128,0.15)", color: TOKENS.muted,
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      Template
    </span>
  ) : null;

  // Compact row for completed stages
  if (compact) {
    return (
      <div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "7px 20px",
            borderBottom: hasDoneOutput && outputExpanded ? "none" : `1px solid rgba(30,30,46,0.5)`,
            fontSize: 13, borderLeft,
            opacity: isFromTemplate ? 0.6 : 1,
            cursor: hasDoneOutput ? "pointer" : "default",
          }}
          onClick={() => hasDoneOutput && setOutputExpanded(!outputExpanded)}
        >
          <span style={{ fontSize: 12 }}>{cfg.icon}</span>
          <span style={{ color: TOKENS.muted, fontSize: 10, fontWeight: 700, fontFamily: "monospace", minWidth: 52 }}>{task.id}</span>
          <span style={{ color: cfg.color, fontWeight: 500, flex: 1 }}>{task.name}</span>
          {templateBadge}
          <span style={{ color: TOKENS.muted, fontSize: 11 }}>{emoji} {task.owner}</span>
          {hasDoneOutput ? (
            <span style={{ color: TOKENS.accent, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              {outputExpanded ? "\u25B2 Output" : "\u25BC Output"}
            </span>
          ) : task.output ? (
            <span style={{ color: TOKENS.body, fontSize: 11, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {task.output}
            </span>
          ) : (
            <span style={{ color: TOKENS.muted, fontSize: 11, fontStyle: "italic" }}>No output yet</span>
          )}
        </div>
        {hasDoneOutput && outputExpanded && (
          <div style={{
            padding: "10px 20px 12px 76px",
            borderBottom: `1px solid rgba(30,30,46,0.5)`,
            background: "rgba(0,212,212,0.02)",
          }}>
            <pre style={{
              margin: 0, color: TOKENS.body, fontSize: 12, lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
            }}>
              {task.output}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Full detail row
  return (
    <div style={{
      padding: "14px 20px", borderBottom: `1px solid ${TOKENS.border}`, borderLeft,
      display: "flex", flexDirection: "column", gap: 8,
      opacity: isFromTemplate ? 0.7 : 1,
    }}>
      {/* Row 1: ID + Name + Status + Owner */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          background: "rgba(0,212,212,0.1)", color: TOKENS.accent,
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace",
        }}>
          {task.id}
        </span>
        <span style={{ color: TOKENS.heading, fontSize: 14, fontWeight: 600, flex: 1 }}>{task.name}</span>
        {templateBadge}
        <span style={{
          background: `${cfg.color}22`, color: cfg.color,
          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{ color: TOKENS.body, fontSize: 12 }}>{emoji} {task.owner}</span>
        {task.model && (
          <span style={{ background: "rgba(167,139,250,0.12)", color: TOKENS.purple, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
            {task.model}
          </span>
        )}
      </div>

      {/* Row 2: Output — collapsible when done */}
      <div style={{ paddingLeft: 4 }}>
        {hasDoneOutput ? (
          <>
            <button
              onClick={() => setOutputExpanded(!outputExpanded)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: TOKENS.accent, fontSize: 11, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4, marginBottom: outputExpanded ? 6 : 0,
              }}
            >
              <span style={{ fontSize: 9, transform: outputExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.15s" }}>{"\u25B6"}</span>
              Output
            </button>
            {outputExpanded && (
              <pre style={{
                margin: 0, color: TOKENS.body, fontSize: 13, lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit",
                background: "rgba(0,212,212,0.03)", borderRadius: 8, padding: "10px 12px",
                border: `1px solid rgba(0,212,212,0.08)`,
              }}>
                {task.output}
              </pre>
            )}
          </>
        ) : (
          <>
            <span style={{ color: TOKENS.muted, display: "block", marginBottom: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Output</span>
            {task.output ? (
              <p style={{ margin: 0, color: TOKENS.body, fontSize: 13, lineHeight: 1.5 }}>{task.output}</p>
            ) : (
              <p style={{ margin: 0, color: TOKENS.muted, fontSize: 13, fontStyle: "italic" }}>No output yet</p>
            )}
          </>
        )}
      </div>

      {/* Row 3: Blocker */}
      {task.status === "blocked" && task.blocker && (
        <div style={{ paddingLeft: 4, display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
          <span style={{ color: TOKENS.error, fontWeight: 700, flexShrink: 0 }}>BLOCKER:</span>
          <span style={{ color: TOKENS.error }}>{task.blocker}</span>
        </div>
      )}

      {/* Row 4: Quality gate + View Prompt link */}
      <div style={{ paddingLeft: 4, display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
        {task.quality_gate && (
          <span style={{ color: TOKENS.muted }}>
            <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>Gate: </span>
            {task.quality_gate}
          </span>
        )}
        {task.prompt_id && (
          <a
            href={`/prompts#${task.prompt_id}`}
            style={{ color: TOKENS.accent, textDecoration: "none", fontWeight: 600, fontSize: 12 }}
          >
            View Prompt {"\u2192"}
          </a>
        )}
        {task.next_task && (
          <span style={{ color: TOKENS.muted, fontSize: 11, marginLeft: "auto" }}>
            Next: <span style={{ color: TOKENS.accent }}>{task.next_task}</span>
          </span>
        )}
      </div>
    </div>
  );
}
