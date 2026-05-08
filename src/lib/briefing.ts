import { kv } from "@vercel/kv";
import { unstable_cache } from "next/cache";
import { getAllProjects, type Project, type ProjectTier } from "./projects";
import { getAllTasks, type Task } from "./tasks";

const DAY_MS = 86_400_000;
const STALE_DAYS = 30;
const DORMANT_PROJECT_EXCEPTION = new Set(["newton", "darwin"]);
const DORMANT_TASK_COPY =
  "Dormant — squad not running on cron, available for on-demand work via Newton/Darwin Projects (Phase 7)";

const WAITING_ON_OVERRIDES: Record<string, string> = {
  "edge-auto": "Todd",
  "todd-safent": "Todd",
  "todd-saifent": "Todd",
};

interface AgentRecord {
  id: string;
  name: string;
  status: string;
  dormant?: boolean;
  current_task?: string;
}

export interface FrontlineItem {
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  project_tier: ProjectTier;
  priority: "high" | "medium" | "low";
  next_action: string;
  age_days: number;
}

export interface VentureItem {
  id: string;
  name: string;
  tier: ProjectTier | null;
  stage: string;
  blocker: string | null;
  open_task_count: number;
  last_activity_iso: string;
}

export interface BlockedItem {
  id: string;
  name: string;
  blocker: string;
  waiting_on: string;
  blocked_since_iso: string;
}

export interface MetaItem {
  id: string;
  name: string;
  open_task_count: number;
  next_high_priority_task: string | null;
}

export interface PausedSummary {
  paused_projects: Array<{ id: string; name: string }>;
  archived_count: number;
  creative_track_projects: Array<{ id: string; name: string }>;
}

export interface StaleItem {
  task_id: string;
  task_name: string;
  project_id: string;
  days_untouched: number;
  suggested_action: "kill" | "defer" | "re-justify";
}

export interface DormantWarnings {
  dormant_agents: string[];
  orphan_task_count: number;
  note: string;
}

export interface AgentItem {
  id: string;
  name: string;
  status: string;
  current_task: string;
}

export interface Briefing {
  this_week_frontline: FrontlineItem[];
  active_ventures: VentureItem[];
  blocked_external: BlockedItem[];
  meta_work: MetaItem[];
  paused_summary: PausedSummary;
  stale_tasks: StaleItem[];
  dormant_agent_warnings: DormantWarnings;
  agents: AgentItem[];
}

async function loadAgents(): Promise<AgentRecord[]> {
  const store = await kv.get<{ agents: AgentRecord[] }>("apex:squad:v4");
  return store?.agents ?? [];
}

function isOpenTask(t: Task): boolean {
  const s = t.status ?? "";
  return s !== "done" && s !== "skipped" && s !== "blocked";
}

function isPendingTask(t: Task): boolean {
  const s = t.status ?? "";
  return s !== "done" && s !== "skipped";
}

function tierRank(tier: ProjectTier | null | undefined): number {
  if (tier === "tier-1") return 0;
  if (tier === "tier-2") return 1;
  if (tier === "tier-3") return 2;
  return 99;
}

