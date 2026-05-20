# Project Context Layer — Phase 2 Implementation Plan

Author: Claude. Date: 2026-05-20.
Built on Phase 1 recon (`data/project-context-phase1-recon-2026-05-20.md`) plus Ginge's directives:

- Build new `apex:project-context:v1`; leave `apex:project:{id}` alone.
- **Narrative-only fields**. No `timeline`, no `waitingOn`, no generic `notes` field — those concerns belong to the existing structural store.
- Single-envelope storage. Inline `meta.prior_version` (N=1). Don't expand either without proof.
- Bootstrap IDs confirmed at execute time. If Poker OS has no project record: flag and stop — do not auto-create.
- Tool descriptions for the four new tools — `apex_log_context` especially — drafted in this plan, for review before code ships.

---

## 1. Files to create / modify

**Create:**

| Path | Purpose |
|---|---|
| `src/lib/project-context.ts` | Reader + types + constants + the four storage helpers. Mirrors `src/lib/projects.ts` style. |
| `scripts/project-context-mcp-test.mjs` | End-to-end MCP test of the four new tools. Mirrors `scripts/phase4.1-mcp-test.mjs`. |
| `scripts/project-context-bootstrap.mjs` | One-shot bootstrap script. Reads KV, halts if Poker OS missing, writes 5 docs. |
| `data/project-context-phase1-recon-2026-05-20.md` | Already exists (recon report). |
| `data/project-context-phase2-plan-2026-05-20.md` | This file. |

**Modify:**

| Path | Change |
|---|---|
| `src/app/api/mcp/[transport]/route.ts` | Register four new tools. Extend `apex_get_briefing` registration to accept optional `project_id`. |
| `src/lib/briefing.ts` | Add three new sections: `top_project_context`, `context_compaction_due`, `stale_context_projects`. Add `getBriefingForProject(project_id?)` wrapper (uncached). Don't reshape `buildBriefing()`'s cache key. |
| `README.md` | Add `apex:project-context:v1` row to the canonical-KV-stores table. **Add explicit Phase 7/8 note: two per-project stores now exist (`apex:project:{id}` for structural, `apex:project-context:v1` for narrative); future consolidation must consume both.** |

That's it. No new dependencies. No new files in `src/components/` or `src/app/` (this phase ships MCP tools + briefing only; UI is out of scope per the spec).

---

## 2. Constants

Top of `src/lib/project-context.ts`, exported so the briefing and bootstrap script can reference the same numbers.

```ts
export const PROJECT_CONTEXT_KV_KEY = "apex:project-context:v1";

// Size & age thresholds — surfaced as compaction triggers in the briefing.
export const COMPACT_TRIGGER_BYTES = 2048;            // doc bytes (JSON.stringify length)
export const COMPACT_TRIGGER_DAYS_UNCOMPACTED = 7;    // days since last_compacted_at
export const COMPACT_TRIGGER_RECENT_DECISIONS = 10;   // entry count in recent_decisions
export const COMPACT_DECISION_ABSORB_DAYS = 30;       // decisions older than this are absorbed by compaction
export const SUNSET_SMELL_DAYS = 30;                  // no context update + open tasks → stale_context_projects

// Field limits (chars). All narrative; deliberately tight.
export const MAX_CURRENT_STATE_CHARS = 500;
export const MAX_HYPOTHESIS_CHARS = 500;
export const MAX_QUESTION_CHARS = 500;
export const MAX_STAKEHOLDER_NAME_CHARS = 100;
export const MAX_STAKEHOLDER_NOTE_CHARS = 500;
export const MAX_DECISION_CHARS = 500;
export const MAX_RATIONALE_CHARS = 500;
```

No magic numbers anywhere else.

---

## 3. Schema

### TypeScript interface (matches the spec exactly; narrative-only)

