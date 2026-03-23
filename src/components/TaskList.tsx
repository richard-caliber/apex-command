"use client";

import { useState } from "react";
import type { Task, TaskMetrics } from "@/types";

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

const projectLabels: Record<string, { label: string; color: string }> = {
  caliber: { label: "Caliber", color: "bg-emerald-500/20 text-emerald-400" },
  agency: { label: "Agency", color: "bg-cyan-500/20 text-cyan-400" },
  storyquest: { label: "StoryQuest", color: "bg-amber-500/20 text-amber-400" },
  repostai: { label: "RepostAI", color: "bg-purple-500/20 text-purple-400" },
};

const typeLabels: Record<string, string> = {
  human: "Human Action",
  approve: "Approve",
  review: "Review",
  automated: "Automated",
};

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

const filterKeys = ["all", "caliber", "agency", "storyquest", "repostai"] as const;
const filterLabels: Record<string, string> = {
  all: "All",
  caliber: "Caliber",
  agency: "Agency",
  storyquest: "StoryQuest",
  repostai: "RepostAI",
};

export default function TaskList({ tasks, metrics }: { tasks: Task[]; metrics: TaskMetrics }) {
  const [filter, setFilter] = useState("all");
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const toggleDone = (id: string) => {
    setLocalDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatus = (t: Task) => (localDone.has(t.id) ? "done" : t.status);

  const filtered = tasks
    .filter((t) => filter === "all" || t.project === filter)
    .sort((a, b) => {
      const aD = getStatus(a) === "done" ? 1 : 0;
      const bD = getStatus(b) === "done" ? 1 : 0;
      if (aD !== bD) return aD - bD;
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });

  const doneCount = tasks.filter((t) => getStatus(t) === "done").length;

  return (
    <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
        <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase">
          📋 Today&apos;s Tasks
        </h2>
        <div className="flex gap-1">
          {filterKeys.map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                filter === k
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                  : "border-gray-700 text-gray-500 hover:border-gray-600"
              }`}
            >
              {filterLabels[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Task cards */}
      <div className="glass-card p-3 max-h-[340px] overflow-y-auto mb-3">
        <div className="flex flex-col gap-2">
          {filtered.map((t) => {
            const done = getStatus(t) === "done";
            const proj = projectLabels[t.project];
            return (
              <div
                key={t.id}
                className={`flex items-center gap-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800/50 transition-all ${
                  done ? "opacity-40" : ""
                }`}
              >
                {/* Priority dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: priorityColors[t.priority] }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs text-gray-200 ${done ? "line-through text-gray-500" : ""}`}>
                    {t.task}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {proj && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${proj.color}`}>
                        {proj.label}
                      </span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                      {typeLabels[t.type] || t.type}
                    </span>
                  </div>
                </div>

                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(t.id)}
                  className="shrink-0 w-5 h-5 rounded border border-gray-600 flex items-center justify-center transition-all hover:border-cyan-500"
                  style={done ? { backgroundColor: "#10b981", borderColor: "#10b981" } : {}}
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-fade-in">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Tasks done */}
        <div className="glass-card p-3">
          <p className="text-[10px] text-gray-500 mb-1">Tasks Done Today</p>
          <p className="text-sm font-semibold text-gray-200">{doneCount}/{metrics.totalToday}</p>
          <div className="w-full h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: `${metrics.totalToday > 0 ? (doneCount / metrics.totalToday) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Automation level */}
        <div className="glass-card p-3">
          <p className="text-[10px] text-gray-500 mb-1">Automation Level</p>
          <p className="text-sm font-semibold text-gray-200">{metrics.automationLevel}%</p>
          <div className="w-full h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${metrics.automationLevel}%` }}
            />
          </div>
        </div>

        {/* Steps to first $ */}
        <div className="glass-card p-3">
          <p className="text-[10px] text-gray-500 mb-1">Steps to First $</p>
          <p className="text-sm font-semibold text-gray-200">{metrics.stepsToRevenue.remaining} remaining</p>
          <div className="w-full h-1 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${Math.max(10, 100 - metrics.stepsToRevenue.remaining * 20)}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-600 mt-0.5">{metrics.stepsToRevenue.closest}</p>
        </div>
      </div>
    </section>
  );
}
