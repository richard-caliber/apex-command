"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

/* ── Types ── */

interface PipelineTask {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  automation: string;
  owner: string;
  order: number;
}

/* ── Constants ── */

const TOKEN = "apex-live-2026";

const STAGES = [
  { id: "inbox", label: "Inbox" },
  { id: "idea", label: "Idea" },
  { id: "validation", label: "Validation" },
  { id: "design", label: "Design" },
  { id: "mvp", label: "MVP" },
  { id: "traffic", label: "Traffic" },
  { id: "conversion", label: "Conversion" },
  { id: "delivery", label: "Delivery" },
  { id: "scale", label: "Scale" },
];

const STATUSES = ["not_started", "in_progress", "done", "blocked", "skipped"];

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", label: "Not Started" },
  in_progress: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "In Progress" },
  done: { bg: "rgba(107,107,128,0.12)", text: "#6b6b80", label: "Done" },
  blocked: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "Blocked" },
  skipped: { bg: "rgba(107,107,128,0.12)", text: "#6b6b80", label: "Skipped" },
};

const OWNER_STYLE: Record<string, { emoji: string; label: string }> = {
  atlas: { emoji: "\u{1F9ED}", label: "Atlas" },
  newton: { emoji: "\u{1F52C}", label: "Newton" },
  darwin: { emoji: "\u{1F504}", label: "Darwin" },
  jimmy: { emoji: "\u{1F3A8}", label: "Jimmy" },
  ginge: { emoji: "\u{1F451}", label: "Ginge" },
  "claude-code": { emoji: "\u{1F4BB}", label: "Claude" },
  system: { emoji: "\u2699\uFE0F", label: "System" },
  auto: { emoji: "\u26A1", label: "Auto" },
};

const AUTO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  manual: { bg: "rgba(107,107,128,0.15)", text: "#6b6b80", label: "Manual" },
  "semi-auto": { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "Semi" },
  "fully-auto": { bg: "rgba(0,212,212,0.12)", text: "#00d4d4", label: "Auto" },
};

type SortKey = "id" | "name" | "owner" | "project_id" | "stage" | "status" | "automation";
type SortDir = "asc" | "desc";

/* ── Section IDs: adhoc first, then stages ── */
const SECTIONS = [
  { id: "_adhoc", label: "Ad Hoc", defaultOpen: true },
  ...STAGES.map((s) => ({ id: s.id, label: s.label, defaultOpen: false })),
];

/* ── Page ── */

