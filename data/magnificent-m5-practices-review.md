# M5 Practices Library Review — `apex:practices:v1` (2026-05-06)

Source: `scripts/m5-practices-inventory.mjs` against `apex:practices:v1` direct read. Raw output: `data/magnificent-m5-practices-raw.txt` (842 lines).

## Summary

- **187 entries**, 14 categories. Bulk: research (155, mostly Newton). Workflow (7), backlog (10 across phase-7/8/migration), best-practices (2), agent-memory (2), winning-hooks (2), test (2), misc singletons.
- **No structural corruption**: all entries have id, category, created, updated. Two entries have minor data quality issues (one missing title, one empty tags array — see below).
- **Stale-term hits**: ~30 entries reference "openclaw"; mostly research snapshots that are KEEP. Only 1 operational practice flagged for deprecation. No references to deprecated KV stores (`apex:projects`, `vault:ip-entries`, `maproom:*`).

## Tier 1 — clearly versioned, deprecation APPLIED in M5 (8 entries)

Each gets `DEPRECATED — see <newer> for canonical version. ` prepended to content. Original content preserved.

| Old (deprecated) | Newer (canonical) | Reason |
|---|---|---|
| `manual-31f791ee-3cfa-45a1-8e26-f668daa8e2d7` | `manual-8595cf1e-cbee-41dc-9b9b-d8de854ec4f6` | Mission Control session pattern v1 → v3 |
| `manual-6151c4b2-aa50-4a69-8608-654c62be1f77` | `manual-8595cf1e-cbee-41dc-9b9b-d8de854ec4f6` | Mission Control session pattern v2 → v3 |
| `vault-research-2026-03-29-caliber-pricing-matrix` | `vault-research-2026-03-29-caliber-pricing-matrix-v2` | explicit v1 vs v2 |
| `vault-research-2026-03-24-caliber-price-list` | `vault-research-2026-03-24-caliber-price-list-full` | initial vs full |
| `vault-research-2026-03-28-thymosin-alpha1-deep-dive` | `vault-research-2026-03-31-thymosin-alpha-1-deep-dive` | v1 stub (1.4KB) vs full (17.7KB) |
| `vault-research-2026-03-30-ghk-cu-deep-dive` | `vault-research-2026-04-02-ghk-cu-deep-dive` | explicit "Updated" suffix |
| `vault-rb-caliber-20260330-001` | `vault-rb-caliber-20260402-001` | rolling-brief v1 vs v2 |
| `vault-awesome-free-llm-apis-2026-04-07` | `vault-awesome-free-llm-apis-2026-04-11` | duplicate, identical title format |

## Tier 2 — high-confidence supersession (NOT applied; surfaced for Ginge)

| Old | Newer | Notes |
|---|---|---|
| `vault-research-2026-03-26-polsia-deep-dive` | `vault-research-2026-03-26-polsia-full-teardown` | "deep-dive" vs "full-teardown" same date — interpretation needed |
| `vault-research-2026-03-15-uk-peptide-competitors-partial` | `vault-research-2026-03-29-competitor-teardowns` | "Partial" → full pass two weeks later |
| `vault-claude-code-project-structure-2026` | `vault-claude-code-project-structure-reference-2026-04-07` | shorter early version vs longer attributed version |
| `vault-karpathy-llm-knowledge-base-2026` | `vault-karpathy-kb-implementation-guide-2026-04-11` | early sketch superseded by full guide |
| `vault-rb-general-20260404-001` | `vault-karpathy-kb-implementation-guide-2026-04-11` | rolling brief subsumed |

Recommendation: apply if Ginge confirms.

## Tier 3 — operational OpenClaw practice (NOT applied; surfaced for Ginge)

| Old | Status |
|---|---|
| `vault-gbrain-garrytan-openclaw-integration-2026-04-11` | Operational integration guide for killed OpenClaw stack. Cat=tool-discovery. Recommend DEPRECATE if OpenClaw is permanently retired (Phase 7 may revive squad on different stack). |

## OpenClaw research entries (KEEP)

29 entries reference "openclaw" but are research snapshots — historical record valuable. Per spec: research findings don't expire. Examples:
- `vault-llm-model-tiers-openclaw-agents-2026-04-11`
- `vault-openclaw-harness-architecture-2026-04-05`
- `vault-claude-alternatives-openclaw-2026-04-05`
- `vault-three-layer-humanization-skills-2026-04-05`
- `vault-gemma4-openclaw-local-2026-04-07`

KEEP all.

## Data quality issues (NOT applied; surfaced)

| ID | Issue | Action |
|---|---|---|
| `vault-newton-recommendation-content-ops-panel` | `title: (no title)` — empty title field; tags `[darwin-gate,automation,content-ops,newton-recommendation]` | Backfill title (Newton's recommendation that needs verbalising) |
| `vault-caliber-cta-library` | `tags=[]` empty | Backfill tags `[caliber,cta,copy,library]` or similar |
| `ipv-wh-1`, `ipv-wh-2`, `ipv-cl-1`, `ipv-fe-1` | `tags=[]` on IP-vault legacy seeds | Either backfill or document as intentional |

## Tag normalisation candidates (NOT applied; surfaced)

| Variants | Canonical |
|---|---|
| `pt141` (1) / `pt-141` (1) | `pt-141` |
| `gemma4` (1) / `gemma` (1) | `gemma` |
| `dosing` (1) / `protocols` (1) / `dosing-protocols` (1) | `dosing-protocols` |
| `metrics/conversion` (1) / `conversion` (6) | `conversion` |
| `content/strategy` / `content-strategy` (6) | `content-strategy` |
| `infrastructure/agents` (36) vs `agents` (6) | confirm whether semantic distinction or normalise |
| `infrastructure/openclaw` (6) | retire if OpenClaw permanently dead |

## TL;DR

- 8 obvious deprecations applied (Tier 1) — clearly versioned with newer canonical exists.
- 5 interpretive deprecations surfaced (Tier 2) — high confidence but want Ginge sign-off.
- 1 operational OpenClaw practice surfaced (Tier 3) — depends on Phase 7 squad direction.
- 6 data-quality items surfaced (titles, tags) — non-blocking.
- 7 tag-normalisation pairs surfaced.
- All 155 research entries left intact (research snapshots don't expire).
