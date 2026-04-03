"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ── Types ── */
interface AgentTask {
  id: string;
  text: string;
  status: "pending" | "in-progress" | "done" | "blocked";
  project?: string;
  due?: string;
}

interface OutputLogEntry {
  timestamp: string;
  task_id: string;
  task_name: string;
  summary: string;
  status: "success" | "partial" | "failed";
  link?: string;
}

interface Blocker {
  description: string;
  waiting_on: string;
  since?: string;
}

interface WorkspaceFile {
  name: string;
  path?: string;
  description?: string;
  owner?: string;
  last_modified?: string;
  updated_at?: string;
  size: string;
  status: "current" | "stale" | "orphan";
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "active" | "idle" | "blocked";
  current_model: string;
  preferred_models: { light: string; normal: string; deep: string };
  model_strategy: string;
  identity_text: string;
  soul_text: string;
  capabilities_text: string;
  responsibilities_text: string;
  memory_text: string;
  memory_updated_at: string;
  workspace_files: WorkspaceFile[];
  current_tasks: AgentTask[];
  output_log: OutputLogEntry[];
  blockers: Blocker[];
  last_action: string;
  last_updated: string;
}

/* ── Constants ── */
const TOKEN = "apex-live-2026";

const STATUS_STYLE: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "ACTIVE", color: "text-green-400", dot: "bg-green-500" },
  idle: { label: "IDLE", color: "text-slate-400", dot: "bg-slate-500" },
  blocked: { label: "BLOCKED", color: "text-red-400", dot: "bg-red-500" },
};

const TASK_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-[#6b6b80]" },
  "in-progress": { label: "In Progress", color: "text-amber-400" },
  done: { label: "Done", color: "text-green-400" },
  blocked: { label: "Blocked", color: "text-red-400" },
};

const OUTPUT_STATUS_STYLE: Record<string, { color: string }> = {
  success: { color: "text-green-400" },
  partial: { color: "text-amber-400" },
  failed: { color: "text-red-400" },
};

