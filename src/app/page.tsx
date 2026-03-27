"use client";

import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import { useDashboard } from "@/lib/data";
import { getAction, daysLive, timeAgo, getHealthColor, emptyStateText, daysSinceActivity } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

import TaskList from "@/components/TaskList";
const RevenueChart = dynamic(() => import("@/components/RevenueChart"), { ssr: false });

/* ── Trend indicator (ready for live delta data) ── */
function TrendBadge({ delta, suffix }: { delta?: number; suffix?: string }) {
  if (delta === undefined || delta === null) return null;
  const up = delta >= 0;
  return (
    <span className={`text-[10px] font-mono ml-1.5 ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? "↑" : "↓"}{Math.abs(delta)}{suffix || ""}
    </span>
  );
}

/* ── Stat card with trend + empty states ── */
function StatCard({
  label,
  value,
  sub,
  highlight,
  delta,
  deltaSuffix,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  delta?: number;
  deltaSuffix?: string;
}) {
  const empty = emptyStateText(label, typeof value === "string" ? parseInt(value.replace(/[^0-9]/g, "")) || 0 : value);
  const isZero = (typeof value === "number" && value === 0) || value === "£0";

  return (
    <div
      className={`bg-[#18181b] border border-[#27272a] rounded-xl p-4 animate-fade-up ${
        highlight ? "border-red-500/50 animate-flash" : ""
      }`}
    >
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="flex items-baseline">
        <p className="text-2xl font-bold text-zinc-100" style={{ fontFamily: "var(--font-mono)" }}>
          {value}
        </p>
        <TrendBadge delta={delta} suffix={deltaSuffix} />
      </div>
      {isZero && empty ? (
        <p className="text-[11px] text-zinc-500 mt-0.5">{empty}</p>
      ) : (
        sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

/* ── Progress bar ── */
function RevenueProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const displayPct = Math.round(pct * 10) / 10;

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 animate-fade-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Revenue Target</span>
        <span className="text-xs text-zinc-400" style={{ fontFamily: "var(--font-mono)" }}>
          {current === 0 ? (
            <span className="text-zinc-500">No revenue yet — first sale incoming 🎯</span>
          ) : (
            `£${current.toLocaleString()} / £${(target / 1000).toFixed(0)}K`
          )}
        </span>
      </div>
      <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
          style={{
            width: `${Math.max(pct, current > 0 ? 2 : 0.5)}%`,
            background: "linear-gradient(90deg, #06b6d4, #22d3ee)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      <p className="text-center text-sm font-bold mt-2" style={{ fontFamily: "var(--font-mono)" }}>
        <span className="text-cyan-400">{displayPct}%</span>
        <span className="text-zinc-500 text-xs ml-1">of £{(target / 1000).toFixed(0)}K target</span>
      </p>
    </div>
  );
}

/* ── Status config ── */
const statusConfig: Record<string, { emoji: string; label: string; cls: string }> = {
  live: { emoji: "🟢", label: "Live", cls: "text-green-400 bg-green-500/10" },
  building: { emoji: "🔵", label: "Building", cls: "text-blue-400 bg-blue-500/10" },
  paused: { emoji: "⚫", label: "Paused", cls: "text-zinc-400 bg-zinc-500/10" },
  queued: { emoji: "⚪", label: "Queued", cls: "text-zinc-400 bg-zinc-500/10" },
  complete: { emoji: "✅", label: "Complete", cls: "text-green-400 bg-green-500/10" },
};

/* ── Activity filter tabs ── */
const feedFilters = ["All", "Ginge", "Atlas", "Darwin", "Newton", "Elon", "Warren"];

export default function MissionControl() {
  const { data, isValidating, mutate } = useDashboard();
  const [feedFilter, setFeedFilter] = useState("All");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [resolvedDecisions, setResolvedDecisions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("apex-resolved-decisions");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const persistResolved = useCallback((next: Set<string>) => {
    setResolvedDecisions(next);
    localStorage.setItem("apex-resolved-decisions", JSON.stringify([...next]));
  }, []);

  // Auto-refresh indicator
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (isValidating) {
      setRefreshing(true);
      const t = setTimeout(() => setRefreshing(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isValidating]);

  if (!data) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-[60vh]">
          <span className="text-zinc-500 animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const apps = data.apps || [];
  const portfolio = data.portfolio || { totalMRR: 0, target: 10000, liveApps: 0, buildingApps: 0 };
  const revenueHistory = data.revenueHistory || [];
  const activity = data.activity || [];

  const decisions = apps.filter((a) => {
    const action = getAction(a.status, a.launchDate, a.mrr);
    return action.label === "Kill?";
  });

  const activeDecisions = decisions.filter((d) => !resolvedDecisions.has(d.id));

  // Filter activity feed
  const filteredActivity = feedFilter === "All"
    ? activity
    : activity.filter((e) => e.event.toLowerCase().includes(feedFilter.toLowerCase()));

  return (
    <Shell>
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-200">Mission Control</h1>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            {refreshing && (
              <svg className="w-3 h-3 animate-spin text-cyan-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            )}
            <span style={{ fontFamily: "var(--font-mono)" }}>Updated {timeAgo(data.lastUpdated)}</span>
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-green" />
            <button
              onClick={() => mutate()}
              className="text-zinc-600 hover:text-cyan-400 transition-colors ml-1"
              title="Refresh now"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Top stats — 2×2 on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total MRR" value={`£${portfolio.totalMRR}`} sub={`Target: £${portfolio.target.toLocaleString()}/mo`} delta={0} deltaSuffix="" />
          <StatCard label="Live Apps" value={portfolio.liveApps} delta={0} />
          <StatCard label="Building" value={portfolio.buildingApps} delta={0} />
          <StatCard
            label="Decisions Needed"
            value={activeDecisions.length}
            highlight={activeDecisions.length > 0}
            delta={0}
          />
        </div>

        {/* Revenue Progress Bar — #1 priority */}
        <RevenueProgressBar current={portfolio.totalMRR} target={portfolio.target} />

        {/* Revenue chart */}
        <RevenueChart data={revenueHistory} />

        {/* Today's Tasks */}
        {data.tasksByProject && data.tasksByProject.length > 0 ? (
          <TaskList tasksByProject={data.tasksByProject} />
        ) : (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <h2 className="text-base font-semibold text-zinc-200 mb-2">📋 Today&apos;s Tasks</h2>
            <p className="text-sm text-zinc-500">No tasks yet — ask Atlas for today&apos;s list</p>
          </div>
        )}

        {/* App Portfolio Table */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">App Portfolio</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-4 py-2">App</th>
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-3 py-2">Health</th>
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-3 py-2">Status</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2">MRR</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden sm:table-cell">DAU</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden sm:table-cell">Conv%</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden md:table-cell">Days Live</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden md:table-cell">Last Activity</th>
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const s = statusConfig[app.status] || statusConfig.paused;
                  const action = getAction(app.status, app.launchDate, app.mrr);
                  const days = daysLive(app.launchDate);
                  const health = getHealthColor(app.status, app.mrr);
                  const lastAct = daysSinceActivity(app.name, activity);
                  const isExpanded = expandedApp === app.id;

                  return (
                    <tr key={app.id} className="border-b border-[#27272a]/50 hover:bg-[#1f1f24] transition-colors group">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                          className="flex items-center gap-2 hover:text-cyan-400 transition-colors text-left"
                        >
                          <span className="text-base">{app.icon}</span>
                          <span className="font-medium text-zinc-200">{app.name}</span>
                          <svg
                            className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {/* Expandable detail panel */}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-zinc-900/50 rounded-lg text-xs space-y-1 animate-fade-up">
                            <p className="text-zinc-400"><span className="text-zinc-600">Pricing:</span> {app.pricing || "—"}</p>
                            <p className="text-zinc-400"><span className="text-zinc-600">Stack:</span> {app.techStack || "—"}</p>
                            <p className="text-zinc-400"><span className="text-zinc-600">Notes:</span> {app.notes || "—"}</p>
                            <Link href={`/apps/${app.id}`} className="text-cyan-400 hover:underline inline-block mt-1">
                              Full details →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                          <span className="text-[10px] text-zinc-500">{health.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.cls}`}>
                          {s.emoji} {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-300">
                        {app.mrr === 0 ? <span className="text-zinc-600">—</span> : `£${app.mrr}`}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden sm:table-cell">
                        {app.dau === 0 ? <span className="text-zinc-600">—</span> : app.dau}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden sm:table-cell">
                        {app.conversionRate === 0 ? <span className="text-zinc-600">—</span> : `${app.conversionRate}%`}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden md:table-cell">
                        {days !== null ? days : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs hidden md:table-cell">
                        {lastAct !== null ? (
                          <span className={lastAct > 7 ? "text-amber-400" : "text-zinc-400"}>{lastAct}d ago</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${action.color}`}>
                          {action.emoji} {action.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed + Decisions Needed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Activity Feed with filters */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Activity Feed</h2>
            {/* Filter tabs */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
              {feedFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFeedFilter(f)}
                  className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                    feedFilter === f
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {filteredActivity.length === 0 ? (
                <p className="text-xs text-zinc-600">No activity for {feedFilter}</p>
              ) : (
                filteredActivity.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-600 shrink-0 w-[52px]" style={{ fontFamily: "var(--font-mono)" }}>
                      {new Date(e.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span className="text-zinc-400">{e.event}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Decisions Needed — actionable */}
          <div className={`bg-[#18181b] border rounded-xl p-4 ${activeDecisions.length > 0 ? "border-red-500/30" : "border-[#27272a]"}`}>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Decisions Needed {activeDecisions.length > 0 && <span className="text-red-400 ml-1">({activeDecisions.length})</span>}
            </h2>
            {activeDecisions.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <span className="text-green-400 text-lg">✅</span>
                <span className="text-green-400 text-sm font-medium">All clear — keep shipping</span>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDecisions.map((app) => {
                  const days = daysLive(app.launchDate);
                  return (
                    <div key={app.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{app.icon}</span>
                        <span className="text-sm font-medium text-zinc-200">{app.name}</span>
                        <span className="text-[10px] text-zinc-500">{days}d live / £{app.mrr} MRR</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mb-2">
                        Blocking: Next sprint planning
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            const next = new Set(resolvedDecisions);
                            next.add(app.id);
                            persistResolved(next);
                          }}
                          className="text-[10px] px-2.5 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                        >
                          Mark Resolved
                        </button>
                        <button className="text-[10px] px-2.5 py-1 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors">
                          Decide Later
                        </button>
                        {["Kill", "Pivot", "Scale"].map((action) => (
                          <button
                            key={action}
                            className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                              action === "Kill"
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : action === "Scale"
                                ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            }`}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
