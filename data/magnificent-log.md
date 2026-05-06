# Apex Magnificent Sprint Log

## M4 — Parallel store deletion (2026-05-06)

- **13 KV keys deleted across 4 safe batches.** Total deleted: **20,555 bytes**. Order: 6 already-empty → 3 non-v2 stale → 2 replaced/orphaned → 2 legacy project stores. Verified between batches via MCP `apex_get_briefing`, `apex_list_projects`, page sweep.
- **`vault:ip-entries` KEPT** (kill criterion #1 fired). `src/app/schematics/ip-vault/page.tsx` still reads it via `/api/vault` ip-* actions. Phase 2's "replaced by apex:practices:v1" was DATA migration, not API consolidation. Retiring this requires API rewrite or page retirement — deferred to M5 / Phase 7. Documented as known divergence.
- **`apex:project:{id}` enrichment store KEPT** (Option A per spec). 5 records (caliber/edge-auto/gemsnap/squad/storyquest) hold per-project timeline/waitingOn/notes the canonical record doesn't. Migration into canonical deferred to Phase 7/8.
- **Read-shim code stripped** in 5 files: `/api/status/route.ts` (POST removed), `/api/status/[projectId]/route.ts` (PUT removed, legacy side-load removed), `/api/status/[projectId]/tasks/route.ts` (POST replaced with 410 Gone), `/api/map-room/projects/route.ts` (POST removed), `/api/map-room/projects/[id]/route.ts` (PUT removed). All five GET handlers route through `src/lib/projects.ts` — single canonical read path enforced by code structure, not by happy accident.
- **`data/squad.json` seed refreshed** from live `apex:squad:v4` (5 agents incl. dormant flags).
- Production deploy `apex-command-77iafensd`. 30-page UI sweep all 200 (two pre-existing 307 redirects unchanged). Mission Control MCP tools still working.
- Helper scripts: `scripts/m4-audit-keys.mjs` (size + caller audit), `scripts/m4-delete-batch.mjs` (delete + log), `scripts/m4-refresh-squad-seed.mjs`. Deletion log: `data/magnificent-m4-deletions-2026-05-06.json` (rollback-ready).
- Research: `data/magnificent-m4-research.md`. Verification: `data/magnificent-m4-verify-2026-05-06.md`.

## M3.5 — Briefing dormancy + archived task cleanup (2026-05-06)

Patch phase between M3 and M4 — three tail-end fixes from M3:

- **Briefing API now reads the squad dormancy flag.** `apex_get_briefing.agent_status` checks `dormant: boolean` per agent. Dormant agents render `status="dormant"` with the fixed copy line; the four pre-Magnificent stale `current_task` strings (e.g. "Researching: missing dosing protocols") no longer leak. Ginge's persisted `current_task` refreshed in `apex:squad:v4` from "Building the machine that builds the machine" → "Magnificent sprint in progress" via `scripts/m3.5-refresh-ginge-current-task.mjs`.
- **782 stale templated tasks under 16 archived snap-* projects + gemsnap suspended** (`status=blocked`, blocker = "Project archived 2026-05-05 — agent dormant — task suspended"). Each templated snap project carried ~61 squad-owned not_started tasks across mvp→scale stages. `scripts/m3.5-bulk-block-archived-pipeline-tasks.mjs` + dry-run `scripts/m3.5-bulk-block-preview.mjs`. **Kill criterion #2 fired (782 vs 500 threshold).** Surfaced and overridden after review — count was correct given templated pipeline depth, action fully reversible. Log: `data/m3.5-archived-task-cleanup-log.json`.
- **AH-002 verified** as `project_id=snap-apps`, `status=blocked`, `priority=low`. No drift; no re-apply needed.
- Production briefing post-deploy: 4 venture commitments lead `your_actions` (Villas WhatsApp, Caliber CRM, Atlas Drift domain, Todd website — all high). 4 dormant agents + Ginge active. squad_actions no longer dominated by stale damagesnap T-4.x tasks. AH-002 absent.
- Verification: `data/magnificent-m3.5-verify-2026-05-06.md`.

## M3 — Data hygiene + pipeline restoration (2026-05-06)

- **17 venture-track ideas restored to `paused`** with original blockers (suffix stripped). All retained their pipeline tasks (16-129 each). Restoration log: `data/magnificent-m3-restoration-log.json`.
- **ideas-vault parent + 17 transition-scaffold tasks cleaned up.** Tasks set to `done` with cleanup note; parent archived.
- **Creative-track moved out of Apex.** bracelet-quest, pokemon-fusion, personal-tv-script, personal-rms archived. New practice entry `manual-4b708ccf-…` ("Creative threads") in `apex:practices:v1` covers all four threads + when-to-promote-to-venture criteria. `personal` parent + 2 personal-track tasks cleaned up.
- **Villas WhatsApp MCP task bumped to `priority=high`.** Now position 4 in `your_actions`; all 4 venture commitments present in top 7.
- **`dormant` flag added to `apex:squad:v4`.** atlas/newton/darwin/jimmy = true; ginge = false. Action-room banner updated to incorporate the flag with the M2 count-fallback as defence-in-depth.
- **Drift sweep:** `edgeauto` → `edge-auto` in 6 src files (seed data + color maps); 3 remaining occurrences are real-world strings (`@edgeautomate` handle, `richard@edgeautomate.org` email, `edgeauto-card.jpg` image filename).
- **Practice categories normalised:** `Best Practices` → `best-practices` on `vault-caliber-cta-library`.
- **Stage enum unified:** `/api/projects` `VALID_STAGES` aligned with MCP — dropped `inbox`, added `archived`.
- Production deploy `dpl_3Fpsg5GFTvPPMFBELYfTCKKHiSvu`. Briefing now: 6 active projects, 4 venture commitments at high priority, 4 active blockers. `apex_list_projects` returns 49 total: 6 active / 19 paused / 24 archived.
- Research: `data/magnificent-m3-research.md`. Verification: `data/magnificent-m3-verify-2026-05-06.md`. Helper script: `scripts/m3-add-dormant-flag.mjs`.

## M2 — Briefing display polish (2026-05-05)

- **Briefing Room — dormant squad banner.** `src/app/action-room/page.tsx` now renders Ginge's row plus a single "Squad dormant — Operating Mission Control + MCP only" banner when all four `[atlas, newton, darwin, jimmy]` are present. M3 will replace the hard-code with a proper `dormant` flag.
- **Briefing Room — race fix.** Added `loading` + `fetchError` state. Your Actions, Squad Actions, Ad Hoc Tasks, and Team Status all gate their empty states on `!loading` so the page never silently falls through to "no tasks" before the fetch resolves. A small red banner renders only when every fetch failed.
- **Machine Room — Twitter inbox grouping.** `src/app/machine-room/automation-map/page.tsx` Manual Actions section now buckets `/-tweet/i` task names into a collapsed "Twitter inbox (N items)" row. Bucket empty in current data (0/132); pattern in place for future Newton tweet triage.
- **Map Room — pipeline `?project=<id>` auto-select.** `src/app/map-room/pipeline/page.tsx` wraps content in `<Suspense>` and reads `useSearchParams().get("project")` as the initial dropdown value. Deep links from War Room cards now land directly on the project pipeline.
- **Launchpad — stage chip + body counts now share a single `projectsByStage` selector.** Cannot drift apart by construction. Expected: Idea=4, Validation=1, MVP=5, Traffic=1 (sum 11 non-archived).
- Production deploy `dpl_5HWNbXXSXVD41CAgQnLtNrV9hzVM`; all 5 affected pages 200; new loading strings and Suspense fallback present in SSR.
- Verification: `data/magnificent-m2-verify-2026-05-05.md`.

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
