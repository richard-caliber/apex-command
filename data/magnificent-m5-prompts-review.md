# M5 Prompts Library Review — `apex:prompts:v2` (2026-05-06)

Source: `scripts/m5-prompts-inventory.mjs` against `apex:prompts:v2` direct read. Raw output: `data/magnificent-m5-prompts-raw.txt` (1,062 lines).

## Headline findings

- **`maproom:prompts` confirmed DELETED** — M4 deletion preserved. `apex:prompts:v2` is sole truth.
- **119 prompts in `apex:prompts:v2`**, lastUpdated 2026-04-04.
- **Library is structurally clean**: zero references to deprecated stores (`apex:projects`, `vault:ip-entries`, `maproom:*`).
- **100% zero-usage** (`timesUsed=0` on all 119): library has never been executed. The squad has been dormant since cron paused.
- **No deletes recommended in M5.** No prompts qualify under both required kill criteria (orphaned + stale-store reference).

## Counts by category

| Cat | Description | Count |
|---|---|---|
| 1 | Active and current (no agent refs) | 13 |
| 2 | References dormant agents (Newton/Darwin/Atlas/Jimmy) | 106 |
| 3 | Orphaned (no usage + clearly stale) | 0 |
| 4 | Stale terms (deprecated stores) | 0 |

## Counts by stage
- inbox: 3
- idea: 13
- validation: 11
- design: 15
- mvp: 17
- traffic: 22
- conversion: 13
- delivery: 13
- scale: 12

## Counts by owner
- darwin: 71 (60%)
- atlas: 18
- claude-code: 12
- newton: 12
- ginge: 5
- jimmy: 1

---

## Cat 1 — Active and current (13 prompts, KEEP)

| id | name | stage | owner |
|---|---|---|---|
| P--1.1 | Capture Idea | inbox | ginge |
| P--1.3 | Generate Idea Image | inbox | ginge |
| P-0.3b | Revenue Model Scan | idea | ginge |
| P-0.6b | Go-to-Market Hypothesis | idea | ginge |
| P-3.3 | Build Landing Page | mvp | claude-code |
| P-3.4 | Build Core Product | mvp | claude-code |
| P-3.8 | Set Up Payments | mvp | claude-code |
| P-3.10 | Set Up Tracking Events | mvp | claude-code |
| P-3.11 | Set Up ManyChat / Messaging Automation | mvp | claude-code |
| P-3.12 | Set Up Email Sequences | mvp | claude-code |
| P-3.14 | Set Up Fulfillment Automation | mvp | claude-code |
| P-5.6 | Run A/B Tests | conversion | claude-code |
| P-6.7 | Fix Friction Points | delivery | claude-code |

These are the prompts Ginge / claude-code can use today. Worth surfacing in the prompts library UI as the "ready to run" subset.

## Cat 2 — References dormant agents (106 prompts, KEEP pending Phase 7 revival)

Owners: darwin 71, atlas 18, newton 12, jimmy 1, plus 4 prompts where the body references squad members. These are the operating prompts behind the P-{stage}.{step} pipeline. They are not stale — they're idle waiting for squad revival.

Per spec: dormant-agent prompts are KEEP candidates because Phase 7 will revive the squad. No individual decisions needed; one strategic decision binary applies (confirm Phase 7 revival → keep all).

## Cat 3 / Cat 4 — Orphaned + stale-term references

**Empty.** No prompt qualifies for kill.

---

## Refactor candidates (soft, surfaced for Ginge)

1. **`P-0.3a` vs `P-0.3b`** — both "Revenue Model Scan" at stage=idea. P-0.3a darwin-owned, P-0.3b ginge-owned. Pick one canonical when squad revives.
2. **`P-0.6a` vs `P-0.6b`** — same name collision: "GTM Hypothesis" vs "Go-to-Market Hypothesis" at stage=idea. Same fix.
3. **`P-4.6` Produce Full Batch** — only jimmy-owned prompt, model=gemini-2.5-pro. Confirm model choice on Phase 7.
4. **Highest-iteration prompts** — P-4.4 (v5), P-4.4b (v4), P-4.8 (v6). Most-tuned in the library; first targets for squad-revive testing.

---

## Needs Ginge decision

**One binary:** confirm Phase 7 squad revival is still on. If yes, all 106 dormant-agent prompts stay as-is until revival. If the squad direction changes, the bulk of the library may need rewriting.

(Recommendation per memory: Phase 7 squad revival is on. Keep all 106 untouched.)

---

## M5 actions taken on prompts

**None applied.** No deletes warranted, no obvious refactors. Library curation complete: `apex:prompts:v2` is canonical, current, and clean of legacy-store rot.
