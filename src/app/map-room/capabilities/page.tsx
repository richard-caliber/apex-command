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
interface AutomationGap {
  id: string;
  name: string;
  current_process: string;
  impact: string;
  approach: "build" | "buy" | "integrate";
  priority: "critical" | "high" | "medium" | "low";
  status: "identified" | "researching" | "building" | "done";
}

interface ResearchNote {
  id: string;
  tool_name: string;
  what_it_does: string;
  cost: string;
  complexity: "easy" | "medium" | "hard";
  notes: string;
  decision: "use" | "skip" | "revisit";
}

interface Opportunity {
  id: string;
  name: string;
  description: string;
  estimated_effort: string;
  estimated_impact: string;
  status: string;
}

interface OpportunityBoard {
  id: string;
  title: string;
  opportunities: Opportunity[];
}

interface CapabilitiesData {
  gaps: AutomationGap[];
  research: ResearchNote[];
  boards: OpportunityBoard[];
  lastUpdated: string;
}

/* ── Priority & Status Badges ── */
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", color: C.error },
  high: { bg: "rgba(245,158,11,0.15)", color: C.warn },
  medium: { bg: "rgba(0,212,212,0.12)", color: C.accent },
  low: { bg: "rgba(107,107,128,0.15)", color: C.muted },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  identified: { bg: "rgba(107,107,128,0.15)", color: C.body },
  researching: { bg: "rgba(0,212,212,0.12)", color: C.accent },
  building: { bg: "rgba(245,158,11,0.15)", color: C.warn },
  done: { bg: "rgba(34,197,94,0.15)", color: C.success },
};

const APPROACH_OPTIONS = ["build", "buy", "integrate"] as const;
const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const GAP_STATUS_OPTIONS = ["identified", "researching", "building", "done"] as const;
const COMPLEXITY_OPTIONS = ["easy", "medium", "hard"] as const;
const DECISION_OPTIONS = ["use", "skip", "revisit"] as const;

