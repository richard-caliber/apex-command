#!/usr/bin/env node
// M7 — list all known/expected KV keys + check for any unexpected leftovers.

import { readFileSync } from "fs";
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

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}`);
  const json = await res.json();
  return json.result;
}

const CANONICAL = [
  "apex:warroom:projects",
  "apex:pipeline-tasks",
  "apex:practices:v1",
  "apex:prompts:v2",
  "apex:squad:v4",
];

const KEPT_BY_DESIGN = [
  "apex:project:caliber",
  "apex:project:edge-auto",
  "apex:project:gemsnap",
  "apex:project:squad",
  "apex:project:storyquest",
  "apex:pipeline:caliber:2026-03-28",
  "apex:pipeline:caliber:2026-03-29",
];

const SHOULD_BE_GONE = [
  "apex:projects",
  "maproom:projects",
  "apex:squad:v2",
  "vault:ip-entries",
  "maproom:ip-vault",
  "maproom:ip-vault-v2",
  "maproom:prompts",
  "maproom:ideas",
  "maproom:capabilities",
  "maproom:outputs",
  "maproom:metrics",
  "maproom:platform-rules",
  "apex:action-room:feed",
  "apex:action-room:suggestions",
];

const main = async () => {
  console.log("=== Canonical stores (should exist with content) ===");
  for (const k of CANONICAL) {
    const v = await kvGet(k);
    const size = v == null ? 0 : (typeof v === "string" ? v.length : JSON.stringify(v).length);
    console.log(`  ${v == null ? "❌ NULL" : "✓ " + size + "B"}  ${k}`);
  }

  console.log("\n=== Kept-by-design (Phase 7+ migration scheduled) ===");
  for (const k of KEPT_BY_DESIGN) {
    const v = await kvGet(k);
    const size = v == null ? 0 : (typeof v === "string" ? v.length : JSON.stringify(v).length);
    console.log(`  ${v == null ? "(empty)" : size + "B"}  ${k}`);
  }

  console.log("\n=== Should be gone (parallel stores deleted across Magnificent) ===");
  let leakCount = 0;
  for (const k of SHOULD_BE_GONE) {
    const v = await kvGet(k);
    if (v == null) {
      console.log(`  ✓ DELETED  ${k}`);
    } else {
      console.log(`  ❌ STILL PRESENT  ${k}`);
      leakCount++;
    }
  }

  console.log(`\nLeak count: ${leakCount}`);
  if (leakCount > 0) process.exit(2);
};

main().catch((err) => { console.error(err); process.exit(1); });
