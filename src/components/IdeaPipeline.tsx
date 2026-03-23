"use client";

import { useState } from "react";
import type { Idea } from "@/types";

const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "researching", label: "Researching" },
  { key: "ready", label: "Ready to Build" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
  { key: "killed", label: "Kill/Scale" },
] as const;

const evColors: Record<string, { pill: string; label: string }> = {
  high: { pill: "bg-red-500/15 text-red-400 border-red-500/30", label: "🔴 High" },
  medium: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "🟡 Med" },
  low: { pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "🟢 Low" },
};

export default function IdeaPipeline({ ideas }: { ideas: Idea[] }) {
  const [expanded, setExpanded] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitIdea = async () => {
    if (!newIdea.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newIdea.trim() }),
      });
      setNewIdea("");
    } catch {
      // silent fail
    }
    setSubmitting(false);
  };

  return (
    <section className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <h2 className="text-base font-semibold text-gray-400">💡 Ideas & Pipeline</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
          {ideas.length}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <>
          {/* Quick add */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Drop an idea..."
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitIdea()}
              className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <button
              onClick={submitIdea}
              disabled={submitting || !newIdea.trim()}
              className="px-4 py-2 bg-cyan-600/20 text-cyan-400 text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-600/30 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Kanban columns */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <div className="flex gap-3 min-w-max">
              {stages.map((stage) => {
                const stageIdeas = ideas.filter((i) => i.stage === stage.key);
                return (
                  <div key={stage.key} className="w-[190px] shrink-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        {stage.label}
                      </span>
                      <span className="text-[10px] text-gray-600">{stageIdeas.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 min-h-[60px]">
                      {stageIdeas.map((idea) => {
                        const ev = evColors[idea.ev] || evColors.medium;
                        return (
                          <div key={idea.id} className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/50">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="text-xs font-semibold text-gray-200 leading-tight">{idea.title}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${ev.pill}`}>
                                {ev.label}
                              </span>
                              {idea.daysInStage != null && (
                                <span className="text-[9px] text-gray-600">{idea.daysInStage}d</span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 leading-snug line-clamp-2">{idea.description}</p>
                            {idea.agent && (
                              <div className="text-right mt-1"><span className="text-xs">{idea.agent}</span></div>
                            )}
                          </div>
                        );
                      })}
                      {stageIdeas.length === 0 && (
                        <div className="p-3 rounded-lg border border-dashed border-gray-800 text-center">
                          <span className="text-[10px] text-gray-700">—</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
