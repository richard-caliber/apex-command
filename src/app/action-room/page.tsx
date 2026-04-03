"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

/* ── Types ── */

interface Project {
  id: string;
  name: string;
  description: string;
  stage: string;
  status: string;
  image_url: string;
  blocker: string;
  metrics: Record<string, string>;
}

interface FeedEntry {
  id: string;
  project_id: string;
  agent: string;
  action: string;
  timestamp: string;
  link: string;
  category: string;
}

interface PipelineTask {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  owner: string;
  order: number;
  output: string;
  prompt_id: string;
  blocker: string | null;
}

interface Suggestion {
  id: string;
  project_id: string;
  text: string;
  type: string;
  updated_at: string;
}

interface ContentItem {
  id: string;
  title: string;
  project_id?: string;
  format: string;
  platforms: string[];
  posted_date: string;
}

interface DataMetric {
  id: string;
  project_id?: string;
  label: string;
  value: string;
  section: string;
}

interface VaultEntry {
  id: string;
  text?: string;
  learning?: string;
  category?: string;
  project_id?: string;
  [key: string]: unknown;
}

/* ── Constants ── */

const AGENT_BADGE: Record<string, { emoji: string; color: string; label: string }> = {
  atlas: { emoji: "\ud83e\udded", color: "#00d4d4", label: "Atlas" },
  newton: { emoji: "\ud83d\udd2c", color: "#3b82f6", label: "Newton" },
  darwin: { emoji: "\ud83d\udd04", color: "#22c55e", label: "Darwin" },
  ginge: { emoji: "\ud83d\udc51", color: "#f59e0b", label: "Ginge" },
  "claude-code": { emoji: "\ud83e\udd16", color: "#a78bfa", label: "Claude" },
  jimmy: { emoji: "\ud83c\udfa8", color: "#ec4899", label: "Jimmy" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "ACTIVE", color: "text-teal-400", bg: "bg-teal-400/15" },
  blocked: { label: "BLOCKED", color: "text-red-400", bg: "bg-red-400/15" },
  paused: { label: "PAUSED", color: "text-slate-400", bg: "bg-slate-400/15" },
  completed: { label: "COMPLETED", color: "text-green-400", bg: "bg-green-400/15" },
};

const STAGE_COLOR: Record<string, string> = {
  inbox: "bg-gray-500/20 text-gray-300",
  idea: "bg-purple-500/20 text-purple-300",
  validation: "bg-blue-500/20 text-blue-300",
  design: "bg-indigo-500/20 text-indigo-300",
  mvp: "bg-sky-500/20 text-sky-300",
  traffic: "bg-amber-500/20 text-amber-300",
  conversion: "bg-orange-500/20 text-orange-300",
  delivery: "bg-green-500/20 text-green-300",
  scale: "bg-cyan-500/20 text-cyan-300",
};

const PIPELINE_STAGES = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];

const TASK_STATUS_DOT: Record<string, string> = {
  done: "bg-green-400",
  in_progress: "bg-amber-400 animate-pulse",
  not_started: "bg-slate-600",
  blocked: "bg-red-400",
  skipped: "bg-slate-500",
};

const CATEGORY_ICON: Record<string, string> = {
  task_completed: "\u2705",
  task_started: "\ud83d\udfe1",
  research: "\ud83d\udd2c",
  content: "\ud83c\udfa8",
  deployment: "\ud83d\ude80",
  decision: "\u2696\ufe0f",
  general: "\ud83d\udccc",
};

const SUGGESTION_ICON: Record<string, string> = {
  next_task: "\u25b6\ufe0f",
  blocked: "\ud83d\udeab",
  quick_win: "\u26a1",
  info: "\ud83d\udca1",
};

type Panel = "tasks" | "prompts" | "data" | "content" | "research" | "learnings";

/* ── Main Component ── */

