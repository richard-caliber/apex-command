"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string; stage?: string }
interface QueueItem {
  id: string; project_id: string; title: string; format: string;
  platforms: string[]; scheduled_date: string; status: string;
  pipeline_step: string; pillar: string; backburner: boolean;
  trigger_word?: string;
}

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);

const COLUMNS = [
  { id: "approved", label: "Approved Queue", statuses: ["approved", "not_started", "style_test", "review", "review_research", "review_assets", "production", "create"], color: "#f59e0b" },
  { id: "scheduled", label: "Scheduled", statuses: ["scheduled", "ready_to_post"], color: "#22c55e" },
  { id: "published", label: "Published", statuses: ["done", "published"], color: "#3b82f6" },
];

const PROJECT_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  caliber: { bg: "rgba(0,212,212,0.06)", border: "rgba(0,212,212,0.25)", text: "#00d4d4", dot: "#00d4d4" },
  gemsnap: { bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.25)", text: "#a78bfa", dot: "#a78bfa" },
  repostai: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.25)", text: "#3b82f6", dot: "#3b82f6" },
  "edge-auto": { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.25)", text: "#22c55e", dot: "#22c55e" },
};
const DEFAULT_PC = { bg: "rgba(107,107,128,0.06)", border: "rgba(107,107,128,0.2)", text: "#6b6b80", dot: "#6b6b80" };

const FORMAT_ICON: Record<string, string> = {
  carousel: "\uD83D\uDCF8", reel: "\uD83C\uDFAC", ad: "\uD83D\uDCE3",
  thread: "\uD83D\uDC26", listing: "\uD83D\uDCCB", story: "\uD83D\uDCF1", post: "\uD83D\uDCDD",
};

function calcScheduledDaysRemaining(items: QueueItem[]): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const scheduledItems = items.filter((q) => {
    if (!["scheduled", "ready_to_post"].includes(q.status)) return false;
    if (!q.scheduled_date || q.scheduled_date === "TBD") return false;
    return new Date(q.scheduled_date) >= now;
  });
  if (scheduledItems.length === 0) return 0;
  const dates = scheduledItems.map((q) => new Date(q.scheduled_date).getTime());
  const lastDate = new Date(Math.max(...dates));
  lastDate.setHours(0, 0, 0, 0);
  const diffMs = lastDate.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / 86400000) + 1);
}

export default function QueuePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pData, qData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const projs: Project[] = (pData?.projects || []).filter((p: Project) => CONTENT_STAGES.has(p.stage || ""));
    setProjects(projs);
    setQueue(qData?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (selectedProject === "all") return queue;
    return queue.filter((q) => q.project_id === selectedProject);
  }, [queue, selectedProject]);

  const daysRemaining = useMemo(() => calcScheduledDaysRemaining(filtered), [filtered]);

  const columnItems = useMemo(() => {
    const map: Record<string, QueueItem[]> = {};
    for (const col of COLUMNS) map[col.id] = [];

    for (const item of filtered) {
      const status = item.status || item.pipeline_step || "not_started";
      let placed = false;
      for (const col of COLUMNS) {
        if (col.statuses.includes(status)) {
          map[col.id].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) map["approved"].push(item);
    }
    return map;
  }, [filtered]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Days Remaining Banner */}
      <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{
        background: daysRemaining > 7
          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))"
          : daysRemaining > 3
          ? "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))"
          : "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))",
        border: `1px solid ${daysRemaining > 7 ? "rgba(34,197,94,0.25)" : daysRemaining > 3 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}>
        <span className="text-3xl font-black tabular-nums" style={{
          color: daysRemaining > 7 ? "#22c55e" : daysRemaining > 3 ? "#f59e0b" : "#ef4444",
        }}>
          {daysRemaining}
        </span>
        <div>
          <span className="text-sm font-semibold block" style={{ color: "#e0e0ee" }}>
            days of scheduled content remaining
          </span>
          <span className="text-[10px]" style={{ color: "#6b6b80" }}>
            {daysRemaining === 0 ? "No future content scheduled" : `Through ${new Date(Date.now() + (daysRemaining - 1) * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white">Production Board</h2>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#0a0a0f] border rounded-lg px-3 py-2 cursor-pointer focus:outline-none [&>option]:bg-[#0a0a0f] [&>option]:text-white"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-[10px] font-mono ml-auto" style={{ color: "#4a4a5e" }}>{filtered.length} items</span>
      </div>

      {/* Kanban Board — 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const items = columnItems[col.id] || [];
          return (
            <div key={col.id} className="rounded-lg min-h-[300px] flex flex-col"
              style={{ background: "#0d0d14", border: "1px solid #1e1e2e" }}>
              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: `2px solid ${col.color}30` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${col.color}18`, color: col.color }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 600 }}>
                {items.map((item) => {
                  const pc = PROJECT_COLOR[item.project_id] || DEFAULT_PC;
                  const isExpanded = expandedCard === item.id;
                  return (
                    <div key={item.id}
                      className="rounded-lg px-2.5 py-2 cursor-pointer transition-all hover:brightness-110"
                      style={{ background: pc.bg, border: `1px solid ${pc.border}` }}
                      onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
                      {/* Project badge + format icon */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: pc.dot }} />
                        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: pc.text }}>
                          {projects.find((p) => p.id === item.project_id)?.name || item.project_id}
                        </span>
                        <span className="ml-auto text-xs" title={item.format}>
                          {FORMAT_ICON[item.format] || "\uD83D\uDCDD"}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="text-[11px] font-medium leading-snug mb-1.5" style={{ color: "#e0e0ee" }}>
                        {item.title}
                      </p>

                      {/* Date + trigger word */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.scheduled_date && item.scheduled_date !== "TBD" && (
                          <span className="text-[9px] font-mono" style={{ color: "#4a4a5e" }}>
                            {new Date(item.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {item.trigger_word && (
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
                            {item.trigger_word}
                          </span>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${pc.border}` }}>
                          <div className="text-[9px] mb-1" style={{ color: "#6b6b80" }}>
                            {FORMAT_ICON[item.format] || "\uD83D\uDCDD"} {item.format}
                          </div>
                          {item.pillar && <div className="text-[9px] mb-1" style={{ color: "#6b6b80" }}>Pillar: {item.pillar}</div>}
                          {item.platforms?.length > 0 && <div className="text-[9px] mb-1" style={{ color: "#6b6b80" }}>Platforms: {item.platforms.join(", ")}</div>}
                          <div className="text-[9px]" style={{ color: "#4a4a5e" }}>Status: {item.status}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="flex items-center justify-center h-20">
                    <span className="text-[10px]" style={{ color: "#2a2a3e" }}>Empty</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
