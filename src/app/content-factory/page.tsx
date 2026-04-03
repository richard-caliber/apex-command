"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Project { id: string; name: string; image_url: string }
interface Strategy { id: string; project_id: string; approved_at: string }
interface QueueItem { project_id: string; status: string }
interface LibraryItem { project_id: string; posted_date: string }

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

export default function ContentFactoryDashboard() {
  const [cards, setCards] = useState<{ project: Project; strategy: Strategy; lastPosted: string; contentCount: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [stratData, projData, queueData, libData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
      api("/api/content-library", { action: "list" }),
    ]);
    const strategies: Strategy[] = stratData?.items || [];
    const projects: Project[] = projData?.projects || [];
    const queue: QueueItem[] = queueData?.items || [];
    const library: LibraryItem[] = libData?.items || [];

    const result = strategies.map((s) => {
      const proj = projects.find((p) => p.id === s.project_id) || { id: s.project_id, name: s.project_id, image_url: "" };
      const libItems = library.filter((l) => l.project_id === s.project_id);
      const queueItems = queue.filter((q) => q.project_id === s.project_id);
      const lastPosted = libItems.length > 0
        ? libItems.sort((a, b) => b.posted_date.localeCompare(a.posted_date))[0].posted_date
        : "";
      const hasActiveQueue = queueItems.some((q) => !q.status?.includes("draft"));
      return {
        project: proj,
        strategy: s,
        lastPosted,
        contentCount: libItems.length,
        status: hasActiveQueue ? "Active" : libItems.length > 0 ? "Active" : "Strategy Only",
      };
    });
    setCards(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-2" style={{ color: "#6b6b80" }}>No projects have content strategies yet.</p>
        <p className="text-xs" style={{ color: "#3a3a4e" }}>Push a strategy via POST /api/content-strategy to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {cards.map((c) => (
        <Link key={c.project.id} href={`/content-factory/strategy?project=${c.project.id}`}
          className="group block rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
          style={{ border: "1px solid #1e1e2e" }}>
          <div className="relative aspect-video" style={{
            background: c.project.image_url
              ? `url(${c.project.image_url}) center/cover no-repeat`
              : `linear-gradient(135deg, #1a1a3e 0%, #0d0d1a 100%)`,
          }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute top-3 right-3">
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{
                  background: c.status === "Active" ? "rgba(34,197,94,0.15)" : "rgba(0,212,212,0.12)",
                  color: c.status === "Active" ? "#22c55e" : "#00d4d4",
                }}>{c.status}</span>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4">
              <h3 className="text-sm font-bold text-white group-hover:text-[#00d4d4] transition-colors">{c.project.name}</h3>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-4 text-[11px]" style={{ background: "#111118", borderTop: "1px solid #1e1e2e" }}>
            <span style={{ color: "#6b6b80" }}>
              {c.contentCount} piece{c.contentCount !== 1 ? "s" : ""}
            </span>
            {c.lastPosted && (
              <span style={{ color: "#4a4a5e" }} className="font-mono">
                Last: {new Date(c.lastPosted).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
