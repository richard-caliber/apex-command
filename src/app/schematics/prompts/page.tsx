"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

const TOKEN = "apex-live-2026";

/* ── Types ── */
interface PromptContent {
  role: string;
  context: string;
  objective: string;
  constraints: string;
  process: string;
  outputFormat: string;
  qualityBar: string;
}

interface PromptRecord {
  id: string;
  name: string;
  stage?: string;
  taskId?: string;
  category: string;
  owner: string;
  model: string;
  version: number;
  tags: string[];
  prompt: PromptContent | string;
  usage: { timesUsed: number; lastUsed: string | null; lastEditedBy: string };
  created_at: string;
  updated_at: string;
}

function getPromptText(prompt: PromptContent | string): string {
  if (typeof prompt === "string") return prompt;
  return Object.entries(prompt)
    .filter(([, v]) => v)
    .map(([k, v]) => `## ${k.replace(/([A-Z])/g, " $1").trim().toUpperCase()}\n${v}`)
    .join("\n\n");
}

/* ── Constants ── */

const PIPELINE_STAGES = ["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"];

const STAGE_LABELS: Record<string, string> = {
  inbox: "Inbox", idea: "Idea", validation: "Validation", design: "Design",
  mvp: "MVP", traffic: "Traffic", conversion: "Conversion", delivery: "Delivery", scale: "Scale",
};

const CATEGORY_COLORS: Record<string, string> = {
  research: "#3b82f6", strategy: "#f59e0b", creative: "#a855f7", review: "#ef4444",
  build: "#22c55e", analytics: "#06b6d4", ops: "#6b7280", qa: "#ec4899",
  intake: "#8b5cf6", content: "#a855f7", sales: "#f59e0b", system: "#6b7280",
  experimental: "#ec4899", general: "#6b7280",
};

const OWNER_EMOJI: Record<string, string> = {
  ginge: "\u{1F464}", atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}",
  "claude-code": "\u{1F4BB}", auto: "\u26A1", system: "\u2699\uFE0F",
};

const OWNER_COLOR: Record<string, string> = {
  newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4",
  "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280", system: "#6b7280",
};

// Keywords that indicate a maintenance/periodic prompt
const MAINTENANCE_KEYWORDS = ["review", "audit", "cleanup", "check", "monitor", "housekeep", "verify", "reconcil", "sweep", "prune"];

