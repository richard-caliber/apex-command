"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const TOKEN = "apex-live-2026";

/* ── Task creation mappings ── */
const METRIC_TASK_MAP: Record<string, { name: string; description: string; owner: string; stage: string; prompt_id: string }> = {
  "ig-followers": { name: "Connect IG Insights API", description: "Set up Instagram Graph API to pull follower count automatically", owner: "ginge", stage: "traffic", prompt_id: "" },
  "ig-reach": { name: "Connect IG Insights API", description: "Set up Instagram Graph API to pull reach data", owner: "ginge", stage: "traffic", prompt_id: "" },
  "ig-engagement": { name: "Connect IG Insights API", description: "Set up Instagram Graph API to pull engagement metrics", owner: "ginge", stage: "traffic", prompt_id: "" },
  "website-visitors": { name: "Install PostHog on website", description: "Add PostHog tracking script to all pages for visitor analytics", owner: "ginge", stage: "traffic", prompt_id: "" },
  "top-traffic-source": { name: "Install PostHog on website", description: "PostHog will identify top traffic sources automatically", owner: "ginge", stage: "traffic", prompt_id: "" },
  "content-published": { name: "Connect content tracking", description: "Link content publishing pipeline to data dashboard", owner: "atlas", stage: "traffic", prompt_id: "" },
  "follower-growth": { name: "Connect IG Insights API", description: "Calculate growth rate from historical follower data", owner: "ginge", stage: "traffic", prompt_id: "" },
  "landing-cvr": { name: "Map Current Funnel", description: "Define and instrument conversion funnel", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "checkout-completion": { name: "Map Current Funnel", description: "Track checkout completion rate", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "cart-abandonment": { name: "Map Current Funnel", description: "Track cart abandonment events", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "funnel-dropoff": { name: "Map Current Funnel", description: "Identify funnel drop-off points", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "ab-tests": { name: "Map Current Funnel", description: "Set up A/B testing framework", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "ctr": { name: "Map Current Funnel", description: "Track click-through rates across funnel", owner: "atlas", stage: "conversion", prompt_id: "T-5.1" },
  "total-revenue": { name: "Connect payment tracking", description: "Link Stripe/payment processor to data dashboard", owner: "ginge", stage: "revenue", prompt_id: "" },
  "revenue-month": { name: "Connect payment tracking", description: "Track monthly revenue from payment processor", owner: "ginge", stage: "revenue", prompt_id: "" },
  "revenue-week": { name: "Connect payment tracking", description: "Track weekly revenue from payment processor", owner: "ginge", stage: "revenue", prompt_id: "" },
  "aov": { name: "Connect payment tracking", description: "Calculate AOV from transaction data", owner: "ginge", stage: "revenue", prompt_id: "" },
  "transactions": { name: "Connect payment tracking", description: "Count transactions from payment processor", owner: "ginge", stage: "revenue", prompt_id: "" },
  "mrr": { name: "Connect payment tracking", description: "Calculate MRR from subscription data", owner: "ginge", stage: "revenue", prompt_id: "" },
  "processing-fees": { name: "Connect payment tracking", description: "Track processing fees from Stripe dashboard", owner: "ginge", stage: "revenue", prompt_id: "" },
  "repeat-purchase": { name: "Collect User Feedback", description: "Track repeat purchase behaviour", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "retention-d7": { name: "Collect User Feedback", description: "Measure 7-day retention", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "retention-d30": { name: "Collect User Feedback", description: "Measure 30-day retention", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "churn": { name: "Collect User Feedback", description: "Track monthly churn rate", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "nps": { name: "Collect User Feedback", description: "Set up NPS survey", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "support-tickets": { name: "Collect User Feedback", description: "Track support ticket volume", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "email-open-rate": { name: "Collect User Feedback", description: "Track email open rates", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "onboarding-completion": { name: "Collect User Feedback", description: "Track onboarding completion funnel", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "top-feedback": { name: "Collect User Feedback", description: "Gather and surface top customer quotes", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "common-issue": { name: "Collect User Feedback", description: "Categorise support issues", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "sentiment-ratio": { name: "Collect User Feedback", description: "Analyse sentiment from feedback", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
  "community-activity": { name: "Connect community tracking", description: "Track Telegram/community message volume", owner: "ginge", stage: "retention", prompt_id: "" },
  "feature-requests": { name: "Collect User Feedback", description: "Track and count feature requests", owner: "atlas", stage: "retention", prompt_id: "T-6.4" },
};

/* ── Types ── */
interface Metric {
  id: string;
  project_id: string;
  section: string;
  name: string;
  value: string;
  state: "good" | "warning" | "poor" | "missing";
  source: string;
  updated_at: string;
  metric_action: string;
  blocked_decision: string | null;
}

interface Project {
  id: string;
  name: string;
}

/* ── Metric Definitions ── */
const SECTIONS: { id: string; label: string; metrics: { id: string; name: string }[] }[] = [
  {
    id: "traffic", label: "Traffic",
    metrics: [
      { id: "ig-followers", name: "IG Followers" },
      { id: "ig-reach", name: "IG Reach (weekly)" },
      { id: "ig-engagement", name: "IG Engagement Rate (%)" },
      { id: "website-visitors", name: "Website Visitors (weekly)" },
      { id: "top-traffic-source", name: "Top Traffic Source" },
      { id: "content-published", name: "Content Published (this week)" },
      { id: "follower-growth", name: "Follower Growth Rate (%)" },
    ],
  },
  {
    id: "conversion", label: "Conversion",
    metrics: [
      { id: "landing-cvr", name: "Landing Page Conversion Rate (%)" },
      { id: "checkout-completion", name: "Checkout Completion Rate (%)" },
      { id: "cart-abandonment", name: "Cart Abandonment Rate (%)" },
      { id: "funnel-dropoff", name: "Funnel Drop-off Point" },
      { id: "ab-tests", name: "Active A/B Tests" },
      { id: "ctr", name: "Click-Through Rate (%)" },
    ],
  },
  {
    id: "revenue", label: "Revenue",
    metrics: [
      { id: "total-revenue", name: "Total Revenue (all time)" },
      { id: "revenue-month", name: "Revenue This Month" },
      { id: "revenue-week", name: "Revenue This Week" },
      { id: "aov", name: "Average Order Value" },
      { id: "transactions", name: "Number of Transactions" },
      { id: "mrr", name: "MRR" },
      { id: "processing-fees", name: "Payment Processing Fees" },
    ],
  },
  {
    id: "retention", label: "Retention",
    metrics: [
      { id: "repeat-purchase", name: "Repeat Purchase Rate (%)" },
      { id: "retention-d7", name: "Day 7 Retention" },
      { id: "retention-d30", name: "Day 30 Retention" },
      { id: "churn", name: "Monthly Churn Rate (%)" },
      { id: "nps", name: "NPS Score" },
      { id: "support-tickets", name: "Support Tickets (this week)" },
      { id: "email-open-rate", name: "Email Open Rate (%)" },
      { id: "onboarding-completion", name: "Onboarding Completion Rate (%)" },
    ],
  },
  {
    id: "qualitative", label: "Qualitative",
    metrics: [
      { id: "top-feedback", name: "Top Customer Feedback Quote" },
      { id: "common-issue", name: "Most Common Support Issue" },
      { id: "sentiment-ratio", name: "Sentiment Ratio (pos/neutral/neg)" },
      { id: "community-activity", name: "Community Activity (messages/week)" },
      { id: "feature-requests", name: "Feature Requests (count)" },
    ],
  },
];

const STATE_BADGE: Record<string, { label: string; color: string }> = {
  good: { label: "GOOD", color: "#22c55e" },
  warning: { label: "WARNING", color: "#f59e0b" },
  poor: { label: "POOR", color: "#ef4444" },
  missing: { label: "MISSING", color: "#6b7280" },
  stale: { label: "STALE", color: "#f59e0b" },
};

/* ── Main ── */
export default function DataPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("caliber");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [createdTasks, setCreatedTasks] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [dataRes, projRes] = await Promise.all([
        fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", project_id: selectedProject }),
        }),
        fetch("/api/status"),
      ]);
      if (dataRes.ok) setMetrics(await dataRes.json());
      if (projRes.ok) {
        const pd = await projRes.json();
        setProjects((pd.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      }
    } catch (_e) { /* silent */ }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createTask = async (metricId: string) => {
    const mapping = METRIC_TASK_MAP[metricId];
    if (!mapping) return;
    const taskId = `data-${selectedProject}-${metricId}`;
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          action: "set",
          id: taskId,
          stage: mapping.stage,
          project_id: selectedProject,
          name: mapping.name,
          description: mapping.description,
          status: "not_started",
          automation: "manual",
          owner: mapping.owner,
          prompt_id: mapping.prompt_id,
        }),
      });
      setCreatedTasks((prev) => new Set(prev).add(metricId));
    } catch (_e) { /* silent */ }
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build metric map for quick lookup
  const metricMap = useMemo(() => {
    const map: Record<string, Metric> = {};
    for (const m of metrics) map[m.id] = m;
    return map;
  }, [metrics]);

  // Get insights
  const insights = metrics.filter((m) => m.id.startsWith("insight-"));

  // Calculate confidence
  const totalMetrics = SECTIONS.reduce((sum, s) => sum + s.metrics.length, 0);
  const populatedMetrics = SECTIONS.reduce((sum, s) => {
    return sum + s.metrics.filter((m) => {
      const key = `${s.id}-${m.id}`;
      const metric = metricMap[key];
      return metric && metric.value && metric.state !== "missing";
    }).length;
  }, 0);
  const confidencePct = totalMetrics > 0 ? Math.round((populatedMetrics / totalMetrics) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Data</h1>

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-white cursor-pointer focus:outline-none focus:border-[#00d4d4]">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {projects.length === 0 && <option value="caliber">Caliber Peptides</option>}
        </select>

        {/* Confidence score */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#94a3b8] font-semibold">{confidencePct}% confidence</span>
              <span className="text-[10px] text-[#475569]">{populatedMetrics} of {totalMetrics} metrics</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e293b]">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${confidencePct}%`,
                background: confidencePct > 60 ? "#00d4d4" : confidencePct > 30 ? "#f59e0b" : "#ef4444",
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Decision Panel ── */}
      <div className="rounded-xl border border-[#1e293b] p-4" style={{ background: "rgba(17, 24, 39, 0.85)" }}>
        <h3 className="text-[10px] uppercase tracking-widest text-[#64748b] font-bold mb-2">Decision Insights</h3>
        {insights.length > 0 ? (
          <div className="space-y-1.5">
            {insights.map((ins) => (
              <p key={ins.id} className="text-xs text-[#cbd5e1] leading-relaxed">
                {ins.value}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#475569] italic">No insights yet — data collection will populate this automatically</p>
        )}
      </div>

      {/* ── Metric Sections ── */}
      {loading ? (
        <p className="text-sm text-[#475569] text-center py-16">Loading data...</p>
      ) : (
        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const isOpen = openSections.has(section.id);

            // Calculate section stats
            const sectionMetrics = section.metrics.map((m) => {
              const key = `${section.id}-${m.id}`;
              return { def: m, data: metricMap[key] || null };
            });

            const populated = sectionMetrics.filter((m) => m.data && m.data.value && m.data.state !== "missing").length;
            const total = sectionMetrics.length;

            // Worst state in section
            const states = sectionMetrics.map((m) => m.data?.state || "missing");
            const worstState = states.includes("poor") ? "poor" : states.includes("warning") ? "warning" : states.includes("missing") ? "missing" : "good";
            const worstBadge = STATE_BADGE[worstState];

            return (
              <div key={section.id} className="rounded-xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
                {/* Section header */}
                <button onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
                  <span className="text-xs text-[#475569]">{isOpen ? "\u25BC" : "\u25B6"}</span>
                  <span className="text-sm font-bold text-white flex-1 text-left">{section.label}</span>
                  <span className="text-[10px] text-[#475569] font-mono">{populated}/{total} populated</span>
                  <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
                    style={{ color: worstBadge.color, background: `${worstBadge.color}15` }}>
                    {worstBadge.label}
                  </span>
                </button>

                {/* Expanded metric rows */}
                {isOpen && (
                  <div className="border-t border-[#1e293b]">
                    {sectionMetrics.map(({ def, data }) => {
                      const hasValue = data && data.value && data.state !== "missing";

                      // Check staleness (>7 days)
                      let displayState: string = data?.state || "missing";
                      if (hasValue && data?.updated_at) {
                        const age = Date.now() - new Date(data.updated_at).getTime();
                        if (age > 7 * 24 * 60 * 60 * 1000) displayState = "stale";
                      }

                      const badge = STATE_BADGE[displayState] || STATE_BADGE.missing;

                      return (
                        <div key={def.id} className="px-4 py-2.5 border-t border-[#1e293b]/50 hover:bg-white/[0.01]">
                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Name */}
                            <span className="text-xs text-[#94a3b8] flex-1 min-w-[140px]">{def.name}</span>

                            {/* Value */}
                            <span className={`text-sm font-mono font-semibold min-w-[80px] text-right ${hasValue ? "text-white" : "text-[#475569]"}`}>
                              {hasValue ? data!.value : "\u2014"}
                            </span>

                            {/* State badge */}
                            <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded min-w-[70px] text-center"
                              style={{ color: badge.color, background: `${badge.color}15` }}>
                              {badge.label}
                            </span>

                            {/* Source */}
                            {data?.source && (
                              <span className="text-[9px] text-[#475569] font-mono hidden sm:inline">{data.source}</span>
                            )}

                            {/* Updated ago */}
                            {data?.updated_at && (
                              <span className="text-[9px] text-[#475569] hidden sm:inline">{timeAgo(data.updated_at)}</span>
                            )}
                          </div>

                          {/* Action text */}
                          {data?.metric_action && (
                            <p className="text-[10px] text-[#64748b] mt-1 pl-0">{data.metric_action}</p>
                          )}

                          {/* Missing data info + Create Task */}
                          {(!hasValue) && (
                            <div className="mt-1.5 flex items-start gap-4">
                              <div className="space-y-0.5 flex-1">
                                {data?.blocked_decision && (
                                  <p className="text-[10px] text-[#ef4444]/70">
                                    Decision blocked: {data.blocked_decision}
                                  </p>
                                )}
                                {data?.metric_action && (
                                  <p className="text-[10px] text-[#475569]">Fix: {data.metric_action}</p>
                                )}
                              </div>
                              {METRIC_TASK_MAP[def.id] && (
                                createdTasks.has(def.id) ? (
                                  <span className="text-[10px] text-green-400 flex-shrink-0">Task created</span>
                                ) : (
                                  <button
                                    onClick={() => createTask(def.id)}
                                    className="text-[10px] text-[#00d4d4] hover:underline cursor-pointer flex-shrink-0"
                                  >
                                    → Create Task
                                  </button>
                                )
                              )}
                            </div>
                          )}
                          {/* Poor state also gets Create Task */}
                          {hasValue && displayState === "poor" && METRIC_TASK_MAP[def.id] && !createdTasks.has(def.id) && (
                            <div className="mt-1">
                              <button
                                onClick={() => createTask(def.id)}
                                className="text-[10px] text-[#00d4d4] hover:underline cursor-pointer"
                              >
                                → Create Task to fix
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
