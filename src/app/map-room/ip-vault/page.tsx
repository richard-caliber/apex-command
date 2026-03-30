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
interface VaultEntry {
  id: string;
  [key: string]: unknown;
}

interface VaultSection {
  id: string;
  title: string;
  entries: VaultEntry[];
}

interface VaultData {
  sections: VaultSection[];
  lastUpdated: string;
}

/* ── Section Field Definitions ── */
const SECTION_FIELDS: Record<string, { key: string; label: string; type: "text" | "textarea" }[]> = {
  "winning-hooks": [
    { key: "text", label: "Hook Text", type: "textarea" },
    { key: "platform", label: "Platform", type: "text" },
    { key: "post_id", label: "Post ID / Reference", type: "text" },
    { key: "metric", label: "Metric", type: "text" },
  ],
  "winning-creatives": [
    { key: "description", label: "Description", type: "textarea" },
    { key: "platform", label: "Platform", type: "text" },
    { key: "link", label: "Link / Reference", type: "text" },
    { key: "metric", label: "Metric", type: "text" },
  ],
  "prompt-versions": [
    { key: "prompt_name", label: "Prompt Name", type: "text" },
    { key: "version", label: "Version", type: "text" },
    { key: "text", label: "Prompt Text", type: "textarea" },
    { key: "change_notes", label: "Change Notes", type: "textarea" },
    { key: "date", label: "Date", type: "text" },
  ],
  "channel-learnings": [
    { key: "platform", label: "Platform", type: "text" },
    { key: "learning", label: "Learning", type: "textarea" },
    { key: "evidence", label: "Evidence", type: "textarea" },
    { key: "date", label: "Date", type: "text" },
  ],
  "funnel-learnings": [
    { key: "stage", label: "Stage", type: "text" },
    { key: "learning", label: "Learning", type: "textarea" },
    { key: "evidence", label: "Evidence", type: "textarea" },
    { key: "date", label: "Date", type: "text" },
  ],
  "failed-experiments": [
    { key: "experiment_name", label: "Experiment Name", type: "text" },
    { key: "hypothesis", label: "Hypothesis", type: "textarea" },
    { key: "result", label: "Result", type: "textarea" },
    { key: "learning", label: "Learning", type: "textarea" },
    { key: "date", label: "Date", type: "text" },
  ],
  "reusable-frameworks": [
    { key: "framework_name", label: "Framework Name", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "where_applicable", label: "Where Applicable", type: "text" },
  ],
  "system-learnings": [
    { key: "topic", label: "Topic", type: "text" },
    { key: "learning", label: "Learning", type: "textarea" },
    { key: "impact", label: "Impact", type: "text" },
    { key: "date", label: "Date", type: "text" },
  ],
};

const SECTION_ICONS: Record<string, string> = {
  "winning-hooks": "\uD83C\uDFA3",
  "winning-creatives": "\uD83C\uDFA8",
  "prompt-versions": "\uD83D\uDCDD",
  "channel-learnings": "\uD83D\uDCE1",
  "funnel-learnings": "\uD83D\uDD73\uFE0F",
  "failed-experiments": "\u26A0\uFE0F",
  "reusable-frameworks": "\uD83D\uDCD0",
  "system-learnings": "\u2699\uFE0F",
};

