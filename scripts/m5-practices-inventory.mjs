#!/usr/bin/env node
// M5 — inventory apex:practices:v1.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");
const OUT = join(ROOT, "data", "magnificent-m5-practices-raw.txt");

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
  const raw = await kvGet("apex:practices:v1");
  if (raw == null) { console.log("apex:practices:v1: NULL"); return; }
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  const items = Array.isArray(data) ? data : (data.items || []);
  const lines = [];
  lines.push(`apex:practices:v1: ${items.length} entries`);
  lines.push("");

  // Group by category
  const byCat = {};
  for (const p of items) {
    const cat = p.category || "(uncategorized)";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(p);
  }
  lines.push("--- Counts by category ---");
  for (const cat of Object.keys(byCat).sort()) lines.push(`${cat}: ${byCat[cat].length}`);
  lines.push("");

  // Tag frequency
  const tagCount = {};
  for (const p of items) for (const t of (p.tags || [])) tagCount[t] = (tagCount[t] || 0) + 1;
  lines.push("--- Tag frequency (top 30) ---");
  const sortedTags = Object.entries(tagCount).sort((a,b) => b[1]-a[1]).slice(0, 30);
  for (const [t, c] of sortedTags) lines.push(`${t}: ${c}`);
  // Singletons
  const singletons = Object.entries(tagCount).filter(([_, c]) => c === 1).map(([t]) => t);
  lines.push("");
  lines.push(`--- Single-use tags (${singletons.length}) ---`);
  lines.push(singletons.join(", "));
  lines.push("");

  lines.push("--- All entries ---");
  for (const p of items) {
    const tags = (p.tags || []).join(",");
    const contentLen = (p.content || "").length;
    const titleLine = `${p.id} | cat=${p.category} src=${p.source || "-"} scope=${p.scope || "-"} tags=[${tags}] len=${contentLen}`;
    lines.push(titleLine);
    lines.push(`  title: ${p.title || "(no title)"}`);
    lines.push(`  created=${p.created_at || "-"} updated=${p.updated_at || "-"}`);
    // Stale-term scan
    const blob = JSON.stringify(p).toLowerCase();
    const stale = [];
    for (const term of ["openclaw", "deprecated", "apex:projects", "vault:ip-entries", "maproom:"]) {
      if (blob.includes(term)) stale.push(term);
    }
    if (stale.length) lines.push(`  stale-term hits: ${stale.join(", ")}`);
    lines.push("");
  }

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`Saved ${lines.length} lines to ${OUT}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
