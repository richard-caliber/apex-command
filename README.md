# Apex Command

Apex is Ginge's mission-control system: a Next.js app on Vercel backed by Vercel KV, exposing an MCP server so any Claude.ai chat (Mission Control, Newton, Darwin, project-specific Claude Projects) can read state and write back through a single canonical layer.

The web UI lives at https://apex-command-seven.vercel.app. The MCP connector lives at the same domain under `/api/mcp/[transport]`.

This README reflects the post-Magnificent state (sprint closed 2026-05-06, branch `apex-magnificent`). What's here works. What's planned is called out as Phase 7 / Phase 8 backlog.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Claude.ai (Mission Control + Newton + Darwin + per-project Projects)    │
│  → MCP connector "Apex command" mounted at apex-command-seven.vercel.app │
└─────────────┬────────────────────────────────────────────────────────────┘
              │   OAuth (mcp-handler) + apex:full scope
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js (App Router) on Vercel — apex-command-seven.vercel.app          │
│                                                                          │
│  /api/mcp/[transport]    MCP server (read + write tools, audited)        │
│  /api/projects           Canonical project read/write API                │
│  /api/pipeline-tasks     Canonical task read/write API                   │
│  /api/practices          Knowledge / IP vault / research findings        │
│  /api/prompts            Prompt library                                  │
│  /api/squad              Agent records                                   │
│  /api/auth/*             Login / session cookie                          │
│                                                                          │
│  src/lib/projects.ts | tasks.ts | practices.ts                           │
│  → Single canonical readers (Phase 1 refactor — read-path is in lib,     │
│    not duplicated across routes)                                         │
└─────────────┬────────────────────────────────────────────────────────────┘
              │   @vercel/kv
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Vercel KV (Upstash Redis) — single source of truth                      │
└──────────────────────────────────────────────────────────────────────────┘
```

The squad agents (Newton, Darwin, Atlas, Jimmy) ran on a GCP VM ("OpenClaw") on cron until cost made it untenable. They are currently dormant — `apex:squad:v4` carries `dormant: true` for each, briefings show the dormant copy line. Phase 7 plan: rebuild Newton + Darwin as on-demand Claude Projects (no cron, no extra infra) using this MCP layer for coordination.

---

## Canonical KV stores

| Key | Purpose | Schema/owner |
|---|---|---|
| `apex:warroom:projects` | Single project store | Read via `src/lib/projects.ts`; written via `/api/projects` POST or MCP `apex_set_project` / `apex_archive_project`. |
| `apex:pipeline-tasks` | Single task store | Read via `src/lib/tasks.ts`; written via `/api/pipeline-tasks` POST or MCP `apex_set_task` / `apex_complete_task`. |
| `apex:practices:v1` | Knowledge / IP vault / research findings (187 entries as of M5) | Read via `src/lib/practices.ts`; written via `/api/practices` POST or MCP `apex_add_practice` / `apex_update_practice`. Schema: `{ id, category, title, content, tags[], scope, source, created_at, updated_at }`. |
| `apex:prompts:v2` | Prompt library (119 entries; squad-targeted, currently unused) | `/api/prompts` POST. Squad revival in Phase 7 will start exercising these. |
| `apex:squad:v4` | Agent records (5: ginge active, atlas/newton/darwin/jimmy dormant) | `/api/squad`. Includes `dormant: boolean` per agent (added in M3). |
| `apex:mcp-audit:{YYYY-MM}` | Per-month audit log of every MCP write | Append-only; appended by `appendAuditEvent()` in every MCP write tool. Read via MCP `apex_get_audit`. |
| `apex:project:{id}` | Per-project **structural** enrichment store (5 records: caliber, edge-auto, gemsnap, squad, storyquest) | Holds timeline / waitingOn / notes the canonical record doesn't. Read via `/api/project/[id]`. Migration into canonical deferred to Phase 7/8. |
| `apex:project-context:v1` | Per-project **narrative** context (live, separate from the structural store above) | `{ docs: { [project_id]: ProjectContextDoc }, lastUpdated }`. Each doc has `meta` (version + inline `prior_version` for N=1 rollback) plus `current_state`, `active_hypotheses`, `open_questions`, `stakeholder_notes`, `recent_decisions`. Read via `src/lib/project-context.ts`; written via MCP `apex_log_context` (append, the workhorse) and `apex_set_project_context` (overwrite). `apex_compact_project_context` returns a heuristic proposal (no save). Surfaced in `apex_get_briefing` as `top_project_context`, `context_compaction_due`, `stale_context_projects`. |
| `apex:pipeline:caliber:{date}` | Caliber content-pipeline grids per day | Out-of-scope for the warroom/tasks lifecycle; left untouched in Magnificent. |
| `vault:apikeys:*` | Encrypted API keys + `vault:apikeys:_index` | `/api/vault` (AES-256-GCM, key in `VAULT_ENCRYPTION_KEY`). Surfaced at `/schematics/keys`. |

Removed during Magnificent (M4 + M5): `apex:projects`, `maproom:projects`, `apex:squad:v2`, `vault:ip-entries`, `maproom:{ip-vault, ip-vault-v2, prompts, ideas, capabilities, outputs, metrics, platform-rules}`, `apex:action-room:{feed, suggestions}`. Total: 14 KV keys deleted, ~898KB freed.

### Per-project state — note for Phase 7/8 consolidation

Per-project state is now intentionally split across **three** stores. Future consolidation work must consume all three, not one:

- **`apex:warroom:projects`** — canonical metadata (id, name, stage, status, tier, blocker, owner, score, image, url, tags).
- **`apex:project:{id}`** — *structural* enrichment: timeline milestones, waitingOn items, generic notes blob. Per-id keys. (`tasks` duplicates `apex:pipeline-tasks` — drop on migration.)
- **`apex:project-context:v1`** — *narrative* context: current_state, hypotheses, questions, stakeholder signals, decisions. Single envelope, versioned with inline N=1 rollback.

The two per-project stores serve different concerns and intentionally do not share fields: `apex:project:{id}.notes` is a free-form blob; `apex:project-context:v1.stakeholder_notes` is per-person structured narrative with timestamps. Consolidation must preserve both shapes (or explicitly choose which to drop).

---

## Running locally

```bash
# 1. Install
npm install

# 2. Environment — create .env.local with at minimum:
#    KV_REST_API_URL          — Vercel KV REST endpoint
#    KV_REST_API_TOKEN        — Vercel KV REST token
#    APEX_API_TOKEN           — gates all writes (Bearer header + session cookie)
#    VAULT_ENCRYPTION_KEY     — 64-char hex (32 bytes); for /api/vault api-key encryption
#    VAULT_PASSWORD_HASH      — scrypt salt:hash for /schematics/keys unlock prompt
#    OPENCLAW_OAUTH_CLIENT_ID + OPENCLAW_OAUTH_CLIENT_SECRET — MCP OAuth client
#
#    The Vercel deployment carries these in its env config — pull via `vercel env pull`.

# 3. Dev
npm run dev
# → http://localhost:3000

# 4. Production build smoke
npm run build
```

The dev server requires KV access. KV is shared between dev and prod (no separate dev tier).

---

## MCP server

Mounted at `https://apex-command-seven.vercel.app/api/mcp/[transport]`. Connect via Claude.ai → Settings → Connectors → "Apex command".

Authentication: OAuth 2.0 via `mcp-handler` + `withMcpAuth`. Required scope: `apex:full`. OAuth client lookup in `src/lib/mcp-oauth.ts` (KV-stored).

### Tools currently exposed

Read-only (no audit):
- `apex_list_projects` — all projects, optional status/stage/tag filter
- `apex_get_project` — single project by id
- `apex_list_tasks` — tasks with project_id / owner / status / stage filters
- `apex_get_task` — single task by id
- `apex_get_briefing` — composite Mission Control briefing (active projects, your_actions, squad_actions, agent_status, blockers)
- `apex_list_agents` — squad summary
- `apex_get_agent` — full agent record
- `apex_search_practices` — free-text + tag + category search across `apex:practices:v1`
- `apex_get_practice` — single practice by id
- `apex_get_audit` — current-month MCP write audit log

Write (audited via `appendAuditEvent`):
- `apex_set_task` — create or update task
- `apex_complete_task` — convenience wrapper around set_task with `status=done`
- `apex_set_project` — create or update project
- `apex_archive_project` — convenience wrapper, `status=archived`
- `apex_add_practice` — append to `apex:practices:v1`
- `apex_update_practice` — partial-merge update
- `apex_update_agent_memory` — append to agent `memory_text`

### Adding a new MCP tool

Edit `src/app/api/mcp/[transport]/route.ts`. The shape:

```ts
server.tool(
  "apex_my_new_tool",
  {
    title: "Human title",
    description: "What it does, when to call it",
    inputSchema: { /* zod shape */ },
  },
  async (args) => {
    // Read tools: just read KV (use src/lib readers where canonical) and return asText(...).
    // Write tools: mutate KV directly (intra-function HTTP fetches are unreliable on Vercel),
    // then append an audit event:
    await appendAuditEvent({
      tool: "apex_my_new_tool",
      input: args,
      resultSummary: "What changed",
    });
    return asText("Result label", payload);
  },
);
```

Conventions:
- Reads route through `src/lib/{projects,tasks,practices}.ts` to keep the canonical-source rule.
- Writes mutate KV inside the tool handler (no second HTTP hop) and MUST call `appendAuditEvent`.
- OAuth happens at the `withMcpAuth` wrapper, not per-tool.
- Validate enums against `VALID_*` sets at the top of the route file before writing.

### Mission Control session pattern

Working agreement between Ginge and Mission Control sessions. Canonical practice: **`manual-8595cf1e-cbee-41dc-9b9b-d8de854ec4f6`** (v3). v1 (`manual-31f791ee`) and v2 (`manual-6151c4b2`) marked DEPRECATED in M5 — content retained for history.

Three failure modes the pattern protects against:
1. Tasks abandoned in unclear state (mid-task pivots without closure).
2. Claude-shopping (opening a parallel chat after one pushed back).
3. Two tasks held in active working memory simultaneously.

What it does NOT require: pre-declaring every task, blocking clarifying tangents, treating every interaction as a checkpoint.

---

## UI surfaces

| Page | Purpose |
|---|---|
| `/` | Launchpad overview — projects by stage, today's pulse |
| `/action-room` | Briefing Room — your_actions, squad_actions, blockers, agent status |
| `/map-room/{pipeline,ideas,tasks,projects,capabilities,heartbeat,flow-map}` | Map Room — pipeline + capabilities views |
| `/machine-room/automation-map` | Machine Room — manual-action inbox (groups `*-tweet` items) |
| `/project/[id]` | Per-project detail (canonical record + per-project enrichment) |
| `/squad` + `/squad/[id]` | Agent souls / capabilities / memory |
| `/schematics/ip-vault` | Practice library viewer (M5: now reads from `apex:practices:v1`) |
| `/schematics/{prompts,squad,tasks,keys}` | Schematic views |
| `/finance` | Stub (Phase 7 backlog) |

---

## Phase 7 backlog (post-Magnificent)

Filed in `apex:practices:v1` under category `phase-7-backlog`. The headline items:

- **`manual-d654d088`** — Phase 7 sprint scope: Operationalise (briefing redesign + project housekeeping + Newton/Darwin builds)
- **`manual-8355c348`** — Three-Project agent architecture: Mission Control + Newton + Darwin (post-OpenClaw, on-demand). Replaces the dormant cron squad. None on cron; coordination via Apex MCP state.
- **`manual-9eecd660`** — Project housekeeping checklist: per-Claude-Project setup spec (MCP enabled, instructions referencing right practices, end-of-session sync to Apex)
- **`manual-fc240832`** — Task-chaining: completion auto-spawns next_task with output review gate
- **`manual-7fed8718`** — Multi-template Apex: venture vs creative-series vs creative-script vs creative-app vs internal-tool pipelines (current 8-stage is venture-shaped only)
- **`manual-cbb69ea8`** — Per-project research locker: prompts + findings + rating attached to project record
- **`manual-ea666c32`** — Experiment vault: tools/approaches to evaluate when capacity allows (Wednesday slot only)

## Phase 8 backlog

- **`manual-f3ea8b90`** — Typed knowledge wiki: replace flat practice tagging with 5-node-type graph (concepts/decisions/evidence/procedures/entities)

---

## Magnificent sprint summary (M0–M6, 2026-05-05 → 2026-05-06)

Closed `apex-magnificent` branch. Tag `apex-magnificent-v1.0.0` (created in M6).

| Phase | What |
|---|---|
| M0 | Branch off master, KV baseline snapshot |
| M1 | Read-path refactor — `src/lib/{projects,tasks}.ts` as single canonical readers |
| M2 | Briefing display polish — dormant banner, race-fix, tweet bucketing, pipeline auto-select |
| M3 | Data hygiene — 17 ideas restored to paused, creative-track moved to practice, dormant flag added to squad |
| M3.5 | 782 stale templated tasks under archived snap-* projects bulk-blocked; briefing now respects dormant flag |
| M4 | Parallel store deletion — 13 KV keys retired, read-shims stripped from 5 routes |
| M5 | Tasks/prompts/practices review + IP Vault page refactor; `vault:ip-entries` retired (`/api/practices` is canonical) |
| M6 | Dead code removal (10 routes + 2 orphan files), README rewrite (this file), `apex-magnificent-v1.0.0` tag |

Detailed phase logs: `data/magnificent-log.md`. Each phase has a verification doc (`data/magnificent-mX-verify-*.md`) and per-phase research/notes.

---

## Honest known divergences

- **`/api/map-room/projects` GET routes kept** with no internal caller — defensive in case external HTTP consumers exist. Cleanup deferred to a future sprint.
- **`/api/status` GET (root)** — no internal caller, M4 left as canonical-shape wrapper. Same defensive rationale.
- **`apex:project:{id}` enrichment store** — 5 records with timeline/waitingOn/notes that the canonical project record can't hold. Migration into the canonical schema is Phase 7/8 work.
- **`apex:agent-runs:*` KV pattern** — keys may exist from earlier seeding (`scripts/phase2-seed-agent-runs.mjs`); the lib that wrote them (`src/lib/agent-runs.ts`) was deleted in M6 since nothing consumed it. Restore from git if revived.
- **OpenClaw VM** — still billable on GCP at sprint close. Decommission steps documented in `data/openclaw-decommission-2026-05-06.md`; needs Ginge to run with gcloud auth.
- **Squad dormancy** — Phase 7 will revive Newton + Darwin as on-demand Claude Projects. Until then `apex_get_briefing` shows the dormant copy line for all four squad agents.

---

## Repo layout

```
src/
  app/
    api/                 Next.js route handlers (REST + MCP)
      mcp/[transport]/   MCP server
      projects/          Canonical projects API (POST list/get/set)
      pipeline-tasks/    Canonical tasks API
      practices/         Canonical practices API
      prompts/           Prompt library API
      squad/             Squad agent records
      vault/             API key encrypted store + verify-password
      project/[id]/      Per-project enrichment (apex:project:{id})
      auth/              Login / logout / session
      ...                (other surfaces — heartbeat, map-room sub-routes)
    action-room/         Briefing Room page
    map-room/            Pipeline + capabilities views
    project/[id]/        Per-project detail page
    schematics/          Vault, prompts, squad, tasks, keys views
    squad/               Squad pages
    ...
  lib/
    projects.ts          Canonical project reader (apex:warroom:projects)
    tasks.ts             Canonical task reader (apex:pipeline-tasks)
    practices.ts         Canonical practice reader (apex:practices:v1)
    auth.ts              requireWriteAuth, session cookie helpers
    mcp-audit.ts         Per-month audit append + read
    mcp-oauth.ts         OAuth client lookup
data/                    Snapshots, deletion logs, verification reports, sprint logs
scripts/                 One-off migration / inventory / cleanup scripts (per phase)
public/                  Static assets
```

---

## Useful commands

```bash
# Dev
npm run dev

# Build (CI parity)
npm run build

# Production deploy (auto from push to apex-magnificent? — no, manual via Vercel)
vercel --prod

# Inventory current practices
node scripts/m5-practices-inventory.mjs

# Inventory current prompts
node scripts/m5-prompts-inventory.mjs

# KV baseline snapshot
node scripts/magnificent-baseline.mjs
```