/* ── Main Page ── */
export default function IPVaultPage() {
  const [data, setData] = useState<VaultData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["winning-hooks", "failed-experiments"]));
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/map-room/ip-vault");
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

  const save = async (sectionId: string, action: "add" | "update", entry?: VaultEntry) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return;
    const built: VaultEntry = {
      id: action === "add" ? `${sectionId}-${Date.now()}` : entry!.id,
    };
    fields.forEach((f) => { built[f.key] = draft[f.key] || ""; });

    await fetch("/api/map-room/ip-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action, sectionId, entry: built }),
    });
    setAdding(null);
    setEditing(null);
    setDraft({});
    fetchData();
  };

  const deleteEntry = async (sectionId: string, entryId: string) => {
    await fetch("/api/map-room/ip-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ action: "delete", sectionId, entryId }),
    });
    fetchData();
  };

  const startEdit = (sectionId: string, entry: VaultEntry) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return;
    const d: Record<string, string> = {};
    fields.forEach((f) => { d[f.key] = String(entry[f.key] || ""); });
    setDraft(d);
    setEditing(entry.id);
    setAdding(null);
  };

  const startAdd = (sectionId: string) => {
    setDraft({});
    setAdding(sectionId);
    setEditing(null);
    if (!expanded.has(sectionId)) toggle(sectionId);
  };

  const cancel = () => { setAdding(null); setEditing(null); setDraft({}); };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: C.heading }}>
            IP Vault
          </h2>
          <p className="text-sm mt-1" style={{ color: C.body }}>
            Structured intelligence archive. The competitive moat. Not random notes.
          </p>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-1 rounded"
          style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}
        >
          All fields: ✏️ Manual
        </span>
      </div>

      {/* Sections */}
      {!data && (
        <div className="text-sm animate-pulse" style={{ color: C.muted }}>Loading vault...</div>
      )}

      {data?.sections.map((section) => {
        const isOpen = expanded.has(section.id);
        const fields = SECTION_FIELDS[section.id] || [];
        const icon = SECTION_ICONS[section.id] || "";

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
                <span className="text-lg">{icon}</span>
                <span className="font-semibold text-base">{section.title}</span>
                <span
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: section.entries.length > 0 ? "rgba(0,212,212,0.15)" : "rgba(107,107,128,0.15)", color: section.entries.length > 0 ? C.accent : C.muted }}
                >
                  {section.entries.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); startAdd(section.id); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  style={{ background: "rgba(0,212,212,0.1)", color: C.accent, border: `1px solid rgba(0,212,212,0.2)` }}
                >
                  + Add
                </button>
                <span className="text-xs" style={{ color: C.muted }}>
                  {isOpen ? "\u25BC" : "\u25B6"}
                </span>
              </div>
            </button>

            {/* Expanded Content */}
            {isOpen && (
              <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: C.border }}>
                {/* Add Form */}
                {adding === section.id && (
                  <EntryForm
                    fields={fields}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={() => save(section.id, "add")}
                    onCancel={cancel}
                    label="Add Entry"
                  />
                )}

                {/* Entries */}
                {section.entries.length === 0 && adding !== section.id && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: C.muted }}>
                      Nothing here yet.{" "}
                      <button
                        onClick={() => startAdd(section.id)}
                        className="underline cursor-pointer"
                        style={{ color: C.accent }}
                      >
                        Add your first entry
                      </button>
                    </p>
                  </div>
                )}

                {section.entries.map((entry) => (
                  <div key={entry.id}>
                    {editing === entry.id ? (
                      <EntryForm
                        fields={fields}
                        draft={draft}
                        setDraft={setDraft}
                        onSave={() => save(section.id, "update", entry)}
                        onCancel={cancel}
                        label="Save Changes"
                      />
                    ) : (
                      <div
                        className="rounded-lg border p-4 group"
                        style={{ background: C.bg, borderColor: C.border }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1.5">
                            {fields.map((f) => {
                              const val = entry[f.key];
                              if (!val) return null;
                              return (
                                <div key={f.key}>
                                  <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>
                                    {f.label}
                                  </span>
                                  <p
                                    className={`text-sm ${f.type === "textarea" ? "whitespace-pre-wrap" : ""}`}
                                    style={{ color: f.key === fields[0]?.key ? C.heading : C.body }}
                                  >
                                    {String(val)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => startEdit(section.id, entry)}
                              className="text-xs px-2.5 py-1 rounded cursor-pointer"
                              style={{ background: "rgba(0,212,212,0.1)", color: C.accent }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteEntry(section.id, entry.id)}
                              className="text-xs px-2.5 py-1 rounded cursor-pointer"
                              style={{ background: "rgba(239,68,68,0.1)", color: C.error }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="text-center text-xs py-4" style={{ color: C.muted }}>
        Last updated: {data ? new Date(data.lastUpdated).toLocaleString("en-GB") : "\u2014"}
        {" \u00B7 "}Future: agents auto-capture winning hooks, prompts, and learnings
      </div>
    </div>
  );
}

/* ── Entry Form Component ── */
function EntryForm({
  fields,
  draft,
  setDraft,
  onSave,
  onCancel,
  label,
}: {
  fields: { key: string; label: string; type: "text" | "textarea" }[];
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{ background: "rgba(0,212,212,0.03)", borderColor: "rgba(0,212,212,0.15)" }}
    >
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>
            ✏️ {f.label}
          </label>
          {f.type === "textarea" ? (
            <textarea
              value={draft[f.key] || ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none"
              style={{
                background: C.bg,
                borderColor: C.border,
                color: C.heading,
              }}
            />
          ) : (
            <input
              type="text"
              value={draft[f.key] || ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{
                background: C.bg,
                borderColor: C.border,
                color: C.heading,
              }}
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          className="text-xs font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
          style={{ background: C.accent, color: C.bg }}
        >
          {label}
        </button>
        <button
          onClick={onCancel}
          className="text-xs font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
          style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}` }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
