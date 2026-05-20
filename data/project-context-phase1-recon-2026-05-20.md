# Project Context Layer — Phase 1 Reconnaissance

Author: Claude (architect). Date: 2026-05-20.
No code written. This is the lay-of-the-land report; the implementation plan is Phase 2.

---

## 1. Repo topology

Apex is a single Next.js 16 App Router project, TypeScript, on Vercel, backed by Vercel KV (Upstash Redis). One package, no monorepo. No test framework.

```
apex-command/
├── data/                       Operational snapshots, verification logs, .md research notes,
│                               JSON seed files. NOT served by the app — pure dev/ops artefacts.
│                               This is where this report belongs.
├── scripts/                    Migration + verification .mjs scripts. The de-facto "test suite"
│                               (see section 5). Naming pattern: phase{N}-{verb}.mjs or m{N}-*.mjs.
├── public/                     Static assets, project card images.
├── src/
│   ├── app/                    App Router pages + API routes.
│   │   ├── api/
│   │   │   ├── mcp/[transport]/route.ts     ← THE MCP SERVER (single file, all 17 tools).
│   │   │   ├── mcp/oauth/{register,authorize,token}/    OAuth (DCR + auth code + token).
│   │   │   ├── briefing/route.ts            Thin GET wrapper around buildBriefing().
│   │   │   ├── projects/, practices/, pipeline-tasks/, squad/, prompts/, vault/, events/, threads/, status/
│   │   │   │                                 Canonical REST routes (per README).
│   │   │   ├── project/[id]/route.ts        ⚠ Per-project enrichment store. See section 6 flag.
│   │   │   ├── map-room/, content-*/, automation-map/, pipeline-*, ideas/
│   │   │   │                                 UI-supporting routes.
│   │   │   └── auth/{login,logout}/          Session cookie via APEX_API_TOKEN.
│   │   ├── .well-known/oauth-{protected-resource,authorization-server}/   OAuth discovery.
│   │   └── (many UI pages — schematics, machine-room, map-room, content-factory, action-room…)
│   ├── components/             UI components (project-dashboard/, ui/, etc.).
│   └── lib/
│       ├── projects.ts         Canonical reader for apex:warroom:projects.
│       ├── tasks.ts            Canonical reader for apex:pipeline-tasks.
│       ├── practices.ts        Canonical reader for apex:practices:v1.
│       ├── briefing.ts         Composes the 8-section briefing. Cached 30s via unstable_cache.
│       ├── events.ts           apex:events:v1 — significance-scored project event feed + debounce.
│       ├── threads.ts          Thread-bridge (state transitions → events).
│       ├── mcp-audit.ts        apex:mcp-audit:{YYYY-MM} append-only log.
│       ├── mcp-oauth.ts        OAuth token lookup.
│       ├── auth.ts             requireWriteAuth (session/bearer gating for canonical REST routes).
│       ├── dashboard-stub.ts, project/{parse-description,load-dashboard,auto-task}.ts
│       └── events.ts (counted twice — see above)
├── package.json                Scripts: dev/build/start only. NO test/lint scripts. NO test framework.
├── README.md                   Authoritative architecture doc. Read it.
└── .env.local                  KV_REST_API_URL/TOKEN, APEX_API_TOKEN, VAULT_*, OPENCLAW_OAUTH_*.
```

---

## 2. Existing collections — closest analogues

Both `apex:practices:v1` and `apex:warroom:projects` follow the same shape and pattern. Quoting:

**`apex:practices:v1`** — `src/lib/practices.ts`

```ts
const KV_KEY = "apex:practices:v1";

export interface Practice {
  id: string;
  category: string;
  title: string;
  content: string;
  tags?: string[];
  scope?: string;
  source?: string;
  origin_store?: string;
  created_at?: string;
  updated_at?: string;
}

interface PracticeStoreShape {
  items?: Practice[];
  lastUpdated?: string;
}
```

