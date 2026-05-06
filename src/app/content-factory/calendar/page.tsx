"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface QueueItem {
  id: string; project_id: string; title: string; format: string; platforms: string[];
  scheduled_date: string; status: string; pipeline_step: string;
}
interface LibraryItem {
  id: string; project_id: string; title: string; format: string; platforms: string[];
  posted_date: string; performance_tag: string;
}
interface Project { id: string; name: string; stage?: string }

// Unified calendar item
interface CalendarItem {
  id: string; project_id: string; title: string; format: string;
  date: string; type: "published" | "scheduled" | "missed";
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const PROJECT_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  caliber: { bg: "rgba(0,212,212,0.06)", border: "rgba(0,212,212,0.25)", text: "#00d4d4", dot: "#00d4d4" },
  gemsnap: { bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.25)", text: "#a78bfa", dot: "#a78bfa" },
  repostai: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.25)", text: "#3b82f6", dot: "#3b82f6" },
  "edge-auto": { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.25)", text: "#22c55e", dot: "#22c55e" },
};
const DEFAULT_COLOR = { bg: "rgba(107,107,128,0.06)", border: "rgba(107,107,128,0.2)", text: "#6b6b80", dot: "#6b6b80" };

const FORMAT_ICON: Record<string, string> = {
  carousel: "\uD83D\uDCF8", reel: "\uD83C\uDFAC", ad: "\uD83D\uDCE3", thread: "\uD83D\uDC26",
  listing: "\uD83D\uDCCB", story: "\uD83D\uDCF1", post: "\uD83D\uDCDD",
};

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

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

