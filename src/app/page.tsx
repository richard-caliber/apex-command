"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

/* ─── Types ─── */

interface Task {
  text: string;
  owner: string;
  priority: "red" | "amber" | "green";
  done: boolean;
}

interface DarwinScore {
  score: number;
  verdict: string;
}

interface NextAction {
  name: string;
  owner: string;
  taskId: string;
}

interface Project {
  id: string;
  name: string;
  image: string;
  stage: string;
  status: string;
  bottleneck: string;
  keyMetric: { label: string; value: string };
  overdueTasks: number;
  blockedTasks: number;
  tasks: Task[];
  darwinScore: DarwinScore | null;
  nextAction: NextAction | null;
}

interface Idea {
  id: string;
  title: string;
  image?: string;
  summary: string;
  status: string;
  tags: string[];
}

interface Data {
  projects: Project[];
  ideas: Idea[];
  lastUpdated: string;
}

/* ─── Constants ─── */

const STATUS_PRIORITY: Record<string, number> = {
  blocked: 0,
  attention: 1,
  scaling: 2,
  "on-track": 3,
  parked: 4,
  zombie: 5,
};

const AURA: Record<string, string> = {
  attention: "aura-attention",
  "on-track": "aura-on-track",
  scaling: "aura-scaling",
  parked: "aura-parked",
  zombie: "aura-zombie",
  blocked: "aura-blocked",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  attention: { label: "ATTENTION", color: "text-amber-400", bg: "bg-amber-400/15" },
  "on-track": { label: "ON TRACK", color: "text-teal-400", bg: "bg-teal-400/15" },
  scaling: { label: "SCALING", color: "text-cyan-300", bg: "bg-cyan-300/15" },
  parked: { label: "PARKED", color: "text-slate-500", bg: "bg-slate-500/15" },
  zombie: { label: "ZOMBIE", color: "text-gray-600", bg: "bg-gray-600/15" },
  blocked: { label: "BLOCKED", color: "text-red-400", bg: "bg-red-400/15" },
};

const STAGE_COLOR: Record<string, string> = {
  Idea: "bg-purple-500/20 text-purple-300",
  Validation: "bg-blue-500/20 text-blue-300",
  MVP: "bg-sky-500/20 text-sky-300",
  Traffic: "bg-amber-500/20 text-amber-300",
  Conversion: "bg-orange-500/20 text-orange-300",
  Delivery: "bg-green-500/20 text-green-300",
  Scale: "bg-cyan-500/20 text-cyan-300",
};

const IDEA_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  raw: { label: "RAW", color: "text-gray-400" },
  expanded: { label: "EXPANDED", color: "text-blue-400" },
  queued: { label: "QUEUED", color: "text-cyan-400" },
  promoted: { label: "PROMOTED", color: "text-green-400" },
  zombie: { label: "ZOMBIE", color: "text-gray-600" },
};

const IDEA_GRADIENTS = [
  "from-purple-900/40 via-indigo-900/30 to-slate-900/50",
  "from-blue-900/40 via-cyan-900/30 to-slate-900/50",
  "from-emerald-900/40 via-teal-900/30 to-slate-900/50",
  "from-rose-900/40 via-pink-900/30 to-slate-900/50",
  "from-amber-900/40 via-orange-900/30 to-slate-900/50",
  "from-indigo-900/40 via-violet-900/30 to-slate-900/50",
];

/* ─── Helpers for API mapping ─── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapStatus(apiStatus: string): string {
  const map: Record<string, string> = {
    active: "on-track",
    blocked: "blocked",
    paused: "parked",
    completed: "on-track",
  };
  return map[apiStatus] ?? apiStatus;
}

function firstMetric(metrics?: Record<string, string>): { label: string; value: string } {
  if (!metrics) return { label: "", value: "" };
  const keys = Object.keys(metrics);
  if (keys.length === 0) return { label: "", value: "" };
  return { label: capitalize(keys[0].replace(/_/g, " ")), value: metrics[keys[0]] };
}

/* ─── Main Dashboard ─── */

