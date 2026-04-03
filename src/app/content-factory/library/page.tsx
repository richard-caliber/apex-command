"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string }
interface Strategy { project_id: string }
interface LibraryItem {
  id: string; project_id: string; title: string; format: string; platforms: string[]; pillar: string;
  posted_date: string; images: string[]; caption: string;
  metrics: { reach: number; likes: number; comments: number; saves: number; shares: number; engagement_rate: number };
  performance_tag: string; notes: string;
}

const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };
const PLATFORM_ICON: Record<string, string> = { instagram: "IG", tiktok: "TT", youtube: "YT", x: "X" };
const PERF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  winner: { icon: "\u{1F3C6}", color: "#22c55e", label: "Winner" },
  flop: { icon: "\u{1F480}", color: "#ef4444", label: "Flop" },
  average: { icon: "\u27A1\uFE0F", color: "#6b6b80", label: "Average" },
};

export default function LibraryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "performance" | "format">("date");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sData, pData, lData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/content-library", { action: "list" }),
    ]);
    const strats: Strategy[] = sData?.items || [];
    const projs: Project[] = (pData?.projects || []).filter((p: Project) => strats.some((s) => s.project_id === p.id));
    setProjects(projs);
    setLibrary(lData?.items || []);
    if (!selected && projs.length > 0) setSelected(projs[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  let items = library.filter((l) => l.project_id === selected);
  if (formatFilter !== "all") items = items.filter((l) => l.format === formatFilter);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter((l) => l.title.toLowerCase().includes(q) || l.caption.toLowerCase().includes(q));
  }
  if (sortBy === "date") items.sort((a, b) => b.posted_date.localeCompare(a.posted_date));
  if (sortBy === "performance") items.sort((a, b) => b.metrics.engagement_rate - a.metrics.engagement_rate);
  if (sortBy === "format") items.sort((a, b) => a.format.localeCompare(b.format));

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
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
          className="text-xs bg-transparent border rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-[120px]"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }} />
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}
          className="text-[11px] bg-transparent border rounded px-2 py-1.5 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#6b6b80" }}>
          <option value="all">All formats</option>
          <option value="reel">Reels</option>
          <option value="carousel">Carousels</option>
          <option value="story">Stories</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="text-[11px] bg-transparent border rounded px-2 py-1.5 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#6b6b80" }}>
          <option value="date">Newest</option>
          <option value="performance">Best</option>
          <option value="format">Format</option>
        </select>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-center py-12" style={{ color: "#3a3a4e" }}>No published content yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const perf = PERF_CONFIG[item.performance_tag] || PERF_CONFIG.average;
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
                    <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: "#2a2a3e" }}>{FORMAT_COLOR[item.format] ? "\u{1F3AC}" : "\u{1F4F7}"}</div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${perf.color}20`, color: perf.color }}>{perf.icon} {perf.label}</span>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium truncate" style={{ color: "#e0e0ee" }}>{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono" style={{ color: "#4a4a5e" }}>{new Date(item.posted_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    {item.platforms.map((p) => <span key={p} className="font-bold" style={{ color: "#4a4a5e" }}>{PLATFORM_ICON[p] || p}</span>)}
                    <span className="font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[item.format] || "#6b7280"}18`, color: FORMAT_COLOR[item.format] || "#6b7280", fontSize: "9px" }}>{item.format}</span>
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "#6b6b80" }}>
                    {item.metrics.reach > 0 && <span>{(item.metrics.reach / 1000).toFixed(1)}K reach</span>}
                    {item.metrics.engagement_rate > 0 && <span> · {item.metrics.engagement_rate}% eng</span>}
                  </div>
                </div>
                {/* Expanded */}
                {isOpen && (
                  <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid #1e1e2e" }} onClick={(e) => e.stopPropagation()}>
                    {item.caption && <pre className="text-[10px] font-mono whitespace-pre-wrap mb-2 max-h-[200px] overflow-y-auto" style={{ color: "#94a3b8" }}>{item.caption}</pre>}
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                      <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.likes}</div><div style={{ color: "#4a4a5e" }}>Likes</div></div>
                      <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.comments}</div><div style={{ color: "#4a4a5e" }}>Comments</div></div>
                      <div><div className="font-bold" style={{ color: "#00d4d4" }}>{item.metrics.saves}</div><div style={{ color: "#4a4a5e" }}>Saves</div></div>
                    </div>
                    {item.notes && <p className="text-[10px] mt-2 italic" style={{ color: "#4a4a5e" }}>{item.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
