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
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <header className="flex items-center justify-between px-4 py-3 mb-6 border-b border-gray-800/50">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-wider text-gray-200">APEX COMMAND CENTRE</h1>
        <span className="text-xs text-gray-500" style={{ fontFamily: "var(--font-mono)" }}>{time}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
          Updated {updatedAgo}
        </span>
        {systemStatus === "operational" && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 pulse-active" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        <button
          onClick={onToggleDemo}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            demoMode
              ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
              : "border-gray-700 text-gray-500 hover:border-gray-600"
          }`}
        >
          {demoMode ? "DEMO" : "LIVE"}
        </button>
      </div>
    </header>
  );
}
