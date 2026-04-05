"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

const TOKEN = "apex-live-2026";

/* ── Types ── */
interface IpEntry {
  id: string; project_id: string; category: string; title: string; content: string;
  source_task: string; source_prompt: string; created_by: string; created_at: string;
  tags: string[]; project_name: string; performance_data: Record<string, unknown> | null;
}
interface Project { id: string; name: string }

/* ── Categories ── */
const CATEGORIES = [
  { id: "_all", label: "All" },
  { id: "research", label: "Research", color: "#3b82f6", auto: "T-0.1 through T-1.8, T-4.2, T-4.3" },
  { id: "winning-hooks", label: "Winning Hooks", color: "#22c55e", auto: "T-4.13 (top 20% hooks)" },
  { id: "winning-creatives", label: "Winning Creatives", color: "#a855f7", auto: "Content Library winners" },
  { id: "strategies", label: "Strategies", color: "#f59e0b", auto: "T-4.1c, T-2.14 approved outputs" },
  { id: "failed-experiments", label: "Failed Experiments", color: "#ef4444", auto: "Darwin gates \u22643, Library flops" },
  { id: "lessons", label: "Lessons", color: "#06b6d4", auto: "T-4.13, T-5.4, T-6.6, T-7.12 outputs" },
  { id: "frameworks", label: "Frameworks", color: "#8b5cf6", auto: "T-4.3, T-2.1 outputs" },
  { id: "best-practices", label: "Best Practices", color: "#ec4899", auto: "Manual \u2014 Atlas/Ginge" },
];

const CAT_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.filter((c) => c.color).map((c) => [c.id, c.color!]));
const OWNER_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", "claude-code": "\u{1F4BB}", ginge: "\u{1F464}", auto: "\u26A1" };
const OWNER_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", "claude-code": "#a855f7", ginge: "#f59e0b", auto: "#6b7280" };

