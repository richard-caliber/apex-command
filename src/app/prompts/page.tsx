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

/** Get the full prompt text regardless of format */
function getPromptText(prompt: PromptContent | string): string {
  if (typeof prompt === "string") return prompt;
  return Object.entries(prompt)
    .filter(([, v]) => v)
    .map(([k, v]) => `## ${k.replace(/([A-Z])/g, " $1").trim().toUpperCase()}\n${v}`)
    .join("\n\n");
}

/** Check if prompt is a structured object with sections */
function isStructuredPrompt(prompt: PromptContent | string): prompt is PromptContent {
  return typeof prompt === "object" && prompt !== null;
}

/* ── Constants ── */
const STAGES = [
  { id: "_all", label: "All" },
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

const CATEGORY_COLORS: Record<string, string> = {
  research: "#3b82f6",
  strategy: "#f59e0b",
  creative: "#a855f7",
  review: "#ef4444",
  build: "#22c55e",
  analytics: "#06b6d4",
  ops: "#6b7280",
  qa: "#ec4899",
  intake: "#8b5cf6",
  content: "#a855f7",
  sales: "#f59e0b",
  system: "#6b7280",
  experimental: "#ec4899",
  general: "#6b7280",
};

const OWNER_EMOJI: Record<string, string> = {
  ginge: "\u{1F464}", atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}",
  "claude-code": "\u{1F4BB}", auto: "\u26A1", system: "\u2699\uFE0F",
};

const OWNER_COLOR: Record<string, string> = {
  newton: "#3b82f6",
  darwin: "#22c55e",
  atlas: "#00d4d4",
  "claude-code": "#a855f7",
  ginge: "#f59e0b",
  auto: "#6b7280",
  system: "#6b7280",
};


