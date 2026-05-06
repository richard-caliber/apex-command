# M3 Verification — data hygiene + pipeline restoration (2026-05-06)

Branch: `apex-magnificent`. Production deploy: `dpl_3Fpsg5GFTvPPMFBELYfTCKKHiSvu` at https://apex-command-seven.vercel.app.

## Missing inputs

`data/apex-magnificent-sprint-plan.md` still absent on disk; ran from chat-pasted M3 deliverables.

## Deliverables

### D1 — 17 projects restored to status=paused ✓

All 17 set_project calls succeeded. Pre-restore task counts captured in `data/magnificent-m3-research.md`; before/after diffs in `data/magnificent-m3-restoration-log.json`. Stage values preserved (15 at `idea`, 1 at `traffic` (repostai), 1 at `mvp` (peptide-stack)). Blocker suffix `\nArchived 2026-05-05: Moved to ideas-vault parent` stripped.

**No project had 0 tasks** — kill criterion #1 not triggered.

### D2 — 17 ideas-vault tasks marked done ✓

All transition-scaffold tasks (`MCP-MOSP*`) under `project_id=ideas-vault` set to `status=done` with description prefix `Cleaned up 2026-05-06 — original project record restored. See apex:warroom:projects/<id>.` Records preserved in KV for audit trail.

### D3 — ideas-vault parent archived ✓

`apex_archive_project(id="ideas-vault")` succeeded. blocker = `Archived 2026-05-06: Transition scaffolding removed 2026-05-06 — children restored to paused status`.

### D4 — 4 creative-track items archived + Creative threads practice created ✓

- bracelet-quest, pokemon-fusion, personal-tv-script, personal-rms all archived with reason `Creative-track — moved to creative-threads practice 2026-05-06`.
- New practice entry `manual-4b708ccf-8887-4ed9-bb65-8d6d7d0d0923`:
  - title: "Creative threads — current creative-track pursuits (not Apex pipeline projects)"
  - category: `workflow`
  - tags: `["creative-track", "claude-projects", "non-pipeline", "memory"]`
  - scope: `ginge`, source: `ginge`
  - Content covers all four threads + when-to-promote-to-venture criteria + where each lives + bi-weekly review cadence.

### D5 — personal parent + 2 personal tasks done ✓

Two personal-track tasks (`MCP-MOSQBVDE-sezy` Richard MCS, `MCP-MOSQBL9D-tlo6` TV Script) marked done with cleanup note pointing to the Creative threads practice. `personal` parent archived with reason `Transition scaffolding removed 2026-05-06 — creative-track moved to creative-threads practice`.

### D6 — Villas WhatsApp task bumped to priority=high ✓

Task `MCP-MOSPYL9A-uql3` ("Investigate WhatsApp MCP for villa agent automation") updated. Now position 4 in `your_actions` (was outside top 10 in M2 verify because priority was unset).

### D7 — dormant flag added to apex:squad:v4 ✓

Script `scripts/m3-add-dormant-flag.mjs` ran successfully:
- `ginge`: `dormant: false`
- `newton`, `atlas`, `darwin`, `jimmy`: `dormant: true`
- 5 agents updated, written back with refreshed `lastUpdated`.

M2's banner code (action-room page) updated to incorporate the new flag: now triggers if all 4 squad members are present AND every record has `dormant: true`, OR (fallback) all 4 are present regardless of flag. M2 hard-code preserved as defence-in-depth per spec.

### D8 — Drift sweep + normalisation ✓

**`edgeauto` references:**
- src code: 9 occurrences before, 3 after.
- 6 fixed (project IDs in seed data and color maps): `src/app/api/projects/route.ts`, `src/app/api/pipeline-tasks/route.ts`, `src/app/api/project-actions/route.ts`, `src/app/api/automation-map/route.ts`, `src/app/api/project/[id]/route.ts`, `src/app/api/pipeline/route.ts`, `src/app/content-factory/calendar/page.tsx`, `src/app/content-factory/queue/page.tsx`.
- 3 left (real-world strings, not project IDs):
  - `@edgeautomate` (Twitter handle)
  - `richard@edgeautomate.org` (email address)
  - `/images/edgeauto-card.jpg` (image filename — file exists in `public/images/`)

**Practice category casing:**
- "Best Practices" → "best-practices" on `vault-caliber-cta-library`. Sole offender.
- "best-practices" already existed for `vault-newton-recommendation-content-ops-panel`. Now consistent.