/* ── Main Page ── */
export default function CapabilitiesPage() {
  const [data, setData] = useState<CapabilitiesData | null>(null);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [editingGap, setEditingGap] = useState<string | null>(null);
  const [gapDraft, setGapDraft] = useState<Partial<AutomationGap>>({});
  const [addingGap, setAddingGap] = useState(false);
  const [addingResearch, setAddingResearch] = useState(false);
  const [researchDraft, setResearchDraft] = useState<Partial<ResearchNote>>({});
  const [editingResearch, setEditingResearch] = useState<string | null>(null);
  const [addingOpp, setAddingOpp] = useState<string | null>(null);
  const [oppDraft, setOppDraft] = useState<Partial<Opportunity>>({});

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/map-room/capabilities");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleBoard = (id: string) => {
    setExpandedBoards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── Gap CRUD ── */
  const saveGap = async (action: "add" | "update") => {
    const item = {
      id: action === "add" ? `gap-${Date.now()}` : gapDraft.id,
      name: gapDraft.name || "",
      current_process: gapDraft.current_process || "",
      impact: gapDraft.impact || "",
      approach: gapDraft.approach || "build",
      priority: gapDraft.priority || "medium",
      status: gapDraft.status || "identified",
    };
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "gaps", action, item }),
    });
    setAddingGap(false);
    setEditingGap(null);
    setGapDraft({});
    fetchData();
  };

  const deleteGap = async (id: string) => {
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "gaps", action: "delete", itemId: id }),
    });
    fetchData();
  };

  /* ── Research CRUD ── */
  const saveResearch = async (action: "add" | "update") => {
    const item = {
      id: action === "add" ? `rn-${Date.now()}` : researchDraft.id,
      tool_name: researchDraft.tool_name || "",
      what_it_does: researchDraft.what_it_does || "",
      cost: researchDraft.cost || "",
      complexity: researchDraft.complexity || "medium",
      notes: researchDraft.notes || "",
      decision: researchDraft.decision || "revisit",
    };
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "research", action, item }),
    });
    setAddingResearch(false);
    setEditingResearch(null);
    setResearchDraft({});
    fetchData();
  };

  const deleteResearch = async (id: string) => {
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "research", action: "delete", itemId: id }),
    });
    fetchData();
  };

  /* ── Opportunity CRUD ── */
  const saveOpp = async (boardId: string) => {
    const item = {
      id: `opp-${Date.now()}`,
      name: oppDraft.name || "",
      description: oppDraft.description || "",
      estimated_effort: oppDraft.estimated_effort || "",
      estimated_impact: oppDraft.estimated_impact || "",
      status: oppDraft.status || "identified",
    };
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "boards", action: "add", boardId, item }),
    });
    setAddingOpp(null);
    setOppDraft({});
    fetchData();
  };

  const deleteOpp = async (boardId: string, itemId: string) => {
    await fetch("/api/map-room/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ target: "boards", action: "delete", boardId, itemId }),
    });
    fetchData();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: C.heading }}>
          Capabilities
        </h2>
        <p className="text-sm mt-1" style={{ color: C.body }}>
          If something should be automated but is not, it should appear here clearly.
        </p>
      </div>

      {!data && (
        <div className="text-sm animate-pulse" style={{ color: C.muted }}>Loading capabilities...</div>
      )}

      {/* ══════════ SECTION 1: AUTOMATION GAP LIST ══════════ */}
      {data && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold" style={{ color: C.heading }}>
                Automation Gap List
              </h3>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,212,212,0.15)", color: C.accent }}
              >
                {data.gaps.length}
              </span>
            </div>
            <button
              onClick={() => { setAddingGap(true); setGapDraft({}); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: "rgba(0,212,212,0.1)", color: C.accent, border: "1px solid rgba(0,212,212,0.2)" }}
            >
              + Add Gap
            </button>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
            {/* Table Header */}
            <div
              className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] uppercase tracking-wider font-semibold border-b"
              style={{ color: C.muted, borderColor: C.border }}
            >
              <div className="col-span-3">Gap Name</div>
              <div className="col-span-3">Current Process</div>
              <div className="col-span-2">Impact if Automated</div>
              <div className="col-span-1">Approach</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Add Row */}
            {addingGap && (
              <div className="border-b px-5 py-3 space-y-3" style={{ borderColor: C.border, background: "rgba(0,212,212,0.03)" }}>
                <div className="grid grid-cols-12 gap-2 items-start">
                  <input
                    className="col-span-3 rounded border px-2 py-1.5 text-sm focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    placeholder="Gap name"
                    value={gapDraft.name || ""}
                    onChange={(e) => setGapDraft({ ...gapDraft, name: e.target.value })}
                  />
                  <input
                    className="col-span-3 rounded border px-2 py-1.5 text-sm focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    placeholder="Current process"
                    value={gapDraft.current_process || ""}
                    onChange={(e) => setGapDraft({ ...gapDraft, current_process: e.target.value })}
                  />
                  <input
                    className="col-span-2 rounded border px-2 py-1.5 text-sm focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    placeholder="Impact"
                    value={gapDraft.impact || ""}
                    onChange={(e) => setGapDraft({ ...gapDraft, impact: e.target.value })}
                  />
                  <select
                    className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    value={gapDraft.approach || "build"}
                    onChange={(e) => setGapDraft({ ...gapDraft, approach: e.target.value as AutomationGap["approach"] })}
                  >
                    {APPROACH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select
                    className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    value={gapDraft.priority || "medium"}
                    onChange={(e) => setGapDraft({ ...gapDraft, priority: e.target.value as AutomationGap["priority"] })}
                  >
                    {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select
                    className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none"
                    style={{ background: C.bg, borderColor: C.border, color: C.heading }}
                    value={gapDraft.status || "identified"}
                    onChange={(e) => setGapDraft({ ...gapDraft, status: e.target.value as AutomationGap["status"] })}
                  >
                    {GAP_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button onClick={() => saveGap("add")} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ background: C.accent, color: C.bg }}>Save</button>
                    <button onClick={() => { setAddingGap(false); setGapDraft({}); }} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: C.muted }}>X</button>
                  </div>
                </div>
              </div>
            )}

            {/* Gap Rows */}
            {data.gaps.map((gap) => {
              const ps = PRIORITY_STYLE[gap.priority] || PRIORITY_STYLE.medium;
              const ss = STATUS_STYLE[gap.status] || STATUS_STYLE.identified;
              const isEditing = editingGap === gap.id;

              if (isEditing) {
                return (
                  <div key={gap.id} className="border-b px-5 py-3" style={{ borderColor: C.border, background: "rgba(0,212,212,0.03)" }}>
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <input className="col-span-3 rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.name || ""} onChange={(e) => setGapDraft({ ...gapDraft, name: e.target.value })} />
                      <input className="col-span-3 rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.current_process || ""} onChange={(e) => setGapDraft({ ...gapDraft, current_process: e.target.value })} />
                      <input className="col-span-2 rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.impact || ""} onChange={(e) => setGapDraft({ ...gapDraft, impact: e.target.value })} />
                      <select className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.approach || "build"} onChange={(e) => setGapDraft({ ...gapDraft, approach: e.target.value as AutomationGap["approach"] })}>
                        {APPROACH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.priority || "medium"} onChange={(e) => setGapDraft({ ...gapDraft, priority: e.target.value as AutomationGap["priority"] })}>
                        {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className="col-span-1 rounded border px-1 py-1.5 text-xs focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={gapDraft.status || "identified"} onChange={(e) => setGapDraft({ ...gapDraft, status: e.target.value as AutomationGap["status"] })}>
                        {GAP_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <button onClick={() => saveGap("update")} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ background: C.accent, color: C.bg }}>Save</button>
                        <button onClick={() => { setEditingGap(null); setGapDraft({}); }} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: C.muted }}>X</button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={gap.id}
                  className="grid grid-cols-12 gap-2 px-5 py-3 items-center border-b group transition-colors"
                  style={{ borderColor: C.border }}
                >
                  <div className="col-span-3 text-sm font-medium" style={{ color: C.heading }}>{gap.name}</div>
                  <div className="col-span-3 text-sm" style={{ color: C.body }}>{gap.current_process}</div>
                  <div className="col-span-2 text-sm" style={{ color: C.body }}>{gap.impact}</div>
                  <div className="col-span-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}>
                      {gap.approach}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: ps.bg, color: ps.color }}>
                      {gap.priority}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: ss.bg, color: ss.color }}>
                      {gap.status}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingGap(gap.id); setGapDraft(gap); }}
                      className="text-xs px-2 py-1 rounded cursor-pointer"
                      style={{ color: C.accent }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteGap(gap.id)}
                      className="text-xs px-2 py-1 rounded cursor-pointer"
                      style={{ color: C.error }}
                    >
                      Del
                    </button>
                  </div>
                </div>
              );
            })}

            {data.gaps.length === 0 && !addingGap && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: C.muted }}>
                  No automation gaps identified.{" "}
                  <button onClick={() => { setAddingGap(true); setGapDraft({}); }} className="underline cursor-pointer" style={{ color: C.accent }}>
                    Add one
                  </button>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════ SECTION 2: CAPABILITY RESEARCH NOTES ══════════ */}
      {data && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold" style={{ color: C.heading }}>
                Capability Research Notes
              </h3>
              <span
                className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,212,212,0.15)", color: C.accent }}
              >
                {data.research.length}
              </span>
            </div>
            <button
              onClick={() => { setAddingResearch(true); setResearchDraft({}); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: "rgba(0,212,212,0.1)", color: C.accent, border: "1px solid rgba(0,212,212,0.2)" }}
            >
              + Add Note
            </button>
          </div>

          {/* Add Research Form */}
          {addingResearch && (
            <ResearchForm
              draft={researchDraft}
              setDraft={setResearchDraft}
              onSave={() => saveResearch("add")}
              onCancel={() => { setAddingResearch(false); setResearchDraft({}); }}
              label="Add Note"
            />
          )}

          {/* Research Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.research.map((note) => {
              if (editingResearch === note.id) {
                return (
                  <ResearchForm
                    key={note.id}
                    draft={researchDraft}
                    setDraft={setResearchDraft}
                    onSave={() => saveResearch("update")}
                    onCancel={() => { setEditingResearch(null); setResearchDraft({}); }}
                    label="Save"
                  />
                );
              }
              const complexColor = note.complexity === "easy" ? C.success : note.complexity === "hard" ? C.error : C.warn;
              const decisionColor = note.decision === "use" ? C.success : note.decision === "skip" ? C.error : C.warn;
              return (
                <div
                  key={note.id}
                  className="rounded-xl border p-4 group"
                  style={{ background: C.card, borderColor: C.border }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold" style={{ color: C.heading }}>{note.tool_name}</h4>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingResearch(note.id); setResearchDraft(note); }} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: C.accent }}>Edit</button>
                      <button onClick={() => deleteResearch(note.id)} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: C.error }}>Del</button>
                    </div>
                  </div>
                  <p className="text-sm mb-3" style={{ color: C.body }}>{note.what_it_does}</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(107,107,128,0.15)", color: C.body }}>{note.cost}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={{ background: `${complexColor}15`, color: complexColor }}>{note.complexity}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full uppercase font-semibold" style={{ background: `${decisionColor}15`, color: decisionColor }}>{note.decision}</span>
                  </div>
                  {note.notes && <p className="text-xs" style={{ color: C.muted }}>{note.notes}</p>}
                </div>
              );
            })}
          </div>

          {data.research.length === 0 && !addingResearch && (
            <div className="text-center py-8 rounded-xl border" style={{ background: C.card, borderColor: C.border }}>
              <p className="text-sm" style={{ color: C.muted }}>
                No tools or APIs being evaluated.{" "}
                <button onClick={() => { setAddingResearch(true); setResearchDraft({}); }} className="underline cursor-pointer" style={{ color: C.accent }}>
                  Add a research note
                </button>
              </p>
            </div>
          )}
        </section>
      )}

      {/* ══════════ SECTION 3: OPPORTUNITY BOARDS ══════════ */}
      {data && (
        <section>
          <h3 className="text-lg font-bold mb-4" style={{ color: C.heading }}>
            Opportunity Boards
          </h3>

          <div className="space-y-3">
            {data.boards.map((board) => {
              const isOpen = expandedBoards.has(board.id);
              const isPlaceholder = board.title.startsWith("[PLACEHOLDER]");

              return (
                <div
                  key={board.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: C.card, borderColor: C.border }}
                >
                  <button
                    onClick={() => toggleBoard(board.id)}
                    className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors"
                    style={{ color: C.heading }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{board.title}</span>
                      {isPlaceholder && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(107,107,128,0.15)", color: C.muted }}>
                          🔌 Placeholder
                        </span>
                      )}
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: board.opportunities.length > 0 ? "rgba(0,212,212,0.15)" : "rgba(107,107,128,0.15)", color: board.opportunities.length > 0 ? C.accent : C.muted }}
                      >
                        {board.opportunities.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddingOpp(board.id); setOppDraft({}); if (!isOpen) toggleBoard(board.id); }}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer"
                        style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}
                      >
                        + Add
                      </button>
                      <span className="text-xs" style={{ color: C.muted }}>{isOpen ? "\u25BC" : "\u25B6"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: C.border }}>
                      {addingOpp === board.id && (
                        <div className="rounded-lg border p-4 space-y-3" style={{ background: "rgba(0,212,212,0.03)", borderColor: "rgba(0,212,212,0.15)" }}>
                          <div className="grid grid-cols-2 gap-3">
                            <input className="rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} placeholder="Opportunity name" value={oppDraft.name || ""} onChange={(e) => setOppDraft({ ...oppDraft, name: e.target.value })} />
                            <input className="rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} placeholder="Status" value={oppDraft.status || ""} onChange={(e) => setOppDraft({ ...oppDraft, status: e.target.value })} />
                          </div>
                          <textarea className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none resize-y" style={{ background: C.bg, borderColor: C.border, color: C.heading }} placeholder="Description" rows={2} value={oppDraft.description || ""} onChange={(e) => setOppDraft({ ...oppDraft, description: e.target.value })} />
                          <div className="grid grid-cols-2 gap-3">
                            <input className="rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} placeholder="Estimated effort" value={oppDraft.estimated_effort || ""} onChange={(e) => setOppDraft({ ...oppDraft, estimated_effort: e.target.value })} />
                            <input className="rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} placeholder="Estimated impact" value={oppDraft.estimated_impact || ""} onChange={(e) => setOppDraft({ ...oppDraft, estimated_impact: e.target.value })} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveOpp(board.id)} className="text-xs px-3 py-1.5 rounded cursor-pointer" style={{ background: C.accent, color: C.bg }}>Add</button>
                            <button onClick={() => { setAddingOpp(null); setOppDraft({}); }} className="text-xs px-3 py-1.5 rounded cursor-pointer" style={{ color: C.muted }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {board.opportunities.length === 0 && addingOpp !== board.id && (
                        <div className="text-center py-6">
                          <p className="text-sm" style={{ color: C.muted }}>
                            No opportunities yet.{" "}
                            <button onClick={() => { setAddingOpp(board.id); setOppDraft({}); }} className="underline cursor-pointer" style={{ color: C.accent }}>
                              Add one
                            </button>
                          </p>
                        </div>
                      )}

                      {board.opportunities.map((opp) => (
                        <div key={opp.id} className="rounded-lg border p-3 group" style={{ background: C.bg, borderColor: C.border }}>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: C.heading }}>{opp.name}</span>
                                {opp.status && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}>{opp.status}</span>}
                              </div>
                              <p className="text-xs" style={{ color: C.body }}>{opp.description}</p>
                              <div className="flex gap-3 text-[11px]" style={{ color: C.muted }}>
                                {opp.estimated_effort && <span>Effort: {opp.estimated_effort}</span>}
                                {opp.estimated_impact && <span>Impact: {opp.estimated_impact}</span>}
                              </div>
                            </div>
                            <button onClick={() => deleteOpp(board.id, opp.id)} className="text-xs px-2 py-1 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.error }}>Del</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="text-center text-xs py-4" style={{ color: C.muted }}>
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "\u2014"}
        {" \u00B7 "}All fields: ✏️ Manual
      </div>
    </div>
  );
}

