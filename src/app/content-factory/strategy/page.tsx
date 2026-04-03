"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function api(url: string, body: Record<string, unknown>) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Strategy {
  id: string; project_id: string; approved_by: string; approved_at: string;
  pillars: { name: string; description: string; pct: number; examples: string[] }[];
  schedule: any; // can be object or JSON string
  rules: any; // can be object or JSON string
  production: { step: string; owner: string; time: string; tools: string[] }[];
  scaling: { trigger: string; threshold: string; action: string }[];
  ideas: { title: string; format: string; pillar: string; hook: string; effort: string; used: boolean }[];
  metrics: any; // can be object or JSON string
  strategy?: string;
  success_metrics?: string;
  primary_channel?: string;
  secondary_channel?: string;
  traffic_plan?: string;
  next_actions?: string[];
  content_rules?: string;
  cadence?: string;
  kpis?: string;
}

/** Safely parse a field that might be a JSON string or already an object */
function safeParse(val: any): any {
  if (!val) return null;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

interface Project { id: string; name: string; stage: string }
interface PipelineTask { id: string; project_id: string; stage: string; name: string; description: string; status: string; owner: string; output: string; order: number }

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
const OWNER_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", "claude-code": "\u{1F4BB}", ginge: "\u{1F464}", auto: "\u26A1" };
const OWNER_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280" };
const PILLAR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#6b7280"];
const FORMAT_COLORS: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };

interface ParsedStrategy {
  primary_channel?: string;
  secondary_channel?: string;
  traffic_plan?: string;
  next_actions?: string[];
  content_rules?: string;
  cadence?: string;
  kpis?: string | string[];
  current_status?: string;
}

function parseStrategy(s: Strategy): ParsedStrategy {
  // Start with strategy JSON field if it exists
  let parsed: ParsedStrategy = {};
  if (s.strategy) {
    try { parsed = JSON.parse(s.strategy); } catch { /* not JSON */ }
  }

  // Overlay top-level fields (they may be newer)
  if (s.primary_channel) parsed.primary_channel = s.primary_channel;
  if (s.secondary_channel) parsed.secondary_channel = s.secondary_channel;
  if (s.traffic_plan) parsed.traffic_plan = s.traffic_plan;
  if (s.next_actions) parsed.next_actions = s.next_actions;
  if (s.content_rules) parsed.content_rules = s.content_rules;
  if (s.cadence) parsed.cadence = s.cadence;
  if (s.kpis) parsed.kpis = s.kpis;

  // Parse schedule JSON string for cadence if not set
  if (!parsed.cadence) {
    const sched = safeParse(s.schedule);
    if (sched && typeof sched === "object" && !Array.isArray(sched)) {
      const parts: string[] = [];
      if (sched.batch_day) parts.push(`Batch day: ${sched.batch_day}`);
      if (sched.batch_size) parts.push(sched.batch_size);
      if (sched.production_flow) parts.push(sched.production_flow);
      if (sched.posting_cadence) {
        const pc = sched.posting_cadence;
        Object.values(pc).forEach((v) => { if (typeof v === "string") parts.push(v); });
      }
      // Legacy format
      if (sched.frequency) parts.push(sched.frequency);
      if (sched.days?.length) parts.push(`Days: ${sched.days.join(", ")}`);
      if (parts.length > 0) parsed.cadence = parts.join("\n");
    }
  }

  // Parse rules JSON string for content_rules if not set
  if (!parsed.content_rules) {
    const rules = safeParse(s.rules);
    if (rules && typeof rules === "object" && !Array.isArray(rules)) {
      const parts: string[] = [];
      // New nested format
      if (rules.brand) parts.push("BRAND: " + (typeof rules.brand === "string" ? rules.brand : Object.entries(rules.brand).map(([k, v]) => `${k}: ${v}`).join(". ")));
      if (rules.carousel) parts.push("CAROUSEL: " + (typeof rules.carousel === "string" ? rules.carousel : JSON.stringify(rules.carousel)));
      if (rules.reel) parts.push("REEL: " + (typeof rules.reel === "string" ? rules.reel : JSON.stringify(rules.reel)));
      if (rules.universal) parts.push("UNIVERSAL: " + (typeof rules.universal === "string" ? rules.universal : Object.entries(rules.universal).map(([k, v]) => `${k}: ${v}`).join(". ")));
      // Legacy format
      if (rules.voice) parts.push("Voice: " + rules.voice);
      if (rules.visual) parts.push("Visual: " + rules.visual);
      if (parts.length > 0) parsed.content_rules = parts.join("\n\n");
    }
  }

  // Parse success_metrics or metrics for KPIs if not set
  if (!parsed.kpis) {
    const sm = safeParse(s.success_metrics);
    if (sm?.targets && Array.isArray(sm.targets)) {
      parsed.kpis = sm.targets.map((t: any) => `${t.metric}: ${t.target}${t.current ? ` (now: ${t.current})` : ""}`);
    }
    if (!parsed.kpis) {
      const m = safeParse(s.metrics);
      if (m?.targets_30d && Object.keys(m.targets_30d).length > 0) {
        parsed.kpis = Object.entries(m.targets_30d).map(([k, v]) => `${k}: ${v}`);
      }
    }
  }

  // Parse current_status from strategy JSON if available
  if (!parsed.current_status && s.strategy) {
    try {
      const sp = JSON.parse(s.strategy);
      if (sp.current_status) parsed.current_status = sp.current_status;
    } catch { /* ignore */ }
  }

  return parsed;
}

