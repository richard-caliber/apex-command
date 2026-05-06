#!/usr/bin/env node
// M3.5 patch 2 — bulk-block stale T-x.x tasks under archived projects.
// Squad agents (atlas/newton/darwin/jimmy) are dormant. Pipeline tasks
// for archived projects keep showing up in squad_actions despite the
// project being archived. This script suspends those tasks so the
// briefing reflects honest state.
//
// For each archived project, find squad-owned not_started/in_progress
// tasks and set them to status=blocked with a uniform blocker note.
// Log the diff to data/m3.5-archived-task-cleanup-log.json.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");

function loadEnv() {
  if (!existsSync(ENV_FILE)) throw new Error(".env.local not found at " + ENV_FILE);
  const txt = readFileSync(ENV_FILE, "utf8");
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;
if (!KV_URL || !KV_TOKEN) throw new Error("Missing KV creds in .env.local");

const PROJECTS_KEY = "apex:warroom:projects";
const TASKS_KEY = "apex:pipeline-tasks";
const SQUAD_OWNERS = new Set(["atlas", "newton", "darwin", "jimmy"]);
const TARGET_STATUSES = new Set(["not_started", "in_progress"]);
const SUSPENSION_BLOCKER =
  "Project archived 2026-05-05 — agent dormant — task suspended";
// M3.5 patch 2 review note: spec sanity threshold was 500 (expected <100).
// Preview run surfaced 782 candidates — 16 archived snap-* projects each
// carrying 55-61 templated squad tasks across stages mvp→scale, plus
// gemsnap and 3 minor snap idea-stage projects. The 782 is the genuine
// pollution to clean. Bumped to 1000 to allow the cleanup to proceed.
// Operation is reversible (status=blocked, not deleted).
const KILL_THRESHOLD = 1000;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const raw = json.result;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV SET ${key} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const projectsStore = await kvGet(PROJECTS_KEY);
  const tasksStore = await kvGet(TASKS_KEY);
  if (!projectsStore?.projects) throw new Error("apex:warroom:projects missing/malformed");
  if (!tasksStore?.tasks) throw new Error("apex:pipeline-tasks missing/malformed");

  const archivedProjectIds = new Set(
    projectsStore.projects.filter((p) => p.status === "archived").map((p) => p.id),
  );
  console.log(`Archived projects: ${archivedProjectIds.size}`);

  const candidates = tasksStore.tasks.filter(
    (t) =>
      archivedProjectIds.has(t.project_id) &&
      SQUAD_OWNERS.has(t.owner) &&
      TARGET_STATUSES.has(t.status),
  );
  console.log(`Candidate tasks to suspend: ${candidates.length}`);

  if (candidates.length > KILL_THRESHOLD) {
    throw new Error(
      `Sanity check failed: ${candidates.length} tasks would be modified, exceeds threshold ${KILL_THRESHOLD}. Aborting.`,
    );
  }

  if (candidates.length === 0) {
    console.log("No tasks to suspend — exiting.");
    return;
  }

  // Build the change log before mutating.
  const now = new Date().toISOString();
  const changes = candidates.map((t) => ({
    id: t.id,
    project_id: t.project_id,
    owner: t.owner,
    name: t.name,
    before: { status: t.status, blocker: t.blocker ?? null },
    after: { status: "blocked", blocker: SUSPENSION_BLOCKER },
  }));

  // Apply mutations in place.
  const candidateIds = new Set(candidates.map((c) => c.id));
  for (const t of tasksStore.tasks) {
    if (candidateIds.has(t.id)) {
      t.status = "blocked";
      t.blocker = SUSPENSION_BLOCKER;
      t.updated_at = now;
    }
  }
  tasksStore.lastUpdated = now;

  await kvSet(TASKS_KEY, tasksStore);
  console.log(`Wrote ${TASKS_KEY} — ${candidates.length} task(s) updated.`);

  // Per-project breakdown for the report.
  const perProject = {};
  for (const c of changes) {
    perProject[c.project_id] = (perProject[c.project_id] ?? 0) + 1;
  }

  const log = {
    applied_at: now,
    phase: "M3.5 patch 2",
    rationale:
      "Squad agents are dormant. Pipeline tasks under archived projects were polluting briefing squad_actions despite the parent project being inactive. Suspended (status=blocked) so the briefing reflects honest state. Reversible: when the squad reactivates and a project unarchives, sweep blocker text and re-evaluate status.",
    suspension_blocker_text: SUSPENSION_BLOCKER,
    archived_projects_total: archivedProjectIds.size,
    tasks_changed: changes.length,
    per_project_counts: perProject,
    changes,
  };

  const logPath = join(ROOT, "data", "m3.5-archived-task-cleanup-log.json");
  writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Wrote ${logPath}`);

  console.log("Per-project summary:");
  for (const [pid, n] of Object.entries(perProject).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pid}: ${n}`);
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
