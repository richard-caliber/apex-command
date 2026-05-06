# M4 Research — parallel store deletion (2026-05-06)

Branch: `apex-magnificent`. Latest commit before M4: `42ec5ed`. Baseline snapshot at `data/magnificent-baseline-2026-05-05.json` (4.7MB, captured pre-M1).

## Key audit — current size + callers + verdict

| Key | Size now | In baseline | Route callers | Page callers | Verdict |
|---|---|---|---|---|---|
| `apex:squad:v2` | 0 | absent | none | none | **DELETE** |
| `apex:action-room:feed` | 0 | absent | `/api/action-room` | none — page does not fetch | **DELETE** |
| `apex:action-room:suggestions` | 0 | absent | `/api/action-room` | none | **DELETE** |
| `maproom:outputs` | 0 | absent | `/api/map-room/outputs` | none | **DELETE** |
| `maproom:metrics` | 0 | absent | `/api/map-room/metrics` | none | **DELETE** |
| `maproom:platform-rules` | 0 | absent | `/api/map-room/platform-rules` | none | **DELETE** |
| `maproom:ideas` | 2,713 B | yes | none (canonical is `maproom:ideas:v2`) | none | **DELETE** |
| `maproom:capabilities` | 2,134 B | yes | none (canonical is `maproom:capabilities-v2`) | none | **DELETE** |
| `maproom:ip-vault` | 2,199 B | yes | none (canonical is `maproom:ip-vault-v2`) | none | **DELETE** |
| `vault:ip-entries` | 866,580 B | yes | `/api/vault` ip-* actions | **`src/app/schematics/ip-vault/page.tsx`** (LIVE) | **KEEP — kill criterion #1** |
| `maproom:ip-vault-v2` | 1,558 B | yes | `/api/map-room/ip-vault` (orphaned route — no page caller) | none | **DELETE** |
| `maproom:prompts` | 2,268 B | yes | `/api/map-room/prompts` (orphaned route) | none | **DELETE** |
| `apex:projects` | 6,784 B | yes | `/api/status` POST (write), `/api/status/[projectId]` PUT (write), `/api/status/[projectId]/tasks` POST (write) — all M1-shimmed for reads to canonical. Side-load from this store in `/api/status/[projectId]` is dead path (project detail page uses `/api/project/[id]` for tasks). | none read, page writes only via PUT | **DELETE** |
| `maproom:projects` | 899 B | yes | `/api/map-room/projects` POST (write), `/api/map-room/projects/[id]` PUT (write) — orphaned route, no page caller | none | **DELETE** |

**Total to delete: ~21KB** (881KB if vault:ip-entries had been included; well under 5MB kill threshold).

## Critical finding — `vault:ip-entries` has live callers

**Kill criterion #1 applies.** `src/app/schematics/ip-vault/page.tsx` calls `/api/vault` with `action: "ip-list"` which reads `vault:ip-entries`. The Phase 2 migration moved IP vault DATA into `apex:practices:v1` but did not update the `/api/vault` route — it still serves IP vault from `vault:ip-entries`. Schemas differ (IP entries have `project_id`, `source_task`, `performance_data`; practices have `category`, `scope`, `tags`, `source`).

Decision: **KEEP `vault:ip-entries`**. M5 or later can decide whether to migrate `/api/vault` to read from `apex:practices:v1` or whether to retire the schematics/ip-vault page in favour of practices-based UI. Documented for future phase.

## Per-project enrichment store — `apex:project:{id}` (5 keys)

Wildcard scan found 5 records:
- `apex:project:caliber` (1,126 B)
- `apex:project:edge-auto` (789 B)
- `apex:project:gemsnap` (817 B)
- `apex:project:squad` (637 B)
- `apex:project:storyquest` (842 B)