function StrategyInner() {
  const params = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [selected, setSelected] = useState(params.get("project") || "");
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setCollapsed((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const load = useCallback(async () => {
    const [sData, pData, tData] = await Promise.all([
      api("/api/content-strategy", { action: "list" }),
      api("/api/projects", { action: "list" }),
      api("/api/pipeline-tasks", { action: "list" }),
    ]);
    const strats: Strategy[] = sData?.items || [];
    const allProjects: Project[] = pData?.projects || [];
    const projs = allProjects.filter((p: Project) =>
      CONTENT_STAGES.has(p.stage) || strats.some((s) => s.project_id === p.id)
    );
    setStrategies(strats);
    setProjects(projs);
    setTasks(tData?.tasks || []);
    if (!selected && projs.length > 0) setSelected(projs[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const strategy = strategies.find((s) => s.project_id === selected);
  const parsed = strategy ? parseStrategy(strategy) : null;
  const hasNewStrategy = parsed && (parsed.traffic_plan || (parsed.next_actions && parsed.next_actions.length > 0));

  const trafficTasks = useMemo(() => {
    return tasks
      .filter((t) => t.project_id === selected && (t.stage === "traffic" || t.stage === "conversion") && t.status !== "done" && t.status !== "skipped")
      .sort((a, b) => a.order - b.order);
  }, [tasks, selected]);

  if (loading) return <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>;
  if (projects.length === 0) return <p className="text-xs text-center py-20" style={{ color: "#3a3a4e" }}>No projects at content stage yet.</p>;

  return (
    <div>
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
        <p className="text-xs text-center py-12" style={{ color: "#3a3a4e" }}>No strategy found for this project. Push one via API.</p>
      ) : (
        <div className="space-y-6">
          {hasNewStrategy ? (
            <>
              {/* 1. STRATEGY — hero, prominent */}
              {parsed!.traffic_plan && (
                <div className="rounded-lg p-6" style={{ background: "rgba(0,212,212,0.05)", border: "1px solid rgba(0,212,212,0.25)" }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>{"\uD83C\uDFAF"} Strategy</h3>
                  <p className="text-base leading-relaxed" style={{ color: "#f1f5f9" }}>{parsed!.traffic_plan}</p>
                </div>
              )}

              {/* 2. SCHEDULE */}
              {parsed!.cadence && (
                <Section title={"\uD83D\uDCC5 Schedule"}>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "#e0e0ee", fontFamily: "inherit" }}>{parsed!.cadence}</pre>
                </Section>
              )}

              {/* 3. RULES */}
              {parsed!.content_rules && (
                <Section title={"\uD83D\uDCCB Rules"}>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "#94a3b8", fontFamily: "inherit" }}>{parsed!.content_rules}</pre>
                </Section>
              )}

              {/* 4. SUCCESS METRICS */}
              {parsed!.kpis && (
                <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>{"\uD83D\uDCCA"} Success Metrics</h3>
                  {Array.isArray(parsed!.kpis) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsed!.kpis.map((kpi, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,212,212,0.04)", border: "1px solid rgba(0,212,212,0.1)" }}>
                          <span className="text-xs" style={{ color: "#00d4d4" }}>{"\uD83C\uDFAF"}</span>
                          <span className="text-xs" style={{ color: "#e0e0ee" }}>{kpi}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-[11px] whitespace-pre-wrap leading-relaxed" style={{ color: "#94a3b8", fontFamily: "inherit" }}>{String(parsed!.kpis)}</pre>
                  )}
                </div>
              )}

              {/* 5. CURRENT STATUS */}
              {parsed!.current_status && (
                <div className="rounded-lg p-4" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#f59e0b" }}>{"\uD83D\uDCCD"} Current Status</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#e0e0ee" }}>{parsed!.current_status}</p>
                </div>
              )}

              {/* 6. NEXT ACTIONS + pipeline tasks */}
              <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid rgba(245,158,11,0.2)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#f59e0b" }}>{"\u25B6\uFE0F"} Next Actions</h3>
                {parsed!.next_actions && parsed!.next_actions.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {parsed!.next_actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 py-1">
                        <span className="text-xs mt-0.5" style={{ color: "#475569" }}>{"\u25CB"}</span>
                        <span className="text-xs" style={{ color: "#e0e0ee" }}>{a}</span>
                      </div>
                    ))}
                  </div>
                )}
                {trafficTasks.length > 0 && (
                  <>
                    <div className="text-[9px] uppercase tracking-wider font-bold mb-2 mt-2 pt-3" style={{ color: "#475569", borderTop: "1px solid #1e1e2e" }}>Pipeline Tasks</div>
                    <div className="space-y-1">
                      {trafficTasks.slice(0, 5).map((t) => {
                        const oc = OWNER_COLOR[t.owner] || "#6b6b80";
                        return (
                          <div key={t.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "blocked" ? "bg-red-400" : t.status === "in_progress" ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
                            <span className="text-[10px] font-mono" style={{ color: "#475569", minWidth: 52 }}>{t.id}</span>
                            <span className="text-xs flex-1" style={{ color: "#e0e0ee" }}>{t.name}</span>
                            <span className="text-[10px] font-medium" style={{ color: oc }}>{OWNER_EMOJI[t.owner] || ""} {t.owner}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {(!parsed!.next_actions || parsed!.next_actions.length === 0) && trafficTasks.length === 0 && (
                  <p className="text-xs" style={{ color: "#3a3a4e" }}>No pending actions.</p>
                )}
              </div>

              {/* 7. CHANNELS */}
              {(parsed!.primary_channel || parsed!.secondary_channel) && (
                <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>{"\uD83D\uDCE1"} Channels</h3>
                  <div className="flex items-center gap-4">
                    {parsed!.primary_channel && (
                      <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(0,212,212,0.08)", border: "1px solid rgba(0,212,212,0.2)" }}>
                        <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: "#475569" }}>Primary</div>
                        <div className="text-xs font-semibold" style={{ color: "#00d4d4" }}>{parsed!.primary_channel}</div>
                      </div>
                    )}
                    {parsed!.secondary_channel && (
                      <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(107,107,128,0.06)", border: "1px solid #1e1e2e" }}>
                        <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: "#475569" }}>Secondary</div>
                        <div className="text-xs font-semibold" style={{ color: "#94a3b8" }}>{parsed!.secondary_channel}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Legacy/empty strategy — safely handle JSON strings */}
              {(() => {
                const sched = safeParse(strategy.schedule);
                const rules = safeParse(strategy.rules);
                const metrics = safeParse(strategy.metrics);
                const hasPillars = Array.isArray(strategy.pillars) && strategy.pillars.length > 0;
                const hasSchedule = sched && typeof sched === "object" && (sched.days?.length > 0 || sched.batch_day);
                const hasRules = rules && typeof rules === "object" && (rules.voice || rules.brand);
                const hasMetrics = metrics && typeof metrics === "object" && (metrics.targets_30d && Object.keys(metrics.targets_30d).length > 0);
                const isEmpty = !hasPillars && !hasSchedule && !hasRules && !hasMetrics;

                return (
                  <>
                    {isEmpty && (
                      <div className="rounded-lg p-6 text-center" style={{ background: "#111118", border: "1px dashed #1e1e2e" }}>
                        <p className="text-sm mb-1" style={{ color: "#6b6b80" }}>No strategy data for this project yet.</p>
                        <p className="text-xs" style={{ color: "#3a3a4e" }}>Atlas will push a traffic strategy once the project reaches Stage 4.</p>
                      </div>
                    )}

                    {hasPillars && (
                      <Section title="Pillars">
                        <div className="flex gap-1 rounded-full overflow-hidden h-3 mb-4">
                          {strategy.pillars.map((p: any, i: number) => (
                            <div key={i} style={{ width: `${p.pct}%`, background: PILLAR_COLORS[i % PILLAR_COLORS.length] }} title={`${p.name}: ${p.pct}%`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {strategy.pillars.map((p: any, i: number) => (
                            <div key={i} className="rounded-lg p-3" style={{ border: `1px solid ${PILLAR_COLORS[i % PILLAR_COLORS.length]}30`, background: `${PILLAR_COLORS[i % PILLAR_COLORS.length]}08` }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold" style={{ color: PILLAR_COLORS[i % PILLAR_COLORS.length] }}>{p.name}</span>
                                <span className="text-[9px] font-mono" style={{ color: "#4a4a5e" }}>{p.pct}%</span>
                              </div>
                              <p className="text-[11px] mb-2" style={{ color: "#94a3b8" }}>{p.description}</p>
                              {p.examples?.length > 0 && (
                                <div className="flex flex-wrap gap-1">{p.examples.map((e: string, j: number) => <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{e}</span>)}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {hasSchedule && sched.days?.length > 0 && (
                      <Section title="Schedule">
                        <p className="text-xs mb-3" style={{ color: "#00d4d4" }}>{sched.frequency || ""} {sched.days ? `— ${sched.days.join(", ")}` : ""}</p>
                      </Section>
                    )}

                    {hasRules && (
                      <Section title="Rules">
                        {rules.voice && <Field label="Brand Voice" value={rules.voice} />}
                        {rules.visual && <Field label="Visual Standards" value={rules.visual} />}
                      </Section>
                    )}

                    {hasMetrics && (
                      <Section title="Success Metrics">
                        {metrics.targets_30d && Object.keys(metrics.targets_30d).length > 0 && <MetricRow label="30-Day Targets" data={metrics.targets_30d} />}
                        {metrics.targets_60d && Object.keys(metrics.targets_60d).length > 0 && <MetricRow label="60-Day Targets" data={metrics.targets_60d} />}
                        {metrics.targets_90d && Object.keys(metrics.targets_90d).length > 0 && <MetricRow label="90-Day Targets" data={metrics.targets_90d} />}
                      </Section>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* Traffic tasks for legacy view (new strategy already includes them in section 6) */}
          {!hasNewStrategy && trafficTasks.length > 0 && (
            <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid rgba(245,158,11,0.2)" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#f59e0b" }}>
                {"\u25B6\uFE0F"} Next Traffic Tasks
              </h3>
              <div className="space-y-1.5">
                {trafficTasks.slice(0, 5).map((t) => {
                  const oc = OWNER_COLOR[t.owner] || "#6b6b80";
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "blocked" ? "bg-red-400" : t.status === "in_progress" ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
                      <span className="text-[10px] font-mono" style={{ color: "#475569", minWidth: 52 }}>{t.id}</span>
                      <span className="text-xs flex-1" style={{ color: "#e0e0ee" }}>{t.name}</span>
                      <span className="text-[10px] font-medium" style={{ color: oc }}>{OWNER_EMOJI[t.owner] || ""} {t.owner}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Collapsible({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer" style={{ background: "transparent", border: "none", color: "#f1f5f9" }}>
        <span className="text-[10px]" style={{ color: "#00d4d4", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.15s" }}>{"\u25B6"}</span>
        <h3 className="text-xs font-bold uppercase tracking-wider m-0" style={{ color: "#00d4d4" }}>{title}</h3>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
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
