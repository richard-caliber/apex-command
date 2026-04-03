"use client";

import { useState, useEffect, useRef } from "react";

/* ── Types ── */
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
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  objective: string;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  status: string;
}

/* ── Constants ── */
const CONTENT_STAGES = ["traffic", "conversion"];
const CONTENT_STAGE_SET = new Set(CONTENT_STAGES);
const CONTENT_PROJECT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

const FALLBACK_STAGES: PipelineStage[] = [
  { id: "traffic", name: "Traffic", order: 5, objective: "Drive targeted traffic" },
  { id: "conversion", name: "Conversion", order: 6, objective: "Optimise funnel" },
];

const T = {
  bg: "#0a0a0f", card: "#111118", border: "#1e1e2e",
  accent: "#00d4d4", warn: "#f59e0b", error: "#ef4444", success: "#22c55e",
  heading: "#ffffff", body: "#a0a0b0", muted: "#6b6b80", purple: "#a78bfa",
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string }> = {
  not_started: { icon: "\u2B1C", label: "Not Started", color: T.muted },
  in_progress: { icon: "\uD83D\uDFE1", label: "In Progress", color: T.warn },
  done: { icon: "\u2705", label: "Done", color: T.success },
  blocked: { icon: "\uD83D\uDD34", label: "Blocked", color: T.error },
  skipped: { icon: "\u26A0\uFE0F", label: "Skipped", color: T.warn },
  continuous: { icon: "\uD83D\uDD01", label: "Ongoing", color: T.purple },
};

const OWNER_EMOJI: Record<string, string> = {
  ginge: "\uD83D\uDC51", atlas: "\uD83C\uDFAF", darwin: "\uD83D\uDD2C",
  newton: "\uD83E\uDDE0", "claude-code": "\uD83E\uDD16", system: "\u2699\uFE0F",
};

function extractScore(output: string): number | null {
  if (!output) return null;
  try { const p = JSON.parse(output); if (typeof p.score === "number") return p.score; } catch { /* */ }
  return null;
}

function scoreColor(s: number): string { return s >= 7 ? T.success : s >= 4 ? T.warn : T.error; }
function scoreEmoji(s: number): string { return s >= 7 ? "\u2705" : s >= 4 ? "\ud83d\udd04" : "\ud83d\uded1"; }

