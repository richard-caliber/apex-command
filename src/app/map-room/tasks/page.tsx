"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/* ── Types ── */
interface TaskItem {
  task_id: string;
  task_name: string;
  project: string;
  project_id: string;
  source_stage: number;
  owner: string;
  why_this_matters: string;
  impact_type: "revenue" | "growth" | "learning" | "system";
  urgency: "critical" | "high" | "medium" | "low";
  estimated_value: string;
  dependency: string;
  status: "open" | "in-progress" | "blocked" | "done" | "cancelled";
  notes: string;
  created_from: string;
  due_date: string;
  completed_at: string | null;
  overdue: boolean;
  next_action: string;
  blocker_details: string | null;
  expected_output: string;
  prompt: string | null;
  output_result: string | null;
  dependencies: string[];
  source_type: "Stage" | "Data" | "Heartbeat" | "Manual" | "Architect";
}

/* ── Constants ── */
const STAGES = [
  { id: -1, label: "Idea Inbox" },
  { id: 0, label: "Idea" },
  { id: 1, label: "Validation" },
  { id: 2, label: "Design" },
  { id: 3, label: "MVP" },
  { id: 4, label: "Traffic" },
  { id: 5, label: "Conversion" },
  { id: 6, label: "Delivery" },
  { id: 7, label: "Scale" },
];

const OWNERS = ["Newton", "Darwin", "Atlas", "Claude Code", "Architect", "Founder", "Ginge", "Unassigned"];

