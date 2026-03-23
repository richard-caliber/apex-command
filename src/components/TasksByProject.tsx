"use client";

import { useState } from "react";
import type { ProjectGroup, Task } from "@/types";

const stageColorMap: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  grey: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const stageEmoji: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  grey: "⚪",
};

const priorityDot: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

function TypeBadge({ task }: { task: Task }) {
  if (task.type === "recurring") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
          recurring 🔄
        </span>
        {task.recurringNote && (
          <span className="text-[10px] text-gray-500 whitespace-nowrap">{task.recurringNote}</span>
        )}
      </span>
    );
  }
  if (task.type === "automatable") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 whitespace-nowrap">
          automatable ⚡
        </span>
        {task.automatableNote && (
          <span className="text-[10px] text-gray-500 whitespace-nowrap">{task.automatableNote}</span>
        )}
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-700 whitespace-nowrap">
      one-off
    </span>
  );
}

function ProjectSection({ group }: { group: ProjectGroup }) {
  const [collapsed, setCollapsed] = useState(false);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const toggleDone = (id: string) => {
    setLocalDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isDone = (t: Task) => localDone.has(t.id) || t.status === "done";

  const sorted = [...group.tasks].sort((a, b) => {
    const aD = isDone(a) ? 1 : 0;
    const bD = isDone(b) ? 1 : 0;
    if (aD !== bD) return aD - bD;
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const doneCount = group.tasks.filter(isDone).length;
  const isGeneral = group.project === "general";

  return (
    <div className="mb-4">
      {/* Project Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full text-left mb-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{group.icon}</span>
            <h3 className="text-lg font-bold text-gray-100 tracking-wide">{group.name}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${stageColorMap[group.stageColor] || stageColorMap.grey}`}>
              {stageEmoji[group.stageColor]} {group.stage}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {group.tasks.length > 0 && (
              <span className="text-[11px] text-gray-600">{doneCount}/{group.tasks.length}</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`text-gray-500 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            >
              <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        {!collapsed && (
          <div className="ml-10 mt-0.5 flex items-center gap-3 text-[11px] text-gray-500">
            {group.blocker && <span>Blocker: <span className="text-amber-400">{group.blocker}</span></span>}
            {!isGeneral && group.stepsToRevenue != null && (
              <span>Steps to £: <span className="text-cyan-400">{group.stepsToRevenue} remaining</span></span>
            )}
          </div>
        )}
      </button>

      {/* Tasks */}
      {!collapsed && (
        <div className="ml-2 sm:ml-10 flex flex-col gap-1">
          {sorted.length === 0 && (
            <p className="text-xs text-gray-600 py-2">No tasks — all automated or waiting for builds</p>
          )}
          {sorted.map((t) => {
            const done = isDone(t);
            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all hover:bg-gray-800/30 group ${
                  done ? "opacity-40" : ""
                }`}
              >
                <span className="shrink-0 text-sm">{priorityDot[t.priority]}</span>
                <span className={`flex-1 text-[15px] leading-snug ${done ? "line-through text-gray-600" : "text-gray-200"}`}>
                  {t.task}
                </span>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <TypeBadge task={t} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDone(t.id); }}
                  className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                    done ? "bg-emerald-500 border-emerald-500" : "border-gray-600 hover:border-cyan-500"
                  }`}
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TasksByProject({ groups }: { groups: ProjectGroup[] }) {
  // Sort: lowest stepsToRevenue first, general admin last
  const sorted = [...groups].sort((a, b) => {
    if (a.project === "general") return 1;
    if (b.project === "general") return -1;
    const aSteps = a.stepsToRevenue ?? 999;
    const bSteps = b.stepsToRevenue ?? 999;
    return aSteps - bSteps;
  });

  return (
    <section className="mb-8">
      {sorted.map((g) => (
        <ProjectSection key={g.project} group={g} />
      ))}
    </section>
  );
}
