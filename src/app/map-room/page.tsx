"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ── Stages ── */
const STAGES = [
  { id: -1, label: "Idea Inbox", short: "-1" },
  { id: 0, label: "Idea", short: "0" },
  { id: 1, label: "Validation", short: "1" },
  { id: 2, label: "Design", short: "2" },
  { id: 3, label: "MVP", short: "3" },
  { id: 4, label: "Traffic", short: "4" },
  { id: 5, label: "Conversion", short: "5" },
  { id: 6, label: "Scale", short: "6" },
];

/* ── Types ── */
interface Project {
  id: string;
  name: string;
  current_stage: number;
  blocker: string | null;
  blocker_severity: "amber" | "red" | null;
  next_task_due: string | null;
  next_task_name: string | null;
  automation_score: number | null;
  task_count: number;
}

interface UrgentTask {
  id: string;
  name: string;
  project: string;
  project_id: string;
  owner: string;
  urgency: "critical" | "high" | "medium";
  due: string | null;
}

interface HeartbeatStatus {
  last_run: string;
  status: "healthy" | "issues" | "critical";
  issue_count: number;
  missing_data: number;
  unreviewed_content: number;
  stale_outputs: number;
}

/* ── Fallback Data ── */
const FALLBACK_PROJECTS: Project[] = [
  {
    id: "caliber",
    name: "Caliber Peptides",
    current_stage: 4,
    blocker: "Carousel copy scoring 6.5/10 — needs stronger hooks",
    blocker_severity: "amber",
    next_task_due: "2026-03-31",
    next_task_name: "Carousel Quality Gate",
    automation_score: null,
    task_count: 8,
  },
  {
    id: "parliament",
    name: "Parliament Tracker",
    current_stage: 3,
    blocker: null,
    blocker_severity: null,
    next_task_due: "2026-04-02",
    next_task_name: "Deploy contradiction engine v2",
    automation_score: null,
    task_count: 5,
  },
  {
    id: "storyquest",
    name: "StoryQuest",
    current_stage: 2,
    blocker: "Voice actor API integration delayed",
    blocker_severity: "red",
    next_task_due: "2026-04-01",
    next_task_name: "Finalise character generation prompts",
    automation_score: null,
    task_count: 6,
  },
  {
    id: "wingman",
    name: "WingmanAI",
    current_stage: 1,
    blocker: null,
    blocker_severity: null,
    next_task_due: "2026-04-03",
    next_task_name: "User interview analysis",
    automation_score: null,
    task_count: 4,
  },
  {
    id: "gemsnap",
    name: "GemSnap",
    current_stage: 5,
    blocker: "Conversion rate 1.2% — paywall UX needs iteration",
    blocker_severity: "amber",
    next_task_due: "2026-03-31",
    next_task_name: "A/B test blurred paywall variants",
    automation_score: null,
    task_count: 7,
  },
];

const FALLBACK_TASKS: UrgentTask[] = [
  { id: "t1", name: "Fix carousel CTA format", project: "Caliber Peptides", project_id: "caliber", owner: "Atlas", urgency: "critical", due: "2026-03-31" },
  { id: "t2", name: "Voice API fallback handler", project: "StoryQuest", project_id: "storyquest", owner: "Newton", urgency: "critical", due: "2026-04-01" },
  { id: "t3", name: "A/B test paywall blur levels", project: "GemSnap", project_id: "gemsnap", owner: "Darwin", urgency: "high", due: "2026-03-31" },
  { id: "t4", name: "Deploy contradiction engine v2", project: "Parliament Tracker", project_id: "parliament", owner: "Claude Code", urgency: "high", due: "2026-04-02" },
  { id: "t5", name: "User interview synthesis", project: "WingmanAI", project_id: "wingman", owner: "Ginge", urgency: "medium", due: "2026-04-03" },
];

