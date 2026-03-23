"use client";

import { use } from "react";
import Shell from "@/components/Shell";
import { useDashboard } from "@/lib/data";
import { getAction, daysLive } from "@/lib/utils";
import Link from "next/link";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-zinc-100" style={{ fontFamily: "var(--font-mono)" }}>{value}</p>
    </div>
  );
}

export default function AppDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useDashboard();

  if (!data) {
    return <Shell><div className="flex items-center justify-center h-[60vh]"><span className="text-zinc-500 animate-pulse">Loading...</span></div></Shell>;
  }

  const app = data.apps.find((a) => a.id === id);
  if (!app) {
    return <Shell><div className="text-center py-20"><p className="text-zinc-500">App not found</p><Link href="/" className="text-cyan-400 text-sm mt-2 inline-block">Back to Mission Control</Link></div></Shell>;
  }

  const days = daysLive(app.launchDate);
  const action = getAction(app.status, app.launchDate, app.mrr);

  return (
    <Shell>
      <div className="max-w-[900px] mx-auto space-y-6">
        {/* Back + header */}
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors">← Back</Link>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl">{app.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">{app.name}</h1>
              {app.url && <p className="text-xs text-zinc-500">{app.url}</p>}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ml-auto ${action.color}`}>
              {action.emoji} {action.label}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="MRR" value={`£${app.mrr}`} />
          <StatCard label="DAU" value={app.dau} />
          <StatCard label="Conv%" value={`${app.conversionRate}%`} />
          <StatCard label="Days Live" value={days ?? "—"} />
        </div>

        {/* MRR target progress */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">MRR Progress</span>
            <span className="text-xs text-zinc-400" style={{ fontFamily: "var(--font-mono)" }}>
              £{app.mrr} / £{app.targetMRR.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: `${app.targetMRR > 0 ? Math.max((app.mrr / app.targetMRR) * 100, app.mrr > 0 ? 2 : 0.5) : 0}%` }}
            />
          </div>
        </div>

        {/* App Info */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">App Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-zinc-500 text-xs">Pricing</span><p className="text-zinc-300 mt-0.5">{app.pricing || "—"}</p></div>
            <div><span className="text-zinc-500 text-xs">Tech Stack</span><p className="text-zinc-300 mt-0.5">{app.techStack || "—"}</p></div>
            <div><span className="text-zinc-500 text-xs">Launch Date</span><p className="text-zinc-300 mt-0.5">{app.launchDate || "Not launched"}</p></div>
            <div><span className="text-zinc-500 text-xs">Competitors</span><p className="text-zinc-300 mt-0.5">{app.competitors || "—"}</p></div>
          </div>
          <div><span className="text-zinc-500 text-xs">Notes</span><p className="text-zinc-300 mt-0.5 text-sm">{app.notes || "—"}</p></div>
        </div>

        {/* Decision Log */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Decision Log</h2>
            <button className="text-[11px] px-3 py-1 bg-cyan-600/15 text-cyan-400 rounded-lg border border-cyan-500/25 hover:bg-cyan-600/25 transition-colors">
              Record Decision
            </button>
          </div>
          {app.decisions.length === 0 ? (
            <p className="text-xs text-zinc-600">No decisions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {app.decisions.map((d, i) => (
                <div key={i} className="p-2 bg-zinc-900/50 rounded-lg text-xs">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-zinc-400 font-mono">{d.date}</span>
                    <span className="font-medium text-zinc-200">{d.action}</span>
                  </div>
                  <p className="text-zinc-500">{d.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