const URGENCY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; sort: number }> = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "#ef4444", sort: 0 },
  high: { label: "High", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "#f59e0b", sort: 1 },
  medium: { label: "Medium", color: "#00d4d4", bg: "rgba(0,212,212,0.15)", border: "#00d4d4", sort: 2 },
  low: { label: "Low", color: "#6b6b80", bg: "rgba(107,107,128,0.15)", border: "#6b6b80", sort: 3 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "#a0a0b0", bg: "rgba(160,160,176,0.1)" },
  "in-progress": { label: "In Progress", color: "#00d4d4", bg: "rgba(0,212,212,0.1)" },
  blocked: { label: "Blocked", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  done: { label: "Done", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  cancelled: { label: "Cancelled", color: "#6b6b80", bg: "rgba(107,107,128,0.1)" },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  revenue: { label: "Revenue", color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: "$" },
  growth: { label: "Growth", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", icon: "↑" },
  learning: { label: "Learning", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", icon: "◎" },
  system: { label: "System", color: "#6b6b80", bg: "rgba(107,107,128,0.1)", icon: "⚙" },
};

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Stage: { label: "Stage", color: "#00d4d4", bg: "rgba(0,212,212,0.12)" },
  Data: { label: "Data", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  Heartbeat: { label: "Heartbeat", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  Manual: { label: "Manual", color: "#a0a0b0", bg: "rgba(160,160,176,0.12)" },
  Architect: { label: "Architect", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

const OWNER_COLORS: Record<string, string> = {
  Atlas: "#60a5fa",
  Darwin: "#34d399",
  Newton: "#a78bfa",
  "Claude Code": "#fb923c",
  Architect: "#f472b6",
  Founder: "#fbbf24",
  Ginge: "#f472b6",
  Unassigned: "#f59e0b",
};

type SortKey = "urgency" | "due_date" | "impact" | "newest";

/* ── Fallback Data ── */
const FALLBACK_TASKS: TaskItem[] = [
  {
    task_id: "TSK-001", task_name: "Measure baseline conversion rate", project: "Caliber Peptides",
    project_id: "caliber", source_stage: 4, owner: "Darwin",
    why_this_matters: "Cannot evaluate traffic quality or ad spend ROI without knowing current conversion rate",
    impact_type: "revenue", urgency: "critical", estimated_value: "\u00a32,000/mo potential",
    dependency: "PostHog tracking must be live", status: "open",
    notes: "PostHog is set up but needs 7 days of data before baseline is meaningful.",
    created_from: "Pipeline \u2014 Caliber Stage 4", due_date: "2026-04-02", completed_at: null, overdue: false,
    next_action: "Verify PostHog events firing on checkout flow, wait for 7-day window",
    blocker_details: null,
    expected_output: "Baseline CVR report with funnel drop-off percentages",
    prompt: "Analyze PostHog checkout funnel for caliberpeptides.com. Report: total sessions, add-to-cart rate, checkout starts, payment completions. Calculate CVR at each step. Flag any step with >40% drop-off.",
    output_result: null,
    dependencies: ["PostHog tracking live", "7 days of traffic data"],
    source_type: "Stage",
  },
  {
    task_id: "TSK-002", task_name: "Fix carousel copy \u2014 hook too long, CTA wrong format", project: "Caliber Peptides",
    project_id: "caliber", source_stage: 4, owner: "Atlas",
    why_this_matters: "Carousel copy failed quality gate \u2014 blocks all downstream content",
    impact_type: "growth", urgency: "high", estimated_value: "~450 reach per carousel",
    dependency: "None", status: "in-progress",
    notes: "Hook needs to be under 6 words. CTA must use approved format only.",
    created_from: "Pipeline \u2014 Caliber Quality Gate", due_date: "2026-03-29", completed_at: null, overdue: true,
    next_action: "Rewrite hook under 6 words, use approved CTA format",
    blocker_details: "Darwin rejected copy: hook 9 words (max 6), CTA not in approved list",
    expected_output: "7-slide carousel copy with 8/10+ quality score",
    prompt: "Write a 7-slide Instagram carousel for Caliber Peptides BPC-157 product.\n\nRules:\n- Slide 1 hook: MAX 6 words, pattern-interrupt style\n- Each slide: 1 key benefit, max 15 words\n- Final slide CTA: must use format 'Shop [product] \u2014 link in bio'\n- Tone: clinical authority, not bro-science\n- Include 1 stat per slide where possible",
    output_result: null,
    dependencies: [],
    source_type: "Heartbeat",
  },
  {
    task_id: "TSK-003", task_name: "Analyze 7-day A/B test results", project: "GemSnap",
    project_id: "gemsnap", source_stage: 5, owner: "Darwin",
    why_this_matters: "Pricing display test running \u2014 need statistically significant results before scaling ads",
    impact_type: "revenue", urgency: "critical", estimated_value: "$500/mo if CVR hits 5%",
    dependency: "A/B test must run full 7 days", status: "blocked",
    notes: "Test started March 30. Earliest we can call it: April 6. Do NOT touch ads until then.",
    created_from: "Pipeline \u2014 GemSnap Stage 5", due_date: "2026-04-04", completed_at: null, overdue: false,
    next_action: "Wait for 7-day window to complete, then pull variant performance data",
    blocker_details: "A/B test only 1 day in \u2014 need minimum 7 days for statistical significance (n>200 per variant)",
    expected_output: "A/B test report: variant A vs B conversion rates, p-value, recommended winner",
    prompt: "Pull A/B test results for GemSnap paywall experiment. Compare Variant A (full blur) vs Variant B (40% blur + price anchor). Report: impressions, taps, conversions, CVR per variant. Run chi-squared test. Declare winner only if p < 0.05.",
    output_result: null,
    dependencies: ["A/B test 7-day minimum", "200+ sessions per variant"],
    source_type: "Stage",
  },
  {
    task_id: "TSK-004", task_name: "Design audit report page layout", project: "Edge Auto",
    project_id: "edge-auto", source_stage: 2, owner: "Claude Code",
    why_this_matters: "Todd wants demo by April 3 \u2014 this is the core deliverable for the \u00a34K offer",
    impact_type: "revenue", urgency: "critical", estimated_value: "\u00a34,000 per client",
    dependency: "9-section copy template (done)", status: "in-progress",
    notes: "Use dark premium theme. 9 sections already written by Atlas. Focus on visual wrapper.",
    created_from: "Pipeline \u2014 Edge Auto Stage 2", due_date: "2026-03-31", completed_at: null, overdue: false,
    next_action: "Build responsive page component with 9-section layout using dark theme tokens",
    blocker_details: null,
    expected_output: "Fully styled audit report page matching premium dark theme, responsive, 9 sections",
    prompt: "Build a Next.js page component for Edge Auto personalised audit reports. 9 sections: Executive Summary, Digital Presence Score, Website Analysis, SEO Health, Google Business Profile, Social Media Audit, Competitor Comparison, Quick Wins, Implementation Roadmap. Use dark premium theme (#0a0a0f bg, #111118 cards, #00d4d4 accent). Each section: icon, title, score bar, findings list, recommendation.",
    output_result: null,
    dependencies: ["9-section copy template"],
    source_type: "Architect",
  },
  {
    task_id: "TSK-005", task_name: "Set up abandoned cart email sequence", project: "GemSnap",
    project_id: "gemsnap", source_stage: 5, owner: "Unassigned",
    why_this_matters: "62% checkout abandonment \u2014 email recovery could recapture 10-15% of lost revenue",
    impact_type: "revenue", urgency: "high", estimated_value: "$200/mo recovery",
    dependency: "Email service provider needed", status: "open",
    notes: "",
    created_from: "Pipeline \u2014 GemSnap Funnel Analysis", due_date: "2026-04-08", completed_at: null, overdue: false,
    next_action: "Choose email provider (Resend vs Loops) and wire up checkout abandon webhook",
    blocker_details: null,
    expected_output: "3-email abandon sequence: 1hr reminder, 24hr social proof, 72hr discount offer",
    prompt: null,
    output_result: null,
    dependencies: ["Email service provider selection", "Checkout webhook integration"],
    source_type: "Data",
  },
  {
    task_id: "TSK-006", task_name: "Write 5 SEO peptide info articles", project: "Caliber Peptides",
    project_id: "caliber", source_stage: 4, owner: "Newton",
    why_this_matters: "Organic traffic is free \u2014 SEO articles compound over time and reduce ad dependency",
    impact_type: "growth", urgency: "medium", estimated_value: "Long-term organic traffic",
    dependency: "Research briefs completed", status: "open",
    notes: "Start with BPC-157, TB-500, and CJC-1295. Use SEO Article Writer prompt v1.",
    created_from: "Pipeline \u2014 Caliber Stage 4", due_date: "2026-04-05", completed_at: null, overdue: false,
    next_action: "Generate research brief for BPC-157, then run through SEO Article Writer v1",
    blocker_details: null,
    expected_output: "5 SEO-optimised articles (1500+ words each) with meta descriptions and internal links",
    prompt: "Write a comprehensive SEO article about BPC-157 peptide for Caliber Peptides.\n\nRequirements:\n- 1500+ words\n- Target keyword: 'BPC-157 benefits'\n- Include: mechanism of action, research studies, dosage guidance, safety profile\n- Tone: clinical authority, evidence-based\n- Include meta title (60 chars) and meta description (155 chars)\n- Add 3 internal links to related peptide pages",
    output_result: null,
    dependencies: ["Research briefs for each peptide"],
    source_type: "Stage",
  },
  {
    task_id: "TSK-007", task_name: "Set up Google Ads for branded keywords", project: "Caliber Peptides",
    project_id: "caliber", source_stage: 4, owner: "Unassigned",
    why_this_matters: "Competitors bidding on 'Caliber Peptides' \u2014 losing branded search traffic",
    impact_type: "revenue", urgency: "high", estimated_value: "\u00a3500/mo brand protection",
    dependency: "Budget approval from Founder", status: "blocked",
    notes: "Was assigned to Ginge but needs re-evaluation. Budget not yet approved.",
    created_from: "Pipeline \u2014 Caliber Stage 4", due_date: "2026-03-30", completed_at: null, overdue: true,
    next_action: "Get budget approval from Founder, then create branded campaign in Google Ads",
    blocker_details: "Budget not approved \u2014 Founder needs to review monthly ad spend proposal (\u00a3200/mo branded, \u00a3500/mo generic)",
    expected_output: "Live Google Ads branded campaign protecting 'Caliber Peptides' search terms",
    prompt: null,
    output_result: null,
    dependencies: ["Budget approval from Founder"],
    source_type: "Manual",
  },
  {
    task_id: "TSK-008", task_name: "Build PDF export for audit reports", project: "Edge Auto",
    project_id: "edge-auto", source_stage: 2, owner: "Unassigned",
    why_this_matters: "Clients expect downloadable reports for internal sharing and sales meetings",
    impact_type: "system", urgency: "medium", estimated_value: "Enables sales workflow",
    dependency: "Report page design must be done first", status: "open",
    notes: "Consider using Puppeteer or react-pdf. Must match the premium dark theme.",
    created_from: "Pipeline \u2014 Edge Auto Stage 2", due_date: "2026-04-05", completed_at: null, overdue: false,
    next_action: "Evaluate Puppeteer vs react-pdf for dark-theme PDF generation",
    blocker_details: null,
    expected_output: "PDF export endpoint that generates branded audit report matching web version",
    prompt: null,
    output_result: "Early prototype tested with react-pdf \u2014 dark backgrounds render correctly but chart SVGs need rasterisation. Puppeteer approach recommended instead.",
    dependencies: ["TSK-004 \u2014 Report page design"],
    source_type: "Architect",
  },
];

/* ── Page Component ── */
export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(FALLBACK_TASKS);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("urgency");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [ownerDropdown, setOwnerDropdown] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [urgencyDropdown, setUrgencyDropdown] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/map-room/tasks");
      if (res.ok) {
        const data = await res.json();
        if (data.tasks) setTasks(data.tasks);
        else if (data.items) {
          const mapped: TaskItem[] = data.items.map((item: Record<string, unknown>, i: number) => ({
            task_id: (item.id as string) || `TSK-${String(i + 1).padStart(3, "0")}`,
            task_name: (item.name as string) || "",
            project: (item.project as string) || "",
            project_id: (item.project_id as string) || "",
            source_stage: 0,
            owner: (item.owner as string) || "Unassigned",
            why_this_matters: (item.description as string) || "",
            impact_type: "system" as const,
            urgency: (item.urgency as "critical" | "high" | "medium" | "low") || "medium",
            estimated_value: "",
            dependency: "",
            status: (item.status as "open" | "in-progress" | "blocked" | "done" | "cancelled") || "open",
            notes: (item.notes as string) || "",
            created_from: "",
            due_date: (item.due_date as string) || "",
            completed_at: null,
            overdue: Boolean(item.overdue),
            next_action: (item.next_action as string) || "Review and determine next step",
            blocker_details: (item.blocker_details as string) || null,
            expected_output: (item.expected_output as string) || "",
            prompt: (item.prompt as string) || null,
            output_result: (item.output_result as string) || null,
            dependencies: (item.dependencies as string[]) || [],
            source_type: (item.source_type as string) || "Manual",
          }));
          setTasks(mapped);
        }
      }
    } catch {
      // Use fallback data
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const projects = useMemo(() => [...new Set(tasks.map((t) => t.project))], [tasks]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterProject !== "all") result = result.filter((t) => t.project === filterProject);
    if (filterOwner !== "all") result = result.filter((t) => t.owner === filterOwner);
    if (filterUrgency !== "all") result = result.filter((t) => t.urgency === filterUrgency);
    if (filterImpact !== "all") result = result.filter((t) => t.impact_type === filterImpact);
    if (filterStatus !== "all") result = result.filter((t) => t.status === filterStatus);
    if (filterSource !== "all") result = result.filter((t) => t.source_type === filterSource);

    result.sort((a, b) => {
      switch (sortBy) {
        case "urgency":
          return (URGENCY_CONFIG[a.urgency]?.sort ?? 99) - (URGENCY_CONFIG[b.urgency]?.sort ?? 99);
        case "due_date":
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case "impact": {
          const order = { revenue: 0, growth: 1, learning: 2, system: 3 };
          return (order[a.impact_type] ?? 99) - (order[b.impact_type] ?? 99);
        }
        case "newest":
          return b.task_id.localeCompare(a.task_id);
        default:
          return 0;
      }
    });

    // Always put overdue at top
    result.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return 0;
    });

    return result;
  }, [tasks, filterProject, filterOwner, filterUrgency, filterImpact, filterStatus, filterSource, sortBy]);

  const stageLabel = (id: number) => STAGES.find((s) => s.id === id)?.label ?? `Stage ${id}`;

  const toggleDone = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.task_id === taskId
          ? { ...t, status: t.status === "done" ? "open" : "done", completed_at: t.status === "done" ? null : new Date().toISOString() }
          : t,
      ),
    );
  };

  const changeOwner = (taskId: string, owner: string) => {
    setTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, owner } : t)));
    setOwnerDropdown(null);
  };

  const changeStatus = (taskId: string, status: TaskItem["status"]) => {
    setTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null } : t)));
    setStatusDropdown(null);
  };

  const changeUrgency = (taskId: string, urgency: TaskItem["urgency"]) => {
    setTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, urgency } : t)));
    setUrgencyDropdown(null);
  };

  const copyPrompt = async (taskId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(taskId);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  const stats = useMemo(() => {
    const overdue = tasks.filter((t) => t.overdue).length;
    const critical = tasks.filter((t) => t.urgency === "critical" && t.status !== "done").length;
    const unassigned = tasks.filter((t) => t.owner === "Unassigned").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { overdue, critical, unassigned, done, total: tasks.length };
  }, [tasks]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: "#ffffff" }}>Tasks</h2>
        <p className="text-sm mt-1" style={{ color: "#6b6b80" }}>
          Central execution control — nothing slips
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} color="#00d4d4" />
        <StatCard label="Overdue" value={stats.overdue} color="#ef4444" pulse={stats.overdue > 0} />
        <StatCard label="Critical" value={stats.critical} color="#ef4444" />
        <StatCard label="Unassigned" value={stats.unassigned} color="#f59e0b" pulse={stats.unassigned > 0} />
        <StatCard label="Done" value={stats.done} color="#22c55e" />
      </div>

      {/* ── Filters ── */}
      <div
        className="rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center gap-3"
        style={{ background: "#111118", border: "1px solid #1e1e2e" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b6b80" }}>Filter</span>

        <FilterSelect label="Project" value={filterProject} onChange={setFilterProject} options={[{ value: "all", label: "All Projects" }, ...projects.map((p) => ({ value: p, label: p }))]} />
        <FilterSelect label="Owner" value={filterOwner} onChange={setFilterOwner} options={[{ value: "all", label: "All Owners" }, ...OWNERS.map((o) => ({ value: o, label: o }))]} />
        <FilterSelect label="Urgency" value={filterUrgency} onChange={setFilterUrgency} options={[{ value: "all", label: "All" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        <FilterSelect label="Impact" value={filterImpact} onChange={setFilterImpact} options={[{ value: "all", label: "All" }, { value: "revenue", label: "Revenue" }, { value: "growth", label: "Growth" }, { value: "learning", label: "Learning" }, { value: "system", label: "System" }]} />
        <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "in-progress", label: "In Progress" }, { value: "blocked", label: "Blocked" }, { value: "done", label: "Done" }, { value: "cancelled", label: "Cancelled" }]} />
        <FilterSelect label="Source" value={filterSource} onChange={setFilterSource} options={[{ value: "all", label: "All Sources" }, { value: "Stage", label: "Stage" }, { value: "Data", label: "Data" }, { value: "Heartbeat", label: "Heartbeat" }, { value: "Manual", label: "Manual" }, { value: "Architect", label: "Architect" }]} />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "#6b6b80" }}>Sort:</span>
          {(["urgency", "due_date", "impact", "newest"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: sortBy === key ? "rgba(0,212,212,0.15)" : "transparent",
                color: sortBy === key ? "#00d4d4" : "#6b6b80",
                border: `1px solid ${sortBy === key ? "rgba(0,212,212,0.3)" : "transparent"}`,
              }}
            >
              {key === "due_date" ? "Due Date" : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task List ── */}
      <div className="space-y-2">
        {filteredTasks.length === 0 && (
          <div className="text-center py-16" style={{ color: "#6b6b80" }}>
            No tasks match filters
          </div>
        )}

        {filteredTasks.map((task) => {
          const urg = URGENCY_CONFIG[task.urgency];
          const st = STATUS_CONFIG[task.status];
          const imp = IMPACT_CONFIG[task.impact_type];
          const srcType = SOURCE_TYPE_CONFIG[task.source_type] || SOURCE_TYPE_CONFIG.Manual;
          const isExpanded = expandedTask === task.task_id;
          const isUnassigned = task.owner === "Unassigned";
          const isDone = task.status === "done";

          return (
            <div key={task.task_id}>
              {/* Task Row */}
              <div
                className="rounded-xl px-5 py-4 transition-all"
                style={{
                  background: isUnassigned ? "rgba(245,158,11,0.03)" : "#111118",
                  border: `1px solid ${isUnassigned ? "rgba(245,158,11,0.2)" : "#1e1e2e"}`,
                  borderLeft: `4px solid ${task.overdue ? "#ef4444" : urg.border}`,
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(task.task_id)}
                    className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                    style={{
                      borderColor: isDone ? "#22c55e" : "#1e1e2e",
                      background: isDone ? "rgba(34,197,94,0.2)" : "transparent",
                    }}
                  >
                    {isDone && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: "bold" }}>✓</span>}
                  </button>

                  {/* Task Info */}
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: "#6b6b80" }}>{task.task_id}</span>
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: isDone ? "#6b6b80" : "#ffffff",
                          textDecoration: isDone ? "line-through" : "none",
                        }}
                      >
                        {task.task_name}
                      </span>
                      {task.overdue && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse"
                          style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}
                        >
                          OVERDUE
                        </span>
                      )}
                      {/* Revenue $ indicator */}
                      {task.impact_type === "revenue" && (
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: "#22c55e" }}
                          title="Revenue impact"
                        >
                          $
                        </span>
                      )}
                      {/* Source badge */}
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                        style={{ background: srcType.bg, color: srcType.color }}
                      >
                        {srcType.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: "#6b6b80" }}>{task.project}</span>
                      <span className="text-[10px]" style={{ color: "#6b6b80" }}>Stage {task.source_stage} — {stageLabel(task.source_stage)} ⚡</span>
                      {/* Next Step inline */}
                      <span className="text-[10px]" style={{ color: "#00d4d4" }}>
                        → {task.next_action}
                      </span>
                    </div>
                  </button>

                  {/* Impact Indicator */}
                  <span
                    className="text-xs px-2 py-1 rounded-lg font-bold flex items-center gap-1 flex-shrink-0"
                    style={{ background: imp.bg, color: imp.color }}
                    title={`Impact: ${imp.label}`}
                  >
                    <span className="text-sm">{imp.icon}</span>
                    {imp.label}
                  </span>

                  {/* Owner (clickable dropdown) */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOwnerDropdown(ownerDropdown === task.task_id ? null : task.task_id);
                        setStatusDropdown(null);
                        setUrgencyDropdown(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: isUnassigned ? "rgba(245,158,11,0.15)" : "rgba(30,30,46,0.5)",
                        color: OWNER_COLORS[task.owner] || "#a0a0b0",
                        border: `1px solid ${isUnassigned ? "rgba(245,158,11,0.4)" : "#1e1e2e"}`,
                      }}
                    >
                      {isUnassigned && <span className="animate-pulse">!</span>}
                      {task.owner}
                      <span style={{ color: "#6b6b80", fontSize: 10 }}>▼</span>
                    </button>
                    {isUnassigned && (
                      <span
                        className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: "#f59e0b", color: "#0a0a0f" }}
                      >
                        Needs owner
                      </span>
                    )}
                    {ownerDropdown === task.task_id && (
                      <div
                        className="absolute top-full mt-1 right-0 z-50 rounded-lg py-1 min-w-[160px] shadow-2xl"
                        style={{ background: "#111118", border: "1px solid #1e1e2e" }}
                      >
                        {OWNERS.map((o) => (
                          <button
                            key={o}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeOwner(task.task_id, o);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                            style={{ color: OWNER_COLORS[o] || "#a0a0b0" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.5)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {o}
                            {o === task.owner && <span className="ml-2" style={{ color: "#00d4d4" }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Urgency Badge (clickable) */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUrgencyDropdown(urgencyDropdown === task.task_id ? null : task.task_id);
                        setOwnerDropdown(null);
                        setStatusDropdown(null);
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-full font-bold cursor-pointer"
                      style={{ background: urg.bg, color: urg.color }}
                    >
                      {urg.label}
                    </button>
                    {urgencyDropdown === task.task_id && (
                      <div
                        className="absolute top-full mt-1 right-0 z-50 rounded-lg py-1 min-w-[120px] shadow-2xl"
                        style={{ background: "#111118", border: "1px solid #1e1e2e" }}
                      >
                        {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
                          <button
                            key={key}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeUrgency(task.task_id, key as TaskItem["urgency"]);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                            style={{ color: cfg.color }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.5)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {cfg.label}
                            {key === task.urgency && <span className="ml-2" style={{ color: "#00d4d4" }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status (clickable) */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdown(statusDropdown === task.task_id ? null : task.task_id);
                        setOwnerDropdown(null);
                        setUrgencyDropdown(null);
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-full font-medium cursor-pointer"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </button>
                    {statusDropdown === task.task_id && (
                      <div
                        className="absolute top-full mt-1 right-0 z-50 rounded-lg py-1 min-w-[140px] shadow-2xl"
                        style={{ background: "#111118", border: "1px solid #1e1e2e" }}
                      >
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <button
                            key={key}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeStatus(task.task_id, key as TaskItem["status"]);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                            style={{ color: cfg.color }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,30,46,0.5)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {cfg.label}
                            {key === task.status && <span className="ml-2" style={{ color: "#00d4d4" }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: task.overdue ? "#ef4444" : "#6b6b80" }}
                  >
                    {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>

                  {/* Expand */}
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                    className="flex-shrink-0 cursor-pointer"
                    style={{ color: "#6b6b80", fontSize: 12 }}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 space-y-4" style={{ borderTop: "1px solid #1e1e2e" }}>
                    {/* WHY */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1.5 font-bold" style={{ color: "#ef4444" }}>
                        Why
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "#a0a0b0" }}>{task.why_this_matters}</p>
                    </div>

                    {/* NEXT ACTION */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1.5 font-bold" style={{ color: "#00d4d4" }}>
                        Next Action
                      </div>
                      <p className="text-sm leading-relaxed font-medium" style={{ color: "#ffffff" }}>{task.next_action}</p>
                    </div>

                    {/* IMPACT + BLOCKER DETAILS row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Impact */}
                      <div className="rounded-lg px-3 py-2.5" style={{ background: "#0a0a0f" }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1 font-bold" style={{ color: "#6b6b80" }}>
                          Impact
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-lg font-bold"
                            style={{ background: imp.bg, color: imp.color }}
                          >
                            {imp.icon} {imp.label}
                          </span>
                          <span className="text-xs" style={{ color: "#a0a0b0" }}>{task.estimated_value}</span>
                        </div>
                      </div>

                      {/* Blocker Details */}
                      <div className="rounded-lg px-3 py-2.5" style={{ background: task.blocker_details ? "rgba(239,68,68,0.05)" : "#0a0a0f" }}>
                        <div className="text-[10px] uppercase tracking-wider mb-1 font-bold" style={{ color: task.blocker_details ? "#ef4444" : "#6b6b80" }}>
                          Blocker Details
                        </div>
                        <div className="text-xs" style={{ color: task.blocker_details ? "#ef4444" : "#6b6b80" }}>
                          {task.blocker_details || "No active blockers"}
                        </div>
                      </div>
                    </div>

                    {/* DEPENDENCIES */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1.5 font-bold" style={{ color: "#6b6b80" }}>
                        Dependencies
                      </div>
                      {task.dependencies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {task.dependencies.map((dep, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-1 rounded-lg"
                              style={{ background: "rgba(30,30,46,0.5)", color: "#a0a0b0", border: "1px solid #1e1e2e" }}
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "#6b6b80" }}>None</span>
                      )}
                    </div>

                    {/* EXPECTED OUTPUT */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1.5 font-bold" style={{ color: "#6b6b80" }}>
                        Expected Output
                      </div>
                      <p className="text-sm" style={{ color: "#a0a0b0" }}>{task.expected_output || "Not specified"}</p>
                    </div>

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MetaField label="Estimated Value" value={task.estimated_value} badge="🔌 Placeholder" />
                      <MetaField label="Dependency" value={task.dependency || "None"} badge="✏️ Manual" />
                      <MetaField label="Source" value={task.created_from} badge="⚡ Auto" />
                      <MetaField label="Completed" value={task.completed_at ? new Date(task.completed_at).toLocaleDateString("en-GB") : "Not yet"} badge="⚡ Auto" />
                    </div>

                    {/* PROMPT (collapsible) */}
                    {task.prompt && (
                      <div>
                        <button
                          onClick={() => setExpandedPrompt(expandedPrompt === task.task_id ? null : task.task_id)}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-colors"
                          style={{ color: "#a78bfa" }}
                        >
                          <span>{expandedPrompt === task.task_id ? "▼" : "▶"}</span>
                          Prompt
                        </button>
                        {expandedPrompt === task.task_id && (
                          <div className="mt-2 relative">
                            <pre
                              className="rounded-lg px-4 py-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap"
                              style={{ background: "#0a0a0f", color: "#a0a0b0", border: "1px solid #1e1e2e", fontFamily: "monospace" }}
                            >
                              {task.prompt}
                            </pre>
                            <button
                              onClick={() => copyPrompt(task.task_id, task.prompt!)}
                              className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded font-semibold cursor-pointer transition-all"
                              style={{
                                background: copiedPrompt === task.task_id ? "rgba(34,197,94,0.2)" : "rgba(0,212,212,0.15)",
                                color: copiedPrompt === task.task_id ? "#22c55e" : "#00d4d4",
                                border: `1px solid ${copiedPrompt === task.task_id ? "rgba(34,197,94,0.3)" : "rgba(0,212,212,0.3)"}`,
                              }}
                            >
                              {copiedPrompt === task.task_id ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* OUTPUT RESULT (collapsible) */}
                    {task.output_result && (
                      <div>
                        <button
                          onClick={() => setExpandedOutput(expandedOutput === task.task_id ? null : task.task_id)}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold cursor-pointer transition-colors"
                          style={{ color: "#22c55e" }}
                        >
                          <span>{expandedOutput === task.task_id ? "▼" : "▶"}</span>
                          Output Result
                        </button>
                        {expandedOutput === task.task_id && (
                          <div className="mt-2">
                            <div
                              className="rounded-lg px-4 py-3 text-sm leading-relaxed"
                              style={{ background: "rgba(34,197,94,0.05)", color: "#a0a0b0", border: "1px solid rgba(34,197,94,0.15)" }}
                            >
                              {task.output_result}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-2" style={{ color: "#6b6b80" }}>
                        Notes <span className="text-[9px]">✏️ Manual</span>
                      </div>
                      <textarea
                        defaultValue={task.notes}
                        placeholder="Add notes..."
                        className="w-full rounded-lg px-4 py-3 text-sm resize-y focus:outline-none"
                        style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", color: "#a0a0b0", minHeight: 60 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-Components ── */

function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: "#111118", border: "1px solid #1e1e2e" }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#6b6b80" }}>{label}</div>
      <div className={`text-2xl font-bold font-mono ${pulse ? "animate-pulse" : ""}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-3 py-2 rounded-lg font-medium cursor-pointer focus:outline-none"
      style={{
        background: "#0a0a0f",
        color: value === "all" ? "#6b6b80" : "#00d4d4",
        border: `1px solid ${value === "all" ? "#1e1e2e" : "rgba(0,212,212,0.3)"}`,
      }}
      aria-label={label}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function MetaField({ label, value, badge }: { label: string; value: string; badge: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: "#0a0a0f" }}>
      <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: "#6b6b80" }}>
        {label} <span className="text-[8px]">{badge}</span>
      </div>
      <div className="text-xs font-medium" style={{ color: "#a0a0b0" }}>{value}</div>
    </div>
  );
}
