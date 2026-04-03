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
interface PipelineTask { id: string; project_id: string; stage: string; name: string; description: string; status: string; owner: string; output: string; order: number; blocker: string | null }

const CONTENT_STAGES = new Set(["traffic", "conversion", "delivery", "scale"]);
const OWNER_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", "claude-code": "\u{1F4BB}", ginge: "\u{1F464}", auto: "\u26A1" };
const OWNER_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280" };
const PILLAR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#6b7280"];
const FORMAT_COLORS: Record<string, string> = { reel: "#ef4444", carousel: "#3b82f6", story: "#f59e0b", post: "#22c55e" };

interface MetricTarget { metric: string; target: string; current?: string; status?: string }

interface ParsedStrategy {
  primary_channel?: string;
  secondary_channel?: string;
  traffic_plan?: string;
  next_actions?: string[];
  content_rules?: string;
  rules_structured?: Record<string, any>; // raw parsed rules object for sub-section rendering
  cadence?: string;
  production_text?: string; // plain text production workflow
  production_chain?: { task: string; time: string; trigger: string; owner: string; duration: string; description: string }[];
  kpis?: string | string[];
  metric_targets?: MetricTarget[]; // structured success metrics
  north_star?: string;
  current_status?: string;
}

function parseStrategy(s: Strategy): ParsedStrategy {
  // Start with strategy field — could be JSON or plain text
  let parsed: ParsedStrategy = {};
  if (s.strategy) {
    try {
      const j = JSON.parse(s.strategy);
      if (typeof j === "object" && j !== null) parsed = j;
      else parsed.traffic_plan = s.strategy; // parsed to non-object (shouldn't happen)
    } catch {
      // Plain text strategy — use as traffic_plan directly
      parsed.traffic_plan = s.strategy;
    }
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

  // Parse production workflow (may be string or array)
  const rawProd = s.production as any;
  if (rawProd && typeof rawProd === "string" && rawProd.length > 0) {
    parsed.production_text = rawProd;
  }
  // Extract production_chain from schedule JSON
  const schedParsed = safeParse(s.schedule);
  if (schedParsed?.production_chain && Array.isArray(schedParsed.production_chain)) {
    parsed.production_chain = schedParsed.production_chain;
  }

  // Parse rules JSON string — store both structured and flattened
  const rules = safeParse(s.rules);
  if (rules && typeof rules === "object" && !Array.isArray(rules)) {
    parsed.rules_structured = rules;
    if (!parsed.content_rules) {
      const parts: string[] = [];
      if (rules.voice) parts.push("Voice: " + rules.voice);
      if (rules.visual) parts.push("Visual: " + rules.visual);
      if (parts.length > 0) parsed.content_rules = parts.join("\n\n");
      // Mark as having rules even if content_rules string is empty — we'll render structured
    }
  }

  // Parse success_metrics — store structured targets
  const sm = safeParse(s.success_metrics);
  if (sm?.targets && Array.isArray(sm.targets)) {
    parsed.metric_targets = sm.targets;
    if (sm.north_star) parsed.north_star = sm.north_star;
    if (!parsed.kpis) {
      parsed.kpis = sm.targets.map((t: any) => `${t.metric}: ${t.target}${t.current ? ` (now: ${t.current})` : ""}`);
    }
  }
  if (!parsed.kpis && !parsed.metric_targets) {
    const m = safeParse(s.metrics);
    if (m?.targets_30d && Object.keys(m.targets_30d).length > 0) {
      parsed.kpis = Object.entries(m.targets_30d).map(([k, v]) => `${k}: ${v}`);
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
  const hasNewStrategy = parsed && (parsed.traffic_plan || parsed.cadence || parsed.content_rules || parsed.rules_structured || parsed.kpis || parsed.metric_targets || parsed.current_status || (parsed.next_actions && parsed.next_actions.length > 0));

  const trafficTasks = useMemo(() => {
    return tasks
      .filter((t) => t.project_id === selected && (t.stage === "traffic" || t.stage === "conversion") && t.status !== "done" && t.status !== "skipped" && t.blocker !== "continuous")
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

              {/* 2. PRODUCTION WORKFLOW */}
              {parsed!.production_chain && parsed!.production_chain.length > 0 && (
                <ProductionWorkflow chain={parsed!.production_chain} />
              )}

              {/* 3. SCHEDULE */}
              {parsed!.cadence && (
                <Section title={"\uD83D\uDCC5 Schedule"}>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "#e0e0ee", fontFamily: "inherit" }}>{parsed!.cadence}</pre>
                </Section>
              )}

              {/* 3. RULES — structured sub-sections or plain text */}
              {(parsed!.rules_structured || parsed!.content_rules) && (
                <div className="rounded-lg overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <div className="px-4 py-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00d4d4" }}>{"\uD83D\uDCCB"} Rules</h3>
                  </div>
                  {parsed!.rules_structured ? (
                    <div className="border-t" style={{ borderColor: "#1e1e2e" }}>
                      {Object.entries(parsed!.rules_structured).map(([key, val]) => {
                        if (!val) return null;
                        const label = key.charAt(0).toUpperCase() + key.slice(1);
                        let content: string;
                        if (typeof val === "string") content = val;
                        else if (Array.isArray(val)) content = val.join("\n");
                        else if (typeof val === "object") content = Object.entries(val).map(([k, v]) => `${k}: ${v}`).join("\n");
                        else content = String(val);
                        return (
                          <Collapsible key={key} title={label} isOpen={!collapsed.has(`rule-${key}`)} onToggle={() => toggle(`rule-${key}`)}>
                            <pre className="text-[11px] whitespace-pre-wrap leading-relaxed" style={{ color: "#94a3b8", fontFamily: "inherit" }}>{content}</pre>
                          </Collapsible>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "#94a3b8", fontFamily: "inherit" }}>{parsed!.content_rules}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* 4. SUCCESS METRICS — target cards with status colors */}
              {(parsed!.metric_targets || parsed!.kpis) && (
                <div className="rounded-lg p-4" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#00d4d4" }}>{"\uD83D\uDCCA"} Success Metrics</h3>
                  {parsed!.north_star && (
                    <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(0,212,212,0.06)", border: "1px solid rgba(0,212,212,0.15)" }}>
                      <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "#475569" }}>North Star: </span>
                      <span className="text-xs font-semibold" style={{ color: "#00d4d4" }}>{parsed!.north_star}</span>
                    </div>
                  )}
                  {parsed!.metric_targets ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsed!.metric_targets.map((t, i) => {
                        const statusColor = t.status === "met" ? "#22c55e" : t.status === "in_progress" ? "#f59e0b" : "#ef4444";
                        const statusBg = t.status === "met" ? "rgba(34,197,94,0.08)" : t.status === "in_progress" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
                        return (
                          <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: statusBg, border: `1px solid ${statusColor}20` }}>
                            <div className="text-xs font-semibold mb-1" style={{ color: "#e0e0ee" }}>{t.metric}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold" style={{ color: statusColor }}>{t.target}</span>
                              {t.current && (
                                <span className="text-[10px]" style={{ color: "#6b6b80" }}>now: {t.current}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : Array.isArray(parsed!.kpis) ? (
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

/* ── Production Workflow ── */

const TRIGGER_CFG: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  cron: { icon: "\u23F0", color: "#22c55e", label: "cron", bg: "rgba(34,197,94,0.1)" },
  chain: { icon: "\uD83D\uDD17", color: "#3b82f6", label: "chain", bg: "rgba(59,130,246,0.1)" },
  manual: { icon: "\uD83D\uDC64", color: "#f59e0b", label: "manual", bg: "rgba(245,158,11,0.1)" },
  continuous: { icon: "\uD83D\uDD01", color: "#a78bfa", label: "ongoing", bg: "rgba(167,139,250,0.1)" },
  auto: { icon: "\u26A1", color: "#6b7280", label: "auto", bg: "rgba(107,107,128,0.1)" },
};

const WF_OWNER_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280", system: "#6b7280" };
const WF_OWNER_EMOJI: Record<string, string> = { newton: "\uD83D\uDD2C", darwin: "\uD83D\uDD04", atlas: "\uD83E\uDDED", "claude-code": "\uD83D\uDCBB", ginge: "\uD83D\uDC51", auto: "\u26A1", system: "\u2699\uFE0F" };

function ProductionWorkflow({ chain }: { chain: { task: string; time: string; trigger: string; owner: string; duration: string; description: string }[] }) {
  // Group by day pattern
  const groups: { label: string; items: typeof chain }[] = [];
  let currentGroup: { label: string; items: typeof chain } | null = null;

  for (const step of chain) {
    const t = step.time.toLowerCase();
    let dayLabel: string;
    if (t.startsWith("mon")) dayLabel = "\uD83D\uDCC5 MONDAY (Batch Day)";
    else if (t.includes("daily")) dayLabel = "\uD83D\uDD04 DAILY (Publish)";
    else if (t.includes("every")) dayLabel = "\uD83D\uDCC8 RECURRING";
    else if (t.includes("sun") || t.includes("weekly")) dayLabel = "\uD83D\uDCCA WEEKLY REVIEW";
    else dayLabel = "\u23F0 " + step.time.split(" ")[0].toUpperCase();

    if (!currentGroup || currentGroup.label !== dayLabel) {
      currentGroup = { label: dayLabel, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(step);
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
      <div className="px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00d4d4" }}>{"\u2699\uFE0F"} Production Workflow</h3>
      </div>
      <div className="border-t" style={{ borderColor: "#1e1e2e" }}>
        {groups.map((group, gi) => (
          <div key={gi}>
            {/* Day header */}
            <div className="px-4 py-2" style={{ background: "rgba(0,212,212,0.03)", borderBottom: "1px solid #1e1e2e" }}>
              <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "#00d4d4" }}>{group.label}</span>
            </div>
            {/* Steps */}
            {group.items.map((step, si) => {
              const trigger = TRIGGER_CFG[step.trigger] || TRIGGER_CFG.auto;
              const ownerColor = WF_OWNER_COLOR[step.owner] || "#6b7280";
              return (
                <div key={si} className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(30,30,46,0.5)" }}>
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: trigger.color, boxShadow: `0 0 6px ${trigger.color}40` }} />
                    {si < group.items.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "rgba(30,30,46,0.8)", minHeight: 16 }} />}
                  </div>

                  {/* Time */}
                  <span className="text-[10px] font-mono flex-shrink-0 pt-0.5" style={{ color: "#6b6b80", minWidth: 80 }}>
                    {step.time.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*/i, "").replace("GMT+8", "").trim() || step.time}
                  </span>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold" style={{ color: "#00d4d4" }}>{step.task}</span>
                      <span className="text-xs" style={{ color: "#e0e0ee" }}>{step.description}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Owner */}
                      <span className="text-[10px]" style={{ color: ownerColor }}>
                        {WF_OWNER_EMOJI[step.owner] || ""} {step.owner}
                      </span>
                      {/* Duration */}
                      {step.duration && (
                        <span className="text-[9px] font-mono" style={{ color: "#4a4a5e" }}>{step.duration}</span>
                      )}
                      {/* Trigger badge */}
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ color: trigger.color, background: trigger.bg }}>
                        {trigger.icon} {trigger.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
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
