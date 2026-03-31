"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

interface Task {
  text: string;
  owner: string;
  priority: "red" | "amber" | "green";
  done: boolean;
}

interface Project {
  id: string;
  name: string;
  image: string;
  status: "urgent" | "attention" | "good" | "parked";
  statusLine: string;
  keyMetric: { label: string; value: string };
  tasks: Task[];
}

interface Data {
  projects: Project[];
  lastUpdated: string;
}

const STATUS_ORDER: Record<string, number> = { urgent: 0, attention: 1, good: 2, parked: 3 };
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
const TOKEN = "apex-live-2026";

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/status");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  useEffect(() => {
    if (data && window.innerWidth >= 768) {
      setExpanded(new Set(data.projects.map((p) => p.id)));
    }
  }, [data]);

  const toggleTask = async (projectId: string, taskIndex: number) => {
    if (!data) return;
    const updated = structuredClone(data);
    const project = updated.projects.find((p) => p.id === projectId);
    if (!project) return;
    project.tasks[taskIndex].done = !project.tasks[taskIndex].done;
    setData(updated);
    await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(updated),
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sorted = data ? [...data.projects].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) : [];

  return (
    <div className="min-h-dvh relative">
      <Particles />

      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              APEX COMMAND CENTRE
            </h1>
            <nav className="flex items-center gap-4">
              <span className="text-sm text-white font-medium">War Room</span>
              <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
                Pipeline
              </Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
                Finance
              </Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
                Prompts
              </Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
                Squad
              </Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">
                Map Room
              </Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
          {sorted.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isExpanded={expanded.has(project.id)}
              onToggle={() => toggleExpand(project.id)}
              onTaskToggle={(i) => toggleTask(project.id, i)}
            />
          ))}
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-[#475569] py-6">
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "—"}
        {" • "}Auto-refreshes every 60s
      </footer>

      <div className="relative z-10 text-center text-xs text-[#475569] pb-6 flex items-center justify-center gap-4 flex-wrap">
        <span>👤 Ginge</span>
        <span>🧭 Atlas</span>
        <span>🔄 Darwin</span>
        <span>🔬 Newton</span>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  isExpanded,
  onToggle,
  onTaskToggle,
}: {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onTaskToggle: (i: number) => void;
}) {
  const statusInfo = STATUS_LABEL[project.status];
  const doneTasks = project.tasks.filter((t) => t.done).length;

  return (
    <div className={`rounded-2xl overflow-hidden bg-[#111827] border border-[#1e293b] transition-all duration-300 ${AURA_CLASS[project.status]}`}>
      <Link href={`/project/${project.id}`} className="w-full relative aspect-video cursor-pointer group block">
        <Image
          src={project.image}
          alt={project.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <div className="text-left">
            <h2 className="text-lg font-bold text-white leading-tight">{project.name}</h2>
            <span className={`text-xs font-semibold tracking-wider ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-white leading-none">
              {project.keyMetric.value}
            </div>
            <div className="text-[10px] text-[#94a3b8] uppercase tracking-wider">
              {project.keyMetric.label}
            </div>
          </div>
        </div>
        <div className="absolute top-3 right-3 text-white/40 group-hover:text-white/80 transition-colors text-xs">
          →
        </div>
      </Link>

      <button onClick={onToggle} className="w-full px-4 py-3 border-t border-[#1e293b] cursor-pointer flex items-center justify-between hover:bg-[#1e293b]/30 transition-colors">
        <p className="text-xs text-[#94a3b8] leading-relaxed text-left">{project.statusLine}</p>
        <span className="text-xs text-[#475569] ml-2 flex-shrink-0">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#1e293b] pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">
              Tasks
            </span>
            <span className="text-[10px] text-[#64748b]">
              {doneTasks}/{project.tasks.length}
            </span>
          </div>
          <ul className="space-y-2">
            {project.tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="task-checkbox mt-0.5"
                  checked={task.done}
                  onChange={() => onTaskToggle(i)}
                />
                <span className={`dot-${task.priority} w-2 h-2 rounded-full mt-1.5 flex-shrink-0`} />
                <span className={`text-sm leading-snug flex-1 ${task.done ? "line-through text-[#475569]" : "text-[#cbd5e1]"}`}>
                  {task.text}
                </span>
                <span className="text-sm flex-shrink-0" title="Owner">{task.owner}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
