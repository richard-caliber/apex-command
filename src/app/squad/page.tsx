"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Capability {
  name: string;
  detail: string;
}

interface Bot {
  emoji: string;
  name: string;
  role: string;
  capabilities: Capability[];
  status: string;
}

interface UpcomingItem {
  status: "blocked" | "in-progress" | "ready";
  name: string;
  unlocks: string;
  owner: string;
}

interface SquadData {
  bots: Bot[];
  upcoming: UpcomingItem[];
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; color: string; bg: string; border: string }> = {
  blocked: { label: "BLOCKED", dot: "bg-red-500", color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/30" },
  "in-progress": { label: "IN PROGRESS", dot: "bg-amber-500 animate-pulse", color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/30" },
  ready: { label: "READY TO ACTIVATE", dot: "bg-green-500", color: "text-green-400", bg: "bg-green-500/5", border: "border-green-500/30" },
};

export default function SquadPage() {
  const [data, setData] = useState<SquadData | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/squad");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  const blocked = data?.upcoming.filter((u) => u.status === "blocked") || [];
  const inProgress = data?.upcoming.filter((u) => u.status === "in-progress") || [];
  const ready = data?.upcoming.filter((u) => u.status === "ready") || [];

  return (
    <div className="min-h-dvh relative">
      <Particles />

      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Pipeline</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompts</Link>
              <span className="text-sm text-white font-medium">Squad</span>
              <Link href="/ideas" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Ideas</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2">
              <span className="refresh-dot" />
              <span className="text-xs">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!data ? (
          <div className="text-center text-[#64748b] text-lg py-20">Loading squad data...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: What We Can Do Now */}
            <div>
              <h2 className="text-lg font-bold text-[#f1f5f9] mb-6 uppercase tracking-wider">What We Can Do Now</h2>
              <div className="space-y-5">
                {data.bots.map((bot) => (
                  <div key={bot.name} className="rounded-xl bg-[#111827] border border-[#1e293b] p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{bot.emoji}</span>
                      <div>
                        <h3 className="text-sm font-bold text-[#f1f5f9]">{bot.name}</h3>
                        <span className="text-xs text-[#64748b]">{bot.role}</span>
                      </div>
                    </div>
                    <ul className="space-y-2 mb-4">
                      {bot.capabilities.map((cap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                          <span className="text-[#cbd5e1]">
                            {cap.name}
                            {cap.detail && <span className="text-[#64748b]"> ({cap.detail})</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">{bot.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: What's Coming Next */}
            <div>
              <h2 className="text-lg font-bold text-[#f1f5f9] mb-6 uppercase tracking-wider">What&apos;s Coming Next</h2>
              <div className="space-y-6">
                {/* Blocked */}
                {blocked.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Blocked (needs Ginge)
                    </h3>
                    <div className="space-y-3">
                      {blocked.map((item, i) => (
                        <UpcomingCard key={i} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {/* In Progress */}
                {inProgress.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      In Progress
                    </h3>
                    <div className="space-y-3">
                      {inProgress.map((item, i) => (
                        <UpcomingCard key={i} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Ready */}
                {ready.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      Ready to Activate
                    </h3>
                    <div className="space-y-3">
                      {ready.map((item, i) => (
                        <UpcomingCard key={i} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function UpcomingCard({ item }: { item: UpcomingItem }) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#f1f5f9]">{item.name}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{item.unlocks}</div>
        </div>
        <span className="text-base flex-shrink-0" title="Owner">{item.owner}</span>
      </div>
    </div>
  );
}

function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
        />
      ))}
    </div>
  );
}
