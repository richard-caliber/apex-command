import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { randomUUID } from "crypto";
import { lookupAccessToken } from "@/lib/mcp-oauth";
import { appendAuditEvent, currentMonth, getAuditMonth } from "@/lib/mcp-audit";

const REQUIRED_SCOPE = "apex:full";

// Write tools mutate KV directly (intra-function HTTP fetches are unreliable on
// Vercel and hostile to deployment protection). The MCP request has already
// been authenticated via OAuth at the withMcpAuth layer; calling internal API
// routes a second time only adds a network hop and a class of failure modes.

const VALID_PIPELINE_STAGES = new Set(["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale", "adhoc"]);
const VALID_PIPELINE_STATUSES = new Set(["not_started", "in_progress", "done", "blocked", "skipped"]);
const VALID_PRACTICE_SOURCES = new Set(["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]);

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
  metrics?: Record<string, string>;
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
  const store = await kv.get<{ projects: ProjectRecord[] }>("apex:warroom:projects");
  return store?.projects ?? [];
}

async function kvTasks(): Promise<PipelineTaskRecord[]> {
  const store = await kv.get<{ tasks: PipelineTaskRecord[] }>("apex:pipeline-tasks");
  return store?.tasks ?? [];
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
        description: "Returns Apex pipeline tasks. Filters: project_id, owner, status, stage. Default returns top 20 by recent updated_at.",
        inputSchema: {
          project_id: z.string().optional(),
          owner: z.string().optional(),
          status: z.string().optional(),
          stage: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 20)"),
        },
      },
      async ({ project_id, owner, status, stage, limit }) => {
        const all = await kvTasks();
        const filtered = all.filter((t) => {
          if (project_id && t.project_id !== project_id) return false;
          if (owner && t.owner !== owner) return false;
          if (status && t.status !== status) return false;
          if (stage && t.stage !== stage) return false;
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
        return asText(`${slice.length} task(s) (of ${filtered.length} matching, ${all.length} total)`, slice);
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
          "Composite read mirroring the Briefing Room: active projects, top 10 open tasks owned by ginge, top 10 open tasks owned by other agents, current blockers across active projects.",
        inputSchema: {},
      },
      async () => {
        const [projects, tasks, agents] = await Promise.all([kvProjects(), kvTasks(), kvAgents()]);
        const activeProjects = projects.filter((p) => (p.status || "") !== "completed").map((p) => ({
          id: p.id,
          name: p.name,
          stage: p.stage,
          status: p.status,
          blocker: p.blocker,
        }));

        const open = tasks.filter((t) => t.status !== "done" && t.status !== "skipped" && t.project_id !== "_template");
        const sortByUpdated = (a: PipelineTaskRecord, b: PipelineTaskRecord) => (b.updated_at || "").localeCompare(a.updated_at || "");
        const yourActions = open.filter((t) => t.owner === "ginge").sort(sortByUpdated).slice(0, 10);
        const squadActions = open.filter((t) => t.owner && t.owner !== "ginge").sort(sortByUpdated).slice(0, 10);

        const agentStatus = agents.map((a) => ({ id: a.id, name: a.name, status: a.status, current_task: a.current_task }));
        const blockers = projects.filter((p) => p.blocker && (p.status || "") !== "completed").map((p) => ({ project: p.id, blocker: p.blocker }));

        return asText("Apex Briefing", {
          active_projects: activeProjects,
          your_actions: yourActions.map((t) => ({ id: t.id, name: t.name, project_id: t.project_id, status: t.status, blocker: t.blocker })),
          squad_actions: squadActions.map((t) => ({ id: t.id, name: t.name, project_id: t.project_id, owner: t.owner, status: t.status })),
          agent_status: agentStatus,
          blockers,
        });
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
