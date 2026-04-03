"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

interface Strategy {
  id: string; project_id: string; approved_by: string; approved_at: string;
  pillars: { name: string; description: string; pct: number; examples: string[] }[];
  schedule: { frequency: string; days: string[]; times: string[]; format_rotation: Record<string, string>; batch_day: string };
  rules: { voice: string; visual: string; caption_formula: string; hashtags: string[]; never_post: string[] };
  production: { step: string; owner: string; time: string; tools: string[] }[];
  scaling: { trigger: string; threshold: string; action: string }[];
  ideas: { title: string; format: string; pillar: string; hook: string; effort: string; used: boolean }[];
  metrics: { weekly: string[]; targets_30d: Record<string, string>; targets_60d: Record<string, string>; targets_90d: Record<string, string>; kill_criteria: string[] };
}

interface Project { id: string; name: string }

const OWNER_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", "claude-code": "\u{1F4BB}", ginge: "\u{1F464}", auto: "\u26A1" };
const OWNER_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280" };
const PILLAR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#6b7280"];
const FORMAT_COLORS: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };

function StrategyInner() {
  const params = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selected, setSelected] = useState(params.get("project") || "");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sData, pData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
    ]);
    const strats: Strategy[] = sData?.items || [];
    const projs: Project[] = (pData?.projects || []).filter((p: Project) => strats.some((s) => s.project_id === p.id));
    setStrategies(strats);
    setProjects(projs);
    if (!selected && projs.length > 0) setSelected(projs[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const strategy = strategies.find((s) => s.project_id === selected);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;
  if (projects.length === 0) return <p className="text-xs text-center py-20" style={{ color: "#3a3a4e" }}>No approved strategies yet.</p>;

  return (
    <div>
      {/* Project selector */}
      <div className="flex items-center gap-3 mb-6">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="text-sm bg-transparent border rounded-lg px-3 py-2 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {strategy && (
          <span className="text-[10px] font-mono" style={{ color: "#4a4a5e" }}>
            Approved by {strategy.approved_by} · {new Date(strategy.approved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
      </div>

      {!strategy ? (
        <p className="text-xs text-center py-12" style={{ color: "#3a3a4e" }}>No strategy found for this project.</p>
      ) : (
        <div className="space-y-6">
          {/* 1. Pillars */}
          {strategy.pillars.length > 0 && (
            <Section title="Pillars">
              <div className="flex gap-1 rounded-full overflow-hidden h-3 mb-4">
                {strategy.pillars.map((p, i) => (
                  <div key={i} style={{ width: `${p.pct}%`, background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} title={`${p.name}: ${p.pct}%`} />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {strategy.pillars.map((p, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ border: `1px solid ${PILLAR_COLORS[i % PILLAR_COLORS.length]}30`, background: `${PILLAR_COLORS[i % PILLAR_COLORS.length]}08` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: PILLAR_COLORS[i % PILLAR_COLORS.length] }}>{p.name}</span>
                      <span className="text-[9px] font-mono" style={{ color: "#4a4a5e" }}>{p.pct}%</span>
                    </div>
                    <p className="text-[11px] mb-2" style={{ color: "#94a3b8" }}>{p.description}</p>
                    {p.examples.length > 0 && (
                      <div className="flex flex-wrap gap-1">{p.examples.map((e, j) => <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{e}</span>)}</div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 2. Schedule */}
          <Section title="Schedule">
            <p className="text-xs mb-3" style={{ color: "#00d4d4" }}>{strategy.schedule.frequency} — {strategy.schedule.days.join(", ")}</p>
            {strategy.schedule.days.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                    <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#6b6b80" }}>Day</th>
                    <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#6b6b80" }}>Time</th>
                    <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#6b6b80" }}>Format</th>
                  </tr></thead>
                  <tbody>{strategy.schedule.days.map((d, i) => (
                    <tr key={d} style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                      <td className="py-1.5 pr-4 capitalize" style={{ color: "#e0e0ee" }}>{d}</td>
                      <td className="py-1.5 pr-4 font-mono" style={{ color: "#6b6b80" }}>{strategy.schedule.times[i] || "—"}</td>
                      <td className="py-1.5">
                        {strategy.schedule.format_rotation[d] && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${FORMAT_COLORS[strategy.schedule.format_rotation[d]] || "#6b7280"}18`, color: FORMAT_COLORS[strategy.schedule.format_rotation[d]] || "#6b7280" }}>
                            {strategy.schedule.format_rotation[d]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 3. Rules */}
          <Section title="Rules">
            {strategy.rules.voice && <Field label="Brand Voice" value={strategy.rules.voice} />}
            {strategy.rules.visual && <Field label="Visual Standards" value={strategy.rules.visual} />}
            {strategy.rules.caption_formula && <Field label="Caption Formula" value={strategy.rules.caption_formula} />}
            {strategy.rules.hashtags.length > 0 && (
              <div className="mb-3">
                <span className="text-[9px] uppercase tracking-wider font-bold block mb-1" style={{ color: "#4a4a5e" }}>Hashtags</span>
                <div className="flex flex-wrap gap-1">{strategy.rules.hashtags.map((h) => <span key={h} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}>#{h}</span>)}</div>
              </div>
            )}
            {strategy.rules.never_post.length > 0 && (
              <div>
                <span className="text-[9px] uppercase tracking-wider font-bold block mb-1" style={{ color: "#ef4444" }}>Never Post</span>
                <div className="flex flex-wrap gap-1">{strategy.rules.never_post.map((n) => <span key={n} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{n}</span>)}</div>
              </div>
            )}
          </Section>

          {/* 4. Production Pipeline */}
          {strategy.production.length > 0 && (
            <Section title="Production Pipeline">
              <div className="flex flex-wrap items-center gap-2">
                {strategy.production.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(107,107,128,0.08)", border: "1px solid #1e1e2e" }}>
                      <span className="text-[10px] font-mono" style={{ color: "#6b6b80" }}>{step.time}</span>
                      <span className="text-xs" style={{ color: "#e0e0ee" }}>{step.step}</span>
                      <span className="text-[10px] font-medium" style={{ color: OWNER_COLOR[step.owner] || "#6b6b80" }}>
                        {OWNER_EMOJI[step.owner] || ""} {step.owner}
                      </span>
                    </div>
                    {i < strategy.production.length - 1 && <span style={{ color: "#2a2a3e" }}>→</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 5. Scaling Triggers */}
          {strategy.scaling.length > 0 && (
            <Section title="Scaling Triggers">
              <table className="w-full text-[11px]">
                <thead><tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                  <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#6b6b80" }}>Trigger</th>
                  <th className="text-left py-1.5 pr-4 font-semibold" style={{ color: "#6b6b80" }}>Threshold</th>
                  <th className="text-left py-1.5 font-semibold" style={{ color: "#6b6b80" }}>Action</th>
                </tr></thead>
                <tbody>{strategy.scaling.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                    <td className="py-1.5 pr-4" style={{ color: "#e0e0ee" }}>{s.trigger}</td>
                    <td className="py-1.5 pr-4 font-mono" style={{ color: "#f59e0b" }}>{s.threshold}</td>
                    <td className="py-1.5" style={{ color: "#94a3b8" }}>{s.action}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>
          )}

          {/* 6. Ideas Backlog */}
          {strategy.ideas.length > 0 && (
            <Section title={`Content Ideas Backlog (${strategy.ideas.filter((i) => !i.used).length} remaining)`}>
              <div className="space-y-0">
                {strategy.ideas.map((idea, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 px-2" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)", opacity: idea.used ? 0.4 : 1 }}>
                    <span className="text-xs" style={{ color: idea.used ? "#3a3a4e" : "#e0e0ee", textDecoration: idea.used ? "line-through" : "none" }}>{idea.title}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0" style={{ background: `${FORMAT_COLORS[idea.format] || "#6b7280"}18`, color: FORMAT_COLORS[idea.format] || "#6b7280" }}>{idea.format}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{idea.pillar}</span>
                    {idea.hook && <span className="text-[10px] truncate flex-1 italic" style={{ color: "#4a4a5e" }}>&ldquo;{idea.hook}&rdquo;</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 7. Success Metrics */}
          <Section title="Success Metrics">
            {Object.keys(strategy.metrics.targets_30d).length > 0 && <MetricRow label="30-Day Targets" data={strategy.metrics.targets_30d} />}
            {Object.keys(strategy.metrics.targets_60d).length > 0 && <MetricRow label="60-Day Targets" data={strategy.metrics.targets_60d} />}
            {Object.keys(strategy.metrics.targets_90d).length > 0 && <MetricRow label="90-Day Targets" data={strategy.metrics.targets_90d} />}
            {strategy.metrics.kill_criteria.length > 0 && (
              <div className="mt-3">
                <span className="text-[9px] uppercase tracking-wider font-bold block mb-1" style={{ color: "#ef4444" }}>Kill Criteria</span>
                {strategy.metrics.kill_criteria.map((k, i) => (
                  <div key={i} className="text-[11px] py-0.5" style={{ color: "#ef4444" }}>• {k}</div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <span className="text-[9px] uppercase tracking-wider font-bold block mb-1" style={{ color: "#4a4a5e" }}>{label}</span>
      <pre className="text-[11px] font-mono whitespace-pre-wrap" style={{ color: "#94a3b8" }}>{value}</pre>
    </div>
  );
}

function MetricRow({ label, data }: { label: string; data: Record<string, string> }) {
  return (
    <div className="mb-2">
      <span className="text-[9px] uppercase tracking-wider font-bold block mb-1" style={{ color: "#4a4a5e" }}>{label}</span>
      <div className="flex flex-wrap gap-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="text-[11px]"><span style={{ color: "#6b6b80" }}>{k}: </span><span className="font-mono font-bold" style={{ color: "#00d4d4" }}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}

export default function StrategyPage() {
  return <Suspense fallback={<p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>}><StrategyInner /></Suspense>;
}
