"use client";

import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────── TYPES ─────────────────────────── */

interface AutoEntry {
  id: string;
  category: "automated" | "semi-auto" | "manual" | "gap" | "tool-evaluation";
  name: string;
  description: string;
  project_id: string;
  owner: string;
  tools: string[];
  status: string;
  last_run: string;
  health: "healthy" | "degraded" | "failing" | "unknown";
  effort_to_automate: string | null;
  impact: string | null;
  notes: string;
  frequency?: string;
  time_per_instance?: string;
  suggested_approach?: string;
  cost?: string;
  build_alternative?: string;
  verdict?: "build" | "buy" | "skip" | "";
}

type Category = AutoEntry["category"];

/* ─────────────────────────── CONSTANTS ─────────────────────── */

const T = {
  bg: "#0a0a0f", card: "#111118", border: "#1e1e2e",
  accent: "#00d4d4", warn: "#f59e0b", error: "#ef4444", success: "#22c55e",
  heading: "#ffffff", body: "#a0a0b0", muted: "#6b6b80",
  purple: "#a78bfa", blue: "#60a5fa",
};

const HEALTH_DOT: Record<string, string> = { healthy: T.success, degraded: T.warn, failing: T.error, unknown: "#6b7280" };

const OWNER_EMOJI: Record<string, string> = {
  ginge: "\uD83D\uDC51", atlas: "\uD83C\uDFAF", darwin: "\uD83D\uDD2C",
  newton: "\uD83E\uDDE0", "claude-code": "\uD83E\uDD16", system: "\u2699\uFE0F",
};

const SECTIONS: { key: Category; icon: string; label: string; color: string }[] = [
  { key: "automated", icon: "\u2705", label: "Automated", color: T.success },
  { key: "semi-auto", icon: "\uD83D\uDD04", label: "Semi-Automated", color: T.warn },
  { key: "manual", icon: "\u26A0\uFE0F", label: "Manual", color: T.warn },
  { key: "gap", icon: "\u274C", label: "Gaps", color: T.error },
  { key: "tool-evaluation", icon: "\uD83D\uDD0D", label: "Tool Evaluations", color: T.blue },
];

const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
  build: { color: T.accent, bg: "rgba(0,212,212,0.12)" },
  buy: { color: T.success, bg: "rgba(34,197,94,0.12)" },
  skip: { color: T.muted, bg: "rgba(107,107,128,0.12)" },
};

/* ─────────────────────────── COMPONENT ─────────────────────────── */

interface ManualAction {
  id: string;
  name: string;
  project_id: string;
  output: string;
  status: string;
  stage: string;
}