export default function ActionRoom() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [dataMetrics, setDataMetrics] = useState<DataMetric[]>([]);
  const [vaultSections, setVaultSections] = useState<{ id: string; title: string; entries: VaultEntry[] }[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>("tasks");
  const [feedAnimating, setFeedAnimating] = useState<Set<string>>(new Set());

  // Fetch projects on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        });
        if (res.ok) {
          const store = await res.json();
          setProjects(store.projects || []);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const selected = useMemo(() => projects.find((p) => p.id === selectedId), [projects, selectedId]);

  // Fetch project data when selection changes
  const fetchProjectData = useCallback(async (projectId: string) => {
    if (!projectId) return;

    const [feedRes, tasksRes, suggestionsRes, contentRes, dataRes, vaultRes] = await Promise.allSettled([
      fetch("/api/action-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feed-list", project_id: projectId }),
      }),
      fetch("/api/pipeline-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }),
      fetch("/api/action-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggestions-list", project_id: projectId }),
      }),
      fetch("/api/content-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }),
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", project_id: projectId }),
      }),
      fetch("/api/map-room/ip-vault", { method: "GET" }),
    ]);

    if (feedRes.status === "fulfilled" && feedRes.value.ok) {
      setFeed(await feedRes.value.json());
    }
    if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
      const store = await tasksRes.value.json();
      const allTasks: PipelineTask[] = store.tasks || [];
      setTasks(allTasks.filter((t: PipelineTask) => t.project_id === projectId || t.project_id === "_template"));
    }
    if (suggestionsRes.status === "fulfilled" && suggestionsRes.value.ok) {
      setSuggestions(await suggestionsRes.value.json());
    }
    if (contentRes.status === "fulfilled" && contentRes.value.ok) {
      const items = await contentRes.value.json();
      setContent(Array.isArray(items) ? items.filter((c: ContentItem) => c.project_id === projectId) : []);
    }
    if (dataRes.status === "fulfilled" && dataRes.value.ok) {
      const items = await dataRes.value.json();
      setDataMetrics(Array.isArray(items) ? items : []);
    }
    if (vaultRes.status === "fulfilled" && vaultRes.value.ok) {
      const data = await vaultRes.value.json();
      setVaultSections(data.sections || []);
    }
  }, []);

  useEffect(() => {
    if (selectedId && selectedId !== "_ginge_actions") {
      fetchProjectData(selectedId);
      const interval = setInterval(() => fetchProjectData(selectedId), 30000);
      return () => clearInterval(interval);
    }
    if (selectedId === "_ginge_actions") {
      // Fetch all tasks for Ginge Actions view
      (async () => {
        try {
          const res = await fetch("/api/pipeline-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list" }),
          });
          if (res.ok) {
            const store = await res.json();
            setTasks(store.tasks || []);
          }
        } catch { /* silent */ }
      })();
    }
  }, [selectedId, fetchProjectData]);

  // Animate new feed entries
  useEffect(() => {
    if (feed.length > 0) {
      const newest = feed[0];
      if (!feedAnimating.has(newest.id)) {
        setFeedAnimating((prev) => new Set([...prev, newest.id]));
      }
    }
  }, [feed, feedAnimating]);

  // Project-specific tasks (not template)
  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === selectedId), [tasks, selectedId]);
  const templateTasks = useMemo(() => tasks.filter((t) => t.project_id === "_template"), [tasks]);
  const displayTasks = projectTasks.length > 0 ? projectTasks : templateTasks;

  // Pipeline progress
  const stageProgress = useMemo(() => {
    const progress: Record<string, { total: number; done: number }> = {};
    for (const stage of PIPELINE_STAGES) {
      const stageTasks = displayTasks.filter((t) => t.stage === stage);
      progress[stage] = {
        total: stageTasks.length,
        done: stageTasks.filter((t) => t.status === "done").length,
      };
    }
    return progress;
  }, [displayTasks]);

  // Vault filtered for research / learnings
  const researchEntries = useMemo(() => {
    const section = vaultSections.find((s) => s.id === "channel-learnings" || s.id === "funnel-learnings");
    return section?.entries || [];
  }, [vaultSections]);

  const learningEntries = useMemo(() => {
    const sections = vaultSections.filter(
      (s) => s.id === "failed-experiments" || s.id === "system-learnings" || s.id === "reusable-frameworks"
    );
    return sections.flatMap((s) => s.entries);
  }, [vaultSections]);

  // Hero metrics
  const heroMetrics = useMemo(() => {
    if (!selected) return [];
    const m = selected.metrics || {};
    const entries = Object.entries(m).slice(0, 4).map(([k, v]) => ({
      label: k.replace(/_/g, " "),
      value: v,
    }));
    // Pad to show task count
    entries.push({ label: "Tasks Done", value: `${displayTasks.filter((t) => t.status === "done").length}/${displayTasks.length}` });
    return entries;
  }, [selected, displayTasks]);

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f" }}>
      {/* ── Header with shared nav ── */}
      <header className="hidden sm:block border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              APEX COMMAND CENTRE
            </h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompt Library</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/vault" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Keys</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <span className="text-sm text-white font-medium">Action Room</span>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Project Selector ── */}
      <div className="border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center gap-4">
          <span className="text-xs font-bold tracking-widest uppercase text-[#64748b]">Project</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-sm bg-[#111827] border border-[#1e293b] rounded-lg px-4 py-2.5 text-white min-w-[280px] cursor-pointer focus:outline-none focus:border-[#00d4d4]"
          >
            <option value="">Select a project...</option>
            <option value="_ginge_actions">{"\uD83D\uDD25"} Ginge Actions</option>
            <option disabled>{"─".repeat(20)}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedId ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="text-5xl mb-4 opacity-20">\u26A1</div>
              <p className="text-[#475569] text-sm">Select a project to enter Action Room</p>
            </div>
          </div>
        ) : selectedId === "_ginge_actions" ? (
          <GingeActionsView allTasks={tasks} projects={projects} />
        ) : selected ? (
          <div className="space-y-6">
            {/* ── Project Hero ── */}
            <div className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="relative w-full md:w-80 h-48 md:h-auto flex-shrink-0">
                  {selected.image_url ? (
                    <Image
                      src={selected.image_url}
                      alt={selected.name}
                      fill
                      className="object-cover"
                      unoptimized={selected.image_url.startsWith("http")}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-teal-900/40 to-slate-900/60" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111827]/80 hidden md:block" />
                </div>

                {/* Info */}
                <div className="flex-1 p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-2xl font-extrabold text-white">{selected.name}</h2>
                    {(() => {
                      const s = STATUS_CONFIG[selected.status] || STATUS_CONFIG.active;
                      return <span className={`text-[10px] font-bold tracking-wider ${s.color} ${s.bg} px-2 py-0.5 rounded`}>{s.label}</span>;
                    })()}
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${STAGE_COLOR[selected.stage] || "bg-slate-500/20 text-slate-300"}`}>
                      {selected.stage.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-[#94a3b8] mb-4">{selected.description}</p>
                  {selected.blocker && (
                    <p className="text-xs text-amber-400/80 mb-4">\u26a0 {selected.blocker}</p>
                  )}

                  {/* Metrics row */}
                  <div className="flex items-center gap-6 flex-wrap">
                    {heroMetrics.map((m) => (
                      <div key={m.label}>
                        <div className="text-lg font-extrabold text-white">{m.value}</div>
                        <div className="text-[10px] text-[#64748b] uppercase tracking-wider">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Next Steps ── */}
            <NextStepsPanel tasks={displayTasks} />

            {/* ── Project Deep Dive ── */}
            <DeepDivePanel projectId={selectedId} tasks={displayTasks} />

            {/* ── Two-column layout: Feed + Pipeline ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LIVE FEED */}
              <div className="rounded-2xl border border-[#1e293b] p-5" style={{ background: "#111827" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h3 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">Live Feed</h3>
                  <span className="text-[10px] text-[#475569] font-mono ml-auto">{feed.length} entries</span>
                </div>

                {feed.length === 0 ? (
                  <p className="text-xs text-[#475569] py-8 text-center">No activity yet. Atlas will push updates as work happens.</p>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {feed.map((entry) => {
                      const badge = AGENT_BADGE[entry.agent] || AGENT_BADGE.atlas;
                      const icon = CATEGORY_ICON[entry.category] || CATEGORY_ICON.general;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-all"
                          style={{ animation: feedAnimating.has(entry.id) ? "slideIn 0.3s ease-out" : undefined }}
                        >
                          <span className="text-xs mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold" style={{ color: badge.color }}>
                                {badge.emoji} {badge.label}
                              </span>
                              <span className="text-[9px] text-[#475569] font-mono">{formatTime(entry.timestamp)}</span>
                            </div>
                            <p className="text-xs text-[#c8d0dc] leading-relaxed">
                              {entry.action}
                            </p>
                            {entry.link && (
                              <a href={entry.link} className="text-[10px] text-[#00d4d4] hover:underline mt-0.5 inline-block">
                                View output \u2192
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PIPELINE STATUS */}
              <div className="rounded-2xl border border-[#1e293b] p-5" style={{ background: "#111827" }}>
                <h3 className="text-sm font-bold tracking-widest uppercase text-[#64748b] mb-4">Pipeline Status</h3>

                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const p = stageProgress[stage] || { total: 0, done: 0 };
                    const pct = p.total > 0 ? (p.done / p.total) * 100 : 0;
                    const isCurrent = selected.stage === stage;
                    const stageTasks = displayTasks.filter((t) => t.stage === stage).sort((a, b) => a.order - b.order);

                    return (
                      <div key={stage}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-[10px] font-bold tracking-wider uppercase w-20 ${isCurrent ? "text-[#00d4d4]" : "text-[#475569]"}`}>
                            {stage}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: isCurrent ? "#00d4d4" : pct === 100 ? "#22c55e" : "#475569",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-[#475569] font-mono w-10 text-right">
                            {p.total > 0 ? `${p.done}/${p.total}` : "\u2014"}
                          </span>
                        </div>

                        {/* Expanded tasks for current stage */}
                        {isCurrent && stageTasks.length > 0 && (
                          <div className="ml-[calc(5rem+0.75rem)] mb-2 space-y-1">
                            {stageTasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_STATUS_DOT[t.status] || "bg-slate-600"}`} />
                                <span className="text-[11px] text-[#94a3b8] truncate">{t.name}</span>
                                <span className="text-[9px] text-[#475569] ml-auto flex-shrink-0">{t.status.replace(/_/g, " ")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Quick Panels ── */}
            <div className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-[#1e293b] overflow-x-auto">
                {([
                  ["tasks", "Tasks"],
                  ["prompts", "Prompts"],
                  ["data", "Data"],
                  ["content", "Content"],
                  ["research", "Research"],
                  ["learnings", "Learnings"],
                ] as [Panel, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setActivePanel(id)}
                    className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
                      activePanel === id
                        ? "text-[#00d4d4] border-b-2 border-[#00d4d4] bg-[#00d4d4]/5"
                        : "text-[#475569] hover:text-[#94a3b8]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="p-5 max-h-[500px] overflow-y-auto">
                {activePanel === "tasks" && (
                  <TasksPanel tasks={displayTasks} />
                )}
                {activePanel === "data" && (
                  <DataPanel metrics={dataMetrics} projectMetrics={selected.metrics} />
                )}
                {activePanel === "content" && (
                  <ContentPanel items={content} />
                )}
                {activePanel === "research" && (
                  <VaultPanel entries={researchEntries} emptyText="No research entries yet." />
                )}
                {activePanel === "learnings" && (
                  <VaultPanel entries={learningEntries} emptyText="No learnings captured yet." />
                )}
                {activePanel === "prompts" && (
                  <div className="text-xs text-[#475569] py-4 text-center">
                    Prompts panel pulls from Prompt Library filtered by project stage. Visit <a href="/prompts" className="text-[#00d4d4] hover:underline">Prompt Library</a> for full access.
                  </div>
                )}
              </div>
            </div>

            {/* ── Suggested Actions ── */}
            <div className="rounded-2xl border border-[#1e293b] p-5" style={{ background: "#111827" }}>
              <h3 className="text-sm font-bold tracking-widest uppercase text-[#64748b] mb-4">Suggested Actions</h3>

              {suggestions.length === 0 ? (
                <p className="text-xs text-[#475569] py-4 text-center">No suggestions yet. Atlas will push recommendations as the project progresses.</p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02]">
                      <span className="text-sm">{SUGGESTION_ICON[s.type] || "\ud83d\udca1"}</span>
                      <p className="text-xs text-[#c8d0dc] leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

/* ── Ginge Actions View ── */

function GingeActionsView({ allTasks, projects }: { allTasks: PipelineTask[]; projects: Project[] }) {
  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  // 1. BLOCKED — ginge-owned blocked tasks (things stuck because of you)
  const gingeBlocked = useMemo(
    () => allTasks.filter((t) => t.owner === "ginge" && t.status === "blocked" && t.project_id !== "_template"),
    [allTasks]
  );
  // 2. YOUR NOT STARTED — ginge-owned not_started/in_progress tasks
  const gingeNotDone = useMemo(
    () => allTasks.filter((t) => t.owner === "ginge" && (t.status === "not_started" || t.status === "in_progress") && t.project_id !== "_template"),
    [allTasks]
  );
  // 3. BOT TASKS — non-ginge tasks not done (informational)
  const botTasks = useMemo(
    () => allTasks.filter((t) => t.owner !== "ginge" && t.status !== "done" && t.status !== "skipped" && t.project_id !== "_template").slice(0, 20),
    [allTasks]
  );

  const groupByProject = (tasks: PipelineTask[]) => {
    const g: Record<string, PipelineTask[]> = {};
    for (const t of tasks) {
      if (!g[t.project_id]) g[t.project_id] = [];
      g[t.project_id].push(t);
    }
    return g;
  };

  const renderTaskCard = (t: PipelineTask, showOwner?: boolean) => (
    <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-[#1e293b]/40">
      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
        t.status === "blocked" ? "bg-red-400" : t.status === "in_progress" ? "bg-amber-400 animate-pulse" : "bg-slate-600"
      }`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white">{t.name}</div>
        <div className="text-[10px] text-[#475569] font-mono mt-0.5">{t.id}</div>
        {t.description && <p className="text-[11px] text-[#94a3b8] mt-1">{t.description}</p>}
        {t.output && <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-2">{t.output}</p>}
        {t.blocker && <p className="text-[11px] text-red-400/80 mt-0.5">{t.blocker}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {showOwner && <span className="text-[9px] text-[#475569]">{t.owner}</span>}
        <span className="text-[9px] text-[#475569]">{t.status.replace(/_/g, " ")}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#1e293b] p-6" style={{ background: "#111827" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{"\uD83D\uDD25"}</span>
          <h2 className="text-2xl font-extrabold text-white">Ginge Actions</h2>
        </div>
        <p className="text-sm text-[#94a3b8]">Your tasks, blockers, and what the squad is handling</p>
        <div className="flex items-center gap-6 mt-4">
          <div>
            <div className="text-lg font-extrabold text-[#ef4444]">{gingeBlocked.length}</div>
            <div className="text-[10px] text-[#64748b] uppercase">Blocked on you</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-[#f59e0b]">{gingeNotDone.length}</div>
            <div className="text-[10px] text-[#64748b] uppercase">Your pending</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-[#64748b]">{botTasks.length}</div>
            <div className="text-[10px] text-[#64748b] uppercase">Bot queue</div>
          </div>
        </div>
      </div>

      {/* 1. BLOCKED — red */}
      {gingeBlocked.length > 0 && (
        <div className="rounded-2xl border border-[#ef4444]/25 p-5" style={{ background: "rgba(239,68,68,0.04)" }}>
          <h3 className="text-sm font-bold tracking-widest uppercase text-[#ef4444] mb-4">{"\uD83D\uDED1"} Blocked — Needs Your Action</h3>
          <div className="space-y-4">
            {Object.entries(groupByProject(gingeBlocked)).map(([pid, tasks]) => (
              <div key={pid}>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#00d4d4] mb-2">{projectMap[pid] || pid}</div>
                <div className="space-y-1.5">{tasks.map((t) => renderTaskCard(t))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. YOUR PENDING — amber */}
      {gingeNotDone.length > 0 && (
        <div className="rounded-2xl border border-[#f59e0b]/20 p-5" style={{ background: "rgba(245,158,11,0.03)" }}>
          <h3 className="text-sm font-bold tracking-widest uppercase text-[#f59e0b] mb-4">{"\uD83D\uDC51"} Your Pending Tasks</h3>
          <div className="space-y-4">
            {Object.entries(groupByProject(gingeNotDone)).map(([pid, tasks]) => (
              <div key={pid}>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#00d4d4] mb-2">{projectMap[pid] || pid}</div>
                <div className="space-y-1.5">{tasks.map((t) => renderTaskCard(t))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BOT QUEUE — grey/informational */}
      {botTasks.length > 0 && (
        <div className="rounded-2xl border border-[#1e293b] p-5" style={{ background: "#111827" }}>
          <h3 className="text-sm font-bold tracking-widest uppercase text-[#64748b] mb-4">{"\uD83E\uDD16"} Squad Queue (handled by bots)</h3>
          <div className="space-y-4">
            {Object.entries(groupByProject(botTasks)).map(([pid, tasks]) => (
              <div key={pid}>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#00d4d4] mb-2">{projectMap[pid] || pid}</div>
                <div className="space-y-1.5">{tasks.map((t) => renderTaskCard(t, true))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gingeBlocked.length === 0 && gingeNotDone.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#475569] text-sm">Nothing blocking you. All clear.</p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function TasksPanel({ tasks }: { tasks: PipelineTask[] }) {
  const grouped = useMemo(() => {
    const g: Record<string, PipelineTask[]> = {};
    for (const t of tasks) {
      if (!g[t.stage]) g[t.stage] = [];
      g[t.stage].push(t);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => a.order - b.order);
    }
    return g;
  }, [tasks]);

  if (tasks.length === 0) return <p className="text-xs text-[#475569] py-4 text-center">No tasks found.</p>;

  return (
    <div className="space-y-4">
      {PIPELINE_STAGES.filter((s) => grouped[s]?.length).map((stage) => (
        <div key={stage}>
          <h4 className={`text-[10px] font-bold tracking-wider uppercase mb-2 ${STAGE_COLOR[stage]?.split(" ")[1] || "text-slate-400"}`}>
            {stage}
          </h4>
          <div className="space-y-1">
            {grouped[stage].map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_STATUS_DOT[t.status] || "bg-slate-600"}`} />
                <span className="text-xs text-[#c8d0dc] flex-1 truncate">{t.id} {t.name}</span>
                <span className="text-[9px] text-[#475569]">{t.owner}</span>
                <span className="text-[9px] text-[#475569] w-16 text-right">{t.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataPanel({ metrics, projectMetrics }: { metrics: DataMetric[]; projectMetrics: Record<string, string> }) {
  return (
    <div className="space-y-3">
      {/* Project-level metrics from project record */}
      {Object.keys(projectMetrics).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(projectMetrics).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/[0.03] border border-[#1e293b] px-3 py-2">
              <div className="text-sm font-bold text-white">{v}</div>
              <div className="text-[10px] text-[#475569] uppercase">{k.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data endpoint metrics */}
      {metrics.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.id} className="rounded-lg bg-white/[0.03] border border-[#1e293b] px-3 py-2">
              <div className="text-sm font-bold text-white">{m.value}</div>
              <div className="text-[10px] text-[#475569] uppercase">{m.label}</div>
            </div>
          ))}
        </div>
      ) : Object.keys(projectMetrics).length === 0 ? (
        <p className="text-xs text-[#475569] py-4 text-center">No metrics data yet.</p>
      ) : null}
    </div>
  );
}

function ContentPanel({ items }: { items: ContentItem[] }) {
  if (items.length === 0) return <p className="text-xs text-[#475569] py-4 text-center">No content for this project.</p>;

  return (
    <div className="space-y-1">
      {items.map((c) => (
        <div key={c.id} className="flex items-center gap-3 py-1.5">
          <span className="text-[10px] text-[#475569] font-mono w-20">{c.format}</span>
          <span className="text-xs text-[#c8d0dc] flex-1 truncate">{c.title}</span>
          <span className="text-[9px] text-[#475569]">{c.platforms?.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function VaultPanel({ entries, emptyText }: { entries: VaultEntry[]; emptyText: string }) {
  if (entries.length === 0) return <p className="text-xs text-[#475569] py-4 text-center">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <div key={e.id || i} className="rounded-lg bg-white/[0.02] border border-[#1e293b]/50 px-3 py-2.5">
          <p className="text-xs text-[#c8d0dc] leading-relaxed">{e.text || e.learning || JSON.stringify(e)}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Next Steps Panel ── */

function NextStepsPanel({ tasks }: { tasks: PipelineTask[] }) {
  const nextTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done" && t.status !== "skipped")
      .sort((a, b) => {
        const sa = PIPELINE_STAGES.indexOf(a.stage);
        const sb = PIPELINE_STAGES.indexOf(b.stage);
        if (sa !== sb) return sa - sb;
        return a.order - b.order;
      })
      .slice(0, 3);
  }, [tasks]);

  if (nextTasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#00d4d4]/20 p-5" style={{ background: "rgba(0,212,212,0.03)" }}>
      <h3 className="text-sm font-bold tracking-widest uppercase text-[#00d4d4] mb-4">{"\u25B6\uFE0F"} Next Steps</h3>
      <div className="space-y-2">
        {nextTasks.map((t, i) => {
          const ownerColor = t.owner === "ginge" ? "#ef4444" : t.owner === "claude-code" ? "#3b82f6" : "#22c55e";
          const ownerDot = t.owner === "ginge" ? "bg-red-400" : t.owner === "claude-code" ? "bg-blue-400" : "bg-green-400";
          return (
            <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-[#1e293b]/40">
              <span className="text-sm font-bold text-[#475569] mt-0.5 w-5 text-center flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-white">{t.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ownerDot}`} />
                  <span className="text-[10px] font-semibold" style={{ color: ownerColor }}>{t.owner}</span>
                </div>
                <p className="text-[11px] text-[#94a3b8]">{t.output || t.description || "Pending"}</p>
              </div>
              <span className="text-[9px] text-[#475569] font-mono flex-shrink-0">{t.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Deep Dive Panel ── */

const DEEP_DIVE_SECTIONS = [
  { taskSuffix: "T-0.8", emoji: "\ud83d\udcca", label: "Darwin Score", field: "score" },
  { taskSuffix: "T-0.1", emoji: "\ud83d\udca1", label: "Concept", field: "concept" },
  { taskSuffix: "T-0.3", emoji: "\ud83d\udc65", label: "Audience", field: "audience" },
  { taskSuffix: "T-0.4", emoji: "\ud83c\udfaf", label: "Problem", field: "problem" },
  { taskSuffix: "T-0.5", emoji: "\u2694\ufe0f", label: "Alternatives", field: "alternatives" },
  { taskSuffix: "T-0.6", emoji: "\ud83d\udd11", label: "Differentiation", field: "differentiation" },
  { taskSuffix: "T-0.7", emoji: "\ud83d\udd27", label: "Feasibility", field: "feasibility" },
  { taskSuffix: "T-0.8", emoji: "\ud83d\udcdd", label: "Darwin Notes", field: "notes" },
];

function DeepDivePanel({ projectId, tasks }: { projectId: string; tasks: PipelineTask[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Find task outputs matching the pattern T-X.Y-{projectId}
  const sections = useMemo(() => {
    return DEEP_DIVE_SECTIONS.map((sec) => {
      // Try exact match: T-0.1-{projectId}
      const exactId = `${sec.taskSuffix}-${projectId}`;
      let task = tasks.find((t) => t.id === exactId);
      // Fallback: find any task whose id starts with the suffix and belongs to this project
      if (!task) {
        task = tasks.find((t) => t.id.startsWith(sec.taskSuffix) && t.project_id === projectId);
      }
      return {
        ...sec,
        task,
        output: task?.output || "",
        status: task?.status || "not_started",
      };
    }).filter((s) => s.output); // Only show sections that have output
  }, [tasks, projectId]);

  const toggle = (field: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  if (sections.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
      <div className="px-5 py-4 border-b border-[#1e293b]">
        <h3 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">Project Deep Dive</h3>
      </div>
      <div className="divide-y divide-[#1e293b]/60">
        {sections.map((sec) => {
          const isOpen = expanded.has(sec.field);
          // For Darwin Score, try to extract just the score number for a highlight
          const isScore = sec.field === "score";
          const scoreMatch = isScore ? sec.output.match(/(\d+(?:\.\d+)?)\s*\/\s*10/) : null;

          return (
            <div key={sec.field}>
              <button
                onClick={() => toggle(sec.field)}
                className="w-full flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className="text-sm">{sec.emoji}</span>
                <span className="text-xs font-semibold text-white flex-1">{sec.label}</span>
                {scoreMatch && (
                  <span className="text-sm font-extrabold" style={{ color: "#00d4d4" }}>
                    {scoreMatch[1]}/10
                  </span>
                )}
                {!isOpen && (
                  <span className="text-[11px] text-[#64748b] max-w-[300px] truncate hidden sm:inline">
                    {sec.output.slice(0, 80)}...
                  </span>
                )}
                <span className="text-[10px] text-[#475569]">{isOpen ? "\u25B2" : "\u25BC"}</span>
              </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-1 ml-8">
                  <pre className="text-xs text-[#c8d0dc] leading-relaxed whitespace-pre-wrap font-[inherit] m-0" style={{ wordBreak: "break-word" }}>
                    {sec.output}
                  </pre>
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

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