/* ── Main ── */
export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("_all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<PromptRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingInline, setEditingInline] = useState<string | null>(null);
  const [inlineText, setInlineText] = useState<Record<string, string>>({});
  const [taskOwners, setTaskOwners] = useState<Record<string, string>>({});
  const [ownerFilter, setOwnerFilter] = useState("_all");
  const [categoryFilter, setCategoryFilter] = useState("_all");

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
        // Build prompt_id → owner map (tasks reference prompts via prompt_id)
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

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let items = prompts;
    if (stageFilter !== "_all") {
      items = items.filter((p) => p.stage === stageFilter);
    }
    if (ownerFilter !== "_all") {
      items = items.filter((p) => (taskOwners[p.id] || p.owner) === ownerFilter);
    }
    if (categoryFilter !== "_all") {
      items = items.filter((p) => p.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (typeof p.prompt === "string" ? p.prompt.toLowerCase().includes(q) :
          Object.values(p.prompt).some((v) => typeof v === "string" && v.toLowerCase().includes(q)))
      );
    }
    return items;
  }, [prompts, stageFilter, ownerFilter, categoryFilter, search, taskOwners]);

  /* ── Stage counts ── */
  const stageCounts = useMemo(() => STAGES.map((s) => ({
    ...s,
    count: s.id === "_all" ? prompts.length : prompts.filter((p) => p.stage === s.id).length,
  })), [prompts]);

  /* ── Unique owners and categories for filter dropdowns ── */
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

  const activeFilterCount = (stageFilter !== "_all" ? 1 : 0) + (ownerFilter !== "_all" ? 1 : 0) + (categoryFilter !== "_all" ? 1 : 0);

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

  const savePrompt = async (data: PromptRecord) => {
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "set", ...data }),
    });
    setEditing(null);
    setAdding(false);
    setEditData(null);
    fetchData();
  };

  const startAdd = () => {
    setAdding(true);
    setEditData({
      id: "", name: "", category: "general", owner: "atlas", model: "claude-sonnet-4-6",
      version: 0, tags: [], prompt: "",
      usage: { timesUsed: 0, lastUsed: null, lastEditedBy: "atlas" },
      created_at: "", updated_at: "",
    });
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f", color: "#f1f5f9" }}>
      {/* Header */}
      <header className="hidden sm:block border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="hidden sm:flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <span className="text-sm text-white font-medium">Prompt Library</span>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/vault" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Keys</Link>
              <Link href="/tasks" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Task List</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
              <Link href="/content-factory" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Content Factory</Link>
              <Link href="/action-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Action Room</Link>
            </nav>
          </div>
          <button onClick={startAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>
            + Add Prompt
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* ── Stage Rail ── */}
        <nav className="overflow-x-auto scrollbar-hide -mx-1 mb-4">
          <div className="flex items-center gap-1 min-w-max px-1 py-1">
            {stageCounts.map((stage, i) => (
              <div key={stage.id} className="flex items-center">
                <button
                  onClick={() => setStageFilter(stage.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: stageFilter === stage.id
                      ? "rgba(0,212,212,0.15)"
                      : stage.count > 0 ? "rgba(0,212,212,0.06)" : "rgba(30,30,46,0.6)",
                    border: `1px solid ${stageFilter === stage.id ? "rgba(0,212,212,0.4)" : stage.count > 0 ? "rgba(0,212,212,0.15)" : "rgba(30,30,46,0.8)"}`,
                    color: stageFilter === stage.id ? "#00d4d4" : stage.count > 0 ? "#00d4d4" : "#6b6b80",
                  }}
                >
                  <span className="text-[11px] font-semibold">{stage.label}</span>
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                    style={{
                      background: stage.count > 0 ? "rgba(0,212,212,0.2)" : "rgba(107,107,128,0.15)",
                      color: stage.count > 0 ? "#00d4d4" : "#6b6b80",
                    }}
                  >
                    {stage.count}
                  </span>
                </button>
                {i < stageCounts.length - 1 && stage.id !== "_all" && (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mx-0.5">
                    <path d="M7 5L13 10L7 15" stroke="#2a2a3e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {stage.id === "_all" && (
                  <div className="w-px h-4 mx-2" style={{ background: "#2a2a3e" }} />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* ── Search ── */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts by name, content, or tag..."
            className="w-full text-xs bg-transparent border rounded-lg px-3 py-2 focus:outline-none transition-colors"
            style={{ borderColor: search ? "#00d4d4" : "#1e293b", color: "#f1f5f9" }}
          />
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Owner filter */}
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-[11px] bg-transparent border rounded px-2 py-1 cursor-pointer focus:outline-none"
            style={{ borderColor: ownerFilter !== "_all" ? OWNER_COLOR[ownerFilter] || "#00d4d4" : "#1e293b", color: ownerFilter !== "_all" ? OWNER_COLOR[ownerFilter] || "#00d4d4" : "#6b6b80" }}
          >
            <option value="_all">All owners</option>
            {uniqueOwners.map((o) => (
              <option key={o} value={o}>{OWNER_EMOJI[o] || ""} {o}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-[11px] bg-transparent border rounded px-2 py-1 cursor-pointer focus:outline-none"
            style={{ borderColor: categoryFilter !== "_all" ? CATEGORY_COLORS[categoryFilter] || "#00d4d4" : "#1e293b", color: categoryFilter !== "_all" ? CATEGORY_COLORS[categoryFilter] || "#00d4d4" : "#6b6b80" }}
          >
            <option value="_all">All categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setStageFilter("_all"); setOwnerFilter("_all"); setCategoryFilter("_all"); setSearch(""); }}
              className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
              style={{ color: "#00d4d4", background: "rgba(0,212,212,0.08)" }}
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}

          {/* Count */}
          <span className="text-[11px] font-mono ml-auto" style={{ color: "#4a4a5e" }}>
            {filtered.length} prompt{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Prompt Rows ── */}
        {loading ? (
          <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading prompts...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-12" style={{ color: "#3a3a4e" }}>No prompts found</p>
        ) : (
          <div>
            {filtered.map((p) => {
              const isOpen = expanded === p.id;
              const catColor = CATEGORY_COLORS[p.category] || "#6b7280";
              // Resolve owner from linked task (tasks reference prompts by prompt_id)
              const resolvedOwner = taskOwners[p.id] || p.owner;
              const owEmoji = OWNER_EMOJI[resolvedOwner] || "\u2753";
              const owColor = OWNER_COLOR[resolvedOwner] || "#6b6b80";

              return (
                <div key={p.id}>
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className="w-full flex items-center gap-3 py-2 px-2 cursor-pointer transition-colors hover:bg-white/[0.02] text-left"
                    style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}
                  >
                    {/* ID */}
                    <span className="text-[11px] font-mono font-bold flex-shrink-0" style={{ color: "#00d4d4", minWidth: "52px" }}>
                      {p.id}
                    </span>

                    {/* Name */}
                    <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "#e0e0ee" }}>
                      {p.name}
                    </span>

                    {/* Owner — from linked task */}
                    <span className="text-[10px] flex-shrink-0 hidden sm:inline font-medium" style={{ color: owColor }}>
                      {owEmoji} {resolvedOwner}
                    </span>

                    {/* Category pill */}
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase"
                      style={{ background: `${catColor}18`, color: catColor }}
                    >
                      {p.category}
                    </span>

                    {/* Stage badge */}
                    {p.stage && (
                      <span className="text-[9px] font-mono flex-shrink-0 hidden sm:inline" style={{ color: "#4a4a5e" }}>
                        {p.stage}
                      </span>
                    )}

                    {/* Arrow */}
                    <span className="text-[10px] flex-shrink-0" style={{ color: "#3a3a4e" }}>
                      {isOpen ? "\u25B2" : "\u25BC"}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (() => {
                    const fullText = getPromptText(p.prompt);
                    const isEditingThis = editingInline === p.id;

                    return (
                      <div
                        className="px-2 pb-3 pt-2 ml-[64px] mr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Linked task */}
                        {p.taskId && (
                          <div className="mb-2 text-[11px]" style={{ color: "#6b6b80" }}>
                            Used by:{" "}
                            <Link href="/map-room/tasks" className="underline" style={{ color: "#00d4d4" }}>
                              {p.taskId}
                            </Link>
                          </div>
                        )}

                        {/* Prompt text block */}
                        <div
                          className="rounded-lg overflow-hidden mb-3"
                          style={{ background: "rgba(10,14,26,0.8)", border: "1px solid #1e293b" }}
                        >
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
                                <button
                                  onClick={() => saveFullPrompt(p.id, inlineText[p.id] ?? fullText)}
                                  className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer"
                                  style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingInline(null)}
                                  className="text-[10px] px-2 py-1 rounded cursor-pointer"
                                  style={{ color: "#6b6b80" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <pre
                              className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap p-4 overflow-y-auto"
                              style={{ color: "#94a3b8", maxHeight: "400px" }}
                            >
                              {fullText || "(empty prompt)"}
                            </pre>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyPrompt(p)}
                            className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer transition-colors"
                            style={{
                              background: copied === p.id ? "#00d4d4" : "rgba(0,212,212,0.1)",
                              color: copied === p.id ? "#0a0a0f" : "#00d4d4",
                              border: "1px solid rgba(0,212,212,0.2)",
                            }}
                          >
                            {copied === p.id ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingInline(p.id);
                              setInlineText({ ...inlineText, [p.id]: fullText });
                            }}
                            className="text-[10px] px-2 py-1 rounded cursor-pointer"
                            style={{ color: "#6b6b80", border: "1px solid #1e293b" }}
                          >
                            Edit
                          </button>
                          {p.version > 0 && (
                            <span className="text-[9px] font-mono ml-auto" style={{ color: "#3a3a4e" }}>
                              v{p.version}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Editor Modal ── */}
        {(adding || editing) && editData && (
          <PromptEditor
            data={editData}
            isNew={adding}
            onChange={setEditData}
            onSave={() => savePrompt(editData)}
            onCancel={() => { setAdding(false); setEditing(null); setEditData(null); }}
          />
        )}
      </main>
    </div>
  );
}

/* ── Editor Modal ── */
function PromptEditor({ data, isNew, onChange, onSave, onCancel }: {
  data: PromptRecord; isNew: boolean;
  onChange: (d: PromptRecord) => void; onSave: () => void; onCancel: () => void;
}) {
  const set = (f: string, v: unknown) => onChange({ ...data, [f]: v });
  const promptText = getPromptText(data.prompt);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancel}>
      <div className="w-full max-w-[800px] max-h-[85vh] overflow-y-auto rounded-xl border p-6 space-y-4"
        style={{ background: "#111827", borderColor: "#1e293b" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white">{isNew ? "Add Prompt" : `Edit ${data.id}`}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Inp label="ID" value={data.id} onChange={(v) => set("id", v)} placeholder="P-3.01" mono disabled={!isNew} />
          <Inp label="Name" value={data.name} onChange={(v) => set("name", v)} placeholder="Landing Page Generator" />
          <Inp label="Category" value={data.category} onChange={(v) => set("category", v)} placeholder="system" />
          <Inp label="Owner" value={data.owner} onChange={(v) => set("owner", v)} placeholder="atlas" />
          <Inp label="Model" value={data.model} onChange={(v) => set("model", v)} placeholder="claude-opus-4-6" />
          <Inp label="Stage" value={data.stage || ""} onChange={(v) => set("stage", v || undefined)} placeholder="mvp" />
          <Inp label="Task ID" value={data.taskId || ""} onChange={(v) => set("taskId", v || undefined)} placeholder="T-3.01" />
          <Inp label="Tags (comma)" value={data.tags.join(", ")} onChange={(v) => set("tags", v.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="landing-page, mvp" />
        </div>
        <div className="pt-2">
          <label className="text-[10px] uppercase tracking-wider font-bold mb-1 block" style={{ color: "#64748b" }}>Prompt</label>
          <textarea
            value={promptText}
            onChange={(e) => set("prompt", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none"
            style={{ background: "#0a0e1a", borderColor: "#1e293b", color: "#f1f5f9", minHeight: "250px" }}
            placeholder="Full prompt text..."
          />
        </div>
        <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "#1e293b" }}>
          <button onClick={onSave} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>
            {isNew ? "Create" : "Save"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{ color: "#64748b", border: "1px solid #1e293b" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Inp({ label, value, onChange, placeholder, mono, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-bold mb-1 block" style={{ color: "#64748b" }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-50 ${mono ? "font-mono" : ""}`}
        style={{ background: "#0a0e1a", borderColor: "#1e293b", color: "#f1f5f9" }}
      />
    </div>
  );
}
