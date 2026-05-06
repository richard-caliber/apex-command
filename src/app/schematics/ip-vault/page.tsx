"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/* ── Types ── */
interface Practice {
  id: string;
  category: string;
  title: string;
  content: string;
  tags?: string[];
  scope?: string;
  source?: string;
  origin_store?: string;
  created_at?: string;
  updated_at?: string;
}

/* ── Category metadata (label + colour). Categories are derived live from data — anything not listed here renders with default styling. */
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  research: { label: "Research", color: "#3b82f6" },
  "winning-hooks": { label: "Winning Hooks", color: "#22c55e" },
  "winning-creatives": { label: "Winning Creatives", color: "#a855f7" },
  strategies: { label: "Strategies", color: "#f59e0b" },
  "failed-experiments": { label: "Failed Experiments", color: "#ef4444" },
  lessons: { label: "Lessons", color: "#06b6d4" },
  frameworks: { label: "Frameworks", color: "#8b5cf6" },
  "best-practices": { label: "Best Practices", color: "#ec4899" },
  workflow: { label: "Workflow", color: "#00d4d4" },
  "phase-7-backlog": { label: "Phase 7 Backlog", color: "#fb923c" },
  "phase-8-backlog": { label: "Phase 8 Backlog", color: "#facc15" },
  "migration-backlog": { label: "Migration Backlog", color: "#94a3b8" },
  "agent-memory": { label: "Agent Memory", color: "#a78bfa" },
  "channel-learnings": { label: "Channel Learnings", color: "#22d3ee" },
  "experiment-vault": { label: "Experiment Vault", color: "#f472b6" },
  principles: { label: "Principles", color: "#fde68a" },
  "tool-discovery": { label: "Tool Discovery", color: "#67e8f9" },
  test: { label: "Test", color: "#475569" },
};
const DEFAULT_COLOR = "#6b7280";

const SOURCE_EMOJI: Record<string, string> = { atlas: "\u{1F9ED}", newton: "\u{1F52C}", darwin: "\u{1F504}", jimmy: "\u{1F3A8}", ginge: "\u{1F464}", manual: "✍️" };
const SOURCE_COLOR: Record<string, string> = { newton: "#3b82f6", darwin: "#22c55e", atlas: "#00d4d4", jimmy: "#a855f7", ginge: "#f59e0b", manual: "#94a3b8" };

function metaFor(cat: string) {
  return CATEGORY_META[cat] ?? { label: cat.replace(/-/g, " "), color: DEFAULT_COLOR };
}

/* ── Main ── */
export default function IPVaultPage() {
  const [items, setItems] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("_all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    }).then((r) => r.json());
    setItems(res?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    let out = items;
    if (catFilter !== "_all") out = out.filter((i) => i.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(
        (i) =>
          (i.title || "").toLowerCase().includes(q) ||
          (i.content || "").toLowerCase().includes(q) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return [...out].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [items, catFilter, search]);

  const catCounts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const it of items) tally[it.category] = (tally[it.category] ?? 0) + 1;
    const cats = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
    return [{ id: "_all", label: "All", color: "#00d4d4", count: items.length }, ...cats.map((id) => ({ id, label: metaFor(id).label, color: metaFor(id).color, count: tally[id] }))];
  }, [items]);

  const copyContent = (e: Practice) => {
    navigator.clipboard.writeText(e.content || "");
    setCopied(e.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search practices..."
          className="flex-1 min-w-[200px] text-xs bg-transparent border rounded-lg px-3 py-2 focus:outline-none"
          style={{ borderColor: search ? "#00d4d4" : "#1e1e2e", color: "#f1f5f9" }}
        />
        <span className="text-[10px] font-mono" style={{ color: "#4a4a5e" }}>
          source: apex:practices:v1
        </span>
      </div>

      {/* Category tabs */}
      <nav className="overflow-x-auto scrollbar-hide -mx-1 mb-4">
        <div className="flex items-center gap-1 min-w-max px-1 py-1">
          {catCounts.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all whitespace-nowrap text-[11px] font-semibold"
              style={{
                background: catFilter === cat.id ? `${cat.color}18` : cat.count > 0 ? "rgba(30,30,46,0.6)" : "rgba(20,20,30,0.4)",
                border: `1px solid ${catFilter === cat.id ? `${cat.color}40` : "rgba(30,30,46,0.8)"}`,
                color: catFilter === cat.id ? cat.color : cat.count > 0 ? "#6b6b80" : "#2a2a3e",
              }}
            >
              {cat.label}
              <span className="text-[9px] font-mono" style={{ opacity: 0.7 }}>{cat.count}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Count */}
      <div className="text-[11px] font-mono mb-3" style={{ color: "#4a4a5e" }}>
        {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
      </div>

      {/* Entry rows */}
      {loading ? (
        <p className="text-xs text-center py-20" style={{ color: "#4a4a5e" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xs mb-1" style={{ color: "#3a3a4e" }}>No entries found.</p>
        </div>
      ) : (
        <div>
          {filtered.map((entry) => {
            const isOpen = expanded === entry.id;
            const meta = metaFor(entry.category);
            const source = entry.source ?? "manual";
            const srcColor = SOURCE_COLOR[source] ?? "#6b6b80";
            const srcEmoji = SOURCE_EMOJI[source] ?? "❓";
            const tags = entry.tags ?? [];

            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="w-full flex items-center gap-2 py-2 px-2 cursor-pointer transition-colors hover:bg-white/[0.02] text-left"
                  style={{ borderBottom: "1px solid rgba(30,30,46,0.4)" }}
                >
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex-shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: "#e0e0ee" }}>{entry.title || "(untitled)"}</span>
                  <span className="text-[10px] flex-shrink-0 font-medium hidden sm:inline" style={{ color: srcColor }}>{srcEmoji} {source}</span>
                  <span className="text-[10px] font-mono flex-shrink-0 hidden sm:inline" style={{ color: "#3a3a4e" }}>
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: "#3a3a4e" }}>{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="px-2 pb-3 pt-2 ml-2 sm:ml-[90px] mr-2">
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tags.map((t) => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}>{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] mb-2 font-mono" style={{ color: "#4a4a5e" }}>
                      id: {entry.id} {entry.scope ? <>· scope: {entry.scope}</> : null}
                    </div>
                    <div className="rounded-lg overflow-hidden mb-2" style={{ background: "rgba(10,14,26,0.8)", border: "1px solid #1e293b" }}>
                      <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap p-4 overflow-y-auto" style={{ color: "#94a3b8", maxHeight: "400px" }}>
                        {entry.content || "(empty)"}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyContent(entry)}
                        className="text-[10px] font-semibold px-2 py-1 rounded cursor-pointer"
                        style={{ background: copied === entry.id ? "#00d4d4" : "rgba(0,212,212,0.1)", color: copied === entry.id ? "#0a0a0f" : "#00d4d4", border: "1px solid rgba(0,212,212,0.2)" }}
                      >
                        {copied === entry.id ? "Copied!" : "Copy"}
                      </button>
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
