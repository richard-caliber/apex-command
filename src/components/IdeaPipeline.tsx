"use client";

import { useState } from "react";
import type { Idea } from "@/types";

const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "researching", label: "Researching" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
  { key: "killed", label: "Killed" },
] as const;

const evConfig: Record<string, { pill: string; label: string }> = {
  high: { pill: "bg-red-500/15 text-red-400 border-red-500/30", label: "🔴 High" },
  medium: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "🟡 Med" },
  low: { pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "🟢 Low" },
};

export default function IdeaPipeline({ ideas }: { ideas: Idea[] }) {
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
    } catch { /* silent */ }
    setSubmitting(false);
  };

  return (
    <div className="quad-card p-4 h-full flex flex-col animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-2">Ideas & Pipeline</h2>

      {/* Quick add */}
      <div className="flex gap-1.5 mb-3">
        <input
          type="text"
          placeholder="Drop an idea..."
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitIdea()}
          className="flex-1 bg-gray-900/50 border border-gray-700/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
        />
        <button
          onClick={submitIdea}
          disabled={submitting || !newIdea.trim()}
          className="px-3 py-1.5 bg-cyan-600/15 text-cyan-400 text-xs rounded-lg border border-cyan-500/25 hover:bg-cyan-600/25 transition-colors disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-2 min-w-max h-full">
          {stages.map((stage) => {
            const stageIdeas = ideas.filter((i) => i.stage === stage.key);
            return (
              <div key={stage.key} className="w-[160px] shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider">{stage.label}</span>
                  <span className="text-[9px] text-gray-700">{stageIdeas.length}</span>
                </div>
                <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
                  {stageIdeas.map((idea) => {
                    const ev = evConfig[idea.ev] || evConfig.medium;
                    return (
                      <div key={idea.id} className="p-2 rounded-lg bg-gray-900/50 border border-gray-800/40">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-[11px] font-semibold text-gray-300 leading-tight">{idea.title}</span>
                          {idea.agent && <span className="text-xs shrink-0">{idea.agent}</span>}
                        </div>
                        <span className={`inline-block text-[8px] px-1 py-0.5 rounded border ${ev.pill} mb-1`}>
                          {ev.label}
                        </span>
                        <p className="text-[9px] text-gray-600 leading-snug line-clamp-2">{idea.description}</p>
                      </div>
                    );
                  })}
                  {stageIdeas.length === 0 && (
                    <div className="p-2 rounded-lg border border-dashed border-gray-800/50 text-center">
                      <span className="text-[9px] text-gray-700">—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