```ts
export interface ProjectContextDoc {
  meta: {
    project_id: string;
    last_updated_at: string;     // ISO
    last_compacted_at: string;   // ISO; equals last_updated_at on creation
    version: number;             // 1-indexed; increments on every write
    prior_version: ProjectContextDoc | null;  // N=1 inline rollback (no recursion in serialised form)
  };
  current_state: string;                       // ~500 char max — single paragraph
  active_hypotheses: string[];                 // each entry ≤500 chars
  open_questions: string[];                    // each entry ≤500 chars
  stakeholder_notes: Array<{
    name: string;                              // ≤100 chars
    note: string;                              // ≤500 chars
    updated_at: string;                        // ISO
  }>;
  recent_decisions: Array<{                    // append-only between compactions
    decision: string;                          // ≤500 chars
    rationale: string;                         // ≤500 chars
    logged_at: string;                         // ISO
  }>;
}

interface ProjectContextStore {
  docs: Record<string, ProjectContextDoc>;     // key = project_id
  lastUpdated: string;                          // ISO of the most recent write
}
```

### Notable constraints + how they're enforced

- **`meta.prior_version.prior_version` must be `null`** when serialised — otherwise we'd grow recursively. Enforced inside `setDoc()`: when writing version N, we deep-clone the current doc, set its `prior_version: null`, and stash it as `prior_version` on the new doc.
- **`recent_decisions` is append-only between compactions.** `apex_log_context` can push; `apex_set_project_context` (full overwrite) is the only path that removes. Documented in tool descriptions.
- **No `timeline` / `waitingOn` / `notes` fields.** Per Ginge's constraint. The shape is narrative-only.
- **`stakeholder_notes[].note` is narrative observation, not a generic `notes` blob.** It's structurally distinct from the `notes: string` field in `apex:project:{id}` (per-stakeholder + structured + timestamped vs. single free-form blob). This is the only field-name overlap with the existing store; the shape and intent differ. Calling it out so the constraint isn't read as "no overlap in word-substring".

### Zod validation

For inbound `apex_set_project_context` and `apex_log_context`, validation is split:

