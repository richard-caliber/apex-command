"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string; stage?: string }
interface LibraryItem {
  id: string; project_id: string; title: string; format: string; posted_date: string; pillar: string;
  metrics: { reach: number; likes: number; comments: number; saves: number; shares: number; engagement_rate: number };
  performance_tag: string;
}
interface QueueItem {
  id: string; project_id: string; title: string; format: string;
  scheduled_date: string; status: string;
}

const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };

export default function PerformancePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pData, lData, qData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-library", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
    const allLib: LibraryItem[] = lData?.items || [];
    const allQueue: QueueItem[] = qData?.items || [];
    const projectIds = new Set([...allLib.map((l) => l.project_id), ...allQueue.map((q) => q.project_id)]);
    const projs: Project[] = (pData?.projects || []).filter((p: Project) =>
      CONTENT_STAGES.has(p.stage || "") || projectIds.has(p.id)
    );
    setProjects(projs);
    setLibrary(allLib);
    setQueue(allQueue);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().split("T")[0];

  // Filter by project
  const filteredLib = useMemo(() => selectedProject === "all" ? library : library.filter((l) => l.project_id === selectedProject), [library, selectedProject]);
  const filteredQueue = useMemo(() => selectedProject === "all" ? queue : queue.filter((q) => q.project_id === selectedProject), [queue, selectedProject]);

  // Core delivery metrics
  const delivery = useMemo(() => {
    const published = filteredLib.length;
    const pastScheduled = filteredQueue.filter((q) => q.scheduled_date !== "TBD" && q.scheduled_date <= today);
    // Check which past scheduled items actually got published (match by id in library)
    const publishedIds = new Set(filteredLib.map((l) => l.id));
    const missed = pastScheduled.filter((q) => !publishedIds.has(q.id)).length;
    const totalDue = published + missed;
    const completionRate = totalDue > 0 ? Math.round((published / totalDue) * 100) : 0;
    const upcomingScheduled = filteredQueue.filter((q) => q.scheduled_date !== "TBD" && q.scheduled_date > today).length;
    return { published, missed, totalDue, completionRate, upcomingScheduled };
  }, [filteredLib, filteredQueue, today]);

  // Engagement aggregates
  const engagement = useMemo(() => {
    if (filteredLib.length === 0) return null;
    const totals = filteredLib.reduce((acc, l) => ({
      likes: acc.likes + l.metrics.likes,
      saves: acc.saves + l.metrics.saves,
      shares: acc.shares + l.metrics.shares,
      reach: acc.reach + l.metrics.reach,
      comments: acc.comments + l.metrics.comments,
      engRate: acc.engRate + l.metrics.engagement_rate,
    }), { likes: 0, saves: 0, shares: 0, reach: 0, comments: 0, engRate: 0 });
    return {
      ...totals,
      avgEngRate: (totals.engRate / filteredLib.length).toFixed(1),
    };
  }, [filteredLib]);

  // Per-project breakdown
  const projectBreakdown = useMemo(() => {
    if (selectedProject !== "all") return [];
    const map = new Map<string, { published: number; missed: number; totalDue: number; reach: number; likes: number }>();
    const publishedIds = new Set(library.map((l) => l.id));

    for (const lib of library) {
      const entry = map.get(lib.project_id) || { published: 0, missed: 0, totalDue: 0, reach: 0, likes: 0 };
      entry.published++;
      entry.totalDue++;
      entry.reach += lib.metrics.reach;
      entry.likes += lib.metrics.likes;
      map.set(lib.project_id, entry);
    }
    for (const q of queue) {
      if (q.scheduled_date === "TBD" || q.scheduled_date > today) continue;
      if (publishedIds.has(q.id)) continue;
      const entry = map.get(q.project_id) || { published: 0, missed: 0, totalDue: 0, reach: 0, likes: 0 };
      entry.missed++;
      entry.totalDue++;
      map.set(q.project_id, entry);
    }

    return Array.from(map.entries()).map(([pid, data]) => ({
      projectId: pid,
      projectName: projects.find((p) => p.id === pid)?.name || pid,
      ...data,
      completionRate: data.totalDue > 0 ? Math.round((data.published / data.totalDue) * 100) : 0,
    })).sort((a, b) => b.published - a.published);
  }, [library, queue, projects, selectedProject, today]);

  // Format breakdown
  const formatBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; reach: number; likes: number; avgEng: number }>();
    for (const lib of filteredLib) {
      const entry = map.get(lib.format) || { count: 0, reach: 0, likes: 0, avgEng: 0 };
      entry.count++;
      entry.reach += lib.metrics.reach;
      entry.likes += lib.metrics.likes;
      entry.avgEng += lib.metrics.engagement_rate;
      map.set(lib.format, entry);
    }
    return Array.from(map.entries()).map(([format, data]) => ({
      format,
      ...data,
      avgEng: data.count > 0 ? (data.avgEng / data.count).toFixed(1) : "0",
    })).sort((a, b) => b.count - a.count);
  }, [filteredLib]);

  // Top performing posts
  const topPosts = useMemo(() => {
    return [...filteredLib]
      .filter((l) => l.metrics.engagement_rate > 0 || l.metrics.reach > 0)
      .sort((a, b) => b.metrics.engagement_rate - a.metrics.engagement_rate)
      .slice(0, 5);
  }, [filteredLib]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  const hasData = library.length > 0 || queue.length > 0;

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#0a0a0f] border rounded-lg px-3 py-2 cursor-pointer focus:outline-none [&>option]:bg-[#0a0a0f] [&>option]:text-white"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!hasData ? (
        <p className="text-xs text-center py-16" style={{ color: "#3a3a4e" }}>No content data yet. Schedule and publish content to start tracking.</p>
      ) : (
        <>
          {/* Delivery — the primary metric */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4d4" }}>Content Delivery</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard label="Published" value={delivery.published} color="#22c55e" />
              <StatCard label="Missed" value={delivery.missed} color="#ef4444" />
              <StatCard label="Total Due" value={delivery.totalDue} color="#f1f5f9" />
              <StatCard label="Completion Rate" value={`${delivery.completionRate}%`}
                color={delivery.completionRate >= 80 ? "#22c55e" : delivery.completionRate >= 50 ? "#f59e0b" : "#ef4444"} large />
              <StatCard label="Upcoming" value={delivery.upcomingScheduled} color="#3b82f6" />
            </div>
            {/* Completion bar */}
            {delivery.totalDue > 0 && (
              <div className="mt-3 rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "#4a4a5e" }}>Delivery Rate</span>
                  <span className="text-sm font-bold ml-auto" style={{ color: delivery.completionRate >= 80 ? "#22c55e" : "#f59e0b" }}>{delivery.completionRate}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "#1e1e2e" }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${delivery.completionRate}%`,
                    background: delivery.completionRate >= 80 ? "#22c55e" : delivery.completionRate >= 50 ? "#f59e0b" : "#ef4444",
                  }} />
                </div>
              </div>
            )}
          </section>

          {/* Engagement totals */}
          {engagement && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4d4" }}>Engagement</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Total Reach" value={engagement.reach > 1000 ? `${(engagement.reach / 1000).toFixed(1)}K` : engagement.reach} color="#00d4d4" />
                <StatCard label="Likes" value={engagement.likes.toLocaleString()} color="#f472b6" />
                <StatCard label="Saves" value={engagement.saves.toLocaleString()} color="#f59e0b" />
                <StatCard label="Shares" value={engagement.shares.toLocaleString()} color="#a78bfa" />
                <StatCard label="Avg Eng Rate" value={`${engagement.avgEngRate}%`} color="#22c55e" />
              </div>
            </section>
          )}

          {/* Per-project breakdown */}
          {projectBreakdown.length > 1 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4d4" }}>By Project</h2>
              <div className="rounded-lg overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                      {["Project", "Published", "Missed", "Rate", "Reach", "Likes"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-bold uppercase tracking-wider" style={{ color: "#4a4a5e" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectBreakdown.map((row) => (
                      <tr key={row.projectId} style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                        <td className="px-3 py-2 font-medium" style={{ color: "#e0e0ee" }}>{row.projectName}</td>
                        <td className="px-3 py-2" style={{ color: "#22c55e" }}>{row.published}</td>
                        <td className="px-3 py-2" style={{ color: row.missed > 0 ? "#ef4444" : "#4a4a5e" }}>{row.missed}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: row.completionRate >= 80 ? "#22c55e" : "#f59e0b" }}>{row.completionRate}%</td>
                        <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{row.reach > 1000 ? `${(row.reach / 1000).toFixed(1)}K` : row.reach}</td>
                        <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{row.likes.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Format breakdown */}
          {formatBreakdown.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4d4" }}>By Format</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {formatBreakdown.map((fb) => (
                  <div key={fb.format} className="rounded-lg p-3" style={{ background: "#111118", border: `1px solid ${FORMAT_COLOR[fb.format] || "#1e1e2e"}30` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: FORMAT_COLOR[fb.format] || "#6b7280" }} />
                      <span className="text-xs font-bold capitalize" style={{ color: "#e0e0ee" }}>{fb.format}</span>
                      <span className="ml-auto text-sm font-bold" style={{ color: FORMAT_COLOR[fb.format] || "#6b7280" }}>{fb.count}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: "#6b6b80" }}>
                      <span>{fb.reach > 1000 ? `${(fb.reach / 1000).toFixed(1)}K reach` : `${fb.reach} reach`}</span>
                      <span>{fb.avgEng}% eng</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top posts */}
          {topPosts.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#00d4d4" }}>Top Performing Posts</h2>
              <div className="space-y-2">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                    <span className="text-sm font-bold" style={{ color: "#4a4a5e" }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "#e0e0ee" }}>{post.title}</p>
                      <div className="flex items-center gap-3 text-[10px] mt-0.5" style={{ color: "#6b6b80" }}>
                        <span className="capitalize">{post.format}</span>
                        <span>{new Date(post.posted_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] flex-shrink-0">
                      {post.metrics.reach > 0 && <span style={{ color: "#00d4d4" }}>{(post.metrics.reach / 1000).toFixed(1)}K reach</span>}
                      {post.metrics.likes > 0 && <span style={{ color: "#f472b6" }}>{post.metrics.likes} likes</span>}
                      {post.metrics.engagement_rate > 0 && <span className="font-bold" style={{ color: "#22c55e" }}>{post.metrics.engagement_rate}% eng</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, large }: { label: string; value: string | number; color: string; large?: boolean }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <div className={large ? "text-xl font-bold" : "text-lg font-bold"} style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "#4a4a5e" }}>{label}</div>
    </div>
  );
}
