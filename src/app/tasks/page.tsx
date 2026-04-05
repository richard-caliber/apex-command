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
  prompt_id: string;
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

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", label: "Not Started" },
  in_progress: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "In Progress" },
  done: { bg: "rgba(107,107,128,0.12)", text: "#6b6b80", label: "Done" },
  blocked: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "Blocked" },
  skipped: { bg: "rgba(107,107,128,0.12)", text: "#6b6b80", label: "Skipped" },
};

/* ── Page ── */

export default function MasterTaskList() {
  const [allTasks, setAllTasks] = useState<PipelineTask[]>([]);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("_all");
  const [stageFilter, setStageFilter] = useState("_all");
  const [markingDone, setMarkingDone] = useState<Set<string>>(new Set());
  const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["_adhoc"]));

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/pipeline-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    });
    if (res.ok) {
      const data = await res.json();
      setAllTasks(data.tasks || []);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Split into two universes
  const adhocTasks = useMemo(() => allTasks.filter((t) => t.id.startsWith("A-")), [allTasks]);
  const templateTasks = useMemo(() => allTasks.filter((t) => t.project_id === "_template" && !t.id.startsWith("A-")), [allTasks]);

  // Owners for filter (from both pools)
  const owners = useMemo(() => {
    const set = new Set([...adhocTasks, ...templateTasks].map((t) => t.owner));
    return Array.from(set).sort();
  }, [adhocTasks, templateTasks]);

  // Apply filters
  const applyFilters = useCallback((items: PipelineTask[]) => {
    let result = items;
    if (ownerFilter !== "_all") result = result.filter((t) => t.owner === ownerFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }
    return result;
  }, [ownerFilter, search]);

  // Filtered ad-hoc tasks
  const filteredAdhoc = useMemo(() => {
    let items = applyFilters(adhocTasks);
    if (stageFilter !== "_all") items = items.filter((t) => t.stage === stageFilter);
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }, [adhocTasks, applyFilters, stageFilter]);

  // Filtered template tasks grouped by stage
  const templateSections = useMemo(() => {
    const filtered = applyFilters(templateTasks);
    return STAGES.map((stage) => ({
      ...stage,
      tasks: filtered.filter((t) => t.stage === stage.id).sort((a, b) => a.order - b.order),
    })).filter((s) => stageFilter === "_all" || s.id === stageFilter);
  }, [templateTasks, applyFilters, stageFilter]);

  // Completed tasks (done/skipped from any source, for archive section)
  const completedTasks = useMemo(() => {
    const done = allTasks.filter((t) => (t.status === "done" || t.status === "skipped") && t.project_id !== "_template");
    return applyFilters(done).sort((a, b) => a.id.localeCompare(b.id));
  }, [allTasks, applyFilters]);

  const totalCount = adhocTasks.length + templateTasks.length;
  const filteredCount = filteredAdhoc.length + templateSections.reduce((sum, s) => sum + s.tasks.length, 0);

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
        setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t)));
        setToast(`${taskId} marked done`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch { /* silent */ } finally {
      setMarkingDone((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
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
        setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "not_started" } : t)));
        setToast(`${taskId} restored`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch { /* silent */ } finally {
      setMarkingDone((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
    }
  };

  const activeFilters = [ownerFilter, stageFilter].filter((f) => f !== "_all").length + (search ? 1 : 0);

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
              <Link href="/machine-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Machine Room</Link>
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
            <p className="text-xs text-[#64748b]">
              {filteredCount} of {totalCount} tasks
              <span className="ml-2 text-[#475569]">({adhocTasks.length} ad hoc + {templateTasks.length} pipeline templates)</span>
            </p>
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
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
          >
            <option value="_all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("_all"); setStageFilter("_all"); }}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl cursor-pointer transition-colors"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* ═══════ SECTION 1: Ad Hoc Actions ═══════ */}
        <CollapsibleSection
          id="_adhoc"
          label={"\u26A1 Ad Hoc Actions"}
          count={filteredAdhoc.length}
          isOpen={expanded.has("_adhoc")}
          onToggle={toggleSection}
          accent
        >
          {filteredAdhoc.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-[#475569]">No ad hoc tasks.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-t border-[#1e293b]/50">
                    <Th>ID</Th>
                    <Th>Name</Th>
                    <Th>Owner</Th>
                    <Th>Project</Th>
                    <Th>Status</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdhoc.map((task) => {
                    const ow = OWNER_STYLE[task.owner] || { emoji: "\u2753", label: task.owner };
                    const ss = STATUS_STYLE[task.status] || STATUS_STYLE.not_started;
                    const justDone = doneTasks.has(task.id);
                    const isDone = task.status === "done";
                    return (
                      <tr key={task.id} className="border-b border-[#1e293b]/30 transition-all hover:bg-white/[0.02]" style={{ opacity: justDone ? 0.4 : isDone ? 0.5 : 1 }}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold" style={{ color: "#00d4d4" }}>{task.id}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>Ad Hoc</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><span className="text-xs text-white" title={task.description}>{task.name}</span></td>
                        <td className="px-4 py-2.5"><span className="text-xs text-[#94a3b8]">{ow.emoji} {ow.label}</span></td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>{task.project_id}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ss.bg, color: ss.text }}>{ss.label}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <ActionCell taskId={task.id} justDone={justDone} isDone={isDone} marking={markingDone.has(task.id)} onDone={handleMarkDone} onUndo={handleUndo} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>

        {/* ═══════ SECTION 2: Pipeline Template Tasks ═══════ */}
        <div className="space-y-3">
          {templateSections.map((section) => {
            if (section.tasks.length === 0) return null;
            return (
              <CollapsibleSection
                key={section.id}
                id={section.id}
                label={`Stage: ${section.label}`}
                count={section.tasks.length}
                isOpen={expanded.has(section.id)}
                onToggle={toggleSection}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-t border-[#1e293b]/50">
                        <Th>ID</Th>
                        <Th>Name</Th>
                        <Th>Owner</Th>
                        <Th>Automation</Th>
                        <Th>Prompt</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.tasks.map((task) => {
                        const ow = OWNER_STYLE[task.owner] || { emoji: "\u2753", label: task.owner };
                        const au = AUTO_STYLE[task.automation] || AUTO_STYLE.manual;
                        return (
                          <tr key={task.id} className="border-b border-[#1e293b]/30 transition-all hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-mono font-bold" style={{ color: "#00d4d4" }}>{task.id}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs text-white" title={task.description}>{task.name}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs text-[#94a3b8]">{ow.emoji} {ow.label}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: au.bg, color: au.text }}>{au.label}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              {task.prompt_id ? (
                                <Link href="/prompts" className="text-[10px] font-mono hover:underline" style={{ color: "#00d4d4" }}>
                                  {task.prompt_id}
                                </Link>
                              ) : (
                                <span className="text-[10px] text-[#475569]">{"\u2014"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            );
          })}
        </div>

        {/* ═══════ SECTION 3: Completed Archive ═══════ */}
        {completedTasks.length > 0 && (
          <CollapsibleSection
            id="_completed"
            label={"\u2705 Completed"}
            count={completedTasks.length}
            isOpen={expanded.has("_completed")}
            onToggle={toggleSection}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-t border-[#1e293b]/50">
                    <Th>ID</Th>
                    <Th>Name</Th>
                    <Th>Owner</Th>
                    <Th>Project</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {completedTasks.map((task) => {
                    const ow = OWNER_STYLE[task.owner] || { emoji: "\u2753", label: task.owner };
                    const ss = STATUS_STYLE[task.status] || STATUS_STYLE.done;
                    return (
                      <tr key={task.id} className="border-b border-[#1e293b]/30 hover:bg-white/[0.02]" style={{ opacity: 0.5 }}>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono font-bold" style={{ color: "#475569" }}>{task.id}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-[#94a3b8]">{task.name}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-[#64748b]">{ow.emoji} {ow.label}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.08)", color: "#64748b" }}>{task.project_id}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ss.bg, color: ss.text }}>{ss.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}
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

/* ── Collapsible Section ── */

function CollapsibleSection({ id, label, count, isOpen, onToggle, accent, children }: {
  id: string; label: string; count: number; isOpen: boolean; onToggle: (id: string) => void; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1e293b] overflow-hidden" style={{ background: "#111827" }}>
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-xs transition-transform duration-200" style={{ color: "#64748b", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>{"\u25B6"}</span>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent ? "#00d4d4" : "#94a3b8" }}>{label}</span>
        <span
          className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold"
          style={{
            background: count > 0 ? (accent ? "rgba(0,212,212,0.2)" : "rgba(100,116,139,0.15)") : "rgba(100,116,139,0.08)",
            color: count > 0 ? (accent ? "#00d4d4" : "#94a3b8") : "#475569",
          }}
        >
          {count}
        </span>
      </button>
      <div
        className="transition-all duration-200 ease-in-out overflow-hidden"
        style={{ maxHeight: isOpen ? "2000px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Shared table header cell ── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#64748b" }}>
      {children}
    </th>
  );
}

/* ── Action cell (Done / Undo) ── */

function ActionCell({ taskId, justDone, isDone, marking, onDone, onUndo }: {
  taskId: string; justDone: boolean; isDone: boolean; marking: boolean; onDone: (id: string) => void; onUndo: (id: string) => void;
}) {
  if (justDone) {
    return (
      <button onClick={() => onUndo(taskId)} disabled={marking} className="text-[10px] font-medium text-[#94a3b8] hover:text-white transition-colors cursor-pointer disabled:opacity-40">
        {marking ? "..." : "Undo"}
      </button>
    );
  }
  if (isDone) {
    return <span className="text-[10px] text-[#475569]">{"\u2713"} Done</span>;
  }
  return (
    <button
      onClick={() => onDone(taskId)}
      disabled={marking}
      className="text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {marking ? "..." : "\u2713 Done"}
    </button>
  );
}
