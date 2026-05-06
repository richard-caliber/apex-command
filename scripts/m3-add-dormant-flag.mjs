#!/usr/bin/env node
// M3 D7 — add dormant boolean to apex:squad:v4 records.
// Squad agents (atlas/newton/darwin/jimmy) are dormant; ginge is not.
// One-shot script; M2 banner stays as a hard-coded fallback per spec.

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
if (!KV_URL || !KV_TOKEN) throw new Error("Missing KV creds in .env.local");

const KEY = "apex:squad:v4";
const SQUAD_DORMANT = new Set(["atlas", "newton", "darwin", "jimmy"]);

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
  console.log("Reading", KEY);
  const store = await kvGet(KEY);
  if (!store) throw new Error("apex:squad:v4 missing");
  if (!Array.isArray(store.agents)) throw new Error("Unexpected shape — agents is not an array");

  console.log(`Found ${store.agents.length} agent(s):`, store.agents.map((a) => a.id).join(", "));

  let changed = 0;
  for (const a of store.agents) {
    const want = SQUAD_DORMANT.has(a.id);
    if (a.dormant !== want) {
      a.dormant = want;
      changed += 1;
      console.log(`  ${a.id}: dormant = ${want}`);
    } else {
      console.log(`  ${a.id}: dormant = ${want} (already set)`);
    }
  }

  if (changed === 0) {
    console.log("No changes needed.");
    return;
  }

  store.lastUpdated = new Date().toISOString();
  await kvSet(KEY, store);
  console.log(`Wrote ${KEY} (${changed} agent(s) updated).`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
