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

const TOKEN = "apex-live-2026";

/* ── Types ── */
interface HeartbeatIssue {
  id: string;
  [key: string]: unknown;
}

interface HeartbeatSection {
  id: string;
  title: string;
  items: HeartbeatIssue[];
}

interface HeartbeatData {
  lastRun: string;
  status: "all-clear" | "issues-found" | "critical";
  nextRun: string | null;
  sections: HeartbeatSection[];
  lastUpdated: string;
}

/* ── Section config ── */
const SECTION_META: Record<string, { icon: string; emptyAction: string }> = {
  "failed-checks": { icon: "\u2716", emptyAction: "All checks passing" },
  "missed-tasks": { icon: "\u23F0", emptyAction: "No overdue tasks" },
  "missing-data": { icon: "\uD83D\uDCC9", emptyAction: "All required data present" },
  "unreviewed-posts": { icon: "\uD83D\uDC41\uFE0F", emptyAction: "All posts reviewed" },
  "stale-outputs": { icon: "\uD83E\uDDF3", emptyAction: "All outputs fresh" },
  "unresolved-bottlenecks": { icon: "\uD83D\uDEA7", emptyAction: "No open bottlenecks" },
};

const SEVERITY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", color: C.error, label: "Critical" },
  warning: { bg: "rgba(245,158,11,0.15)", color: C.warn, label: "Warning" },
  info: { bg: "rgba(0,212,212,0.12)", color: C.accent, label: "Info" },
};