function isMaintenance(p: PromptRecord): boolean {
  if (["ops", "qa", "system"].includes(p.category)) return true;
  const lower = p.name.toLowerCase();
  return MAINTENANCE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPipeline(p: PromptRecord): boolean {
  return !!p.stage && PIPELINE_STAGES.includes(p.stage);
}

/* ── Main ── */
export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("_all");
  const [categoryFilter, setCategoryFilter] = useState("_all");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [editingInline, setEditingInline] = useState<string | null>(null);
  const [inlineText, setInlineText] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [taskOwners, setTaskOwners] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["_adhoc"]));

  const fetchData = useCallback(async () => {
    try {
      const [promptRes, taskRes] = await Promise.all([
        fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify({ action: "list" }),
        }),
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        }).catch(() => new Response("{}")),
      ]);
      if (promptRes.ok) setPrompts(await promptRes.json());
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        const owners: Record<string, string> = {};
        for (const t of taskData.tasks || []) {
          if (t.prompt_id && t.owner) owners[t.prompt_id] = t.owner;
        }
        setTaskOwners(owners);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Apply filters ── */
  const applyFilters = useCallback((items: PromptRecord[]) => {
    let result = items;
    if (ownerFilter !== "_all") result = result.filter((p) => (taskOwners[p.id] || p.owner) === ownerFilter);
    if (categoryFilter !== "_all") result = result.filter((p) => p.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (typeof p.prompt === "string" ? p.prompt.toLowerCase().includes(q) :
          Object.values(p.prompt).some((v) => typeof v === "string" && v.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [ownerFilter, categoryFilter, search, taskOwners]);

  /* ── Classify prompts into three groups ── */
  const adhocPrompts = useMemo(() => {
    const items = prompts.filter((p) => !isPipeline(p) && !isMaintenance(p));
    return applyFilters(items);
  }, [prompts, applyFilters]);

  const maintenancePrompts = useMemo(() => {
    const items = prompts.filter((p) => isMaintenance(p) && !isPipeline(p));
    return applyFilters(items);
  }, [prompts, applyFilters]);

  const pipelineSections = useMemo(() => {
    const pipelineItems = applyFilters(prompts.filter((p) => isPipeline(p)));
    return PIPELINE_STAGES.map((stageId) => ({
      id: stageId,
      label: STAGE_LABELS[stageId],
      prompts: pipelineItems.filter((p) => p.stage === stageId),
    }));
  }, [prompts, applyFilters]);

  const totalFiltered = adhocPrompts.length + maintenancePrompts.length + pipelineSections.reduce((s, sec) => s + sec.prompts.length, 0);

  /* ── Unique values for filters ── */
  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => set.add(taskOwners[p.id] || p.owner));
    return [...set].sort();
  }, [prompts, taskOwners]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    prompts.forEach((p) => set.add(p.category));
    return [...set].sort();
  }, [prompts]);

  const activeFilterCount = (ownerFilter !== "_all" ? 1 : 0) + (categoryFilter !== "_all" ? 1 : 0) + (search ? 1 : 0);

  /* ── Actions ── */
  const copyPrompt = (p: PromptRecord) => {
    navigator.clipboard.writeText(getPromptText(p.prompt));
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveFullPrompt = async (promptId: string, text: string) => {
    const p = prompts.find((pr) => pr.id === promptId);
    if (!p) return;
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "set", id: p.id, name: p.name, prompt: text }),
    });
    setEditingInline(null);
    fetchData();
  };

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Render a single prompt row (shared by all sections) ── */
  function PromptRow({ p }: { p: PromptRecord }) {
    const isOpen = expandedPrompt === p.id;
    const catColor = CATEGORY_COLORS[p.category] || "#6b7280";
    const resolvedOwner = taskOwners[p.id] || p.owner;
    const owEmoji = OWNER_EMOJI[resolvedOwner] || "\u2753";
    const owColor = OWNER_COLOR[resolvedOwner] || "#6b6b80";

    return (
      <div>
        <button
          onClick={() => setExpandedPrompt(isOpen ? null : p.id)}
          className="w-full flex items-center gap-3 py-2 px-3 cursor-pointer transition-colors hover:bg-white/[0.02] text-left"
          style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}
        >
          <span className="text-[11px] font-mono font-bold flex-shrink-0" style={{ color: "#00d4d4", minWidth: "52px" }}>{p.id}</span>
          <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "#e0e0ee" }}>{p.name}</span>
          <span className="text-[10px] flex-shrink-0 hidden sm:inline font-medium" style={{ color: owColor }}>{owEmoji} {resolvedOwner}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase" style={{ background: `${catColor}18`, color: catColor }}>{p.category}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color: "#3a3a4e" }}>{isOpen ? "\u25B2" : "\u25BC"}</span>
        </button>

        {isOpen && (() => {
          const fullText = getPromptText(p.prompt);
          const isEditingThis = editingInline === p.id;

          return (
            <div className="px-3 pb-3 pt-2 ml-[64px] mr-2" onClick={(e) => e.stopPropagation()}>
              {p.taskId && (
                <div className="mb-2 text-[11px]" style={{ color: "#6b6b80" }}>
                  Used by: <Link href="/map-room/tasks" className="underline" style={{ color: "#00d4d4" }}>{p.taskId}</Link>
                </div>
              )}

              <div className="rounded-lg overflow-hidden mb-3" style={{ background: "rgba(10,14,26,0.8)", border: "1px solid #1e293b" }}>
                {isEditingThis ? (
                  <div className="p-3">
                    <textarea
                      autoFocus
                      value={inlineText[p.id] ?? fullText}
                      onChange={(e) => setInlineText({ ...inlineText, [p.id]: e.target.value })}
                      className="w-full bg-transparent text-[11px] font-mono leading-relaxed resize-y outline-none"
                      style={{ color: "#cbd5e1", minHeight: "200px", maxHeight: "400px" }}
                    />
                    <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: "1px solid rgba(30,30,46,0.4)" }}>
                      <button onClick={() => saveFullPrompt(p.id, inlineText[p.id] ?? fullText)} className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}>Save</button>
                      <button onClick={() => setEditingInline(null)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "#6b6b80" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap p-4 overflow-y-auto" style={{ color: "#94a3b8", maxHeight: "400px" }}>
                    {fullText || "(empty prompt)"}
                  </pre>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyPrompt(p)}
                  className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer transition-colors"
                  style={{ background: copied === p.id ? "#00d4d4" : "rgba(0,212,212,0.1)", color: copied === p.id ? "#0a0a0f" : "#00d4d4", border: "1px solid rgba(0,212,212,0.2)" }}
                >
                  {copied === p.id ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={() => { setEditingInline(p.id); setInlineText({ ...inlineText, [p.id]: fullText }); }}
                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                  style={{ color: "#6b6b80", border: "1px solid #1e293b" }}
                >
                  Edit
                </button>
                {p.version > 0 && (
                  <span className="text-[9px] font-mono ml-auto" style={{ color: "#3a3a4e" }}>v{p.version}</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-5">
        {/* Title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{"\uD83D\uDCDC"}</span>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Prompt Library</h2>
            <p className="text-xs text-[#64748b]">
              {totalFiltered} of {prompts.length} prompts
              <span className="ml-2 text-[#475569]">({adhocPrompts.length} ad hoc + {maintenancePrompts.length} maintenance + {pipelineSections.reduce((s, sec) => s + sec.prompts.length, 0)} pipeline)</span>
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="flex-1 min-w-[200px] max-w-md text-sm px-4 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white placeholder-[#475569] outline-none focus:border-[#00d4d4] transition-colors"
          />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
            style={{ borderColor: ownerFilter !== "_all" ? OWNER_COLOR[ownerFilter] || "#00d4d4" : "#1e293b" }}
          >
            <option value="_all">All Owners</option>
            {uniqueOwners.map((o) => (
              <option key={o} value={o}>{OWNER_EMOJI[o] || ""} {o}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2.5 rounded-xl border border-[#1e293b] bg-[#111827] text-white outline-none cursor-pointer"
            style={{ borderColor: categoryFilter !== "_all" ? CATEGORY_COLORS[categoryFilter] || "#00d4d4" : "#1e293b" }}
          >
            <option value="_all">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("_all"); setCategoryFilter("_all"); }}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl cursor-pointer transition-colors"
              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading prompts...</p>
        ) : (
          <div className="space-y-3">
            {/* ═══════ SECTION 1: Ad Hoc Prompts ═══════ */}
            <CollapsibleSection
              id="_adhoc"
              label={"\uD83D\uDD27 Ad Hoc Prompts"}
              count={adhocPrompts.length}
              isOpen={expanded.has("_adhoc")}
              onToggle={toggleSection}
              accent
            >
              {adhocPrompts.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-[#475569]">No ad hoc prompts.</div>
              ) : (
                <div>{adhocPrompts.map((p) => <PromptRow key={p.id} p={p} />)}</div>
              )}
            </CollapsibleSection>

            {/* ═══════ SECTION 2: Maintenance Prompts ═══════ */}
            {maintenancePrompts.length > 0 && (
              <CollapsibleSection
                id="_maintenance"
                label={"\uD83D\uDD04 Maintenance Prompts"}
                count={maintenancePrompts.length}
                isOpen={expanded.has("_maintenance")}
                onToggle={toggleSection}
              >
                <div>{maintenancePrompts.map((p) => <PromptRow key={p.id} p={p} />)}</div>
              </CollapsibleSection>
            )}

            {/* ═══════ SECTION 3: Pipeline Prompts (by stage) ═══════ */}
            {pipelineSections.map((section) => {
              if (section.prompts.length === 0) return null;
              const stageIdx = PIPELINE_STAGES.indexOf(section.id);
              return (
                <CollapsibleSection
                  key={section.id}
                  id={section.id}
                  label={`Stage ${stageIdx}: ${section.label}`}
                  count={section.prompts.length}
                  isOpen={expanded.has(section.id)}
                  onToggle={toggleSection}
                >
                  <div>{section.prompts.map((p) => <PromptRow key={p.id} p={p} />)}</div>
                </CollapsibleSection>
              );
            })}
          </div>
        )}
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
        style={{ maxHeight: isOpen ? "5000px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
