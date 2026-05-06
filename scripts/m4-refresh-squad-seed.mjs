#!/usr/bin/env node
// M4 D5 — refresh data/squad.json seed from live apex:squad:v4.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");
const SEED_PATH = join(ROOT, "data", "squad.json");

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

const res = await fetch(`${KV_URL}/get/apex:squad:v4`, {
  headers: { Authorization: `Bearer ${KV_TOKEN}` },
});
const json = await res.json();
const raw = json.result;
const store = typeof raw === "string" ? JSON.parse(raw) : raw;

if (!store?.agents) throw new Error("apex:squad:v4 missing or malformed");

writeFileSync(SEED_PATH, JSON.stringify(store, null, 2));
console.log(`Wrote ${SEED_PATH} — ${store.agents.length} agent(s).`);
console.log("Dormant flags:");
for (const a of store.agents) {
  console.log(`  ${a.id}: dormant=${a.dormant ?? "(not set)"}`);
}