Total: 4,211 B. These hold per-project enrichment data (timeline milestones, waitingOn items, custom-shape tasks, notes) that does NOT exist in the canonical project record. Live readers:
- `src/app/project/[id]/page.tsx` calls `/api/project/${id}` for `tasks`/`timeline`/`waitingOn`/`notes` — fully live.

Per spec **Option A = KEEP** for M4. Migration into canonical is deferred to Phase 7 or 8 ("merge enrichment fields into canonical record"). The store is documented as a known divergence.

## `apex:pipeline:*` keys (2 keys, not in deletion list)

- `apex:pipeline:caliber:2026-03-28` (1,375 B)
- `apex:pipeline:caliber:2026-03-29` (1,413 B)

Out of M4 scope (these are content-pipeline grids per Phase 1). Left untouched.

## Deletion plan (4 batches)

**Batch 1 — already-empty (6 keys, 0 bytes):**
1. `apex:squad:v2`
2. `apex:action-room:feed`
3. `apex:action-room:suggestions`
4. `maproom:outputs`
5. `maproom:metrics`
6. `maproom:platform-rules`

Verify between batches: hit `/`, `/action-room`, `/map-room` — should all 200.

**Batch 2 — non-v2 stale (3 keys, 7,046 bytes):**
7. `maproom:ideas`
8. `maproom:capabilities`
9. `maproom:ip-vault`

Verify: same page sweep + `/map-room/ideas`, `/map-room/capabilities`, `/map-room/ip-vault`.

**Batch 3 — replaced + orphaned routes (2 keys, 3,826 bytes):**
10. `maproom:ip-vault-v2`
11. `maproom:prompts`

Verify: `/map-room/ip-vault`, `/prompts` (or whichever page touches prompts) + Mission Control MCP `apex_search_practices`.

**Batch 4 — legacy project stores (2 keys, 7,683 bytes):**
12. `apex:projects`
13. `maproom:projects`

Verify: full UI walk + MCP `apex_list_projects` + `apex_get_briefing`.

## Read-shim removal scope

After deletion, the following code becomes dead and can be stripped (M4 deliverable 4):
- `/api/status/route.ts` `WRITE_KEY = "apex:projects"` constant + POST handler that writes to it (no callers, dead code)
- `/api/status/[projectId]/route.ts` `WRITE_KEY = "apex:projects"` + `getWriteData()` + the legacy-shape sideload + PUT writes to legacy
- `/api/status/[projectId]/tasks/route.ts` writes to `apex:projects` — entire route is M1-shimmed legacy. POST handler with no caller.
- `/api/map-room/projects/route.ts` `KV_KEY = "maproom:projects"` POST handler — no caller
- `/api/map-room/projects/[id]/route.ts` `KV_KEY = "maproom:projects"` + `getData()` legacy reader + PUT — no caller

Note: The /api/map-room/projects GET still serves the maproom-shape via `getAllProjects()` from the lib. The orphaned write paths can be retired but the GET route should remain unless we confirm no MCP-style consumer hits it.

For M4 scope, strip:
- The `apex:projects` write paths in /api/status routes (they have no callers).
- The `maproom:projects` write paths in /api/map-room/projects routes.
- Any associated `getWriteData()` helpers + interface definitions that become unused.

Keep:
- The lib-based GET handlers everywhere (they read canonical).
- The /api/map-room/projects GET shape (maproom format) in case any external consumer relies on it.
- /api/vault entirely (vault:ip-entries kept).
- /api/project/[id] entirely (apex:project:{id} kept per Option A).
- The orphaned /api/map-room/{ip-vault,prompts,outputs,metrics,platform-rules} routes — leave for M6 dead-code removal. Their KV keys are gone after this phase but the routes will just return empty arrays / null on next call. Removing them is M6 work.

## Rollback path

If anything breaks after a batch, restore from `data/magnificent-baseline-2026-05-05.json` via direct Upstash REST `SET`. Each key's pre-deletion value is captured in the deletion log; the baseline holds the M0 snapshot for any older state.
