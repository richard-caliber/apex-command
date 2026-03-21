"use client";

import type { Project } from "@/types";

const borderColors: Record<string, string> = {
  "on-track": "#10b981",
  attention: "#f59e0b",
  blocked: "#ef4444",
  paused: "#6b7280",
};

const barColors: Record<string, string> = {
  "on-track": "bg-emerald-500",
  attention: "bg-amber-500",
  blocked: "bg-red-500",
  paused: "bg-gray-500",
};

export default function ProjectCards({ projects }: { projects: Project[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase px-1">Projects</h2>
      {projects.map((p) => (
        <div
          key={p.codename}
          className="glass-card p-4"
          style={{ borderLeft: `3px solid ${borderColors[p.status] || borderColors.paused}` }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold tracking-wider text-cyan-400">{p.codename}</span>
            <span className="text-[10px] text-gray-500">{p.stage}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-800 rounded-full mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${barColors[p.status] || barColors.paused}`}
              style={{ width: `${p.progress}%`, transition: "width 0.5s ease" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 truncate mr-2">{p.lastAction}</span>
            <span className="text-[10px] font-mono text-gray-500">{p.progress}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
