#!/usr/bin/env node
// M3.5 patch 2 — DRY RUN preview. Shows what the bulk-block script
// would do without writing. Use this when the kill threshold trips
// to decide whether to bump the limit and proceed.

import { readFileSync, existsSync } from "fs";
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

const SQUAD_OWNERS = new Set(["atlas", "newton", "darwin", "jimmy"]);
const TARGET_STATUSES = new Set(["not_started", "in_progress"]);

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const json = await res.json();
  const raw = json.result;
  if (typeof raw === "string") return JSON.parse(raw);
  return raw;
}

const projectsStore = await kvGet("apex:warroom:projects");
const tasksStore = await kvGet("apex:pipeline-tasks");
const archived = projectsStore.projects.filter((p) => p.status === "archived");
const archivedIds = new Set(archived.map((p) => p.id));
const candidates = tasksStore.tasks.filter(
  (t) =>
    archivedIds.has(t.project_id) &&
    SQUAD_OWNERS.has(t.owner) &&
    TARGET_STATUSES.has(t.status),
);

const perProject = {};
const perStage = {};
const perOwner = {};
for (const t of candidates) {
  perProject[t.project_id] = (perProject[t.project_id] ?? 0) + 1;
  perStage[t.stage] = (perStage[t.stage] ?? 0) + 1;
  perOwner[t.owner] = (perOwner[t.owner] ?? 0) + 1;
}

console.log(`Archived projects: ${archived.length}`);
console.log(`Total candidate tasks: ${candidates.length}\n`);

console.log("Per project (sorted desc):");
for (const [k, v] of Object.entries(perProject).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log("\nPer stage:");
for (const [k, v] of Object.entries(perStage).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log("\nPer owner:");
for (const [k, v] of Object.entries(perOwner).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