function vaultApi(body: Record<string, unknown>) {
  return fetch("/api/vault", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

/* ── Main ── */
export default function IPVaultPage() {
  const [entries, setEntries] = useState<IpEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("_all");
  const [projFilter, setProjFilter] = useState("_all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingInline, setEditingInline] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({ category: "research", project_id: "", title: "", content: "", tags: "", source_task: "", created_by: "atlas" });

  const fetchData = useCallback(async () => {
    const [ipData, projData] = await Promise.all([
      vaultApi({ action: "ip-list" }),
      fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) }).then((r) => r.json()),
    ]);
    setEntries(ipData?.items || []);
    setProjects(projData?.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let items = entries;
    if (catFilter !== "_all") items = items.filter((i) => i.category === catFilter);
    if (projFilter !== "_all") items = items.filter((i) => i.project_id === projFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [entries, catFilter, projFilter, search]);

  const catCounts = useMemo(() => CATEGORIES.map((c) => ({
    ...c, count: c.id === "_all" ? entries.length : entries.filter((e) => e.category === c.id).length,
  })), [entries]);

  const saveEntry = async () => {
    if (!newEntry.title.trim()) return;
    const id = `ip-${newEntry.project_id || "general"}-${Date.now().toString(36)}`;
    const proj = projects.find((p) => p.id === newEntry.project_id);
    await vaultApi({ action: "ip-set", id, ...newEntry, tags: newEntry.tags.split(",").map((t) => t.trim()).filter(Boolean), project_name: proj?.name || "" });
    setAdding(false);
    setNewEntry({ category: "research", project_id: "", title: "", content: "", tags: "", source_task: "", created_by: "atlas" });
    fetchData();
  };

  const saveInlineEdit = async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    await vaultApi({ action: "ip-set", id: entryId, title: entry.title, content: editText });
    setEditingInline(null);
    fetchData();
  };

  const copyContent = (e: IpEntry) => {
    navigator.clipboard.writeText(e.content);
    setCopied(e.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vault..."
          className="flex-1 min-w-[200px] text-xs bg-transparent border rounded-lg px-3 py-2 focus:outline-none"
          style={{ borderColor: search ? "#00d4d4" : "#1e1e2e", color: "#f1f5f9" }} />
        <select value={projFilter} onChange={(e) => setProjFilter(e.target.value)}
          className="text-[11px] bg-transparent border rounded px-2 py-1.5 cursor-pointer focus:outline-none"
          style={{ borderColor: "#1e1e2e", color: "#6b6b80" }}>
          <option value="_all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setAdding(!adding)} className="text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>
          + Add to Vault
        </button>
      </div>

      {/* Category tabs */}
      <nav className="overflow-x-auto scrollbar-hide -mx-1 mb-4">
        <div className="flex items-center gap-1 min-w-max px-1 py-1">
          {catCounts.map((cat) => (
            <button key={cat.id} onClick={() => setCatFilter(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all whitespace-nowrap text-[11px] font-semibold"
              style={{
                background: catFilter === cat.id ? `${cat.color || "#00d4d4"}18` : cat.count > 0 ? "rgba(30,30,46,0.6)" : "rgba(20,20,30,0.4)",
                border: `1px solid ${catFilter === cat.id ? `${cat.color || "#00d4d4"}40` : "rgba(30,30,46,0.8)"}`,
                color: catFilter === cat.id ? (cat.color || "#00d4d4") : cat.count > 0 ? "#6b6b80" : "#2a2a3e",
              }}>
              {cat.label}
              <span className="text-[9px] font-mono" style={{ opacity: 0.7 }}>{cat.count}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Add entry form */}
      {adding && (
        <div className="rounded-lg p-4 mb-4 space-y-3" style={{ background: "#111118", border: "1px solid #1e1e2e" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={newEntry.category} onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
              className="text-xs bg-transparent border rounded px-2 py-2 cursor-pointer focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
              {CATEGORIES.filter((c) => c.id !== "_all").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={newEntry.project_id} onChange={(e) => setNewEntry({ ...newEntry, project_id: e.target.value })}
              className="text-xs bg-transparent border rounded px-2 py-2 cursor-pointer focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={newEntry.created_by} onChange={(e) => setNewEntry({ ...newEntry, created_by: e.target.value })}
              className="text-xs bg-transparent border rounded px-2 py-2 cursor-pointer focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }}>
              {["atlas", "newton", "darwin", "ginge"].map((o) => <option key={o} value={o}>{OWNER_EMOJI[o]} {o}</option>)}
            </select>
          </div>
          <input value={newEntry.title} onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })} placeholder="Title"
            className="w-full text-xs bg-transparent border rounded px-3 py-2 focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }} />
          <textarea value={newEntry.content} onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })} placeholder="Content (markdown)"
            className="w-full text-xs bg-transparent border rounded px-3 py-2 font-mono resize-y focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9", minHeight: "120px" }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newEntry.tags} onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })} placeholder="Tags (comma-separated)"
              className="text-xs bg-transparent border rounded px-3 py-2 focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }} />
            <input value={newEntry.source_task} onChange={(e) => setNewEntry({ ...newEntry, source_task: e.target.value })} placeholder="Source task (e.g. T-1.6)"
              className="text-xs bg-transparent border rounded px-3 py-2 font-mono focus:outline-none" style={{ borderColor: "#1e1e2e", color: "#f1f5f9" }} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveEntry} className="text-[10px] font-semibold px-3 py-1.5 rounded cursor-pointer" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}>Save</button>
            <button onClick={() => setAdding(false)} className="text-[10px] px-3 py-1.5 rounded cursor-pointer" style={{ color: "#6b6b80" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="text-[11px] font-mono mb-3" style={{ color: "#4a4a5e" }}>
        {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
      </div>

      {/* Entry rows */}
      {loading ? (
        <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xs mb-1" style={{ color: "#3a3a4e" }}>No entries yet.</p>
          {catFilter !== "_all" && (
            <p className="text-[10px]" style={{ color: "#2a2a3e" }}>
              This category auto-populates from {CATEGORIES.find((c) => c.id === catFilter)?.auto || "task outputs"}.
            </p>
          )}
        </div>
      ) : (
        <div>
          {filtered.map((entry) => {
            const isOpen = expanded === entry.id;
            const catColor = CAT_COLOR[entry.category] || "#6b7280";
            const owColor = OWNER_COLOR[entry.created_by] || "#6b6b80";
            const owEmoji = OWNER_EMOJI[entry.created_by] || "\u2753";

            return (
              <div key={entry.id}>
                <button onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="w-full flex items-center gap-2 py-2 px-2 cursor-pointer transition-colors hover:bg-white/[0.02] text-left"
                  style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex-shrink-0" style={{ background: `${catColor}18`, color: catColor }}>{entry.category.replace(/-/g, " ")}</span>
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "#e0e0ee" }}>{entry.title}</span>
                  {entry.project_name && <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline" style={{ background: "rgba(107,107,128,0.1)", color: "#6b6b80" }}>{entry.project_name}</span>}
                  <span className="text-[10px] flex-shrink-0 font-medium hidden sm:inline" style={{ color: owColor }}>{owEmoji} {entry.created_by}</span>
                  <span className="text-[10px] font-mono flex-shrink-0 hidden sm:inline" style={{ color: "#3a3a4e" }}>{new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: "#3a3a4e" }}>{isOpen ? "\u25B2" : "\u25BC"}</span>
                </button>

                {isOpen && (
                  <div className="px-2 pb-3 pt-2 ml-2 sm:ml-[90px] mr-2">
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {entry.tags.map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}>{t}</span>)}
                      </div>
                    )}
                    {entry.source_task && (
                      <div className="text-[10px] mb-2" style={{ color: "#4a4a5e" }}>
                        From: <Link href="/map-room/tasks" className="underline" style={{ color: "#00d4d4" }}>{entry.source_task}</Link>
                        {entry.source_prompt && <span> · Prompt: {entry.source_prompt}</span>}
                      </div>
                    )}
                    {entry.performance_data && Object.keys(entry.performance_data).length > 0 && (
                      <div className="flex gap-3 mb-2 text-[10px]">
                        {Object.entries(entry.performance_data).map(([k, v]) => (
                          <span key={k}><span style={{ color: "#4a4a5e" }}>{k}: </span><span className="font-mono font-bold" style={{ color: "#00d4d4" }}>{String(v)}</span></span>
                        ))}
                      </div>
                    )}
                    <div className="rounded-lg overflow-hidden mb-2" style={{ background: "rgba(10,14,26,0.8)", border: "1px solid #1e293b" }}>
                      {editingInline === entry.id ? (
                        <div className="p-3">
                          <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-transparent text-[11px] font-mono leading-relaxed resize-y outline-none"
                            style={{ color: "#cbd5e1", minHeight: "150px", maxHeight: "400px" }} />
                          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: "1px solid rgba(30,30,46,0.4)" }}>
                            <button onClick={() => saveInlineEdit(entry.id)} className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}>Save</button>
                            <button onClick={() => setEditingInline(null)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "#6b6b80" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap p-4 overflow-y-auto" style={{ color: "#94a3b8", maxHeight: "400px" }}>
                          {entry.content || "(empty)"}
                        </pre>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyContent(entry)} className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer"
                        style={{ background: copied === entry.id ? "#00d4d4" : "rgba(0,212,212,0.1)", color: copied === entry.id ? "#0a0a0f" : "#00d4d4", border: "1px solid rgba(0,212,212,0.2)" }}>
                        {copied === entry.id ? "Copied!" : "Copy"}
                      </button>
                      <button onClick={() => { setEditingInline(entry.id); setEditText(entry.content); }} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "#6b6b80", border: "1px solid #1e293b" }}>Edit</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