/* ── Main Page ── */
export default function HeartbeatPage() {
  const [data, setData] = useState<HeartbeatData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([
    "failed-checks", "missed-tasks", "missing-data", "unreviewed-posts", "stale-outputs", "unresolved-bottlenecks",
  ]));

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/map-room/heartbeat");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resolve = async (itemId: string) => {
    await fetch("/api/map-room/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "resolve", itemId }),
    });
    fetchData();
  };

  const runNow = async () => {
    await fetch("/api/map-room/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "run" }),
    });
    fetchData();
  };

  const totalIssues = data ? data.sections.reduce((sum, s) => sum + s.items.length, 0) : 0;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  const statusConfig = {
    "all-clear": { label: "All Clear", color: C.success, icon: "\u2705" },
    "issues-found": { label: "Issues Found", color: C.warn, icon: "\u26A0\uFE0F" },
    "critical": { label: "Critical Issues", color: C.error, icon: "\uD83D\uDED1" },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: C.heading }}>
          Heartbeat
        </h2>
        <p className="text-sm mt-1" style={{ color: C.body }}>
          Audit layer. What should have happened vs what actually happened. Nothing slips.
        </p>
      </div>

      {!data && (
        <div className="text-sm animate-pulse" style={{ color: C.muted }}>Loading heartbeat...</div>
      )}

      {/* ══════════ RUN STATUS BAR ══════════ */}
      {data && (() => {
        const sc = statusConfig[data.status] || statusConfig["issues-found"];
        return (
          <div
            className="rounded-xl border p-5"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left: Status */}
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Status</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{sc.icon}</span>
                    <span className="text-base font-bold" style={{ color: sc.color }}>{sc.label}</span>
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                      style={{ background: `${sc.color}20`, color: sc.color }}
                    >
                      {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="border-l pl-6" style={{ borderColor: C.border }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Last Run</div>
                  <div className="text-sm font-mono" style={{ color: C.body }}>{formatDate(data.lastRun)}</div>
                </div>

                <div className="border-l pl-6" style={{ borderColor: C.border }}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>Next Scheduled Run</div>
                  <div className="text-sm" style={{ color: C.muted }}>
                    {data.nextRun ? formatDate(data.nextRun) : (
                      <span className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)" }}>🔌 Placeholder</span>
                        <span>Cron integration</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Run Now */}
              <button
                onClick={runNow}
                className="text-sm font-medium px-5 py-2.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: "rgba(0,212,212,0.1)",
                  color: C.accent,
                  border: "1px solid rgba(0,212,212,0.25)",
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)", color: C.muted }}>🔌</span>
                  Run Now
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══════════ ISSUE SECTIONS ══════════ */}
      {data?.sections.map((section) => {
        const meta = SECTION_META[section.id] || { icon: "\u2022", emptyAction: "Nothing here" };
        const isOpen = expanded.has(section.id);
        const count = section.items.length;

        return (
          <div
            key={section.id}
            className="rounded-xl border overflow-hidden"
            style={{ background: C.card, borderColor: C.border }}
          >
            {/* Section Header */}
            <button
              onClick={() => toggle(section.id)}
              className="w-full px-5 py-4 flex items-center justify-between cursor-pointer transition-colors"
              style={{ color: C.heading }}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{meta.icon}</span>
                <span className="font-semibold text-base">{section.title}</span>
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: count > 0
                      ? (section.id === "failed-checks" || section.id === "unresolved-bottlenecks"
                        ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)")
                      : "rgba(34,197,94,0.15)",
                    color: count > 0
                      ? (section.id === "failed-checks" || section.id === "unresolved-bottlenecks"
                        ? C.error : C.warn)
                      : C.success,
                  }}
                >
                  {count}
                </span>
              </div>
              <span className="text-xs" style={{ color: C.muted }}>
                {isOpen ? "\u25BC" : "\u25B6"}
              </span>
            </button>

            {/* Section Content */}
            {isOpen && (
              <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: C.border }}>
                {count === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm" style={{ color: C.success }}>
                      {meta.emptyAction}
                    </p>
                  </div>
                )}

                {/* ── FAILED CHECKS ── */}
                {section.id === "failed-checks" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.name)}</span>
                          {item.severity ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...(SEVERITY_BADGE[String(item.severity)] || SEVERITY_BADGE.warning) }}>
                              {(SEVERITY_BADGE[String(item.severity)] || SEVERITY_BADGE.warning).label}
                            </span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Expected</span>
                            <span style={{ color: C.success }}>{String(item.expected)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Actual</span>
                            <span style={{ color: C.error }}>{String(item.actual)}</span>
                          </div>
                        </div>
                        {item.suggested ? (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Suggested Fix</span>
                            <span className="text-sm" style={{ color: C.body }}>{String(item.suggested)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── MISSED TASKS ── */}
                {section.id === "missed-tasks" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.name)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.15)", color: C.error }}>
                            {String(item.days_overdue)}d overdue
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs" style={{ color: C.body }}>
                          <span>Project: <strong style={{ color: C.heading }}>{String(item.project)}</strong></span>
                          <span>Owner: <strong style={{ color: C.accent }}>{String(item.owner)}</strong></span>
                          <span>Due: <strong style={{ color: C.error }}>{String(item.due)}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── MISSING DATA ── */}
                {section.id === "missing-data" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.name)}</span>
                        <div className="flex gap-4 text-xs" style={{ color: C.body }}>
                          <span>Needed for: <strong>{String(item.needed_for)}</strong></span>
                          <span>Expected from: <strong>{String(item.expected_source)}</strong></span>
                        </div>
                      </div>
                      <button
                        className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0 transition-colors"
                        style={{ background: "rgba(0,212,212,0.1)", color: C.accent, border: "1px solid rgba(0,212,212,0.2)" }}
                      >
                        Create Task
                      </button>
                    </div>
                  </div>
                ))}

                {/* ── UNREVIEWED POSTS ── */}
                {section.id === "unreviewed-posts" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.title)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>
                            {String(item.days_since)}d since post
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs" style={{ color: C.body }}>
                          <span>Platform: <strong>{String(item.platform)}</strong></span>
                          <span>Posted: <strong>{String(item.posted)}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── STALE OUTPUTS ── */}
                {section.id === "stale-outputs" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.name)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,158,11,0.15)", color: C.warn }}>
                            {String(item.days_stale)}d stale
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs" style={{ color: C.body }}>
                          <span>Project: <strong>{String(item.project)}</strong></span>
                          <span>Stage: <strong>{String(item.stage)}</strong></span>
                          <span>Last updated: <strong>{String(item.last_updated)}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── UNRESOLVED BOTTLENECKS ── */}
                {section.id === "unresolved-bottlenecks" && section.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4" style={{ background: C.bg, borderColor: C.border }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <span className="text-sm font-medium" style={{ color: C.heading }}>{String(item.name)}</span>
                        <div className="flex gap-4 text-xs" style={{ color: C.body }}>
                          <span>Project: <strong>{String(item.project)}</strong></span>
                          <span>Stage: <strong>{String(item.stage)}</strong></span>
                          <span>Flagged: <strong>{String(item.flagged)}</strong></span>
                          <span>Owner: <strong style={{ color: C.accent }}>{String(item.owner)}</strong></span>
                        </div>
                      </div>
                      <button
                        onClick={() => resolve(item.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0 transition-colors"
                        style={{ background: "rgba(34,197,94,0.1)", color: C.success, border: "1px solid rgba(34,197,94,0.2)" }}
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── What Heartbeat Audits ── */}
      {data && (
        <div className="rounded-xl border p-5" style={{ background: C.card, borderColor: C.border }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: C.heading }}>What Heartbeat Audits</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Task deadlines", desc: "Flags overdue tasks across all projects" },
              { label: "Post frequency", desc: "Checks posting cadence against targets" },
              { label: "Data freshness", desc: "Identifies stale reports and outputs" },
              { label: "Post review gaps", desc: "Finds published posts with no performance review" },
              { label: "Missing inputs", desc: "Detects data needed for stage decisions" },
              { label: "Bottleneck age", desc: "Escalates unresolved blockers by duration" },
            ].map((audit) => (
              <div key={audit.label} className="rounded-lg p-3" style={{ background: C.bg }}>
                <div className="text-xs font-medium mb-1" style={{ color: C.accent }}>{audit.label}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{audit.desc}</div>
                <div className="mt-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)", color: C.muted }}>
                    ⚡ Auto-generated
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs py-4" style={{ color: C.muted }}>
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "\u2014"}
        {" \u00B7 "}Detection logic: 🔌 Placeholder — UI shows what Heartbeat will audit
      </div>
    </div>
  );
}