const FALLBACK_HEARTBEAT: HeartbeatStatus = {
  last_run: "2026-03-30T14:20:00Z",
  status: "issues",
  issue_count: 3,
  missing_data: 2,
  unreviewed_content: 4,
  stale_outputs: 1,
};

/* ── Helpers ── */
const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", label: "CRITICAL" },
  high: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", label: "HIGH" },
  medium: { bg: "rgba(0,212,212,0.12)", text: "#00d4d4", label: "MEDIUM" },
};

const OWNER_COLORS: Record<string, string> = {
  Atlas: "#60a5fa",
  Darwin: "#34d399",
  Newton: "#a78bfa",
  "Claude Code": "#fb923c",
  Ginge: "#f472b6",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  healthy: { bg: "rgba(34,197,94,0.12)", text: "#22c55e", dot: "#22c55e" },
  issues: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b", dot: "#f59e0b" },
  critical: { bg: "rgba(239,68,68,0.12)", text: "#ef4444", dot: "#ef4444" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Component ── */
export default function OverviewPage() {
  const [projects, setProjects] = useState<Project[]>(FALLBACK_PROJECTS);
  const [tasks, setTasks] = useState<UrgentTask[]>(FALLBACK_TASKS);
  const [heartbeat, setHeartbeat] = useState<HeartbeatStatus>(FALLBACK_HEARTBEAT);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, taskRes, hbRes] = await Promise.allSettled([
        fetch("/api/map-room/projects"),
        fetch("/api/map-room/tasks"),
        fetch("/api/map-room/heartbeat"),
      ]);
      if (projRes.status === "fulfilled" && projRes.value.ok) {
        const d = await projRes.value.json();
        // API returns { items: [...] } — map to our Project shape
        const items = d?.items || d?.projects;
        if (items?.length) {
          setProjects(items.map((p: Record<string, unknown>) => ({
            id: p.id,
            name: p.name,
            current_stage: typeof p.current_stage === "number" ? p.current_stage : 0,
            blocker: Array.isArray(p.blockers) && p.blockers.length > 0 ? p.blockers[0] : null,
            blocker_severity: Array.isArray(p.blockers) && p.blockers.length > 0 ? "amber" : null,
            next_task_due: null,
            next_task_name: null,
            automation_score: null,
            task_count: 0,
          })));
        }
      }
      if (taskRes.status === "fulfilled" && taskRes.value.ok) {
        const d = await taskRes.value.json();
        const items = d?.items || d?.tasks;
        if (items?.length) {
          setTasks(items
            .filter((t: Record<string, unknown>) => t.status !== "done" && t.status !== "cancelled")
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
              const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return (order[a.urgency as string] ?? 3) - (order[b.urgency as string] ?? 3);
            })
            .slice(0, 5)
            .map((t: Record<string, unknown>) => ({
              id: t.id,
              name: t.name,
              project: t.project,
              project_id: t.project_id,
              owner: t.owner,
              urgency: t.urgency || "medium",
              due: t.due_date || t.due || null,
            }))
          );
        }
      }
      if (hbRes.status === "fulfilled" && hbRes.value.ok) {
        const d = await hbRes.value.json();
        if (d?.status || d?.sections) {
          // Map heartbeat API shape to our HeartbeatStatus
          const sections = d.sections || [];
          const missingData = sections.find((s: Record<string, unknown>) => s.id === "missing-data")?.items?.length || 0;
          const unreviewed = sections.find((s: Record<string, unknown>) => s.id === "unreviewed-posts")?.items?.length || 0;
          const stale = sections.find((s: Record<string, unknown>) => s.id === "stale-outputs")?.items?.length || 0;
          const totalIssues = sections.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.items as unknown[])?.length || 0), 0);
          const statusMap: Record<string, string> = { "all-clear": "healthy", "issues-found": "issues", critical: "critical" };
          setHeartbeat({
            last_run: d.lastRun || d.last_run || new Date().toISOString(),
            status: (statusMap[d.status] || d.status || "healthy") as "healthy" | "issues" | "critical",
            issue_count: totalIssues,
            missing_data: missingData,
            unreviewed_content: unreviewed,
            stale_outputs: stale,
          });
        }
      }
    } catch {
      // fallback data already set
    }
    // data loaded
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Stage counts
  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: projects.filter((p) => p.current_stage === s.id).length,
  }));

  const hbStyle = STATUS_STYLES[heartbeat.status] || STATUS_STYLES.healthy;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── ZONE A: Stage Progress Rail ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6b6b80" }}>
            Pipeline Stages
          </h2>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="flex items-stretch overflow-x-auto scrollbar-hide">
            {stageCounts.map((stage, i) => (
              <div key={stage.id} className="flex items-stretch flex-1 min-w-0">
                <div
                  className="flex-1 px-3 py-4 text-center transition-all hover:bg-white/[0.02] group cursor-default"
                  style={{ minWidth: "100px" }}
                >
                  <div
                    className="text-[10px] font-mono font-bold mb-1"
                    style={{ color: stage.count > 0 ? "#00d4d4" : "#6b6b80" }}
                  >
                    {stage.short}
                  </div>
                  <div className="text-xs font-medium mb-2" style={{ color: stage.count > 0 ? "#ffffff" : "#a0a0b0" }}>
                    {stage.label}
                  </div>
                  <div
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-all"
                    style={{
                      background: stage.count > 0 ? "rgba(0,212,212,0.15)" : "rgba(107,107,128,0.1)",
                      color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                    }}
                  >
                    {stage.count}
                  </div>
                </div>
                {i < stageCounts.length - 1 && (
                  <div className="flex items-center px-0">
                    <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="flex-shrink-0">
                      <path d="M4 4L12 12L4 20" stroke="#1e1e2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ZONE B + C: Main Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── ZONE B: Active Projects (60%) ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6b6b80" }}>
              Active Projects
            </h2>
            <span className="text-xs font-mono" style={{ color: "#6b6b80" }}>
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          {projects.length === 0 && (
            <div className="rounded-xl border p-8 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-2xl mb-2">🚀</div>
              <p style={{ color: "#a0a0b0" }} className="text-sm">No active projects yet.</p>
              <p style={{ color: "#6b6b80" }} className="text-xs mt-1">Head to Ideas to promote one to the pipeline.</p>
            </div>
          )}

          {projects.map((project) => {
            const stageInfo = STAGES.find((s) => s.id === project.current_stage);
            return (
              <Link
                key={project.id}
                href={`/map-room/pipeline?project=${project.id}`}
                className="block rounded-xl border transition-all hover:border-[#2a2a3e] group"
                style={{ background: "#111118", borderColor: "#1e1e2e" }}
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-white group-hover:text-[#00d4d4] transition-colors">
                        {project.name}
                      </h3>
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{ background: "rgba(0,212,212,0.12)", color: "#00d4d4" }}
                      >
                        Stage {stageInfo?.short} — {stageInfo?.label}
                      </span>
                    </div>
                    <svg
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#6b6b80"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Stage mini-bar */}
                  <div className="flex gap-1 mb-3">
                    {STAGES.map((s) => (
                      <div
                        key={s.id}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{
                          background:
                            s.id < project.current_stage
                              ? "rgba(0,212,212,0.3)"
                              : s.id === project.current_stage
                              ? "#00d4d4"
                              : "rgba(30,30,46,0.8)",
                        }}
                      />
                    ))}
                  </div>

                  {/* Info Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {/* Blocker */}
                    {project.blocker && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: project.blocker_severity === "red" ? "#ef4444" : "#f59e0b",
                          }}
                        />
                        <span
                          style={{
                            color: project.blocker_severity === "red" ? "#ef4444" : "#f59e0b",
                          }}
                          className="truncate max-w-[300px]"
                        >
                          {project.blocker}
                        </span>
                      </div>
                    )}

                    {/* Next task */}
                    {project.next_task_name && (
                      <div className="flex items-center gap-1.5" style={{ color: "#a0a0b0" }}>
                        <span style={{ color: "#6b6b80" }}>Next:</span>
                        <span>{project.next_task_name}</span>
                        {project.next_task_due && (
                          <span className="font-mono" style={{ color: "#6b6b80" }}>
                            ({formatDate(project.next_task_due)})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Automation score */}
                    <div className="flex items-center gap-1.5 ml-auto" style={{ color: "#6b6b80" }}>
                      <span className="text-[10px]" title="Automation Score (placeholder)">
                        ⚙️
                      </span>
                      <span className="font-mono text-[10px]">
                        {project.automation_score !== null ? `${project.automation_score}%` : "—"}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded ml-1"
                        style={{ background: "rgba(107,107,128,0.15)", color: "#6b6b80" }}
                        title="Placeholder for integration"
                      >
                        🔌
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── ZONE C: Urgency Panel (40%) ── */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#6b6b80" }}>
            Urgency Panel
          </h2>

          {/* Urgent Tasks */}
          <div className="rounded-xl border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a0a0b0" }}>
                Top Urgent Tasks
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "#1e1e2e" }}>
              {tasks.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-sm" style={{ color: "#22c55e" }}>All clear — no urgent tasks.</p>
                </div>
              )}
              {tasks.slice(0, 5).map((task) => {
                const urg = URGENCY_STYLES[task.urgency];
                return (
                  <div
                    key={task.id}
                    className="px-4 py-3 hover:bg-white/[0.01] transition-colors"
                    style={{ borderColor: "#1e1e2e" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-white leading-tight">{task.name}</span>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider"
                        style={{ background: urg.bg, color: urg.text }}
                      >
                        {urg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span style={{ color: "#6b6b80" }}>{task.project}</span>
                      <span style={{ color: OWNER_COLORS[task.owner] || "#a0a0b0" }}>{task.owner}</span>
                      {task.due && (
                        <span className="font-mono ml-auto" style={{ color: "#6b6b80" }}>
                          {formatDate(task.due)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alert Counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-lg font-bold" style={{ color: heartbeat.missing_data > 0 ? "#f59e0b" : "#22c55e" }}>
                {heartbeat.missing_data}
              </div>
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "#6b6b80" }}>
                Missing Data
              </div>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-lg font-bold" style={{ color: heartbeat.unreviewed_content > 0 ? "#f59e0b" : "#22c55e" }}>
                {heartbeat.unreviewed_content}
              </div>
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "#6b6b80" }}>
                Unreviewed
              </div>
            </div>
            <div className="rounded-xl border p-3 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-lg font-bold" style={{ color: heartbeat.stale_outputs > 0 ? "#f59e0b" : "#22c55e" }}>
                {heartbeat.stale_outputs}
              </div>
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "#6b6b80" }}>
                Stale (&gt;7d)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ZONE D: Heartbeat Status Bar ── */}
      <Link
        href="/map-room/heartbeat"
        className="block rounded-xl border transition-all hover:border-[#2a2a3e] group"
        style={{ background: "#111118", borderColor: "#1e1e2e" }}
      >
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: hbStyle.dot }}
            />
            <span className="text-sm font-semibold" style={{ color: hbStyle.text }}>
              {heartbeat.status === "healthy" ? "Healthy" : heartbeat.status === "issues" ? "Issues Detected" : "Critical"}
            </span>
            <span className="text-xs" style={{ color: "#6b6b80" }}>
              ·
            </span>
            <span className="text-xs" style={{ color: "#6b6b80" }}>
              {heartbeat.issue_count} issue{heartbeat.issue_count !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span style={{ color: "#6b6b80" }}>
              Last heartbeat: <span className="font-mono">{timeAgo(heartbeat.last_run)}</span>
            </span>
            <svg
              className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#6b6b80"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
