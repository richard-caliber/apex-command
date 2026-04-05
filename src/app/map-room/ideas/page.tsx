"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const TOKEN = "apex-live-2026";
const API = "/api/map-room/ideas";

/* ── Commentary Types ── */
interface Commentary {
  id: string;
  agent: string;
  emoji: string;
  text: string;
  updated_at: string;
}

const AGENT_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  atlas: { border: "#00d4d4", bg: "rgba(0, 212, 212, 0.06)", label: "Atlas" },
  newton: { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.06)", label: "Newton" },
  darwin: { border: "#22c55e", bg: "rgba(34, 197, 94, 0.06)", label: "Darwin" },
};

/* ── Types ── */
interface Idea {
  id: string;
  title: string;
  description: string;
  status: "raw" | "expanded" | "queued" | "parked" | "zombie";
  tags: string[];
  image_url: string;
  notes: string;
  linked_project: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

type Status = Idea["status"];

/* ── Constants ── */
const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "raw", label: "Raw", color: "#6b7280" },
  { id: "expanded", label: "Expanded", color: "#00d4d4" },
  { id: "queued", label: "Queued", color: "#f59e0b" },
  { id: "parked", label: "Parked", color: "#6366f1" },
  { id: "zombie", label: "Zombie", color: "#ef4444" },
];

const STATUS_COLOR: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.id, s.color]));

const GRADIENTS = [
  "from-teal-900/40 to-slate-900/60",
  "from-purple-900/40 to-slate-900/60",
  "from-blue-900/40 to-slate-900/60",
  "from-amber-900/40 to-slate-900/60",
  "from-rose-900/40 to-slate-900/60",
  "from-emerald-900/40 to-slate-900/60",
];

