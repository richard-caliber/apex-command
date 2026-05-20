import { kv } from "@vercel/kv";

/**
 * Project Context layer — apex:project-context:v1.
 *
 * Per-project narrative state: current_state, active_hypotheses, open_questions,
 * stakeholder_notes, recent_decisions. Captures texture that would otherwise
 * evaporate between sessions.
 *
 * Adjacent stores (do NOT duplicate fields here):
 *  - apex:warroom:projects — canonical metadata (id, name, stage, status, tier, ...)
 *  - apex:project:{id}     — per-project structural enrichment (timeline, waitingOn,
 *                            free-form notes). Separate concern; left untouched.
 *
 * Storage shape (single envelope, mirrors practices/projects/tasks pattern):
 *   apex:project-context:v1 → { docs: { [project_id]: ProjectContextDoc }, lastUpdated }
 *
 * Versioning: every write increments meta.version and stashes the prior doc
 * inline at meta.prior_version. N=1 rollback. The stashed prior has its own
 * prior_version nulled to prevent recursive growth.
 */

// ─────────────────────────── constants ───────────────────────────

export const PROJECT_CONTEXT_KV_KEY = "apex:project-context:v1";

// Compaction triggers — surfaced in the briefing.
export const COMPACT_TRIGGER_BYTES = 2048;
export const COMPACT_TRIGGER_DAYS_UNCOMPACTED = 7;
export const COMPACT_TRIGGER_RECENT_DECISIONS = 10;

// Compaction heuristics.
export const COMPACT_DECISION_ABSORB_DAYS = 30;

// Sunset smell — projects with open tasks + no context update in this window.
export const SUNSET_SMELL_DAYS = 30;

// Field length limits (chars). Narrative entries deliberately tight.
export const MAX_CURRENT_STATE_CHARS = 500;
export const MAX_HYPOTHESIS_CHARS = 500;
export const MAX_QUESTION_CHARS = 500;
export const MAX_STAKEHOLDER_NAME_CHARS = 100;
export const MAX_STAKEHOLDER_NOTE_CHARS = 500;
export const MAX_DECISION_CHARS = 500;
export const MAX_RATIONALE_CHARS = 500;

const DAY_MS = 86_400_000;

// ─────────────────────────── types ───────────────────────────

export interface StakeholderNote {
  name: string;
  note: string;
  updated_at: string;
}

export interface RecentDecision {
  decision: string;
  rationale: string;
  logged_at: string;
}

export interface ProjectContextMeta {
  project_id: string;
  last_updated_at: string;
  last_compacted_at: string;
  version: number;
  prior_version: ProjectContextDoc | null;
}

export interface ProjectContextDoc {
  meta: ProjectContextMeta;
  current_state: string;
  active_hypotheses: string[];
  open_questions: string[];
  stakeholder_notes: StakeholderNote[];
  recent_decisions: RecentDecision[];
}

export type LogSection =
  | "active_hypotheses"
  | "open_questions"
  | "stakeholder_notes"
  | "recent_decisions";

interface ProjectContextStore {
  docs: Record<string, ProjectContextDoc>;
  lastUpdated: string;
}

// ─────────────────────────── store I/O ───────────────────────────

async function loadStore(): Promise<ProjectContextStore> {
  const raw = await kv.get<ProjectContextStore | string>(PROJECT_CONTEXT_KV_KEY);
  if (raw === null || raw === undefined) {
    return { docs: {}, lastUpdated: new Date().toISOString() };
  }
  let parsed: ProjectContextStore;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as ProjectContextStore;
    } catch (e) {
      throw new Error(
        `Failed to parse ${PROJECT_CONTEXT_KV_KEY} as JSON: ${(e as Error).message}`,
      );
    }
  } else {
    parsed = raw;
  }
  if (!parsed || typeof parsed !== "object" || !parsed.docs || typeof parsed.docs !== "object") {
    return { docs: {}, lastUpdated: parsed?.lastUpdated ?? new Date().toISOString() };
  }
  return parsed;
}

async function saveStore(store: ProjectContextStore): Promise<void> {
  store.lastUpdated = new Date().toISOString();
  await kv.set(PROJECT_CONTEXT_KV_KEY, store);
}

