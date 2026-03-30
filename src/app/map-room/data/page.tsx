"use client";

import { useState, useCallback } from "react";

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

/* ── Types ── */
interface MetricField {
  key: string;
  label: string;
  value: string | number | null;
  lastUpdated: string | null;
  source: "manual" | "api" | "agent" | "none";
  override: string;
}

interface MetricSection {
  id: string;
  title: string;
  icon: string;
  fields: MetricField[];
}

interface MissingItem {
  field: string;
  section: string;
  project: string;
  whyItMatters: string;
  expectedSource: string;
  taskNeeded: string;
}

/* ── Field Label Badges ── */
const SOURCE_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  manual: { emoji: "\u270F\uFE0F", label: "Manual", color: C.accent },
  api: { emoji: "\uD83D\uDD0C", label: "Placeholder", color: C.warn },
  agent: { emoji: "\uD83E\uDD16", label: "Agent-generated", color: C.success },
  none: { emoji: "\u26A1", label: "Missing", color: C.error },
};

/* ── Seed Data Per Project ── */
function buildProjectMetrics(projectId: string): MetricSection[] {
  const seeds: Record<string, MetricSection[]> = {
    caliber: [
      {
        id: "traffic", title: "Traffic", icon: "\uD83D\uDCC8",
        fields: [
          { key: "visits", label: "Total Visits", value: 2847, lastUpdated: "2026-03-29T18:00:00Z", source: "api", override: "" },
          { key: "sources", label: "Top Sources", value: "Instagram 42%, Direct 31%, Google 18%", lastUpdated: "2026-03-29T18:00:00Z", source: "api", override: "" },
          { key: "referral", label: "Referral Breakdown", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "daily_trend", label: "Daily Trend", value: "+12% vs last week", lastUpdated: "2026-03-29T18:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "conversion", title: "Conversion", icon: "\uD83C\uDFAF",
        fields: [
          { key: "signup_rate", label: "Signup Rate", value: "3.2%", lastUpdated: "2026-03-29T12:00:00Z", source: "api", override: "" },
          { key: "purchase_rate", label: "Purchase Rate", value: "1.1%", lastUpdated: "2026-03-29T12:00:00Z", source: "api", override: "" },
          { key: "funnel_steps", label: "Funnel Steps", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "drop_off", label: "Drop-off Point", value: "Checkout page (38% abandon)", lastUpdated: "2026-03-28T10:00:00Z", source: "agent", override: "" },
        ],
      },
      {
        id: "revenue", title: "Revenue", icon: "\uD83D\uDCB0",
        fields: [
          { key: "total", label: "Total Revenue", value: "\u00A34,280", lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "mrr", label: "MRR", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "aov", label: "AOV", value: "\u00A367.50", lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "transactions", label: "Transactions", value: 63, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "refunds", label: "Refunds", value: 2, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
        ],
      },
      {
        id: "content", title: "Content / Posts", icon: "\uD83D\uDCDD",
        fields: [
          { key: "published", label: "Posts Published", value: 12, lastUpdated: "2026-03-29T20:00:00Z", source: "agent", override: "" },
          { key: "engagement", label: "Engagement Rate", value: "4.2%", lastUpdated: "2026-03-29T20:00:00Z", source: "api", override: "" },
          { key: "reach", label: "Total Reach", value: "14,800", lastUpdated: "2026-03-29T20:00:00Z", source: "api", override: "" },
          { key: "top_post", label: "Top Post", value: "BPC-157 carousel (1,247 reach, 89 saves)", lastUpdated: "2026-03-29T20:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "funnel", title: "Funnel", icon: "\uD83D\uDD73\uFE0F",
        fields: [
          { key: "awareness", label: "Awareness", value: "14,800", lastUpdated: "2026-03-29T18:00:00Z", source: "api", override: "" },
          { key: "interest", label: "Interest", value: "2,847", lastUpdated: "2026-03-29T18:00:00Z", source: "api", override: "" },
          { key: "decision", label: "Decision", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "action", label: "Action", value: 63, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
        ],
      },
      {
        id: "qualitative", title: "Qualitative", icon: "\uD83D\uDCAC",
        fields: [
          { key: "comments", label: "Customer Comments", value: "\"Fast shipping, great quality\" (x3 this week)", lastUpdated: "2026-03-28T14:00:00Z", source: "manual", override: "" },
          { key: "objections", label: "Common Objections", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "messages", label: "DM Volume", value: 28, lastUpdated: "2026-03-29T20:00:00Z", source: "manual", override: "" },
        ],
      },
      {
        id: "payments", title: "Payments", icon: "\uD83D\uDCB3",
        fields: [
          { key: "processor", label: "Payment Processor", value: "Stripe", lastUpdated: "2026-03-01T00:00:00Z", source: "manual", override: "" },
          { key: "fees", label: "Processing Fees", value: "\u00A3128.40 (3%)", lastUpdated: "2026-03-30T08:00:00Z", source: "api", override: "" },
          { key: "chargebacks", label: "Chargebacks", value: 0, lastUpdated: "2026-03-30T08:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "email", title: "Email", icon: "\uD83D\uDCE7",
        fields: [
          { key: "list_size", label: "List Size", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "open_rate", label: "Open Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "click_rate", label: "Click Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "unsubscribes", label: "Unsubscribes", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "retention", title: "Retention", icon: "\uD83D\uDD04",
        fields: [
          { key: "churn", label: "Churn Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "repeat", label: "Repeat Purchase Rate", value: "18%", lastUpdated: "2026-03-28T10:00:00Z", source: "manual", override: "" },
          { key: "ltv", label: "Customer LTV", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
    ],
    gemsnap: [
      {
        id: "traffic", title: "Traffic", icon: "\uD83D\uDCC8",
        fields: [
          { key: "visits", label: "Total Visits", value: 8420, lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "sources", label: "Top Sources", value: "Meta Ads 58%, Organic 22%, Referral 14%", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "referral", label: "Referral Breakdown", value: "TikTok 8%, Instagram 4%, Other 2%", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "daily_trend", label: "Daily Trend", value: "+5% vs last week", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "conversion", title: "Conversion", icon: "\uD83C\uDFAF",
        fields: [
          { key: "signup_rate", label: "Signup Rate", value: "N/A (direct purchase)", lastUpdated: null, source: "manual", override: "" },
          { key: "purchase_rate", label: "Purchase Rate", value: "2.8%", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "funnel_steps", label: "Funnel Steps", value: "Land \u2192 Question \u2192 Result \u2192 Checkout", lastUpdated: "2026-03-20T00:00:00Z", source: "manual", override: "" },
          { key: "drop_off", label: "Drop-off Point", value: "Checkout (62% abandon)", lastUpdated: "2026-03-29T09:00:00Z", source: "agent", override: "" },
        ],
      },
      {
        id: "revenue", title: "Revenue", icon: "\uD83D\uDCB0",
        fields: [
          { key: "total", label: "Total Revenue", value: "$1,240", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "mrr", label: "MRR", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "aov", label: "AOV", value: "$12.40", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "transactions", label: "Transactions", value: 100, lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "refunds", label: "Refunds", value: 4, lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "content", title: "Content / Posts", icon: "\uD83D\uDCDD",
        fields: [
          { key: "published", label: "Posts Published", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "engagement", label: "Engagement Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "reach", label: "Total Reach", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "top_post", label: "Top Post", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "funnel", title: "Funnel", icon: "\uD83D\uDD73\uFE0F",
        fields: [
          { key: "awareness", label: "Awareness", value: "8,420", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "interest", label: "Interest", value: "3,200 (question answered)", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "decision", label: "Decision", value: "890 (checkout initiated)", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "action", label: "Action", value: "100 (purchased)", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "qualitative", title: "Qualitative", icon: "\uD83D\uDCAC",
        fields: [
          { key: "comments", label: "Customer Comments", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "objections", label: "Common Objections", value: "\"Too expensive for what it is\" (x5)", lastUpdated: "2026-03-29T14:00:00Z", source: "agent", override: "" },
          { key: "messages", label: "DM Volume", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "payments", title: "Payments", icon: "\uD83D\uDCB3",
        fields: [
          { key: "processor", label: "Payment Processor", value: "Stripe", lastUpdated: "2026-03-01T00:00:00Z", source: "manual", override: "" },
          { key: "fees", label: "Processing Fees", value: "$37.20 (3%)", lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
          { key: "chargebacks", label: "Chargebacks", value: 1, lastUpdated: "2026-03-30T07:00:00Z", source: "api", override: "" },
        ],
      },
      {
        id: "email", title: "Email", icon: "\uD83D\uDCE7",
        fields: [
          { key: "list_size", label: "List Size", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "open_rate", label: "Open Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "click_rate", label: "Click Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "unsubscribes", label: "Unsubscribes", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "retention", title: "Retention", icon: "\uD83D\uDD04",
        fields: [
          { key: "churn", label: "Churn Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "repeat", label: "Repeat Purchase Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "ltv", label: "Customer LTV", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
    ],
    "edge-auto": [
      {
        id: "traffic", title: "Traffic", icon: "\uD83D\uDCC8",
        fields: [
          { key: "visits", label: "Total Visits", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "sources", label: "Top Sources", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "referral", label: "Referral Breakdown", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "daily_trend", label: "Daily Trend", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "conversion", title: "Conversion", icon: "\uD83C\uDFAF",
        fields: [
          { key: "signup_rate", label: "Signup Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "purchase_rate", label: "Purchase Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "funnel_steps", label: "Funnel Steps", value: "Audit Report \u2192 Call \u2192 Proposal \u2192 Close", lastUpdated: "2026-03-20T00:00:00Z", source: "manual", override: "" },
          { key: "drop_off", label: "Drop-off Point", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "revenue", title: "Revenue", icon: "\uD83D\uDCB0",
        fields: [
          { key: "total", label: "Total Revenue", value: "\u00A30", lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "mrr", label: "MRR", value: "\u00A30", lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "aov", label: "AOV", value: "\u00A34,000 (target)", lastUpdated: "2026-03-20T00:00:00Z", source: "manual", override: "" },
          { key: "transactions", label: "Transactions", value: 0, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
          { key: "refunds", label: "Refunds", value: 0, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
        ],
      },
      {
        id: "content", title: "Content / Posts", icon: "\uD83D\uDCDD",
        fields: [
          { key: "published", label: "Posts Published", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "engagement", label: "Engagement Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "reach", label: "Total Reach", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "top_post", label: "Top Post", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "funnel", title: "Funnel", icon: "\uD83D\uDD73\uFE0F",
        fields: [
          { key: "awareness", label: "Awareness", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "interest", label: "Interest", value: "1 (audit report sent)", lastUpdated: "2026-03-29T14:00:00Z", source: "manual", override: "" },
          { key: "decision", label: "Decision", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "action", label: "Action", value: 0, lastUpdated: "2026-03-30T08:00:00Z", source: "manual", override: "" },
        ],
      },
      {
        id: "qualitative", title: "Qualitative", icon: "\uD83D\uDCAC",
        fields: [
          { key: "comments", label: "Customer Comments", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "objections", label: "Common Objections", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "messages", label: "DM Volume", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "payments", title: "Payments", icon: "\uD83D\uDCB3",
        fields: [
          { key: "processor", label: "Payment Processor", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "fees", label: "Processing Fees", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "chargebacks", label: "Chargebacks", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "email", title: "Email", icon: "\uD83D\uDCE7",
        fields: [
          { key: "list_size", label: "List Size", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "open_rate", label: "Open Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "click_rate", label: "Click Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "unsubscribes", label: "Unsubscribes", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
      {
        id: "retention", title: "Retention", icon: "\uD83D\uDD04",
        fields: [
          { key: "churn", label: "Churn Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "repeat", label: "Repeat Purchase Rate", value: null, lastUpdated: null, source: "none", override: "" },
          { key: "ltv", label: "Customer LTV", value: null, lastUpdated: null, source: "none", override: "" },
        ],
      },
    ],
  };

  return seeds[projectId] || seeds.caliber;
}

const PROJECTS = [
  { id: "caliber", name: "Caliber Peptides" },
  { id: "gemsnap", name: "GemSnap" },
  { id: "edge-auto", name: "Edge Auto" },
];

/* ── Missing Data Logic ── */
const MISSING_REASONS: Record<string, { why: string; source: string; task: string }> = {
  "referral": { why: "Can't attribute traffic to campaigns without referral data", source: "Google Analytics API", task: "Connect GA4 referral tracking" },
  "funnel_steps": { why: "Cannot identify conversion bottlenecks", source: "PostHog / Analytics", task: "Map funnel steps in analytics tool" },
  "mrr": { why: "No visibility on recurring revenue health", source: "Stripe API", task: "Connect Stripe MRR tracking" },
  "list_size": { why: "Cannot measure audience growth or email ROI", source: "Email platform API", task: "Connect email platform (Mailchimp/ConvertKit)" },
  "open_rate": { why: "No visibility on email engagement quality", source: "Email platform API", task: "Connect email platform analytics" },
  "click_rate": { why: "Cannot measure email-to-site conversion", source: "Email platform API", task: "Connect email click tracking" },
  "unsubscribes": { why: "Cannot detect list health issues early", source: "Email platform API", task: "Connect unsubscribe tracking" },
  "churn": { why: "Cannot measure customer retention or predict revenue loss", source: "Stripe / CRM", task: "Calculate churn from payment data" },
  "ltv": { why: "Cannot make informed acquisition spend decisions", source: "Stripe + Analytics", task: "Build LTV calculation from order history" },
  "repeat": { why: "No visibility on customer loyalty", source: "Order database", task: "Query repeat purchase data" },
  "comments": { why: "Missing voice-of-customer insights for content", source: "Manual / Social listening", task: "Set up weekly comment review" },
  "objections": { why: "Cannot address buying friction in content", source: "Manual / DM review", task: "Log objections from DMs and comments" },
  "messages": { why: "Cannot measure inbound interest or response time", source: "Social platform APIs", task: "Set up DM tracking" },
  "published": { why: "Cannot measure content velocity", source: "Social platform APIs", task: "Connect content tracking" },
  "engagement": { why: "Cannot benchmark content performance", source: "Social platform APIs", task: "Connect engagement metrics" },
  "reach": { why: "Cannot measure brand awareness growth", source: "Social platform APIs", task: "Connect reach tracking" },
  "top_post": { why: "Cannot identify winning content patterns", source: "Social platform APIs", task: "Connect post performance tracking" },
  "visits": { why: "No traffic data means flying blind on acquisition", source: "Google Analytics API", task: "Connect GA4 traffic tracking" },
  "sources": { why: "Cannot optimize acquisition channels", source: "Google Analytics API", task: "Connect GA4 source tracking" },
  "daily_trend": { why: "Cannot spot traffic anomalies early", source: "Google Analytics API", task: "Connect GA4 trend data" },
  "signup_rate": { why: "Cannot measure top-of-funnel conversion", source: "Analytics / CRM", task: "Set up signup tracking" },
  "purchase_rate": { why: "Cannot measure bottom-of-funnel conversion", source: "Stripe + Analytics", task: "Connect purchase tracking" },
  "drop_off": { why: "Cannot identify where users abandon", source: "PostHog / GA4", task: "Set up funnel drop-off tracking" },
  "awareness": { why: "Cannot measure top-of-funnel size", source: "Analytics", task: "Define and track awareness metric" },
  "interest": { why: "Cannot measure consideration stage", source: "Analytics", task: "Define and track interest metric" },
  "decision": { why: "Cannot measure decision stage conversion", source: "Analytics", task: "Define and track decision metric" },
  "processor": { why: "No payment infrastructure visibility", source: "Manual", task: "Document payment processor setup" },
  "fees": { why: "Cannot calculate true margin", source: "Stripe API", task: "Connect fee tracking" },
  "chargebacks": { why: "Cannot monitor payment disputes", source: "Stripe API", task: "Connect chargeback alerts" },
};

function getMissingItems(projectId: string, sections: MetricSection[]): MissingItem[] {
  const items: MissingItem[] = [];
  const proj = PROJECTS.find((p) => p.id === projectId);
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.value === null && field.source === "none") {
        const reason = MISSING_REASONS[field.key] || {
          why: "Data gap reduces decision quality",
          source: "TBD",
          task: `Connect ${field.label} data source`,
        };
        items.push({
          field: field.label,
          section: section.title,
          project: proj?.name || projectId,
          whyItMatters: reason.why,
          expectedSource: reason.source,
          taskNeeded: reason.task,
        });
      }
    }
  }
  return items;
}

/* ── Components ── */
function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_BADGE[source] || SOURCE_BADGE.none;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${s.color}15`, color: s.color }}
    >
      {s.emoji} {s.label}
    </span>
  );
}

function MetricFieldRow({
  field,
  onOverride,
}: {
  field: MetricField;
  onOverride: (key: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.override || "");
  const isMissing = field.value === null && field.source === "none";

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 border-b last:border-b-0"
      style={{
        borderColor: C.border,
        background: isMissing ? `${C.error}08` : "transparent",
      }}
    >
      {/* Label */}
      <div className="sm:w-40 flex-shrink-0">
        <span className="text-sm font-medium" style={{ color: isMissing ? C.error : C.heading }}>
          {field.label}
        </span>
      </div>

      {/* Value */}
      <div className="flex-1 min-w-0">
        {isMissing ? (
          <span className="text-sm font-semibold flex items-center gap-2" style={{ color: C.error }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2.5">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            MISSING DATA
          </span>
        ) : (
          <span className="text-sm" style={{ color: C.body }}>
            {String(field.value)}
          </span>
        )}
      </div>

      {/* Timestamp */}
      <div className="sm:w-36 flex-shrink-0">
        <span className="text-xs" style={{ color: C.muted }}>
          {field.lastUpdated
            ? new Date(field.lastUpdated).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "\u2014"}
        </span>
      </div>

      {/* Source Badge */}
      <div className="sm:w-32 flex-shrink-0">
        <SourceBadge source={field.source} />
      </div>

      {/* Manual Override */}
      <div className="sm:w-48 flex-shrink-0">
        {editing ? (
          <div className="flex gap-1">
            <input
              className="flex-1 px-2 py-1 rounded text-xs"
              style={{
                background: C.bg,
                border: `1px solid ${C.accent}`,
                color: C.heading,
                outline: "none",
              }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Override value..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onOverride(field.key, draft);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ background: C.accent, color: "#000" }}
              onClick={() => {
                onOverride(field.key, draft);
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <button
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: C.accent, background: `${C.accent}10` }}
            onClick={() => setEditing(true)}
          >
            {field.override ? `\u270F\uFE0F ${field.override}` : "\u270F\uFE0F Override"}
          </button>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  section,
  onOverride,
}: {
  section: MetricSection;
  onOverride: (sectionId: string, key: string, val: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const missingCount = section.fields.filter((f) => f.value === null && f.source === "none").length;
  const totalCount = section.fields.length;

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: C.card, borderColor: C.border }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ background: open ? `${C.accent}05` : "transparent" }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{section.icon}</span>
          <span className="text-base font-semibold" style={{ color: C.heading }}>
            {section.title}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: missingCount > 0 ? `${C.error}15` : `${C.success}15`,
              color: missingCount > 0 ? C.error : C.success,
            }}
          >
            {totalCount - missingCount}/{totalCount} tracked
          </span>
          {missingCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold animate-pulse"
              style={{ background: `${C.warn}20`, color: C.warn }}
            >
              {missingCount} missing
            </span>
          )}
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.muted}
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div>
          {/* Column Headers */}
          <div
            className="hidden sm:flex items-center gap-4 px-4 py-2 text-xs font-medium border-t border-b"
            style={{ color: C.muted, borderColor: C.border, background: `${C.bg}80` }}
          >
            <span className="w-40">Field</span>
            <span className="flex-1">Value</span>
            <span className="w-36">Last Updated</span>
            <span className="w-32">Source</span>
            <span className="w-48">Manual Override</span>
          </div>
          {section.fields.map((field) => (
            <MetricFieldRow
              key={field.key}
              field={field}
              onOverride={(key, val) => onOverride(section.id, key, val)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function DataPage() {
  const [selectedProject, setSelectedProject] = useState("caliber");
  const [metrics, setMetrics] = useState<Record<string, MetricSection[]>>(() => {
    const m: Record<string, MetricSection[]> = {};
    PROJECTS.forEach((p) => {
      m[p.id] = buildProjectMetrics(p.id);
    });
    return m;
  });
  const [taskCreated, setTaskCreated] = useState<Set<string>>(new Set());

  const currentMetrics = metrics[selectedProject] || [];
  const missingItems = selectedProject === "all"
    ? PROJECTS.flatMap((p) => getMissingItems(p.id, metrics[p.id] || []))
    : getMissingItems(selectedProject, currentMetrics);

  const allMetrics = selectedProject === "all"
    ? PROJECTS.flatMap((p) => metrics[p.id] || [])
    : currentMetrics;

  const totalFields = allMetrics.reduce((sum, s) => sum + s.fields.length, 0);
  const populatedFields = allMetrics.reduce(
    (sum, s) => sum + s.fields.filter((f) => f.value !== null || f.source !== "none").length,
    0
  );
  const coveragePct = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;

  const handleOverride = useCallback(
    (sectionId: string, key: string, val: string) => {
      setMetrics((prev) => {
        const next = { ...prev };
        const sections = [...(next[selectedProject] || [])];
        const sIdx = sections.findIndex((s) => s.id === sectionId);
        if (sIdx >= 0) {
          const fields = [...sections[sIdx].fields];
          const fIdx = fields.findIndex((f) => f.key === key);
          if (fIdx >= 0) {
            fields[fIdx] = { ...fields[fIdx], override: val };
          }
          sections[sIdx] = { ...sections[sIdx], fields };
        }
        next[selectedProject] = sections;
        return next;
      });
    },
    [selectedProject]
  );

  const handleCreateTask = useCallback((item: MissingItem) => {
    const key = `${item.project}-${item.field}`;
    setTaskCreated((prev) => new Set(prev).add(key));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.heading }}>
            Data Layer
          </h2>
          <p className="text-sm mt-1" style={{ color: C.body }}>
            Single source of truth. Metrics, evidence, and missing data alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Coverage Badge */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{
              borderColor: coveragePct >= 80 ? C.success : coveragePct >= 50 ? C.warn : C.error,
              background: C.card,
            }}
          >
            <span
              className="text-lg font-bold font-mono"
              style={{
                color: coveragePct >= 80 ? C.success : coveragePct >= 50 ? C.warn : C.error,
              }}
            >
              {coveragePct}%
            </span>
            <span className="text-xs" style={{ color: C.muted }}>
              data coverage
            </span>
          </div>
        </div>
      </div>

      {/* Project Selector */}
      <div
        className="flex items-center gap-3 p-4 rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <label className="text-sm font-medium" style={{ color: C.body }}>
          Project:
        </label>
        <select
          className="px-3 py-2 rounded-md text-sm font-medium cursor-pointer"
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            color: C.heading,
            outline: "none",
          }}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="all">All Projects</option>
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 ml-auto text-xs" style={{ color: C.muted }}>
          <span>
            <strong style={{ color: C.heading }}>{populatedFields}</strong>/{totalFields} fields tracked
          </span>
          <span style={{ color: C.error }}>
            <strong>{missingItems.length}</strong> missing
          </span>
        </div>
      </div>

      {/* Metric Sections */}
      {selectedProject === "all" ? (
        PROJECTS.map((project) => (
          <div key={project.id} className="space-y-4">
            <h3
              className="text-lg font-bold px-1 pt-4 border-t"
              style={{ color: C.accent, borderColor: C.border }}
            >
              {project.name}
            </h3>
            {(metrics[project.id] || []).map((section) => (
              <CollapsibleSection
                key={`${project.id}-${section.id}`}
                section={section}
                onOverride={(sId, key, val) => {
                  setMetrics((prev) => {
                    const next = { ...prev };
                    const sections = [...(next[project.id] || [])];
                    const sIdx = sections.findIndex((s) => s.id === sId);
                    if (sIdx >= 0) {
                      const fields = [...sections[sIdx].fields];
                      const fIdx = fields.findIndex((f) => f.key === key);
                      if (fIdx >= 0) {
                        fields[fIdx] = { ...fields[fIdx], override: val };
                      }
                      sections[sIdx] = { ...sections[sIdx], fields };
                    }
                    next[project.id] = sections;
                    return next;
                  });
                }}
              />
            ))}
          </div>
        ))
      ) : (
        <div className="space-y-4">
          {currentMetrics.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              onOverride={handleOverride}
            />
          ))}
        </div>
      )}

      {/* ── MISSING DATA SECTION ── */}
      <div
        className="rounded-lg border-2 overflow-hidden"
        style={{
          borderColor: missingItems.length > 0 ? C.error : C.success,
          background: C.card,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: missingItems.length > 0 ? `${C.error}12` : `${C.success}12`,
          }}
        >
          <div className="flex items-center gap-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={missingItems.length > 0 ? C.error : C.success}
              strokeWidth="2.5"
            >
              {missingItems.length > 0 ? (
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              ) : (
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />
              )}
            </svg>
            <h3
              className="text-lg font-bold"
              style={{ color: missingItems.length > 0 ? C.error : C.success }}
            >
              {missingItems.length > 0
                ? `${missingItems.length} Missing Data Points \u2014 Action Required`
                : "All Data Points Tracked"}
            </h3>
          </div>
          {missingItems.length > 0 && (
            <span
              className="text-xs px-3 py-1 rounded-full font-bold animate-pulse"
              style={{ background: `${C.error}25`, color: C.error }}
            >
              URGENT
            </span>
          )}
        </div>

        {/* Table */}
        {missingItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: `${C.bg}80` }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Missing Field
                  </th>
                  {selectedProject === "all" && (
                    <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                      Project
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Section
                  </th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Why It Matters
                  </th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Expected Source
                  </th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Task Needed
                  </th>
                  <th className="text-center px-4 py-3 font-semibold" style={{ color: C.muted }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {missingItems.map((item, idx) => {
                  const key = `${item.project}-${item.field}`;
                  const created = taskCreated.has(key);
                  return (
                    <tr
                      key={idx}
                      className="transition-colors"
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: idx % 2 === 0 ? "transparent" : `${C.bg}40`,
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium flex items-center gap-2" style={{ color: C.warn }}>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: C.error }}
                          />
                          {item.field}
                        </span>
                      </td>
                      {selectedProject === "all" && (
                        <td className="px-4 py-3" style={{ color: C.body }}>
                          {item.project}
                        </td>
                      )}
                      <td className="px-4 py-3" style={{ color: C.body }}>
                        {item.section}
                      </td>
                      <td className="px-4 py-3" style={{ color: C.body }}>
                        {item.whyItMatters}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: `${C.accent}10`, color: C.accent }}
                        >
                          {item.expectedSource}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: C.body }}>
                        {item.taskNeeded}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {created ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded"
                            style={{ background: `${C.success}15`, color: C.success }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Created
                          </span>
                        ) : (
                          <button
                            className="text-xs font-bold px-3 py-1.5 rounded transition-all"
                            style={{
                              background: `${C.warn}20`,
                              color: C.warn,
                              border: `1px solid ${C.warn}40`,
                            }}
                            onClick={() => handleCreateTask(item)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${C.warn}40`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `${C.warn}20`;
                            }}
                          >
                            Create Task
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Field Legend */}
      <div
        className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg border text-xs"
        style={{ background: C.card, borderColor: C.border, color: C.muted }}
      >
        <span className="font-semibold" style={{ color: C.body }}>
          Source Labels:
        </span>
        {Object.entries(SOURCE_BADGE).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1">
            <span>{s.emoji}</span>
            <span style={{ color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
