"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

/* ── Stages ── */
const STAGES = [
  { id: -1, label: "Inbox" },
  { id: 0, label: "Idea" },
  { id: 1, label: "Validation" },
  { id: 2, label: "Design" },
  { id: 3, label: "MVP" },
  { id: 4, label: "Traffic" },
  { id: 5, label: "Conversion" },
  { id: 6, label: "Delivery" },
  { id: 7, label: "Scale" },
];

const STAGE_KEYS = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];

/* ── Types ── */
interface DarwinScore {
  score: number;
  verdict: string;
}

interface Project {
  id: string;
  name: string;
  image_url?: string;
  current_stage: number;
  status: string;
  stage?: string;
  darwinScore: DarwinScore | null;
}

/* ── Fallback Data ── */
const FALLBACK_PROJECTS: Project[] = [
  { id: "caliber", name: "Caliber Peptides", current_stage: 4, status: "active", darwinScore: null },
  { id: "parliament", name: "Parliament Tracker", current_stage: 3, status: "active", darwinScore: null },
  { id: "storyquest", name: "StoryQuest", current_stage: 2, status: "blocked", darwinScore: null },
  { id: "wingman", name: "WingmanAI", current_stage: 1, status: "active", darwinScore: null },
  { id: "gemsnap", name: "GemSnap", current_stage: 5, status: "active", darwinScore: null },
];

/* ── Status dot colour ── */
function statusDot(status: string): string {
  switch (status) {
    case "active":
    case "live":
    case "on-track":
      return "#22c55e"; // green
    case "blocked":
    case "critical":
      return "#ef4444"; // red
    case "paused":
    case "warning":
    case "attention":
      return "#f59e0b"; // amber
    default:
      return "#22c55e";
  }
}

