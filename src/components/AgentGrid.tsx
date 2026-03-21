"use client";

import type { Agent } from "@/types";

const statusColors: Record<string, string> = {
  active: "#10b981",
  idle: "#f59e0b",
  error: "#ef4444",
  paused: "#6b7280",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AgentGrid({ agents }: { agents: Agent[] }) {
  return (
    <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3 px-1">Agents</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => {
          const isActive = agent.status === "active";
          const isPaused = agent.status === "paused";
          return (
            <div
              key={agent.id}
              className={`glass-card p-4 transition-all ${isActive ? "glow-cyan border-cyan-500/30" : ""} ${
                isPaused ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{agent.emoji}</span>
                  <div>
                    <span className="text-sm font-semibold">{agent.name}</span>
                    <p className="text-[10px] text-gray-500">{agent.role}</p>
                  </div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${isActive ? "pulse-active" : ""}`}
                  style={{ backgroundColor: statusColors[agent.status] || statusColors.paused }}
                />
              </div>
              <p className="text-xs text-gray-300 truncate mb-1">{agent.currentTask}</p>
              <p className="text-[10px] text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
                Last seen: {timeAgo(agent.lastSeen)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
