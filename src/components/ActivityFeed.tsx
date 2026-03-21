"use client";

import { useEffect, useRef } from "react";
import type { ActivityEntry } from "@/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity]);

  return (
    <div className="flex flex-col">
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-3 px-1">Activity</h2>
      <div className="glass-card p-4 flex-1 overflow-y-auto max-h-[320px]">
        <div className="flex flex-col gap-2">
          {activity.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0">{entry.agent}</span>
              <span className="text-gray-600 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                {formatTime(entry.time)}
              </span>
              <span className="text-gray-300">{entry.event}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
