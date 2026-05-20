import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { randomUUID } from "crypto";
import { lookupAccessToken } from "@/lib/mcp-oauth";
import { appendAuditEvent, currentMonth, getAuditMonth } from "@/lib/mcp-audit";
import { getAllProjects } from "@/lib/projects";
import { getAllTasks } from "@/lib/tasks";
import { buildBriefing, getBriefingForProject } from "@/lib/briefing";
import {
  getProjectContext,
  logContext,
  setProjectContext,
  proposeCompaction,
  ValidationError as ProjectContextValidationError,
  type LogSection,
  type SetProjectContextInput,
} from "@/lib/project-context";

const REQUIRED_SCOPE = "apex:full";

// Write tools mutate KV directly (intra-function HTTP fetches are unreliable on
// Vercel and hostile to deployment protection). The MCP request has already
// been authenticated via OAuth at the withMcpAuth layer; calling internal API
// routes a second time only adds a network hop and a class of failure modes.

const VALID_PIPELINE_STAGES = new Set(["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale", "adhoc"]);
const VALID_PIPELINE_STATUSES = new Set(["not_started", "in_progress", "done", "blocked", "skipped"]);
const VALID_PRACTICE_SOURCES = new Set(["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]);

// Project enums for MCP write tools (Phase 4.1). Permits "archived" on both
// stage and status; canonical /api/projects route does not. Read shims are
// tolerant; reconciling the two write paths is Phase 6 work.
const VALID_PROJECT_STAGES = new Set(["idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale", "archived"]);
const VALID_PROJECT_STATUSES = new Set(["active", "paused", "blocked", "completed", "archived"]);
const VALID_PROJECT_TIERS = new Set(["tier-1", "tier-2", "tier-3"]);

function asText(label: string, payload: unknown) {
  return { content: [{ type: "text" as const, text: `${label}\n\n${JSON.stringify(payload, null, 2)}` }] };
}

// ────────────────────── KV access for read tools ──────────────────────

interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  stage?: string;
  status?: string;
  owner?: string;
  blocker?: string;
  tags?: string[];
  url?: string;
  image_url?: string;
  metrics?: Record<string, string>;
  score?: number | null;
  featured?: boolean;
  order?: number;
  tier?: "tier-1" | "tier-2" | "tier-3" | null;
  created_at?: string;
  updated_at?: string;
}

interface PipelineTaskRecord {
  id: string;
  stage: string;
  project_id: string;
  name: string;
  description?: string;
  status: string;
  automation?: string;
  owner?: string;
  model?: string;
  prompt_id?: string;
  output?: string;
  quality_gate?: string;
  blocker?: string | null;
  next_task?: string;
  order?: number;
  priority?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

interface AgentRecord {
  id: string;
  name: string;
  emoji: string;
  role: string;
  title?: string;
  department?: string;
  status: string;
  dormant?: boolean;
  current_task?: string;
  task_since?: string;
  identity_text?: string;
  soul_text?: string;
  capabilities_text?: string;
  responsibilities_text?: string;
  memory_text?: string;
  memory_updated_at?: string;
  current_model?: string;
  runtime_config?: unknown;
  output_log?: unknown[];
  blockers?: unknown[];
  last_action?: string;
  last_updated?: string;
}

interface PracticeRecord {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  scope: string;
  source: string;
  origin_store?: string;
  created_at: string;
  updated_at: string;
}

async function kvProjects(): Promise<ProjectRecord[]> {
  return (await getAllProjects()) as ProjectRecord[];
}

async function kvTasks(): Promise<PipelineTaskRecord[]> {
  return (await getAllTasks(undefined, Number.MAX_SAFE_INTEGER)) as PipelineTaskRecord[];
}

async function kvAgents(): Promise<AgentRecord[]> {
  const store = await kv.get<{ agents: AgentRecord[] }>("apex:squad:v4");
  return store?.agents ?? [];
}

async function kvPractices(): Promise<PracticeRecord[]> {
  const store = await kv.get<{ items: PracticeRecord[] }>("apex:practices:v1");
  return store?.items ?? [];
}

// ────────────────────── MCP server definition ──────────────────────

const handler = createMcpHandler(
  (server) => {
    // ─────── apex_list_projects ───────
    server.registerTool(
      "apex_list_projects",
      {
        title: "List Apex projects",
        description: "Returns all Apex projects (id, name, stage, status, blocker, tags). Optional filters by status, stage, or tag.",
        inputSchema: {
          status: z.string().optional().describe("Filter by status (e.g. active, paused, blocked)"),
          stage: z.string().optional().describe("Filter by lifecycle stage"),
          tag: z.string().optional().describe("Only projects whose tags include this value"),
        },
      },
      async ({ status, stage, tag }) => {
        const all = await kvProjects();
        const filtered = all.filter((p) => {
          if (status && (p.status || "") !== status) return false;
          if (stage && (p.stage || "") !== stage) return false;
          if (tag && !(p.tags || []).includes(tag)) return false;
          return true;
        });
        const summary = filtered.map((p) => ({
          id: p.id,
          name: p.name,
          stage: p.stage,
          status: p.status,
          blocker: p.blocker,
          tags: p.tags,
        }));
        return asText(`Found ${summary.length} project(s)`, summary);
      },
    );

    // ─────── apex_get_project ───────
    server.registerTool(
      "apex_get_project",
      {
        title: "Get Apex project",
        description: "Returns the full record for a single Apex project by id.",
        inputSchema: { id: z.string().describe("Project id, e.g. caliber, edge-auto, gemsnap") },
      },
      async ({ id }) => {
        const all = await kvProjects();
        const proj = all.find((p) => p.id === id);
        if (!proj) return { content: [{ type: "text", text: `Project not found: ${id}` }], isError: true };
        return asText(`Project ${id}`, proj);
      },
    );

    // ─────── apex_list_tasks ───────
    server.registerTool(
      "apex_list_tasks",
      {
        title: "List Apex pipeline tasks",
        description:
          "Returns Apex pipeline tasks. Filters: project_id, owner, status, stage, tier. By default excludes tasks under paused/archived parents and tasks owned by dormant agents — pass exclude_paused_parents=false or exclude_dormant_owners=false to include them. Default returns top 20 by recent updated_at.",
        inputSchema: {
          project_id: z.string().optional(),
          owner: z.string().optional(),
          status: z.string().optional(),
          stage: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 20)"),
          exclude_paused_parents: z
            .boolean()
            .optional()
            .describe("Default true. Drops tasks whose parent project has status=paused or status=archived."),
          exclude_dormant_owners: z
            .boolean()
            .optional()
            .describe("Default true. Drops tasks owned by agents flagged dormant=true."),
          stale_days: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Optional. Only return tasks last updated more than N days ago."),
          tier: z
            .enum(["tier-1", "tier-2", "tier-3"])
            .optional()
            .describe("Optional. Only return tasks whose parent project has the given tier."),
        },
      },
      async ({
        project_id,
        owner,
        status,
        stage,
        limit,
        exclude_paused_parents,
        exclude_dormant_owners,
        stale_days,
        tier,
      }) => {
        const excludePausedParents = exclude_paused_parents ?? true;
        const excludeDormantOwners = exclude_dormant_owners ?? true;

        const [allTasks, allProjects, allAgents] = await Promise.all([
          kvTasks(),
          excludePausedParents || tier ? kvProjects() : Promise.resolve([] as ProjectRecord[]),
          excludeDormantOwners ? kvAgents() : Promise.resolve([] as AgentRecord[]),
        ]);

        const projectsById = new Map(allProjects.map((p) => [p.id, p]));
        const dormantOwnerIds = new Set(allAgents.filter((a) => a.dormant === true).map((a) => a.id));
        const staleCutoffIso = stale_days ? new Date(Date.now() - stale_days * 86400_000).toISOString() : null;

        const filtered = allTasks.filter((t) => {
          if (project_id && t.project_id !== project_id) return false;
          if (owner && t.owner !== owner) return false;
          if (status && t.status !== status) return false;
          if (stage && t.stage !== stage) return false;

          if (excludePausedParents) {
            const parent = projectsById.get(t.project_id);
            const parentStatus = parent?.status ?? "";
            if (parentStatus === "paused" || parentStatus === "archived") return false;
          }
          if (excludeDormantOwners && t.owner && dormantOwnerIds.has(t.owner)) return false;
          if (tier) {
            const parent = projectsById.get(t.project_id);
            if (parent?.tier !== tier) return false;
          }
          if (staleCutoffIso) {
            const ts = t.updated_at || t.created_at || "1970-01-01T00:00:00Z";
            if (ts >= staleCutoffIso) return false;
          }
          return true;
        });
        filtered.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
        const cap = limit ?? 20;
        const slice = filtered.slice(0, cap).map((t) => ({
          id: t.id,
          name: t.name,
          project_id: t.project_id,
          stage: t.stage,
          status: t.status,
          owner: t.owner,
          blocker: t.blocker,
          updated_at: t.updated_at,
        }));
        return asText(`${slice.length} task(s) (of ${filtered.length} matching, ${allTasks.length} total)`, slice);
      },
    );

    // ─────── apex_list_stale_tasks ───────
    server.registerTool(
      "apex_list_stale_tasks",
      {
        title: "List stale Apex tasks",
        description:
          "Returns open Apex tasks last updated more than N days ago (default 30), oldest first. Excludes done/skipped/blocked tasks, tasks under paused/archived parents, and tasks owned by dormant agents — these are not actionable signals about staleness.",
        inputSchema: {
          days: z.number().int().positive().optional().describe("Staleness threshold in days. Default 30."),
          limit: z.number().int().positive().max(200).optional().describe("Max rows to return. Default 10."),
        },
      },
      async ({ days, limit }) => {
        const staleDays = days ?? 30;
        const cap = limit ?? 10;

        const [allTasks, allProjects, allAgents] = await Promise.all([
          kvTasks(),
          kvProjects(),
          kvAgents(),
        ]);
        const projectsById = new Map(allProjects.map((p) => [p.id, p]));
        const dormantOwnerIds = new Set(allAgents.filter((a) => a.dormant === true).map((a) => a.id));

        const cutoffMs = Date.now() - staleDays * 86400_000;
        const cutoffIso = new Date(cutoffMs).toISOString();

        const stale = allTasks
          .filter((t) => {
            if (t.status === "done" || t.status === "skipped" || t.status === "blocked") return false;
            const parent = projectsById.get(t.project_id);
            if (!parent) return false; // skips _template seeds and orphaned tasks
            if (parent.status === "paused" || parent.status === "archived") return false;
            if (t.owner && dormantOwnerIds.has(t.owner)) return false;
            const ts = t.updated_at || t.created_at || "1970-01-01T00:00:00Z";
            return ts < cutoffIso;
          })
          .map((t) => {
            const ts = t.updated_at || t.created_at || "1970-01-01T00:00:00Z";
            const daysUntouched = Math.floor((Date.now() - new Date(ts).getTime()) / 86400_000);
            return {
              task_id: t.id,
              name: t.name,
              project_id: t.project_id,
              owner: t.owner,
              days_untouched: daysUntouched,
              last_updated_iso: ts,
            };
          })
          .sort((a, b) => b.days_untouched - a.days_untouched)
          .slice(0, cap);

        return asText(`${stale.length} stale task(s) (>${staleDays} days untouched)`, stale);
      },
    );

    // ─────── apex_get_task ───────
    server.registerTool(
      "apex_get_task",
      {
        title: "Get Apex task",
        description: "Returns the full record for a single pipeline task by id.",
        inputSchema: { id: z.string().describe("Task id, e.g. T-2.01, CAL-3.02") },
      },
      async ({ id }) => {
        const all = await kvTasks();
        const t = all.find((x) => x.id === id);
        if (!t) return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
        return asText(`Task ${id}`, t);
      },
    );

    // ─────── apex_get_briefing ───────
    server.registerTool(
      "apex_get_briefing",
      {
        title: "Get the Briefing Room view",
        description:
          "Composite read of Apex state for daily decision-making. Returns 11 sections: this_week_frontline (top 5 actionable tasks across tiered ventures), active_ventures (status=active and tiered, ordered by tier then order), blocked_external (status=blocked with parsed waiting_on), meta_work (tag=meta), paused_summary (paused/archived/creative counts), stale_tasks (top 10 untouched >30 days), dormant_agent_warnings (orphan-task count, excluding newton/darwin Project surfaces), agents (squad status), top_project_context (live narrative doc for the top-priority active venture; null if no doc yet), context_compaction_due (project_ids whose context doc has size/age/decision-count over thresholds), stale_context_projects (active ventures with open tasks but no context update in 30+ days). Cached 30s; the optional project_id parameter swaps top_project_context to that project's doc via an uncached read-through.",
        inputSchema: {
          project_id: z
            .string()
            .optional()
            .describe(
              "If set, swaps top_project_context to this project's doc (uncached read-through). Default: top of active_ventures.",
            ),
        },
      },
      async ({ project_id }) => {
        const briefing = project_id
          ? await getBriefingForProject(project_id)
          : await buildBriefing();
        return asText("Apex Briefing", briefing);
      },
    );

    // ─────── apex_list_agents ───────
    server.registerTool(
      "apex_list_agents",
      {
        title: "List Apex agents",
        description: "Returns the list of agents (id, name, role, status, emoji). Use apex_get_agent for full body.",
        inputSchema: {},
      },
      async () => {
        const agents = await kvAgents();
        const summary = agents.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, role: a.role, status: a.status, current_task: a.current_task }));
        return asText(`${summary.length} agent(s)`, summary);
      },
    );

    // ─────── apex_get_agent ───────
    server.registerTool(
      "apex_get_agent",
      {
        title: "Get Apex agent",
        description: "Returns the full agent record (soul, identity, capabilities, responsibilities, memory, runtime_config, output_log).",
        inputSchema: { agent_id: z.string().describe("Agent id, e.g. atlas, newton, darwin, jimmy, ginge") },
      },
      async ({ agent_id }) => {
        const agents = await kvAgents();
        const a = agents.find((x) => x.id === agent_id);
        if (!a) return { content: [{ type: "text", text: `Agent not found: ${agent_id}` }], isError: true };
        // Strip nothing — agent records do not contain APEX_API_TOKEN or vault keys.
        return asText(`Agent ${agent_id}`, a);
      },
    );

    // ─────── apex_search_practices ───────
    server.registerTool(
      "apex_search_practices",
      {
        title: "Search Apex practice library",
        description: "Search apex:practices:v1 by free text (matches title+content), tag, or category. Returns id, title, category, tags, and a snippet.",
        inputSchema: {
          query: z.string().optional().describe("Free-text search across title and content"),
          tag: z.string().optional(),
          category: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        },
      },
      async ({ query, tag, category, limit }) => {
        const items = await kvPractices();
        const q = (query || "").toLowerCase().trim();
        const matches = items.filter((it) => {
          if (tag && !it.tags.includes(tag)) return false;
          if (category && it.category !== category) return false;
          if (q) {
            const hay = `${it.title} ${it.content}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        const cap = limit ?? 25;
        const slice = matches.slice(0, cap).map((it) => ({
          id: it.id,
          title: it.title,
          category: it.category,
          tags: it.tags,
          source: it.source,
          snippet: (it.content || "").slice(0, 240),
        }));
        return asText(`${slice.length} practice(s) (of ${matches.length} matching, ${items.length} total)`, slice);
      },
    );

    // ─────── apex_get_practice ───────
    server.registerTool(
      "apex_get_practice",
      {
        title: "Get Apex practice item",
        description: "Returns the full content of one practice item by id.",
        inputSchema: { id: z.string().describe("Practice id, e.g. vault-research-2026-03-15-..., ipv-wh-1") },
      },
      async ({ id }) => {
        const items = await kvPractices();
        const it = items.find((x) => x.id === id);
        if (!it) return { content: [{ type: "text", text: `Practice not found: ${id}` }], isError: true };
        return asText(`Practice ${id}`, it);
      },
    );

    // ─────── apex_get_audit ───────
    server.registerTool(
      "apex_get_audit",
      {
        title: "Get MCP audit log (current month)",
        description: "Returns this month's audit log of every write tool call routed through the MCP connector.",
        inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Month in YYYY-MM. Defaults to current.") },
      },
      async ({ month }) => {
        const m = month || currentMonth();
        const audit = await getAuditMonth(m);
        return asText(`Audit log for ${m} (${audit.events.length} event(s))`, audit);
      },
    );

    // ─────── apex_set_task ───────
    server.registerTool(
      "apex_set_task",
      {
        title: "Create or update an Apex pipeline task",
        description: "Creates a new task or updates an existing one. Required: project_id and name (and id when updating).",
        inputSchema: {
          id: z.string().optional().describe("Task id. Required for update. For new tasks, generated automatically if omitted."),
          project_id: z.string(),
          name: z.string(),
          stage: z.string().optional(),
          status: z.string().optional(),
          owner: z.string().optional(),
          priority: z.string().optional(),
          blocker: z.string().nullable().optional(),
          description: z.string().optional(),
        },
      },
      async (input, extra) => {
        const stage = input.stage || "adhoc";
        const status = input.status || "not_started";
        if (!VALID_PIPELINE_STAGES.has(stage)) return { content: [{ type: "text", text: `Invalid stage: ${stage}` }], isError: true };
        if (!VALID_PIPELINE_STATUSES.has(status)) return { content: [{ type: "text", text: `Invalid status: ${status}` }], isError: true };

        const store = (await kv.get<{ tasks: PipelineTaskRecord[]; lastUpdated: string }>("apex:pipeline-tasks")) ?? { tasks: [], lastUpdated: new Date().toISOString() };
        const now = new Date().toISOString();
        const id = input.id || `MCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`;
        const idx = store.tasks.findIndex((t) => t.id === id);
        let result: PipelineTaskRecord;
        if (idx >= 0) {
          const merged: PipelineTaskRecord = {
            ...store.tasks[idx],
            project_id: input.project_id,
            name: input.name,
            stage,
            status,
            owner: input.owner ?? store.tasks[idx].owner,
            blocker: input.blocker !== undefined ? input.blocker : store.tasks[idx].blocker,
            description: input.description ?? store.tasks[idx].description,
            updated_at: now,
          };
          if (input.priority !== undefined) (merged as unknown as Record<string, unknown>).priority = input.priority;
          store.tasks[idx] = merged;
          result = merged;
        } else {
          const created: PipelineTaskRecord = {
            id,
            stage,
            project_id: input.project_id,
            name: input.name,
            description: input.description ?? "",
            status,
            automation: "manual",
            owner: input.owner ?? "",
            model: "",
            prompt_id: "",
            output: "",
            quality_gate: "",
            blocker: input.blocker ?? null,
            next_task: "",
            order: 0,
            created_at: now,
            updated_at: now,
          };
          if (input.priority !== undefined) (created as unknown as Record<string, unknown>).priority = input.priority;
          store.tasks.push(created);
          result = created;
        }
        store.lastUpdated = now;
        await kv.set("apex:pipeline-tasks", store);
        await appendAuditEvent({
          tool: "apex_set_task",
          input,
          resultSummary: `${idx >= 0 ? "updated" : "created"} task ${id} (${input.name})`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Task ${id} saved`, result);
      },
    );

    // ─────── apex_complete_task ───────
    server.registerTool(
      "apex_complete_task",
      {
        title: "Mark an Apex task as done",
        description: "Sets a task's status to 'done'. Returns the updated record.",
        inputSchema: { id: z.string().describe("Task id to complete") },
      },
      async ({ id }, extra) => {
        const store = await kv.get<{ tasks: PipelineTaskRecord[]; lastUpdated: string }>("apex:pipeline-tasks");
        if (!store) return { content: [{ type: "text", text: "Pipeline task store not found" }], isError: true };
        const idx = store.tasks.findIndex((t) => t.id === id);
        if (idx < 0) return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
        const now = new Date().toISOString();
        store.tasks[idx] = { ...store.tasks[idx], status: "done", updated_at: now };
        store.lastUpdated = now;
        await kv.set("apex:pipeline-tasks", store);
        await appendAuditEvent({
          tool: "apex_complete_task",
          input: { id },
          resultSummary: `completed task ${id} (${store.tasks[idx].name})`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Task ${id} marked done`, store.tasks[idx]);
      },
    );

    // ─────── apex_update_agent_memory ───────
    server.registerTool(
      "apex_update_agent_memory",
      {
        title: "Append text to an agent's memory_text",
        description: "Appends a chunk of text to the agent's memory_text via PATCH /api/squad. Auto-stamps memory_updated_at.",
        inputSchema: {
          agent_id: z.string().describe("atlas | newton | darwin | jimmy | ginge"),
          text: z.string().describe("Text to append. Two newlines and a header are added automatically."),
          header: z.string().optional().describe("Optional H3 header for the appended block"),
        },
      },
      async ({ agent_id, text, header }, extra) => {
        const store = await kv.get<{ agents: AgentRecord[]; lastUpdated: string }>("apex:squad:v4");
        if (!store) return { content: [{ type: "text", text: "Squad store not found" }], isError: true };
        const agent = store.agents.find((a) => a.id === agent_id);
        if (!agent) return { content: [{ type: "text", text: `Agent not found: ${agent_id}` }], isError: true };
        const stamp = new Date().toISOString();
        const headerLine = header ? `### ${header} (${stamp})` : `### MCP append (${stamp})`;
        const before = (agent.memory_text || "").length;
        agent.memory_text = `${agent.memory_text || ""}\n\n${headerLine}\n${text}\n`;
        agent.memory_updated_at = stamp;
        agent.last_updated = stamp;
        store.lastUpdated = stamp;
        await kv.set("apex:squad:v4", store);
        await appendAuditEvent({
          tool: "apex_update_agent_memory",
          input: { agent_id, text_chars: text.length, header },
          resultSummary: `appended ${text.length} chars to ${agent_id}.memory_text`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Memory updated for ${agent_id}`, {
          agent_id,
          memory_chars_before: before,
          memory_chars_after: agent.memory_text.length,
          memory_updated_at: agent.memory_updated_at,
        });
      },
    );

    // ─────── apex_add_practice ───────
    server.registerTool(
      "apex_add_practice",
      {
        title: "Add a practice to the library",
        description: "Append a new practice item to apex:practices:v1.",
        inputSchema: {
          title: z.string(),
          content: z.string(),
          category: z.string(),
          tags: z.array(z.string()).optional(),
          scope: z.string().optional().describe("Default 'all_agents'"),
          source: z.enum(["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]).optional().describe("Default 'manual'"),
        },
      },
      async (input, extra) => {
        const source = input.source && VALID_PRACTICE_SOURCES.has(input.source) ? input.source : "manual";
        const scope = input.scope && input.scope.length > 0 ? input.scope : "all_agents";
        const tags = Array.isArray(input.tags) ? input.tags : [];
        const now = new Date().toISOString();
        const id = `manual-${randomUUID()}`;
        const item: PracticeRecord = {
          id,
          category: input.category,
          title: input.title,
          content: input.content,
          tags,
          scope,
          source,
          created_at: now,
          updated_at: now,
        };
        const store = (await kv.get<{ items: PracticeRecord[]; lastUpdated: string }>("apex:practices:v1")) ?? { items: [], lastUpdated: now };
        store.items.push(item);
        store.lastUpdated = now;
        await kv.set("apex:practices:v1", store);
        await appendAuditEvent({
          tool: "apex_add_practice",
          input: { title: input.title, category: input.category, tags, scope, source, content_chars: input.content.length },
          resultSummary: `added practice ${id} (${input.title})`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Practice ${id} added`, item);
      },
    );

    // ─────── apex_set_project ───────
    server.registerTool(
      "apex_set_project",
      {
        title: "Create or update an Apex project",
        description: "Creates a new project record or updates an existing one in apex:warroom:projects. id is required. For new projects, defaults stage='idea', status='active', owner='ginge'. For updates, only provided fields are merged.",
        inputSchema: {
          id: z.string().describe("Kebab-case project id, e.g. atlas-drift, todd-saifent"),
          name: z.string().describe("Display name"),
          stage: z.string().optional().describe("idea | validation | design | mvp | traffic | conversion | delivery | scale | archived"),
          status: z.string().optional().describe("active | paused | blocked | completed | archived"),
          description: z.string().optional(),
          blocker: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
          url: z.string().optional().describe("Canonical URL for the project, if any"),
          owner: z.string().optional().describe("Default 'ginge' for new projects"),
          score: z.number().min(0).max(10).nullable().optional().describe("Darwin verdict 0-10"),
          featured: z.boolean().optional(),
          image_url: z.string().optional(),
          metrics: z.record(z.string(), z.string()).optional(),
          order: z.number().optional(),
          tier: z.enum(["tier-1", "tier-2", "tier-3"]).nullable().optional().describe("Priority tier: tier-1 = current revenue priority, tier-2 = active lower priority, tier-3 = experimental/batch. Null = meta/creative/paused/archived."),
        },
      },
      async (input, extra) => {
        if (input.stage !== undefined && !VALID_PROJECT_STAGES.has(input.stage)) {
          return { content: [{ type: "text", text: `Invalid stage: ${input.stage}. Valid: ${[...VALID_PROJECT_STAGES].join(", ")}` }], isError: true };
        }
        if (input.status !== undefined && !VALID_PROJECT_STATUSES.has(input.status)) {
          return { content: [{ type: "text", text: `Invalid status: ${input.status}. Valid: ${[...VALID_PROJECT_STATUSES].join(", ")}` }], isError: true };
        }
        if (input.tier !== undefined && input.tier !== null && !VALID_PROJECT_TIERS.has(input.tier)) {
          return { content: [{ type: "text", text: `Invalid tier: ${input.tier}. Valid: ${[...VALID_PROJECT_TIERS].join(", ")} or null` }], isError: true };
        }

        const now = new Date().toISOString();
        const store = (await kv.get<{ projects: ProjectRecord[]; lastUpdated: string }>("apex:warroom:projects")) ?? { projects: [], lastUpdated: now };
        const idx = store.projects.findIndex((p) => p.id === input.id);
        let result: ProjectRecord;
        let mode: "created" | "updated";

        if (idx >= 0) {
          mode = "updated";
          const existing = store.projects[idx];
          const merged: ProjectRecord = {
            ...existing,
            name: input.name,
            updated_at: now,
          };
          if (input.stage !== undefined) merged.stage = input.stage;
          if (input.status !== undefined) merged.status = input.status;
          if (input.description !== undefined) merged.description = input.description;
          if (input.blocker !== undefined) merged.blocker = input.blocker ?? undefined;
          if (input.tags !== undefined) merged.tags = input.tags;
          if (input.url !== undefined) merged.url = input.url;
          if (input.owner !== undefined) merged.owner = input.owner;
          if (input.score !== undefined) merged.score = input.score;
          if (input.featured !== undefined) merged.featured = input.featured;
          if (input.image_url !== undefined) merged.image_url = input.image_url;
          if (input.metrics !== undefined) merged.metrics = input.metrics;
          if (input.order !== undefined) merged.order = input.order;
          if (input.tier !== undefined) merged.tier = input.tier;
          store.projects[idx] = merged;
          result = merged;
        } else {
          mode = "created";
          const created: ProjectRecord = {
            id: input.id,
            name: input.name,
            description: input.description ?? "",
            stage: input.stage ?? "idea",
            status: input.status ?? "active",
            owner: input.owner ?? "ginge",
            blocker: input.blocker ?? undefined,
            tags: input.tags ?? [],
            url: input.url ?? "",
            image_url: input.image_url ?? "",
            metrics: input.metrics ?? {},
            score: input.score ?? null,
            featured: input.featured ?? false,
            order: input.order,
            tier: input.tier ?? null,
            created_at: now,
            updated_at: now,
          };
          store.projects.push(created);
          result = created;
        }
        store.lastUpdated = now;
        await kv.set("apex:warroom:projects", store);
        await appendAuditEvent({
          tool: "apex_set_project",
          input,
          resultSummary: `${mode} project ${input.id} (${input.name})`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Project ${input.id} ${mode}`, result);
      },
    );

    // ─────── apex_archive_project ───────
    server.registerTool(
      "apex_archive_project",
      {
        title: "Archive an Apex project (soft-delete)",
        description: "Sets a project's status to 'archived'. Project records remain readable but are excluded from active filters. Optionally appends a reason to the blocker field for traceability.",
        inputSchema: {
          id: z.string().describe("Project id to archive"),
          reason: z.string().optional().describe("Reason for archiving; appended to blocker field"),
        },
      },
      async ({ id, reason }, extra) => {
        const store = await kv.get<{ projects: ProjectRecord[]; lastUpdated: string }>("apex:warroom:projects");
        if (!store) return { content: [{ type: "text", text: "Project store not found" }], isError: true };
        const idx = store.projects.findIndex((p) => p.id === id);
        if (idx < 0) return { content: [{ type: "text", text: `Project not found: ${id}` }], isError: true };
        const now = new Date().toISOString();
        const dateOnly = now.slice(0, 10);
        const existing = store.projects[idx];
        const archived: ProjectRecord = {
          ...existing,
          status: "archived",
          updated_at: now,
        };
        if (reason) {
          const note = `Archived ${dateOnly}: ${reason}`;
          archived.blocker = existing.blocker ? `${existing.blocker}\n${note}` : note;
        }
        store.projects[idx] = archived;
        store.lastUpdated = now;
        await kv.set("apex:warroom:projects", store);
        await appendAuditEvent({
          tool: "apex_archive_project",
          input: { id, reason },
          resultSummary: `archived project ${id} (${existing.name})${reason ? ` — ${reason}` : ""}`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Project ${id} archived`, archived);
      },
    );

    // ─────── apex_update_practice ───────
    server.registerTool(
      "apex_update_practice",
      {
        title: "Update an Apex practice item",
        description: "Updates an existing practice in apex:practices:v1 by id. Only provided fields are merged; others preserved. 404s if the id doesn't exist.",
        inputSchema: {
          id: z.string().describe("Practice id, e.g. vault-research-2026-03-18-..., manual-<uuid>"),
          title: z.string().optional(),
          content: z.string().optional(),
          category: z.string().optional(),
          tags: z.array(z.string()).optional(),
          scope: z.string().optional(),
          source: z.enum(["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]).optional(),
        },
      },
      async (input, extra) => {
        const store = await kv.get<{ items: PracticeRecord[]; lastUpdated: string }>("apex:practices:v1");
        if (!store) return { content: [{ type: "text", text: "Practices store not found" }], isError: true };
        const idx = store.items.findIndex((it) => it.id === input.id);
        if (idx < 0) return { content: [{ type: "text", text: `Practice not found: ${input.id}` }], isError: true };
        const now = new Date().toISOString();
        const existing = store.items[idx];
        const updated: PracticeRecord = {
          ...existing,
          updated_at: now,
        };
        if (input.title !== undefined) updated.title = input.title;
        if (input.content !== undefined) updated.content = input.content;
        if (input.category !== undefined) updated.category = input.category;
        if (input.tags !== undefined) updated.tags = input.tags;
        if (input.scope !== undefined) updated.scope = input.scope;
        if (input.source !== undefined && VALID_PRACTICE_SOURCES.has(input.source)) updated.source = input.source;
        store.items[idx] = updated;
        store.lastUpdated = now;
        await kv.set("apex:practices:v1", store);
        await appendAuditEvent({
          tool: "apex_update_practice",
          input: {
            id: input.id,
            fields: Object.keys(input).filter((k) => k !== "id" && (input as Record<string, unknown>)[k] !== undefined),
            content_chars: input.content?.length,
          },
          resultSummary: `updated practice ${input.id} (${updated.title})`,
          callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
        });
        return asText(`Practice ${input.id} updated`, updated);
      },
    );

    // ─────── apex_get_project_context ───────
    server.registerTool(
      "apex_get_project_context",
      {
        title: "Get project context document",
        description:
          "Returns the live narrative context document for a project from apex:project-context:v1 — current_state, active_hypotheses, open_questions, stakeholder_notes, recent_decisions, and meta (version + prior_version for one-level rollback). Returns null if no context doc exists for this project yet (call apex_log_context to create one by appending a first entry). This is the narrative layer — hypotheses, decisions, signals. For structural enrichment (timeline, waitingOn) see /api/project/[id]. For top-level project metadata see apex_get_project.",
        inputSchema: {
          project_id: z.string().describe("Project id, e.g. caliber, atlas-drift, todd-safent"),
        },
      },
      async ({ project_id }) => {
        const doc = await getProjectContext(project_id);
        if (!doc) {
          return asText(`No context document for ${project_id}`, null);
        }
        return asText(`Context for ${project_id} (v${doc.meta.version})`, doc);
      },
    );

    // ─────── apex_log_context ─────── (THE WORKHORSE)
    server.registerTool(
      "apex_log_context",
      {
        title: "Append a narrative note to a project's context",
        description:
          "Append a single narrative note to a project's live context document in apex:project-context:v1. Used to capture texture that would otherwise be lost between sessions — hypotheses being tested, unknowns blocking decisions, stakeholder signals, decisions taken with reasoning.\n\n" +
          "One call, one note. No batching. No cross-topic summaries. Ceremony defeats the purpose; the layer only works if calls are cheap.\n\n" +
          "section (required) and matching payload (required):\n" +
          "- active_hypotheses → { hypothesis: string } — what is currently being tested\n" +
          "- open_questions → { question: string } — an unknown that blocks a decision\n" +
          "- stakeholder_notes → { name: string, note: string } — a narrative observation about a specific person involved with this project\n" +
          "- recent_decisions → { decision: string, rationale: string } — a decision taken plus why\n\n" +
          "Each entry is timestamped automatically. Append-only between compactions; to revise, supersede, or remove existing entries, use apex_compact_project_context (proposes a diff) then apex_set_project_context (commits the agreed compacted version). The doc is created on first call — no setup required. Target latency: under 500ms.\n\n" +
          "Do not log: factual answers Claude provided, generic discussion, half-formed ideas the user has not committed to, or anything that is already a task in Apex. If it is actionable, it is a task — not context.\n\n" +
          "When to log. If the thought \"that's worth remembering\" crosses your mind, the answer is to log it, not to keep talking. Under-logging loses signal forever; over-logging is cleaned by compaction. When in doubt, log.\n\n" +
          "Examples: when the user voices a hypothesis (\"I think the reason X is happening is Y\") → log to active_hypotheses. When an unknown blocks progress (\"we don't actually know whether Z holds\") → log to open_questions. When someone's behaviour is part of the picture (\"Todd hasn't replied in three weeks\") → log to stakeholder_notes. When a course of action is chosen (\"right, let's go with option two because of A and B\") → log to recent_decisions.",
        inputSchema: {
          project_id: z
            .string()
            .describe("Project id from apex:warroom:projects, e.g. caliber, atlas-drift, todd-safent"),
          section: z
            .enum(["active_hypotheses", "open_questions", "stakeholder_notes", "recent_decisions"])
            .describe("Which section to append to. Determines the required payload shape."),
          payload: z
            .record(z.string(), z.string())
            .describe(
              "Shape depends on section: active_hypotheses → { hypothesis }; open_questions → { question }; stakeholder_notes → { name, note }; recent_decisions → { decision, rationale }.",
            ),
        },
      },
      async ({ project_id, section, payload }, extra) => {
        try {
          const updated = await logContext(project_id, section as LogSection, payload);
          const payloadChars = JSON.stringify(payload).length;
          await appendAuditEvent({
            tool: "apex_log_context",
            input: { project_id, section, payload_chars: payloadChars },
            resultSummary: `appended ${section} entry to ${project_id} (v${updated.meta.version})`,
            callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
          });
          return asText(`Context updated for ${project_id} (v${updated.meta.version})`, updated);
        } catch (e) {
          if (e instanceof ProjectContextValidationError) {
            return { content: [{ type: "text", text: e.message }], isError: true };
          }
          throw e;
        }
      },
    );

    // ─────── apex_set_project_context ───────
    server.registerTool(
      "apex_set_project_context",
      {
        title: "Overwrite a project's context document",
        description:
          "Overwrite a project's full context document in apex:project-context:v1. The previous version is stashed inline at meta.prior_version (one level of rollback). Used by compaction (after apex_compact_project_context proposes a diff and Claude + user agree the new shape) and by bootstrap. Increments meta.version and stamps last_compacted_at = now. For routine note-taking use apex_log_context — it's append-only, faster, and doesn't bump the compaction timer. Use this tool only when deliberately rewriting the whole doc.",
        inputSchema: {
          project_id: z
            .string()
            .describe("Project id; doc will be stored at apex:project-context:v1.docs[project_id]"),
          current_state: z
            .string()
            .describe("Single paragraph summarising what is currently true for this project. Max 500 chars. May be empty on bootstrap."),
          active_hypotheses: z
            .array(z.string())
            .describe("What is currently being tested. Each entry max 500 chars."),
          open_questions: z
            .array(z.string())
            .describe("Unknowns blocking decisions. Each entry max 500 chars."),
          stakeholder_notes: z
            .array(
              z.object({
                name: z.string(),
                note: z.string(),
                updated_at: z.string().optional(),
              }),
            )
            .describe("Per-person narrative observations. name max 100 chars, note max 500 chars."),
          recent_decisions: z
            .array(
              z.object({
                decision: z.string(),
                rationale: z.string(),
                logged_at: z.string().optional(),
              }),
            )
            .describe("Decisions and the reason behind each. decision/rationale max 500 chars each."),
        },
      },
      async (input, extra) => {
        try {
          const body: SetProjectContextInput = {
            current_state: input.current_state,
            active_hypotheses: input.active_hypotheses,
            open_questions: input.open_questions,
            stakeholder_notes: input.stakeholder_notes,
            recent_decisions: input.recent_decisions,
          };
          const updated = await setProjectContext(input.project_id, body);
          const bodyBytes = JSON.stringify(body).length;
          const priorVersion = updated.meta.prior_version?.meta.version ?? 0;
          await appendAuditEvent({
            tool: "apex_set_project_context",
            input: { project_id: input.project_id, body_bytes: bodyBytes },
            resultSummary: `overwrote context for ${input.project_id} (v${priorVersion} → v${updated.meta.version})`,
            callerUserAgent: (extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent") ?? undefined,
          });
          return asText(
            `Context for ${input.project_id} saved (v${updated.meta.version})`,
            updated,
          );
        } catch (e) {
          if (e instanceof ProjectContextValidationError) {
            return { content: [{ type: "text", text: e.message }], isError: true };
          }
          throw e;
        }
      },
    );

    // ─────── apex_compact_project_context ───────
    server.registerTool(
      "apex_compact_project_context",
      {
        title: "Propose a compacted context document",
        description:
          "Propose a compacted version of a project's context document, WITHOUT saving. Returns the proposed doc plus a structured diff: which decisions were absorbed into current_state, which hypotheses are candidates for supersession (Claude/user must judge), how many stakeholder notes were dropped as duplicates/empty, and which compaction triggers are firing. Heuristic only — this tool absorbs decisions older than 30 days and surfaces stale hypotheses for review; it does NOT decide what is superseded. After reviewing the proposal with the user, commit by calling apex_set_project_context with the agreed body (typically with some of the surfaced candidates pruned from active_hypotheses, and the current_state paragraph rewritten in your own words). Errors if no context doc exists for the project_id.",
        inputSchema: {
          project_id: z.string().describe("Project id whose context doc should be compacted"),
        },
      },
      async ({ project_id }) => {
        const doc = await getProjectContext(project_id);
        if (!doc) {
          return {
            content: [{ type: "text", text: `No context document for ${project_id} — nothing to compact` }],
            isError: true,
          };
        }
        const proposal = proposeCompaction(doc);
        return asText(
          `Compaction proposal for ${project_id} (NOT SAVED — review then call apex_set_project_context to commit)`,
          proposal,
        );
      },
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: false,
  },
);

// ────────────────────── Auth wrapper ──────────────────────

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const record = await lookupAccessToken(bearerToken);
  if (!record) return undefined;
  return {
    token: bearerToken,
    scopes: record.scopes,
    clientId: record.client_id,
    extra: { issued_at: record.issued_at },
  };
};

const authedHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: [REQUIRED_SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
