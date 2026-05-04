#!/usr/bin/env node
// Phase 2 — add runtime_config to each agent in apex:squad:v4 via PATCH /api/squad.
// Uses the brief's explicit per-agent defaults verbatim. Idempotent: PATCH merges,
// so re-running this script overwrites runtime_config but preserves all other fields.

import { readFileSync, writeFileSync } from "fs";
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
const BASE = process.env.APEX_BASE || "http://localhost:3000";
const TOKEN = env.APEX_API_TOKEN;
if (!TOKEN) throw new Error("APEX_API_TOKEN missing in .env.local");

const SYSTEM_PROMPT_TEMPLATE = `You are {{agent_name}}.

## Identity
{{identity_text}}

## Soul
{{soul_text}}

## Capabilities
{{capabilities_text}}

## Responsibilities
{{responsibilities_text}}

## Memory (last updated {{memory_updated_at}})
{{memory_text}}

## Relevant Practices
{{practices}}

## Current Task
{{task}}
`;

const DEFAULTS = {
  atlas:  { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.7, max_tokens: 8000,  thinking_mode: { enabled: false } },
  newton: { provider: "anthropic", model: "claude-opus-4-7",   temperature: 0.5, max_tokens: 16000, thinking_mode: { enabled: true, budget_tokens: 5000 } },
  darwin: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.6, max_tokens: 8000,  thinking_mode: { enabled: false } },
  jimmy:  { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.9, max_tokens: 6000,  thinking_mode: { enabled: false } },
  ginge:  { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.7, max_tokens: 8000,  thinking_mode: { enabled: false } },
};

async function patch(agentId, runtime_config) {
  const res = await fetch(`${BASE}/api/squad`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ agentId, runtime_config }),
  });
  return { status: res.status, body: res.ok ? await res.json() : await res.text() };
}

async function get() {
  const res = await fetch(`${BASE}/api/squad`);
  return res.json();
}

async function main() {
  console.log(`PATCH base: ${BASE}`);
  const before = await get();
  const beforeBy = Object.fromEntries(before.agents.map((a) => [a.id, a]));

  // Capture pre-PATCH lastUpdated for kill-criterion #4 check.
  const preTimestamps = Object.fromEntries(before.agents.map((a) => [a.id, a.last_updated || ""]));

  const results = {};
  for (const [agentId, base] of Object.entries(DEFAULTS)) {
    const runtime_config = {
      ...base,
      tool_definitions: [],
      system_prompt_template: SYSTEM_PROMPT_TEMPLATE,
    };
    process.stdout.write(`PATCH ${agentId} ... `);
    const res = await patch(agentId, runtime_config);
    if (res.status !== 200) {
      console.log(`FAILED ${res.status}: ${typeof res.body === "string" ? res.body : JSON.stringify(res.body)}`);
      throw new Error(`PATCH ${agentId} failed`);
    }
    console.log(`ok (${res.status})`);
    results[agentId] = res.body;
  }

  // Verify by full GET, ensure runtime_config is present and lastUpdated only changed for our 5 agents.
  const after = await get();
  const afterBy = Object.fromEntries(after.agents.map((a) => [a.id, a]));

  const summary = { verified_at: new Date().toISOString(), agents: {} };
  for (const id of Object.keys(DEFAULTS)) {
    const a = afterBy[id];
    summary.agents[id] = {
      runtime_config: a.runtime_config,
      last_updated: a.last_updated,
      preserved_soul_text_length: (a.soul_text || "").length,
      preserved_memory_text_length: (a.memory_text || "").length,
      preserved_workspace_files_count: (a.workspace_files || []).length,
    };
  }

  // Kill criterion #4: detect untouched agent timestamp drift.
  const untouchedDrift = [];
  for (const a of after.agents) {
    if (a.id in DEFAULTS) continue;
    if ((preTimestamps[a.id] || "") !== (a.last_updated || "")) {
      untouchedDrift.push({ id: a.id, before: preTimestamps[a.id], after: a.last_updated });
    }
  }
  summary.untouched_agent_drift = untouchedDrift;

  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase2-runtime-config-verify-${today}.json`);
  writeFileSync(path, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${path}`);

  // Sanity prints
  for (const id of Object.keys(DEFAULTS)) {
    const rc = afterBy[id]?.runtime_config;
    console.log(`  ${id}: model=${rc?.model} provider=${rc?.provider} temp=${rc?.temperature} max=${rc?.max_tokens} thinking=${JSON.stringify(rc?.thinking_mode)}`);
  }
  if (untouchedDrift.length) {
    console.log(`\n!! KILL CRITERION #4: untouched agents drifted:`, untouchedDrift);
    process.exit(2);
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
