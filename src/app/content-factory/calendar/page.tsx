"use client";

import { useState, useEffect, useCallback } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string; stage?: string }
interface Strategy { project_id: string; schedule: { batch_day: string; days: string[]; times: string[]; format_rotation: Record<string, string> }; production: { step: string; owner: string; time: string }[] }
interface QueueItem { id: string; project_id: string; title: string; format: string; platforms: string[]; scheduled_date: string; status: string; pipeline_step: string }

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const OWNER_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", "claude-code": "\u{1F4BB}", ginge: "\u{1F464}", auto: "\u26A1" };
const STEP_ICON: Record<string, string> = { research: "\u{1F52C}", review: "\u{1F4CB}", create: "\u{1F3A8}", post: "\u{1F4F1}", publish: "\u{1F4F1}" };
const STATUS_COLOR: Record<string, string> = { scheduled: "#6b6b80", "in-progress": "#00d4d4", done: "#22c55e", missed: "#ef4444", draft: "#6b6b80", approved: "#22c55e", ready_to_post: "#00d4d4" };
const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };
const PLATFORM_ICON: Record<string, string> = { instagram: "IG", tiktok: "TT", youtube: "YT", x: "X" };

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
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sData, pData, qData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
    const strats: Strategy[] = sData?.items || [];
    const projs: Project[] = (pData?.projects || []).filter((p: Project) =>
      CONTENT_STAGES.has(p.stage || "") || strats.some((s) => s.project_id === p.id)
    );
    setStrategies(strats);
    setProjects(projs);
    setQueue(qData?.items || []);
    if (!selected && projs.length > 0) setSelected(projs[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const strategy = strategies.find((s) => s.project_id === selected);
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const projectQueue = queue.filter((q) => q.project_id === selected);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;
  if (projects.length === 0) return <p className="text-xs text-center py-20" style={{ color: "#3a3a4e" }}>No projects with strategies.</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="text-sm bg-transparent border rounded-lg px-3 py-2 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: "#6b6b80", border: "1px solid #1e1e2e" }}>← Prev</button>
          <button onClick={() => setWeekOffset(0)} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: weekOffset === 0 ? "#00d4d4" : "#6b6b80", border: "1px solid #1e1e2e" }}>This Week</button>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: "#6b6b80", border: "1px solid #1e1e2e" }}>Next →</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 overflow-x-auto">
        {DAYS.map((day, i) => {
          const date = weekDates[i];
          const dateStr = date.toISOString().split("T")[0];
          const isBatch = strategy?.schedule.batch_day === day;
          const isSunday = day === "sunday";
          const isScheduled = strategy?.schedule.days.includes(day);
          const dayQueue = projectQueue.filter((q) => q.scheduled_date === dateStr);

          return (
            <div key={day} className="rounded-lg p-2 min-w-[130px]" style={{ background: isBatch ? "rgba(0,212,212,0.04)" : "#111118", border: `1px solid ${isBatch ? "rgba(0,212,212,0.2)" : "#1e1e2e"}` }}>
              <div className="mb-2">
                <div className="text-[10px] font-bold uppercase" style={{ color: isBatch ? "#00d4d4" : "#6b6b80" }}>
                  {day.slice(0, 3)} {formatDateShort(date)}
                </div>
                {isBatch && <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.12)", color: "#00d4d4" }}>Batch Day</span>}
                {isSunday && <span className="text-[8px] uppercase" style={{ color: "#3a3a4e" }}>OFF</span>}
              </div>

              {isBatch && strategy?.production.map((step, j) => (
                <div key={j} className="flex items-center gap-1.5 py-1 text-[10px]" style={{ borderBottom: "1px solid rgba(30,30,46,0.3)" }}>
                  <span>{STEP_ICON[step.step.toLowerCase().split(" ")[0]] || "\u2699\uFE0F"}</span>
                  <span className="font-mono" style={{ color: "#4a4a5e" }}>{step.time}</span>
                  <span className="truncate" style={{ color: "#94a3b8" }}>{step.step}</span>
                </div>
              ))}

              {!isBatch && isScheduled && dayQueue.length === 0 && (
                <div className="text-[10px] py-2 text-center" style={{ color: "#3a3a4e" }}>
                  {strategy?.schedule.format_rotation[day] && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[strategy.schedule.format_rotation[day]] || "#6b7280"}18`, color: FORMAT_COLOR[strategy.schedule.format_rotation[day]] || "#6b7280" }}>
                      {strategy.schedule.format_rotation[day]}
                    </span>
                  )}
                  <div className="mt-1" style={{ color: "#3a3a4e" }}>No content queued</div>
                </div>
              )}

              {dayQueue.map((q) => (
                <div key={q.id} className="py-1.5 text-[10px]" style={{ borderBottom: "1px solid rgba(30,30,46,0.3)" }}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span>{"\uD83D\uDCF1"}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[q.format] || "#6b7280"}18`, color: FORMAT_COLOR[q.format] || "#6b7280" }}>{q.format}</span>
                    {q.platforms.map((p) => <span key={p} className="text-[8px] font-bold" style={{ color: "#4a4a5e" }}>{PLATFORM_ICON[p] || p}</span>)}
                  </div>
                  <div className="truncate" style={{ color: "#e0e0ee" }}>{q.title}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[q.status] || "#6b6b80" }} />
                    <span className="text-[9px]" style={{ color: STATUS_COLOR[q.status] || "#6b6b80" }}>{q.pipeline_step.replace(/_/g, " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
