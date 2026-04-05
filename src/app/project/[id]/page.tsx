"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ── Types ── */
interface ProjectTask {
  id: string;
  text: string;
  owner: string;
  priority: "red" | "amber" | "green";
  status: "todo" | "in-progress" | "done" | "blocked";
  blockedBy?: string;
}

interface TimelineMilestone {
  name: string;
  date: string;
  status: "done" | "in-progress" | "upcoming";
}

interface WaitingItem {
  text: string;
  owner: string;
}

interface ProjectDetail {
  id: string;
  tasks: ProjectTask[];
  timeline: TimelineMilestone[];
  waitingOn: WaitingItem[];
  notes?: string;
}

interface WarRoomProject {
  id: string;
  name: string;
  image: string;
  status: "urgent" | "attention" | "good" | "parked";
  statusLine: string;
  keyMetric: { label: string; value: string };
}

/* ── Constants ── */
const AURA_CLASS: Record<string, string> = {
  urgent: "card-urgent",
  attention: "card-attention",
  good: "card-good",
  parked: "card-parked",
};
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  urgent: { text: "URGENT", color: "text-red-400" },
  attention: { text: "ATTENTION", color: "text-amber-400" },
  good: { text: "ON TRACK", color: "text-green-400" },
  parked: { text: "PARKED", color: "text-gray-500" },
};
const OWNER_LABEL: Record<string, string> = {
  "👤": "Ginge",
  "🧭": "Atlas",
  "🔄": "Darwin",
  "🔬": "Newton",
  "⏳": "External",
};
const PRIORITY_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };
const STATUS_ORDER: Record<string, number> = { blocked: 0, "in-progress": 1, todo: 2, done: 3 };
const TOKEN = "apex-live-2026";

