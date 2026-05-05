# Phase 4.1 Pre-Flight Research

Generated 2026-05-05, before implementation.

## Existing MCP write tools (pattern to follow)

Source: `src/app/api/mcp/[transport]/route.ts`

Four existing write tools register via `server.registerTool(name, {title, description, inputSchema}, handler)`:
- `apex_set_task` — KV store `apex:pipeline-tasks`, mutates `tasks[]` array, audits with input + summary
- `apex_complete_task` — same store, sets status to "done"
- `apex_update_agent_memory` — KV store `apex:squad:v4`, appends to `agent.memory_text`
- `apex_add_practice` — KV store `apex:practices:v1`, appends new item with `manual-${randomUUID()}` id

**Pattern (MCP-direct-to-KV):**
1. `await kv.get<{...}>(KEY)` — load store, fall back to default shape
2. mutate the in-memory store
3. `await kv.set(KEY, store)` — persist
4. `await appendAuditEvent({ tool, input, resultSummary, callerUserAgent })` — audit
5. return `asText(label, payload)` — wraps as `{ content: [{ type: "text", text: "<label>\n\n<json>" }] }`

`asText` helper at top of route.ts is the standard return wrapper.

`extra` arg on the handler exposes the underlying request via `(extra as { request?: Request } | undefined)?.request?.headers?.get?.("user-agent")` — used to attach the caller UA to audit entries.

Errors: return `{ content: [{ type: "text", text: "Error message" }], isError: true }`.

## OAuth wrapper

Source: `src/lib/mcp-oauth.ts` + `withMcpAuth` from `mcp-handler`.

Top of `route.ts`:
```ts
const verifyToken = async (_req, bearerToken) => {
  if (!bearerToken) return undefined;
  const record = await lookupAccessToken(bearerToken);
  if (!record) return undefined;
  return { token, scopes: record.scopes, clientId: record.client_id, extra: { issued_at } };
};
const authedHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: [REQUIRED_SCOPE], // "apex:full"
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
```

New tools register inside the same `createMcpHandler((server) => {...})` callback, so they automatically inherit the `withMcpAuth` wrapping and the `apex:full` scope requirement. **No new auth code needed.**

## Audit helper

Source: `src/lib/mcp-audit.ts`

```ts
appendAuditEvent({
  tool: "apex_set_project",
  input: <full input object>,
  resultSummary: "created project storyquest (StoryQuest)",
  callerUserAgent: extra.request?.headers?.get("user-agent"),
});
```

Stored under `apex:mcp-audit:{YYYY-MM}` as `{ month, events[], lastUpdated }`. Auto-bucketed by month via `currentMonth()`.

## Project record shape

Canonical store: `apex:warroom:projects`
KV value shape: `{ projects: Project[], lastUpdated: string }`

`Project` interface from `src/app/api/projects/route.ts`:
```ts
{ id, name, description, stage, status, image_url, owner, blocker, tags[], url, metrics: Record<string,string>, created_at, updated_at }
```

**Canonical /api/projects validation (for reference, NOT what MCP enforces):**
- VALID_STAGES = `["inbox", "idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale"]` (9 stages)
- VALID_STATUSES = `["active", "paused", "blocked", "completed"]` (4 statuses)

**Phase 4.1 MCP enforcement (per user spec):**
- VALID_PROJECT_STAGES = `["idea", "validation", "design", "mvp", "traffic", "conversion", "delivery", "scale", "archived"]` (9 stages — drops `inbox`, adds `archived`)
- VALID_PROJECT_STATUSES = `["active", "paused", "blocked", "completed", "archived"]` (5 statuses — adds `archived`)

**Divergence note:** the MCP enum permits `archived` for both stage and status, but `/api/projects` (the API route) rejects `archived` on writes. Reads pass through unfiltered, so MCP-archived projects remain visible via `/api/projects list` and other read shims. Reconciling is explicitly Phase 6 work and out of scope here.

**Extension fields used by Phase 4.1 only (not in canonical interface):**
- `score: number 0–10` — Darwin's verdict score, optional
- `featured: boolean` — pinned to top of War Room, optional
- `order: number` — sort order for tied stages, optional