The `loadAll()` helper at line 32 is the canonical tolerant-load pattern: handles `null`, JSON-string-wrapped values (KV write quirk), and bare arrays (legacy). It returns `{ items, lastUpdated }`. Every collection in the repo replicates this defensive read.

**`apex:warroom:projects`** — `src/lib/projects.ts`

```ts
const KV_KEY = "apex:warroom:projects";

export interface Project { id, name, stage, status, description?, blocker?, tags?, url?, owner?,
  score?, featured?, image_url?, metrics?, order?, tier?, created_at?, updated_at? }

interface ProjectStore { projects: Project[]; lastUpdated: string; }
```

Same `loadStore()` defensive pattern (lines 38-55). Same envelope: `{ <items|projects|tasks|events>: T[], lastUpdated: ISO }`.

**Writes never go through these libs.** Writes go through (a) the canonical REST route (`/api/projects` POST) or (b) the MCP tool. The libs are read-only. This is by design — the MCP route in particular calls `kv.get` / `kv.set` directly, with an explicit comment at `src/app/api/mcp/[transport]/route.ts:33-36`:

> "Write tools mutate KV directly (intra-function HTTP fetches are unreliable on Vercel and hostile to deployment protection). The MCP request has already been authenticated via OAuth at the withMcpAuth layer; calling internal API routes a second time only adds a network hop and a class of failure modes."

So: writes copy the store envelope inline in the tool body, mutate, and `kv.set` back. New collection should follow the same approach.

---

## 3. All MCP tools — current contract

Single source of truth: `src/app/api/mcp/[transport]/route.ts`. 17 tools registered via `server.registerTool(name, definition, handler)`. The `mcp-handler` package wraps this with OAuth via `withMcpAuth`. Auth required scope: `apex:full`.

**Read tools (10):** `apex_list_projects`, `apex_get_project`, `apex_list_tasks`, `apex_list_stale_tasks`, `apex_get_task`, `apex_get_briefing`, `apex_list_agents`, `apex_get_agent`, `apex_search_practices`, `apex_get_practice`, `apex_get_audit`, `apex_list_events`.

**Write tools (6):** `apex_set_task`, `apex_complete_task`, `apex_update_agent_memory`, `apex_add_practice`, `apex_set_project`, `apex_archive_project`, `apex_update_practice`, `apex_set_event`.

(The 17/18 mismatch is because `apex_list_events` is a read counter for `apex_set_event`.)

**Universal tool contract:**

- Input validated with Zod schemas inline in the registration call.
- Tools return `{ content: [{ type: "text", text: "<label>\n\n<JSON.stringify(payload, null, 2)>" }] }` via `asText(label, payload)` at line 49.
- Errors return `{ content: [{ type: "text", text: "<msg>" }], isError: true }` — never throw.
- Write tools end with `await appendAuditEvent({ tool, input, resultSummary, callerUserAgent })`.
- Write tools also call `safeEmit(...)` (line 25) to fire-and-forget event emissions where relevant.
- Enum validation uses module-level `Set` literals (`VALID_PROJECT_STAGES` etc., lines 38-47) and rejects with `isError: true` listing valid values.

**Naming:** `apex_<verb>_<noun>`. Verbs in use: `get`, `list`, `search`, `set`, `add`, `update`, `complete`, `archive`. No `delete` (archive is soft-delete). Nouns are snake_case singular for `get`, plural for `list/search`.

**Description discipline:** descriptions list filters, defaults, and gotchas explicitly (e.g. `apex_list_tasks`: "By default excludes tasks under paused/archived parents..."). The implication for the new tools is: descriptions must precisely state what they do, their defaults, and edge cases, in one paragraph.

---

## 4. `apex_get_briefing` end-to-end

The tool registration is a thin wrapper (route.ts:373-385). All logic is in `src/lib/briefing.ts`.

`buildBriefing()` is `unstable_cache(buildBriefingUncached, ["apex-briefing-v1"], { revalidate: 30 })`. **30-second cache.** Any new field added here will be cached too — fine for our purposes.

