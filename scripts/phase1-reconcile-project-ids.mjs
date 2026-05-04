#!/usr/bin/env node
// Phase 1 — reconcile project IDs across all KV stores to a canonical hyphenated form.
//
// Usage:
//   node scripts/phase1-reconcile-project-ids.mjs           # dry-run
//   node scripts/phase1-reconcile-project-ids.mjs --apply   # apply changes
//
// The mapping below is the ONLY canonical-form change we detected in the
// pre-flight scan (see phase1-kv-snapshot.mjs output). If you discover
// more variants, add them to MAPPING.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");

function loadEnv() {
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
if (!KV_URL || !KV_TOKEN) throw new Error("Missing KV_REST_API_URL/KV_REST_API_TOKEN");

const APPLY = process.argv.includes("--apply");

// ── Canonical ID mapping ────────────────────────────────────────────
// Old ID → Canonical hyphenated form.
const MAPPING = {
  edgeauto: "edge-auto",
};

// ── Stores and field paths ──────────────────────────────────────────
// Each entry: { key, type } where type controls how we walk it.
//   "topLevelId" — value.projects[].id (or value.items[].id, etc.)
//   "nested"     — list of { array, field } describing the project_id field path
const COLLECTION_STORES = [
  { key: "apex:warroom:projects", arr: "projects", idField: "id", isProjectKey: true },
  { key: "apex:projects",         arr: "projects", idField: "id", isProjectKey: true },
  { key: "maproom:projects",      arr: "items",    idField: "id", isProjectKey: true },
];

const REFERENCE_STORES = [
  { key: "apex:pipeline-tasks",    arr: "tasks",   field: "project_id" },
  { key: "apex:project-actions",   arr: "actions", field: "project_id" },
  { key: "maproom:tasks",          arr: "items",   field: "project_id" },
  { key: "apex:content-strategy",  arr: "items",   field: "project_id" },
  { key: "apex:content-performance", arr: "items", field: "project_id" },
  { key: "apex:data:v1",           arr: "metrics", field: "project_id" },
  { key: "apex:content-queue",     arr: "items",   field: "project_id" },
  { key: "apex:content-library",   arr: "items",   field: "project_id" },
];

// ── Upstash REST helpers ────────────────────────────────────────────
async function kvGetRaw(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

async function kvGet(key) {
  const raw = await kvGetRaw(key);
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function kvSet(key, value) {
  // Match @vercel/kv behaviour: store as JSON-stringified string.
  const body = JSON.stringify(value);
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) throw new Error(`KV SET ${key} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function kvDel(key) {
  const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV DEL ${key} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Reconciliation ──────────────────────────────────────────────────
const log = []; // { from_id, to_id, key_affected, field_path, count }

async function reconcileCollection({ key, arr, idField }) {
  const store = await kvGet(key);
  if (!store || !Array.isArray(store[arr])) {
    console.log(`  [skip] ${key} — empty or wrong shape`);
    return null;
  }
  let changed = 0;
  for (const item of store[arr]) {
    const cur = item[idField];
    if (MAPPING[cur]) {
      console.log(`  ${key}: ${arr}[].${idField}  ${cur} → ${MAPPING[cur]}`);
      log.push({ from_id: cur, to_id: MAPPING[cur], key_affected: key, field_path: `${arr}[].${idField}`, count: 1 });
      item[idField] = MAPPING[cur];
      changed++;
    }
  }
  return { store, changed };
}

async function reconcileReferences({ key, arr, field }) {
  const store = await kvGet(key);
  if (!store) {
    console.log(`  [skip] ${key} — null`);
    return null;
  }
  if (!Array.isArray(store[arr])) {
    console.log(`  [skip] ${key} — no ${arr}[] array`);
    return null;
  }
  const counts = {};
  for (const item of store[arr]) {
    const cur = item[field];
    if (MAPPING[cur]) {
      counts[cur] = (counts[cur] || 0) + 1;
      item[field] = MAPPING[cur];
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log(`  [no change] ${key}`);
    return { store, changed: 0 };
  }
  for (const [from, count] of Object.entries(counts)) {
    console.log(`  ${key}: ${arr}[].${field}  ${from} → ${MAPPING[from]}  (${count} rows)`);
    log.push({ from_id: from, to_id: MAPPING[from], key_affected: key, field_path: `${arr}[].${field}`, count });
  }
  return { store, changed: total };
}

async function reconcileProjectKeys() {
  // SCAN apex:project:* and rename any whose suffix is in MAPPING.
  let cursor = "0";
  const found = [];
  do {
    const url = `${KV_URL}/scan/${cursor}/match/${encodeURIComponent("apex:project:*")}/count/1000`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    if (!res.ok) throw new Error(`SCAN ${res.status}: ${await res.text()}`);
    const json = await res.json();
    cursor = json.result[0];
    for (const k of json.result[1]) found.push(k);
  } while (cursor !== "0");

  console.log("  apex:project:* keys found:", found);
  const ops = [];
  for (const k of found) {
    const suffix = k.slice("apex:project:".length);
    if (MAPPING[suffix]) {
      const newKey = `apex:project:${MAPPING[suffix]}`;
      console.log(`  rename ${k} → ${newKey}`);
      ops.push({ from: k, to: newKey, oldId: suffix, newId: MAPPING[suffix] });
      log.push({ from_id: suffix, to_id: MAPPING[suffix], key_affected: k, field_path: "<key rename>", count: 1 });
    }
  }
  return ops;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} mode`);
  console.log("Mapping:", MAPPING);
  console.log();

  // Plan
  const plan = [];
  console.log("── Collection stores ──");
  for (const cfg of COLLECTION_STORES) {
    const r = await reconcileCollection(cfg);
    if (r) plan.push({ ...cfg, ...r, kind: "collection" });
  }

  console.log("\n── Reference stores ──");
  for (const cfg of REFERENCE_STORES) {
    const r = await reconcileReferences(cfg);
    if (r) plan.push({ ...cfg, ...r, kind: "reference" });
  }

  console.log("\n── apex:project:{id} key renames ──");
  const renameOps = await reconcileProjectKeys();

  console.log("\n── Summary ──");
  const total = plan.reduce((a, p) => a + p.changed, 0) + renameOps.length;
  console.log(`Total changes planned: ${total}`);
  console.log(`Log entries: ${log.length}`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to commit.");
    return;
  }

  console.log("\n── APPLYING ──");
  for (const p of plan) {
    if (p.changed > 0) {
      console.log(`  SET ${p.key} (${p.changed} field changes)`);
      await kvSet(p.key, p.store);
    }
  }
  for (const op of renameOps) {
    const v = await kvGet(op.from);
    if (v && typeof v === "object" && v.id === op.oldId) v.id = op.newId;
    console.log(`  SET ${op.to}, DEL ${op.from}`);
    await kvSet(op.to, v);
    await kvDel(op.from);
  }

  // Write log
  const today = new Date().toISOString().slice(0, 10);
  const logPath = join(ROOT, "data", `phase1-reconcile-log-${today}.json`);
  writeFileSync(logPath, JSON.stringify({
    applied_at: new Date().toISOString(),
    mapping: MAPPING,
    changes: log,
  }, null, 2));
  console.log(`\nWrote ${logPath}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
