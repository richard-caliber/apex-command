"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Design Tokens ── */
const C = {
  bg: "#0a0a0f",
  card: "#111118",
  border: "#1e1e2e",
  accent: "#00d4d4",
  warn: "#f59e0b",
  error: "#ef4444",
  success: "#22c55e",
  heading: "#ffffff",
  body: "#a0a0b0",
  muted: "#6b6b80",
};

const OWNER_COLORS: Record<string, string> = {
  newton: "#3b82f6",
  darwin: "#22c55e",
  atlas: "#00d4d4",
};

/* ── Types ── */
interface RunEntry {
  timestamp: string;
  status: "ran_ok" | "failed";
  duration_ms: number | null;
  error?: string;
}

interface CronJob {
  id: string;
  name: string;
  description: string;
  owner: string;
  schedule: string;
  category: "content" | "data" | "review" | "automation";
  last_run: string | null;
  last_status: "ran_ok" | "failed" | "not_configured" | "running" | "paused";
  next_run: string | null;
  duration_ms: number | null;
  enabled: boolean;
  history: RunEntry[];
}

type Category = "all" | "content" | "data" | "review" | "automation";

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "content", label: "Content Pipeline" },
  { key: "data", label: "Data Collection" },
  { key: "review", label: "Reviews" },
  { key: "automation", label: "Automation" },
];

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  ran_ok: { icon: "✅", label: "Ran OK", color: C.success },
  failed: { icon: "❌", label: "Failed", color: C.error },
  not_configured: { icon: "⚫", label: "Not Configured", color: C.muted },
  running: { icon: "🔄", label: "Running", color: C.accent },
  paused: { icon: "⏸️", label: "Paused", color: C.warn },
};

/* ── Helpers ── */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

