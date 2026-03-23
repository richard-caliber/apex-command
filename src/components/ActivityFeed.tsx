"use client";

import { useState, useEffect, useRef } from "react";
import type { ActivityEntry } from "@/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Asia/Manila",
    day: "2-digit",
    month: "short",
  });
}

export default function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [expanded, activity]);

  return (
    <section className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <h2 className="text-base font-semibold text-gray-400">📜 Activity Feed</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
          {activity.length}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="max-h-[350px] overflow-y-auto rounded-lg bg-gray-900/30 border border-gray-800/50 p-3">
          <div className="flex flex-col gap-2">
            {activity.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="shrink-0">{entry.agent}</span>
                <span className="text-gray-600 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                  {formatDate(entry.time)} {formatTime(entry.time)}
                </span>
                <span className="text-gray-400">{entry.event}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </section>
  );
}
