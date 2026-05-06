#!/usr/bin/env node
// M4 audit — read current KV size + baseline presence per legacy key.

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");
const BASELINE = join(ROOT, "data", "magnificent-baseline-2026-05-05.json");

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

const KEYS = [
  "apex:projects",
  "maproom:projects",
  "apex:squad:v2",
  "vault:ip-entries",
  "maproom:ip-vault-v2",
  "maproom:prompts",
  "maproom:ideas",
  "maproom:capabilities",
  "maproom:ip-vault",
  "apex:action-room:feed",
  "apex:action-room:suggestions",
  "maproom:outputs",
  "maproom:metrics",
  "maproom:platform-rules",
];

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

async function kvScan(pattern) {
  const all = new Set();
  let cursor = "0";
  do {
    const url = `${KV_URL}/scan/${cursor}/match/${encodeURIComponent(pattern)}/count/1000`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const json = await res.json();
    cursor = json.result[0];
    for (const k of json.result[1]) all.add(k);
  } while (cursor !== "0");
  return [...all];
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));

console.log("Key | current_size | baseline_size | baseline_present");
console.log("---|---|---|---");
let totalCurrent = 0;
for (const k of KEYS) {
  const cur = await kvGet(k);
  const bsl = baseline.keys[k];
  const curSize = cur === null || cur === undefined ? 0 : (typeof cur === "string" ? cur.length : JSON.stringify(cur).length);
  const bslSize = bsl === null || bsl === undefined ? 0 : JSON.stringify(bsl).length;
  totalCurrent += curSize;
  console.log(`${k} | ${curSize} | ${bslSize} | ${bsl === null || bsl === undefined ? "NO" : "yes"}`);
}
console.log(`---\ntotal current bytes (top-level keys): ${totalCurrent}`);

// Wildcard scan for apex:project:* and apex:pipeline:*
console.log("\napex:project:* keys (enrichment store):");
const projKeys = await kvScan("apex:project:*");
for (const k of projKeys) {
  const v = await kvGet(k);
  const sz = v === null || v === undefined ? 0 : (typeof v === "string" ? v.length : JSON.stringify(v).length);
  console.log(`  ${k}: ${sz} bytes`);
}
console.log(`  (total ${projKeys.length} keys)`);

console.log("\napex:pipeline:* keys:");
const pipeKeys = await kvScan("apex:pipeline:*");
for (const k of pipeKeys) {
  const v = await kvGet(k);
  const sz = v === null || v === undefined ? 0 : (typeof v === "string" ? v.length : JSON.stringify(v).length);
  console.log(`  ${k}: ${sz} bytes`);
}
console.log(`  (total ${pipeKeys.length} keys)`);