export default function WarRoom() {
  const [data, setData] = useState<Data | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      if (!res.ok) return;
      const store = await res.json();

      // Fetch all tasks to extract Darwin gate scores + next actions
      const stageOrder = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];
      let allTasks: { id: string; project_id: string; stage: string; output: string; order: number; status: string; owner: string; name: string }[] = [];
      try {
        const tasksRes = await fetch("/api/pipeline-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        });
        if (tasksRes.ok) {
          const taskStore = await tasksRes.json();
          allTasks = taskStore.tasks || [];
        }
      } catch { /* ignore */ }

      // Build score map
      const scoreMap: Record<string, { score: number; verdict: string; stageIdx: number }> = {};
      for (const t of allTasks) {
        if (!t.output || t.project_id === "_template") continue;
        try {
          const parsed = JSON.parse(t.output);
          if (typeof parsed.score === "number") {
            const si = stageOrder.indexOf(t.stage);
            const existing = scoreMap[t.project_id];
            if (!existing || si > existing.stageIdx) {
              scoreMap[t.project_id] = { score: parsed.score, verdict: parsed.verdict || "", stageIdx: si };
            }
          }
        } catch { /* not JSON */ }
      }

      // Build next action map — first undone task per project (by stage order, then task order)
      const nextMap: Record<string, NextAction> = {};
      for (const pid of [...new Set(allTasks.map((t) => t.project_id))]) {
        if (pid === "_template") continue;
        const projectTasks = allTasks
          .filter((t) => t.project_id === pid && t.status !== "done" && t.status !== "skipped")
          .sort((a, b) => {
            const sa = stageOrder.indexOf(a.stage);
            const sb = stageOrder.indexOf(b.stage);
            if (sa !== sb) return sa - sb;
            return a.order - b.order;
          });
        if (projectTasks.length > 0) {
          const t = projectTasks[0];
          nextMap[pid] = { name: t.name, owner: t.owner, taskId: t.id };
        }
      }

      const apiProjects: Project[] = (store.projects || []).map((p: Record<string, unknown>) => {
        const projectId = p.id as string;
        const entry = scoreMap[projectId];
        const darwinScore: DarwinScore | null = entry ? { score: entry.score, verdict: entry.verdict } : null;

        return {
          id: projectId,
          name: p.name as string,
          image: (p.image_url as string) || `/images/${projectId}-card.jpg`,
          stage: capitalize(p.stage as string || "mvp"),
          status: mapStatus(p.status as string),
          bottleneck: (p.blocker as string) || "",
          keyMetric: firstMetric(p.metrics as Record<string, string> | undefined),
          overdueTasks: 0,
          blockedTasks: 0,
          tasks: [],
          darwinScore,
          nextAction: nextMap[projectId] || null,
        };
      });

      // Fetch ideas
      let ideas: Idea[] = [];
      try {
        const ideasRes = await fetch("/api/map-room/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        });
        if (ideasRes.ok) {
          const ideasData = await ideasRes.json();
          ideas = (Array.isArray(ideasData) ? ideasData : []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            title: i.title as string,
            image: (i.image_url as string) || undefined,
            summary: (i.description as string) || "",
            status: (i.status as string) || "raw",
            tags: (i.tags as string[]) || [],
          }));
        }
      } catch {
        // Fallback to old endpoint
        try {
          const oldRes = await fetch("/api/status");
          if (oldRes.ok) {
            const old = await oldRes.json();
            ideas = old.ideas || [];
          }
        } catch { /* ignore */ }
      }
      setData({
        projects: apiProjects,
        ideas,
        lastUpdated: store.lastUpdated || new Date().toISOString(),
      });
    } catch {
      // silent fail — will retry
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [fetchData]);

  const sortedProjects = data
    ? [...data.projects].sort(
        (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
      )
    : [];

  const ideas = data?.ideas ?? [];

  return (
    <div className="min-h-dvh relative">
      <Particles />

      {/* ─── Header ─── */}
      <header className="hidden sm:block relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              APEX COMMAND CENTRE
            </h1>
            <nav className="hidden sm:flex items-center gap-4">
              <span className="text-sm text-white font-medium">War Room</span>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompt Library</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
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

      {/* ─── Main Grid ─── */}
      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Section: Active Projects */}
        {sortedProjects.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">Projects</h2>
              <span className="text-xs text-[#475569] font-mono">{sortedProjects.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}

        {/* Section: Ideas */}
        {ideas.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">Ideas</h2>
              <span className="text-xs text-[#475569] font-mono">{ideas.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
              {ideas.map((idea, i) => (
                <IdeaCard key={idea.id} idea={idea} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!data && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-30">&#9678;</div>
              <p className="text-[#475569] text-sm">Loading command wall...</p>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 text-center text-xs text-[#475569] py-6">
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "—"}
        {" · "}Auto-refreshes every 60s
      </footer>
    </div>
  );
}

/* ─── Project Card ─── */

function ProjectCard({ project }: { project: Project }) {
  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG["on-track"];
  const stageColor = STAGE_COLOR[project.stage] ?? "bg-slate-500/20 text-slate-300";
  const auraClass = AURA[project.status] ?? "";

  const signals: string[] = [];
  if (project.overdueTasks > 0) signals.push(`${project.overdueTasks} overdue`);
  if (project.blockedTasks > 0) signals.push(`${project.blockedTasks} blocked`);

  return (
    <Link
      href={`/map-room/pipeline?project=${project.id}`}
      className={`block rounded-2xl overflow-hidden bg-[#111827] border border-[#1e293b] transition-all duration-300 hover:scale-[1.02] hover:brightness-110 cursor-pointer group ${auraClass}`}
    >
      {/* Image + overlays */}
      <div className="relative aspect-video">
        <Image
          src={project.image}
          alt={project.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          unoptimized={project.image.endsWith(".svg") || project.image.startsWith("http")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

        {/* Stage badge — top left */}
        <div className="absolute top-3 left-3">
          <span className={`stage-badge ${stageColor}`}>
            {project.stage}
          </span>
        </div>

        {/* Status badge — top right */}
        <div className="absolute top-3 right-3">
          <span className={`text-[9px] font-bold tracking-wider ${statusCfg.color} ${statusCfg.bg} px-2 py-0.5 rounded`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Darwin Score — top left below stage */}
        {project.darwinScore && (() => {
          const s = project.darwinScore.score;
          const bg = s >= 7 ? "rgba(34,197,94,0.85)" : s >= 4 ? "rgba(245,158,11,0.85)" : "rgba(239,68,68,0.85)";
          const label = s >= 7 ? "PROCEED" : s >= 4 ? "ITERATE" : "PARKED";
          return (
            <div className="absolute top-10 left-3">
              <span
                className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded text-white backdrop-blur-sm"
                style={{ background: bg }}
              >
                {s}/10 {label}
              </span>
            </div>
          );
        })()}

        {/* Name + Metric — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <h2 className="text-lg font-bold text-white leading-tight group-hover:text-cyan-100 transition-colors">
            {project.name}
          </h2>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-2xl font-extrabold text-white leading-none">
              {project.keyMetric.value}
            </div>
            <div className="text-[10px] text-[#94a3b8] uppercase tracking-wider">
              {project.keyMetric.label}
            </div>
          </div>
        </div>
      </div>

      {/* Next action + bottleneck */}
      <div className="px-4 py-3 border-t border-[#1e293b]/60">
        {project.nextAction && (() => {
          const o = project.nextAction.owner;
          const color = o === "ginge" ? "#ef4444" : o === "claude-code" ? "#3b82f6" : "#22c55e";
          const dot = o === "ginge" ? "bg-red-400" : o === "claude-code" ? "bg-blue-400" : "bg-green-400";
          return (
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-[10px] font-semibold truncate" style={{ color }}>
                Next: {project.nextAction.name} → {project.nextAction.owner}
              </span>
            </div>
          );
        })()}
        <p className="text-xs text-[#94a3b8] leading-relaxed truncate">
          {project.bottleneck}
        </p>
        {signals.length > 0 && (
          <div className="flex items-center gap-3 mt-1.5">
            {signals.map((s) => (
              <span
                key={s}
                className="text-[10px] font-semibold text-red-400/80 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400/70 flex-shrink-0" />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ─── Idea Card ─── */

function IdeaCard({ idea, index }: { idea: Idea; index: number }) {
  const statusCfg = IDEA_STATUS_CONFIG[idea.status] ?? IDEA_STATUS_CONFIG["raw"];
  const isZombie = idea.status === "zombie";
  const gradient = IDEA_GRADIENTS[index % IDEA_GRADIENTS.length];

  return (
    <Link
      href={`/map-room/ideas/${idea.id}`}
      className={`block rounded-2xl overflow-hidden bg-[#111827] border border-[#1e293b] transition-all duration-300 hover:scale-[1.02] hover:brightness-110 cursor-pointer group ${isZombie ? "aura-idea-zombie" : "aura-idea"}`}
    >
      {/* Visual area — image or gradient fallback */}
      <div className={`relative aspect-video ${!idea.image ? `bg-gradient-to-br ${gradient}` : ""}`}>
        {idea.image ? (
          <>
            <Image
              src={idea.image}
              alt={idea.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized={idea.image.startsWith("http")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }} />
        )}

        {/* Status badge — top right */}
        <div className="absolute top-3 right-3">
          <span className={`text-[9px] font-bold tracking-wider ${statusCfg.color} bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Idea indicator — top left */}
        <div className="absolute top-3 left-3">
          <span className="stage-badge bg-purple-500/20 text-purple-300">
            Idea
          </span>
        </div>

        {/* Title — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-base font-bold text-white leading-tight group-hover:text-purple-200 transition-colors">
            {idea.title}
          </h2>
        </div>
      </div>

      {/* Summary + tags */}
      <div className="px-4 py-3 border-t border-[#1e293b]/60">
        {idea.summary && (
          <p className="text-xs text-[#94a3b8] leading-relaxed truncate mb-2">
            {idea.summary}
          </p>
        )}
        {idea.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-[#64748b] bg-[#1e293b] px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ─── Particles ─── */

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
