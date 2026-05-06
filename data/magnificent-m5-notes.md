# M5 Working Notes — tasks/prompts/practices review

Branch: `apex-magnificent`. Latest commit before M5: `e85e91f`.

## Pre-flight verification (2026-05-06)

- `git status` clean. `git log` confirms branch at e85e91f (M4).
- `apex_get_briefing`: 6 active projects; 4 venture commitments lead your_actions (villas WhatsApp, Caliber CRM, Atlas Drift domain, Todd website — all high). 4 dormant agents + Ginge active.
- `apex_list_projects`: 49 records. 6 active / 19 paused / 24 archived. Matches M3.5/M4 verification numbers.

State preserved from M4. Safe to begin M5.

---

## Running notes

### Tasks (1)
- 35 archived-snap ginge tasks → blocked (Cat 8 of task review)
- 8 promotion tasks under edge-auto → cleared stale "Awaiting apex_set_project" blocker (regression: had to re-set status=done after blocker-only update reset it to not_started — `apex_set_task` defaults status to not_started when omitted; fixed)
- 1 strategic note → done (`MCP-MORH27P6-zbky`)
- 1 duplicate `_template` adhoc-stripe-webhook → done with "Duplicate of AH-001"
- Total: 45 changes applied. 8 categories of ambiguous items surfaced for Ginge — biggest is the ~38-task tweet review backlog under paused caliber.

### Prompts (2)
- `maproom:prompts` confirmed deleted (M4 work preserved). `apex:prompts:v2` is sole source of truth.
- 119 prompts in v2; 100% zero-usage (squad never executed). Library structurally clean — no references to deprecated stores.
- 13 prompts ginge/claude-code-owned ("ready to run"); 106 squad-owned (KEEP pending Phase 7 revival).
- No deletes, no refactors applied. Two duplicate-name pairs surfaced (P-0.3a/b, P-0.6a/b) for resolution at squad-revive time.

### Practices (3)
- 187 entries. No corruption. No references to deprecated KV stores. ~30 entries reference "openclaw" but mostly as research snapshots (KEEP).
- **8 Tier-1 deprecations applied**: Mission Control v1+v2 → v3; Caliber pricing matrix v1 → v2; Caliber price list initial → -full; Thymosin v1 stub → 03-31 full; GHK-Cu v1 → 04-02 updated; GHK-Cu RB v1 → RB v2; Free LLM APIs 04-07 → 04-11.
- 5 Tier-2 supersession candidates surfaced (Polsia deep-dive, UK competitors partial, Claude Code project structure, Karpathy KB).
- 1 Tier-3 OpenClaw operational practice flagged (`vault-gbrain-garrytan-openclaw-integration-2026-04-11`).
- Data quality items surfaced: 1 missing title, 5 empty-tags entries.
- Tag normalisation candidates surfaced (pt141/pt-141, dosing/protocols, slash vs hyphen variants).

### Workflow audit (4)
9 workflow practices cross-referenced in network:
- Mission Control v3 (`manual-8595cf1e`), Tweet triage (`manual-c86a1044`), Three-Project agent architecture (`manual-8355c348`), Project housekeeping (`manual-9eecd660`), Experiment vault (`manual-ea666c32`), Phase 7 sprint scope (`manual-d654d088`), Apex Magnificent backlog (`manual-c67954b3`), Task-chaining (`manual-fc240832`), Multi-template Apex (`manual-7fed8718`).

All references verified valid except 2 broken refs in `manual-d654d088` Phase 7 sprint scope:
- `manual-a26f790a` (Open-in-tool buttons) — not found, never written
- `manual-a656c73b` (Personal Admin Project) — not found, never written

Both were forward references to Phase 7 design artefacts. Updated `manual-d654d088` content to remove broken refs and inline the concepts in Phase 7.5 description (Open-in-tool buttons remains a Phase 7 work item; Personal Admin Project is implicit in Phase 7.2 housekeeping).

Phase numbering consistent across practices (Phase 6 = current, Phase 7 = post-Magnificent ops sprint, Phase 8 = knowledge wiki).

Cross-references to Apex Magnificent backlog (`manual-c67954b3`) and Tweet triage (`manual-c86a1044`) verified live across multiple practices.