function sortTasks(tasks: ProjectTask[]): { active: ProjectTask[]; done: ProjectTask[] } {
  const active = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const done = tasks.filter((t) => t.status === "done");
  return { active, done };
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [warRoom, setWarRoom] = useState<WarRoomProject | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const [detailRes, statusRes] = await Promise.all([
      fetch(`/api/project/${id}`),
      fetch(`/api/status/${id}`),
    ]);
    if (detailRes.ok) {
      const d = await detailRes.json();
      setDetail(d);
      setNotes(d.notes || "");
    }
    if (statusRes.ok) setWarRoom(await statusRes.json());
  }, [id]);

  const saveNotes = useCallback(async (value: string) => {
    setNotesSaved(false);
    await fetch(`/api/project/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ notes: value }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }, [id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNotes(value), 1000);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  if (!detail || !warRoom) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Particles />
        <div className="relative z-10 text-[#64748b] text-lg">Loading project...</div>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[warRoom.status];
  const { active, done } = sortTasks(detail.tasks);
  const gingeItems = detail.waitingOn.filter((w) => w.owner === "👤");
  const externalItems = detail.waitingOn.filter((w) => w.owner !== "👤");

  return (
    <div className="min-h-dvh relative">
      <Particles />

      {/* Header Nav */}
      <header className="hidden sm:block relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              APEX COMMAND CENTRE
            </h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompt Library</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/vault" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Keys</Link>
              <Link href="/tasks" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Task List</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <Link href="/machine-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Machine Room</Link>
              <Link href="/action-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Action Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2">
              <span className="refresh-dot" />
              <span className="text-xs">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          ← Back to War Room
        </Link>

        {/* Project Header */}
        <div className={`rounded-2xl overflow-hidden bg-[#111827] border border-[#1e293b] mt-3 ${AURA_CLASS[warRoom.status]}`}>
          <div className="relative h-48 sm:h-56">
            <Image
              src={warRoom.image}
              alt={warRoom.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{warRoom.name}</h2>
                <span className={`text-sm font-semibold tracking-wider ${statusInfo.color}`}>
                  {statusInfo.text}
                </span>
                <p className="text-sm text-[#94a3b8] mt-1">{warRoom.statusLine}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-white leading-none">
                  {warRoom.keyMetric.value}
                </div>
                <div className="text-xs text-[#94a3b8] uppercase tracking-wider">
                  {warRoom.keyMetric.label}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left: Tasks (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Waiting On — Ginge */}
            {gingeItems.length > 0 && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/30 p-4">
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
                  ⚡ Waiting on YOU
                </h3>
                <ul className="space-y-2">
                  {gingeItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="text-lg">👤</span>
                      <span className="text-sm text-[#f1f5f9]">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Task List */}
            <div className="rounded-xl bg-[#111827] border border-[#1e293b] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider">Tasks</h3>
                <span className="text-xs text-[#64748b]">
                  {done.length}/{detail.tasks.length} done
                </span>
              </div>

              <div className="space-y-3">
                {active.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>

              {done.length > 0 && (
                <div className="mt-4 border-t border-[#1e293b] pt-3">
                  <button
                    onClick={() => setShowDone(!showDone)}
                    className="text-xs text-[#64748b] hover:text-white transition-colors cursor-pointer"
                  >
                    {showDone ? "▼" : "▶"} Completed ({done.length})
                  </button>
                  {showDone && (
                    <div className="space-y-2 mt-3 opacity-60">
                      {done.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-xl bg-[#111827] border border-[#1e293b] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider">Notes</h3>
                {notesSaved && (
                  <span className="text-xs text-green-400">Saved</span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add notes, context, decisions..."
                className="w-full bg-[#0d1117] border border-[#1e293b] rounded-lg p-3 text-sm text-[#cbd5e1] placeholder-[#475569] resize-y min-h-[120px] focus:outline-none focus:border-[#475569] transition-colors font-mono"
                rows={6}
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Waiting on External */}
            {externalItems.length > 0 && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/30 p-4">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">
                  ⏳ Waiting on External
                </h3>
                <ul className="space-y-2">
                  {externalItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="text-lg">{item.owner}</span>
                      <span className="text-sm text-[#cbd5e1]">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-xl bg-[#111827] border border-[#1e293b] p-5">
              <h3 className="text-sm font-bold text-[#f1f5f9] uppercase tracking-wider mb-4">Timeline</h3>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[#1e293b]" />
                <div className="space-y-5">
                  {detail.timeline.map((ms, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border-2 ${
                        ms.status === "done"
                          ? "bg-green-500 border-green-500"
                          : ms.status === "in-progress"
                          ? "bg-amber-500 border-amber-500 animate-pulse"
                          : "bg-transparent border-[#475569]"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#f1f5f9]">{ms.name}</div>
                        <div className="text-xs text-[#64748b]">{ms.date}</div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold flex-shrink-0 ${
                        ms.status === "done"
                          ? "text-green-400"
                          : ms.status === "in-progress"
                          ? "text-amber-400"
                          : "text-[#475569]"
                      }`}>
                        {ms.status === "in-progress" ? "NOW" : ms.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Owner Legend */}
            <div className="rounded-xl bg-[#111827] border border-[#1e293b] p-4">
              <div className="grid grid-cols-2 gap-2 text-xs text-[#94a3b8]">
                {Object.entries(OWNER_LABEL).map(([emoji, name]) => (
                  <div key={emoji} className="flex items-center gap-2">
                    <span className="text-base">{emoji}</span>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Task Row ── */
function TaskRow({ task }: { task: ProjectTask }) {
  const statusStyle: Record<string, string> = {
    blocked: "bg-red-500/10 text-red-400 border-red-500/30",
    "in-progress": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    todo: "bg-[#1e293b] text-[#94a3b8] border-[#334155]",
    done: "bg-green-500/10 text-green-400 border-green-500/30",
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      task.status === "blocked" ? "border-red-500/30 bg-red-500/5" : "border-[#1e293b] bg-[#0d1117]"
    }`}>
      <span className={`dot-${task.priority} w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${task.status === "done" ? "line-through text-[#475569]" : "text-[#cbd5e1]"}`}>
          {task.text}
        </div>
        {task.status === "blocked" && task.blockedBy && (
          <div className="text-xs text-red-400/80 mt-1">
            🚫 {task.blockedBy}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${statusStyle[task.status]}`}>
          {task.status}
        </span>
        <span className="text-base" title={OWNER_LABEL[task.owner] || task.owner}>{task.owner}</span>
      </div>
    </div>
  );
}

/* ── Particles ── */
function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
        />
      ))}
    </div>
  );
}
