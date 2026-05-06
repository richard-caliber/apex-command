# M4 Verification — parallel store deletion (2026-05-06)

Branch: `apex-magnificent`. Production deploy: `apex-command-77iafensd-caliber1.vercel.app` (alias https://apex-command-seven.vercel.app).

## Deletions applied

13 KV keys deleted across 4 batches. Total bytes removed: **20,555** (well under the 5MB kill threshold). One key flagged for **KEEP** under kill criterion #1.

| Batch | Keys | Bytes deleted |
|---|---|---|
| 1 — already-empty | apex:squad:v2, apex:action-room:feed, apex:action-room:suggestions, maproom:outputs, maproom:metrics, maproom:platform-rules | 0 |
| 2 — non-v2 stale | maproom:ideas, maproom:capabilities, maproom:ip-vault | 7,046 |
| 3 — replaced + orphaned routes | maproom:ip-vault-v2, maproom:prompts | 3,826 |
| 4 — legacy project stores | apex:projects, maproom:projects | 7,683 |

Full per-key log with pre-deletion values (rollback-ready) at `data/magnificent-m4-deletions-2026-05-06.json`.

## Kill criterion #1 — `vault:ip-entries` KEPT

Live caller found: `src/app/schematics/ip-vault/page.tsx` calls `/api/vault` with `action: "ip-list"`, which reads `vault:ip-entries`. Phase 2 migrated IP-vault DATA into `apex:practices:v1` but did not update the read path. Schemas differ (IP entries hold `project_id`, `source_task`, `performance_data`; practices hold `category`, `scope`, `tags`, `source`).

Decision: **KEEP `vault:ip-entries` for M4**. Documented in research doc as a known divergence. M5 or later phases can decide whether to migrate `/api/vault` ip-* actions to read from `apex:practices:v1` or retire the schematics/ip-vault page.

## `apex:project:{id}` enrichment store — KEPT (Option A)

5 records (caliber, edge-auto, gemsnap, squad, storyquest) holding per-project enrichment (timeline, waitingOn items, custom-shape tasks, notes). Live reader: `src/app/project/[id]/page.tsx`. Per spec Option A, retained. Migration into canonical record deferred to Phase 7 or 8.

## Read-shim code stripped (D4)

Five files updated. The shims that wrote to deleted stores are gone; reads converge through `src/lib/projects.ts` everywhere.

- `src/app/api/status/route.ts` — POST removed, file slimmed to GET-only that reads canonical via `getAllProjects()` + `getProjectStoreLastUpdated()`.
- `src/app/api/status/[projectId]/route.ts` — PUT removed, `getWriteData()` removed, legacy side-load (`tasks`/`overdueTasks`/`blockedTasks`) removed. GET reads canonical via `getProject()` and projects to legacy "war room" shape.
- `src/app/api/status/[projectId]/tasks/route.ts` — POST replaced with HTTP 410 Gone returning a self-documenting message ("Retired in M4 — legacy apex:projects store was deleted. Use /api/project/[id] for project-detail tasks or /api/pipeline-tasks for pipeline tasks.").
- `src/app/api/map-room/projects/route.ts` — POST removed. GET reads canonical via `getAllProjects()` and projects to maproom shape inline (no longer dual-stores).
- `src/app/api/map-room/projects/[id]/route.ts` — PUT removed, `getData()` removed. GET reads canonical via `getProject()` and projects to maproom shape.

`npm run build` clean post-strip.

Orphaned routes (`/api/action-room`, `/api/map-room/{ip-vault,prompts,outputs,metrics,platform-rules}`) intentionally LEFT in place per spec — those whose KV keys were deleted but routes have no page caller. M6 deletes those file by file. They now read deleted/null keys and return empty payloads if hit; no breakage because nothing calls them.

## Squad seed refresh (D5)

`data/squad.json` updated from live `apex:squad:v4`. 5 agents present with `dormant` flags:
- ginge: `dormant: false`
- newton, atlas, darwin, jimmy: `dormant: true`

Refresh script: `scripts/m4-refresh-squad-seed.mjs`.

## Verification

### MCP tools (post-deploy)

- `apex_list_projects` → 49 projects, canonical store unchanged ✓
- `apex_get_briefing` → renders fully, agent_status correct (1 active + 4 dormant), 4 venture commitments lead `your_actions`, 4 active blockers ✓
- `apex_search_practices(query=caliber)` → returns 187 practices ✓

### Shimmed read routes (post-deploy)

| Endpoint | Result |
|---|---|
| `GET /api/status` | 49 projects from canonical |
| `GET /api/map-room/projects` | 49 items in maproom shape |
| `GET /api/status/atlas-drift` | `{id, name, stage:"mvp"}` |
| `GET /api/map-room/projects/atlas-drift` | `{id, name, current_stage:4}` |

### Page sweep (production)

30 routes hit; all 200 except two pre-existing 307 redirects (`/map-room/ip-vault`, `/schematics`) that were 307 before M4.

```
200 /                            200 /content-factory               200 /machine-room/automation-map
200 /action-room                 200 /content-factory/library       200 /machine-room/heartbeat
200 /map-room                    200 /content-factory/calendar      307 /schematics  ← pre-existing
200 /map-room/pipeline           200 /content-factory/strategy      200 /schematics/keys
200 /map-room/tasks              200 /content-factory/queue         200 /schematics/ip-vault
200 /map-room/ideas              200 /content-factory/performance   200 /schematics/prompts
200 /map-room/flow-map           200 /content-factory/tasks         200 /schematics/squad
200 /map-room/data               200 /content-factory/pipeline      200 /schematics/tasks
200 /map-room/capabilities                                          200 /project/atlas-drift
307 /map-room/ip-vault  ← pre-existing                              200 /project/caliber
                                                                    200 /project/storyquest
                                                                    200 /project/edge-auto
```

## Definition of done

- [x] `data/magnificent-m4-research.md` saved with caller verification per key
- [x] `data/magnificent-m4-deletions-2026-05-06.json` saved with full deletion log (13 entries, all reversible)
- [x] All SAFE_TO_DELETE keys deleted from KV
- [x] `apex:project:{id}` kept (Option A); `vault:ip-entries` kept (kill criterion #1)
- [x] Read-shim code removed from 5 files
- [x] `data/squad.json` seed updated with current `apex:squad:v4` state (incl. dormant flags)
- [x] `data/magnificent-m4-verify-2026-05-06.md` saved
- [x] Production deploy `apex-command-77iafensd` Ready, full UI walk passed
- [x] Mission Control MCP tools still working (`apex_list_projects`, `apex_get_briefing`, `apex_search_practices`)
- [x] No regressions on existing pages

## Notes / surfaced items

- **`vault:ip-entries` retention.** Kill criterion #1 fired and was honoured. The /api/vault ip-* actions (used by schematics/ip-vault page) were not in spec scope to refactor — Phase 2's "replaced by apex:practices:v1" was about data migration, not API consolidation. Retiring this key requires either rewriting /api/vault to read from practices (with schema mapping) or retiring the schematics/ip-vault page. Suggest M5 or Phase 7 task.
- Of the 13 deleted keys, **6 were already empty** at deletion time — those rows were essentially housekeeping. The other **7 carried 20,555 bytes** of legacy state (1 KV "page" worth of project drift). Now zero parallel stores → zero possible drift between reads and writes for the canonical project + task model.
- The orphaned routes (`/api/action-room`, `/api/map-room/{ip-vault,prompts,outputs,metrics,platform-rules}`) are dead code now that their KV keys are gone. M6 deletes them. They currently return empty arrays / null if hit; no caller hits them.
- One write path remains in /api/project/[id] PUT (project-detail notes) — that targets `apex:project:{id}` (kept enrichment store), not deleted apex:projects. Out of M4 scope.