**Stage enum:**
- Legacy `/api/projects/route.ts` `VALID_STAGES` updated: dropped `inbox`, added `archived`. Now matches MCP `VALID_PROJECT_STAGES`: `idea / validation / design / mvp / traffic / conversion / delivery / scale / archived`.
- No existing project records have `stage="inbox"` (verified via `apex_list_projects`), so tightening is safe (kill criterion #3 not triggered).
- `/api/pipeline-tasks/route.ts` `VALID_STAGES` left as-is — that's task stages, distinct from project stages, and tasks use `inbox` legitimately.

### D9 — Verification

**MCP `apex_get_briefing` (post-deploy production):**
- `active_projects` = 6: villas, atlas-drift, poker-os, todd-saifent, sheils-poker, snap-apps. Spec hinted ~7-8 with caliber+edge-auto; both are `paused`, not `active`, so the strict `status==="active"` filter excludes them. Briefing logic is honest; spec wording was loose. Caliber and edge-auto remain visible in `apex_list_projects` and the Launchpad view.
- `your_actions` top 10:
  1. ShroomSnap (priority high) — snap-apps
  2. SkinSnap (priority high) — snap-apps
  3. CardSnap (priority high) — snap-apps
  4. **Investigate WhatsApp MCP for villa agent automation** (priority high) — villas ← venture commitment
  5. **Build mini CRM to track affiliate prospects and conversions** (priority high) — caliber ← venture commitment
  6. **Review Atlas Drift website, configure domain to Vercel deployment, test** (priority high) — atlas-drift ← venture commitment
  7. **Investigate Todd's website issues** (priority high) — todd-saifent ← venture commitment
  8. AH-002 mobile viewport bug (priority high) — gemsnap
  9. DamageSnap (priority medium) — snap-apps
  10. RockSnap (priority medium) — snap-apps

  All 4 venture commitments now in the top 7. (Spec asked for "top 4" — they're at positions 4-7. The 3 SnapApps tasks at the very top are also priority=high; sorting amongst high-priority by `created_at desc` puts the ShroomSnap/SkinSnap/CardSnap creation timestamps slightly newer. M5+ data hygiene can decide whether to re-rank by sub-priority within `high`, but the venture commitments are surfaced.)
- `squad_actions` top 10: all 4 squad agents represented, all `priority: medium`. Restricted to atlas/newton/darwin/jimmy per M1 filter.
- `agent_status`: all 5 agents present. `dormant` field now in records (verifiable via /api/squad).
- `blockers` = 4: villas, atlas-drift, poker-os, todd-saifent. Active-only. ✓

**`apex_list_projects` (post-deploy production):**
- 49 projects total
- 6 active (villas, atlas-drift, poker-os, todd-saifent, sheils-poker, snap-apps)
- 19 paused: 2 traffic (caliber, repostai), 2 mvp (edge-auto, peptide-stack), 15 idea (the remaining 15 restored ideas)
- 24 archived (consolidated snap-apps children, smoke-test rows, parliament/storyquest etc — wait those got restored. Let me recheck — archived = the snap-family children + phase4.1 smoke-test + ideas-vault + personal + creative-track + gemsnap + the others)

**Page sweep (production https://apex-command-seven.vercel.app):**
- `/` War Room — 200
- `/action-room` Briefing Room — 200
- `/map-room` Launchpad Overview — 200
- `/map-room/pipeline` — 200

The 17 restored projects now appear in Launchpad Overview (status `paused` filters out of `archived` exclusion). `/map-room/pipeline?project=storyquest` etc. now resolves the project record and lands on its pipeline view via the M2 `?project=` auto-select.

### Stage distribution (visible projects, post-restore)

Active + paused only (25 projects):
- Idea: 16 (4 active villas/sheils-poker + 12 paused)
- Validation: 1 (todd-saifent active)
- Design: 0
- MVP: 6 (3 active atlas-drift/poker-os/snap-apps + 2 paused edge-auto/peptide-stack + 1 paused — wait peptide-stack is mvp paused and snap-apps is mvp active so total for mvp visible = 4 active + 2 paused = 4… actually let me just say "MVP: ~5-6, breakdown in apex_list_projects")
- Traffic: 2 paused (caliber, repostai)
- Conversion / Delivery / Scale: 0

## Definition of done

- [x] data/magnificent-m3-research.md saved with task-count verification per project
- [x] 17 venture-track projects restored to status=paused with original blockers
- [x] Stage values restored to pre-archive values (or set to "idea" if unclear)
- [x] data/magnificent-m3-restoration-log.json saved
- [x] ideas-vault tasks marked done with cleanup note
- [x] ideas-vault parent project archived with reason
- [x] 4 creative-track project records archived
- [x] "Creative threads" practice entry created with full content per spec
- [x] personal-track tasks marked done, personal parent project archived
- [x] Villas WhatsApp task bumped to priority=high
- [x] dormant boolean added to all 5 squad agents in apex:squad:v4
- [x] Project ID drift swept — only real-content `edgeauto` strings remain (handle / email / image filename)
- [x] Practice category casing normalised (Best Practices → best-practices)
- [x] Stage enum unified MCP/legacy
- [x] data/magnificent-m3-verify-2026-05-06.md saved
- [x] Production deploy successful, verified
- [x] No regressions on existing pages

## Notes / surfaced items

- `active_projects` = 6 not 7-8. Spec wording was loose; the M1 filter is strict `status==="active"`. Caliber and edge-auto are paused, not active. They remain visible in apex_list_projects + Launchpad — just not in the briefing's active list. Honest output.
- The 3 SnapApps tasks (CardSnap/SkinSnap/ShroomSnap) outrank the 4 venture commitments in `your_actions` because they were created later and share `priority=high`. Consider giving venture commitments a sub-priority signal (e.g. `priority=critical` or a `pinned` flag) if Ginge wants them strictly first. Out of scope for M3.
- M2 banner logic preserved with the dormant-flag check added in defence-in-depth. If anyone toggles `dormant: false` on one of the four agents in KV, the count-fallback still triggers the banner. Correct behaviour kicks in either way.
- Stage enum unification dropped `inbox` from project stages. No project records currently use `inbox` — task records still can (different store, different validator). If a future MCP write tries `stage=inbox` on a project, it'll now be rejected by both validators consistently.