/* ── Main ── */
export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Quick capture
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureTags, setCaptureTags] = useState("");


  const fetchData = useCallback(async () => {
    try {
      const [ideasRes, commentaryRes] = await Promise.all([
        fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        }),
        fetch("/api/ideas-commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        }),
      ]);
      if (ideasRes.ok) setIdeas(await ideasRes.json());
      if (commentaryRes.ok) setCommentaries(await commentaryRes.json());
    } catch (_e) { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addIdea = async () => {
    if (!captureTitle.trim()) return;
    const id = `idea-${Date.now().toString(36)}`;
    const tags = captureTags ? captureTags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "set", id, title: captureTitle.trim(), tags, source: "ginge" }),
    });
    setCaptureTitle("");
    setCaptureTags("");
    fetchData();
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "set", id, ...updates }),
    });
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i));
  };

  const deleteIdea = async (id: string) => {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "delete", id }),
    });
    setDeleteConfirm(null);
    setExpanded(null);
    fetchData();
  };


  const filtered = useMemo(() => {
    let items = ideas;
    if (filter !== "all") items = items.filter((i) => i.status === filter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [ideas, filter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of ideas) counts[i.status] = (counts[i.status] || 0) + 1;
    return counts;
  }, [ideas]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Ideas</h1>

      {/* ── Squad Commentary ── */}
      {commentaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {commentaries.map((c) => {
            const agent = AGENT_COLORS[c.agent] || AGENT_COLORS.atlas;
            return (
              <div
                key={c.id}
                className="rounded-xl p-4 border"
                style={{
                  background: agent.bg,
                  borderColor: `${agent.border}30`,
                  borderLeftWidth: "3px",
                  borderLeftColor: agent.border,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{c.emoji}</span>
                  <span className="text-sm font-bold text-white">{agent.label}</span>
                </div>
                <p className="text-xs text-[#c8d0dc] leading-relaxed mb-3">&ldquo;{c.text}&rdquo;</p>
                <span className="text-[10px] text-[#475569]">Updated {timeAgo(c.updated_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick Capture Bar ── */}
      <div className="rounded-xl border border-[#00d4d4]/20 p-4" style={{ background: "rgba(0, 212, 212, 0.03)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={captureTitle}
            onChange={(e) => setCaptureTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            placeholder="What's the idea?"
            className="flex-1 min-w-[200px] bg-[#111827] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#00d4d4]"
          />
          <input
            value={captureTags}
            onChange={(e) => setCaptureTags(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            placeholder="Tags (comma separated)"
            className="w-48 bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00d4d4]"
          />
          <button onClick={addIdea}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#00d4d4]/10 text-[#00d4d4] border border-[#00d4d4]/30 hover:bg-[#00d4d4]/20 transition-colors cursor-pointer">
            Add
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ideas..."
        className="w-full sm:w-64 bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4d4]"
      />

      {/* ── Status Filter Tabs ── */}
      <div className="flex items-center gap-1 flex-wrap">
        <FilterTab label="All" count={ideas.length} active={filter === "all"} onClick={() => setFilter("all")} color="#94a3b8" />
        {STATUSES.map((s) => (
          <FilterTab key={s.id} label={s.label} count={statusCounts[s.id] || 0} active={filter === s.id}
            onClick={() => setFilter(s.id)} color={s.color} />
        ))}
      </div>

      {/* ── Idea Grid ── */}
      {loading ? (
        <p className="text-sm text-[#475569] text-center py-20">Loading ideas...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e293b] px-6 py-12 text-center" style={{ background: "#111827" }}>
          <p className="text-[#475569] text-sm">{ideas.length === 0 ? "No ideas yet. Drop one above." : "No ideas match this filter."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((idea, idx) => (
            <IdeaCard key={idea.id} idea={idea} index={idx}
              isExpanded={expanded === idea.id}
              onToggle={() => setExpanded(expanded === idea.id ? null : idea.id)}
              onUpdate={(updates) => updateIdea(idea.id, updates)}
              onDelete={() => deleteConfirm === idea.id ? deleteIdea(idea.id) : setDeleteConfirm(idea.id)}
              deleteConfirming={deleteConfirm === idea.id}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          ))}
        </div>
      )}

    </div>
  );
}

/* ── Idea Card ── */
function IdeaCard({ idea, index, isExpanded, onToggle, onUpdate, onDelete, deleteConfirming, onCancelDelete }: {
  idea: Idea; index: number; isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Idea>) => void;
  onDelete: () => void; deleteConfirming: boolean; onCancelDelete: () => void;
}) {
  const color = STATUS_COLOR[idea.status] || "#6b7280";
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedUpdate = (updates: Partial<Idea>) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate(updates), 500);
  };

  const warnings: string[] = [];
  if (!idea.image_url) warnings.push("No image");
  if (!idea.description) warnings.push("No description");

  return (
    <div className="rounded-xl border border-[#1e293b] overflow-hidden transition-all hover:brightness-105"
      style={{ background: "rgba(17, 24, 39, 0.85)" }}>

      {/* Image / gradient header */}
      <div className={`relative h-24 bg-gradient-to-br ${gradient} cursor-pointer`} onClick={onToggle}>
        {idea.image_url && (
          <img src={idea.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Status badge */}
        <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded"
          style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>
          {idea.status.toUpperCase()}
        </span>

        {/* Title */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-sm font-bold text-white leading-tight">{idea.title}</h3>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="absolute top-2 left-2 flex gap-1">
            {warnings.map((w) => (
              <span key={w} className="text-[8px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded" title={w}>
                &#x26A0;&#xFE0F;
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 cursor-pointer" onClick={onToggle}>
        {idea.description && (
          <p className="text-xs text-[#94a3b8] leading-relaxed line-clamp-2 mb-2">{idea.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {idea.tags.map((t) => (
            <span key={t} className="text-[9px] text-[#64748b] bg-[#1e293b] px-1.5 py-0.5 rounded-full">{t}</span>
          ))}
          {idea.source && <span className="text-[9px] text-[#475569] ml-auto">{idea.source}</span>}
        </div>
        <p className="text-[10px] text-[#475569] mt-1.5">{timeAgo(idea.created_at)}</p>
      </div>

      {/* Expanded edit */}
      {isExpanded && (
        <div className="border-t border-[#1e293b] p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          <EditField label="Description" value={idea.description}
            onChange={(v) => debouncedUpdate({ description: v })} multiline />
          <EditField label="Notes" value={idea.notes}
            onChange={(v) => debouncedUpdate({ notes: v })} multiline />
          <EditField label="Image URL" value={idea.image_url}
            onChange={(v) => debouncedUpdate({ image_url: v })} mono />
          <EditField label="Tags (comma separated)" value={idea.tags.join(", ")}
            onChange={(v) => debouncedUpdate({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })} />

          {/* Status dropdown */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#475569] font-bold block mb-1">Status</label>
            <select value={idea.status} onChange={(e) => onUpdate({ status: e.target.value as Status })}
              className="text-xs bg-[#0a0e1a] border border-[#1e293b] rounded px-2 py-1.5 text-[#94a3b8] cursor-pointer">
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-[#1e293b]/50">
            {deleteConfirming ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400">Delete this idea?</span>
                <button onClick={onDelete} className="text-[10px] text-red-400 font-bold cursor-pointer">Yes, delete</button>
                <button onClick={onCancelDelete} className="text-[10px] text-[#475569] cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button onClick={onDelete} className="text-[10px] text-[#475569] hover:text-red-400 cursor-pointer">Delete idea</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Edit Field ── */
function EditField({ label, value, onChange, multiline, mono }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; mono?: boolean;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    onChange(v);
  };

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#475569] font-bold block mb-1">{label}</label>
      {multiline ? (
        <textarea value={local} onChange={(e) => handleChange(e.target.value)}
          className={`w-full bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white resize-y min-h-[50px] focus:outline-none focus:border-[#00d4d4] ${mono ? "font-mono" : ""}`} />
      ) : (
        <input value={local} onChange={(e) => handleChange(e.target.value)}
          className={`w-full bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00d4d4] ${mono ? "font-mono" : ""}`} />
      )}
    </div>
  );
}


/* ── Filter Tab ── */
function FilterTab({ label, count, active, onClick, color }: {
  label: string; count: number; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
      style={{
        background: active ? `${color}15` : "transparent",
        color: active ? color : "#64748b",
        border: active ? `1px solid ${color}30` : "1px solid transparent",
      }}>
      {label}
      <span className="text-[9px] font-mono opacity-70">{count}</span>
    </button>
  );
}

/* ── Helpers ── */
function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
