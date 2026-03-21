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
  const [staleWarning, setStaleWarning] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleString("en-GB", {
          timeZone: "Asia/Manila",
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );

      if (lastUpdated) {
        const diff = now.getTime() - new Date(lastUpdated).getTime();
        setStaleWarning(diff > 60 * 60 * 1000);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const statusLabel = systemStatus === "operational" ? "ALL SYSTEMS OPERATIONAL" : systemStatus?.toUpperCase();

  return (
    <header className="flex items-center justify-between px-6 py-4 glass-card mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        {/* Apex triangle icon */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="shrink-0">
          <path d="M14 3L26 25H2L14 3Z" stroke="#06b6d4" strokeWidth="2" fill="none" />
          <path d="M14 10L20 22H8L14 10Z" fill="#06b6d4" opacity="0.3" />
        </svg>
        <h1 className="text-lg font-semibold tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>
          APEX COMMAND CENTRE
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Demo mode toggle */}
        <button
          onClick={onToggleDemo}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            demoMode
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-gray-600 text-gray-400 hover:border-gray-500"
          }`}
        >
          {demoMode ? "DEMO ON" : "DEMO"}
        </button>

        {/* System status */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 pulse-active" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-400 font-medium tracking-wide">{statusLabel}</span>
        </div>

        {/* Last updated */}
        {staleWarning && (
          <span className="text-xs text-amber-400 font-medium">⚠ DATA STALE</span>
        )}

        {/* Clock */}
        <span className="text-xs text-gray-400" style={{ fontFamily: "var(--font-mono)" }}>
          {time}
        </span>
      </div>
    </header>
  );
}
