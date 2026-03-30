"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ── Types ── */
interface IdeaDetail {
  id: string;
  title: string;
  status: "raw" | "expanded" | "queued" | "promoted" | "zombie" | "graveyard";
  original_input: string;
  cleaned_summary: string;
  image_url: string | null;
  extra_notes: string;
  expansion_ideas: string[];
  market_whisper: string | null;
  capability_fit: string | null;
  tags: string[];
  excitement: number;
  practicality: {
    time_to_mvp: string;
    capital_required: string;
    revenue_model: string;
    competition_level: string;
  };
  promotion_channels: string[];
  updated_at: string;
  created_at: string;
}

/* ── Constants ── */
const TOKEN = "apex-live-2026";

const STATUS_OPTIONS: { value: string; label: string; bg: string; text: string }[] = [
  { value: "raw", label: "Raw", bg: "rgba(107,107,128,0.15)", text: "#6b6b80" },
  { value: "expanded", label: "Expanded", bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
  { value: "queued", label: "Queued", bg: "rgba(0,212,212,0.15)", text: "#00d4d4" },
  { value: "promoted", label: "Promoted", bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  { value: "zombie", label: "Zombie", bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  { value: "graveyard", label: "Graveyard", bg: "rgba(55,55,70,0.3)", text: "#4a4a5a" },
];

const TIME_OPTIONS = ["< 1 week", "1-2 weeks", "1 month", "2-3 months", "6+ months", "Unknown"];
const CAPITAL_OPTIONS = ["$0 (sweat equity)", "< $500", "$500-$2K", "$2K-$10K", "$10K+", "Unknown"];
const REVENUE_OPTIONS = ["SaaS subscription", "One-time purchase", "Marketplace commission", "Advertising", "Freemium", "Service fee", "Unknown"];
const COMPETITION_OPTIONS = ["Blue ocean", "Low", "Moderate", "High", "Red ocean", "Unknown"];

const PROMO_CHANNELS = [
  { id: "ig", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "reddit", label: "Reddit" },
  { id: "ph", label: "Product Hunt" },
  { id: "paid", label: "Paid Ads" },
  { id: "email", label: "Email" },
  { id: "influencer", label: "Influencer" },
];

/* ── Seed Data ── */
const SEED_IDEAS: Record<string, IdeaDetail> = {
  "idea-repostai": {
    id: "idea-repostai",
    title: "RepostAI",
    status: "expanded",
    original_input: "What if one piece of content could automatically become 10 posts across every platform? Like, you write a tweet thread and it becomes an IG carousel, LinkedIn post, TikTok script, email, blog post — all optimised for each platform.",
    cleaned_summary: "AI-powered content repurposing engine that transforms a single piece of content into platform-optimised variants across Instagram, TikTok, LinkedIn, Twitter, email, and blog formats. Targets solo creators and small marketing teams.",
    image_url: null,
    extra_notes: "Could integrate with Buffer/Hootsuite for direct publishing. The AI needs to understand each platform's native format, not just resize.",
    expansion_ideas: [
      "Chrome extension that captures any content and repurposes instantly",
      "API for agencies to white-label the service",
      "Analytics dashboard showing which repurposed format performs best",
      "Template marketplace where creators sell their best-performing formats",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["AI", "Content", "SaaS"],
    excitement: 5,
    practicality: { time_to_mvp: "1-2 weeks", capital_required: "< $500", revenue_model: "SaaS subscription", competition_level: "Moderate" },
    promotion_channels: ["ph", "reddit", "tiktok"],
    updated_at: "2026-03-28T15:00:00Z",
    created_at: "2026-03-25T10:00:00Z",
  },
  "idea-parliament": {
    id: "idea-parliament",
    title: "Parliament Tracker",
    status: "promoted",
    original_input: "MPs say one thing in public and vote differently. Nobody tracks this systematically. Build something that catches them out automatically.",
    cleaned_summary: "AI-powered platform tracking MP voting records, public statements, and committee appearances to detect contradictions and surface hidden patterns. Uses NLP to compare speech content against voting behaviour.",
    image_url: null,
    extra_notes: "Already live on Vercel with 70 MPs. D3 chamber visualisation working. Need to expand to all 650 MPs and add historical data.",
    expansion_ideas: [
      "WhatsApp/Telegram bot for constituency alerts",
      "Journalist API for media partnerships",
      "Prediction model for upcoming votes based on speech patterns",
      "MP accountability scorecards shareable on social media",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["GovTech", "Data", "AI"],
    excitement: 4,
    practicality: { time_to_mvp: "1-2 weeks", capital_required: "$0 (sweat equity)", revenue_model: "Freemium", competition_level: "Blue ocean" },
    promotion_channels: ["reddit", "email"],
    updated_at: "2026-03-29T12:00:00Z",
    created_at: "2026-03-20T14:00:00Z",
  },
  "idea-comic": {
    id: "idea-comic",
    title: "Comic Creator",
    status: "raw",
    original_input: "AI can now generate consistent characters across images. What if you could type a story and get a full comic book? Kids' stories, manga, graphic novels — all from a text prompt.",
    cleaned_summary: "AI comic book generator that takes story prompts and produces full comic pages with consistent characters, panel layouts, speech bubbles, and visual storytelling. Targets indie creators and parents making stories for kids.",
    image_url: null,
    extra_notes: "",
    expansion_ideas: [
      "Style transfer — make any story look like Marvel, manga, Tintin, etc.",
      "Print-on-demand integration for physical comic books",
      "Collaborative mode where kids can co-create stories",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["Creative", "AI", "Consumer"],
    excitement: 4,
    practicality: { time_to_mvp: "1 month", capital_required: "$500-$2K", revenue_model: "Freemium", competition_level: "Low" },
    promotion_channels: ["tiktok", "ig"],
    updated_at: "2026-03-28T09:00:00Z",
    created_at: "2026-03-28T09:00:00Z",
  },
  "idea-peptide-stack": {
    id: "idea-peptide-stack",
    title: "Peptide Stack Builder",
    status: "queued",
    original_input: "People keep asking what peptides to stack together. Build an interactive tool that recommends stacks based on your goals — fat loss, muscle gain, recovery, anti-aging.",
    cleaned_summary: "Interactive peptide stack recommendation tool that suggests combinations based on user goals, body stats, experience level, and budget. Integrates with Caliber Peptides product catalog for direct purchasing.",
    image_url: null,
    extra_notes: "Could be a standalone page on the Caliber site or a separate micro-app. Need to be careful about medical claims.",
    expansion_ideas: [
      "Protocol builder with dosing schedules and cycle planning",
      "Community-sourced stack reviews and ratings",
      "Integration with blood work tracking for outcome measurement",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["Health", "Tool", "Caliber"],
    excitement: 3,
    practicality: { time_to_mvp: "< 1 week", capital_required: "$0 (sweat equity)", revenue_model: "Service fee", competition_level: "Low" },
    promotion_channels: ["ig", "email"],
    updated_at: "2026-03-26T16:00:00Z",
    created_at: "2026-03-22T16:00:00Z",
  },
  "idea-villa-investor": {
    id: "idea-villa-investor",
    title: "Villa Investor Platform",
    status: "raw",
    original_input: "People want to invest in holiday villas but managing them is a nightmare. What if there was a platform that matched investors with property managers and handled everything — fractional ownership, yield tracking, automated reporting?",
    cleaned_summary: "Marketplace connecting villa investors with professional property managers. Features fractional ownership options, real-time yield tracking, automated financial reporting, and occupancy analytics.",
    image_url: null,
    extra_notes: "",
    expansion_ideas: [
      "Fractional ownership tokenisation using blockchain",
      "AI-powered pricing optimisation for rental yields",
      "Virtual tours and property inspection reports",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["PropTech", "Marketplace", "Finance"],
    excitement: 3,
    practicality: { time_to_mvp: "2-3 months", capital_required: "$2K-$10K", revenue_model: "Marketplace commission", competition_level: "Moderate" },
    promotion_channels: ["paid", "email"],
    updated_at: "2026-03-27T11:00:00Z",
    created_at: "2026-03-27T11:00:00Z",
  },
  "idea-market-intel": {
    id: "idea-market-intel",
    title: "Market Intel as a Service",
    status: "zombie",
    original_input: "Paying $5K for a market research report is insane. AI agents could produce the same quality in hours for $50. On-demand competitor analysis, pricing intel, trend forecasting.",
    cleaned_summary: "On-demand market research reports generated by AI agents. Covers competitor analysis, pricing intelligence, trend forecasting, and market sizing. Targets startups and SMBs who can't afford traditional research firms.",
    image_url: null,
    extra_notes: "Stalled because the output quality wasn't consistent enough. Need better prompting and fact-checking pipeline.",
    expansion_ideas: [
      "Subscription tier with weekly auto-generated industry briefs",
      "API for integration into investor pitch deck builders",
      "Custom agent training on industry-specific data sources",
    ],
    market_whisper: null,
    capability_fit: null,
    tags: ["B2B", "AI", "Research"],
    excitement: 2,
    practicality: { time_to_mvp: "1 month", capital_required: "$500-$2K", revenue_model: "SaaS subscription", competition_level: "High" },
    promotion_channels: ["ph", "reddit", "paid"],
    updated_at: "2026-03-18T08:00:00Z",
    created_at: "2026-03-15T08:00:00Z",
  },
};

/* ── Component ── */
export default function IdeaDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Fetch idea
  const fetchIdea = useCallback(async () => {
    try {
      const res = await fetch(`/api/map-room/ideas/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.id) {
          setIdea(data);
          return;
        }
      }
    } catch {
      // fallback
    }
    // Use seed data
    if (SEED_IDEAS[id]) {
      setIdea(SEED_IDEAS[id]);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchIdea();
  }, [id, fetchIdea]);

  // Update field
  const updateField = (field: string, value: unknown) => {
    if (!idea) return;
    setIdea({ ...idea, [field]: value, updated_at: new Date().toISOString() } as IdeaDetail);
  };

  const updatePracticality = (field: string, value: string) => {
    if (!idea) return;
    setIdea({
      ...idea,
      practicality: { ...idea.practicality, [field]: value },
      updated_at: new Date().toISOString(),
    });
  };

  const togglePromoChannel = (channelId: string) => {
    if (!idea) return;
    const channels = idea.promotion_channels.includes(channelId)
      ? idea.promotion_channels.filter((c) => c !== channelId)
      : [...idea.promotion_channels, channelId];
    updateField("promotion_channels", channels);
  };

  // Save
  const handleSave = async () => {
    if (!idea) return;
    setSaving(true);
    try {
      await fetch(`/api/map-room/ideas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify(idea),
      });
    } catch {
      // silent fail — data is local
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Actions
  const handlePromote = async () => {
    updateField("status", "promoted");
    // In a real app, this would create a Stage 0 project
    handleSave();
  };

  const handlePark = () => {
    updateField("status", "zombie");
    handleSave();
  };

  const handleKill = () => {
    updateField("status", "graveyard");
    handleSave();
  };

  // Title editing
  const startEditTitle = () => {
    if (!idea) return;
    setTitleDraft(idea.title);
    setEditingTitle(true);
  };

  const saveTitle = () => {
    updateField("title", titleDraft);
    setEditingTitle(false);
  };

  if (!idea) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm animate-pulse" style={{ color: "#6b6b80" }}>Loading idea...</div>
      </div>
    );
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === idea.status) || STATUS_OPTIONS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ── Back link ── */}
      <Link
        href="/map-room/ideas"
        className="inline-flex items-center gap-2 text-xs font-medium transition-colors hover:text-white"
        style={{ color: "#6b6b80" }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Ideas
      </Link>

      {/* ── Title + Status ── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                autoFocus
                className="text-2xl font-bold bg-transparent border-b-2 focus:outline-none w-full"
                style={{ color: "#ffffff", borderColor: "#00d4d4" }}
              />
              <button onClick={saveTitle} className="text-xs px-3 py-1 rounded cursor-pointer" style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4" }}>
                Save
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-white cursor-pointer hover:text-[#00d4d4] transition-colors group"
              onClick={startEditTitle}
              title="Click to edit"
            >
              {idea.title}
              <span className="text-xs ml-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#6b6b80" }}>
                ✏️ click to edit
              </span>
              <FieldLabel type="manual" />
            </h1>
          )}
        </div>

        {/* Status dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={idea.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer focus:outline-none uppercase tracking-wider"
            style={{ background: currentStatus.bg, color: currentStatus.text, border: `1px solid ${currentStatus.text}33` }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Original Input ── */}
      <Section title="Original Input" fieldType="manual">
        <textarea
          value={idea.original_input}
          onChange={(e) => updateField("original_input", e.target.value)}
          rows={4}
          className="w-full rounded-lg border px-4 py-3 text-sm resize-y focus:outline-none transition-colors"
          style={{ background: "#0a0a0f", borderColor: "#1e1e2e", color: "#a0a0b0", fontFamily: "'Inter', sans-serif" }}
        />
      </Section>

      {/* ── Cleaned Summary ── */}
      <Section title="Cleaned Summary" fieldType="agent">
        <textarea
          value={idea.cleaned_summary}
          onChange={(e) => updateField("cleaned_summary", e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-4 py-3 text-sm resize-y focus:outline-none transition-colors"
          style={{ background: "#0a0a0f", borderColor: "#1e1e2e", color: "#a0a0b0" }}
        />
      </Section>

      {/* ── Image ── */}
      <Section title="Cover Image" fieldType="placeholder">
        <div
          className="rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:border-[#2a2a3e] transition-colors"
          style={{ borderColor: "#1e1e2e" }}
        >
          {idea.image_url ? (
            <img src={idea.image_url} alt={idea.title} className="max-w-full rounded-lg mx-auto" />
          ) : (
            <div>
              <div className="text-2xl mb-2 opacity-40">🖼️</div>
              <p className="text-xs" style={{ color: "#6b6b80" }}>Drop an image here or click to upload</p>
              <button
                className="mt-3 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.2)" }}
              >
                Generate Image
                <span className="ml-1 text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)", color: "#6b6b80" }}>🔌</span>
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ── Extra Notes ── */}
      <Section title="Extra Notes" fieldType="manual">
        <textarea
          value={idea.extra_notes}
          onChange={(e) => updateField("extra_notes", e.target.value)}
          rows={3}
          placeholder="Add any extra thoughts, links, or context..."
          className="w-full rounded-lg border px-4 py-3 text-sm resize-y focus:outline-none transition-colors placeholder-[#4a4a5a]"
          style={{ background: "#0a0a0f", borderColor: "#1e1e2e", color: "#a0a0b0" }}
        />
      </Section>

      {/* ── Expansion Ideas ── */}
      <Section title="Expansion Ideas" fieldType="agent">
        <div className="space-y-2">
          {idea.expansion_ideas.map((exp, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs mt-1 flex-shrink-0" style={{ color: "#00d4d4" }}>•</span>
              <input
                type="text"
                value={exp}
                onChange={(e) => {
                  const updated = [...idea.expansion_ideas];
                  updated[i] = e.target.value;
                  updateField("expansion_ideas", updated);
                }}
                className="flex-1 bg-transparent text-sm focus:outline-none border-b border-transparent hover:border-[#1e1e2e] focus:border-[#00d4d4] transition-colors py-1"
                style={{ color: "#a0a0b0" }}
              />
              <button
                onClick={() => {
                  const updated = idea.expansion_ideas.filter((_, idx) => idx !== i);
                  updateField("expansion_ideas", updated);
                }}
                className="text-xs opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
                style={{ color: "#ef4444" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => updateField("expansion_ideas", [...idea.expansion_ideas, ""])}
            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all"
            style={{ background: "rgba(0,212,212,0.08)", color: "#00d4d4" }}
          >
            + Add idea
          </button>
        </div>
      </Section>

      {/* ── Market Whisper ── */}
      <Section title="Market Whisper" fieldType="placeholder">
        <div className="rounded-lg border p-4 text-center" style={{ background: "#0a0a0f", borderColor: "#1e1e2e" }}>
          <p className="text-xs" style={{ color: "#6b6b80" }}>
            Market signals and competitive intelligence will appear here when connected.
          </p>
          <span className="inline-block mt-2 text-[9px] px-2 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)", color: "#6b6b80" }}>
            🔌 Awaiting integration
          </span>
        </div>
      </Section>

      {/* ── Capability Fit ── */}
      <Section title="Capability Fit" fieldType="placeholder">
        <div className="rounded-lg border p-4 text-center" style={{ background: "#0a0a0f", borderColor: "#1e1e2e" }}>
          <p className="text-xs" style={{ color: "#6b6b80" }}>
            AI capability matching and feasibility analysis will appear here.
          </p>
          <span className="inline-block mt-2 text-[9px] px-2 py-0.5 rounded" style={{ background: "rgba(107,107,128,0.15)", color: "#6b6b80" }}>
            🔌 Awaiting integration
          </span>
        </div>
      </Section>

      {/* ── Practicality Snapshot ── */}
      <Section title="Practicality Snapshot" fieldType="manual">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PracticalityDropdown
            label="Time to MVP"
            value={idea.practicality.time_to_mvp}
            options={TIME_OPTIONS}
            onChange={(v) => updatePracticality("time_to_mvp", v)}
          />
          <PracticalityDropdown
            label="Capital Required"
            value={idea.practicality.capital_required}
            options={CAPITAL_OPTIONS}
            onChange={(v) => updatePracticality("capital_required", v)}
          />
          <PracticalityDropdown
            label="Revenue Model"
            value={idea.practicality.revenue_model}
            options={REVENUE_OPTIONS}
            onChange={(v) => updatePracticality("revenue_model", v)}
          />
          <PracticalityDropdown
            label="Competition Level"
            value={idea.practicality.competition_level}
            options={COMPETITION_OPTIONS}
            onChange={(v) => updatePracticality("competition_level", v)}
          />
        </div>
      </Section>

      {/* ── Promotion Options ── */}
      <Section title="Promotion Channels" fieldType="manual">
        <div className="flex flex-wrap gap-2">
          {PROMO_CHANNELS.map((ch) => {
            const active = idea.promotion_channels.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => togglePromoChannel(ch.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: active ? "rgba(0,212,212,0.15)" : "rgba(30,30,46,0.5)",
                  color: active ? "#00d4d4" : "#6b6b80",
                  border: `1px solid ${active ? "rgba(0,212,212,0.3)" : "#1e1e2e"}`,
                }}
              >
                {active && "✓ "}{ch.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Actions Bar ── */}
      <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePromote}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:brightness-110"
            style={{ background: "rgba(0,212,212,0.15)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}
          >
            Promote to Stage 0 →
          </button>
          <button
            onClick={handlePark}
            className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            Park
          </button>
          <button
            onClick={handleKill}
            className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            Kill
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-50"
              style={{
                background: saved ? "rgba(34,197,94,0.15)" : "rgba(96,165,250,0.15)",
                color: saved ? "#22c55e" : "#60a5fa",
                border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "rgba(96,165,250,0.3)"}`,
              }}
            >
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-[10px] font-mono" style={{ color: "#6b6b80" }}>
          Last updated: {new Date(idea.updated_at).toLocaleString("en-GB")}
          <span className="mx-2">·</span>
          Created: {new Date(idea.created_at).toLocaleString("en-GB")}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ── Section Wrapper ── */
function Section({
  title,
  fieldType,
  children,
}: {
  title: string;
  fieldType: "manual" | "agent" | "placeholder" | "automation" | "auto";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a0a0b0" }}>
          {title}
        </h3>
        <FieldLabel type={fieldType} />
      </div>
      {children}
    </div>
  );
}

/* ── Field Type Label ── */
function FieldLabel({ type }: { type: "manual" | "agent" | "placeholder" | "automation" | "auto" }) {
  const config: Record<string, { icon: string; label: string; color: string }> = {
    manual: { icon: "✏️", label: "Manual", color: "#6b6b80" },
    agent: { icon: "🤖", label: "Agent-generated", color: "#60a5fa" },
    placeholder: { icon: "🔌", label: "Placeholder", color: "#f59e0b" },
    automation: { icon: "⚙️", label: "Future automation", color: "#a78bfa" },
    auto: { icon: "⚡", label: "Auto-generated", color: "#00d4d4" },
  };
  const c = config[type];
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
      style={{ background: `${c.color}15`, color: c.color }}
      title={c.label}
    >
      {c.icon} {c.label}
    </span>
  );
}

/* ── Practicality Dropdown ── */
function PracticalityDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: "#6b6b80" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer focus:outline-none"
        style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#a0a0b0" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
