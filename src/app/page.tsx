"use client";

import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import { useDashboard } from "@/lib/data";
import { getAction, daysLive, timeAgo } from "@/lib/utils";
import Link from "next/link";

import TaskList from "@/components/TaskList";
const RevenueChart = dynamic(() => import("@/components/RevenueChart"), { ssr: false });

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-[#18181b] border border-[#27272a] rounded-xl p-4 animate-fade-up ${
        highlight ? "border-red-500/50 animate-flash" : ""
      }`}
    >
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-100" style={{ fontFamily: "var(--font-mono)" }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const statusConfig: Record<string, { emoji: string; label: string; cls: string }> = {
  live: { emoji: "🟢", label: "Live", cls: "text-green-400 bg-green-500/10" },
  building: { emoji: "🔵", label: "Building", cls: "text-blue-400 bg-blue-500/10" },
  paused: { emoji: "⚫", label: "Paused", cls: "text-zinc-400 bg-zinc-500/10" },
  queued: { emoji: "⚪", label: "Queued", cls: "text-zinc-400 bg-zinc-500/10" },
  complete: { emoji: "✅", label: "Complete", cls: "text-green-400 bg-green-500/10" },
};

export default function MissionControl() {
  const { data } = useDashboard();

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

  return (
    <Shell>
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-200">Mission Control</h1>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span style={{ fontFamily: "var(--font-mono)" }}>Updated {timeAgo(data.lastUpdated)}</span>
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-green" />
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total MRR" value={`£${portfolio.totalMRR}`} sub={`Target: £${portfolio.target.toLocaleString()}/mo`} />
          <StatCard label="Live Apps" value={portfolio.liveApps} />
          <StatCard label="Building" value={portfolio.buildingApps} />
          <StatCard
            label="Decisions Needed"
            value={decisions.length}
            highlight={decisions.length > 0}
          />
        </div>

        {/* Revenue chart */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Revenue (30d)</h2>
          <RevenueChart data={revenueHistory} />
        </div>

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
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-3 py-2">Status</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2">MRR</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden sm:table-cell">DAU</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden sm:table-cell">Conv%</th>
                  <th className="text-right text-[11px] text-zinc-500 font-medium px-3 py-2 hidden md:table-cell">Days Live</th>
                  <th className="text-left text-[11px] text-zinc-500 font-medium px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const s = statusConfig[app.status] || statusConfig.paused;
                  const action = getAction(app.status, app.launchDate, app.mrr);
                  const days = daysLive(app.launchDate);
                  return (
                    <tr key={app.id} className="border-b border-[#27272a]/50 hover:bg-[#1f1f24] transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/apps/${app.id}`} className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                          <span className="text-base">{app.icon}</span>
                          <span className="font-medium text-zinc-200">{app.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.cls}`}>
                          {s.emoji} {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-300">£{app.mrr}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden sm:table-cell">{app.dau}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden sm:table-cell">{app.conversionRate}%</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-zinc-400 hidden md:table-cell">
                        {days !== null ? days : "—"}
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
          {/* Activity */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Activity Feed</h2>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {activity.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-zinc-600 shrink-0 w-[52px]" style={{ fontFamily: "var(--font-mono)" }}>
                    {new Date(e.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                  <span className="text-zinc-400">{e.event}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decisions Needed */}
          <div className={`bg-[#18181b] border rounded-xl p-4 ${decisions.length > 0 ? "border-red-500/30" : "border-[#27272a]"}`}>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Decisions Needed {decisions.length > 0 && <span className="text-red-400 ml-1">({decisions.length})</span>}
            </h2>
            {decisions.length === 0 ? (
              <p className="text-xs text-zinc-600">No decisions needed right now.</p>
            ) : (
              <div className="space-y-3">
                {decisions.map((app) => {
                  const days = daysLive(app.launchDate);
                  return (
                    <div key={app.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{app.icon}</span>
                        <span className="text-sm font-medium text-zinc-200">{app.name}</span>
                        <span className="text-[10px] text-zinc-500">{days}d live / £{app.mrr} MRR</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {["Kill", "Pivot", "Scale", "Wait"].map((action) => (
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
