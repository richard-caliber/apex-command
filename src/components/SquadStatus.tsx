"use client";

import { useState } from "react";
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
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SquadStatus({ agents }: { agents: Agent[] }) {
  const [expanded, setExpanded] = useState(false);

  const active = agents.filter((a) => a.status === "active");
  const paused = agents.filter((a) => a.status !== "active");

  return (
    <section className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <h2 className="text-base font-semibold text-gray-400">🤖 Squad Status</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
          {active.length}/{agents.length} active
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-2">
          {active.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800/50">
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-200">{a.name}</span>
                  <span className="text-[10px] text-gray-500">{a.role}</span>
                  <span
                    className="w-2 h-2 rounded-full pulse-active"
                    style={{ backgroundColor: statusColors[a.status] }}
                  />
                </div>
                <p className="text-xs text-gray-400 truncate">{a.currentTask}</p>
              </div>
              <span className="text-[10px] text-gray-600 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                {timeAgo(a.lastSeen)}
              </span>
            </div>
          ))}
          {paused.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {paused.map((a) => (
                <div key={a.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900/20 border border-gray-800/30 opacity-50">
                  <span className="text-sm">{a.emoji}</span>
                  <span className="text-xs text-gray-500">{a.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
