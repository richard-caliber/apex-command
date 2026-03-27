"use client";

import { useState, useCallback, useRef } from "react";
import Shell from "@/components/Shell";
import { useDashboard } from "@/lib/data";
import type { Idea } from "@/types";

/* ── Stages including Parked ── */
const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "validating", label: "Validating" },
  { key: "ready", label: "Ready to Build" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
  { key: "parked", label: "Parked" },
] as const;

/* ── Fixed EV colours: Gold = High, Blue = Medium, Green = Low ── */
const evConfig: Record<string, { cls: string; label: string }> = {
  high: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "🟡 High EV" },
  medium: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/30", label: "🔵 Med EV" },
  low: { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "🟢 Low EV" },
};

/* ── Owner avatars ── */
const ownerConfig: Record<string, { emoji: string; color: string }> = {
  Ginge: { emoji: "👤", color: "text-cyan-400 bg-cyan-500/10" },
  Newton: { emoji: "🔬", color: "text-purple-400 bg-purple-500/10" },
  Darwin: { emoji: "🧬", color: "text-green-400 bg-green-500/10" },
  Atlas: { emoji: "🗺️", color: "text-amber-400 bg-amber-500/10" },
  Jimmy: { emoji: "🎯", color: "text-red-400 bg-red-500/10" },
};

/* ── Default ideas to pre-populate ── */
const defaultParked: Idea[] = [
  { id: "parked-gunsnap", name: "GunSnap", stage: "parked", niche: "Firearms", ev: "medium", buildTime: "2d", owner: "Ginge" },
  { id: "parked-poolsnap", name: "PoolSnap", stage: "parked", niche: "Leisure", ev: "low", buildTime: "2d", owner: "Ginge" },
  { id: "parked-geopolitics", name: "Geopolitics App", stage: "parked", niche: "News/Politics", ev: "medium", buildTime: "5d", owner: "Newton" },
  { id: "parked-comic", name: "Online Comic Creator", stage: "parked", niche: "Creative tools", ev: "medium", buildTime: "7d", owner: "Ginge" },
  { id: "parked-riz", name: "Riz Dating App", stage: "parked", niche: "Dating", ev: "high", buildTime: "10d", owner: "Ginge" },
  { id: "parked-gingepoker", name: "GingePoker Brand", stage: "parked", niche: "Poker/Brand", ev: "medium", buildTime: "3d", owner: "Ginge" },
];

const defaultIncoming: Idea[] = [
  { id: "incoming-parliament", name: "Parliament Tracker", stage: "incoming", niche: "Politics/Transparency", ev: "high", buildTime: "3d", owner: "Newton", score: 22, researchLink: "/workspace-edge-research/research/" },
  { id: "incoming-gemsnap-v2", name: "GemSnap v2 (Variants)", stage: "incoming", niche: "Gemology", ev: "high", buildTime: "4d", owner: "Ginge", score: 24 },
  { id: "incoming-storyquest-comic", name: "StoryQuest Comic Mode", stage: "incoming", niche: "Kids/Education", ev: "medium", buildTime: "5d", owner: "Darwin", score: 18 },
  { id: "incoming-ig-empire", name: "Multi-Channel IG Empire", stage: "incoming", niche: "Social Media", ev: "high", buildTime: "7d", owner: "Atlas", score: 20 },
];

/* ── Score bar component ── */
function ScoreBar({ score, max = 30 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-zinc-500 font-mono">{score}/{max}</span>
    </div>
  );
}

