"use client";

import { useState } from "react";
import type { Idea } from "@/types";

const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "researching", label: "Researching" },
  { key: "ready", label: "Ready to Build" },
  { key: "in-progress", label: "In Progress" },
  { key: "launched", label: "Launched" },
  { key: "killed", label: "Killed" },
] as const;

const evColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-amber-500/20 text-amber-400",
  low: "bg-emerald-500/20 text-emerald-400",
};

export default function IdeaPipeline({ ideas }: { ideas: Idea[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      {/* Header — click to toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 px-1 group w-full text-left"
      >
        <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase">
          💡 Idea Pipeline
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          {ideas.length}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="glass-card p-4 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {stages.map((stage) => {
              const stageIdeas = ideas.filter((i) => i.stage === stage.key);
              return (
                <div key={stage.key} className="w-[200px] shrink-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {stage.label}
                    </span>
                    <span className="text-[10px] text-gray-600">{stageIdeas.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2">
                    {stageIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/50"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-xs font-semibold text-gray-200 leading-tight">
                            {idea.title}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${evColors[idea.ev]}`}>
                            {idea.ev.charAt(0).toUpperCase() + idea.ev.slice(1)}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug mb-2 line-clamp-2">
                          {idea.description}
                        </p>
                        {idea.agent && (
                          <div className="text-right">
                            <span className="text-sm">{idea.agent}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {stageIdeas.length === 0 && (
                      <div className="p-3 rounded-lg border border-dashed border-gray-800 text-center">
                        <span className="text-[10px] text-gray-700">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
