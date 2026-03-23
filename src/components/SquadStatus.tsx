"use client";

import type { Agent } from "@/types";

const statusColors: Record<string, string> = {
  active: "#10b981",
  idle: "#f59e0b",
  error: "#ef4444",
  paused: "#4b5563",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SquadStatus({ agents }: { agents: Agent[] }) {
  return (
    <div className="quad-card p-4 h-full flex flex-col animate-fade-in">
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3">Squad Status</h2>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {agents.map((a) => {
          const isActive = a.status === "active";
          return (
            <div
              key={a.id}
              className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                isActive ? "bg-emerald-500/5 border border-emerald-500/15" : "bg-gray-900/30 border border-transparent opacity-45"
              }`}
            >
              <span className="text-lg shrink-0">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-200">{a.name}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "pulse-active" : ""}`}
                    style={{ backgroundColor: statusColors[a.status] || statusColors.paused }}
                  />
                  <span className="text-[9px] text-gray-600 ml-auto" style={{ fontFamily: "var(--font-mono)" }}>
                    {timeAgo(a.lastSeen)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 truncate leading-tight">{a.currentTask}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
