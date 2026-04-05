"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string; stage?: string }
interface LibraryItem {
  id: string; project_id: string; title: string; format: string; platforms: string[]; pillar: string;
  posted_date: string; images: string[]; caption: string;
  metrics: { reach: number; likes: number; comments: number; saves: number; shares: number; engagement_rate: number };
  performance_tag: string; notes: string;
}
interface QueueItem {
  id: string; project_id: string; title: string; format: string; platforms: string[];
  scheduled_date: string; status: string; pillar: string;
}

const FORMAT_ICON: Record<string, string> = { reel: "\uD83C\uDFAC", carousel: "\uD83D\uDCF8", story: "\uD83D\uDCF1", post: "\uD83D\uDCDD", ad: "\uD83D\uDCE3", thread: "\uD83D\uDC26", listing: "\uD83D\uDCCB" };
const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };
const PLATFORM_ICON: Record<string, string> = { instagram: "IG", tiktok: "TT", youtube: "YT", x: "X" };

export default function LibraryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("all");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pData, lData, qData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-library", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const allLib: LibraryItem[] = lData?.items || [];
    const allQueue: QueueItem[] = qData?.items || [];
    const projectIds = new Set([...allLib.map((l) => l.project_id), ...allQueue.map((q) => q.project_id)]);
    const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
    const projs: Project[] = (pData?.projects || []).filter((p: Project) =>
      CONTENT_STAGES.has(p.stage || "") || projectIds.has(p.id)
    );
    setProjects(projs);
    setLibrary(allLib);
    setQueue(allQueue);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  // Filter + search
  const applyFilters = <T extends { project_id: string; title: string; format: string }>(items: T[]) => {
    let result = items;
    if (selectedProject !== "all") result = result.filter((i) => i.project_id === selectedProject);
    if (formatFilter !== "all") result = result.filter((i) => i.format === formatFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }
    return result;
  };

  // Scheduled = queue items with future dates
  const today = new Date().toISOString().split("T")[0];
  const scheduled = useMemo(() => {
    const items = applyFilters(queue).filter((q) => q.scheduled_date >= today || q.scheduled_date === "TBD");
    return items.sort((a, b) => {
      if (a.scheduled_date === "TBD") return 1;
      if (b.scheduled_date === "TBD") return -1;
      return a.scheduled_date.localeCompare(b.scheduled_date);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, selectedProject, formatFilter, search]);

  // Published = library items, sorted newest first
  const published = useMemo(() => {
    const items = applyFilters(library);
    return items.sort((a, b) => b.posted_date.localeCompare(a.posted_date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, selectedProject, formatFilter, search]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#0a0a0f] border rounded-lg px-3 py-2 cursor-pointer focus:outline-none [&>option]:bg-[#0a0a0f] [&>option]:text-white"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          <option value="all">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
          className="text-xs bg-transparent border rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-[120px]"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }} />
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}
          className="text-[11px] bg-[#0a0a0f] border rounded px-2 py-1.5 cursor-pointer focus:outline-none [&>option]:bg-[#0a0a0f] [&>option]:text-white"
          style={{ borderColor: "#1e1e2e", color: "#6b6b80" }}>
          <option value="all">All formats</option>
          <option value="reel">Reels</option>
          <option value="carousel">Carousels</option>
          <option value="story">Stories</option>
          <option value="post">Posts</option>
        </select>
      </div>

      {/* Scheduled Section */}
      {scheduled.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3b82f6" }}>Scheduled</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>{scheduled.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scheduled.map((item) => (
              <div key={item.id} className="rounded-xl overflow-hidden transition-all hover:scale-[1.01]"
                style={{ background: "#111118", border: "1px solid rgba(59,130,246,0.2)" }}>
                <div className="relative aspect-video flex items-center justify-center" style={{ background: "#0d0d14" }}>
                  <span className="text-3xl">{FORMAT_ICON[item.format] || "\uD83D\uDCDD"}</span>
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium line-clamp-2 mb-1" style={{ color: "#e0e0ee" }}>{item.title}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono" style={{ color: "#3b82f6" }}>
                      {item.scheduled_date === "TBD" ? "TBD" : new Date(item.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    {item.platforms?.map((p) => <span key={p} className="font-bold" style={{ color: "#4a4a5e" }}>{PLATFORM_ICON[p] || p}</span>)}
                    <span className="font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[item.format] || "#6b7280"}18`, color: FORMAT_COLOR[item.format] || "#6b7280", fontSize: "9px" }}>{item.format}</span>
                  </div>
                  {selectedProject === "all" && (
                    <p className="text-[10px] mt-1 truncate" style={{ color: "#4a4a5e" }}>{projectName(item.project_id)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Published Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22c55e" }}>Published</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>{published.length}</span>
        </div>
        {published.length === 0 ? (
          <p className="text-xs text-center py-12" style={{ color: "#3a3a4e" }}>No published content yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {published.map((item) => {
              const isOpen = expanded === item.id;
              return (
                <div key={item.id} className="rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                  style={{ background: "#111118", border: "1px solid #1e1e2e" }}
                  onClick={() => setExpanded(isOpen ? null : item.id)}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video" style={{ background: "#0d0d14" }}>
                    {item.images[0] ? (
                      <Image src={item.images[0]} alt={item.title} fill className="object-cover" sizes="25vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ color: "#2a2a3e" }}>{FORMAT_ICON[item.format] || "\uD83D\uDCDD"}</div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs font-medium line-clamp-2 mb-1" style={{ color: "#e0e0ee" }}>{item.title}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono" style={{ color: "#4a4a5e" }}>
                        {new Date(item.posted_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      {item.platforms.map((p) => <span key={p} className="font-bold" style={{ color: "#4a4a5e" }}>{PLATFORM_ICON[p] || p}</span>)}
                      <span className="font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[item.format] || "#6b7280"}18`, color: FORMAT_COLOR[item.format] || "#6b7280", fontSize: "9px" }}>{item.format}</span>
                    </div>
                    {/* Metrics row */}
                    {(item.metrics.likes > 0 || item.metrics.saves > 0 || item.metrics.shares > 0 || item.metrics.reach > 0) && (
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "#6b6b80" }}>
                        {item.metrics.likes > 0 && <span>{item.metrics.likes.toLocaleString()} likes</span>}
                        {item.metrics.saves > 0 && <span>{item.metrics.saves.toLocaleString()} saves</span>}
                        {item.metrics.shares > 0 && <span>{item.metrics.shares.toLocaleString()} shares</span>}
                        {item.metrics.reach > 0 && <span>{(item.metrics.reach / 1000).toFixed(1)}K reach</span>}
                      </div>
                    )}
                    {selectedProject === "all" && (
                      <p className="text-[10px] mt-1 truncate" style={{ color: "#4a4a5e" }}>{projectName(item.project_id)}</p>
                    )}
                    {item.pillar && (
                      <span className="inline-block text-[9px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}>{item.pillar}</span>
                    )}
                  </div>
                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: "1px solid #1e1e2e" }} onClick={(e) => e.stopPropagation()}>
                      {item.caption && <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto" style={{ color: "#94a3b8" }}>{item.caption}</pre>}
                      <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                        <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.likes}</div><div style={{ color: "#4a4a5e" }}>Likes</div></div>
                        <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.comments}</div><div style={{ color: "#4a4a5e" }}>Comments</div></div>
                        <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.saves}</div><div style={{ color: "#4a4a5e" }}>Saves</div></div>
                        <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.shares}</div><div style={{ color: "#4a4a5e" }}>Shares</div></div>
                      </div>
                      {item.notes && <p className="text-[10px] italic" style={{ color: "#4a4a5e" }}>{item.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