These are stored on the record but the canonical TypeScript `Project` interface does not declare them. They will appear via `apex_get_project` reads but UI components will treat them as undefined unless explicitly read. Acceptable for Phase 4.1 — UI work is out of scope.

**KV existence + seed:**
- Store is seeded if missing on first `getStore()` from `/api/projects`. By the time Phase 4.1 deploys, `apex:warroom:projects` is already populated (36 projects, per Phase 1 verify on 2026-05-04). MCP can assume the store exists; if not, fall back to `{ projects: [], lastUpdated: now }`.

## Practice record shape

Canonical store: `apex:practices:v1`
KV value shape: `{ items: Practice[], lastUpdated: string }`

`Practice` interface from `src/app/api/practices/route.ts`:
```ts
{ id, category, title, content, tags[], scope, source, origin_store?, created_at, updated_at }
```

**Validation:**
- VALID_SOURCES = `["newton", "atlas", "darwin", "jimmy", "ginge", "manual"]`
- No category enum — free-form
- No scope enum — free-form, default `"all_agents"`

**ID format:** practices added by MCP currently use `manual-${randomUUID()}`. Practices migrated from older stores use other prefixes (e.g. `vault-research-2026-03-18-customer-journey-proposal` per Phase 4 deploy verify). `apex_search_practices` returns whatever ID is on the record, so `apex_update_practice` must accept any string id and look it up exactly.

**404 behaviour:** if id not found, return error tool result (`isError: true`), not a JSON-RPC error.

## mcp-handler version pin

From `package.json`: `"mcp-handler": "^1.1.0"` (will need to verify pin during install — must NOT upgrade per kill criterion 2).

`server.registerTool(name, opts, handler)` signature is stable across 1.1.x. Adding three more tools is purely additive.

## Audit log key sanity check

Audit events are written under `apex:mcp-audit:{currentMonth()}`. May 2026 events go to `apex:mcp-audit:2026-05`. The Phase 4 deploy verify on 2026-05-04 confirmed write tools append correctly. Three new tools follow the same pattern.

## Test approach

Reuse the structure of `scripts/phase4-mcp-local-test.mjs`:
- DCR → authorize POST with APEX_API_TOKEN → token exchange → MCP initialize → `tools/call`
- Add three new tool invocations:
  1. `apex_set_project` create new (id: `phase41-test-{timestamp}`)
  2. `apex_set_project` update existing (same id, change name + status)
  3. `apex_archive_project` (same id, with reason)
  4. `apex_update_practice` — first call `apex_add_practice` to seed an updatable item, then call `apex_update_practice` against it
- Confirm 17 tools total (was 14, +3) in `tools/list`
- Save transcript to `data/phase4.1-mcp-local-test-{ISO-date}.txt` and `data/phase4.1-mcp-prod-verify-{ISO-date}.txt`

## Risks identified

1. **Stage/status enum divergence** — MCP allows `archived` for both fields; `/api/projects` rejects it on write. Read paths are tolerant. Documented above; no code-side mitigation in Phase 4.1.
2. **Extension fields on Project (`score`, `featured`, `order`)** — write but don't update the canonical TypeScript interface. UI components ignore them silently. Acceptable.
3. **`apex_update_practice` 404** — need to verify the lookup uses the exact id string the record was written under. The MCP route's `apex_get_practice` already does this correctly — mirror its lookup logic.
4. **Cleanup of test data** — local test will leave a `phase41-test-*` project in the store with status `archived`. Acceptable (matches the Phase 4 pattern where MCP-MOR2GWDD-y7xc remained as a `done` task).

## Definition of done from spec

- [ ] data/phase4.1-research.md ← THIS DOC
- [ ] Three tools added to /api/mcp route
- [ ] OAuth + audit on all three (free via existing wrapper)
- [ ] Local test transcript
- [ ] vercel --prod deploy
- [ ] Prod verify transcript
- [ ] Connector resync doc if needed
- [ ] Commit + push
- [ ] No regressions on existing 14 tools
