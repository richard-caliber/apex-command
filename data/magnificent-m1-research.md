# M1 Research — read-path scope (2026-05-05)

## Missing inputs

- `data/apex-magnificent-sprint-plan.md` — not on disk; ran from chat-pasted deliverables.
- `data/phase0-recon-*.md` — no Phase 0 recon report on disk.

Available Phase 1 artifacts: `phase1-reconcile-log-2026-05-04.json`, `phase1-route-fixes-2026-05-04.txt`, `phase1-verify-2026-05-04.txt`.

## Canonical KV keys (source of truth)

- `apex:warroom:projects` — projects (read by `/api/projects`, MCP, Phase 1 shims)
- `apex:pipeline-tasks` — tasks (read by `/api/pipeline-tasks`, `/api/tasks`, MCP)

## Legacy keys still in use (write side, Phase 6 retires)

- `apex:projects` — written by `/api/status/[projectId]` (PUT) and `/api/status/[projectId]/tasks` (POST) and `/api/status` (POST). Read shims redirect to canonical.
- `apex:project:{id}` — per-project enrichment (timeline, waitingOn, notes, custom-shape tasks). Read+written by `/api/project/[id]` and `/api/project/[id]/task/[taskId]`. **Different shape** from canonical task records — not the same data, can stay separate.
- `maproom:projects` — written by `/api/map-room/projects` (POST) and `/api/map-room/projects/[id]` (PUT). Reads shimmed.

## Routes — canonical vs legacy

| Route | Read key | Status |
|---|---|---|
| `/api/projects` | `apex:warroom:projects` | canonical |
| `/api/pipeline-tasks` | `apex:pipeline-tasks` | canonical |
| `/api/tasks` | (re-export of `/api/pipeline-tasks`) | canonical |
| `/api/status` GET | `apex:projects` | **legacy — fix in M1** |
| `/api/status/[projectId]` GET | `apex:warroom:projects` | shim ✓ |
| `/api/status/[projectId]/tasks` POST | reads canonical, writes legacy | shim ✓ |
| `/api/map-room/projects` GET | `apex:warroom:projects` | shim ✓ |
| `/api/map-room/projects/[id]` GET | `apex:warroom:projects` | shim ✓ |
| `/api/project/[id]` | `apex:project:{id}` | enrichment — separate concern |
| `/api/mcp/[transport]` | `apex:warroom:projects`, `apex:pipeline-tasks` | canonical |

## Pages — fetch patterns (grep)

All client components. None hit KV directly; they fetch via API routes.

| Page | Fetches | Verdict |
|---|---|---|
| `src/app/page.tsx` (War Room) | `/api/projects`, `/api/pipeline-tasks`, `/api/map-room/ideas`, `/api/status` (fallback only) | canonical except fallback |
| `src/app/action-room/page.tsx` (Briefing Room) | `/api/projects`, `/api/pipeline-tasks`, `/api/tasks`, `/api/data`, `/api/squad` | canonical; **filter logic needs fix** |
| `src/app/map-room/page.tsx` (Launchpad Overview) | `/api/projects`, `/api/pipeline-tasks` | canonical; **stage chip status filter missing** |
| `src/app/map-room/pipeline/page.tsx` | `/api/projects`, `/api/tasks` | canonical |
| `src/app/map-room/flow-map/page.tsx` | `/api/tasks`, `/api/projects` | canonical |
| `src/app/map-room/data/page.tsx` | `/api/data`, `/api/status` | **/api/status legacy — fix** |
| `src/app/content-factory/pipeline/page.tsx` | `/api/projects`, `/api/tasks` | canonical |
| `src/app/machine-room/automation-map/page.tsx` | `/api/pipeline-tasks` | canonical |
| `src/app/schematics/prompts/page.tsx` | `/api/tasks` | canonical |
| `src/app/schematics/tasks/page.tsx` | `/api/pipeline-tasks` | canonical |
| `src/app/schematics/ip-vault/page.tsx` | `/api/projects` | canonical |
| `src/app/project/[id]/page.tsx` (Project Detail) | `/api/project/${id}`, `/api/status/${id}` | enrichment + shimmed canonical — see note below |