/* ── Research Form ── */
function ResearchForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  label,
}: {
  draft: Partial<ResearchNote>;
  setDraft: (d: Partial<ResearchNote>) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3 mb-4" style={{ background: "rgba(0,212,212,0.03)", borderColor: "rgba(0,212,212,0.15)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ Tool Name</label>
          <input className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={draft.tool_name || ""} onChange={(e) => setDraft({ ...draft, tool_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ Cost</label>
          <input className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={draft.cost || ""} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ What it Does</label>
        <textarea className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none resize-y" style={{ background: C.bg, borderColor: C.border, color: C.heading }} rows={2} value={draft.what_it_does || ""} onChange={(e) => setDraft({ ...draft, what_it_does: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ Complexity</label>
          <select className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={draft.complexity || "medium"} onChange={(e) => setDraft({ ...draft, complexity: e.target.value as ResearchNote["complexity"] })}>
            {COMPLEXITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ Decision</label>
          <select className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none" style={{ background: C.bg, borderColor: C.border, color: C.heading }} value={draft.decision || "revisit"} onChange={(e) => setDraft({ ...draft, decision: e.target.value as ResearchNote["decision"] })}>
            {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>✏️ Notes</label>
        <textarea className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none resize-y" style={{ background: C.bg, borderColor: C.border, color: C.heading }} rows={2} value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="text-xs px-4 py-2 rounded-lg cursor-pointer" style={{ background: C.accent, color: C.bg }}>{label}</button>
        <button onClick={onCancel} className="text-xs px-4 py-2 rounded-lg cursor-pointer" style={{ color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
      </div>
    </div>
  );
}