- Zod at the registration layer validates outer shape (project_id is a string, section is one of the four enums, etc.).
- Per-section payload validation happens in the handler (Zod discriminated unions on `section` are clumsy when the section field isn't inside the payload). Handler returns `isError: true` with the field name and limit on failure — matching the existing `Invalid stage: foo. Valid: ...` style.

---

## 4. Storage layer (`src/lib/project-context.ts`)

Exported helpers, all narrow and direct:

```ts
// Tolerant load — handles null, JSON string, bare empty, malformed envelope.
async function loadStore(): Promise<ProjectContextStore>;

// Reader: returns the doc or null.
export async function getProjectContext(project_id: string): Promise<ProjectContextDoc | null>;

// Append-only push for one section. Returns the updated doc.
// Creates a fresh doc with default fields if one doesn't exist yet.
export async function logContext(
  project_id: string,
  section: "active_hypotheses" | "open_questions" | "stakeholder_notes" | "recent_decisions",
  payload: unknown,                            // validated inside; throws if invalid
): Promise<ProjectContextDoc>;

// Full overwrite. Validates entire doc shape. Increments version. Stashes prior.
export async function setProjectContext(
  project_id: string,
  fullDoc: ProjectContextDoc,
): Promise<ProjectContextDoc>;

// Compute compaction triggers for one doc. Pure function.
export function compactionTriggers(doc: ProjectContextDoc, nowMs: number = Date.now()): {
  size_bytes: number;
  days_uncompacted: number;
  recent_decisions_count: number;
  triggered: boolean;
  reasons: string[];
};

// Heuristic compaction proposer. Pure function over the existing doc.
// Returns the proposed compacted doc + a diff summary. Does NOT save.
export function proposeCompaction(doc: ProjectContextDoc, nowMs: number = Date.now()): {
  proposed: ProjectContextDoc;
  diff: {
    absorbed_decisions: Array<{ decision: string; logged_at: string }>;
    current_state_before: string;
    current_state_after: string;
    superseded_hypotheses_candidates: string[];  // surfaced for human review; heuristic only
    stakeholder_notes_unchanged: number;
    stakeholder_notes_dropped_empty: number;
  };
};

// Briefing helpers — composed by buildBriefing() additions.
export async function getCompactionDueProjectIds(nowMs?: number): Promise<string[]>;
export async function getStaleContextProjectIds(
  projectsWithOpenTasks: string[],
  nowMs?: number,
): Promise<string[]>;
```

Two design choices to call out:

- **`logContext` creates-on-miss.** Calling `apex_log_context` against a project_id with no existing doc creates a fresh doc with empty arrays + `current_state: ""` + `meta.version: 1` and then appends. This removes one source of friction (no "the doc doesn't exist yet" guard for the caller). Compaction won't trigger on a brand-new doc by accident — all three thresholds are zero on day 1.
- **`proposeCompaction` is a pure function.** No LLM calls inside. Per Phase 1 recon item 10: the "use the LLM to judge supersession" line in the spec means the *calling Claude* judges supersession in-conversation. The tool returns heuristic candidates (any hypothesis logged before `last_compacted_at` is a candidate; any decision older than `COMPACT_DECISION_ABSORB_DAYS` is absorbed into current_state). Claude reviews with the user and calls `apex_set_project_context` with the agreed compacted doc. Confirm if you (Ginge) read this differently — flagging because the spec phrasing is slightly ambiguous.

### Storage invariants on every write

1. `meta.last_updated_at = now()`.
2. `meta.version = (existing?.version ?? 0) + 1`.
3. `meta.prior_version = deepClone(existing).withPriorVersionNulled()` — exactly one level deep.
4. Store envelope's `lastUpdated` also stamped.

---

## 5. Tool 1 — `apex_get_project_context(project_id)`

### Signature

```ts
inputSchema: {
  project_id: z.string().describe("Project id, e.g. caliber, atlas-drift, todd-safent"),
}
```

### Behaviour

- Reads the doc from `apex:project-context:v1.docs[project_id]`.
- Returns `null` (via `asText("No context for {id}", null)`) if not present — **not** an error. This is a normal pre-bootstrap state.
- Returns full doc including `meta.prior_version` so a fresh Claude can inspect rollback state without a second call.

### Tool description (draft)

> Returns the live narrative context document for a project from apex:project-context:v1 — current state, active hypotheses, open questions, stakeholder notes, and recent decisions. Returns null if no context doc exists for this project yet (call apex_log_context to create one by appending a first entry).
>
> This is the narrative layer: hypotheses, decisions, signals. For structural enrichment (milestones, waitingOn) see /api/project/[id]. For top-level project metadata see apex_get_project.

### No audit log entry

Read tool; no `appendAuditEvent`. Matches `apex_get_project`, `apex_get_practice` precedent.

---

## 6. Tool 2 — `apex_log_context(project_id, section, payload)` ← THE WORKHORSE

### Signature

```ts
inputSchema: {
  project_id: z.string().describe("Project id from apex:warroom:projects, e.g. caliber, atlas-drift, todd-safent"),
  section: z.enum([
    "active_hypotheses",
    "open_questions",
    "stakeholder_notes",
    "recent_decisions",
  ]).describe("Which section to append to. Determines the required payload shape."),
  payload: z.record(z.string(), z.string()).describe(
    "Shape depends on section: " +
    "active_hypotheses → { hypothesis }; " +
    "open_questions → { question }; " +
    "stakeholder_notes → { name, note }; " +
    "recent_decisions → { decision, rationale }."
  ),
}
```

Per-section payload validation inside the handler. Length caps from constants. Whitespace-only entries rejected. Returns `isError: true` with the offending field name and limit on failure.

### Behaviour

1. Validate `section` enum.
2. Validate payload shape for that section.
3. Load store; locate or create doc for `project_id` (create-on-miss with empty fields, version 1, `last_compacted_at = now`).
4. Append entry (each timestamped with `updated_at` or `logged_at` per shape).
5. Stash prior version (only one level — see invariants).
6. Bump version, stamp `last_updated_at`.
7. Save store.
8. `appendAuditEvent({ tool: "apex_log_context", input: { project_id, section, payload_chars }, resultSummary: "appended {section} entry to {project_id} (v{N})" })`.
9. Return `asText("Context updated for {project_id}", updatedDoc)`.

Target latency: <500ms. Two KV ops (get + set) on a small envelope, plus one audit append. Well inside budget. No LLM calls, no network beyond KV.

### Tool description (this is the one Ginge wants to read — please critique)

> Append a single narrative note to a project's live context document in apex:project-context:v1. Used to capture texture that would otherwise be lost between sessions — hypotheses being tested, unknowns blocking decisions, stakeholder signals, decisions taken with reasoning.
>
> One call, one note. No batching. No cross-topic summaries. Ceremony defeats the purpose; the layer only works if calls are cheap.
>
> `section` (required) and matching `payload` (required):
>
> - `active_hypotheses` → `{ hypothesis: string }` — what is currently being tested
> - `open_questions` → `{ question: string }` — an unknown that blocks a decision
> - `stakeholder_notes` → `{ name: string, note: string }` — a narrative observation about a specific person involved with this project
> - `recent_decisions` → `{ decision: string, rationale: string }` — a decision taken plus why
>
> Each entry is timestamped automatically. Append-only between compactions; to revise, supersede, or remove existing entries, use apex_compact_project_context (proposes a diff) then apex_set_project_context (commits the agreed compacted version). The doc is created on first call — no setup required.
>
> Target latency: under 500ms.
>
> **Trigger mid-conversation, not at the end.** When the user voices a hypothesis ("I think the reason X is happening is Y") → log to active_hypotheses. When an unknown blocks progress ("we don't actually know whether Z holds") → log to open_questions. When someone's behaviour is part of the picture ("Todd hasn't replied in three weeks") → log to stakeholder_notes. When a course of action is chosen ("right, let's go with option two because of A and B") → log to recent_decisions. Log first, finesse later — over-logging is cheap, lost narrative is not.

### Why this description is the test

- **First paragraph:** what the tool stores and why (narrative texture, persists between sessions).
- **Second paragraph:** the discipline (one call one note) and the warning (ceremony kills it).
- **Bullet list:** the four sections + their payload shapes + a one-sentence purpose per section. A fresh Claude reading this can map any in-conversation signal to a section without ambiguity.
- **Operational paragraph:** how revisions happen (the other two tools), create-on-miss behaviour, latency target.
- **Trigger paragraph:** four concrete user-utterance → tool-call mappings. This is the section that matters most. If a fresh Claude reads "the user just said 'I think the problem is people don't trust crypto checkout'" and does not fire `apex_log_context` with section=active_hypotheses, the description has failed.

If you (Ginge) read this description cold and think "I'd still need to coach Claude to use this", point at the specific gap and I'll tighten before code ships.

---

## 7. Tool 3 — `apex_set_project_context(project_id, full_doc)`

### Signature

```ts
inputSchema: {
  project_id: z.string().describe("Project id; doc will be stored at apex:project-context:v1.docs[project_id]"),
  full_doc: z.object({
    current_state: z.string(),
    active_hypotheses: z.array(z.string()),
    open_questions: z.array(z.string()),
    stakeholder_notes: z.array(z.object({
      name: z.string(),
      note: z.string(),
      updated_at: z.string().optional(),
    })),
    recent_decisions: z.array(z.object({
      decision: z.string(),
      rationale: z.string(),
      logged_at: z.string().optional(),
    })),
  }).describe("Full doc body (without meta). Meta is computed server-side."),
}
```

Caller does not supply `meta` — it's computed server-side: `last_updated_at = now`, `last_compacted_at = now` (since a full overwrite is the result of a compaction or bootstrap), `version = existing.version + 1`, `prior_version = existing (with its own prior_version nulled)`.

### Behaviour

1. Per-field length validation (uses the constants above). Reject on first failure with `isError: true` and the specific field/limit.
2. Load store; capture existing doc (may be null on bootstrap path).
3. Build new doc: caller-supplied body + computed meta. Fill missing `updated_at` / `logged_at` on entries with `now`.
4. Save store.
5. `appendAuditEvent({ tool: "apex_set_project_context", input: { project_id, body_bytes: JSON.stringify(full_doc).length }, resultSummary: "overwrote context for {project_id} (v{N-1} → v{N})" })`.
6. Return `asText("Context for {project_id} saved (v{N})", newDoc)`.

### Tool description (draft)

> Overwrite a project's full context document in apex:project-context:v1. The previous version is stashed inline at meta.prior_version (one level of rollback). Used by compaction (after apex_compact_project_context proposes a diff and Claude + user agree the new shape) and by bootstrap. Increments meta.version and stamps last_compacted_at = now.
>
> For routine note-taking, use apex_log_context — it's append-only, faster, and doesn't bump the compaction timer. Use this tool only when you are deliberately rewriting the whole doc.

---

## 8. Tool 4 — `apex_compact_project_context(project_id)`

### Signature

```ts
inputSchema: {
  project_id: z.string().describe("Project id whose context doc should be compacted"),
}
```

### Behaviour

1. Load doc; error if not present.
2. Call `proposeCompaction(doc)` (pure function in the lib).
3. Heuristic:
   - **Decisions older than `COMPACT_DECISION_ABSORB_DAYS` (30):** drop from `recent_decisions`, absorb into `current_state` as a one-line summary appended at the end ("Earlier: {decision}.") — capped at the current_state limit by truncation with `…`.
   - **Hypotheses older than `last_compacted_at`** are surfaced as `superseded_hypotheses_candidates` in the diff — NOT removed. Claude decides which actually are superseded, then calls `apex_set_project_context` with the agreed pruned list.
   - **Stakeholder notes:** drop entries where `note` is whitespace-only or where `name` and exact `note` content appear duplicated, oldest dropped. The diff reports counts.
   - **current_state:** absorbs absorbed-decision summaries; otherwise unchanged.
4. Return `asText("Compaction proposal for {project_id} (NOT SAVED — review then call apex_set_project_context)", { proposed, diff })`.

No `appendAuditEvent` — this is a read-shaped operation that produces a proposal, not a write. The audit entry happens when (and if) Claude calls `apex_set_project_context` with the compacted body.

### Tool description (draft)

> Propose a compacted version of a project's context document, without saving. Returns the proposed doc plus a diff summary: which decisions were absorbed into current_state, which hypotheses are candidates for supersession (Claude/user must judge), how many stakeholder notes were dropped as duplicates/empty.
>
> Heuristic only — this tool absorbs decisions older than 30 days and surfaces stale hypotheses for review. It does NOT decide what is superseded. After reviewing the proposal with the user, commit by calling apex_set_project_context with the agreed body (typically with some of the surfaced candidates pruned from active_hypotheses).
>
> Errors if no context doc exists for the project_id.

---

## 9. Briefing integration (`src/lib/briefing.ts`)

### What changes

Add three new optional fields to the `Briefing` interface and the composed return:

```ts
export interface Briefing {
  // ...existing 8 sections...
  top_project_context: ProjectContextDoc | null;        // null if no top project or no context doc
  context_compaction_due: Array<{
    project_id: string;
    reasons: string[];                                  // from compactionTriggers()
  }>;
  stale_context_projects: Array<{
    project_id: string;
    days_since_context_update: number;
    open_task_count: number;
  }>;
}
```

### Where the values come from

- **`top_project_context`:** after computing `active_ventures`, take `active_ventures[0]?.id`. Read the context doc via `getProjectContext()`. Return null if either is missing.
- **`context_compaction_due`:** load `apex:project-context:v1`, iterate `docs`, run `compactionTriggers()` per doc, include each `{ project_id, reasons }` whose `triggered === true`.
- **`stale_context_projects`:** for each project with `open_task_count > 0` (from existing computation), check whether its context doc has `last_updated_at` older than `SUNSET_SMELL_DAYS`. Surface up to 10, oldest first.

### Cache key impact

`buildBriefing()` keeps its 30s cache. Three new fields are computed inside the cached function. No new cache invalidation needed — the 30s window is acceptable.

### Optional `project_id` parameter

Two implementation choices, picking option B:

- **A.** Parameterise the cache key by project_id. Worst case: N cache entries.
- **B (chosen).** Keep `buildBriefing()` parameterless and cached. Add a thin uncached wrapper `getBriefingForProject(project_id?: string)`:
  - If no `project_id`, return the cached briefing as-is.
  - If `project_id` supplied, return the cached briefing with `top_project_context` swapped to that project's doc (one extra `kv.get`).

The `apex_get_briefing` tool registration becomes:

```ts
inputSchema: {
  project_id: z.string().optional().describe(
    "If set, swaps top_project_context to this project's doc (read-through, uncached). Default: top of active_ventures."
  ),
}
```

### Updated `apex_get_briefing` tool description

Current description claims "8 sections". After this change it returns 11. New draft:

> Composite read of Apex state for daily decision-making. Returns 11 sections: this_week_frontline (top 5 actionable tasks across tiered ventures), active_ventures (status=active and tiered, ordered by tier then order), blocked_external (status=blocked with parsed waiting_on), meta_work (tag=meta), paused_summary (paused/archived/creative counts), stale_tasks (top 10 untouched >30 days), dormant_agent_warnings (orphan-task count, excluding newton/darwin Project surfaces), agents (squad status), top_project_context (live narrative doc for the top-priority active venture), context_compaction_due (project_ids with size/age/decision-count over thresholds), stale_context_projects (projects with open tasks but no context update in 30+ days). Cached 30s; the optional project_id parameter swaps top_project_context to a specific project (uncached read-through).

---

## 10. Test plan — `scripts/project-context-mcp-test.mjs`

Mirrors `scripts/phase4.1-mcp-test.mjs` exactly. Walks: OAuth → tools/list (expect 21, was 17) → exercise each new tool → regression on adjacent tools → audit confirms events landed.

### Test cases

1. **tools/list confirms 4 new tools present**, with the expected titles and required-fields lists.
2. **apex_get_project_context on a never-touched project_id** → returns null payload, no isError.
3. **apex_log_context — active_hypotheses, happy path** → creates doc, returns updated doc with version=1, one hypothesis entry, all four sections present.
4. **apex_log_context — open_questions, append to existing** → version=2, hypothesis still there, one new question.
5. **apex_log_context — stakeholder_notes** → version=3, note has `name`, `note`, `updated_at`.
6. **apex_log_context — recent_decisions** → version=4, decision has `decision`, `rationale`, `logged_at`.
7. **apex_log_context — invalid section "foo"** → isError, message names the section enum.
8. **apex_log_context — payload missing required field** (e.g. stakeholder_notes without `name`) → isError, names the field.
9. **apex_log_context — payload over length cap** (e.g. 600-char hypothesis) → isError, names the limit.
10. **apex_log_context — whitespace-only payload** → isError.
11. **apex_get_project_context after logs** → returns full doc with version=4 and all four sections populated.
12. **apex_compact_project_context — happy path on the seeded doc** → returns `{ proposed, diff }`; nothing saved (verified by a re-fetch).
13. **apex_compact_project_context — missing project_id** → isError.
14. **apex_set_project_context — happy path** → version bumps, `meta.prior_version.version === N-1`, prior's `prior_version === null` (no recursion).
15. **apex_set_project_context — over-length field** → isError.
16. **Briefing regression: apex_get_briefing** → response now contains `top_project_context`, `context_compaction_due`, `stale_context_projects` keys.
17. **Briefing with project_id param** → `top_project_context.meta.project_id === requested id`.
18. **apex_get_audit** → contains entries for `apex_log_context` and `apex_set_project_context`. No entries for `apex_get_project_context` or `apex_compact_project_context` (read-shaped).
19. **Regression sanity** → `apex_list_projects` and `apex_get_practice` still work.

### Output

Transcript written to `data/project-context-mcp-{LABEL}-{ISO-date}.txt`, exactly matching the Phase 4.1 script's output convention. Local + prod runs.

### Cleanup

Test project_id is `phase-pctx-test-{Date.now().toString(36)}`. End of script deletes the test doc by calling `apex_set_project_context` with `{ current_state: "", active_hypotheses: [], open_questions: [], stakeholder_notes: [], recent_decisions: [] }` and then mutating the envelope to remove it. (No `apex_delete_project_context` tool — out of scope.) Acceptable to leave a small residual envelope entry; the test transcript flags it for manual cleanup if it accumulates.

---

## 11. Bootstrap plan — `scripts/project-context-bootstrap.mjs`

### Pre-flight (this is where Poker OS gets surfaced)

1. Load `apex:warroom:projects` directly via KV.
2. Resolve the five expected venture names to project IDs by case-insensitive name match. Expected names:
   - "Todd-Safent" (or "Todd Safent", "Todd-Saifent" — the briefing's `WAITING_ON_OVERRIDES` has both spellings)
   - "Caliber Peptides"
   - "Atlas Drift"
   - "Rawai Villas" (possibly `villas` → "Phuket Villas" — flag if name doesn't match exactly)
   - "Poker OS"
3. **If any of the five expected names does not resolve to an existing project record: STOP. Print which is missing, exit non-zero.** No auto-create. You (Ginge) then decide.

### Bootstrap content

For each of the five projects that did resolve, write an initial context doc via `apex_set_project_context`. Content sourced from:

- The MEMORY.md notes already loaded into this session (project-specific entries for caliber, atlas-drift, todd-safent, etc.).
- The project's `description` and `blocker` fields from `apex:warroom:projects`.
- Recent events from `apex:events:v1` (last 10 per project) — gives `current_state` and `recent_decisions` real texture.

Each bootstrapped doc will have:

- `current_state`: one paragraph synthesising what's true today for this venture (~300-500 chars). NOT a copy of `description`.
- `active_hypotheses`: 2-3 entries. Examples from memory: for GemSnap, "Conversion is broken because the paywall appears before the user sees value"; for Caliber, "First sale will come from network outreach, not paid traffic".
- `open_questions`: 1-3 entries. What blocks the next decision.
- `stakeholder_notes`: 0-2 entries. Only where there's a real signal in memory (Todd on Edge Auto, etc.).
- `recent_decisions`: 0-3 entries from the project's `apex:events:v1` decisions.

**Bootstrap is run once, after the four tools are live and tested.** Output is a JSON log to `data/project-context-bootstrap-{ISO-date}.json` listing which projects were bootstrapped, byte sizes, and which were skipped/missing.

### Halt-condition for Poker OS

If `Poker OS` (or whatever the canonical name turns out to be) does not exist as a project record:

```
[bootstrap] Project not found: "Poker OS" (searched apex:warroom:projects by name, case-insensitive)
[bootstrap] Bootstrapped: 4 / 5
[bootstrap] Halted before remaining: none
[bootstrap] Action required: decide whether to seed Poker OS as a project (via apex_set_project) or skip it. Re-run this script after.
exit 1
```

Bootstrap continues for the other four. The exit code is non-zero to surface the issue.

---

## 12. Rollback story

If something goes wrong mid-ship:

| Failure mode | Recovery |
|---|---|
| New tool throws on every call | Comment out the four `server.registerTool` blocks for the new tools. Redeploy. Read tools and bootstrap docs are now orphaned in KV but cause no harm (nothing reads them yet). |
| Bad doc written by `apex_set_project_context` | The same tool stashes `meta.prior_version` on every write. To roll back: read the doc, call `apex_set_project_context` again with the prior version's body. Loses N≥2 history (we only keep one prior), so two consecutive bad writes is recoverable to the second-to-last state only. |
| `apex_log_context` corrupts a doc with bad merge logic | Worst case, the affected project gets `apex_set_project_context` called with a known-good rebuilt body (manually composed). Cap on damage: one project's narrative gone. |
| Briefing changes break the cached briefing | The new briefing fields are additive; rolling back `src/lib/briefing.ts` removes them. No data loss; the cache key (`apex-briefing-v1`) stays valid. Vercel deployment-protection-aware: revert PR + redeploy. |
| KV write storms during bootstrap | Bootstrap script is idempotent (uses `apex_set_project_context` which is overwrite). Re-runs safely. Inline `prior_version` means each re-run does cost one rollback slot. |
| Compaction tools mis-judge supersession | Compaction never auto-saves. The proposal is reviewed in-conversation before `apex_set_project_context` commits. Bad proposals are ignored. |

No KV migrations to undo. The new collection is brand new — deletion via `kv.del("apex:project-context:v1")` returns the system to pre-ship state. Existing collections are untouched.

---

## 13. Commit chunks

Each chunk gets its own commit + a test pass before the next starts. After each chunk, one line of progress in chat.

1. **Schema + storage layer.** `src/lib/project-context.ts` (types, constants, helpers). No tools yet. No tests yet (lib is pure; tested via the tools).
2. **`apex_get_project_context` (read).** Registered. Test script seeded for tools/list expectation.
3. **`apex_log_context` (write — the workhorse).** Registered, validation, audit. Test cases 3-11 above pass.
4. **`apex_set_project_context` (overwrite).** Registered, validation, prior-version stash. Test cases 14-15 pass.
5. **`apex_compact_project_context` (proposal).** Registered, heuristic logic. Test cases 12-13 pass.
6. **Briefing integration.** Three new sections + optional `project_id` parameter + updated description. Test cases 16-17 pass.
7. **Bootstrap.** `scripts/project-context-bootstrap.mjs` ships. Halts on Poker OS missing. Five projects bootstrapped or four + flagged.
8. **README update + Phase 7/8 note.** New KV-stores row. Explicit note: two per-project stores (`apex:project:{id}` structural + `apex:project-context:v1` narrative) — future consolidation must consume both.

---

## 14. Spec compliance check

Against the original prompt's "Definition of done":

- [ ] All four tools live on the MCP and callable → covered chunks 2-5.
- [ ] `apex:project-context:v1` collection exists and is versioned → chunk 1 (storage layer with `meta.version` + `meta.prior_version`).
- [ ] `apex_get_briefing` surfaces project context for the top-priority project automatically → chunk 6 (`top_project_context`).
- [ ] Five active ventures have bootstrapped context docs — minimum viable, not blank stubs → chunk 7 (with Poker OS halt-flag if missing).
- [ ] Compaction demonstrated end-to-end on at least one project (propose → review → save) → chunk 5 test case 12 (propose), chunk 4 test case 14 (commit).
- [ ] Tests pass → end-to-end script in `scripts/`, run local + prod.
- [ ] Reconnaissance report, implementation plan, post-ship summary in PR description → recon = `data/project-context-phase1-recon-2026-05-20.md` (this file is the plan). Post-ship summary written after chunk 8.

Against the "Constraints and quality bar":

- British English in user-facing strings → tool descriptions and error messages will use British. (Code identifiers stay US-neutral; that's normal practice in this codebase.)
- No silent failures → every error path returns `isError: true` with a specific message.
- No magic numbers → constants module at top of `src/lib/project-context.ts`.
- Tool descriptions precise → `apex_log_context` drafted above for review; same standard for the other three.
- Audit logging → every write tool ends with `appendAuditEvent`.
- No new dependencies → confirmed; uses only `@vercel/kv`, `zod`, `mcp-handler`.
- No over-engineering → no shared "framework", four direct tool implementations, pure functions for compaction proposal.

---

## 15. Phase 7/8 note (per Ginge's directive)

For the future consolidation effort, the per-project state of an Apex project is now scattered across:

| Store | Concerns | Reader | Writers |
|---|---|---|---|
| `apex:warroom:projects` (envelope) | Canonical metadata: id, name, stage, status, tier, blocker, owner, score, image, url, tags | `src/lib/projects.ts` | `/api/projects` POST, MCP `apex_set_project`, `apex_archive_project` |
| `apex:project:{id}` (per-id keys) | Structural enrichment: tasks (duplicated), timeline milestones, waitingOn, notes (free-form blob) | `/api/project/[id]` route | `/api/project/[id]` PUT |
| `apex:project-context:v1` (envelope) | Narrative: current_state, active_hypotheses, open_questions, stakeholder_notes, recent_decisions | `src/lib/project-context.ts` (new) | MCP `apex_log_context`, `apex_set_project_context` |

Phase 7/8 consolidation needs to consume all three. Specifically:

- `apex:project:{id}.tasks` is already duplicate with `apex:pipeline-tasks` — the Magnificent retro flagged this. Drop on migration.
- `apex:project:{id}.timeline` and `.waitingOn` are useful and not duplicated — keep, fold into canonical.
- `apex:project:{id}.notes` (free-form blob) is the one ambiguous case. May merge into `apex:project-context:v1.current_state` or be dropped as anachronism. Decide then.
- `apex:project-context:v1.stakeholder_notes` is per-stakeholder structured narrative — not the same as `apex:project:{id}.notes`. Keep distinct shape on migration.

This is not work for this phase. Logging it so the next person migrating doesn't conflate the two.

---

## 16. Open questions for Ginge

Two only. Neither blocks me starting Phase 3 — I'll proceed with my proposed answers if you don't push back.

1. **"Use the LLM to judge supersession"** in the spec — my read is that `apex_compact_project_context` is a pure heuristic tool that surfaces candidates, and the calling Claude judges in-conversation. The tool does not call an LLM. Confirm or correct.
2. **Rawai Villas mapping.** The existing project ID is `villas` with name "Phuket Villas" — not "Rawai Villas". My plan: case-insensitive substring match on "villas" finds it. If you want me to halt-and-flag on the exact-name mismatch the way I would for Poker OS, say so. (My read: not the same as the Poker OS case — there's clearly a project there, just named differently. Bootstrap will write to `villas` and note the name divergence in the log.)

If both answers stand, I'm ready to execute Phase 3 as soon as you confirm the `apex_log_context` description reads well enough that a fresh Claude would fire it without coaching.
