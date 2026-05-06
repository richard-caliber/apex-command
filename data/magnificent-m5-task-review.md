# M5 Task Review — ginge-owned tasks (2026-05-06)

Source: `apex_list_tasks(owner="ginge", limit=200)` — 200 of 204 returned (2,727 total tasks system-wide). 7 of those are `blocked` (verified separately). 4 not retrieved (likely older `done`); review below addresses 100% of `not_started` tasks since Cat 8 is the actionable set.

## Status totals (ginge-owned)
- `not_started`: 113
- `done`: ~84
- `blocked`: 7

## Categories

| Cat | Description | Count |
|---|---|---|
| 1 | Active high-priority current work on active project | 3 (lacking priority field) |
| 2 | Stale (created >30 days, no recent activity) | ~50 (mostly tweet review) |
| 3 | Misclassified (wrong status / should be note not task) | 17 (snap-apps rollups + 1 strategic note) |
| 4 | Missing context (no description, no blocker, vague name) | ~70 (template scaffolding mostly) |
| 5 | Redundant / duplicate | 2 confirmed |
| 6 | Already-done-but-not-marked / stale blocker text | 8 (promotion tasks) |
| 7 | Tasks under paused projects | ~50 (mostly caliber) |
| 8 | Tasks under archived projects (should be auto-blocked) | 35 |

---

## Bulk-handle candidates (UNAMBIGUOUS — applied in M5)

### A) Block tasks under archived snap-* projects (35 tasks)

Mirror M3.5 logic for ginge-owned residuals. M3.5 explicitly handled squad-owned tasks; these 35 ginge-owned tasks under archived snap projects were missed.

Action: `apex_set_task(status="blocked", blocker="Project archived 2026-05-05 — task suspended (M5 cleanup)")` for each.

| id | project_id | name |
|---|---|---|
| T-3.7-damagesnap | damagesnap | Test Product Functionality |
| T-3.7-rocksnap | rocksnap | Test Product Functionality |
| T-3.7-stylesnap | stylesnap | Test Product Functionality |
| T-3.7-skinsnap | skinsnap | Test Product Functionality |
| T-3.7-fishsnap | fishsnap | Test Product Functionality |
| T-3.7-shroomsnap | shroomsnap | Test Product Functionality |
| T-3.7-cardsnap | cardsnap | Test Product Functionality |
| T-3.7-coinsnap | coinsnap | Test Product Functionality |
| T-3.7-stampsnap | stampsnap | Test Product Functionality |
| T-3.7-bugsnap | bugsnap | Test Product Functionality |
| T-4.5c-damagesnap | damagesnap | Ginge: Pick Winning Styles |
| T-6.2-damagesnap | damagesnap | Test Onboarding Experience |
| T-4.5c-rocksnap | rocksnap | Ginge: Pick Winning Styles |
| T-6.2-rocksnap | rocksnap | Test Onboarding Experience |
| T-4.5c-stylesnap | stylesnap | Ginge: Pick Winning Styles |
| T-6.2-stylesnap | stylesnap | Test Onboarding Experience |
| T-4.5c-skinsnap | skinsnap | Ginge: Pick Winning Styles |
| T-6.2-skinsnap | skinsnap | Test Onboarding Experience |
| T-4.5c-fishsnap | fishsnap | Ginge: Pick Winning Styles |
| T-6.2-fishsnap | fishsnap | Test Onboarding Experience |
| T-4.5c-shroomsnap | shroomsnap | Ginge: Pick Winning Styles |
| T-6.2-shroomsnap | shroomsnap | Test Onboarding Experience |
| T-4.5c-cardsnap | cardsnap | Ginge: Pick Winning Styles |
| T-6.2-cardsnap | cardsnap | Test Onboarding Experience |
| T-4.5c-coinsnap | coinsnap | Ginge: Pick Winning Styles |
| T-6.2-coinsnap | coinsnap | Test Onboarding Experience |
| T-4.5c-stampsnap | stampsnap | Ginge: Pick Winning Styles |
| T-6.2-stampsnap | stampsnap | Test Onboarding Experience |
| T-4.5c-bugsnap | bugsnap | Ginge: Pick Winning Styles |
| T-6.2-bugsnap | bugsnap | Test Onboarding Experience |
| T-4.5c-gemsnap | gemsnap | Ginge: Pick Winning Styles |
| T-6.2-gemsnap | gemsnap | Test Onboarding Experience |
| T-6.2-plantsnap | plantsnap | Test Onboarding Experience |
| T-6.2-birdsnap | birdsnap | Test Onboarding Experience |
| A-snap-001 | birdsnap | 🟡 Build BirdSnap/PlantSnap/PeptideStack MVPs |

Total: 35 tasks. Under kill criterion #1 threshold (>50).

### B) Clear stale blocker text on 8 done promotion tasks under edge-auto