// ─────────────────────────── helpers ───────────────────────────

function emptyDoc(project_id: string, now: string): ProjectContextDoc {
  return {
    meta: {
      project_id,
      last_updated_at: now,
      last_compacted_at: now,
      version: 1,
      prior_version: null,
    },
    current_state: "",
    active_hypotheses: [],
    open_questions: [],
    stakeholder_notes: [],
    recent_decisions: [],
  };
}

function deepCloneWithPriorNulled(doc: ProjectContextDoc): ProjectContextDoc {
  // JSON round-trip is sufficient — fields are plain JSON. Then null prior_version
  // so the stashed copy never carries history-of-history.
  const cloned = JSON.parse(JSON.stringify(doc)) as ProjectContextDoc;
  cloned.meta.prior_version = null;
  return cloned;
}

function bumpVersion(
  prev: ProjectContextDoc | null,
  next: ProjectContextDoc,
  now: string,
  opts: { stampCompacted?: boolean } = {},
): ProjectContextDoc {
  next.meta.last_updated_at = now;
  next.meta.version = (prev?.meta.version ?? 0) + 1;
  next.meta.prior_version = prev ? deepCloneWithPriorNulled(prev) : null;
  if (opts.stampCompacted) {
    next.meta.last_compacted_at = now;
  } else if (prev) {
    next.meta.last_compacted_at = prev.meta.last_compacted_at;
  }
  return next;
}

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`Field ${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`Field ${field} must not be empty or whitespace-only`);
  }
  return trimmed;
}

function assertMaxLen(value: string, field: string, max: number): string {
  if (value.length > max) {
    throw new ValidationError(`Field ${field} exceeds ${max}-char limit (was ${value.length})`);
  }
  return value;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─────────────────────────── reads ───────────────────────────

export async function getProjectContext(project_id: string): Promise<ProjectContextDoc | null> {
  if (!project_id) return null;
  const store = await loadStore();
  return store.docs[project_id] ?? null;
}

export async function getAllContextDocs(): Promise<ProjectContextDoc[]> {
  const store = await loadStore();
  return Object.values(store.docs);
}

// ─────────────────────────── writes ───────────────────────────

/**
 * Append-only push for one section. Creates the doc if missing.
 * Throws ValidationError on bad payload — caller maps to isError response.
 */
export async function logContext(
  project_id: string,
  section: LogSection,
  payload: unknown,
): Promise<ProjectContextDoc> {
  if (!project_id || typeof project_id !== "string") {
    throw new ValidationError("project_id is required");
  }
  const store = await loadStore();
  const now = new Date().toISOString();
  const existing = store.docs[project_id] ?? null;
  const working = existing
    ? (JSON.parse(JSON.stringify(existing)) as ProjectContextDoc)
    : emptyDoc(project_id, now);

  const p = (payload ?? {}) as Record<string, unknown>;

  switch (section) {
    case "active_hypotheses": {
      const hypothesis = assertMaxLen(
        assertNonEmpty(p.hypothesis, "payload.hypothesis"),
        "payload.hypothesis",
        MAX_HYPOTHESIS_CHARS,
      );
      working.active_hypotheses.push(hypothesis);
      break;
    }
    case "open_questions": {
      const question = assertMaxLen(
        assertNonEmpty(p.question, "payload.question"),
        "payload.question",
        MAX_QUESTION_CHARS,
      );
      working.open_questions.push(question);
      break;
    }
    case "stakeholder_notes": {
      const name = assertMaxLen(
        assertNonEmpty(p.name, "payload.name"),
        "payload.name",
        MAX_STAKEHOLDER_NAME_CHARS,
      );
      const note = assertMaxLen(
        assertNonEmpty(p.note, "payload.note"),
        "payload.note",
        MAX_STAKEHOLDER_NOTE_CHARS,
      );
      working.stakeholder_notes.push({ name, note, updated_at: now });
      break;
    }
    case "recent_decisions": {
      const decision = assertMaxLen(
        assertNonEmpty(p.decision, "payload.decision"),
        "payload.decision",
        MAX_DECISION_CHARS,
      );
      const rationale = assertMaxLen(
        assertNonEmpty(p.rationale, "payload.rationale"),
        "payload.rationale",
        MAX_RATIONALE_CHARS,
      );
      working.recent_decisions.push({ decision, rationale, logged_at: now });
      break;
    }
    default: {
      const _exhaustive: never = section;
      throw new ValidationError(`Unknown section: ${String(_exhaustive)}`);
    }
  }

  const updated = bumpVersion(existing, working, now);
  store.docs[project_id] = updated;
  await saveStore(store);
  return updated;
}

export interface SetProjectContextInput {
  current_state: string;
  active_hypotheses: string[];
  open_questions: string[];
  stakeholder_notes: Array<{ name: string; note: string; updated_at?: string }>;
  recent_decisions: Array<{ decision: string; rationale: string; logged_at?: string }>;
}

/**
 * Full overwrite. Validates every field against length caps. Stamps
 * last_compacted_at = now (since a full overwrite is the result of compaction
 * or bootstrap). Bumps version. Stashes prior.
 */
export async function setProjectContext(
  project_id: string,
  body: SetProjectContextInput,
): Promise<ProjectContextDoc> {
  if (!project_id || typeof project_id !== "string") {
    throw new ValidationError("project_id is required");
  }

  // current_state allowed to be empty (e.g. fresh bootstrap), but capped.
  if (typeof body.current_state !== "string") {
    throw new ValidationError("current_state must be a string");
  }
  assertMaxLen(body.current_state, "current_state", MAX_CURRENT_STATE_CHARS);

  if (!Array.isArray(body.active_hypotheses)) {
    throw new ValidationError("active_hypotheses must be an array");
  }
  const hypotheses = body.active_hypotheses.map((h, i) =>
    assertMaxLen(
      assertNonEmpty(h, `active_hypotheses[${i}]`),
      `active_hypotheses[${i}]`,
      MAX_HYPOTHESIS_CHARS,
    ),
  );

  if (!Array.isArray(body.open_questions)) {
    throw new ValidationError("open_questions must be an array");
  }
  const questions = body.open_questions.map((q, i) =>
    assertMaxLen(
      assertNonEmpty(q, `open_questions[${i}]`),
      `open_questions[${i}]`,
      MAX_QUESTION_CHARS,
    ),
  );

  if (!Array.isArray(body.stakeholder_notes)) {
    throw new ValidationError("stakeholder_notes must be an array");
  }
  const now = new Date().toISOString();
  const stakeholderNotes: StakeholderNote[] = body.stakeholder_notes.map((s, i) => {
    if (!s || typeof s !== "object") {
      throw new ValidationError(`stakeholder_notes[${i}] must be an object`);
    }
    const name = assertMaxLen(
      assertNonEmpty(s.name, `stakeholder_notes[${i}].name`),
      `stakeholder_notes[${i}].name`,
      MAX_STAKEHOLDER_NAME_CHARS,
    );
    const note = assertMaxLen(
      assertNonEmpty(s.note, `stakeholder_notes[${i}].note`),
      `stakeholder_notes[${i}].note`,
      MAX_STAKEHOLDER_NOTE_CHARS,
    );
    const updated_at = s.updated_at && typeof s.updated_at === "string" ? s.updated_at : now;
    return { name, note, updated_at };
  });

  if (!Array.isArray(body.recent_decisions)) {
    throw new ValidationError("recent_decisions must be an array");
  }
  const decisions: RecentDecision[] = body.recent_decisions.map((d, i) => {
    if (!d || typeof d !== "object") {
      throw new ValidationError(`recent_decisions[${i}] must be an object`);
    }
    const decision = assertMaxLen(
      assertNonEmpty(d.decision, `recent_decisions[${i}].decision`),
      `recent_decisions[${i}].decision`,
      MAX_DECISION_CHARS,
    );
    const rationale = assertMaxLen(
      assertNonEmpty(d.rationale, `recent_decisions[${i}].rationale`),
      `recent_decisions[${i}].rationale`,
      MAX_RATIONALE_CHARS,
    );
    const logged_at = d.logged_at && typeof d.logged_at === "string" ? d.logged_at : now;
    return { decision, rationale, logged_at };
  });

  const store = await loadStore();
  const existing = store.docs[project_id] ?? null;

  const next: ProjectContextDoc = {
    meta: {
      project_id,
      last_updated_at: now,
      last_compacted_at: now,
      version: 1,
      prior_version: null,
    },
    current_state: body.current_state,
    active_hypotheses: hypotheses,
    open_questions: questions,
    stakeholder_notes: stakeholderNotes,
    recent_decisions: decisions,
  };

  const finalised = bumpVersion(existing, next, now, { stampCompacted: true });
  store.docs[project_id] = finalised;
  await saveStore(store);
  return finalised;
}

// ─────────────────────────── compaction (pure) ───────────────────────────

export interface CompactionTriggerResult {
  size_bytes: number;
  days_uncompacted: number;
  recent_decisions_count: number;
  triggered: boolean;
  reasons: string[];
}

export function compactionTriggers(
  doc: ProjectContextDoc,
  nowMs: number = Date.now(),
): CompactionTriggerResult {
  const size_bytes = JSON.stringify(doc).length;
  const daysSinceCompacted =
    (nowMs - new Date(doc.meta.last_compacted_at).getTime()) / DAY_MS;
  const days_uncompacted = Math.floor(daysSinceCompacted);
  const recent_decisions_count = doc.recent_decisions.length;
  const reasons: string[] = [];
  if (size_bytes > COMPACT_TRIGGER_BYTES) {
    reasons.push(`size ${size_bytes}B > ${COMPACT_TRIGGER_BYTES}B`);
  }
  if (days_uncompacted > COMPACT_TRIGGER_DAYS_UNCOMPACTED) {
    reasons.push(`${days_uncompacted}d since last compaction (>${COMPACT_TRIGGER_DAYS_UNCOMPACTED})`);
  }
  if (recent_decisions_count > COMPACT_TRIGGER_RECENT_DECISIONS) {
    reasons.push(
      `${recent_decisions_count} recent decisions (>${COMPACT_TRIGGER_RECENT_DECISIONS})`,
    );
  }
  return {
    size_bytes,
    days_uncompacted,
    recent_decisions_count,
    triggered: reasons.length > 0,
    reasons,
  };
}

export interface CompactionProposal {
  proposed: ProjectContextDoc;
  diff: {
    absorbed_decisions: RecentDecision[];
    current_state_before: string;
    current_state_after: string;
    superseded_hypotheses_candidates: string[];
    stakeholder_notes_unchanged: number;
    stakeholder_notes_dropped_empty: number;
    triggers: CompactionTriggerResult;
  };
}

/**
 * Heuristic compaction proposer. PURE — no save, no LLM, no network.
 * Semantic judgement (which hypotheses are genuinely dead vs dormant, the
 * final current_state paragraph) is the calling Claude's job in-session.
 */
export function proposeCompaction(
  doc: ProjectContextDoc,
  nowMs: number = Date.now(),
): CompactionProposal {
  const cutoffMs = nowMs - COMPACT_DECISION_ABSORB_DAYS * DAY_MS;
  const compactedSinceMs = new Date(doc.meta.last_compacted_at).getTime();

  // Absorb old decisions: drop from recent_decisions, append a one-liner to current_state.
  const absorbed: RecentDecision[] = [];
  const keptDecisions: RecentDecision[] = [];
  for (const d of doc.recent_decisions) {
    const t = new Date(d.logged_at).getTime();
    if (Number.isFinite(t) && t < cutoffMs) {
      absorbed.push(d);
    } else {
      keptDecisions.push(d);
    }
  }

  let nextCurrentState = doc.current_state;
  if (absorbed.length > 0) {
    const trailers = absorbed.map((d) => `Earlier: ${d.decision}.`).join(" ");
    const combined = nextCurrentState
      ? `${nextCurrentState} ${trailers}`.trim()
      : trailers.trim();
    nextCurrentState =
      combined.length > MAX_CURRENT_STATE_CHARS
        ? combined.slice(0, MAX_CURRENT_STATE_CHARS - 1) + "…"
        : combined;
  }

  // Drop empty / whitespace-only stakeholder notes and exact dup (name+note),
  // keeping the most-recent occurrence.
  const seenStakeholderKeys = new Set<string>();
  const stakeholderKept: StakeholderNote[] = [];
  let droppedEmpty = 0;
  const sortedNotes = [...doc.stakeholder_notes].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );
  for (const s of sortedNotes) {
    const name = (s.name ?? "").trim();
    const note = (s.note ?? "").trim();
    if (!name || !note) {
      droppedEmpty += 1;
      continue;
    }
    const key = `${name}␟${note}`;
    if (seenStakeholderKeys.has(key)) {
      droppedEmpty += 1;
      continue;
    }
    seenStakeholderKeys.add(key);
    stakeholderKept.push(s);
  }
  stakeholderKept.reverse(); // restore oldest-first order

  // Surface stale hypotheses for the calling Claude to judge — do NOT drop.
  // Heuristic: hypotheses whose containing doc was last compacted >0 days ago
  // are all candidates. We can't know per-hypothesis age (entries are bare
  // strings), so flag the whole set as "review for supersession" when the doc
  // is old enough to compact. This is intentionally a permissive flag; Claude
  // is the judge.
  const supersededCandidates: string[] =
    compactedSinceMs < cutoffMs ? [...doc.active_hypotheses] : [];

  const proposed: ProjectContextDoc = {
    meta: {
      ...doc.meta,
      // proposed doc carries the would-be next state; meta is finalised when
      // apex_set_project_context commits.
    },
    current_state: nextCurrentState,
    active_hypotheses: [...doc.active_hypotheses], // unchanged; Claude prunes if it wants
    open_questions: [...doc.open_questions],       // unchanged
    stakeholder_notes: stakeholderKept,
    recent_decisions: keptDecisions,
  };

  return {
    proposed,
    diff: {
      absorbed_decisions: absorbed,
      current_state_before: doc.current_state,
      current_state_after: nextCurrentState,
      superseded_hypotheses_candidates: supersededCandidates,
      stakeholder_notes_unchanged: stakeholderKept.length,
      stakeholder_notes_dropped_empty: droppedEmpty,
      triggers: compactionTriggers(doc, nowMs),
    },
  };
}

// ─────────────────────────── briefing helpers ───────────────────────────

/**
 * Project IDs whose context doc has any compaction trigger fired.
 * Reads the whole store once. Pass nowMs for testable time.
 */
export async function getCompactionDueProjectIds(
  nowMs: number = Date.now(),
): Promise<Array<{ project_id: string; reasons: string[] }>> {
  const store = await loadStore();
  const out: Array<{ project_id: string; reasons: string[] }> = [];
  for (const [project_id, doc] of Object.entries(store.docs)) {
    const t = compactionTriggers(doc, nowMs);
    if (t.triggered) out.push({ project_id, reasons: t.reasons });
  }
  return out;
}

/**
 * Sunset smell: projects with open tasks but no context update in >SUNSET_SMELL_DAYS.
 * Caller passes the set of project_ids that have open tasks.
 */
export async function getStaleContextProjectIds(
  projectsWithOpenTasks: Iterable<string>,
  openTaskCountByProject: Map<string, number>,
  nowMs: number = Date.now(),
): Promise<Array<{ project_id: string; days_since_context_update: number; open_task_count: number }>> {
  const store = await loadStore();
  const cutoffMs = nowMs - SUNSET_SMELL_DAYS * DAY_MS;
  const out: Array<{
    project_id: string;
    days_since_context_update: number;
    open_task_count: number;
  }> = [];
  for (const project_id of projectsWithOpenTasks) {
    const doc = store.docs[project_id];
    // No doc at all + open tasks = stalest possible.
    if (!doc) {
      out.push({
        project_id,
        days_since_context_update: Number.MAX_SAFE_INTEGER,
        open_task_count: openTaskCountByProject.get(project_id) ?? 0,
      });
      continue;
    }
    const tMs = new Date(doc.meta.last_updated_at).getTime();
    if (!Number.isFinite(tMs) || tMs < cutoffMs) {
      const days = Number.isFinite(tMs)
        ? Math.floor((nowMs - tMs) / DAY_MS)
        : Number.MAX_SAFE_INTEGER;
      out.push({
        project_id,
        days_since_context_update: days,
        open_task_count: openTaskCountByProject.get(project_id) ?? 0,
      });
    }
  }
  out.sort((a, b) => b.days_since_context_update - a.days_since_context_update);
  return out.slice(0, 10);
}
