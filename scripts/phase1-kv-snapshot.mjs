#!/usr/bin/env node
// Phase 1 — snapshot the entire KV state to git, before any reconciliation.
// Reads .env.local for KV_REST_API_URL and KV_REST_API_TOKEN.
// Writes:
//   - data/kv-snapshot-{ISO-date}.json (full dump)
//   - data/squad.json (current apex:squad:v4, kept as a fresh seed)

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
if (!KV_URL || !KV_TOKEN) throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env.local");

async function kvCmd(args) {
  // Upstash REST: POST { commands: [["GET","key"]] } returns { result: ... }
  // For single command, we POST to the path; e.g. /get/{key} for GET.
  // Easier: use the array-payload endpoint.
  const res = await fetch(KV_URL + "/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV ${args.join(" ")} ${res.status}: ${text}`);
  }
  return res.json();
}

async function kvGet(key) {
  // GET via /get/{key} (URL-encoded). Upstash returns {result: <stored value>}.
  // @vercel/kv stores objects as JSON strings, so parse if the result is a JSON string.
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV GET ${key} ${res.status}: ${text}`);
  }
  const json = await res.json();
  const raw = json.result;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function kvScan(cursor, match) {
  // SCAN cursor MATCH pattern COUNT 1000
  const url = `${KV_URL}/scan/${cursor}/match/${encodeURIComponent(match)}/count/1000`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV SCAN ${match} ${res.status}: ${text}`);
  }
  const json = await res.json();
  // Upstash returns { result: [nextCursor, [keys...]] }
  return { nextCursor: json.result[0], keys: json.result[1] };
}

async function scanAll(pattern) {
  const all = new Set();
  let cursor = "0";
  do {
    const { nextCursor, keys } = await kvScan(cursor, pattern);
    for (const k of keys) all.add(k);
    cursor = nextCursor;
  } while (cursor !== "0");
  return [...all];
}

const KNOWN_KEYS = [
  "apex:warroom:projects",
  "apex:projects",
  "apex:pipeline-tasks",
  "apex:pipeline-stages",
  "apex:project-actions",
  "apex:pipeline",
  "apex:data:v1",
  "apex:heartbeat:v3",
  "apex:automation-map",
  "apex:prompts:v2",
  "apex:ideas-commentary",
  "apex:squad:v4",
  "apex:squad:v2",
  "apex:action-room:feed",
  "apex:action-room:suggestions",
  "apex:content-queue",
  "apex:content-library",
  "apex:content-strategy",
  "apex:content-performance",
  "vault:apikeys:_index",
  "vault:ip-entries",
  "maproom:projects",
  "maproom:tasks",
  "maproom:ideas",
  "maproom:ideas:v2",
  "maproom:capabilities",
  "maproom:capabilities-v2",
  "maproom:ip-vault",
  "maproom:ip-vault-v2",
  "maproom:prompts",
  "maproom:outputs",
  "maproom:posts",
  "maproom:metrics",
  "maproom:platform-rules",
  "maproom:heartbeat-v2",
  "maproom:flow-map",
];

const WILDCARDS = [
  "apex:project:*",
  "apex:pipeline:*",
  "vault:apikeys:*",
];

async function main() {
  console.log("KV URL:", KV_URL);
  const snapshot = {
    snapshot_at: new Date().toISOString(),
    kv_url: KV_URL,
    keys: {},
  };
  const missing = [];

  // 1. Known keys
  for (const k of KNOWN_KEYS) {
    process.stdout.write(`GET ${k} ... `);
    const v = await kvGet(k);
    snapshot.keys[k] = v;
    if (v === null || v === undefined) {
      console.log("(missing)");
      missing.push(k);
    } else {
      const size = JSON.stringify(v).length;
      console.log(`ok (${size} bytes)`);
    }
  }

  // 2. Wildcards via SCAN
  for (const pat of WILDCARDS) {
    console.log(`\nSCAN ${pat}`);
    const keys = await scanAll(pat);
    console.log(`  found ${keys.length} keys`);
    // Skip vault:apikeys:_index since we already grabbed it; SCAN may also return it.
    for (const k of keys) {
      if (k in snapshot.keys) continue;
      const v = await kvGet(k);
      snapshot.keys[k] = v;
      const size = v === null ? 0 : JSON.stringify(v).length;
      console.log(`  GET ${k} ok (${size} bytes)`);
    }
  }

  // 3. Write snapshot
  const today = new Date().toISOString().slice(0, 10);
  const snapPath = join(ROOT, "data", `kv-snapshot-${today}.json`);
  writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${snapPath}`);
  console.log(`Total keys captured: ${Object.keys(snapshot.keys).length}`);
  console.log(`Missing/null keys: ${missing.length}`);
  if (missing.length) console.log("  -", missing.join("\n  - "));

  // 4. Refresh data/squad.json from current apex:squad:v4
  const squad = snapshot.keys["apex:squad:v4"];
  if (squad) {
    const squadPath = join(ROOT, "data", "squad.json");
    writeFileSync(squadPath, JSON.stringify(squad, null, 2));
    console.log(`\nWrote ${squadPath} from apex:squad:v4`);
  } else {
    console.log("\nWARN: apex:squad:v4 is missing — data/squad.json NOT updated");
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