export default function CalendarPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pData, qData, lData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
      api("/api/content-library", { action: "list" }),
    ]);
    const allProjects: Project[] = pData?.projects || [];
    const queueItems: QueueItem[] = qData?.items || [];
    const libraryItems: LibraryItem[] = lData?.items || [];
    const today = new Date().toISOString().split("T")[0];

    // Build unified items
    const items: CalendarItem[] = [];

    // Published items from library (green)
    for (const lib of libraryItems) {
      if (lib.posted_date) {
        items.push({ id: lib.id, project_id: lib.project_id, title: lib.title, format: lib.format, date: lib.posted_date, type: "published" });
      }
    }

    // Published library IDs for matching
    const publishedIds = new Set(libraryItems.map((l) => l.id));

    // Queue items
    for (const q of queueItems) {
      if (q.scheduled_date === "TBD" || publishedIds.has(q.id)) continue;
      if (q.scheduled_date < today) {
        // Past scheduled date but not in library = missed
        items.push({ id: q.id, project_id: q.project_id, title: q.title, format: q.format, date: q.scheduled_date, type: "missed" });
      } else {
        // Future = scheduled (blue)
        items.push({ id: q.id, project_id: q.project_id, title: q.title, format: q.format, date: q.scheduled_date, type: "scheduled" });
      }
    }

    const projectIds = new Set(items.map((i) => i.project_id));
    const relevant = allProjects.filter((p) => CONTENT_STAGES.has(p.stage || "") || projectIds.has(p.id));
    setProjects(relevant);
    setCalendarItems(items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (selectedProject === "all") return calendarItems;
    return calendarItems.filter((i) => i.project_id === selectedProject);
  }, [calendarItems, selectedProject]);

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

  // Month view data
  const monthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    d.setDate(1);
    return d;
  }, [monthOffset]);

  const monthDays = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from Monday before the 1st
    const startOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(firstDay);
    start.setDate(start.getDate() - startOffset);
    // Build 6 rows of 7 days (42 cells)
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthDate]);

  const monthLabel = monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const todayStr = new Date().toISOString().split("T")[0];

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStartDate = getWeekStart(now);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const next7Start = new Date(now);
    next7Start.setDate(next7Start.getDate() + 1);
    const next7End = new Date(now);
    next7End.setDate(next7End.getDate() + 7);

    const wsStr = weekStartDate.toISOString().split("T")[0];
    const weStr = weekEndDate.toISOString().split("T")[0];
    const n7sStr = next7Start.toISOString().split("T")[0];
    const n7eStr = next7End.toISOString().split("T")[0];

    const publishedThisWeek = filtered.filter((i) => i.type === "published" && i.date >= wsStr && i.date <= weStr).length;
    const scheduledNext7 = filtered.filter((i) => i.type === "scheduled" && i.date >= n7sStr && i.date <= n7eStr).length;
    return { publishedThisWeek, scheduledNext7 };
  }, [filtered]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#0a0a0f] border rounded-lg px-3 py-2 cursor-pointer focus:outline-none [&>option]:bg-[#0a0a0f] [&>option]:text-white"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* View toggle */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          <button onClick={() => setViewMode("week")} className="text-xs px-3 py-1.5 cursor-pointer transition-colors" style={{ background: viewMode === "week" ? "rgba(0,212,212,0.1)" : "transparent", color: viewMode === "week" ? "#00d4d4" : "#6b6b80" }}>Week</button>
          <button onClick={() => setViewMode("month")} className="text-xs px-3 py-1.5 cursor-pointer transition-colors" style={{ background: viewMode === "month" ? "rgba(0,212,212,0.1)" : "transparent", color: viewMode === "month" ? "#00d4d4" : "#6b6b80" }}>Month</button>
        </div>

        <span className="text-xs font-mono" style={{ color: "#4a4a5e" }}>
          {viewMode === "week" ? `${formatDateShort(weekDates[0])} — ${formatDateShort(weekDates[6])}` : monthLabel}
        </span>

        {/* Stats pills */}
        {stats.publishedThisWeek > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            {stats.publishedThisWeek} published this week
          </span>
        )}
        {stats.scheduledNext7 > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
            {stats.scheduledNext7} scheduled next 7 days
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {viewMode === "week" ? (
            <>
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>{"\u2190"} Prev</button>
              <button onClick={() => setWeekOffset(0)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors" style={{ color: weekOffset === 0 ? "#00d4d4" : "#6b6b80", border: `1px solid ${weekOffset === 0 ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`, background: weekOffset === 0 ? "rgba(0,212,212,0.06)" : "transparent" }}>Today</button>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>Next {"\u2192"}</button>
            </>
          ) : (
            <>
              <button onClick={() => setMonthOffset(monthOffset - 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>{"\u2190"} Prev</button>
              <button onClick={() => setMonthOffset(0)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors" style={{ color: monthOffset === 0 ? "#00d4d4" : "#6b6b80", border: `1px solid ${monthOffset === 0 ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`, background: monthOffset === 0 ? "rgba(0,212,212,0.06)" : "transparent" }}>Today</button>
              <button onClick={() => setMonthOffset(monthOffset + 1)} className="text-xs px-2.5 py-1.5 rounded cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ color: "#6b6b80", border: "1px solid #1e1e2e", background: "transparent" }}>Next {"\u2192"}</button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} /> Published</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} /> Scheduled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} /> Missed</span>
      </div>

      {/* Calendar Grid */}
      {viewMode === "week" ? (
        /* ── Week View ── */
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((day, i) => {
            const date = weekDates[i];
            const dateStr = date.toISOString().split("T")[0];
            const isToday = todayStr === dateStr;
            const dayItems = filtered.filter((item) => item.date === dateStr);

            return (
              <div key={day} className="rounded-lg min-h-[160px] flex flex-col"
                style={{
                  background: isToday ? "rgba(0,212,212,0.04)" : "#111118",
                  border: isToday ? "2px solid rgba(0,212,212,0.4)" : "1px solid #1e1e2e",
                }}>
                <div className="px-2 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(30,30,46,0.5)" }}>
                  <div>
                    <span className="text-[10px] font-bold uppercase block" style={{ color: isToday ? "#00d4d4" : "#6b6b80" }}>
                      {day.slice(0, 3)}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: isToday ? "#00d4d4" : "#4a4a5e" }}>{date.getDate()}</span>
                  </div>
                  {dayItems.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.12)", color: "#00d4d4" }}>
                      {dayItems.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 p-1.5 space-y-1">
                  {dayItems.map((item) => (
                    <CalendarCard key={item.id} item={item} projectName={projectName(item.project_id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Month View ── */
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-[10px] font-bold uppercase py-1" style={{ color: "#6b6b80" }}>
                {day.slice(0, 3)}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date, i) => {
              const dateStr = date.toISOString().split("T")[0];
              const isToday = todayStr === dateStr;
              const isCurrentMonth = date.getMonth() === monthDate.getMonth();
              const dayItems = filtered.filter((item) => item.date === dateStr);

              return (
                <div key={i} className="rounded-lg min-h-[90px] flex flex-col"
                  style={{
                    background: isToday ? "rgba(0,212,212,0.06)" : isCurrentMonth ? "#111118" : "#0c0c12",
                    border: isToday ? "2px solid rgba(0,212,212,0.5)" : "1px solid #1e1e2e",
                    opacity: isCurrentMonth ? 1 : 0.35,
                  }}>
                  {/* Date number */}
                  <div className="px-1.5 py-1 flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold"
                      style={{
                        color: isToday ? "#0a0a0f" : "#6b6b80",
                        background: isToday ? "#00d4d4" : "transparent",
                        borderRadius: isToday ? "9999px" : "0",
                        padding: isToday ? "1px 6px" : "0",
                      }}
                    >
                      {date.getDate()}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.12)", color: "#00d4d4" }}>
                        {dayItems.length}
                      </span>
                    )}
                  </div>
                  {/* Content — compact in month view */}
                  <div className="flex-1 px-1 pb-1 space-y-0.5 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => {
                      const pc = PROJECT_COLOR[item.project_id] || DEFAULT_COLOR;
                      const tc = item.type === "published" ? "#22c55e" : item.type === "scheduled" ? "#3b82f6" : "#ef4444";
                      return (
                        <div key={item.id} className="flex items-center gap-1 truncate">
                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: tc }} />
                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: pc.dot }} />
                          <span className="text-[8px] truncate" style={{ color: "#a0a0b0" }}>{item.title}</span>
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <span className="text-[7px]" style={{ color: "#4a4a5e" }}>+{dayItems.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 rounded-lg" style={{ background: "#111118", border: "1px dashed #1e1e2e" }}>
          <p className="text-sm" style={{ color: "#6b6b80" }}>No content in the pipeline yet.</p>
        </div>
      )}
    </div>
  );
}

function CalendarCard({ item, projectName }: { item: CalendarItem; projectName: string }) {
  const pc = PROJECT_COLOR[item.project_id] || DEFAULT_COLOR;
  const formatIcon = FORMAT_ICON[item.format] || "\uD83D\uDCDD";

  const typeConfig = {
    published: { indicator: "\u2705", borderColor: "rgba(34,197,94,0.3)", bg: "rgba(34,197,94,0.04)" },
    scheduled: { indicator: "\uD83D\uDD35", borderColor: "rgba(59,130,246,0.3)", bg: "rgba(59,130,246,0.04)" },
    missed: { indicator: "\u274C", borderColor: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.04)" },
  };
  const tc = typeConfig[item.type];

  return (
    <div className="rounded-md px-2 py-1.5 transition-all hover:brightness-110"
      style={{ background: tc.bg, border: `1px solid ${tc.borderColor}` }}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[8px]">{tc.indicator}</span>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pc.dot }} />
        <span className="text-[8px] font-bold uppercase tracking-wider truncate" style={{ color: pc.text }}>{projectName}</span>
        <span className="ml-auto text-[10px]" title={item.format}>{formatIcon}</span>
      </div>
      <p className="text-[10px] font-medium leading-snug line-clamp-2" style={{ color: "#e0e0ee" }}>{item.title}</p>
    </div>
  );
}
