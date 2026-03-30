import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "maproom:heartbeat";

interface HealthCheck {
  id: string;
  type: "failed_check" | "missed_task" | "missing_data" | "unreviewed_post" | "stale_output" | "bottleneck";
  severity: "critical" | "warning" | "info";
  project_id: string;
  title: string;
  detail: string;
  suggested_action: string;
  detected_at: string;
}

interface HeartbeatData {
  items: HealthCheck[];
  lastUpdated: string;
  system_status: "healthy" | "degraded" | "critical";
  summary: {
    total_issues: number;
    critical: number;
    warnings: number;
    info: number;
  };
}

const SEED: HeartbeatData = {
  lastUpdated: "2026-03-30T12:00:00Z",
  system_status: "degraded",
  summary: {
    total_issues: 8,
    critical: 3,
    warnings: 4,
    info: 1,
  },
  items: [
    {
      id: "hb-001",
      type: "failed_check",
      severity: "critical",
      project_id: "caliber",
      title: "Carousel quality gate failed",
      detail: "BPC-157 carousel copy scored 6.5/10 -- below the 8/10 threshold. Hook too long (9 words vs 6 max), CTA uses unapproved format.",
      suggested_action: "Atlas to rewrite carousel copy with shorter hook and approved CTA format.",
      detected_at: "2026-03-30T06:30:00Z",
    },
    {
      id: "hb-002",
      type: "missed_task",
      severity: "critical",
      project_id: "caliber",
      title: "PostHog tracking setup overdue",
      detail: "Task TSK-002 was due 2026-03-28. PostHog tracking still not confirmed live on all pages. Blocking conversion baseline measurement.",
      suggested_action: "Darwin to verify PostHog installation and confirm data is flowing.",
      detected_at: "2026-03-30T08:00:00Z",
    },
    {
      id: "hb-003",
      type: "missed_task",
      severity: "warning",
      project_id: "caliber",
      title: "Google Ads setup overdue",
      detail: "Task TSK-007 was due 2026-03-30. Blocked on budget approval -- no owner assigned.",
      suggested_action: "Ginge to make budget decision or formally park this task.",
      detected_at: "2026-03-30T09:00:00Z",
    },
    {
      id: "hb-004",
      type: "missing_data",
      severity: "critical",
      project_id: "caliber",
      title: "Conversion rate baseline missing",
      detail: "Cannot evaluate traffic quality or ad ROI without conversion rate data. This is the primary blocker for the Caliber project.",
      suggested_action: "Depends on PostHog being live. Once tracking confirmed, wait 7 days then calculate baseline.",
      detected_at: "2026-03-30T08:00:00Z",
    },
    {
      id: "hb-005",
      type: "missing_data",
      severity: "warning",
      project_id: "gemsnap",
      title: "A/B test results not yet available",
      detail: "Pricing display A/B test started March 30. Need 7 full days before results are statistically significant. Earliest: April 6.",
      suggested_action: "Wait. Do not make pricing decisions until test concludes. Hold ad spend at $10/day.",
      detected_at: "2026-03-30T10:00:00Z",
    },
    {
      id: "hb-006",
      type: "unreviewed_post",
      severity: "warning",
      project_id: "caliber",
      title: "TikTok post drafted but not reviewed",
      detail: "Post POST-003 ('3 signs your body is begging for this peptide') has been in drafted status since March 29 with no review.",
      suggested_action: "Darwin to review post against content checklist before scheduling.",
      detected_at: "2026-03-30T11:00:00Z",
    },
    {
      id: "hb-007",
      type: "stale_output",
      severity: "warning",
      project_id: "caliber",
      title: "BPC-157 carousel copy marked stale",
      detail: "Output OUT-001 scored 6.5/10 and is marked stale. It failed the quality gate and needs regeneration with the updated prompt.",
      suggested_action: "Re-run Carousel Copy Generator prompt (v3) with corrected parameters.",
      detected_at: "2026-03-30T07:00:00Z",
    },
    {
      id: "hb-008",
      type: "bottleneck",
      severity: "info",
      project_id: "edge-auto",
      title: "Edge Auto blocked on report page build",
      detail: "3 downstream tasks (interactive calculator, PDF export, client onboarding) are waiting on the audit report page design. Todd wants demo by April 3.",
      suggested_action: "Claude Code to prioritise report page build this week. Consider reducing scope for initial demo.",
      detected_at: "2026-03-30T08:00:00Z",
    },
  ],
};

async function getData(): Promise<HeartbeatData> {
  const cached = await kv.get<HeartbeatData>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}