export default function AutomationMapPage() {
  const [entries, setEntries] = useState<AutoEntry[]>([]);
  const [manualActions, setManualActions] = useState<ManualAction[]>([]);
  const [collapsed, setCollapsed] = useState<Set<Category>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/automation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }).then((r) => r.json()).catch(() => null),
      fetch("/api/pipeline-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }).then((r) => r.json()).catch(() => null),
    ]).then(([autoData, taskData]) => {
      if (autoData?.entries) setEntries(autoData.entries);
      if (taskData?.tasks) {
        const gingePending = (taskData.tasks as ManualAction[]).filter(
          (t) => t.project_id !== "_template" && (t.status === "not_started" || t.status === "in_progress" || t.status === "blocked")
        ).filter((t) => {
          // Check if owner is ginge — need to read from the raw task
          const raw = taskData.tasks.find((r: { id: string; owner?: string }) => r.id === t.id);
          return raw?.owner === "ginge";
        });
        setManualActions(gingePending);
      }
    }).finally(() => setLoading(false));
  }, []);

  const byCategory = (cat: Category) => entries.filter((e) => e.category === cat);
  const toggle = (cat: Category) => setCollapsed((p) => { const n = new Set(p); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  const toggleNotes = (id: string) => setExpandedNotes((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const counts = {
    automated: byCategory("automated").length,
    "semi-auto": byCategory("semi-auto").length,
    manual: byCategory("manual").length,
    gap: byCategory("gap").length,
  };

  const timeAgo = (iso: string) => {
    if (!iso) return "\u2014";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  /* ── Add entry handler ── */
  const addEntry = useCallback(async (data: Partial<AutoEntry>) => {
    const id = data.id || `${data.category}-${Date.now().toString(36)}`;
    try {
      const r = await fetch("/api/automation-map", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer apex-live-2026" },
        body: JSON.stringify({ action: "set", id, ...data }),
      });
      const saved = await r.json();
      if (saved?.id) setEntries((prev) => [...prev, saved]);
    } catch { /* silent */ }
    setShowAdd(false);
  }, []);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: T.muted }}>Loading automation map...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: T.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>Automation Map</h2>
          <p style={{ color: T.body, fontSize: 14, margin: "4px 0 0" }}>What's automated, what's manual, what's missing</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          background: "rgba(0,212,212,0.1)", border: `1px solid ${T.accent}`, color: T.accent,
          cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
        }}>
          + Add Item
        </button>
      </div>

      {/* ── Summary Bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Automated", icon: "\u2705", count: counts.automated, color: T.success },
          { label: "Semi-Auto", icon: "\uD83D\uDD04", count: counts["semi-auto"], color: T.warn },
          { label: "Manual", icon: "\u26A0\uFE0F", count: counts.manual, color: T.warn },
          { label: "Gaps", icon: "\u274C", count: counts.gap, color: T.error },
        ].map((s) => (
          <div key={s.label} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div>
              <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.count}</div>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Manual Actions Required ── */}
      {manualActions.length > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.04)", border: `1px solid rgba(245,158,11,0.25)`,
          borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>{"\uD83D\uDC51"}</span>
            <h3 style={{ color: T.warn, fontSize: 14, fontWeight: 700, margin: 0 }}>Manual Actions Required</h3>
            <span style={{ color: T.muted, fontSize: 12, marginLeft: "auto" }}>{manualActions.length} task{manualActions.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {manualActions.map((t) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                borderRadius: 8, background: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.1)", fontSize: 13,
              }}>
                <span style={{ color: T.warn, fontSize: 10, fontWeight: 700, fontFamily: "monospace", minWidth: 60 }}>{t.id}</span>
                <span style={{ color: T.heading, fontWeight: 600, flex: 1 }}>{t.name}</span>
                <span style={{ background: "rgba(0,212,212,0.08)", color: T.accent, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                  {t.project_id}
                </span>
                {t.output && (
                  <span style={{ color: T.muted, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.output}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sections ── */}
      {SECTIONS.map((sec) => {
        const items = byCategory(sec.key);
        const isOpen = !collapsed.has(sec.key);

        return (
          <div key={sec.key} style={{
            background: "rgba(17,17,24,0.7)", backdropFilter: "blur(12px)",
            border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden",
          }}>
            {/* Section header */}
            <div
              onClick={() => toggle(sec.key)}
              style={{
                padding: "14px 20px", cursor: "pointer", userSelect: "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: T.accent, fontSize: 10, transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
                <span style={{ fontSize: 14 }}>{sec.icon}</span>
                <span style={{ color: sec.color, fontSize: 15, fontWeight: 700 }}>{sec.label}</span>
              </div>
              <span style={{ color: T.muted, fontSize: 12 }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Rows */}
            {isOpen && (
              <div style={{ borderTop: `1px solid ${T.border}` }}>
                {items.length === 0 ? (
                  <p style={{ color: T.muted, fontSize: 13, padding: "16px 20px", margin: 0 }}>No items in this category</p>
                ) : (
                  items.map((entry) => (
                    <div key={entry.id}>
                      <div
                        style={{
                          padding: "10px 20px", borderBottom: `1px solid rgba(30,30,46,0.5)`,
                          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13,
                          cursor: entry.notes ? "pointer" : "default",
                        }}
                        onClick={() => entry.notes && toggleNotes(entry.id)}
                      >
                        {/* Name */}
                        <span style={{ color: T.heading, fontWeight: 600, minWidth: 160 }}>{entry.name}</span>

                        {/* Project badge */}
                        {entry.project_id && entry.project_id !== "_template" && (
                          <span style={{ background: "rgba(0,212,212,0.08)", color: T.accent, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                            {entry.project_id}
                          </span>
                        )}

                        {/* Owner */}
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          {OWNER_EMOJI[entry.owner] || "\uD83D\uDC64"} {entry.owner || "unassigned"}
                        </span>

                        {/* Category-specific columns */}
                        {sec.key === "automated" && (
                          <>
                            <span style={{ color: T.muted, fontSize: 11, flex: 1 }}>
                              {entry.tools.length > 0 ? entry.tools.join(", ") : "\u2014"}
                            </span>
                            <span style={{ color: T.muted, fontSize: 11 }}>{timeAgo(entry.last_run)}</span>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: HEALTH_DOT[entry.health] || "#6b7280", flexShrink: 0 }} title={entry.health} />
                          </>
                        )}

                        {sec.key === "semi-auto" && (
                          <>
                            <span style={{ color: T.body, fontSize: 11, flex: 1, fontStyle: "italic" }}>
                              {entry.notes || entry.description}
                            </span>
                            {entry.effort_to_automate && (
                              <span style={{ color: T.purple, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(167,139,250,0.12)" }}>
                                {entry.effort_to_automate}
                              </span>
                            )}
                          </>
                        )}

                        {sec.key === "manual" && (
                          <>
                            {entry.frequency && <span style={{ color: T.muted, fontSize: 11 }}>{entry.frequency}</span>}
                            {entry.time_per_instance && <span style={{ color: T.muted, fontSize: 11 }}>{entry.time_per_instance}</span>}
                            {entry.impact && (
                              <span style={{ color: T.warn, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.12)", marginLeft: "auto" }}>
                                {entry.impact}
                              </span>
                            )}
                          </>
                        )}

                        {sec.key === "gap" && (
                          <>
                            <span style={{ color: T.body, fontSize: 11, flex: 1 }}>{entry.description}</span>
                            {entry.impact && (
                              <span style={{ color: T.error, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.12)" }}>
                                {entry.impact}
                              </span>
                            )}
                            {entry.effort_to_automate && (
                              <span style={{ color: T.muted, fontSize: 10 }}>Effort: {entry.effort_to_automate}</span>
                            )}
                          </>
                        )}

                        {sec.key === "tool-evaluation" && (
                          <>
                            <span style={{ color: T.body, fontSize: 11, flex: 1 }}>{entry.description}</span>
                            {entry.cost && <span style={{ color: T.muted, fontSize: 10 }}>{entry.cost}</span>}
                            {entry.verdict && VERDICT_STYLE[entry.verdict] && (
                              <span style={{
                                color: VERDICT_STYLE[entry.verdict].color,
                                background: VERDICT_STYLE[entry.verdict].bg,
                                fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 4,
                                textTransform: "uppercase",
                              }}>
                                {entry.verdict}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Expanded notes/details */}
                      {expandedNotes.has(entry.id) && entry.notes && (
                        <div style={{ padding: "8px 20px 12px 40px", borderBottom: `1px solid rgba(30,30,46,0.5)` }}>
                          <p style={{ margin: 0, color: T.body, fontSize: 12, lineHeight: 1.5 }}>{entry.notes}</p>
                          {entry.suggested_approach && (
                            <p style={{ margin: "6px 0 0", color: T.accent, fontSize: 12 }}>
                              <span style={{ fontWeight: 600 }}>Suggested: </span>{entry.suggested_approach}
                            </p>
                          )}
                          {entry.build_alternative && (
                            <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 11 }}>
                              Build alternative: {entry.build_alternative}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add Modal ── */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={addEntry} />}
    </div>
  );
}

/* ─────────────────────────── ADD MODAL ─────────────────────────── */

function AddModal({ onClose, onSave }: { onClose: () => void; onSave: (d: Partial<AutoEntry>) => void }) {
  const [cat, setCat] = useState<Category>("manual");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [proj, setProj] = useState("");
  const [owner, setOwner] = useState("");
  const [tools, setTools] = useState("");
  const [effort, setEffort] = useState("");
  const [impact, setImpact] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      category: cat, name: name.trim(), description: desc.trim(),
      project_id: proj.trim(), owner: owner.trim(),
      tools: tools ? tools.split(",").map((t) => t.trim()) : [],
      effort_to_automate: effort || null, impact: impact || null, notes: notes.trim(),
    });
  };

  const inputStyle: React.CSSProperties = {
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
    padding: "8px 12px", color: T.heading, fontSize: 13, width: "100%",
    outline: "none",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 999,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <h3 style={{ color: T.heading, fontSize: 16, fontWeight: 700, margin: 0 }}>Add Automation Item</h3>

        <select value={cat} onChange={(e) => setCat(e.target.value as Category)} style={inputStyle}>
          <option value="automated">Automated</option>
          <option value="semi-auto">Semi-Automated</option>
          <option value="manual">Manual</option>
          <option value="gap">Gap</option>
          <option value="tool-evaluation">Tool Evaluation</option>
        </select>

        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Project ID" value={proj} onChange={(e) => setProj(e.target.value)} style={inputStyle} />
          <input placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle} />
        </div>
        <input placeholder="Tools (comma-separated)" value={tools} onChange={(e) => setTools(e.target.value)} style={inputStyle} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Effort to automate" value={effort} onChange={(e) => setEffort(e.target.value)} style={inputStyle} />
          <input placeholder="Impact" value={impact} onChange={(e) => setImpact(e.target.value)} style={inputStyle} />
        </div>
        <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer", fontSize: 13, padding: "8px 16px", borderRadius: 8 }}>Cancel</button>
          <button onClick={submit} style={{ background: T.accent, border: "none", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 8 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