These are `status=done` already (promoted to real projects 2026-05-05) but still carry blocker text "Awaiting apex_set_project MCP tool (Phase 6)". The tool exists, the projects exist. Set `blocker=null`.

| id | name | promoted-to project status |
|---|---|---|
| MCP-MORH4FYM-a6f8 | [NEW PROJECT: personal-rms] | archived |
| MCP-MORH48HH-ye30 | [NEW PROJECT: personal-tv-script] | archived |
| MCP-MORH41VL-355w | [NEW PROJECT: pokemon-fusion] | archived |
| MCP-MORH3TXL-ou7x | [NEW PROJECT: bracelet-quest] | archived |
| MCP-MORH3LH0-k2bv | [NEW PROJECT: sheils-poker] | active |
| MCP-MORH3B32-t6xb | [NEW PROJECT: todd-saifent] | active |
| MCP-MORH2WTB-lsrf | [NEW PROJECT: poker-os] | active |
| MCP-MORH2MH2-nnx3 | [NEW PROJECT: atlas-drift] | active |

### C) Mark 1 strategic-note "task" as done

`MCP-MORH27P6-zbky` `edge-auto` — name says "Strategic note: Edge Auto pivoted to Todd-led wedge" and the description ends "This task is a strategic note, not an action; see todd-saifent project for actual work items." It's a note, not a task. Mark `done` with blocker null (content preserved in description).

### D) Mark 1 duplicate as done

`adhoc-stripe-webhook` (`_template`, `not_started`) — duplicate of `AH-001` (`caliber`, `done` 2026-04-07). Mark `done` with blocker "Duplicate of AH-001 (caliber, completed 2026-04-07)".

**Total bulk-handles in M5: 45 changes (35 + 8 + 1 + 1).**

---

## Needs Ginge decision (ambiguous — surfaced, NOT applied)

### 1. Caliber tweet review backlog (~38 not_started tasks under paused caliber)

All `adhoc-ginge-review-*-tweet` tasks. Caliber is paused but tweet research feeds Newton's reusable practice library — could still be valuable. Some examples:
- `adhoc-ginge-review-exm7777-tweet`, `adhoc-ginge-review-bloggersarvesh-tweet`, `adhoc-ginge-review-chhddavid-tweet`, `adhoc-ginge-review-ivanburazin-tweet`, `adhoc-ginge-review-claudeai-tweet`, `adhoc-ginge-review-noisyb0y-tweet-2`, `adhoc-ginge-review-khairallah-tweet-3`, `adhoc-ginge-review-chddaniel-tweet`, `adhoc-ginge-review-defileo-tweet`, `adhoc-ginge-review-alexvacca-tweet`, `adhoc-ginge-review-milesdeutscher-tweet`, `adhoc-ginge-review-justinbrooke-tweet`, `adhoc-ginge-review-sharbel-tweet`, `adhoc-ginge-review-coreyganim-tweet`, `adhoc-ginge-review-hooeem-tweet`, `adhoc-ginge-review-mattepstein-tweet`, `adhoc-ginge-review-vadim-tweet-4`, `adhoc-ginge-review-hasantoxr-tweet`, `adhoc-ginge-review-wizofecom-tweet`, `adhoc-ginge-review-gkisokay-tweet`, `adhoc-ginge-review-primemans-tweet`, `adhoc-ginge-review-cyrilxbt-tweet`, `adhoc-ginge-review-noisyb0y-tweet`, `adhoc-ginge-review-austin-tweet`, `adhoc-ginge-review-roundtable-tweet`, `adhoc-ginge-review-khairallah-tweet-2`, `adhoc-ginge-review-godofprompt-tweet`, `adhoc-ginge-review-nickspisak-tweet`, `adhoc-ginge-review-vadim-tweet-3`, `adhoc-ginge-review-farzatv-tweet`, `adhoc-ginge-review-alexfinn-tweet`, `adhoc-ginge-review-oliviscus-tweet-2`, `adhoc-ginge-review-ghumare-tweet`, `adhoc-ginge-review-khairallah-tweet`, `adhoc-ginge-review-ruben-tweet`, `adhoc-ginge-review-vadim-tweet-2`, `adhoc-ginge-review-oliviscus-tweet`, `adhoc-ginge-review-aayan-tweet`, `adhoc-ginge-review-ziwenxu-tweet`

Options: (a) bulk-block all "Caliber paused — tweet review queue archived M5"; (b) selective kill keeping high-signal accounts; (c) re-target to a `newton-practices-research` project; (d) keep open.

Recommendation: **option (a)** — block as suspended, mirroring archived-project rule. Reversible. Strategic value is the bucketed Twitter inbox display in Machine Room (M2) — which works regardless of task status.

### 2. Caliber actionable infra tasks (6 tasks under paused caliber)