export default function MasterTaskList() {
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("_all");
  const [projectFilter, setProjectFilter] = useState("_all");
  const [stageFilter, setStageFilter] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [markingDone, setMarkingDone] = useState<Set<string>>(new Set());
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(SECTIONS.filter((s) => s.defaultOpen).map((s) => s.id)));

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/pipeline-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((data.tasks || []).filter((t: PipelineTask) => t.project_id !== "_template"));
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Dynamic project list
  const projects = useMemo(() => {
    const set = new Set(tasks.map((t) => t.project_id));
    return Array.from(set).sort();
  }, [tasks]);

  // Dynamic owner list
  const owners = useMemo(() => {
    const set = new Set(tasks.map((t) => t.owner));
    return Array.from(set).sort();
  }, [tasks]);

  // Filter + search
  const filtered = useMemo(() => {
    let items = tasks;
    if (ownerFilter !== "_all") items = items.filter((t) => t.owner === ownerFilter);
    if (projectFilter !== "_all") items = items.filter((t) => t.project_id === projectFilter);
    if (stageFilter !== "_all") items = items.filter((t) => t.stage === stageFilter);
    if (statusFilter !== "_all") items = items.filter((t) => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }
    return items;
  }, [tasks, ownerFilter, projectFilter, stageFilter, statusFilter, search]);

  // Sort
  const sortTasks = useCallback((list: PipelineTask[]) => {
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortKey, sortDir]);

  // Group filtered tasks into sections
  const sections = useMemo(() => {
    const adhocTasks = sortTasks(filtered.filter((t) => t.id.startsWith("A-")));
    const nonAdhoc = filtered.filter((t) => !t.id.startsWith("A-"));
    const result: { id: string; label: string; tasks: PipelineTask[] }[] = [
      { id: "_adhoc", label: "Ad Hoc", tasks: adhocTasks },
    ];
    for (const stage of STAGES) {
      result.push({ id: stage.id, label: stage.label, tasks: sortTasks(nonAdhoc.filter((t) => t.stage === stage.id)) });
    }
    return result;
  }, [filtered, sortTasks]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  }

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleMarkDone = async (taskId: string) => {
    setMarkingDone((prev) => new Set([...prev, taskId]));
    try {
      const res = await fetch("/api/pipeline-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ action: "set", id: taskId, status: "done" }),
      });
      if (res.ok) {
        setDoneTasks((prev) => new Set([...prev, taskId]));
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)));
        setToast(`${taskId} marked done`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* silent */
    } finally {
      setMarkingDone((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleUndo = async (taskId: string) => {
    setMarkingDone((prev) => new Set([...prev, taskId]));
    try {
      const res = await fetch("/api/pipeline-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ action: "set", id: taskId, status: "not_started" }),
      });
      if (res.ok) {
        setDoneTasks((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "not_started" } : t)));
        setToast(`${taskId} restored`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      /* silent */
    } finally {
      setMarkingDone((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const activeFilters = [ownerFilter, projectFilter, stageFilter, statusFilter].filter((f) => f !== "_all").length + (search ? 1 : 0);
  const totalFiltered = filtered.length;

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f" }}>
      {/* Header */}
      <header className="hidden sm:block border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">APEX COMMAND CENTRE</h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompt Library</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/vault" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Keys</Link>
              <span className="text-sm text-white font-medium">Master Task List</span>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <Link href="/action-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Action Room</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{"\uD83D\uDCCB"}</span>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Master Task List</h2>
            <p className="text-xs text-[#64748b]">{totalFiltered} of {tasks.length} tasks</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="flex-1 min-w-[200px] max-w-md text-sm px-4 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white placeholder-[#475569] outline-none focus:border-[#00d4d4] transition-colors"
          />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
          >
            <option value="_all">All Owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>{OWNER_STYLE[o]?.label || o}</option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
          >
            <option value="_all">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
          >
            <option value="_all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
          >
            <option value="_all">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_STYLE[s]?.label || s}</option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("_all"); setProjectFilter("_all"); setStageFilter("_all"); setStatusFilter("_all"); }}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl cursor-pointer transition-colors"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-3">
          {sections.map((section) => {
            const isOpen = expanded.has(section.id);
            const count = section.tasks.length;
            const isAdhoc = section.id === "_adhoc";

            if (count === 0 && !isAdhoc) return null;

            return (
              <div key={section.id} className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-white/[0.02]"
                >
                  <span
                    className="text-xs transition-transform duration-200"
                    style={{ color: "#64748b", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                  >
                    {"\u25B6"}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isAdhoc ? "#00d4d4" : "#94a3b8" }}>
                    {isAdhoc ? "\u26A1 Ad Hoc Actions" : section.label}
                  </span>
                  <span
                    className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: count > 0 ? (isAdhoc ? "rgba(0,212,212,0.2)" : "rgba(100,116,139,0.15)") : "rgba(100,116,139,0.08)",
                      color: count > 0 ? (isAdhoc ? "#00d4d4" : "#94a3b8") : "#475569",
                    }}
                  >
                    {count}
                  </span>
                </button>

                {/* Section Body */}
                <div
                  className="transition-all duration-200 ease-in-out overflow-hidden"
                  style={{ maxHeight: isOpen ? `${count * 60 + 60}px` : "0px", opacity: isOpen ? 1 : 0 }}
                >
                  {count === 0 ? (
                    <div className="px-5 py-6 text-center text-sm text-[#475569] border-t border-[#1e293b]/50">
                      No ad hoc tasks.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-t border-[#1e293b]/50">
                            {([
                              ["id", "ID"],
                              ["name", "Name"],
                              ["owner", "Owner"],
                              ["project_id", "Project"],
                              ["stage", "Stage"],
                              ["status", "Status"],
                              ["automation", "Automation"],
                            ] as [SortKey, string][]).map(([key, label]) => (
                              <th
                                key={key}
                                onClick={() => toggleSort(key)}
                                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none transition-colors hover:text-white"
                                style={{ color: sortKey === key ? "#00d4d4" : "#64748b" }}
                              >
                                {label}{sortIndicator(key)}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#64748b" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.tasks.map((task) => {
                            const ss = STATUS_STYLE[task.status] || STATUS_STYLE.not_started;
                            const ow = OWNER_STYLE[task.owner] || { emoji: "\u2753", label: task.owner };
                            const au = AUTO_STYLE[task.automation] || AUTO_STYLE.manual;
                            const taskIsAdhoc = task.id.startsWith("A-");
                            const justDone = doneTasks.has(task.id);
                            const isDone = task.status === "done";

                            return (
                              <tr
                                key={task.id}
                                className="border-b border-[#1e293b]/30 transition-all hover:bg-white/[0.02]"
                                style={{ opacity: justDone ? 0.4 : isDone ? 0.5 : 1 }}
                              >
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold" style={{ color: "#00d4d4" }}>{task.id}</span>
                                    {taskIsAdhoc && (
                                      <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>
                                        Ad Hoc
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs text-white" title={task.description}>{task.name}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs text-[#94a3b8]">{ow.emoji} {ow.label}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>
                                    {task.project_id}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs text-[#94a3b8] capitalize">{task.stage}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ss.bg, color: ss.text }}>
                                    {ss.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: au.bg, color: au.text }}>
                                    {au.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {justDone ? (
                                    <button
                                      onClick={() => handleUndo(task.id)}
                                      disabled={markingDone.has(task.id)}
                                      className="text-[10px] font-medium text-[#94a3b8] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                                    >
                                      {markingDone.has(task.id) ? "..." : "Undo"}
                                    </button>
                                  ) : isDone ? (
                                    <span className="text-[10px] text-[#475569]">{"\u2713"} Done</span>
                                  ) : (
                                    <button
                                      onClick={() => handleMarkDone(task.id)}
                                      disabled={markingDone.has(task.id)}
                                      className="text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {markingDone.has(task.id) ? "..." : "\u2713 Done"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-20 sm:bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold animate-in"
          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
        >
          {toast} {"\u2705"}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