Other pages (`/finance`, `/ideas`, `/squad`, `/tasks`, `/vault`, `/prompts`, `/content-factory/calendar/library/performance/queue/strategy/tasks`, `/machine-room`, `/machine-room/heartbeat`, `/map-room/automation-map`, `/map-room/capabilities`, `/map-room/heartbeat`, `/map-room/ideas`, `/map-room/ip-vault`, `/map-room/tasks`, `/schematics`, `/schematics/keys`, `/schematics/squad`) don't fetch projects/tasks per the grep — they fetch their own domain endpoints.

## Refactor scope (M1)

### Library (new)

- `src/lib/projects.ts` — `Project` type, `ProjectFilter`, `getAllProjects(filter?)`, `getProject(id)`. Reads `apex:warroom:projects` only.
- `src/lib/tasks.ts` — `Task` type, `TaskFilter`, `getAllTasks(filter?, limit?)`, `getTasksForProject(projectId)`, `getTasksForOwner(ownerId, limit?)`. Reads `apex:pipeline-tasks` only.

### Routes to refactor (use lib reads)

- `/api/projects` POST list/get → use `getAllProjects` / `getProject`
- `/api/pipeline-tasks` POST list/get/search → use `getAllTasks` / lib helpers
- `/api/status` GET → swap from `apex:projects` to `getAllProjects()` (legacy reader is the dumb shim per spec; this kills it)
- `/api/status/[projectId]` GET → use `getProject`
- `/api/map-room/projects` GET → use `getAllProjects`
- `/api/map-room/projects/[id]` GET → use `getProject`
- `/api/mcp/[transport]` reads (apex_list_projects, apex_get_project, apex_list_tasks, apex_get_task) → use lib

Writes can stay inline — M4 deletes legacy stores. M1 is read-path only.

### Briefing room logic fix (`src/app/action-room/page.tsx`)

Current filters:
- `gingeActions = tasks.filter(t => t.id.startsWith("A-") && status not in [done,skipped,abandoned] && owner==="ginge")` sorted by status emoji order
- `squadActions = tasks.filter(t => t.id.startsWith("A-") && ... && owner!=="ginge")`

Spec wants:
- `your_actions` = owner=="ginge" AND project_id != "_template" AND status not in [blocked, done, skipped, abandoned], sort by priority(high>med>low) then created_at desc, limit 10
- `squad_actions` = owner in [atlas, newton, darwin, jimmy] AND project_id != "_template" AND status not in [blocked, done, skipped, abandoned], same sort, limit 10
- Drop `id.startsWith("A-")` filter — surfaces the real venture commitments (Investigate Todd's website, Atlas Drift domain, Caliber CRM, WhatsApp MCP for villas) which are pipeline tasks, not adhoc.
- The "blocked" status exclusion is new; current code includes blocked tasks at the top.

### Launchpad stage chip fix (`src/app/map-room/page.tsx`)

Current: counts all projects per stage regardless of status.
Spec: "No archived projects appear in active_projects lists" — filter `status !== "archived"` before counting/rendering.

Sub-issue: canonical store has `stage="archived"` for `ideas-vault` (a non-stage value); the page's `stageFromLabel` falls back to 3 (mvp), which is wrong. With the status filter, archived projects won't render — handles this implicitly.

### Other pages

- `src/app/page.tsx` (War Room) — drops `/api/status` fallback (legacy ideas read). Already mostly canonical. Keep but unblock by ensuring War Room filters out `archived` from card list per spec.
- `src/app/map-room/data/page.tsx` — swap `/api/status` GET → `/api/projects` POST list (canonical via lib post-refactor).
- `src/app/project/[id]/page.tsx` — leave enrichment fetch (`/api/project/${id}`) alone since it's a different data type. The `/api/status/${id}` call already shims to canonical and remains valid.

## Current canonical state (via MCP, 2026-05-05)

49 projects total. Status breakdown:
- **active** (7): villas, atlas-drift, poker-os, todd-saifent, sheils-poker, snap-apps, personal
- **paused** (4): caliber, edge-auto, bracelet-quest, pokemon-fusion
- **archived** (38): everything else

Verifies the spec expectation that ideas-vault is a parent (active or archived?) — actually `ideas-vault` is `status: archived, stage: archived`. Spec says "ideas-vault shows as a single project" — this is M3 work to make it active-with-children. For M1 verification, the goal is just that the UI reads what's in the store and doesn't show stale data.

## Out-of-scope confirmations

- M3 data hygiene — not touching.
- M4 store deletions — not touching.
- M6 dead code — not touching.
- Project enrichment store (`apex:project:{id}`) — different shape, leave alone.
- Maproom legacy writes — leave alone (M4/M6 retire).