/* ── Score detail popup ── */
function ScoreDetail({ idea }: { idea: Idea }) {
  const breakdown = idea.scoreBreakdown || [
    { label: "Market Size", value: 4 },
    { label: "Urgency", value: 3 },
    { label: "Monetisation", value: 4 },
    { label: "Build Speed", value: 4 },
    { label: "Differentiation", value: 3 },
    { label: "Founder Fit", value: 4 },
  ];
  return (
    <div className="mt-2 p-2 bg-zinc-900 rounded-lg space-y-1">
      {breakdown.map((b) => (
        <div key={b.label} className="flex items-center justify-between text-[9px]">
          <span className="text-zinc-500">{b.label}</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(b.value / 5) * 100}%` }} />
            </div>
            <span className="text-zinc-400 font-mono w-3 text-right">{b.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Idea Card ── */
function IdeaCard({ idea, onDragStart }: { idea: Idea; onDragStart: (e: React.DragEvent, idea: Idea) => void }) {
  const [showScore, setShowScore] = useState(false);
  const ev = evConfig[idea.ev] || evConfig.medium;
  const owner = idea.owner ? ownerConfig[idea.owner] || { emoji: "👤", color: "text-zinc-400 bg-zinc-500/10" } : null;
  const isParked = idea.stage === "parked";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, idea)}
      className={`bg-[#18181b] border border-[#27272a] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition-colors ${
        isParked ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium text-zinc-200 mb-1.5">{idea.name}</p>
        {idea.researchLink && (
          <span className="text-[11px] cursor-pointer" title="Research available">📄</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${ev.cls}`}>{ev.label}</span>
        {idea.buildTime && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            ~{idea.buildTime}
          </span>
        )}
        {owner && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${owner.color}`}>
            {owner.emoji} {idea.owner}
          </span>
        )}
      </div>

      {/* Score */}
      {idea.score && (
        <div className="mb-1.5">
          <button onClick={() => setShowScore(!showScore)} className="hover:opacity-80 transition-opacity">
            <ScoreBar score={idea.score} />
          </button>
          {showScore && <ScoreDetail idea={idea} />}
        </div>
      )}

      <p className="text-[11px] text-zinc-500">{idea.niche}</p>

      {/* Blocker */}
      {idea.blocker && (
        <div className="mt-1.5 px-2 py-1 bg-red-500/5 border border-red-500/20 rounded text-[9px] text-red-400">
          🚫 {idea.blocker}
        </div>
      )}
    </div>
  );
}

export default function IdeasPage() {
  const { data } = useDashboard();
  const [newIdea, setNewIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localMoves, setLocalMoves] = useState<Record<string, string>>({});
  const dragIdea = useRef<Idea | null>(null);

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

  const handleDragStart = useCallback((_e: React.DragEvent, idea: Idea) => {
    dragIdea.current = idea;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-cyan-500/40");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-cyan-500/40");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-cyan-500/40");
    if (dragIdea.current && dragIdea.current.stage !== targetStage) {
      setLocalMoves((prev) => ({ ...prev, [dragIdea.current!.id]: targetStage }));
    }
    dragIdea.current = null;
  }, []);

  if (!data) {
    return <Shell><div className="flex items-center justify-center h-[60vh]"><span className="text-zinc-500 animate-pulse">Loading...</span></div></Shell>;
  }

  // Merge API ideas with defaults (avoid duplicates by id)
  const apiIdeas = data.ideas || [];
  const apiIds = new Set(apiIdeas.map((i) => i.id));
  const allDefaults = [...defaultIncoming, ...defaultParked].filter((d) => !apiIds.has(d.id));
  const allIdeas: Idea[] = [...apiIdeas, ...allDefaults].map((idea) => ({
    ...idea,
    stage: (localMoves[idea.id] || idea.stage) as Idea["stage"],
  }));

  return (
    <Shell>
      <div className="max-w-[1200px] mx-auto space-y-5">
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
              const stageIdeas = allIdeas.filter((i) => i.stage === stage.key);
              const isParked = stage.key === "parked";
              return (
                <div
                  key={stage.key}
                  className={`w-[230px] shrink-0 ${isParked ? "opacity-60" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${isParked ? "text-zinc-600" : "text-zinc-500"}`}>
                      {stage.label}
                    </span>
                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">{stageIdeas.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 min-h-[100px] p-1 rounded-lg border border-transparent transition-colors">
                    {stageIdeas.map((idea) => (
                      <IdeaCard key={idea.id} idea={idea} onDragStart={handleDragStart} />
                    ))}
                    {stageIdeas.length === 0 && (
                      <div className="border border-dashed border-[#27272a] rounded-lg p-4 text-center">
                        <span className="text-[11px] text-zinc-700">{isParked ? "Nothing parked" : "Empty"}</span>
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
