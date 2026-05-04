#!/usr/bin/env node
// Phase 1 — restore atlas workspace_files in apex:squad:v4 from the snapshot.
// The squad PUT smoke test was destructive (full replace of files for one agent).
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const env = (() => {
  const txt = readFileSync(join(ROOT, ".env.local"), "utf8");
  const o = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    o[m[1]] = v;
  }
  return o;
})();
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

const snap = JSON.parse(readFileSync(join(ROOT, "data", "kv-snapshot-2026-05-04.json"), "utf8"));
const live = await fetch(`${KV_URL}/get/${encodeURIComponent("apex:squad:v4")}`, {
  headers: { Authorization: `Bearer ${KV_TOKEN}` },
}).then((r) => r.json());
const liveValue = typeof live.result === "string" ? JSON.parse(live.result) : live.result;

const snapAtlas = snap.keys["apex:squad:v4"].agents.find((a) => a.id === "atlas");
const liveAtlasIdx = liveValue.agents.findIndex((a) => a.id === "atlas");
console.log(`live atlas.workspace_files count: ${liveValue.agents[liveAtlasIdx].workspace_files?.length}`);
console.log(`snap atlas.workspace_files count: ${snapAtlas.workspace_files.length}`);

liveValue.agents[liveAtlasIdx].workspace_files = snapAtlas.workspace_files;
liveValue.agents[liveAtlasIdx].last_updated = snapAtlas.last_updated;
liveValue.lastUpdated = snap.keys["apex:squad:v4"].lastUpdated;

const setRes = await fetch(`${KV_URL}/set/${encodeURIComponent("apex:squad:v4")}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
  body: JSON.stringify(liveValue),
});
console.log("SET status:", setRes.status, await setRes.text());
