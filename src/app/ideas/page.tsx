"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useDashboard } from "@/lib/data";

const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "validating", label: "Validating" },
  { key: "ready", label: "Ready to Build" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
] as const;

const evConfig: Record<string, { cls: string; label: string }> = {
  high: { cls: "bg-red-500/10 text-red-400 border-red-500/30", label: "🔴 High EV" },
  medium: { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", label: "🟡 Med EV" },
  low: { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "🟢 Low EV" },
};

export default function IdeasPage() {
  const { data } = useDashboard();
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
    } catch { /* */ }
    setSubmitting(false);
  };

  if (!data) {
    return <Shell><div className="flex items-center justify-center h-[60vh]"><span className="text-zinc-500 animate-pulse">Loading...</span></div></Shell>;
  }

  const ideas = data.ideas || [];

  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto space-y-5">
        <h1 className="text-lg font-semibold text-zinc-200">Idea Backlog</h1>

        {/* Quick add */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Drop an idea..."
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitIdea()}
            className="flex-1 bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/40"
          />
          <button
            onClick={submitIdea}
            disabled={submitting || !newIdea.trim()}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 min-w-max">
            {stages.map((stage) => {
              const stageIdeas = ideas.filter((i) => i.stage === stage.key);
              return (
                <div key={stage.key} className="w-[220px] shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{stage.label}</span>
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{stageIdeas.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {stageIdeas.map((idea) => {
                      const ev = evConfig[idea.ev] || evConfig.medium;
                      return (
                        <div key={idea.id} className="bg-[#18181b] border border-[#27272a] rounded-lg p-3">
                          <p className="text-sm font-medium text-zinc-200 mb-1.5">{idea.name}</p>
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${ev.cls}`}>{ev.label}</span>
                            {idea.buildTime && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                ~{idea.buildTime}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500">{idea.niche}</p>
                        </div>
                      );
                    })}
                    {stageIdeas.length === 0 && (
                      <div className="border border-dashed border-[#27272a] rounded-lg p-4 text-center">
                        <span className="text-[11px] text-zinc-700">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