- `MCP-MOSPYDGW-wlmd` — Build mini CRM to track affiliate prospects (created 2026-05-05, fresh)
- `adhoc-newton-research-methodology-upgrade` — Extract Newton's methodology to practice library
- `adhoc-newton-caliber-icp-segmentation` — ICP segmentation (deferred per name)
- `A-cal-reel-setup` — Set up reel production pipeline with Atlas
- `A-vault-003` — 🟡 Claude Code: Build vault query API endpoint (likely done — vault work landed pre-M5)
- `A-ideas-001` — 🟢 Iterate through idea-stage projects with Newton
- `adhoc-ginge-intake-triage-system` — Forward Darwin cron/intake triage prompt

Options: (a) block all under "Caliber paused"; (b) reassign infra ones (Newton methodology, intake triage, vault) to a new ops project; (c) re-justify and keep open per item.

Recommendation: Newton methodology extraction is **valuable for Apex itself** — repoint to a new `apex-ops` project or to Phase 7. CRM task is fresh — keep but mark blocked until caliber resumes. Rest: block.

### 3. Snap-apps parent rollup tasks (16 tasks)

`MCP-MOSQ*` tasks under `snap-apps` (active) — names encode state but tasks are not_started. Memory says CardSnap/SkinSnap/ShroomSnap are priority #1-#3.

Options: (a) convert priority structure (set priority=high on 3 priority apps, low on the rest); (b) block the explicit "(parked)" ones (BackgammonSnap, PoolSnap, GunSnap); (c) keep as visible roadmap but require descriptions.

Recommendation: combine (a)+(b). Block the 3 explicitly parked, set priority on the priority-#1-#3 apps, mid-tier the rest with descriptions.

### 4. Three "active high-priority" tasks lacking priority/description

- `MCP-MOSPYL9A-uql3` `villas` — Investigate WhatsApp MCP for villa agent automation
- `MCP-MOSPY6DV-nsaz` `atlas-drift` — Review Atlas Drift website, configure domain to Vercel deployment, test (memory says atlas-drift is at "Day 3.5, voice block + Day 3.6 next" — is "configure domain" already done?)
- `MCP-MOSPY11R-lyed` `todd-saifent` — Investigate Todd's website issues (vague scope)

These already lead `your_actions` (no priority field but appear at top because they're recent). Adding `priority=high` + tightening descriptions would make the briefing cleaner.

### 5. `_template` literal pipeline tasks (4 tasks)

- `T--1.1` `_template` — Capture Idea
- `T-4.5c` `_template` — Ginge: Pick Winning Styles
- `T-6.2` `_template` — Test Onboarding Experience
- `T-3.7` `_template` — Test Product Functionality

These are template scaffolding tasks. They leak into the system as ginge-owned not_started but the `_template` project is a meta-construct.

Options: (a) close as `done` with "Template scaffolding"; (b) reassign to a hidden project; (c) leave as-is.

Recommendation: (a) close as `done` once Ginge confirms `_template` project isn't an active workflow source.

### 6. Three other `_template` items potentially already done

- `adhoc-briefing-mobile-fix` — M2 redesigned briefing extensively; this is likely already shipped
- `adhoc-ginge-everything-claude-code-install` — old install task
- (`adhoc-stripe-webhook` already in unambiguous bucket above)

Recommendation: confirm + close.

### 7. Already-blocked `T-3.7-*` tasks that need updated blocker text

Currently blocked with stale messages:
- `T-3.7-plantsnap` blocked "MVP not built yet" — but plantsnap is now archived → reblock with archive reason
- `T-3.7-birdsnap` blocked "MVP not built yet" — same
- `T-3.7-edgeauto` blocked, blocker null — set "Edge Auto paused"
- `T-3.7-caliber` blocked, blocker null — set "Caliber paused"
- `T-3.7-peptide-stack` blocked "MVP not built yet" — peptide-stack is paused; could update
- `T-4.5c-edgeauto` blocked "Agent dormant — OpenClaw squad paused" — accurate, leave as-is

Recommendation: low priority cleanup — update blockers for the 4 above for consistency.

### 8. Phase 4 MCP smoke test duplicate

`MCP-MOR2GWDD-y7xc` and `MCP-MOR2R6OK-w88v` — both `done` "Phase 4 MCP smoke test task (updated)" on edge-auto. Delete one? Status=deleted via `apex_set_task` — but task tool may not support deletion. Leave as historical artefact (both done, no display impact).

---

## TL;DR for Ginge

1. **45 unambiguous changes applied in M5** (35 archived-project blocks + 8 stale-blocker clears + 1 strategic-note marked done + 1 duplicate marked done).
2. **8 categories of decisions surfaced** for Ginge — biggest is the ~38-task tweet review backlog under paused caliber (strong recommendation: block).
3. **3 active task records lack priority/description** despite being top of your_actions — quick polish opportunity.
4. **Template tasks (`_template` project)** are leaking into ginge-owned not_started — should be cleaned up after Ginge confirms `_template` is not an active source.