/* ── Deterministic gradient from project name ── */
function projectGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,25%) 0%, hsl(${h2},50%,15%) 100%)`;
}

/* ── Component ── */
export default function OverviewPage() {
  const [projects, setProjects] = useState<Project[]>(FALLBACK_PROJECTS);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  const fetchData = useCallback(async () => {
    try {
      const h = { "Content-Type": "application/json" };
      const [projRes, tasksRes] = await Promise.all([
        fetch("/api/projects", { method: "POST", headers: h, body: JSON.stringify({ action: "list" }) }),
        fetch("/api/pipeline-tasks", { method: "POST", headers: h, body: JSON.stringify({ action: "list" }) }),
      ]);

      // Build score map from tasks
      const scoreMap: Record<string, DarwinScore> = {};
      if (tasksRes.ok) {
        const taskStore = await tasksRes.json();
        const allTasks: { project_id: string; stage: string; output: string }[] = taskStore.tasks || [];
        for (const t of allTasks) {
          if (!t.output || t.project_id === "_template") continue;
          try {
            const parsed = JSON.parse(t.output);
            if (typeof parsed.score === "number") {
              const si = STAGE_KEYS.indexOf(t.stage);
              const existing = scoreMap[t.project_id];
              if (!existing || si > (existing as DarwinScore & { _si?: number })._si!) {
                scoreMap[t.project_id] = { score: parsed.score, verdict: parsed.verdict || "" };
                (scoreMap[t.project_id] as DarwinScore & { _si?: number })._si = si;
              }
            }
          } catch { /* not JSON */ }
        }
      }

      if (!projRes.ok) return;
      const d = await projRes.json();
      const items = d?.projects;
      if (items?.length) {
        setProjects(
          items.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            image_url: (p.image_url as string) || undefined,
            current_stage:
              typeof p.stage === "string"
                ? stageFromLabel(p.stage as string)
                : typeof p.current_stage === "number"
                ? (p.current_stage as number)
                : 3,
            status: (p.status as string) || "active",
            darwinScore: scoreMap[p.id as string] || null,
          }))
        );
      }
    } catch {
      // fallback data already set
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Stage counts ── */
  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: projects.filter((p) => p.current_stage === s.id).length,
  }));

  /* ── Scroll to stage section ── */
  function scrollToStage(id: number) {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* ── 1. PIPELINE STAGE RAIL ── */}
      <nav className="overflow-x-auto scrollbar-hide -mx-1 mb-6">
        <div className="flex items-center gap-1 min-w-max px-1 py-2">
          {stageCounts.map((stage, i) => (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => scrollToStage(stage.id)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background:
                    stage.count > 0
                      ? "rgba(0,212,212,0.12)"
                      : "rgba(30,30,46,0.6)",
                  border: `1px solid ${
                    stage.count > 0
                      ? "rgba(0,212,212,0.3)"
                      : "rgba(30,30,46,0.8)"
                  }`,
                  color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                }}
              >
                <span className="text-xs font-semibold">{stage.label}</span>
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold"
                  style={{
                    background:
                      stage.count > 0
                        ? "rgba(0,212,212,0.25)"
                        : "rgba(107,107,128,0.15)",
                    color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                  }}
                >
                  {stage.count}
                </span>
              </button>
              {i < stageCounts.length - 1 && (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="flex-shrink-0 mx-0.5"
                >
                  <path
                    d="M7 5L13 10L7 15"
                    stroke="#2a2a3e"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* ── 2. PROJECT LIST — one section per stage ── */}
      <div className="space-y-1">
        {STAGES.map((stage) => {
          const stageProjects = projects.filter(
            (p) => p.current_stage === stage.id
          );
          const empty = stageProjects.length === 0;

          return (
            <section
              key={stage.id}
              ref={(el) => { sectionRefs.current[stage.id] = el; }}
              className="scroll-mt-4"
            >
              {/* Stage heading — compact */}
              <div className="flex items-center gap-2 py-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: empty ? "#2a2a3e" : "#00d4d4" }}
                >
                  {stage.label}
                </span>
                {!empty && (
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "#4a4a5e" }}
                  >
                    {stageProjects.length}
                  </span>
                )}
                {empty && (
                  <span
                    className="text-[10px] italic"
                    style={{ color: "#2a2a3e" }}
                  >
                    — no projects
                  </span>
                )}
                <div
                  className="flex-1 h-px"
                  style={{ background: empty ? "rgba(30,30,46,0.4)" : "rgba(0,212,212,0.1)" }}
                />
              </div>

              {/* Project cards — horizontal row, wrap on overflow */}
              {!empty && (
                <div className="flex flex-wrap gap-3 pb-2">
                  {stageProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/map-room/pipeline?project=${project.id}`}
                      className="group flex items-center gap-3 rounded-lg p-1.5 pr-4 transition-colors hover:bg-white/[0.04]"
                      style={{ border: "1px solid transparent" }}
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative flex-shrink-0 rounded-md overflow-hidden"
                        style={{ width: "100px", height: "64px" }}
                      >
                        {project.image_url ? (
                          <img
                            src={project.image_url}
                            alt={project.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="absolute inset-0"
                            style={{ background: projectGradient(project.name) }}
                          />
                        )}
                        {/* Status dot */}
                        <div
                          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                          style={{
                            background: statusDot(project.status),
                            boxShadow: `0 0 6px ${statusDot(project.status)}80`,
                          }}
                        />
                      </div>

                      {/* Name + Score */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#c0c0d0] group-hover:text-[#00d4d4] transition-colors whitespace-nowrap">
                          {project.name}
                        </span>
                        {project.darwinScore && (() => {
                          const s = project.darwinScore.score;
                          const bg = s >= 7 ? "rgba(34,197,94,0.85)" : s >= 4 ? "rgba(245,158,11,0.85)" : "rgba(239,68,68,0.85)";
                          const label = s >= 7 ? "PROCEED" : s >= 4 ? "ITERATE" : "PARKED";
                          return (
                            <span
                              className="text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded text-white"
                              style={{ background: bg }}
                            >
                              {s}/10 {label}
                            </span>
                          );
                        })()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ── Helper: map stage label string to numeric ID ── */
function stageFromLabel(label: string): number {
  const map: Record<string, number> = {
    inbox: -1,
    idea: 0,
    validation: 1,
    design: 2,
    mvp: 3,
    traffic: 4,
    conversion: 5,
    delivery: 6,
    scale: 7,
  };
  return map[label.toLowerCase()] ?? 3;
}