/* ── Component ── */
export default function ContentPipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES);
  const [projectTasks, setProjectTasks] = useState<PipelineTask[]>([]);
  const [templateTasks, setTemplateTasks] = useState<PipelineTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(CONTENT_STAGES));
  const [loading, setLoading] = useState(true);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const h = { "Content-Type": "application/json" };
    Promise.all([
      fetch("/api/pipeline-stages", { method: "POST", headers: h, body: JSON.stringify({ action: "list" }) }).then((r) => r.json()).catch(() => null),
      fetch("/api/projects", { method: "POST", headers: h, body: JSON.stringify({ action: "list" }) }).then((r) => r.json()).catch(() => null),
    ]).then(([stageData, projData]) => {
      if (stageData?.stages) {
        setStages(stageData.stages.filter((s: PipelineStage) => CONTENT_STAGE_SET.has(s.id)).sort((a: PipelineStage, b: PipelineStage) => a.order - b.order));
      }
      if (projData?.projects) {
        const filtered = projData.projects.filter((p: Project) => CONTENT_PROJECT_STAGES.has(p.stage));
        setProjects(filtered);
        if (filtered.length > 0 && !selectedProject) setSelectedProject(filtered[0].id);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedProject) return;
    const h = { "Content-Type": "application/json" };
    const post = (pid: string) => fetch("/api/tasks", { method: "POST", headers: h, body: JSON.stringify({ action: "list", project_id: pid }) }).then((r) => r.json()).catch(() => null);
    Promise.all([post(selectedProject), post("_template")]).then(([projData, tmplData]) => {
      setProjectTasks((projData?.tasks || []).filter((t: PipelineTask) => CONTENT_STAGE_SET.has(t.stage)));
      setTemplateTasks((tmplData?.tasks || []).filter((t: PipelineTask) => CONTENT_STAGE_SET.has(t.stage)));
    });
  }, [selectedProject]);

  const project = projects.find((p) => p.id === selectedProject);

  const sortTasks = (tasks: PipelineTask[]) =>
    [...tasks].sort((a, b) => {
      const ac = a.blocker === "continuous" ? 1 : 0;
      const bc = b.blocker === "continuous" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return a.order - b.order;
    });

  type DisplayTask = PipelineTask & { _fromTemplate?: boolean };
  const tasksForStage = (stageId: string): DisplayTask[] => {
    const proj = projectTasks.filter((t) => t.stage === stageId);
    if (proj.length > 0) return sortTasks(proj);
    return sortTasks(
      templateTasks.filter((t) => t.stage === stageId)
        .map((t) => ({ ...t, status: "not_started" as const, output: "", blocker: null, _fromTemplate: true }))
    );
  };

  const toggleStage = (id: string) => setExpandedStages((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: T.muted }}>Loading...</div>;

  if (!selectedProject) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: T.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>Content Pipeline</h2>
            <p style={{ color: T.body, fontSize: 14, margin: "4px 0 0" }}>Traffic + Conversion stages</p>
          </div>
          <ProjectDropdown projects={projects} value="" onChange={setSelectedProject} />
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "80px 40px", textAlign: "center" }}>
          <p style={{ color: T.heading, fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Select a project</p>
          <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Choose a project at Traffic stage or beyond.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ color: T.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>Content Pipeline</h2>
          <p style={{ color: T.body, fontSize: 14, margin: "4px 0 0" }}>
            {project?.name || selectedProject} — Traffic + Conversion stages
          </p>
        </div>
        <ProjectDropdown projects={projects} value={selectedProject} onChange={setSelectedProject} />
      </div>

      {stages.map((stage) => {
        const stageTasks = tasksForStage(stage.id);
        const doneCount = stageTasks.filter((t) => t.status === "done").length;
        const isExpanded = expandedStages.has(stage.id);
        const gateTask = stageTasks.length >= 2 ? [...stageTasks].sort((a, b) => a.order - b.order)[stageTasks.length - 2] : undefined;
        const gateScore = gateTask ? extractScore(gateTask.output) : null;

        return (
          <div key={stage.id} ref={(el) => { stageRefs.current[stage.id] = el; }}
            style={{ background: "rgba(17,17,24,0.7)", backdropFilter: "blur(12px)", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div onClick={() => toggleStage(stage.id)}
              style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: T.accent, fontSize: 10, transition: "transform 0.15s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                <span style={{ color: T.accent, fontSize: 15, fontWeight: 700 }}>Stage {stage.order}: {stage.name}</span>
                {gateScore !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(gateScore), background: `${scoreColor(gateScore)}18`, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {gateScore}/10 {scoreEmoji(gateScore)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
                <span style={{ color: T.muted }}>{stageTasks.length} task{stageTasks.length !== 1 ? "s" : ""}</span>
                <span style={{ color: T.accent, fontWeight: 600 }}>{doneCount} complete</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${T.border}` }}>
                {stageTasks.length === 0 ? (
                  <p style={{ color: T.muted, fontSize: 13, padding: "20px", margin: 0 }}>No tasks for this stage yet.</p>
                ) : (
                  stageTasks.map((task) => <TaskRow key={task.id} task={task} />)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Project Dropdown ── */
function ProjectDropdown({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 16px", color: T.heading, fontSize: 13, fontWeight: 600, cursor: "pointer", minWidth: 200 }}>
      <option value="">Select a project...</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

/* ── Task Row ── */
function TaskRow({ task }: { task: PipelineTask & { _fromTemplate?: boolean } }) {
  const [outputOpen, setOutputOpen] = useState(false);
  const isContinuous = task.blocker === "continuous";
  const cfg = isContinuous ? STATUS_CFG.continuous : (STATUS_CFG[task.status] || STATUS_CFG.not_started);
  const emoji = OWNER_EMOJI[task.owner] || "\uD83D\uDC64";
  const isTemplate = !!(task as { _fromTemplate?: boolean })._fromTemplate;
  const hasDoneOutput = task.status === "done" && task.output;
  const taskScore = extractScore(task.output);
  const borderLeft = isTemplate ? "3px solid transparent" : isContinuous ? `3px solid ${T.purple}` : task.status === "blocked" ? `3px solid ${T.error}` : task.status === "done" ? `3px solid ${T.success}` : "3px solid transparent";

  return (
    <div>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, borderLeft, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: isTemplate ? 0.6 : 1 }}>
        <span style={{ background: "rgba(0,212,212,0.1)", color: T.accent, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>{task.id}</span>
        <span style={{ color: T.heading, fontSize: 14, fontWeight: 600, flex: 1 }}>{task.name}</span>
        {taskScore !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(taskScore), background: `${scoreColor(taskScore)}18`, padding: "2px 8px", borderRadius: 4 }}>
            {taskScore}/10 {scoreEmoji(taskScore)}
          </span>
        )}
        {isTemplate && <span style={{ background: "rgba(107,107,128,0.15)", color: T.muted, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>Template</span>}
        <span style={{ background: `${cfg.color}22`, color: cfg.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{ color: T.body, fontSize: 12 }}>{emoji} {task.owner}</span>
        {hasDoneOutput && (
          <button onClick={() => setOutputOpen(!outputOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
            <span style={{ fontSize: 9, transform: outputOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.15s" }}>{"\u25B6"}</span>
            Output
          </button>
        )}
      </div>
      {hasDoneOutput && outputOpen && (
        <div style={{ padding: "10px 20px 12px 32px", borderBottom: `1px solid ${T.border}`, background: "rgba(0,212,212,0.02)" }}>
          <pre style={{ margin: 0, color: T.body, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>{task.output}</pre>
        </div>
      )}
      {task.status === "blocked" && task.blocker && (
        <div style={{ padding: "6px 20px 10px 32px", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
          <span style={{ color: T.error, fontWeight: 700 }}>BLOCKER: </span><span style={{ color: T.error }}>{task.blocker}</span>
        </div>
      )}
    </div>
  );
}
