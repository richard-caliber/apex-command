"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Project { id: string; name: string; image_url: string; stage: string; status: string }
interface Strategy { id: string; project_id: string; approved_at: string }
interface PipelineTask { id: string; project_id: string; stage: string; name: string; status: string; owner: string; order: number; output: string; blocker: string | null }

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
const STAGE_LABEL: Record<string, string> = { traffic: "Traffic", conversion: "Conversion", delivery: "Delivery", scale: "Scale" };
const STAGE_COLOR: Record<string, { bg: string; text: string }> = {
  traffic: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  conversion: { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
  delivery: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  scale: { bg: "rgba(0,212,212,0.15)", text: "#00d4d4" },
};

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface DarwinScore { score: number; verdict: string }

interface CardData {
  project: Project;
  hasStrategy: boolean;
  nextTask: PipelineTask | null;
  darwinScore: DarwinScore | null;
}

export default function ContentFactoryDashboard() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [projData, stratData, taskData] = await Promise.all([
      api("/api/projects", { action: "list" }),
      api("/api/content-strategy", { action: "list" }),
      api("/api/pipeline-tasks", { action: "list" }),
    ]);

    const projects: Project[] = projData?.projects || [];
    const strategies: Strategy[] = stratData?.items || [];
    const tasks: PipelineTask[] = taskData?.tasks || [];
    const stageOrder = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];

    // Filter to projects at traffic stage or beyond
    const contentProjects = projects.filter((p) => CONTENT_STAGES.has(p.stage));

    // Build Darwin score map
    const scoreMap: Record<string, DarwinScore> = {};
    for (const t of tasks) {
      if (!t.output || t.project_id === "_template") continue;
      try {
        const parsed = JSON.parse(t.output);
        if (typeof parsed.score === "number") {
          const si = stageOrder.indexOf(t.stage);
          const existing = scoreMap[t.project_id] as (DarwinScore & { _si?: number }) | undefined;
          if (!existing || si > (existing._si ?? -1)) {
            scoreMap[t.project_id] = { score: parsed.score, verdict: parsed.verdict || "" };
            (scoreMap[t.project_id] as DarwinScore & { _si?: number })._si = si;
          }
        }
      } catch { /* not JSON */ }
    }

    const result: CardData[] = contentProjects.map((p) => {
      const hasStrategy = strategies.some((s) => s.project_id === p.id);
      const projectTasks = tasks
        .filter((t) => t.project_id === p.id && t.status !== "done" && t.status !== "skipped" && t.blocker !== "continuous")
        .sort((a, b) => {
          const sa = stageOrder.indexOf(a.stage);
          const sb = stageOrder.indexOf(b.stage);
          if (sa !== sb) return sa - sb;
          return a.order - b.order;
        });
      return { project: p, hasStrategy, nextTask: projectTasks[0] || null, darwinScore: scoreMap[p.id] || null };
    });

    setCards(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-2" style={{ color: "#6b6b80" }}>No projects at Traffic stage or beyond yet.</p>
        <p className="text-xs" style={{ color: "#3a3a4e" }}>Projects move here once they reach the Traffic stage in the pipeline.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {cards.map((c) => {
        const sc = STAGE_COLOR[c.project.stage] || STAGE_COLOR.traffic;
        const ownerColor = c.nextTask?.owner === "ginge" ? "#ef4444" : c.nextTask?.owner === "claude-code" ? "#3b82f6" : "#22c55e";
        return (
          <Link key={c.project.id} href={`/content-factory/strategy?project=${c.project.id}`}
            className="group block rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
            style={{ border: "1px solid #1e1e2e" }}>
            <div className="relative aspect-video" style={{
              background: c.project.image_url
                ? `url(${c.project.image_url}) center/cover no-repeat`
                : "linear-gradient(135deg, #1a1a3e 0%, #0d0d1a 100%)",
            }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              {/* Stage badge */}
              <div className="absolute top-3 left-3">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                  style={{ background: sc.bg, color: sc.text }}>
                  {STAGE_LABEL[c.project.stage] || c.project.stage}
                </span>
              </div>
              {/* Strategy status */}
              <div className="absolute top-3 right-3">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{
                    background: c.hasStrategy ? "rgba(34,197,94,0.15)" : "rgba(107,107,128,0.15)",
                    color: c.hasStrategy ? "#22c55e" : "#6b6b80",
                  }}>
                  {c.hasStrategy ? "Strategy" : "No Strategy"}
                </span>
              </div>
              {/* Darwin score */}
              {c.darwinScore && (() => {
                const s = c.darwinScore.score;
                const bg = s >= 7 ? "rgba(34,197,94,0.85)" : s >= 4 ? "rgba(245,158,11,0.85)" : "rgba(239,68,68,0.85)";
                const label = s >= 7 ? "PROCEED" : s >= 4 ? "ITERATE" : "PARKED";
                return (
                  <div className="absolute top-10 left-3">
                    <span className="text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded text-white" style={{ background: bg }}>
                      {s}/10 {label}
                    </span>
                  </div>
                );
              })()}
              <div className="absolute bottom-0 inset-x-0 p-4">
                <h3 className="text-sm font-bold text-white group-hover:text-[#00d4d4] transition-colors">{c.project.name}</h3>
              </div>
            </div>
            <div className="px-4 py-3" style={{ background: "#111118", borderTop: "1px solid #1e1e2e" }}>
              {c.nextTask ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ownerColor }} />
                  <span className="text-[10px] truncate" style={{ color: ownerColor }}>
                    Next: {c.nextTask.name} → {c.nextTask.owner}
                  </span>
                </div>
              ) : (
                <span className="text-[10px]" style={{ color: "#3a3a4e" }}>All tasks complete</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
