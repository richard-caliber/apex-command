"use client";

import { useState, useEffect, useCallback } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Project { id: string; name: string }
interface Strategy { project_id: string; ideas: { title: string; format: string; pillar: string; hook: string; used: boolean }[] }
interface QueueItem { id: string; project_id: string; title: string; format: string; platforms: string[]; pillar: string; scheduled_date: string; status: string; pipeline_step: string; backburner: boolean }

const STEPS = ["research", "review_research", "create", "review_assets", "ready_to_post"];
const STEP_LABEL: Record<string, string> = { research: "Research", review_research: "Review", create: "Create", review_assets: "Review", ready_to_post: "Post" };
const FORMAT_COLOR: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };
const PLATFORM_ICON: Record<string, string> = { instagram: "IG", tiktok: "TT", youtube: "YT", x: "X" };

export default function QueuePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sData, pData, qData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/content-queue", { action: "list" }),
    ]);
    const strats: Strategy[] = sData?.items || [];
    const projs: Project[] = (pData?.projects || []).filter((p: Project) => strats.some((s) => s.project_id === p.id));
    setStrategies(strats);
    setProjects(projs);
    setQueue(qData?.items || []);
    if (!selected && projs.length > 0) setSelected(projs[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const activeQueue = queue.filter((q) => q.project_id === selected && !q.backburner);
  const backburner = queue.filter((q) => q.project_id === selected && q.backburner);
  const strategy = strategies.find((s) => s.project_id === selected);
  const unusedIdeas = strategy?.ideas.filter((i) => !i.used) || [];

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;
  if (projects.length === 0) return <p className="text-xs text-center py-20" style={{ color: "#3a3a4e" }}>No projects with strategies.</p>;

  return (
    <div>
      <div className="mb-5">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="text-sm bg-transparent border rounded-lg px-3 py-2 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Active Queue */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>
          Active Queue <span className="font-mono font-normal" style={{ color: "#4a4a5e" }}>{activeQueue.length}</span>
        </h3>
        {activeQueue.length === 0 ? (
          <p className="text-[11px] py-4 text-center" style={{ color: "#3a3a4e", border: "1px dashed #1e1e2e", borderRadius: "8px" }}>No content in queue</p>
        ) : (
          <div className="space-y-2">
            {activeQueue.map((q) => {
              const stepIdx = STEPS.indexOf(q.pipeline_step);
              return (
                <div key={q.id} className="rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium" style={{ color: "#e0e0ee" }}>{q.title}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[q.format] || "#6b7280"}18`, color: FORMAT_COLOR[q.format] || "#6b7280" }}>{q.format}</span>
                    {q.platforms.map((p) => <span key={p} className="text-[9px] font-bold" style={{ color: "#4a4a5e" }}>{PLATFORM_ICON[p] || p}</span>)}
                    {q.scheduled_date && <span className="text-[10px] font-mono ml-auto" style={{ color: "#6b6b80" }}>{new Date(q.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                  </div>
                  {/* Mini pipeline */}
                  <div className="flex items-center gap-1">
                    {STEPS.map((step, i) => {
                      const done = i < stepIdx;
                      const current = i === stepIdx;
                      return (
                        <div key={step} className="flex items-center gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
                            background: done ? "rgba(34,197,94,0.12)" : current ? "rgba(0,212,212,0.12)" : "rgba(107,107,128,0.08)",
                            color: done ? "#22c55e" : current ? "#00d4d4" : "#3a3a4e",
                          }}>{STEP_LABEL[step] || step} {done ? "\u2705" : current ? "\u{1F504}" : "\u2B1C"}</span>
                          {i < STEPS.length - 1 && <span style={{ color: "#2a2a3e" }}>→</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backburner */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#6b6b80" }}>
          Backburner <span className="font-mono font-normal" style={{ color: "#4a4a5e" }}>{backburner.length + unusedIdeas.length}</span>
        </h3>
        {backburner.length === 0 && unusedIdeas.length === 0 ? (
          <p className="text-[11px] py-4 text-center" style={{ color: "#3a3a4e", border: "1px dashed #1e1e2e", borderRadius: "8px" }}>No backburner items</p>
        ) : (
          <div>
            {backburner.map((q) => (
              <div key={q.id} className="flex items-center gap-3 py-1.5 px-2" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                <span className="text-xs" style={{ color: "#e0e0ee" }}>{q.title}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[q.format] || "#6b7280"}18`, color: FORMAT_COLOR[q.format] || "#6b7280" }}>{q.format}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{q.pillar}</span>
              </div>
            ))}
            {unusedIdeas.map((idea, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                <span className="text-xs" style={{ color: "#94a3b8" }}>{idea.title}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLOR[idea.format] || "#6b7280"}18`, color: FORMAT_COLOR[idea.format] || "#6b7280" }}>{idea.format}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{idea.pillar}</span>
                {idea.hook && <span className="text-[9px] italic truncate" style={{ color: "#3a3a4e" }}>&ldquo;{idea.hook}&rdquo;</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
