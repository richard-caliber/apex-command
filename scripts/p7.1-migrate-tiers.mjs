#!/usr/bin/env node
// P7.1 — Migrate project tiers + flip Sheils Poker active → paused.
// Run AFTER deploying Phase 7.1 (so the tier field is defined in the schema).
// Idempotent: re-running rewrites the same values.
//
// Tier-1 = current revenue priority queue (Caliber, Atlas Drift, Villas, Poker OS)
// Tier-2 = active but lower priority (Todd Safe NT pending call)
// Tier-3 = experimental/borderline (Sheils Poker — also flipped to paused)
// Null   = meta/creative/paused/archived. Migration leaves these alone.

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

const KEY = "apex:warroom:projects";

const TIER_MAP = {
  // Tier-1 — current revenue priority queue
  caliber: { tier: "tier-1", order: 1 },
  "atlas-drift": { tier: "tier-1", order: 2 },
  villas: { tier: "tier-1", order: 3 },
  "poker-os": { tier: "tier-1", order: 4 },

  // Tier-2 — active but lower priority or blocked-on-external
  "todd-safent": { tier: "tier-2", order: 1 },

  // Tier-3 — experimental/borderline
  "sheils-poker": { tier: "tier-3", order: 1 },
};

// Status flips bundled into this same one-shot. Sheils Poker has been
// internally inconsistent (status=active + stage=idea + blocker text saying
// it should not graduate from idea stage). The honest state is paused.
const STATUS_FLIPS = {
  "sheils-poker": "paused",
};

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
  if (!store) throw new Error("apex:warroom:projects missing");
  if (!Array.isArray(store.projects)) throw new Error("Unexpected shape — projects is not an array");

  console.log(`Found ${store.projects.length} project(s)`);

  const now = new Date().toISOString();
  let changed = 0;

  for (const p of store.projects) {
    const desired = TIER_MAP[p.id];
    const flip = STATUS_FLIPS[p.id];
    let touched = false;

    if (desired) {
      if (p.tier !== desired.tier) {
        console.log(`  ${p.id}: tier ${p.tier ?? "null"} → ${desired.tier}`);
        p.tier = desired.tier;
        touched = true;
      }
      if (p.order !== desired.order) {
        console.log(`  ${p.id}: order ${p.order ?? "unset"} → ${desired.order}`);
        p.order = desired.order;
        touched = true;
      }
    }

    if (flip && p.status !== flip) {
      console.log(`  ${p.id}: status ${p.status} → ${flip}`);
      p.status = flip;
      touched = true;
    }

    if (touched) {
      p.updated_at = now;
      changed += 1;
    }
  }

  if (changed === 0) {
    console.log("No changes needed — store already matches target state.");
    return;
  }

  store.lastUpdated = now;
  await kvSet(KEY, store);
  console.log(`Wrote ${KEY} (${changed} project(s) updated).`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
