# Apex Magnificent Sprint Log

## M1 — Read-path refactor (2026-05-05)

- Created `src/lib/projects.ts` and `src/lib/tasks.ts` — single canonical readers for `apex:warroom:projects` and `apex:pipeline-tasks`. Pages and routes that previously hit legacy stores or duplicated KV access now go through one path.
- Refactored API routes to use the lib for reads: `/api/projects`, `/api/pipeline-tasks`, `/api/status`, `/api/status/[projectId]`, `/api/map-room/projects`, `/api/map-room/projects/[id]`, MCP `/api/mcp/[transport]`. Writes left in place — Phase 6 retires legacy keys.
- The big read-path fix: `/api/status` GET previously read legacy `apex:projects` (stale post-MCP writes). Now reads canonical via `getAllProjects()`. This is the structural cause of the UI-out-of-sync bug.
- Briefing room logic (MCP `apex_get_briefing` + `/action-room` page) rewritten:
  - `active_projects` filter now `status==="active"` (was `status!=="completed"`, dumped everything).
  - `your_actions` excludes blocked tasks; sorts priority desc → created_at desc; limit 10.
  - `squad_actions` restricted to `[atlas, newton, darwin, jimmy]` (was any non-ginge inc. claude-code/system).
  - `blockers` filtered to active projects only (was including all archived).
- War Room and Launchpad Overview now filter `status !== "archived"` client-side.
- Map Room Data page swapped legacy `/api/status` GET → canonical `/api/projects` POST list.
- Build clean. All pages 200 in dev. Deployed to production (`dpl_9LfrMMquxWuRX4mqCELBTAwB9xpD`); MCP briefing on prod confirms new logic — `active_projects` = 7 (down from 49), 3 of 4 venture commitments surface in `your_actions` positions 4-6.
- Out-of-scope and deferred: priority on the 4th venture commitment (`MCP-MOSPYL9A-uql3` — Investigate WhatsApp MCP for villas) — possible M3 data hygiene item; ideas-vault parent activation — M3.
- Research notes: `data/magnificent-m1-research.md`. Verification: `data/magnificent-m1-verify-2026-05-05.md`.

## M0 — Pre-sprint setup (2026-05-05)

- Branch `apex-magnificent` created off `master` (default branch is master, not main).
- Baseline KV snapshot: `data/magnificent-baseline-2026-05-05.json` — 57 keys captured, 6 expected nulls (`apex:squad:v2`, `apex:action-room:feed`, `apex:action-room:suggestions`, `maproom:outputs`, `maproom:metrics`, `maproom:platform-rules`).
- Snapshot script: `scripts/magnificent-baseline.mjs` (cloned from `phase1-kv-snapshot.mjs` with new output path; added `apex:practices:v1` to the known-keys list since Phase 2 introduced it).
- `npm install` clean.
- `npm run build` succeeded.