/* ── Main ── */
export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [fileSort, setFileSort] = useState<"modified" | "path" | "status">("path");
  const [fileFilter, setFileFilter] = useState<"all" | "current" | "stale" | "orphan">("all");
  const [addingFile, setAddingFile] = useState(false);
  const [newFile, setNewFile] = useState({ path: "", description: "", size: "" });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/squad");
      if (res.ok) {
        const data = await res.json();
        const found = data.agents?.find((a: Agent) => a.id === agentId);
        if (found) setAgent(found);
      }
    } catch (_e) { /* retry */ }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveField = async (field: string, value: string | WorkspaceFile[]) => {
    if (!agent) return;
    setSaving(true);
    try {
      await fetch("/api/squad", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ agentId: agent.id, [field]: value }),
      });
      const updates: Record<string, unknown> = { [field]: value, last_updated: new Date().toISOString() };
      if (field === "memory_text") updates.memory_updated_at = new Date().toISOString();
      setAgent({ ...agent, ...updates } as Agent);
    } catch (_e) { /* silent */ }
    finally { setSaving(false); setEditingSection(null); }
  };

  const startEdit = (section: string, currentValue: string) => {
    setEditingSection(section);
    setEditBuffer(currentValue);
  };
  const cancelEdit = () => { setEditingSection(null); setEditBuffer(""); };

  const addFile = async () => {
    if (!agent || !newFile.path) return;
    const file: WorkspaceFile = {
      name: newFile.path,
      path: newFile.path,
      description: newFile.description,
      owner: agent.id,
      updated_at: new Date().toISOString(),
      size: newFile.size || "—",
      status: "current",
    };
    const updated = [...(agent.workspace_files || []), file];
    await saveField("workspace_files", updated);
    setNewFile({ path: "", description: "", size: "" });
    setAddingFile(false);
  };

  const removeFile = async (path: string) => {
    if (!agent) return;
    const updated = (agent.workspace_files || []).filter((f) => (f.name || f.path) !== path);
    await saveField("workspace_files", updated);
  };

  // Compute file status from last_modified
  const filesWithStatus = useMemo(() => {
    return (agent?.workspace_files || []).map((f) => {
      const mod = f.updated_at || f.last_modified;
      if (!mod) return f;
      const age = Date.now() - new Date(mod).getTime();
      const days = age / (1000 * 60 * 60 * 24);
      let status: WorkspaceFile["status"] = "current";
      if (days > 30) status = "orphan";
      else if (days > 7) status = "stale";
      return { ...f, status };
    });
  }, [agent?.workspace_files]);

  const filteredFiles = useMemo(() => {
    let files = fileFilter === "all" ? filesWithStatus : filesWithStatus.filter((f) => f.status === fileFilter);
    files = [...files].sort((a, b) => {
      if (fileSort === "path") return (a.name || a.path || "").localeCompare(b.name || b.path || "");
      if (fileSort === "status") return a.status.localeCompare(b.status);
      // modified
      const aMod = a.updated_at || a.last_modified;
      const bMod = b.updated_at || b.last_modified;
      if (!aMod) return 1;
      if (!bMod) return -1;
      return new Date(bMod).getTime() - new Date(aMod).getTime();
    });
    return files;
  }, [filesWithStatus, fileFilter, fileSort]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0e1a", color: "#f1f5f9" }}>
        <p className="text-sm text-[#475569]">Loading agent...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0e1a", color: "#f1f5f9" }}>
        <div className="text-center">
          <p className="text-[#475569] mb-4">Agent not found</p>
          <Link href="/squad" className="text-sm text-[#00d4d4] hover:underline">Back to Squad</Link>
        </div>
      </div>
    );
  }

  const s = STATUS_STYLE[agent.status] ?? STATUS_STYLE.idle;

  return (
    <div className="min-h-dvh" style={{ background: "#0a0e1a", color: "#f1f5f9" }}>
      {/* Header */}
      <header className="hidden sm:block border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors">← Squad</Link>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{agent.emoji}</span>
              <div>
                <h1 className="text-xl font-bold">{agent.name}</h1>
                <p className="text-xs text-[#64748b]">{agent.role}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className={`text-[10px] font-bold tracking-wider ${s.color}`}>{s.label}</span>
            </div>
            {saving && <span className="text-[10px] text-[#00d4d4]">Saving...</span>}
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Row: Model Strategy + Last Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Model Strategy">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {(["light", "normal", "deep"] as const).map((tier) => (
                  <div key={tier} className="rounded-lg border border-[#1e293b] p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-[#475569] mb-1">
                      {tier === "light" ? "Light Tasks" : tier === "normal" ? "Normal" : "Deep Work"}
                    </div>
                    <div className="text-sm font-semibold text-[#f1f5f9]">
                      {agent.preferred_models[tier] || "\u2014"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-[#475569] font-semibold">Current</span>
                <span className="text-sm text-[#94a3b8] font-mono">{agent.current_model || "Not set"}</span>
              </div>
              <EditableText
                label="Strategy notes"
                field="model_strategy"
                value={agent.model_strategy}
                placeholder="Describe when this agent should use each model tier..."
                editing={editingSection === "model_strategy"}
                editBuffer={editBuffer}
                onStart={() => startEdit("model_strategy", agent.model_strategy)}
                onCancel={cancelEdit}
                onChange={setEditBuffer}
                onSave={(v) => saveField("model_strategy", v)}
              />
            </div>
          </Section>

          <Section title="Last Action">
            <EditableText
              label=""
              field="last_action"
              value={agent.last_action}
              placeholder="No actions recorded yet"
              editing={editingSection === "last_action"}
              editBuffer={editBuffer}
              onStart={() => startEdit("last_action", agent.last_action)}
              onCancel={cancelEdit}
              onChange={setEditBuffer}
              onSave={(v) => saveField("last_action", v)}
            />
            <div className="mt-3 text-[10px] text-[#475569]">
              Last updated: {agent.last_updated ? new Date(agent.last_updated).toLocaleString("en-GB") : "Never"}
            </div>
          </Section>
        </div>

        {/* Identity */}
        <Section title="Identity">
          <EditableText
            field="identity_text" value={agent.identity_text} tall
            placeholder={`Paste ${agent.name}'s identity/persona text here.\n\nThis should define who ${agent.name} is, how they think, and how they communicate.`}
            editing={editingSection === "identity_text"} editBuffer={editBuffer}
            onStart={() => startEdit("identity_text", agent.identity_text)}
            onCancel={cancelEdit} onChange={setEditBuffer}
            onSave={(v) => saveField("identity_text", v)}
          />
        </Section>

        {/* Soul */}
        <Section title="Soul">
          <EditableText
            field="soul_text" value={agent.soul_text} tall
            placeholder={`Paste ${agent.name}'s soul text here.\n\nThe soul defines ${agent.name}'s core values, decision-making principles, and operating philosophy.`}
            editing={editingSection === "soul_text"} editBuffer={editBuffer}
            onStart={() => startEdit("soul_text", agent.soul_text)}
            onCancel={cancelEdit} onChange={setEditBuffer}
            onSave={(v) => saveField("soul_text", v)}
          />
        </Section>

        {/* Capabilities */}
        <Section title="Capabilities">
          <EditableText
            field="capabilities_text" value={agent.capabilities_text} tall
            placeholder={`List ${agent.name}'s current capabilities.\n\nExample:\n- Web search + deep research\n- Content creation\n- API integrations`}
            editing={editingSection === "capabilities_text"} editBuffer={editBuffer}
            onStart={() => startEdit("capabilities_text", agent.capabilities_text)}
            onCancel={cancelEdit} onChange={setEditBuffer}
            onSave={(v) => saveField("capabilities_text", v)}
          />
        </Section>

        {/* Responsibilities */}
        <Section title="Responsibilities">
          <EditableText
            field="responsibilities_text" value={agent.responsibilities_text} tall
            placeholder={`Define ${agent.name}'s ongoing responsibilities.\n\nWhat does ${agent.name} own? What recurring work do they handle?`}
            editing={editingSection === "responsibilities_text"} editBuffer={editBuffer}
            onStart={() => startEdit("responsibilities_text", agent.responsibilities_text)}
            onCancel={cancelEdit} onChange={setEditBuffer}
            onSave={(v) => saveField("responsibilities_text", v)}
          />
        </Section>

        {/* Memory — upgraded with markdown + staleness */}
        <MemorySection
          agent={agent}
          editing={editingSection === "memory_text"}
          editBuffer={editBuffer}
          onStart={() => startEdit("memory_text", agent.memory_text)}
          onCancel={cancelEdit}
          onChange={setEditBuffer}
          onSave={(v) => saveField("memory_text", v)}
        />

        {/* Workspace Files */}
        <Section
          title="Workspace Files"
          count={filesWithStatus.length}
          headerRight={
            <div className="flex items-center gap-2">
              <select
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value as typeof fileFilter)}
                className="text-[10px] bg-[#0a0e1a] border border-[#1e293b] rounded px-2 py-1 text-[#94a3b8] cursor-pointer"
              >
                <option value="all">All</option>
                <option value="current">Current</option>
                <option value="stale">Stale</option>
                <option value="orphan">Orphan</option>
              </select>
              <select
                value={fileSort}
                onChange={(e) => setFileSort(e.target.value as typeof fileSort)}
                className="text-[10px] bg-[#0a0e1a] border border-[#1e293b] rounded px-2 py-1 text-[#94a3b8] cursor-pointer"
              >
                <option value="path">Sort: Path</option>
                <option value="modified">Sort: Modified</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          }
        >
          {filteredFiles.length === 0 && !addingFile ? (
            <EmptyState text="No workspace files tracked. Add files this agent uses or owns." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#475569]">
                    <th className="text-left py-2 pr-4 font-semibold">Path</th>
                    <th className="text-left py-2 pr-4 font-semibold hidden sm:table-cell">Description</th>
                    <th className="text-left py-2 pr-4 font-semibold">Size</th>
                    <th className="text-left py-2 pr-4 font-semibold">Modified</th>
                    <th className="text-left py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f, i) => (
                    <tr key={i} className="border-t border-[#1e293b]/50 hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4">
                        <span className="font-mono text-xs text-[#00d4d4]">{f.name || f.path}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-[#94a3b8] hidden sm:table-cell">{f.description}</td>
                      <td className="py-2.5 pr-4 text-xs text-[#475569] font-mono">{f.size}</td>
                      <td className="py-2.5 pr-4 text-xs text-[#475569]">
                        {(f.updated_at || f.last_modified) ? timeAgo(f.updated_at || f.last_modified || "") : "\u2014"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <FileStatusBadge status={f.status} />
                      </td>
                      <td className="py-2.5">
                        <button
                          onClick={() => removeFile(f.name || f.path || "")}
                          className="text-[10px] text-[#475569] hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add file form */}
          {addingFile ? (
            <div className="mt-4 rounded-lg border border-[#1e293b] p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={newFile.path}
                  onChange={(e) => setNewFile({ ...newFile, path: e.target.value })}
                  placeholder="File path"
                  className="text-sm bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-2 text-[#f1f5f9] font-mono focus:outline-none focus:border-[#00d4d4]"
                />
                <input
                  value={newFile.description}
                  onChange={(e) => setNewFile({ ...newFile, description: e.target.value })}
                  placeholder="Description"
                  className="text-sm bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-2 text-[#f1f5f9] focus:outline-none focus:border-[#00d4d4]"
                />
                <input
                  value={newFile.size}
                  onChange={(e) => setNewFile({ ...newFile, size: e.target.value })}
                  placeholder="Size (e.g. 5KB)"
                  className="text-sm bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-2 text-[#f1f5f9] font-mono focus:outline-none focus:border-[#00d4d4]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addFile} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#00d4d4]/10 text-[#00d4d4] border border-[#00d4d4]/30 hover:bg-[#00d4d4]/20 transition-colors cursor-pointer">
                  Add File
                </button>
                <button onClick={() => setAddingFile(false)} className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#64748b] border border-[#1e293b] hover:text-white transition-colors cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingFile(true)}
              className="mt-3 text-xs text-[#475569] hover:text-[#00d4d4] transition-colors cursor-pointer"
            >
              + Add file
            </button>
          )}
        </Section>

        {/* Current Tasks */}
        <Section title="Current Tasks" count={agent.current_tasks.length}>
          {agent.current_tasks.length === 0 ? (
            <EmptyState text="No tasks assigned. Tasks will appear here when linked from the Tasks system." />
          ) : (
            <div className="space-y-2">
              {agent.current_tasks.map((task) => {
                const ts = TASK_STATUS_STYLE[task.status] ?? TASK_STATUS_STYLE.pending;
                return (
                  <div key={task.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5 border border-[#1e293b]">
                    <span className={`text-[10px] font-bold tracking-wider w-20 ${ts.color}`}>{ts.label}</span>
                    <span className="text-sm text-[#cbd5e1] flex-1">{task.text}</span>
                    {task.project && <span className="text-[10px] text-[#475569] uppercase tracking-wider">{task.project}</span>}
                    {task.due && <span className="text-[10px] text-[#475569] font-mono">{task.due}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Output Log */}
        <Section title="Output Log" count={agent.output_log.length}>
          {agent.output_log.length === 0 ? (
            <EmptyState text="No outputs recorded yet. Future API-updated output log will appear here." />
          ) : (
            <div className="space-y-2">
              {agent.output_log.map((entry, i) => {
                const os = OUTPUT_STATUS_STYLE[entry.status] ?? OUTPUT_STATUS_STYLE.success;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-2.5 border border-[#1e293b]">
                    <span className="text-[10px] text-[#475569] font-mono w-28 flex-shrink-0">
                      {new Date(entry.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className={`text-[10px] font-bold tracking-wider w-16 ${os.color}`}>{entry.status.toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#cbd5e1]">{entry.task_name}</span>
                      {entry.summary && <span className="text-xs text-[#64748b] ml-2">{entry.summary}</span>}
                    </div>
                    {entry.link && (
                      <a href={entry.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00d4d4] hover:underline flex-shrink-0">View →</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Blockers */}
        <Section title="Blockers" count={agent.blockers.length}>
          {agent.blockers.length === 0 ? (
            <EmptyState text="No blockers. When this agent is waiting on something, it will appear here." />
          ) : (
            <div className="space-y-2">
              {agent.blockers.map((b, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg px-4 py-3 border border-red-500/20 bg-red-500/5">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-[#cbd5e1]">{b.description}</p>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      Waiting on: <span className="text-red-400">{b.waiting_on}</span>
                      {b.since && <span className="ml-2">since {b.since}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </main>
    </div>
  );
}

/* ── Memory Section (upgraded) ── */

function MemorySection({
  agent, editing, editBuffer, onStart, onCancel, onChange, onSave,
}: {
  agent: Agent;
  editing: boolean;
  editBuffer: string;
  onStart: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Parse memory into sections by ## headers
  const sections = useMemo(() => {
    if (!agent.memory_text) return [];
    const lines = agent.memory_text.split("\n");
    const result: { heading: string; content: string }[] = [];
    let current: { heading: string; lines: string[] } | null = null;
    const preambleLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (current) result.push({ heading: current.heading, content: current.lines.join("\n") });
        current = { heading: line.replace("## ", "").trim(), lines: [] };
      } else if (current) {
        current.lines.push(line);
      } else {
        preambleLines.push(line);
      }
    }
    if (current) result.push({ heading: current.heading, content: current.lines.join("\n") });

    const preamble = preambleLines.join("\n").trim();
    if (preamble && result.length > 0) {
      result.unshift({ heading: "", content: preamble });
    } else if (preamble && result.length === 0) {
      result.push({ heading: "", content: preamble });
    }

    return result;
  }, [agent.memory_text]);

  const toggleSection = (heading: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(heading) ? next.delete(heading) : next.add(heading);
      return next;
    });
  };

  // Staleness
  const memoryAge = agent.memory_updated_at
    ? Date.now() - new Date(agent.memory_updated_at).getTime()
    : null;
  const hoursOld = memoryAge ? memoryAge / (1000 * 60 * 60) : null;
  const isCritical = hoursOld !== null && hoursOld > 72;
  const isStale = hoursOld !== null && hoursOld > 24;

  return (
    <div className={`rounded-xl border overflow-hidden bg-[#111827] ${
      isCritical ? "border-red-500/40" : isStale ? "border-amber-500/30" : "border-[#1e293b]"
    }`}>
      <div className="px-5 py-3 border-b border-[#1e293b] flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">Memory</h2>

        {/* Staleness warnings */}
        {isCritical && (
          <span className="text-[10px] font-bold tracking-wider text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
            CRITICAL — memory outdated
          </span>
        )}
        {isStale && !isCritical && (
          <span className="text-[10px] font-bold tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
            STALE
          </span>
        )}

        <span className="flex-1" />

        {agent.memory_updated_at && (
          <span className="text-[10px] text-[#475569]">
            Updated: {timeAgo(agent.memory_updated_at)}
          </span>
        )}
      </div>

      <div className="p-5">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editBuffer}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a3e] bg-[#0a0e1a] text-sm text-[#f1f5f9] p-3 resize-y focus:outline-none focus:border-[#00d4d4] font-mono min-h-[300px]"
              placeholder={`Paste ${agent.name}'s memory text here.\n\nUse ## headers to create collapsible sections.\n\n## Example Section\n- Memory item 1\n- Memory item 2`}
            />
            <div className="flex items-center gap-2">
              <button onClick={() => onSave(editBuffer)} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#00d4d4]/10 text-[#00d4d4] border border-[#00d4d4]/30 hover:bg-[#00d4d4]/20 transition-colors cursor-pointer">Save</button>
              <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#64748b] border border-[#1e293b] hover:text-white transition-colors cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : agent.memory_text ? (
          <div className="space-y-1">
            {sections.map((sec, i) => (
              <div key={i}>
                {sec.heading ? (
                  <button
                    onClick={() => toggleSection(sec.heading)}
                    className="w-full flex items-center gap-2 py-2 cursor-pointer hover:bg-white/[0.02] rounded transition-colors"
                  >
                    <span className="text-[10px] text-[#475569]">
                      {collapsedSections.has(sec.heading) ? "\u25B6" : "\u25BC"}
                    </span>
                    <span className="text-sm font-semibold text-[#f1f5f9]">{sec.heading}</span>
                  </button>
                ) : null}
                {(!sec.heading || !collapsedSections.has(sec.heading)) && (
                  <div className="pl-4 pb-2">
                    <RenderedMarkdown text={sec.content} />
                  </div>
                )}
              </div>
            ))}
            <div className="mt-3 text-right">
              <button onClick={onStart} className="text-[10px] text-[#475569] hover:text-[#00d4d4] transition-colors cursor-pointer">
                Edit Memory
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="rounded-lg border border-dashed border-[#1e293b] px-4 py-6 text-center">
              <p className="text-sm text-[#475569] italic">
                Paste {agent.name}&apos;s memory text here. Use ## headers for collapsible sections.
              </p>
            </div>
            <div className="mt-2 text-right">
              <button onClick={onStart} className="text-[10px] text-[#475569] hover:text-[#00d4d4] transition-colors cursor-pointer">
                Edit Memory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Markdown Renderer (lightweight) ── */

function RenderedMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Headers
        if (trimmed.startsWith("### ")) {
          return <h4 key={i} className="text-xs font-bold text-[#94a3b8] mt-2">{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith("# ")) {
          return <h3 key={i} className="text-sm font-bold text-[#f1f5f9] mt-3">{trimmed.slice(2)}</h3>;
        }

        // Bullets
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 text-xs text-[#cbd5e1]">
              <span className="text-[#00d4d4] mt-0.5 flex-shrink-0">\u2022</span>
              <span><InlineMarkdown text={trimmed.slice(2)} /></span>
            </div>
          );
        }

        // Code blocks
        if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2) {
          return <code key={i} className="text-xs font-mono text-[#00d4d4] bg-[#0a0e1a] px-2 py-1 rounded block">{trimmed.slice(1, -1)}</code>;
        }

        // Normal text
        return <p key={i} className="text-xs text-[#cbd5e1] leading-relaxed"><InlineMarkdown text={trimmed} /></p>;
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-[#f1f5f9]">{part.slice(2, -2)}</strong>;
        }
        // Inline code `text`
        const codeParts = part.split(/(`[^`]+`)/g);
        return codeParts.map((cp, j) => {
          if (cp.startsWith("`") && cp.endsWith("`")) {
            return <code key={`${i}-${j}`} className="font-mono text-[#00d4d4] bg-[#0a0e1a] px-1 rounded text-[10px]">{cp.slice(1, -1)}</code>;
          }
          return <span key={`${i}-${j}`}>{cp}</span>;
        });
      })}
    </>
  );
}

/* ── Shared Components ── */

function Section({ title, count, headerRight, children }: {
  title: string; count?: number; headerRight?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1e293b] flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-bold tracking-widest uppercase text-[#64748b]">{title}</h2>
        {count !== undefined && <span className="text-xs font-mono text-[#475569]">{count}</span>}
        {headerRight && <><span className="flex-1" />{headerRight}</>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EditableText({
  field, value, placeholder, editing, editBuffer, onStart, onCancel, onChange, onSave, tall, label,
}: {
  field: string; value: string; placeholder: string; editing: boolean; editBuffer: string;
  onStart: () => void; onCancel: () => void; onChange: (v: string) => void; onSave: (v: string) => void;
  tall?: boolean; label?: string;
}) {
  if (editing) {
    return (
      <div className="space-y-2">
        {label && <div className="text-[10px] uppercase tracking-wider text-[#475569] font-semibold">{label}</div>}
        <textarea
          value={editBuffer} onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-[#2a2a3e] bg-[#0a0e1a] text-sm text-[#f1f5f9] p-3 resize-y focus:outline-none focus:border-[#00d4d4] font-mono ${tall ? "min-h-[200px]" : "min-h-[80px]"}`}
          placeholder={placeholder}
        />
        <div className="flex items-center gap-2">
          <button onClick={() => onSave(editBuffer)} className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#00d4d4]/10 text-[#00d4d4] border border-[#00d4d4]/30 hover:bg-[#00d4d4]/20 transition-colors cursor-pointer">Save</button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#64748b] border border-[#1e293b] hover:text-white transition-colors cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && <div className="text-[10px] uppercase tracking-wider text-[#475569] font-semibold mb-1">{label}</div>}
      <div onClick={onStart} className={`rounded-lg border border-[#1e293b] p-3 cursor-pointer hover:border-[#2a2a3e] transition-colors ${tall ? "min-h-[100px]" : "min-h-[40px]"}`}>
        {value ? (
          <pre className="text-sm text-[#cbd5e1] whitespace-pre-wrap font-sans leading-relaxed">{value}</pre>
        ) : (
          <p className="text-sm text-[#475569] italic whitespace-pre-wrap">{placeholder}</p>
        )}
      </div>
      <div className="mt-1 text-right">
        <button onClick={onStart} className="text-[10px] text-[#475569] hover:text-[#00d4d4] transition-colors cursor-pointer">Edit</button>
      </div>
    </div>
  );
}

function FileStatusBadge({ status }: { status: string }) {
  if (status === "current") return <span className="text-[10px] text-green-400">&#x2705; Current</span>;
  if (status === "stale") return <span className="text-[10px] text-amber-400">&#x26A0;&#xFE0F; Stale</span>;
  if (status === "orphan") return <span className="text-[10px] text-red-400">&#x1F534; Orphan</span>;
  return <span className="text-[10px] text-[#475569]">{status}</span>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#1e293b] px-4 py-6 text-center">
      <p className="text-sm text-[#475569] italic">{text}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
