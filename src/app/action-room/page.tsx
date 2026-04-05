"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

/* ── Types ── */

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

interface Metric {
  id: string;
  project_id: string;
  section: string;
  name: string;
  value: string;
  state: string;
  source: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "active" | "idle" | "blocked" | "error";
  current_task: string;
  last_updated: string;
  last_action?: string;
}

interface Project {
  id: string;
  name: string;
}

/* ── Constants ── */

const PRIORITY_ORDER: Record<string, number> = {
  blocked: 0,
  in_progress: 1,
  not_started: 2,
};

const STATUS_EMOJI: Record<string, string> = {
  blocked: "\uD83D\uDD34",
  in_progress: "\uD83D\uDFE1",
  not_started: "\uD83D\uDFE2",
};

const AGENT_STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  active: { dot: "bg-green-400 animate-pulse", label: "Active" },
  idle: { dot: "bg-slate-500", label: "Idle" },
  blocked: { dot: "bg-red-400", label: "Blocked" },
  error: { dot: "bg-red-500", label: "Error" },
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

/* ── Main Component ── */

export default function ActionRoom() {
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // Fetch all data on mount
  const fetchAll = useCallback(async () => {
    const [tasksRes, dataRes, squadRes, projectsRes] = await Promise.allSettled([
      fetch("/api/pipeline-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }),
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }),
      fetch("/api/squad", { method: "GET" }),
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }),
    ]);

    if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
      const store = await tasksRes.value.json();
      setTasks(store.tasks || []);
    }
    if (dataRes.status === "fulfilled" && dataRes.value.ok) {
      const items = await dataRes.value.json();
      setMetrics(Array.isArray(items) ? items : []);
    }
    if (squadRes.status === "fulfilled" && squadRes.value.ok) {
      const data = await squadRes.value.json();
      setAgents(data.agents || []);
    }
    if (projectsRes.status === "fulfilled" && projectsRes.value.ok) {
      const store = await projectsRes.value.json();
      setProjects(store.projects || []);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Project name lookup
  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) m[p.id] = p.name;
    return m;
  }, [projects]);

  // ── Daily Pulse: find data sources by ID, parse JSON value ──
  const parsePulse = (id: string): { data: Record<string, any>; state: string } | null => {
    const item = metrics.find((m) => m.id === id);
    if (!item) return null;
    let data: Record<string, any> = {};
    if (item.value) { try { data = JSON.parse(item.value); } catch { /* keep empty */ } }
    return { data, state: item.state };
  };
  const caliberIG = useMemo(() => parsePulse("caliber-ig"), [metrics]);
  const gemSnapData = useMemo(() => parsePulse("gemsnap-posthog"), [metrics]);
  const adSpendData = useMemo(() => parsePulse("gemsnap-ads"), [metrics]);

  // ── Ad-hoc actions: ID starts with "A-", not done ──
  const adhocBase = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.id.startsWith("A-") &&
          t.status !== "done" &&
          t.status !== "skipped" &&
          t.status !== "abandoned"
      ),
    [tasks]
  );

  const sortByEmoji = (list: PipelineTask[]) =>
    [...list].sort((a, b) => (PRIORITY_ORDER[a.status] ?? 3) - (PRIORITY_ORDER[b.status] ?? 3));

  // Your Actions (owner=ginge)
  const gingeActions = useMemo(() => sortByEmoji(adhocBase.filter((t) => t.owner === "ginge")), [adhocBase]);
  const totalGingeTasks = gingeActions.length;

  // Squad Actions (owner !== ginge)
  const squadActions = useMemo(
    () => sortByEmoji(adhocBase.filter((t) => t.owner !== "ginge")),
    [adhocBase]
  );
  const totalSquadTasks = squadActions.length;

  // ── Team Status: AI agents only ──
  const teamAgents = useMemo(
    () => agents.filter((a) => ["atlas", "newton", "darwin", "jimmy"].includes(a.id)),
    [agents]
  );

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f" }}>
      {/* ── Header ── */}
      <header className="hidden sm:block border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              APEX COMMAND CENTRE
            </h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <span className="text-sm text-white font-medium">Briefing Room</span>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Launchpad</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <Link href="/machine-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Machine Room</Link>
              <Link href="/schematics" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Schematics</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Page Title ── */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{"\u2615"}</span>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Morning Brief</h2>
            <p className="text-xs text-[#64748b]">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            TOP SECTION — Daily Pulse
        ══════════════════════════════════════════════ */}
        <section>
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#64748b] mb-3">Daily Pulse</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Caliber IG */}
            <PulseShell title="Caliber IG" emoji={"\uD83D\uDCF8"} accentColor="#f59e0b">
              {caliberIG ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-white">
                    {caliberIG.data.followers ?? "–"} followers {"\u00B7"} {caliberIG.data.posts ?? "–"} posts
                  </p>
                  <p className="text-[11px] text-[#94a3b8]">
                    Last post: {caliberIG.data.last_post_likes ?? 0}{"\u2764\uFE0F"}{" "}
                    {caliberIG.data.last_post_comments ?? 0}{"\uD83D\uDCAC"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#475569] py-2">No data yet</p>
              )}
            </PulseShell>

            {/* Card 2: GemSnap */}
            <PulseShell title="GemSnap" emoji={"\uD83D\uDC8E"} accentColor="#00d4d4">
              {gemSnapData ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-white">
                    {gemSnapData.data.pageviews_24h ?? "–"} views {"\u00B7"} {gemSnapData.data.cta_clicks_24h ?? "–"} CTA clicks
                  </p>
                  <p className="text-[11px] text-[#94a3b8]">
                    {gemSnapData.data.sample_gallery_clicked ?? 0} sample scans {"\u00B7"}{" "}
                    {gemSnapData.data.real_scans_24h ?? 0} real scan{(gemSnapData.data.real_scans_24h ?? 0) !== 1 ? "s" : ""} {"\u00B7"}{" "}
                    {gemSnapData.data.conversions_24h ?? 0} conversions
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#475569] py-2">No data yet</p>
              )}
            </PulseShell>

            {/* Card 3: Ad Spend */}
            <PulseShell title="Ad Spend" emoji={"\uD83D\uDCB0"} accentColor="#ef4444">
              {adSpendData ? (
                adSpendData.data.note ? (
                  <p className="text-[11px] text-[#f59e0b] py-2">{"\u26A0\uFE0F"} {adSpendData.data.note}</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-white">
                      ${adSpendData.data.spend ?? "–"} spent {"\u00B7"} {adSpendData.data.clicks ?? "–"} clicks {"\u00B7"} ${adSpendData.data.cpc ?? "–"} CPC
                    </p>
                  </div>
                )
              ) : (
                <p className="text-xs text-[#475569] py-2">No data yet</p>
              )}
            </PulseShell>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            MIDDLE SECTION — Actions
        ══════════════════════════════════════════════ */}
        <section className="space-y-6">
          {/* 🔴 Your Actions */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#64748b]">
                {"\uD83D\uDD34"} Your Actions
              </h3>
              <span className="text-[10px] text-[#475569] font-mono">
                {Math.min(gingeActions.length, 10)}{totalGingeTasks > 10 ? ` of ${totalGingeTasks}` : ""} tasks
              </span>
            </div>

            {gingeActions.length === 0 ? (
              <div className="rounded-2xl border border-[#1e293b] p-8 text-center" style={{ background: "#111827" }}>
                <p className="text-sm text-[#475569]">No active tasks assigned to you. All clear.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gingeActions.slice(0, 10).map((task) => (
                  <ActionCard
                    key={task.id}
                    task={task}
                    projectName={projectMap[task.project_id] || task.project_id}
                    isDone={task.status === "done"}
                  />
                ))}
                {totalGingeTasks > 10 && (
                  <div className="text-center pt-2">
                    <Link href="/tasks" className="text-[11px] text-[#00d4d4] hover:underline">
                      View all {totalGingeTasks} tasks {"\u2192"}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 🤖 Squad Actions */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#64748b]">
                {"\uD83E\uDD16"} Squad Actions
              </h3>
              <span className="text-[10px] text-[#475569] font-mono">
                {Math.min(squadActions.length, 10)}{totalSquadTasks > 10 ? ` of ${totalSquadTasks}` : ""} tasks
              </span>
            </div>

            {squadActions.length === 0 ? (
              <div className="rounded-2xl border border-[#1e293b] p-8 text-center" style={{ background: "#111827" }}>
                <p className="text-sm text-[#475569]">No squad tasks in the queue.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {squadActions.slice(0, 10).map((task) => (
                  <ActionCard
                    key={task.id}
                    task={task}
                    projectName={projectMap[task.project_id] || task.project_id}
                    isDone={task.status === "done"}
                    showOwner
                  />
                ))}
                {totalSquadTasks > 10 && (
                  <div className="text-center pt-2">
                    <Link href="/tasks" className="text-[11px] text-[#00d4d4] hover:underline">
                      View all {totalSquadTasks} tasks {"\u2192"}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            BOTTOM SECTION — Team Status
        ══════════════════════════════════════════════ */}
        <section>
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#64748b] mb-3">Team Status</h3>
          <div className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
            {teamAgents.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[#475569]">Loading squad data...</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e293b]/60">
                {teamAgents.map((agent) => {
                  const statusStyle = AGENT_STATUS_STYLE[agent.status] || AGENT_STATUS_STYLE.idle;
                  return (
                    <div key={agent.id} className="flex items-center gap-4 px-5 py-3.5">
                      {/* Agent identity */}
                      <span className="text-xl flex-shrink-0">{agent.emoji}</span>
                      <div className="w-24 flex-shrink-0">
                        <div className="text-xs font-bold text-white">{agent.name}</div>
                        <div className="text-[10px] text-[#475569]">{agent.role.split(" ")[0]}</div>
                      </div>

                      {/* Status dot + label */}
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                        <span className="text-[10px] text-[#94a3b8]">{statusStyle.label}</span>
                      </div>

                      {/* Current task */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#c8d0dc] truncate">
                          {agent.current_task || "No active task"}
                        </p>
                      </div>

                      {/* Last activity */}
                      <div className="flex-shrink-0 text-right">
                        <span className="text-[10px] text-[#475569] font-mono">
                          {formatTime(agent.last_updated)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

    </div>
  );
}

/* ── Action Card Component ── */

const AGENT_BADGE: Record<string, { emoji: string; color: string; label: string }> = {
  atlas: { emoji: "\uD83E\uDDED", color: "#00d4d4", label: "Atlas" },
  newton: { emoji: "\uD83D\uDD2C", color: "#3b82f6", label: "Newton" },
  darwin: { emoji: "\uD83D\uDD04", color: "#22c55e", label: "Darwin" },
  jimmy: { emoji: "\uD83C\uDFA8", color: "#ec4899", label: "Jimmy" },
  ginge: { emoji: "\uD83D\uDC51", color: "#f59e0b", label: "Ginge" },
};

function ActionCard({
  task,
  projectName,
  isDone,
  showOwner,
}: {
  task: PipelineTask;
  projectName: string;
  isDone?: boolean;
  showOwner?: boolean;
}) {
  const emoji = isDone ? "\u2705" : (STATUS_EMOJI[task.status] || "\uD83D\uDFE2");
  const ownerBadge = AGENT_BADGE[task.owner];

  return (
    <div
      className="rounded-xl border border-[#1e293b] px-4 py-3 flex items-start gap-3 transition-opacity"
      style={{ background: "#111827", opacity: isDone ? 0.4 : 1 }}
    >
      <span className="text-sm mt-0.5 flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold text-white">{task.name}</span>
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">
            {projectName}
          </span>
          {isDone && (
            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              {"\u2705"} Done
            </span>
          )}
          {showOwner && ownerBadge && (
            <span
              className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: ownerBadge.color, background: `${ownerBadge.color}15`, border: `1px solid ${ownerBadge.color}30` }}
            >
              {ownerBadge.emoji} {ownerBadge.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#94a3b8] leading-relaxed">
          {task.description || "No description"}
        </p>
      </div>
    </div>
  );
}

/* ── Pulse Shell (shared card wrapper) ── */

function PulseShell({
  title,
  emoji,
  accentColor,
  children,
}: {
  title: string;
  emoji: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-[#1e293b] p-5"
      style={{ background: "#111827" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{emoji}</span>
        <h4 className="text-xs font-bold tracking-widest uppercase" style={{ color: accentColor }}>
          {title}
        </h4>
      </div>
      {children}
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
