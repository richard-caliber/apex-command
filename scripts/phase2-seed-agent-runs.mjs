#!/usr/bin/env node
// Phase 2 — seed one dummy run per agent in apex:agent-runs:{agent_id}:2026-05.
// Uses the same shape that src/lib/agent-runs.ts would write (KV stores values
// as JSON-stringified strings via @vercel/kv; we replicate that with the
// Upstash REST API).
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

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

async function kvGet(k) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(k)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`GET ${k}: ${res.status}`);
  const j = await res.json();
  if (j.result === null || j.result === undefined) return null;
  if (typeof j.result === "string") {
    try { return JSON.parse(j.result); } catch { return j.result; }
  }
  return j.result;
}

async function kvSet(k, v) {
  const body = JSON.stringify(v);
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(k)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) throw new Error(`SET ${k}: ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const month = "2026-05";
  const now = new Date().toISOString();

  // Pull current runtime_config to get the model_used per agent
  const squad = await kvGet("apex:squad:v4");
  if (!squad?.agents?.length) throw new Error("apex:squad:v4 missing or malformed");
  const byId = Object.fromEntries(squad.agents.map((a) => [a.id, a]));

  const agents = ["atlas", "newton", "darwin", "jimmy", "ginge"];
  const verify = { seeded_at: now, month, agents: {} };

  for (const id of agents) {
    const rc = byId[id]?.runtime_config;
    if (!rc) throw new Error(`runtime_config missing for ${id}`);
    const k = `apex:agent-runs:${id}:${month}`;

    const seedRun = {
      run_id: randomUUID(),
      timestamp: now,
      model_used: rc.model,
      provider: rc.provider,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      task_id: null,
      task_name: null,
      status: "success",
      latency_ms: 0,
    };

    const existing = await kvGet(k);
    const payload = existing ?? {
      agent_id: id,
      month,
      runs: [],
      lastUpdated: now,
    };
    payload.runs.push(seedRun);
    payload.lastUpdated = now;

    await kvSet(k, payload);

    // Verify by re-reading
    const after = await kvGet(k);
    verify.agents[id] = {
      key: k,
      runs_count: after.runs.length,
      first_run_id: after.runs[0]?.run_id,
      last_run_id: after.runs[after.runs.length - 1]?.run_id,
      seed_run_added: after.runs.some((r) => r.run_id === seedRun.run_id),
      sample_run: after.runs[after.runs.length - 1],
    };
    console.log(`SET ${k} ok (${after.runs.length} run${after.runs.length === 1 ? "" : "s"})`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase2-agent-runs-seed-${today}.json`);
  writeFileSync(path, JSON.stringify(verify, null, 2));
  console.log(`\nWrote ${path}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
