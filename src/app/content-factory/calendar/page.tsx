"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface QueueItem {
  id: string;
  project_id: string;
  title: string;
  format: string;
  platforms: string[];
  scheduled_date: string;
  status: string;
  pipeline_step: string;
  topic?: string;
}

interface Project { id: string; name: string; stage?: string }

/* ── Constants ── */
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const PROJECT_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  caliber: { bg: "rgba(0,212,212,0.06)", border: "rgba(0,212,212,0.25)", text: "#00d4d4", dot: "#00d4d4" },
  gemsnap: { bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.25)", text: "#a78bfa", dot: "#a78bfa" },
  repostai: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.25)", text: "#3b82f6", dot: "#3b82f6" },
  edgeauto: { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.25)", text: "#22c55e", dot: "#22c55e" },
};
const DEFAULT_COLOR = { bg: "rgba(107,107,128,0.06)", border: "rgba(107,107,128,0.2)", text: "#6b6b80", dot: "#6b6b80" };

const FORMAT_ICON: Record<string, string> = {
  carousel: "\uD83D\uDCF8",
  reel: "\uD83C\uDFAC",
  ad: "\uD83D\uDCE3",
  thread: "\uD83D\uDC26",
  listing: "\uD83D\uDCCB",
  story: "\uD83D\uDCF1",
  post: "\uD83D\uDCDD",
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "#22c55e",
  done: "#22c55e",
  not_started: "#f59e0b",
  blocked: "#ef4444",
};

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

/* ── Helpers ── */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function projectName(projects: Project[], id: string): string {
  return projects.find((p) => p.id === id)?.name || id;
}

/* ── Component ── */
export default function CalendarPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pData, qData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const allProjects: Project[] = pData?.projects || [];
    const queueItems: QueueItem[] = qData?.items || [];
    const projectIds = new Set(queueItems.map((q) => q.project_id));
    const relevant = allProjects.filter((p) => CONTENT_STAGES.has(p.stage || "") || projectIds.has(p.id));
    setProjects(relevant);
    setQueue(queueItems);

    // Default to the week that has content
    if (queueItems.length > 0) {
      const firstDate = queueItems.find((q) => q.scheduled_date !== "TBD")?.scheduled_date;
      if (firstDate) {
        const target = getWeekStart(new Date(firstDate));
        const now = getWeekStart(new Date());
        const diff = Math.round((target.getTime() - now.getTime()) / (7 * 86400000));
        setWeekOffset(diff);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter queue by project
  const filtered = useMemo(() => {
    if (selectedProject === "all") return queue;
    return queue.filter((q) => q.project_id === selectedProject);
  }, [queue, selectedProject]);

  // Week dates
  const weekStart = useMemo(() => {
    const ws = getWeekStart(new Date());
    ws.setDate(ws.getDate() + weekOffset * 7);
    return ws;
  }, [weekOffset]);

  const weekDates = useMemo(() => WEEKDAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  // Unscheduled items
  const unscheduled = useMemo(() => filtered.filter((q) => q.scheduled_date === "TBD"), [filtered]);

  // Count items in current week
  const weekItemCount = useMemo(() => {
    return weekDates.reduce((sum, d) => {
      const dateStr = d.toISOString().split("T")[0];
      return sum + filtered.filter((q) => q.scheduled_date === dateStr).length;
    }, 0);
  }, [weekDates, filtered]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-transparent border rounded-lg px-3 py-2 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <span className="text-xs font-mono" style={{ color: "#4a4a5e" }}>
          {formatDateShort(weekDates[0])} — {formatDateShort(weekDates[5])}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}>
          {weekItemCount} item{weekItemCount !== 1 ? "s" : ""}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>{"\u2190"} Prev</button>
          <button onClick={() => setWeekOffset(0)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors" style={{ color: weekOffset === 0 ? "#00d4d4" : "#6b6b80", border: `1px solid ${weekOffset === 0 ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`, background: weekOffset === 0 ? "rgba(0,212,212,0.06)" : "transparent" }}>This Week</button>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>Next {"\u2192"}</button>
        </div>
      </div>

      {/* Calendar Grid — Mon-Sat */}
      <div className="grid grid-cols-6 gap-2">
        {WEEKDAYS.map((day, i) => {
          const date = weekDates[i];
          const dateStr = date.toISOString().split("T")[0];
          const isToday = new Date().toISOString().split("T")[0] === dateStr;
          const dayItems = filtered.filter((q) => q.scheduled_date === dateStr);

          return (
            <div key={day} className="rounded-lg min-h-[160px] flex flex-col"
              style={{
                background: isToday ? "rgba(0,212,212,0.03)" : "#111118",
                border: `1px solid ${isToday ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`,
              }}>
              {/* Day header */}
              <div className="px-2.5 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,30,46,0.5)" }}>
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: isToday ? "#00d4d4" : "#6b6b80" }}>
                    {day.slice(0, 3)}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "#4a4a5e" }}>{formatDateShort(date)}</span>
                </div>
                {dayItems.length > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.12)", color: "#00d4d4" }}>
                    {dayItems.length}
                  </span>
                )}
              </div>

              {/* Content cards */}
              <div className="flex-1 p-1.5 space-y-1.5">
                {dayItems.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[10px]" style={{ color: "#2a2a3e" }}>{"\u2014"}</span>
                  </div>
                )}
                {dayItems.map((item) => (
                  <ContentCard key={item.id} item={item} projects={projects} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled section */}
      {unscheduled.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: "#111118", border: "1px dashed rgba(245,158,11,0.3)" }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(245,158,11,0.04)", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>{"\uD83D\uDCC5"} Unscheduled</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>{unscheduled.length}</span>
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {unscheduled.map((item) => (
              <ContentCard key={item.id} item={item} projects={projects} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 rounded-lg" style={{ background: "#111118", border: "1px dashed #1e1e2e" }}>
          <p className="text-sm" style={{ color: "#6b6b80" }}>No content in the queue yet.</p>
        </div>
      )}
    </div>
  );
}

/* ── Content Card ── */
function ContentCard({ item, projects }: { item: QueueItem; projects: Project[] }) {
  const pc = PROJECT_COLOR[item.project_id] || DEFAULT_COLOR;
  const formatIcon = FORMAT_ICON[item.format] || "\uD83D\uDCDD";
  const statusDot = STATUS_DOT[item.status] || "#6b6b80";
  const name = projectName(projects, item.project_id);

  return (
    <div className="rounded-lg px-2.5 py-2 transition-all hover:brightness-110"
      style={{ background: pc.bg, border: `1px solid ${pc.border}` }}>
      {/* Project name */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pc.dot }} />
        <span className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: pc.text }}>{name}</span>
      </div>

      {/* Title */}
      <p className="text-[11px] font-medium leading-snug mb-1.5 line-clamp-2" style={{ color: "#e0e0ee" }}>{item.title}</p>

      {/* Format + status */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded capitalize" style={{ background: "rgba(107,107,128,0.1)", color: "#94a3b8" }}>
          {formatIcon} {item.format}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot }} />
          <span className="text-[9px]" style={{ color: statusDot }}>{item.status.replace(/_/g, " ")}</span>
        </span>
      </div>
    </div>
  );
}
