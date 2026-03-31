"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ── Types ── */
interface CellStatus {
  status: string;
  agent: string;
  timestamp?: string;
  error?: string;
}

interface Topic {
  date: string;
  name: string;
  format: string;
  status: string;
  summary: string;
  timeSensitive?: boolean;
  igUrl?: string;
}

interface Account {
  id: string;
  name: string;
  handle: string;
  active: boolean;
  today: {
    date: string;
    topic: string;
    grid: Record<string, Record<string, CellStatus>>;
  };
  topics: Topic[];
}

interface PipelineData {
  accounts: Account[];
}

interface HistorySnapshot {
  topic: string;
  grid: Record<string, Record<string, CellStatus>>;
}

/* ── Constants ── */
const PLATFORMS = [
  { key: "ig_carousel", label: "IG Carousel" },
  { key: "ig_reel", label: "IG Reel" },
  { key: "fb_post", label: "FB Post" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
];

const GATES = [
  { key: "research", label: "Research" },
  { key: "review_research", label: "Review Research" },
  { key: "create_content", label: "Create Content" },
  { key: "review_content", label: "Review Content" },
  { key: "publish", label: "Publish" },
];

const DOT: Record<string, { cls: string; glow: string; label: string }> = {
  done: { cls: "bg-green-500", glow: "shadow-[0_0_8px_rgba(34,197,94,0.6)]", label: "Done" },
  in_progress: { cls: "bg-amber-500 animate-pulse", glow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]", label: "In Progress" },
  failed: { cls: "bg-red-500", glow: "shadow-[0_0_8px_rgba(239,68,68,0.6)]", label: "Failed" },
  pending: { cls: "bg-[#334155]", glow: "", label: "Not Started" },
};

const TOPIC_DOT: Record<string, { icon: string; cls: string }> = {
  published: { icon: "✅", cls: "text-green-400" },
  scheduled: { icon: "⏳", cls: "text-amber-400" },
  queued: { icon: "⚪", cls: "text-[#64748b]" },
};

const FORMAT_BADGE: Record<string, string> = {
  carousel: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reel: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const TODAY = "2026-03-29";

/* ── Review Checklists ── */
const CHECKLISTS = [
  {
    title: "📸 Carousel Review Checklist",
    sections: [
      { heading: "Brand & Aesthetic", items: ["Feed consistency maintained", "Logo bottom-right", "White bold all-caps text", "Teal accent (#00d4d4)", "Consistent backgrounds", "No stock icons/emojis/watermarks"] },
      { heading: "Copy", items: ["Headline hook (max 6 words)", "Peptide name on slide 1 (MANDATORY)", "Story arc flow across slides", "Mechanism language only (activates/resets/rewinds)", "Approved CTAs only"] },
      { heading: "Structure", items: ["3-7 slides", "Each slide has clear purpose", "Text-to-image balance correct"] },
      { heading: "Image Prompts", items: ["Style consistency across slides", "Brand elements present", "NOT clauses included", "Specificity — no generic sci-fi"] },
      { heading: "Grid", items: ["Cover readable at 200px thumbnail", "Peptide name large and bold", "No feed clash with adjacent posts"] },
      { heading: "CTA", items: ["DM \"[KEYWORD]\" / Link in bio / Peptide Bible ONLY", "3-5 hashtags", "Always #CaliberPeptides"] },
      { heading: "🚫 Instant Rejects", items: ["No peptide name on cover", "Unapproved CTA", "Plain slide mixed in", "Medical claims"] },
    ],
  },
  {
    title: "🎬 Reel Review Checklist",
    sections: [
      { heading: "Hook", items: ["First 1-2s grabs attention", "Clear topic stated", "Sharp visual + text overlay"] },
      { heading: "Audio", items: ["Voiceover MANDATORY (no silent reels)", "Clear/warm tone", "Music doesn't overpower voice", "No filler words (um, uh, like)"] },
      { heading: "Visual", items: ["Well-framed shots", "Stable footage", "Smooth transitions", "Consistent color grade / branded palette"] },
      { heading: "Narrative", items: ["Hook (0-3s) → Problem (3-12s) → Solution (12-20s) → Proof+CTA (20-end)", "Scene change every 3-5s"] },
      { heading: "Technical", items: ["9:16 aspect ratio", "1080p minimum", "MP4 H.264", "15-60 seconds length"] },
      { heading: "🚫 Instant Rejects", items: ["No voiceover", "Silent reel", "Medical claims"] },
    ],
  },
  {
    title: "🧬 Caliber Content Standards",
    sections: [
      { heading: "Visual Identity", items: ["Deep teal/charcoal (#0a1a1e) background", "Caliber logo watermark", "White bold caps headlines", "Teal accent (#00d4d4)"] },
      { heading: "Hooks", items: ["Max 6 words", "Mechanism language (activates/resets/rewinds)", "No weak question openers"] },
      { heading: "Imagery", items: ["Sci-fi/cosmic/molecular aesthetic", "Thematically matched to peptide", "No stock people or lab coats"] },
      { heading: "Approved CTAs", items: ["DM us \"[KEYWORD]\"", "Link in bio", "Get the Peptide Bible", "— NO OTHER CTAs ALLOWED"] },
      { heading: "Compliance", items: ["No before/after images", "No dosage in content", "No testimonials as medical outcomes", "Grey market positioning implicit"] },
    ],
  },
];

/* ── Helper ── */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ── Main Component ── */
export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [activeTab, setActiveTab] = useState("caliber");
  const [now, setNow] = useState(new Date());
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [openChecklist, setOpenChecklist] = useState<number | null>(null);

  // Date navigation
  const [viewDate, setViewDate] = useState(TODAY);
  const [historyGrid, setHistoryGrid] = useState<HistorySnapshot | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isToday = viewDate === TODAY;

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/pipeline");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  // Fetch history when viewing a past date
  useEffect(() => {
    if (isToday) {
      setHistoryGrid(null);
      return;
    }
    setHistoryLoading(true);
    fetch(`/api/pipeline/history?account=${activeTab}&date=${viewDate}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((snap) => {
        setHistoryGrid(snap);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  }, [viewDate, activeTab, isToday]);

  const account = data?.accounts.find((a) => a.id === activeTab);

  // Which grid to display
  const displayGrid = isToday ? account?.today.grid : historyGrid?.grid;
  const displayTopic = isToday ? account?.today.topic : historyGrid?.topic;

  return (
    <div className="min-h-dvh relative" style={{ background: "#0a0e1a" }}>
      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <span key={i} className="particle" style={{ left: `${Math.random() * 100}%`, animationDuration: `${10 + Math.random() * 15}s`, animationDelay: `${Math.random() * 8}s` }} />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <span className="text-sm text-white font-medium">Pipeline</span>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompts</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}{" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2"><span className="refresh-dot" /><span className="text-xs">LIVE</span></span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Project Tabs */}
        {data && (
          <div className="flex gap-1 border-b border-[#1e293b]">
            {data.accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => { if (acc.active) { setActiveTab(acc.id); setViewDate(TODAY); } }}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === acc.id
                    ? "bg-[#111827] text-white border border-[#1e293b] border-b-transparent -mb-px"
                    : acc.active
                      ? "text-[#64748b] hover:text-white"
                      : "text-[#334155] cursor-not-allowed"
                }`}
              >
                {acc.name}
                {!acc.active && <span className="ml-1.5 text-[9px] text-[#475569]">SOON</span>}
              </button>
            ))}
          </div>
        )}

        {!data && (
          <div className="flex items-center justify-center h-[40vh]">
            <span className="text-[#475569] animate-pulse">Loading pipeline...</span>
          </div>
        )}

        {account && (
          <>
            {/* Account info bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-sm text-[#64748b]">{account.handle}</span>
                {displayTopic && (
                  <span className="ml-3 text-sm text-[#94a3b8]">
                    {isToday ? "Today" : formatDateLabel(viewDate)}: <span className="text-white font-semibold">{displayTopic}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#475569]">
                <span>🔬 Newton</span><span>🔄 Darwin</span><span>🧭 Atlas</span>
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewDate(shiftDate(viewDate, -1))}
                className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#334155] transition-colors text-sm"
              >
                ← Prev
              </button>
              <span className={`text-sm font-mono px-3 py-1.5 rounded-lg ${isToday ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-[#111827] text-[#94a3b8] border border-[#1e293b]"}`}>
                {isToday ? "Today" : formatDateLabel(viewDate)}
              </span>
              {!isToday && (
                <button
                  onClick={() => setViewDate(shiftDate(viewDate, 1))}
                  className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#334155] transition-colors text-sm"
                >
                  Next →
                </button>
              )}
              {!isToday && (
                <button
                  onClick={() => setViewDate(TODAY)}
                  className="px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1e293b] text-[#64748b] hover:text-white transition-colors text-xs"
                >
                  Jump to Today
                </button>
              )}
            </div>

            {/* 2. Pipeline Grid */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
              {historyLoading && !isToday ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-[#475569] animate-pulse text-sm">Loading history...</span>
                </div>
              ) : !displayGrid && !isToday ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-[#475569] text-sm">No pipeline snapshot for {formatDateLabel(viewDate)}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-[#1e293b]">
                        <th className="text-left text-[10px] uppercase tracking-wider text-[#475569] font-semibold px-4 py-3 w-[160px]">Gate</th>
                        {PLATFORMS.map((p) => (
                          <th key={p.key} className="text-center text-[10px] uppercase tracking-wider text-[#475569] font-semibold px-3 py-3">{p.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GATES.map((gate, gi) => (
                        <tr key={gate.key} className={gi < GATES.length - 1 ? "border-b border-[#1e293b]/50" : ""}>
                          <td className="px-4 py-3.5 text-sm text-[#94a3b8] font-medium">{gate.label}</td>
                          {PLATFORMS.map((plat) => {
                            const cell = displayGrid?.[gate.key]?.[plat.key];
                            const st = cell?.status || "pending";
                            const dot = DOT[st] || DOT.pending;
                            return (
                              <td key={plat.key} className="px-3 py-3.5 text-center">
                                <div className="flex flex-col items-center gap-1 group relative">
                                  <div className={`w-4 h-4 rounded-full ${dot.cls} ${dot.glow}`} />
                                  {cell?.agent && <span className="text-xs">{cell.agent}</span>}
                                  {(cell?.timestamp || cell?.error) && (
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#0a0e1a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] whitespace-nowrap z-20">
                                      {cell.timestamp && <div className="text-[#94a3b8]">{dot.label} at {cell.timestamp}</div>}
                                      {cell.error && <div className="text-red-400">{cell.error}</div>}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Content Timeline */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-2xl p-5">
              <h3 className="text-[10px] uppercase tracking-wider text-[#64748b] font-semibold mb-4">Content Timeline</h3>
              <div className="overflow-x-auto pb-2 -mx-1 px-1">
                <div className="flex gap-3 min-w-max">
                  {account.topics.map((topic, i) => {
                    const isPast = topic.date < TODAY;
                    const isTodayTopic = topic.date === TODAY;
                    const isFuture = topic.date > TODAY;
                    const td = TOPIC_DOT[topic.status] || TOPIC_DOT.queued;
                    const fb = FORMAT_BADGE[topic.format] || FORMAT_BADGE.carousel;
                    const topicKey = `${topic.date}-${topic.name}-${topic.format}`;
                    const isExpanded = expandedTopic === topicKey;

                    return (
                      <button
                        key={i}
                        onClick={() => setExpandedTopic(isExpanded ? null : topicKey)}
                        className={`flex-shrink-0 rounded-xl border p-3 text-left transition-all ${isExpanded ? "w-[280px]" : "w-[170px]"} ${
                          isTodayTopic
                            ? "bg-[#0f1d2e] border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                            : isPast
                              ? "bg-[#0a0e1a] border-[#1e293b] opacity-60 hover:opacity-80"
                              : isFuture
                                ? "bg-[#0f1520] border-[#1e293b]"
                                : "bg-[#0a0e1a] border-[#1e293b]"
                        } ${topic.timeSensitive ? "border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.2)]" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-mono text-[#475569]">
                            {formatDateLabel(topic.date)}
                          </span>
                          <span className={`text-sm ${td.cls}`}>{td.icon}</span>
                        </div>
                        <div className="text-sm font-semibold text-[#e2e8f0] mb-1.5 leading-tight">
                          {topic.name}
                          {topic.timeSensitive && <span className="ml-1 text-red-400 text-xs">⚠️</span>}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${fb}`}>{topic.format}</span>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            <p className="text-[11px] text-[#94a3b8] leading-relaxed">{topic.summary}</p>
                            {topic.status === "published" && (
                              <div className="pt-1">
                                {topic.igUrl ? (
                                  <a
                                    href={topic.igUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    View on Instagram →
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-[#334155]">No IG link yet</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Review Checklists */}
            <div className="space-y-3">
              {CHECKLISTS.map((checklist, ci) => (
                <div key={ci} className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenChecklist(openChecklist === ci ? null : ci)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold text-[#e2e8f0]">{checklist.title}</span>
                    <span className="text-[#475569] text-xs">{openChecklist === ci ? "▲" : "▼"}</span>
                  </button>
                  {openChecklist === ci && (
                    <div className="px-5 pb-5 border-t border-[#1e293b] pt-4 space-y-4">
                      {checklist.sections.map((section, si) => (
                        <div key={si}>
                          <h4 className={`text-xs font-semibold mb-2 ${
                            section.heading.startsWith("🚫") ? "text-red-400" : "text-[#94a3b8]"
                          }`}>
                            {section.heading}
                          </h4>
                          <ul className="space-y-1">
                            {section.items.map((item, ii) => (
                              <li key={ii} className="flex items-start gap-2 text-[13px] text-[#cbd5e1]">
                                <span className={`mt-0.5 flex-shrink-0 ${
                                  section.heading.startsWith("🚫") ? "text-red-400" : "text-[#475569]"
                                }`}>
                                  {section.heading.startsWith("🚫") ? "✕" : "•"}
                                </span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="relative z-10 text-center text-xs text-[#475569] py-6">
        Auto-refreshes every 60s
      </footer>
    </div>
  );
}