`buildBriefingUncached()` loads three things in parallel: `getAllProjects()`, `getAllTasks(undefined, MAX)`, `loadAgents()` (kv.get `apex:squad:v4`). It then composes 8 sections:

1. `this_week_frontline` — top 5 actionable tasks across tiered active ventures.
2. `active_ventures` — status=active + tier present (or `venture` tag); tier-rank then order.
3. `blocked_external` — status=blocked with parsed `waiting_on`.
4. `meta_work` — tag=meta, non-archived.
5. `paused_summary` — paused projects + archived count + creative tag.
6. `stale_tasks` — top 10 untouched >30 days (DAY_MS, STALE_DAYS = 30).
7. `dormant_agent_warnings` — orphan-task count.
8. `agents` — squad status with dormant-copy override.

**Where project context injects:** I'll extend the briefing in two places:

- **Top-priority project's context auto-surfaces.** "Top-priority" = `active_ventures[0]` (already sorted tier → order → name). Add a new section `top_project_context` populated with the context doc for that id. If missing → omit/null.
- **Sunset smell hook.** The spec calls for surfacing projects with open tasks but no context update in 30+ days. The natural spot is alongside `stale_tasks`, or as a peer section `stale_context_projects`. Lean toward a peer section to keep the existing stale-tasks contract untouched.
- **Compaction-due flag.** A new section `context_compaction_due` (or fold into `top_project_context.compaction_due: true|false`). I lean toward a per-doc flag plus a roll-up list of project_ids with any flag set, surfaced once at briefing root.

The `project_id` parameter the spec asks for is added at the **tool layer**, not the lib layer — `apex_get_briefing(project_id?)` switches the "top project" pick. Implementation: keep `buildBriefing()` parameterless and cached; layer an uncached `getBriefingForProject(project_id)` wrapper that calls `buildBriefing()` then swaps in the requested project's context. Simpler than parameterising the cache key.

---

## 5. Test pattern

**There is no test framework in this repo.** `package.json` scripts: `dev`, `build`, `start`. No jest, no vitest, no mocha. The only `*.test.*` files in the repo are in `node_modules/`.

**The de facto test pattern is `scripts/*.mjs`.** Specifically, `scripts/phase4.1-mcp-test.mjs` is the template for new MCP tools. It:

1. Reads `.env.local` directly to pick up `APEX_API_TOKEN`.
2. Walks the full OAuth flow (DCR → authorize POST → token exchange) against `BASE = http://localhost:3000` or the prod URL.
3. Calls `tools/list` to confirm the expected tool count and presence of new tool names.
4. Exercises each new tool: happy path, update path, invalid input (expects `isError: true`), missing-id (expects `isError: true`), regression on adjacent tools.
5. Verifies the audit log contains the new tool's events.
6. Writes a transcript to `data/phase4.1-mcp-{LABEL}-{ISO-date}.txt`.

**My test plan for this phase will mirror that pattern exactly.** One script: `scripts/project-context-mcp-test.mjs`. Runs local + prod. Saves a transcript. No new test framework added.

This means: changes are validated by running `npm run dev`, running the script, and inspecting the transcript. CI is `next build` on Vercel push.

---

## 6. Undocumented conventions

Things consistently present in the codebase but not written down. The new code must follow these:

1. **Store envelope shape.** Always `{ <plural-noun>: T[], lastUpdated: ISO }`. Never a bare array. Old data may be bare arrays — `loadStore` tolerates this. Writes always re-emit the envelope.

2. **Tolerant load.** Every reader handles four shapes: `null`/`undefined`, JSON-stringified, bare array (legacy), proper envelope. Throw on JSON parse failure, return empty envelope on any other malformedness.

3. **ISO timestamps everywhere.** `new Date().toISOString()` for both `created_at` and `updated_at`. Comparisons use `localeCompare` on the ISO strings (lexicographic = chronological).

