#!/usr/bin/env node
// M7 close-out — refresh ginge.current_task in apex:squad:v4 from
// "Magnificent sprint in progress" to the post-sprint marker.

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
const NEW_TASK = "Apex Magnificent v1.0.0 shipped — Phase 7 planning next";

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
  const store = await kvGet(KEY);
  if (!store?.agents) throw new Error("apex:squad:v4 missing or malformed");

  const ginge = store.agents.find((a) => a.id === "ginge");
  if (!ginge) throw new Error("ginge agent record missing");

  console.log(`Before: ginge.current_task = ${JSON.stringify(ginge.current_task)}`);
  if (ginge.current_task === NEW_TASK) {
    console.log("Already up to date — no write needed.");
    return;
  }

  ginge.current_task = NEW_TASK;
  ginge.last_updated = new Date().toISOString();
  store.lastUpdated = new Date().toISOString();
  await kvSet(KEY, store);
  console.log(`After:  ginge.current_task = ${JSON.stringify(NEW_TASK)} — written.`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
