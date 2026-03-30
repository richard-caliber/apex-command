"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";

interface Idea {
  id: string;
  name: string;
  stage: "incoming" | "validating" | "ready" | "building" | "live" | "parked";
  niche: string;
  ev: "high" | "medium" | "low";
  buildTime: string;
  owner?: string;
  score?: number;
}

const stages = [
  { key: "incoming", label: "Incoming" },
  { key: "validating", label: "Validating" },
  { key: "ready", label: "Ready to Build" },
  { key: "building", label: "Building" },
  { key: "live", label: "Live" },
  { key: "parked", label: "Parked" },
] as const;

const evStyle: Record<string, { cls: string; label: string }> = {
  high: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "High EV" },
  medium: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/30", label: "Med EV" },
  low: { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "Low EV" },
};

const ownerStyle: Record<string, { emoji: string; cls: string }> = {
  Ginge: { emoji: "👤", cls: "text-cyan-400 bg-cyan-500/10" },
  Atlas: { emoji: "🧭", cls: "text-amber-400 bg-amber-500/10" },
  Darwin: { emoji: "🔄", cls: "text-green-400 bg-green-500/10" },
  Newton: { emoji: "🔬", cls: "text-purple-400 bg-purple-500/10" },
};

const defaultIdeas: Idea[] = [
  { id: "incoming-parliament", name: "Parliament Tracker", stage: "incoming", niche: "Politics/Transparency", ev: "high", buildTime: "3d", owner: "Newton", score: 22 },
  { id: "incoming-gemsnap-v2", name: "GemSnap v2 (Variants)", stage: "incoming", niche: "Gemology", ev: "high", buildTime: "4d", owner: "Ginge", score: 24 },
  { id: "incoming-storyquest-comic", name: "StoryQuest Comic Mode", stage: "incoming", niche: "Kids/Education", ev: "medium", buildTime: "5d", owner: "Darwin", score: 18 },
  { id: "incoming-ig-empire", name: "Multi-Channel IG Empire", stage: "incoming", niche: "Social Media", ev: "high", buildTime: "7d", owner: "Atlas", score: 20 },
  { id: "parked-gunsnap", name: "GunSnap", stage: "parked", niche: "Firearms", ev: "medium", buildTime: "2d", owner: "Ginge" },
  { id: "parked-poolsnap", name: "PoolSnap", stage: "parked", niche: "Leisure", ev: "low", buildTime: "2d", owner: "Ginge" },
  { id: "parked-geopolitics", name: "Geopolitics App", stage: "parked", niche: "News/Politics", ev: "medium", buildTime: "5d", owner: "Newton" },
  { id: "parked-comic", name: "Online Comic Creator", stage: "parked", niche: "Creative tools", ev: "medium", buildTime: "7d", owner: "Ginge" },
  { id: "parked-riz", name: "Riz Dating App", stage: "parked", niche: "Dating", ev: "high", buildTime: "10d", owner: "Ginge" },
  { id: "parked-gingepoker", name: "GingePoker Brand", stage: "parked", niche: "Poker/Brand", ev: "medium", buildTime: "3d", owner: "Ginge" },
];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>(defaultIdeas);
  const [newIdea, setNewIdea] = useState("");
  const dragRef = useRef<Idea | null>(null);

  const addIdea = () => {
    if (!newIdea.trim()) return;
    const idea: Idea = {
      id: `idea-${Date.now()}`,
      name: newIdea.trim(),
      stage: "incoming",
      niche: "TBD",
      ev: "medium",
      buildTime: "?",
      owner: "Ginge",
    };
    setIdeas((prev) => [idea, ...prev]);
    setNewIdea("");
  };

  const handleDragStart = useCallback((_e: React.DragEvent, idea: Idea) => {
    dragRef.current = idea;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.4)";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
    if (dragRef.current && dragRef.current.stage !== targetStage) {
      setIdeas((prev) =>
        prev.map((i) => (i.id === dragRef.current!.id ? { ...i, stage: targetStage as Idea["stage"] } : i))
      );
    }
    dragRef.current = null;
  }, []);

  return (
    <div className="min-h-dvh relative" style={{ background: "#0a0e1a" }}>
      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${8 + Math.random() * 12}s`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center gap-6">
          <h1 className="text-xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
              War Room
            </Link>
            <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
              Pipeline
            </Link>
            <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
              Finance
            </Link>
            <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
              Prompts
            </Link>
            <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
              Squad
            </Link>
            <span className="text-sm text-white font-medium">Ideas</span>
            <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
          </nav>
        </div>
      </header>

      {/* Quick add */}
      <div className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Drop an idea..."
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            className="flex-1 bg-[#111827] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#475569] focus:outline-none focus:border-indigo-500/40"
          />
          <button
            onClick={addIdea}
            disabled={!newIdea.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3 min-w-max">
            {stages.map((stage) => {
              const stageIdeas = ideas.filter((i) => i.stage === stage.key);
              const isParked = stage.key === "parked";
              return (
                <div
                  key={stage.key}
                  className={`w-[240px] shrink-0 ${isParked ? "opacity-60" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                      {stage.label}
                    </span>
                    <span className="text-[10px] text-[#475569] bg-[#1e293b] px-1.5 py-0.5 rounded">
                      {stageIdeas.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 min-h-[120px] p-1.5 rounded-lg border border-transparent transition-colors">
                    {stageIdeas.map((idea) => (
                      <IdeaCard key={idea.id} idea={idea} onDragStart={handleDragStart} />
                    ))}
                    {stageIdeas.length === 0 && (
                      <div className="border border-dashed border-[#1e293b] rounded-lg p-6 text-center">
                        <span className="text-[11px] text-[#334155]">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdeaCard({ idea, onDragStart }: { idea: Idea; onDragStart: (e: React.DragEvent, idea: Idea) => void }) {
  const ev = evStyle[idea.ev] || evStyle.medium;
  const owner = idea.owner ? ownerStyle[idea.owner] : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, idea)}
      className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[#334155] transition-colors"
    >
      <p className="text-sm font-medium text-[#e2e8f0] mb-2">{idea.name}</p>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${ev.cls}`}>{ev.label}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1e293b] text-[#94a3b8]">
          ~{idea.buildTime}
        </span>
        {owner && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${owner.cls}`}>
            {owner.emoji} {idea.owner}
          </span>
        )}
      </div>

      {idea.score && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-12 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${idea.score >= 21 ? "bg-green-500" : idea.score >= 12 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${(idea.score / 30) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-[#475569] font-mono">{idea.score}/30</span>
        </div>
      )}

      <p className="text-[11px] text-[#475569]">{idea.niche}</p>
    </div>
  );
}
