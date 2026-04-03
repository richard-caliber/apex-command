"use client";

import { useState, useEffect, useCallback } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string }
interface Strategy { project_id: string }
interface LibraryItem {
  id: string; project_id: string; title: string; format: string; pillar: string;
  metrics: { reach: number; likes: number; comments: number; saves: number; shares: number; engagement_rate: number };
  performance_tag: string; notes: string;
}
interface PerfData {
  id: string; project_id: string;
  total_posts: number; avg_engagement_rate: number; total_reach: number; follower_growth: number;
  top_posts: { id: string; title: string; why: string }[];
  bottom_posts: { id: string; title: string; why: string }[];
  patterns: { working: string[]; not_working: string[] };
  by_pillar: Record<string, number>;
  by_format: Record<string, number>;
  best_day: string; best_time: string;
  remix_queue: { original_id: string; approach: string; status: string }[];
}

export default function PerformancePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState("");
  const [perf, setPerf] = useState<PerfData | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sData, pData, perfData, libData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/content-performance", { action: "list" }),
      api("/api/content-library", { action: "list" }),
    ]);
    const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
    const strats: Strategy[] = sData?.items || [];
    const projs: Project[] = (pData?.projects || []).filter((p: Project & { stage?: string }) =>
      CONTENT_STAGES.has(p.stage || "") || strats.some((s) => s.project_id === p.id)
    );
    setProjects(projs);
    setLibrary(libData?.items || []);
    const perfItems: PerfData[] = perfData?.items || [];
    if (!selected && projs.length > 0) {
      setSelected(projs[0].id);
      setPerf(perfItems.find((p) => p.project_id === projs[0].id) || null);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const selectProject = async (id: string) => {
    setSelected(id);
    const perfData = await api("/api/content-performance", { action: "list", project_id: id });
    setPerf((perfData?.items || [])[0] || null);
  };

  // Derive stats from library if no perf data
  const projLibrary = library.filter((l) => l.project_id === selected);
  const derivedStats = {
    total_posts: projLibrary.length,
    avg_engagement: projLibrary.length > 0
      ? (projLibrary.reduce((s, l) => s + l.metrics.engagement_rate, 0) / projLibrary.length).toFixed(1)
      : "0",
    total_reach: projLibrary.reduce((s, l) => s + l.metrics.reach, 0),
  };

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;
  if (projects.length === 0) return <p className="text-xs text-center py-20" style={{ color: "#3a3a4e" }}>No projects with strategies.</p>;

  return (
    <div>
      <div className="mb-5">
        <select value={selected} onChange={(e) => selectProject(e.target.value)}
          className="text-sm bg-transparent border rounded-lg px-3 py-2 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Posts", value: perf?.total_posts ?? derivedStats.total_posts },
          { label: "Avg Engagement", value: perf ? `${perf.avg_engagement_rate}%` : `${derivedStats.avg_engagement}%` },
          { label: "Total Reach", value: perf ? perf.total_reach.toLocaleString() : derivedStats.total_reach.toLocaleString() },
          { label: "Follower Growth", value: perf ? `+${perf.follower_growth}` : "—" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg p-3 text-center" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <div className="text-lg font-bold" style={{ color: "#00d4d4" }}>{stat.value}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "#4a4a5e" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Winners & Flops */}
      {perf && (perf.top_posts.length > 0 || perf.bottom_posts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#22c55e" }}>{"\u{1F3C6}"} Winners</h3>
            {perf.top_posts.map((p, i) => (
              <div key={i} className="py-1.5 text-[11px]" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                <span style={{ color: "#e0e0ee" }}>{p.title}</span>
                {p.why && <span className="ml-2 italic" style={{ color: "#4a4a5e" }}>— {p.why}</span>}
              </div>
            ))}
          </div>
          <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#ef4444" }}>{"\u{1F480}"} Flops</h3>
            {perf.bottom_posts.map((p, i) => (
              <div key={i} className="py-1.5 text-[11px]" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                <span style={{ color: "#e0e0ee" }}>{p.title}</span>
                {p.why && <span className="ml-2 italic" style={{ color: "#4a4a5e" }}>— {p.why}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {perf?.patterns && (perf.patterns.working.length > 0 || perf.patterns.not_working.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#22c55e" }}>What&apos;s Working</h3>
            {perf.patterns.working.map((w, i) => <div key={i} className="text-[11px] py-0.5" style={{ color: "#94a3b8" }}>• {w}</div>)}
          </div>
          <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#ef4444" }}>What&apos;s Not</h3>
            {perf.patterns.not_working.map((w, i) => <div key={i} className="text-[11px] py-0.5" style={{ color: "#94a3b8" }}>• {w}</div>)}
          </div>
        </div>
      )}

      {/* By Pillar & Format */}
      {perf && (Object.keys(perf.by_pillar).length > 0 || Object.keys(perf.by_format).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {Object.keys(perf.by_pillar).length > 0 && (
            <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>Engagement by Pillar</h3>
              {Object.entries(perf.by_pillar).sort(([, a], [, b]) => b - a).map(([pillar, val]) => (
                <div key={pillar} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] w-24 truncate" style={{ color: "#94a3b8" }}>{pillar}</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#1e1e2e" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(val * 10, 100)}%`, background: "#00d4d4" }} />
                  </div>
                  <span className="text-[10px] font-mono w-10 text-right" style={{ color: "#6b6b80" }}>{val}%</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(perf.by_format).length > 0 && (
            <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>Format Performance</h3>
              {Object.entries(perf.by_format).sort(([, a], [, b]) => b - a).map(([format, val]) => (
                <div key={format} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] w-24 capitalize" style={{ color: "#94a3b8" }}>{format}</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#1e1e2e" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(val * 10, 100)}%`, background: FORMAT_COLOR[format] || "#6b7280" }} />
                  </div>
                  <span className="text-[10px] font-mono w-10 text-right" style={{ color: "#6b6b80" }}>{val}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Best day/time */}
      {perf?.best_day && (
        <div className="flex gap-3 mb-6">
          <div className="rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: "#4a4a5e" }}>Best Day</span>
            <div className="text-sm font-bold capitalize" style={{ color: "#00d4d4" }}>{perf.best_day}</div>
          </div>
          {perf.best_time && (
            <div className="rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
              <span className="text-[9px] uppercase tracking-wider" style={{ color: "#4a4a5e" }}>Best Time</span>
              <div className="text-sm font-bold font-mono" style={{ color: "#00d4d4" }}>{perf.best_time}</div>
            </div>
          )}
        </div>
      )}

      {/* Remix Queue */}
      {perf?.remix_queue && perf.remix_queue.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#f59e0b" }}>Iteration Queue</h3>
          {perf.remix_queue.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-[11px]" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
              <span style={{ color: "#e0e0ee" }}>{r.original_id}</span>
              <span style={{ color: "#94a3b8" }}>{r.approach}</span>
              <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                background: r.status === "done" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                color: r.status === "done" ? "#22c55e" : "#f59e0b",
              }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!perf && projLibrary.length === 0 && (
        <p className="text-xs text-center py-8" style={{ color: "#3a3a4e" }}>No performance data yet. Publish content to start tracking.</p>
      )}
    </div>
  );
}

const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };
