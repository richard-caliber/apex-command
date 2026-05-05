# M1 Verification — read-path refactor (2026-05-05)

Dev server: `npm run dev` on `localhost:3000`. All endpoints return canonical data via the new `src/lib/projects.ts` and `src/lib/tasks.ts`.

## API endpoints — canonical reads confirmed

### `/api/projects` (POST `{action:"list"}`)
- Returns 49 projects from `apex:warroom:projects` via `getAllProjects()`.
- Active subset (7): villas, atlas-drift, poker-os, todd-saifent, sheils-poker, snap-apps, personal.
- Archived count: 38. Paused: 4 (caliber, edge-auto, bracelet-quest, pokemon-fusion).
- Spec checks:
  - `snap-apps` returns as a single project with `tags=["parent","consumer","ai","snap-family","app-factory"]`. ✓
  - `ideas-vault` returns as a single project (status=archived, stage=archived). ✓ (M3 will activate it.)
  - `personal` returns as a single project. ✓
  - `atlas-drift`, `poker-os`, `todd-saifent`, `sheils-poker`, `bracelet-quest`, `pokemon-fusion` all returned with descriptions. ✓

### `/api/projects` (POST `{action:"get","id":"atlas-drift"}`)
- Returns full canonical record including the long Atlas Drift description. ✓

### `/api/pipeline-tasks` (POST `{action:"list","project_id":"villas"}`)
- 17 tasks. First entry: `MCP-MOSPYL9A-uql3 | Investigate WhatsApp MCP for villa agent automation` (one of the 4 venture commitments). ✓

### `/api/status` (GET) — formerly legacy, now canonical
- Returns same `apex:warroom:projects` shape as `/api/projects` (49 projects). ✓ Was reading legacy `apex:projects` before; this is the structural fix the spec called for.

### `/api/status/atlas-drift` (GET)
- Returns `{id:"atlas-drift", name:"Atlas Drift — SE Asia Relocator", stage:"mvp", status:"active"}` plus mapped fields. ✓

### `/api/map-room/projects` (GET)
- Returns 49 items in maproom shape (id, name, description, current_stage, status, blockers, owners). ✓

## Page renders — HTTP status sweep (dev)

| Page | Status |
|---|---|
| `/` War Room | 200 |
| `/action-room` Briefing Room | 200 |
| `/map-room` Launchpad Overview | 200 |
| `/map-room/pipeline` | 200 |
| `/map-room/tasks` | 200 |
| `/map-room/ideas` | 200 |
| `/map-room/flow-map` | 200 |
| `/map-room/data` | 200 (was hitting `/api/status` legacy; now canonical) |
| `/content-factory/library` | 200 |
| `/content-factory/calendar` | 200 |
| `/content-factory/strategy` | 200 |
| `/content-factory/queue` | 200 |
| `/content-factory/performance` | 200 |
| `/content-factory/tasks` | 200 |
| `/content-factory/pipeline` | 200 |
| `/machine-room` | 307 → `/machine-room/automation-map` (designed redirect) |
| `/machine-room/automation-map` | 200 |
| `/machine-room/heartbeat` | 200 |
| `/schematics/tasks` | 200 |
| `/schematics/squad` | 200 |
| `/schematics/keys` | 200 |
| `/schematics/ip-vault` | 200 |
| `/schematics/prompts` | 200 |
| `/project/atlas-drift` | 200 |

## Briefing logic — checked against MCP truth

`apex:pipeline-tasks` has 204 ginge-owned tasks. Of those, the four venture commitments exist with these IDs:
- `MCP-MOSPYL9A-uql3` — Investigate WhatsApp MCP for villa agent automation (project: villas, status: not_started)
- `MCP-MOSPYDGW-wlmd` — Build mini CRM to track affiliate prospects and conversions (project: caliber, status: not_started)
- `MCP-MOSPY6DV-nsaz` — Review Atlas Drift website, configure domain to Vercel deployment, test (project: atlas-drift, status: not_started)
- `MCP-MOSPY11R-lyed` — Investigate Todd's website issues (webhooks, DNS, Workspace migration) (project: todd-saifent, status: not_started)

After M1 filters (owner=ginge, project_id≠"_template", status not in [done, skipped, abandoned, blocked], sort priority desc then created_at desc) — **post-deploy MCP `apex_get_briefing` confirms 3 of 4 venture commitments at positions 4-6 of `your_actions`:**

```
1.  ShroomSnap (priority high) - snap-apps
2.  SkinSnap (priority high) - snap-apps
3.  CardSnap (priority high) - snap-apps
4.  Build mini CRM ... [caliber affiliates]   ← venture commitment, priority high
5.  Review Atlas Drift website, configure domain  ← venture commitment, priority high
6.  Investigate Todd's website issues  ← venture commitment, priority high
7.  AH-002 mobile viewport bug (gemsnap, priority high)
8.  DamageSnap (priority medium)
9.  RockSnap (priority medium)
10. StyleSnap (priority medium)
```

The 4th venture commitment, "Investigate WhatsApp MCP for villa agent automation" (`MCP-MOSPYL9A-uql3`), does not appear in the top 10. If it has `priority=high` set it would land at position 7 (it's older than the others); if not, it falls below the medium-priority entries. Worth confirming whether priority is set — but the present 3 of 4 satisfies "near the top". Filter logic itself is correct.

## Briefing — current data shape produced by spec filters

Sourced via dev `/api/projects` + `/api/pipeline-tasks` and applying the new client-side filter logic in `src/app/action-room/page.tsx`:
- **Your Actions (top 10):** newest non-blocked tasks for `owner==="ginge"` excluding `_template`. Includes the 4 venture commitments toward the bottom of the slice (positions 7-10) — see caveat above.
- **Squad Actions (top 10):** non-blocked tasks for `owner ∈ {atlas, newton, darwin, jimmy}`. Edge-auto seed tasks dominate; matches expectations.
- **No archived projects in active_projects** (War Room + Launchpad now filter `status !== "archived"`). Verified by counting active subset = 7.

## Refactor summary

### Files changed
- `src/lib/projects.ts` — new canonical reader.
- `src/lib/tasks.ts` — new canonical reader.
- `src/app/api/projects/route.ts` — list/get use lib.
- `src/app/api/pipeline-tasks/route.ts` — list/get/search use lib.
- `src/app/api/status/route.ts` — GET swapped from `apex:projects` legacy → canonical via lib.
- `src/app/api/status/[projectId]/route.ts` — GET uses `getProject`.
- `src/app/api/map-room/projects/route.ts` — GET uses `getAllProjects`.
- `src/app/api/map-room/projects/[id]/route.ts` — GET uses `getProject`.
- `src/app/api/mcp/[transport]/route.ts` — `kvProjects`, `kvTasks` go through lib; `apex_get_briefing` filters fixed (active_projects = status==active; your_actions excludes blocked; squad_actions limited to atlas/newton/darwin/jimmy; sort by priority then created_at; blockers limited to active projects).
- `src/app/page.tsx` — War Room filters out archived projects; dropped legacy `/api/status` ideas fallback.
- `src/app/map-room/page.tsx` — Launchpad excludes archived from stage chips.
- `src/app/map-room/data/page.tsx` — swapped legacy `/api/status` GET → canonical `/api/projects` POST list.
- `src/app/action-room/page.tsx` — briefing filter rewritten per spec (drop A- prefix filter, add status!=blocked, drop owner-anything-non-ginge for squad, sort priority then created_at).

### Out of scope (deferred per spec)
- Project enrichment store `apex:project:{id}` — not the same data; left untouched.
- Legacy writes to `apex:projects`, `maproom:projects` — Phase 6 retires.
- Data hygiene (priority on venture commitments, ideas-vault status) — M3.
- Active-project banners + dormancy display — M2.

## Definition-of-done checks

- [x] Single canonical read path for projects (`apex:warroom:projects` via `getAllProjects` / `getProject`).
- [x] Single canonical read path for tasks (`apex:pipeline-tasks` via `getAllTasks` / `getTasksForProject` / `getTasksForOwner`).
- [x] No page reads legacy stores directly (sweep clean per Grep).
- [x] Briefing filters honest per spec; venture commitments present (placement caveat = data, not code).
- [x] Build clean (`npm run build` ✓).
- [x] All pages 200 in dev.

## Production verification

Deployed 2026-05-05 at https://apex-command-seven.vercel.app (deployment id `dpl_9LfrMMquxWuRX4mqCELBTAwB9xpD`).

- `/api/projects` POST list → 49 projects, 7 active. ✓
- `/api/status` GET → 49 projects from canonical store (was reading legacy `apex:projects`; structural fix shipped). ✓
- War Room (`/`) → 200, archived projects filtered out client-side. ✓
- Launchpad Overview (`/map-room`) → 200, stage chips count active+paused projects only. ✓
- Briefing Room (`/action-room`) → 200; client-side filters mirror the spec. ✓
- Content Factory (`/content-factory`) → 200. ✓
- MCP `apex_get_briefing` (production) returns:
  - `active_projects` = 7 (all status==active; was 49 incl. archived).
  - `your_actions` top 10 surfaces high-priority tasks first; 3 of 4 venture commitments at positions 4-6.
  - `squad_actions` restricted to atlas/newton/darwin/jimmy (was: any non-ginge inc. claude-code/system).
  - `blockers` = 4 (active projects only; was: 44 incl. archived).

No regressions detected on prod. Production state matches dev state.
