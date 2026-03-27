"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskGroup, TaskItem } from "@/types";

const STORAGE_KEY = "apex-completed-tasks";

const priorityColor: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-zinc-400",
};

function TypeBadge({ type }: { type: string }) {
  if (type === "recurring") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
        recurring 🔄
      </span>
    );
  }
  if (type === "automatable") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 whitespace-nowrap">
        automatable ⚡
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500 border border-zinc-700 whitespace-nowrap">
      one-off
    </span>
  );
}

function ProjectTaskGroup({ group, completedIds, onToggle }: { group: TaskGroup; completedIds: Set<string>; onToggle: (id: string) => void }) {
  const isDone = (t: TaskItem) => completedIds.has(t.id) || t.status === "done";

  const sorted = [...group.tasks].sort((a, b) => {
    const ad = isDone(a) ? 1 : 0;
    const bd = isDone(b) ? 1 : 0;
    return ad - bd;
  });

  const doneCount = group.tasks.filter(isDone).length;

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
          <span>{group.icon}</span>
          <span>{group.name}</span>
        </h3>
        <span className="text-[10px] text-zinc-600 font-mono">{doneCount}/{group.tasks.length}</span>
      </div>
      <div className="flex flex-col">
        {sorted.map((t) => {
          const checked = isDone(t);
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg transition-all hover:bg-zinc-800/30 ${
                checked ? "opacity-35" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => onToggle(t.id)}
                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-150 ${
                  checked
                    ? "bg-green-500 border-green-500"
                    : "border-zinc-600 hover:border-cyan-500"
                }`}
              >
                {checked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              {/* Task text — colour = priority */}
              <span
                className={`flex-1 text-base leading-snug ${
                  checked ? "line-through text-zinc-600" : priorityColor[t.priority] || "text-zinc-400"
                }`}
              >
                {t.task}
              </span>

              {/* Type badge — hide on small screens */}
              <div className="hidden sm:block shrink-0">
                <TypeBadge type={t.type} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TaskList({ tasksByProject }: { tasksByProject: TaskGroup[] }) {
  const totalTasks = tasksByProject.reduce((sum, g) => sum + g.tasks.length, 0);

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const persist = useCallback((next: Set<string>) => {
    setCompletedIds(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }, []);

  const toggle = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return next;
    });
  }, [persist]);

  const doneCount = tasksByProject.reduce(
    (sum, g) => sum + g.tasks.filter((t) => completedIds.has(t.id) || t.status === "done").length,
    0
  );

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-zinc-200">📋 Today&apos;s Tasks</h2>
        <span className="text-xs text-zinc-500">{doneCount}/{totalTasks} done</span>
      </div>
      {tasksByProject.map((g) => (
        <ProjectTaskGroup key={g.project} group={g} completedIds={completedIds} onToggle={toggle} />
      ))}
    </div>
  );
}
