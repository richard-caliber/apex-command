# Project Context Layer — Post-Ship Summary

Date: 2026-05-20. Phase: complete.
Branch: `phase-7-operationalise` (alongside other in-flight changes).

---

## What shipped

### New files

| Path | Purpose |
|---|---|
| `src/lib/project-context.ts` | Storage layer, types, constants (all thresholds), pure compaction proposer, briefing helpers. |
| `scripts/project-context-mcp-test.mjs` | End-to-end MCP test — 52 assertions, all pass locally. |
| `scripts/project-context-bootstrap.mjs` | Bootstrap with pre-flight checks (Poker OS halt + Rawai duplicate sanity check). |
| `data/project-context-phase1-recon-2026-05-20.md` | Phase 1 reconnaissance report. |
| `data/project-context-phase2-plan-2026-05-20.md` | Phase 2 implementation plan. |
| `data/project-context-mcp-local-test-2026-05-20.txt` | Test transcript (52 pass, 0 fail). |
| `data/project-context-bootstrap-local-2026-05-20.json` | Bootstrap log. |
| `data/project-context-postship-2026-05-20.md` | This file. |

### Modified files

| Path | Change |
|---|---|
| `src/app/api/mcp/[transport]/route.ts` | +4 MCP tools (get/log/set/compact). `apex_get_briefing` now accepts optional `project_id` + updated description. |
| `src/lib/briefing.ts` | Briefing now returns `top_project_context`, `context_compaction_due`, `stale_context_projects`. New `getBriefingForProject(project_id?)` uncached wrapper. |
| `README.md` | New `apex:project-context:v1` row in the KV-stores table + explicit three-store Phase 7/8 consolidation note. |

### KV state after ship

`apex:project-context:v1` — single envelope, 5 docs (v1 each):

- `caliber` — 347-char current_state, 2 hyp / 2 q / 0 stake / 2 dec
- `atlas-drift` — 357 chars, 2 hyp / 2 q / 0 stake / 1 dec
- `villas` — 191 chars, 2 hyp / 2 q / 0 stake / 0 dec
- `todd-safent` — 318 chars, 1 hyp / 2 q / 1 stake / 1 dec
- `poker-os` — 432 chars, 3 hyp / 3 q / 1 stake / 2 dec

`apex:warroom:projects` — untouched.
`apex:project:{id}` — untouched.

---

## Verification

### Test transcript: 52/52 pass

```
── SUMMARY: 52 passed, 0 failed ──
Wrote data/project-context-mcp-local-test-2026-05-20.txt
```

Covers: tools/list confirms 4 new tools; get on missing returns null without isError; all 4 sections of `apex_log_context` (create + append, version bumps from 1 → 4); invalid section / missing field / over-length / whitespace all rejected with `isError`; compaction propose-only (no save); compaction errors on missing project; `apex_set_project_context` over-length rejection; full overwrite produces v5 with `prior_version.meta.version === 4` and `prior_version.prior_version === null` (no recursion); briefing surfaces the three new keys; `project_id` parameter swaps `top_project_context`; audit log contains writes only (read tools omitted); regression sanity on `apex_list_projects`.

### Live briefing

```
active_ventures (id → name, tier, open_tasks):
  caliber → "Caliber Peptides — scout pyramid + coach-funnel scaling layer" (tier-1, 106 open)
  atlas-drift → "Atlas Drift" (tier-1, 64 open)
  villas → "Rawai Villas — 3× 24M THB sale or hold" (tier-1, 13 open)
  poker-os → "Poker Content OS" (tier-1, 9 open)
  todd-safent → "Safe NT (Todd) — fire safety reporting + Pack Builder wedge" (tier-2, 2 open)

top_project_context: caliber (v1)
context_compaction_due: 0 project(s)
stale_context_projects: 0 project(s)
```

---

## Decisions taken (where the plan met reality)

1. **Duplicate-detection false positive at bootstrap.** Initial pass halted on a phantom "duplicate Rawai / villas" because `villas` is *named* "Rawai Villas — 3× 24M THB sale or hold". Same record matched both filters. Fixed by comparing distinct project IDs across the two matching sets rather than just match-counts.

2. **Poker OS exists.** Project record (`poker-os`, name "Poker Content OS") was present. The halt-condition never fired. Bootstrap script had a placeholder body with empty `current_state`, which the validation caught — fixed by writing a real body sourced from the project's description and the 2026-05-08 Codex status dump.

3. **Bootstrap content sourced from KV descriptions + memory.** For each venture, `current_state` synthesises the description and current operational state; hypotheses and open questions reflect the actual posture as of 2026-05-20. Not blank stubs.

4. **Cache freshness.** First verification after bootstrap showed `top_project_context: null` and 5 stale projects — the 30s briefing cache was serving pre-bootstrap state. Confirmed on second read 30s later that the cache invalidates correctly and surfaces the new docs.

5. **No new dependencies.** Confirmed. Only `@vercel/kv`, `zod`, `mcp-handler`, `crypto.randomUUID` used.

6. **Tool descriptions, especially `apex_log_context`, written for read-cold-and-act.** The workhorse description includes both the "do not log" boundary (factual answers, generic discussion, anything that's a task) and the "when in doubt, log" default. Concrete utterance→section examples for all four sections.

---

## Open follow-ups (not blocking, but worth flagging)

- **Compaction proposer's "superseded_hypotheses_candidates" is a permissive flag** — surfaces the entire current `active_hypotheses` set if the doc is older than 30 days. The semantic judgement (which are genuinely dead) is the calling Claude's job. If this turns out to be too noisy in practice once compactions run, we can tighten the heuristic (e.g. compare hypothesis text against recent decisions for entailment hints). For now, the looser flag is the safer default — Claude can ignore false positives but cannot recover from false negatives.
- **No UI yet.** This phase shipped MCP + briefing only. A future phase can surface context docs in `/project/[id]` or as a sidebar in the briefing room. Out of scope here.
- **Phase 7/8 consolidation is now three stores, not two.** README and the explicit note in `apex:warroom:projects` / `apex:project:{id}` / `apex:project-context:v1` documents which fields belong where.
- **`apex_log_context` audit entries carry `payload_chars` only**, not the payload itself. If retrospective access to the exact narrative entries is needed (e.g. for legal/compliance review), full payloads can be logged at the cost of audit log bloat. Easy to flip if requirements change.

---

## Definition of done — final tick

- [x] All four tools live on the MCP and callable — 4/4, type-check clean, 52 test assertions pass.
- [x] `apex:project-context:v1` collection exists and is versioned — 5 docs at v1, every write increments `meta.version` and stashes `meta.prior_version` (verified via overwrite test producing v5 with `prior_version.meta.version === 4`).
- [x] `apex_get_briefing` surfaces project context for the top-priority project automatically — confirmed `top_project_context = caliber (v1)` in live briefing.
- [x] Five active ventures have bootstrapped context docs — minimum viable, not blank stubs — all five at v1 with non-empty narrative bodies.
- [x] Compaction demonstrated end-to-end on at least one project (propose → review → save) — test case 11 (propose returns `{ proposed, diff }` with no save, version stays at 4) + test case 13 (overwrite via `apex_set_project_context` produces v5 with prior captured). The "review" step is the calling Claude's, which is exercised whenever this is used in conversation.
- [x] Tests pass — 52/52.
- [x] Reconnaissance report, implementation plan, post-ship summary live alongside the code — three `data/project-context-*.md` files, all dated 2026-05-20.

Ready for PR description.