4. **Audit-then-return.** Every write tool does mutation → `kv.set` → `appendAuditEvent` → `return asText(...)`. In that order. Audit failures should not bubble (events are append-only-fire-and-forget for non-critical telemetry, but `appendAuditEvent` is `await`ed — exception would surface).

5. **`safeEmit` for event emissions.** `safeEmit(label, promise)` swallows failures with a warn log (route.ts:25). Used after every state transition for event feed emission.

6. **ID generation.**
   - UUID for "library" items: `randomUUID()` with prefix (`manual-${uuid}` for practices).
   - Timestamp-base36 for transient/operational: `MCP-${Date.now().toString(36).toUpperCase()}-${random}` for tasks, `evt_${ts36}${rand}` for events.
   - For project context: project_id IS the id (one doc per project) — no separate generation needed.

7. **Field merge semantics on update.** Writes use explicit `if (input.X !== undefined) merged.X = input.X` lines, NOT spread. This preserves existing fields when undefined; spread would overwrite with undefined. See `apex_set_project` (route.ts:755-767) and `apex_update_practice` (route.ts:900-905).

8. **Error format.** `{ content: [{ type: "text", text: "Reason: details" }], isError: true }`. Text only. No structured error codes. Caller reads the text.

9. **Enum validation pattern.** Top-of-module `Set<string>` literals + early validation + isError listing valid values. Stages, statuses, tiers, sources all do this.

10. **British English in user-facing strings.** Spec-mandated; codebase examples: "Killed:", "Archived", "external", "Awaiting validation signal". Tool descriptions use US-ish neutral but the spec requires British for new code. I'll use British (e.g. "summarise", "behaviour", "prioritise", "analyse", "centre", "stakeholders' notes").

11. **`asText(label, payload)` envelope.** Wrap every successful return. The label is human-skimmable; the JSON is parseable.

12. **No new deps.** Everything uses `@vercel/kv`, `zod`, `mcp-handler`, `crypto.randomUUID`. New code follows the same diet.

