"use client";

import { useEffect, useState } from "react";

interface TopBarProps {
  systemStatus: string;
  lastUpdated: string;
  demoMode: boolean;
  onToggleDemo: () => void;
}

export default function TopBar({ systemStatus, lastUpdated, demoMode, onToggleDemo }: TopBarProps) {
  const [time, setTime] = useState("");
  const [updatedAgo, setUpdatedAgo] = useState("");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleString("en-GB", {
          timeZone: "Asia/Manila",
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
      if (lastUpdated) {
        const diff = Math.floor((now.getTime() - new Date(lastUpdated).getTime()) / 60000);
        if (diff < 1) setUpdatedAgo("Just now");
        else if (diff < 60) setUpdatedAgo(`${diff}m ago`);
        else setUpdatedAgo(`${Math.floor(diff / 60)}h ago`);
        setStale(diff > 60);
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <header className="flex items-center justify-between px-2 py-3 mb-4">
      <div className="flex items-center gap-2.5">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="shrink-0">
          <path d="M14 3L26 25H2L14 3Z" stroke="#06b6d4" strokeWidth="2" fill="none" />
          <path d="M14 10L20 22H8L14 10Z" fill="#06b6d4" opacity="0.3" />
        </svg>
        <h1 className="text-sm font-semibold tracking-widest text-gray-300">APEX COMMAND CENTRE</h1>
      </div>
      <div className="flex items-center gap-3">
        {stale && <span className="text-[10px] text-amber-400 font-medium">STALE</span>}
        <span className="text-[10px] text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
          {updatedAgo}
        </span>
        {systemStatus === "operational" && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 pulse-active" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        <span className="text-[10px] text-gray-500" style={{ fontFamily: "var(--font-mono)" }}>{time}</span>
        <button
          onClick={onToggleDemo}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
            demoMode ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" : "border-gray-700 text-gray-600"
          }`}
        >
          {demoMode ? "DEMO" : "LIVE"}
        </button>
      </div>
    </header>
  );
}
