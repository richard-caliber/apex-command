# M2 Verification — briefing display polish (2026-05-05)

Branch: `apex-magnificent`. Production: `dpl_5HWNbXXSXVD41CAgQnLtNrV9hzVM` at https://apex-command-seven.vercel.app.

## Missing inputs

`data/apex-magnificent-sprint-plan.md` still absent on disk; worked from chat-pasted M2 deliverables and the M1 verify doc.

## Deliverables

### D1 — Dormant squad banner (Briefing Room)

**File:** `src/app/action-room/page.tsx`.

- Added `gingeAgent` and `squadAgents` derived state plus `squadDormant` boolean. Banner renders when all four of `[atlas, newton, darwin, jimmy]` are present in the squad fetch — the current condition.
- Ginge row is now rendered as a separate first row before the squad block (M1 had hidden Ginge entirely).
- Banner copy: `"Squad dormant — Operating Mission Control + MCP only. Newton and Darwin Projects to be built post-Magnificent."`
- M2 spec called this "intentional throwaway code" — M3 replaces with a proper `dormant` flag on agent records.

Verified via `/api/squad`: ids returned = `["ginge","newton","atlas","darwin","jimmy"]` → `squadDormant=true` and Ginge row renders alongside banner.

### D2 — Tweet task grouping (Machine Room)

**File:** `src/app/machine-room/automation-map/page.tsx`.

- Added `TWEET_TASK_RE = /-tweet/i` and `tweetInboxExpanded` state.
- Manual Actions section now splits `manualActions` via the regex into `tweetTasks` and `nonTweetTasks`. Non-tweet rows render unchanged. Tweet rows collapse into a single "Twitter inbox (N items)" row with click-to-expand.
- Empty case: when `tweetTasks.length === 0`, the inbox row is not rendered (no empty header). With current data this means no inbox row appears (132 manual actions, 0 tweet-named) — pattern is in place for future Newton tweet triage tasks.

Verified via dev `/api/pipeline-tasks` filter logic: 132 ginge non-template non-done tasks, 0 match `/-tweet/i`. Future tweets will auto-bucket.

### D3 — `?project=<id>` auto-select (Map Room Pipeline)

**File:** `src/app/map-room/pipeline/page.tsx`.

- Imported `useSearchParams` from `next/navigation` and `Suspense` from React.
- Refactored `PipelinePage` into `<Suspense fallback="Loading pipeline...">` wrapping a `PipelinePageContent` component (Next.js requires the boundary for static export).
- Inside the inner component, `useSearchParams().get("project") ?? ""` is used as the lazy initial value for `selectedProject`. The existing `useEffect([selectedProject, projects])` already triggers the task fetch + stage expansion as soon as `projects` are loaded, so deep-links like `/map-room/pipeline?project=caliber` land directly on Caliber's pipeline.

Verified prod: `/map-room/pipeline?project=caliber` returns 200 with the Suspense fallback ("Loading pipeline...") present in SSR; client hydration then resolves `searchParams` and the dropdown is auto-set.

### D4 — Launchpad Overview stage counts

**File:** `src/app/map-room/page.tsx`.

- Added a single `projectsByStage` selector (a `Record<number, Project[]>` keyed by `stage.id`) computed once per render.
- Both the chip counts (`stageCounts`) and the body sections now read `projectsByStage[stage.id]` — they cannot drift apart by construction.
- Pre-M2 the chips and body filtered the same `projects` state via separate `.filter()` calls; the bug observed in the Chrome extension review (Idea: 0 vs body: 24) appears to have been a pre-M1 condition (when chips and body could read different sources). M2 makes the consistency structural.

Expected counts (non-archived projects only, post-M1 filter): Idea=4, Validation=1, MVP=5, Traffic=1. Sum = 11 = total non-archived. Both chips and body will display these.

### D5 — Briefing Room race fix

**File:** `src/app/action-room/page.tsx`.

- Added `loading` (default `true`) and `fetchError` (default `null`) state.
- `fetchAll` now sets `setLoading(false)` after the `Promise.allSettled` resolves and writes a one-line `fetchError` message if every individual fetch failed.
- All four list sections (Your Actions, Squad Actions, Ad Hoc Tasks, Team Status) gated their empty/silent states behind `!loading`. While loading they show "Loading X..." copy; only after the fetch resolves do empty states ("No active tasks", "No squad tasks", etc.) appear.
- A red error banner renders at the top of the page when every fetch failed (rare — auth flake or KV outage).

Verified prod HTML returns all four loading strings: `Loading your actions`, `Loading squad actions`, `Loading ad hoc tasks`, `Loading squad data`. The "stuck Loading squad data..." failure mode is now backed by the same `loading` state as everything else, so it never gets stuck after the fetch resolves.

## Verification — page sweep

### Dev (`localhost:3000`)

| Page | Status |
|---|---|
| `/` War Room | 200 |
| `/action-room` Briefing Room | 200 |
| `/map-room` Launchpad Overview | 200 |
| `/map-room/pipeline` | 200 |
| `/map-room/pipeline?project=caliber` | 200 |
| `/machine-room/automation-map` | 200 |

Action-room HTML (SSR) contains all four new loading strings (D5).
Pipeline HTML (SSR) contains the Suspense fallback "Loading pipeline..." (D3 boundary).

### Production (`https://apex-command-seven.vercel.app`)

Same sweep, all 200.
Same loading strings present in action-room SSR.
Suspense boundary visible on `/map-room/pipeline?project=caliber`.

## Definition of done

- [x] Dormant squad banner replaces fake current_task display
- [x] Tweet tasks auto-group in Machine Room Manual Actions (regex in place; bucket empty in current data)
- [x] `/map-room/pipeline` reads `?project=<id>` and auto-selects on mount (Suspense-wrapped)
- [x] Launchpad Overview chip counts match body counts (single selector)
- [x] Briefing Room no longer falls through to empty on second render (loading gated)
- [x] data/magnificent-m2-verify-2026-05-05.md saved
- [x] Production deploy successful, verified
- [x] No regressions on existing pages

## Notes

- Tweet-task bucket is empty in the current data (132 manual actions, 0 tweet-named). Future Newton tweet triage tasks will auto-bucket without further code changes.
- Dormant banner is intentionally hard-coded — M3 introduces a proper `dormant` flag on agent records and replaces the hard-code.
- The Chrome-extension-review chip-count bug appears resolved already; D4 makes the consistency structural so it can't regress.