function priorityRank(p: string | undefined): number {
  switch ((p ?? "").toLowerCase()) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

function normalisePriority(p: string | undefined): "high" | "medium" | "low" {
  const v = (p ?? "").toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}

function ageDays(t: Task, nowMs: number): number {
  const ts = t.updated_at || t.created_at || "1970-01-01T00:00:00Z";
  return Math.floor((nowMs - new Date(ts).getTime()) / DAY_MS);
}

function firstSentence(s: string, max: number): string {
  if (!s) return "";
  const trimmed = s.replace(/\s+/g, " ").trim();
  const m = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = m ? m[1] : trimmed;
  return sentence.length > max ? sentence.slice(0, max - 1) + "…" : sentence;
}

function inferWaitingOn(project: Project): string {
  const override = WAITING_ON_OVERRIDES[project.id];
  if (override) return override;
  const blocker = project.blocker ?? "";
  const m = blocker.match(
    /\b(?:waiting on|blocked on|pending|on hold (?:until|by|for)|until)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
  );
  if (m) return m[1];
  return "external";
}

function suggestedAction(daysUntouched: number): "kill" | "defer" | "re-justify" {
  if (daysUntouched > 120) return "kill";
  if (daysUntouched >= 60) return "defer";
  return "re-justify";
}

function lastActivityIso(project: Project, projectTasks: Task[]): string {
  let max = project.updated_at ?? project.created_at ?? "1970-01-01T00:00:00Z";
  for (const t of projectTasks) {
    const ts = t.updated_at ?? t.created_at ?? "1970-01-01T00:00:00Z";
    if (ts > max) max = ts;
  }
  return max;
}

async function buildBriefingUncached(): Promise<Briefing> {
  const [projects, tasks, agents] = await Promise.all([
    getAllProjects(),
    getAllTasks(undefined, Number.MAX_SAFE_INTEGER),
    loadAgents(),
  ]);

  const nowMs = Date.now();
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const dormantOwnerIds = new Set(
    agents.filter((a) => a.dormant === true).map((a) => a.id),
  );

  const tasksByProject = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByProject.get(t.project_id) ?? [];
    arr.push(t);
    tasksByProject.set(t.project_id, arr);
  }

  // ── this_week_frontline ──
  const frontlineCandidates = tasks.filter((t) => {
    if (!isOpenTask(t)) return false;
    const parent = projectsById.get(t.project_id);
    if (!parent) return false;
    if (parent.status !== "active") return false;
    if (!parent.tier) return false;
    if (
      t.owner &&
      dormantOwnerIds.has(t.owner) &&
      !DORMANT_PROJECT_EXCEPTION.has(t.project_id)
    ) {
      return false;
    }
    return true;
  });
  frontlineCandidates.sort((a, b) => {
    const pa = projectsById.get(a.project_id)!;
    const pb = projectsById.get(b.project_id)!;
    const tr = tierRank(pa.tier) - tierRank(pb.tier);
    if (tr !== 0) return tr;
    const oa = pa.order ?? 999;
    const ob = pb.order ?? 999;
    if (oa !== ob) return oa - ob;
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const ad = ageDays(b, nowMs) - ageDays(a, nowMs);
    if (ad !== 0) return ad;
    return a.name.localeCompare(b.name);
  });
  const this_week_frontline: FrontlineItem[] = frontlineCandidates
    .slice(0, 5)
    .map((t) => {
      const parent = projectsById.get(t.project_id)!;
      return {
        task_id: t.id,
        task_name: t.name,
        project_id: t.project_id,
        project_name: parent.name,
        project_tier: parent.tier as ProjectTier,
        priority: normalisePriority(t.priority),
        next_action: firstSentence(t.description ?? t.name ?? "", 140),
        age_days: ageDays(t, nowMs),
      };
    });

  // ── active_ventures ──
  const ventureProjects = projects.filter(
    (p) =>
      p.status === "active" &&
      (p.tier !== null && p.tier !== undefined ? true : (p.tags ?? []).includes("venture")),
  );
  ventureProjects.sort((a, b) => {
    const tr = tierRank(a.tier) - tierRank(b.tier);
    if (tr !== 0) return tr;
    const oa = a.order ?? 999;
    const ob = b.order ?? 999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
  const active_ventures: VentureItem[] = ventureProjects.map((p) => {
    const projectTasks = tasksByProject.get(p.id) ?? [];
    const openCount = projectTasks.filter(isPendingTask).length;
    return {
      id: p.id,
      name: p.name,
      tier: p.tier ?? null,
      stage: p.stage,
      blocker: p.blocker ?? null,
      open_task_count: openCount,
      last_activity_iso: lastActivityIso(p, projectTasks),
    };
  });

  // ── blocked_external ──
  const blocked_external: BlockedItem[] = projects
    .filter((p) => p.status === "blocked")
    .map((p) => ({
      id: p.id,
      name: p.name,
      blocker: p.blocker ?? "",
      waiting_on: inferWaitingOn(p),
      blocked_since_iso: p.updated_at ?? p.created_at ?? "1970-01-01T00:00:00Z",
    }))
    .sort((a, b) => {
      const c = a.blocked_since_iso.localeCompare(b.blocked_since_iso);
      if (c !== 0) return c;
      return a.name.localeCompare(b.name);
    });

  // ── meta_work ──
  const meta_work: MetaItem[] = projects
    .filter((p) => (p.tags ?? []).includes("meta") && p.status !== "archived")
    .map((p) => {
      const projectTasks = tasksByProject.get(p.id) ?? [];
      const openCount = projectTasks.filter(isPendingTask).length;
      const highPri = projectTasks
        .filter(
          (t) => isOpenTask(t) && (t.priority ?? "").toLowerCase() === "high",
        )
        .sort((a, b) => ageDays(b, nowMs) - ageDays(a, nowMs));
      return {
        id: p.id,
        name: p.name,
        open_task_count: openCount,
        next_high_priority_task: highPri[0]?.name ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── paused_summary ──
  const pausedProjects = projects
    .filter((p) => p.status === "paused" && !(p.tags ?? []).includes("meta"))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const archivedCount = projects.filter(
    (p) => p.status === "archived" && !(p.tags ?? []).includes("meta"),
  ).length;
  const creativeProjects = projects
    .filter((p) => (p.tags ?? []).includes("creative") && p.status !== "archived")
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const paused_summary: PausedSummary = {
    paused_projects: pausedProjects,
    archived_count: archivedCount,
    creative_track_projects: creativeProjects,
  };

  // ── stale_tasks ──
  const cutoffIso = new Date(nowMs - STALE_DAYS * DAY_MS).toISOString();
  const stale_tasks: StaleItem[] = tasks
    .filter((t) => {
      if (!isOpenTask(t)) return false;
      const parent = projectsById.get(t.project_id);
      if (!parent) return false; // skips _template seeds and orphaned tasks
      if (parent.status === "paused" || parent.status === "archived") return false;
      if (t.owner && dormantOwnerIds.has(t.owner)) return false;
      const ts = t.updated_at || t.created_at || "1970-01-01T00:00:00Z";
      return ts < cutoffIso;
    })
    .map((t) => {
      const days = ageDays(t, nowMs);
      return {
        task_id: t.id,
        task_name: t.name,
        project_id: t.project_id,
        days_untouched: days,
        suggested_action: suggestedAction(days),
      };
    })
    .sort((a, b) => {
      if (b.days_untouched !== a.days_untouched) {
        return b.days_untouched - a.days_untouched;
      }
      return a.task_name.localeCompare(b.task_name);
    })
    .slice(0, 10);

  // ── dormant_agent_warnings ──
  const dormantAgentIds = agents
    .filter((a) => a.dormant === true)
    .map((a) => a.id)
    .sort();
  const orphanCount = tasks.filter(
    (t) =>
      isOpenTask(t) &&
      projectsById.has(t.project_id) && // skips _template seeds and orphaned tasks
      t.owner !== undefined &&
      t.owner !== "" &&
      dormantOwnerIds.has(t.owner) &&
      !DORMANT_PROJECT_EXCEPTION.has(t.project_id),
  ).length;
  const dormant_agent_warnings: DormantWarnings = {
    dormant_agents: dormantAgentIds,
    orphan_task_count: orphanCount,
    note:
      orphanCount > 0
        ? "These will not execute. Reassign owner or kill."
        : "",
  };

  // ── agents ──
  const agentItems: AgentItem[] = agents.map((a) => {
    if (a.dormant === true) {
      return {
        id: a.id,
        name: a.name,
        status: "dormant",
        current_task: DORMANT_TASK_COPY,
      };
    }
    if (a.id === "ginge") {
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        current_task:
          a.current_task && a.current_task.length > 0
            ? a.current_task
            : "Working from briefing — no specific task pinned",
      };
    }
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      current_task: a.current_task ?? "",
    };
  });

  return {
    this_week_frontline,
    active_ventures,
    blocked_external,
    meta_work,
    paused_summary,
    stale_tasks,
    dormant_agent_warnings,
    agents: agentItems,
  };
}

export const buildBriefing = unstable_cache(
  buildBriefingUncached,
  ["apex-briefing-v1"],
  { revalidate: 30 },
);
