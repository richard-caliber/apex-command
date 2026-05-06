#!/usr/bin/env node
// M5 — inventory apex:prompts:v2 + verify maproom:prompts deletion.

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
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

const main = async () => {
  console.log("--- M5 prompts inventory ---");

  // 1. Check maproom:prompts deletion
  const maproom = await kvGet("maproom:prompts");
  console.log(`maproom:prompts: ${maproom == null ? "DELETED ✓" : "STILL PRESENT (" + JSON.stringify(maproom).length + " bytes)"}`);

  // 2. Inventory apex:prompts:v2
  const raw = await kvGet("apex:prompts:v2");
  if (raw == null) {
    console.log("apex:prompts:v2: NULL");
    return;
  }

  // raw is stored as JSON-stringified or object
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  const items = data.items || [];
  console.log(`apex:prompts:v2: ${items.length} prompt records (lastUpdated ${data.lastUpdated})`);
  console.log("");

  for (const p of items) {
    const usage = p.usage || {};
    const tags = (p.tags || []).join(",");
    console.log(`- id=${p.id}`);
    console.log(`  name="${p.name}"`);
    console.log(`  category=${p.category} owner=${p.owner} model=${p.model} version=${p.version}`);
    console.log(`  stage=${p.stage || "-"} taskId=${p.taskId || "-"}`);
    console.log(`  tags=[${tags}]`);
    console.log(`  usage: timesUsed=${usage.timesUsed} lastUsed=${usage.lastUsed || "-"} lastEditedBy=${usage.lastEditedBy}`);
    console.log(`  created=${p.created_at} updated=${p.updated_at}`);

    // Stale-term scan
    const blob = JSON.stringify(p).toLowerCase();
    const stale = [];
    for (const term of ["openclaw", "newton", "darwin", "atlas", "jimmy", "deprecated", "dormant", "apex:projects", "vault:ip-entries", "maproom:"]) {
      if (blob.includes(term)) stale.push(term);
    }
    if (stale.length) console.log(`  stale-term hits: ${stale.join(", ")}`);
    console.log("");
  }
};

main().catch((err) => { console.error(err); process.exit(1); });
