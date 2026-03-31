"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Prompt {
  id: string;
  category: string;
  title: string;
  whenToUse: string;
  prompt: string;
}

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  "MBA Strategy": { emoji: "🎓", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  "Productivity & Ops": { emoji: "⚡", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  "Sales & Offers": { emoji: "💰", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  "Research & Analysis": { emoji: "🔬", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
};

const CATEGORY_ORDER = ["MBA Strategy", "Productivity & Ops", "Sales & Offers", "Research & Analysis"];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/prompts");
    if (res.ok) {
      const data = await res.json();
      setPrompts(data.prompts);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  const filtered = prompts.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.whenToUse.toLowerCase().includes(q);
  });

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    prompts: filtered.filter((p) => p.category === cat),
  })).filter((g) => g.prompts.length > 0);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const copyPrompt = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-dvh relative">
      <Particles />

      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Pipeline</Link>
              <Link href="/finance" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Finance</Link>
              <span className="text-sm text-white font-medium">Prompts</span>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2">
              <span className="refresh-dot" />
              <span className="text-xs">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search prompts by title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xl bg-[#0d1117] border border-[#1e293b] rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#475569] transition-colors"
          />
          <div className="mt-2 text-xs text-[#64748b]">
            {filtered.length} prompt{filtered.length !== 1 ? "s" : ""} across {grouped.length} categor{grouped.length !== 1 ? "ies" : "y"}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {grouped.map((group) => {
            const cfg = CATEGORY_CONFIG[group.category] || { emoji: "📋", color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/30" };
            const isCollapsed = collapsed.has(group.category);

            return (
              <div key={group.category}>
                <button
                  onClick={() => toggleCollapse(group.category)}
                  className="flex items-center gap-3 mb-4 cursor-pointer group"
                >
                  <span className="text-xs text-[#475569]">{isCollapsed ? "▶" : "▼"}</span>
                  <h2 className={`text-lg font-bold ${cfg.color}`}>
                    {cfg.emoji} {group.category}
                  </h2>
                  <span className="text-xs text-[#64748b]">({group.prompts.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {group.prompts.map((prompt) => (
                      <div key={prompt.id} className="rounded-xl bg-[#111827] border border-[#1e293b] overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${cfg.bg} ${cfg.color} ${cfg.border} mb-2`}>
                                {group.category}
                              </span>
                              <h3 className="text-sm font-bold text-[#f1f5f9] leading-snug">{prompt.title}</h3>
                              <p className="text-xs text-[#64748b] mt-1">{prompt.whenToUse}</p>
                            </div>
                            <button
                              onClick={() => copyPrompt(prompt.id, prompt.prompt)}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex-shrink-0 cursor-pointer ${
                                copied === prompt.id
                                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                                  : "bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#475569]"
                              }`}
                            >
                              {copied === prompt.id ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleExpand(prompt.id)}
                          className="w-full px-4 py-2 border-t border-[#1e293b] text-xs text-[#64748b] hover:text-white hover:bg-[#1e293b]/30 transition-colors text-left cursor-pointer"
                        >
                          {expanded.has(prompt.id) ? "▼ Hide prompt" : "▶ Show prompt"}
                        </button>

                        {expanded.has(prompt.id) && (
                          <div className="px-4 pb-4 border-t border-[#1e293b]">
                            <pre className="text-xs text-[#cbd5e1] whitespace-pre-wrap font-mono leading-relaxed mt-3 bg-[#0d1117] rounded-lg p-3 max-h-80 overflow-y-auto">
                              {prompt.prompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-[#475569] py-6">
        {prompts.length} prompts loaded
      </footer>
    </div>
  );
}

function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
        />
      ))}
    </div>
  );
}