13. **`unstable_cache` for briefing.** 30s revalidate. The briefing cache key will likely need invalidation considered if context changes mid-cache-window — but spec says "auto-surface", which the 30s cache already gives (writes during the window simply don't appear until next read after revalidate; acceptable).

14. **`maxDuration: 60` on MCP handler.** Routes have a 60s budget. The `apex_log_context` <500ms requirement is well inside this. Compaction is a pure compute + propose op (no LLM call inside the tool — the LLM call happens in the calling Claude session), so it's also well inside.

---

## 7. ⚠ Flag: `apex:project:{id}` enrichment store already exists

**This is the only spec conflict I found.** Documented in README:

> `apex:project:{id}` — Per-project enrichment store (5 records: caliber, edge-auto, gemsnap, squad, storyquest) — Holds timeline / waitingOn / notes the canonical record doesn't. Read via `/api/project/[id]`. Migration into canonical deferred to Phase 7/8.

Schema (src/app/api/project/[id]/route.ts:24-30):

```ts
interface ProjectDetail {
  id: string;
  tasks: ProjectTask[];           // duplicates apex:pipeline-tasks — known cruft
  timeline: TimelineMilestone[];  // milestones with dates + done/in-progress/upcoming
  waitingOn: WaitingItem[];       // mirrors blocked_external in briefing
  notes?: string;                 // free-form
}
```

This store:
- Lives at one key per project: `apex:project:caliber`, `apex:project:edge-auto`, etc. (Not a single collection.)
- Has UI consumers: `src/app/project/[id]/page.tsx` and `src/lib/project/load-dashboard.ts`.
- Is seed-then-write-back via PUT — if KV is empty for an id, it seeds from a hardcoded `SEED` object, writes to KV, returns.
- The `tasks` array is duplicate state with `apex:pipeline-tasks`. The README acknowledges this.

**This is NOT the spec's project-context layer.** The spec is explicit:
- New collection `apex:project-context:v1` (singular envelope, not per-id keys).
- Fixed sections: `current_state`, `active_hypotheses`, `open_questions`, `stakeholder_notes`, `recent_decisions`.
- The spec calls for the *narrative* layer; `apex:project:{id}` is structural enrichment (milestones, ToDos) — a different problem.

**My recommendation: build the new collection per spec. Do NOT touch `apex:project:{id}`.** The README explicitly defers its migration to Phase 7/8. Conflating them would expand scope and break the existing UI. I'll mention this adjacency in the new tool descriptions ("for narrative — use apex_log_context; structural milestones live in /api/project/[id]") so future readers don't ask the same question.

If you (Ginge) want to consider merging at some point, the right time is Phase 7/8 when the UI is being touched anyway. Not now.

---

## 8. Storage shape question — single-collection vs per-project keys

The spec implies `apex:project-context:v1` is "one document per `project_id`" — could be either:

A. **Single envelope:** `apex:project-context:v1 → { docs: { [project_id]: ContextDoc }, lastUpdated }`. One KV read for all.

B. **Per-id keys:** `apex:project-context:v1:{project_id} → ContextDoc`. One KV read per project. Briefing needs N reads or a key scan.

The existing pattern is A (practices, projects, tasks, events all use single-envelope). The briefing read path benefits from A (one round-trip). The `apex_log_context` <500ms target is easier with A on Vercel KV (single get + single set vs. potential scan).

**Recommendation: A.** Plus a sibling versions-store `apex:project-context:v1:versions → { [project_id]: { [version]: ContextDoc } }` for rollback (spec requires storing prior version). Or — simpler — store prior versions inline on the doc itself: `meta.prior_version: ContextDoc | null`. Decide in Phase 2.

---

## 9. Active ventures for bootstrap

The spec lists five active ventures by name: **Todd-Safent, Caliber, Atlas Drift, Rawai Villas, Poker OS**. KV IDs vary — I'll resolve actual IDs in Phase 3 by reading `apex:warroom:projects` at execute time. Likely mappings (to confirm):

- Todd-Safent → `todd-safent` (or `todd-saifent` — both forms appear in briefing's `WAITING_ON_OVERRIDES`)
- Caliber → `caliber`
- Atlas Drift → `atlas-drift`
- Rawai Villas → `villas` (current id) or a new `rawai-villas`
- Poker OS → likely a new id; not in the projects.json snapshot

If any of these IDs don't exist in KV, I'll flag in Phase 2 and ask before bootstrapping. Memory references confirm at least caliber, atlas-drift, todd-safent, and villas already exist as projects.

---

## 10. Open questions for Ginge (only the genuinely-blocking ones)

None blocking. I'm noting these so they don't get lost — I'll propose answers in Phase 2 and proceed unless you push back:

- **Rollback store:** inline `meta.prior_version` (cap at last N=1 versions) vs. sibling `apex:project-context:v1:versions`. I lean inline-with-N=1 for simplicity; spec just says "rollback is possible".
- **Compaction LLM-judge supersession:** the spec says "use the LLM to judge supersession" — this means the *calling Claude* judges in-conversation, not an LLM call from inside the tool. The tool returns the current doc + a heuristic-derived diff proposal; Claude picks which hypotheses are superseded before calling `apex_set_project_context` with the agreed compacted doc. Confirm this interpretation.
- **Constants module:** spec says no magic numbers. New file: `src/lib/project-context-constants.ts` (or fold into `src/lib/project-context.ts` at the top). I lean: top of the lib file, exported, no separate module.
- **Bootstrap quality:** "minimum viable, not blank stubs". I'll pull from MEMORY.md, the project descriptions, recent events, and existing dashboards to write one paragraph of `current_state` + 2-3 hypotheses + 1-2 open questions per venture. If you want me to ask you for the texture instead of inferring, say so.

---

## Done — moving to Phase 2

Next step: I write the implementation plan as the spec asks, present it, you review/confirm, I execute.

If anything above is wrong or you want me to reconsider a recommendation, say so before I draft Phase 2.
