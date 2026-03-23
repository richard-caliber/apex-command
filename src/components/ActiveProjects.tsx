"use client";

import type { Project } from "@/types";

const statusConfig: Record<string, { emoji: string; label: string; color: string }> = {
  live: { emoji: "🟢", label: "Live", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  building: { emoji: "🟡", label: "Building", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  blocked: { emoji: "🔴", label: "Blocked", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  paused: { emoji: "⚫", label: "Paused", color: "text-gray-400 bg-gray-500/10 border-gray-500/30" },
  complete: { emoji: "✅", label: "Complete", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  idea: { emoji: "💡", label: "Idea", color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
};

const progressBarColor: Record<string, string> = {
  live: "bg-emerald-500",
  building: "bg-amber-500",
  blocked: "bg-red-500",
  paused: "bg-gray-500",
  complete: "bg-emerald-500",
  idea: "bg-purple-500",
};

function daysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export default function ActiveProjects({ projects }: { projects: Project[] }) {
  return (
    <div className="quad-card p-4 h-full flex flex-col animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">Active Projects</h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {projects.map((p) => {
          const s = statusConfig[p.status] || statusConfig.paused;
          const mrrPct = p.targetMRR > 0 ? (p.mrr / p.targetMRR) * 100 : 0;
          return (
            <div key={p.name} className="p-2.5 rounded-lg bg-gray-900/40 border border-gray-800/40">
              {/* Row 1: name + status + progress */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{p.icon}</span>
                <span className="text-xs font-semibold text-gray-200 flex-1">{p.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${s.color}`}>
                  {s.emoji} {s.label}
                </span>
              </div>

              {/* Launch progress bar */}
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${progressBarColor[p.status] || "bg-gray-500"} animate-bar`}
                  style={{ width: `${p.progress}%` }}
                />
              </div>

              {/* Row 2: MRR + activity + next action */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-cyan-400 font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                  £{p.mrr}
                </span>
                <span className="text-gray-600">/</span>
                <span className="text-gray-500" style={{ fontFamily: "var(--font-mono)" }}>
                  £{p.targetMRR.toLocaleString()}
                </span>

                {/* MRR mini bar */}
                <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500/60 rounded-full"
                    style={{ width: `${Math.max(mrrPct, mrrPct > 0 ? 5 : 0)}%` }}
                  />
                </div>

                <span className="text-gray-600 ml-auto">{daysAgo(p.lastActivity)}</span>
              </div>

              {/* Next action */}
              <p className="text-[10px] text-gray-500 mt-1 truncate">→ {p.nextAction}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