/* ── Main Page ── */
export default function HeartbeatPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const d = await r.json();
      if (d?.jobs) setJobs(d.jobs);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = activeTab === "all" ? jobs : jobs.filter((j) => j.category === activeTab);
  const ranOk = jobs.filter((j) => j.last_status === "ran_ok").length;
  const failed = jobs.filter((j) => j.last_status === "failed").length;
  const notConfigured = jobs.filter((j) => j.last_status === "not_configured").length;

  // Find next scheduled job
  const upcoming = jobs
    .filter((j) => j.next_run && j.enabled)
    .sort((a, b) => new Date(a.next_run!).getTime() - new Date(b.next_run!).getTime());
  const nextJob = upcoming[0] || null;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: C.heading }}>
          Heartbeat
        </h2>
        <p className="text-sm mt-1" style={{ color: C.body }}>
          Cron monitor. What&apos;s scheduled, did it run.
        </p>
      </div>

      {loading && (
        <div className="text-sm animate-pulse" style={{ color: C.muted }}>
          Loading heartbeat...
        </div>
      )}

      {/* ══════════ SUMMARY BAR ══════════ */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Jobs", value: jobs.length, color: C.heading },
            { label: "Ran OK", value: ranOk, color: C.success, suffix: " ✅" },
            { label: "Failed", value: failed, color: C.error, suffix: " ❌" },
            { label: "Not Configured", value: notConfigured, color: C.muted, suffix: " ⚫" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border p-4"
              style={{ background: C.card, borderColor: C.border }}
            >
              <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ color: C.muted }}
              >
                {stat.label}
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: stat.color }}>
                {stat.value}
                {stat.suffix && <span className="text-sm">{stat.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next Scheduled */}
      {!loading && nextJob && (
        <div
          className="rounded-lg border px-4 py-2.5 text-sm flex items-center gap-2"
          style={{ background: C.card, borderColor: C.border, color: C.body }}
        >
          <span style={{ color: C.accent }}>▶</span>
          <span>
            Next scheduled:{" "}
            <strong style={{ color: C.heading }}>{nextJob.name}</strong>
            {" — "}
            <span style={{ color: C.accent }}>{formatDate(nextJob.next_run)}</span>
          </span>
        </div>
      )}

      {/* ══════════ CATEGORY FILTER TABS ══════════ */}
      {!loading && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === "all" ? jobs.length : jobs.filter((j) => j.category === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors"
                style={{
                  background: isActive ? "rgba(0,212,212,0.12)" : "transparent",
                  color: isActive ? C.accent : C.muted,
                  border: `1px solid ${isActive ? "rgba(0,212,212,0.3)" : C.border}`,
                }}
              >
                {tab.label}{" "}
                <span
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? "rgba(0,212,212,0.15)" : "rgba(107,107,128,0.1)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════ JOB TABLE ══════════ */}
      {!loading && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: C.card, borderColor: C.border }}
        >
          {/* Table Header */}
          <div
            className="grid px-4 py-3 text-[10px] uppercase tracking-wider font-bold"
            style={{
              gridTemplateColumns: "32px 1.8fr 0.7fr 1fr 1fr 1fr 0.6fr",
              color: C.muted,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span></span>
            <span>Job Name</span>
            <span>Owner</span>
            <span>Schedule</span>
            <span>Last Run</span>
            <span>Next Run</span>
            <span>Duration</span>
          </div>

          {/* Table Rows */}
          {filtered.map((job) => {
            const st = STATUS_CONFIG[job.last_status] || STATUS_CONFIG.not_configured;
            const isExpanded = expandedId === job.id;
            const isFailed = job.last_status === "failed";
            const isRunning = job.last_status === "running";
            const ownerColor = OWNER_COLORS[job.owner] || C.body;

            return (
              <div key={job.id}>
                {/* Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  className="grid px-4 py-3 text-sm items-center cursor-pointer transition-colors"
                  style={{
                    gridTemplateColumns: "32px 1.8fr 0.7fr 1fr 1fr 1fr 0.6fr",
                    borderBottom: `1px solid rgba(30,30,46,0.5)`,
                    background: isFailed
                      ? "rgba(239,68,68,0.04)"
                      : isRunning
                        ? "rgba(0,212,212,0.03)"
                        : "transparent",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = isFailed
                      ? "rgba(239,68,68,0.08)"
                      : "rgba(255,255,255,0.02)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = isFailed
                      ? "rgba(239,68,68,0.04)"
                      : isRunning
                        ? "rgba(0,212,212,0.03)"
                        : "transparent")
                  }
                >
                  {/* Status Icon */}
                  <span
                    className="text-sm"
                    style={isRunning ? { animation: "pulse 2s ease-in-out infinite" } : {}}
                  >
                    {st.icon}
                  </span>

                  {/* Job Name */}
                  <span style={{ color: C.heading, fontWeight: 500 }}>{job.name}</span>

                  {/* Owner */}
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                    style={{
                      background: `${ownerColor}18`,
                      color: ownerColor,
                    }}
                  >
                    {job.owner}
                  </span>

                  {/* Schedule */}
                  <span style={{ color: C.body, fontSize: 12 }}>{job.schedule}</span>

                  {/* Last Run */}
                  <span
                    style={{
                      color: job.last_run ? (isFailed ? C.error : C.body) : C.muted,
                      fontSize: 12,
                    }}
                  >
                    {job.last_run ? formatDate(job.last_run) : "Never"}
                    {isFailed && job.last_run && (
                      <span className="ml-1 text-[10px]" style={{ color: C.error }}>
                        (failed)
                      </span>
                    )}
                  </span>

                  {/* Next Run */}
                  <span style={{ color: job.next_run ? C.body : C.muted, fontSize: 12 }}>
                    {job.next_run ? formatDate(job.next_run) : "—"}
                  </span>

                  {/* Duration */}
                  <span style={{ color: C.muted, fontSize: 12, fontFamily: "monospace" }}>
                    {formatDuration(job.duration_ms)}
                  </span>
                </div>

                {/* ── Expanded Detail ── */}
                {isExpanded && (
                  <div
                    className="px-4 py-4 space-y-4"
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {/* Description */}
                    <div>
                      <div
                        className="text-[10px] uppercase tracking-wider mb-1"
                        style={{ color: C.muted }}
                      >
                        Description
                      </div>
                      <p className="text-sm" style={{ color: C.body }}>
                        {job.description}
                      </p>
                    </div>

                    {/* Run History */}
                    <div>
                      <div
                        className="text-[10px] uppercase tracking-wider mb-2"
                        style={{ color: C.muted }}
                      >
                        Run History (Last 5)
                      </div>
                      {(!job.history || job.history.length === 0) && (
                        <p className="text-xs" style={{ color: C.muted }}>
                          No runs yet
                        </p>
                      )}
                      {job.history && job.history.length > 0 && (
                        <div className="space-y-1">
                          {/* History header */}
                          <div
                            className="grid text-[10px] uppercase tracking-wider font-bold pb-1"
                            style={{
                              gridTemplateColumns: "1fr 80px 80px 1fr",
                              color: C.muted,
                            }}
                          >
                            <span>Date</span>
                            <span>Status</span>
                            <span>Duration</span>
                            <span>Error</span>
                          </div>
                          {[...job.history]
                            .reverse()
                            .slice(0, 5)
                            .map((run, i) => (
                              <div
                                key={i}
                                className="grid text-xs py-1.5 rounded"
                                style={{
                                  gridTemplateColumns: "1fr 80px 80px 1fr",
                                  background:
                                    run.status === "failed"
                                      ? "rgba(239,68,68,0.06)"
                                      : "transparent",
                                }}
                              >
                                <span style={{ color: C.body }}>
                                  {formatShortDate(run.timestamp)}
                                </span>
                                <span
                                  style={{
                                    color:
                                      run.status === "ran_ok" ? C.success : C.error,
                                    fontWeight: 600,
                                  }}
                                >
                                  {run.status === "ran_ok" ? "✅ OK" : "❌ Failed"}
                                </span>
                                <span style={{ color: C.muted, fontFamily: "monospace" }}>
                                  {formatDuration(run.duration_ms)}
                                </span>
                                <span style={{ color: C.error }}>
                                  {run.error || "—"}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Error Log (for failed) */}
                      {job.last_status === "failed" &&
                        job.history?.some((h) => h.error) && (
                          <div className="mt-3">
                            <div
                              className="text-[10px] uppercase tracking-wider mb-1"
                              style={{ color: C.error }}
                            >
                              Error Log
                            </div>
                            <div
                              className="rounded-lg p-3 text-xs overflow-y-auto"
                              style={{
                                background: "rgba(239,68,68,0.06)",
                                border: `1px solid rgba(239,68,68,0.15)`,
                                maxHeight: 200,
                                fontFamily: "monospace",
                                color: C.error,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {[...job.history]
                                .reverse()
                                .filter((h) => h.error)
                                .slice(0, 3)
                                .map((h, i) => (
                                  <div key={i} className="mb-2">
                                    <span style={{ color: C.muted }}>
                                      [{formatShortDate(h.timestamp)}]
                                    </span>{" "}
                                    {h.error}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: C.muted }}>
                No jobs in this category
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs py-3" style={{ color: C.muted }}>
        {jobs.length} scheduled jobs · Atlas manages crons via OpenClaw
      </div>

      {/* Running pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
