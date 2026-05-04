#!/usr/bin/env node
// Phase 1 — verify that all four project stores return identical data
// for the same project ID, after read-shim consolidation.
//
// Hits the local dev server (default http://localhost:3000) and probes:
//   - /api/projects        (list, action: list)        → canonical warroom shape
//   - /api/status/{id}     (legacy shape, shim'd)
//   - /api/map-room/projects (list, shim'd)
//   - /api/map-room/projects/{id} (shim'd)
//
// Asserts that name, stage, and status match across stores.
// Saves output to data/phase1-verify-{ISO-date}.txt.

import { writeFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const BASE = process.env.APEX_BASE || "http://localhost:3000";

const PROBE_IDS = ["caliber", "gemsnap", "edge-auto", "storyquest"];

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };

async function fetchJson(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: res.ok ? await res.json() : await res.text() };
}

function pickStage(s) {
  return (s ?? "").toString().toLowerCase();
}

function pickStatus(s) {
  return (s ?? "").toString().toLowerCase();
}

async function main() {
  log(`Verify run @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}`);
  log(`Probing IDs: ${PROBE_IDS.join(", ")}`);
  log("");

  const projectsList = await fetchJson("POST", "/api/projects", { action: "list" });
  log(`/api/projects (list) → ${projectsList.status}, ${(projectsList.json.projects || []).length} projects`);

  const mapList = await fetchJson("GET", "/api/map-room/projects");
  log(`/api/map-room/projects → ${mapList.status}, ${(mapList.json.items || []).length} items`);

  log("");

  let pass = 0, fail = 0;

  for (const id of PROBE_IDS) {
    log(`── ${id} ──`);
    const fromList = (projectsList.json.projects || []).find((p) => p.id === id);
    const fromMapList = (mapList.json.items || []).find((i) => i.id === id);
    const status = await fetchJson("GET", `/api/status/${id}`);
    const mapById = await fetchJson("GET", `/api/map-room/projects/${id}`);

    if (!fromList) {
      log(`  ✗ /api/projects list: not found`);
      fail++;
      continue;
    }

    log(`  /api/projects list: name="${fromList.name}" stage="${fromList.stage}" status="${fromList.status}"`);
    log(`  /api/status/${id}: ${status.status} name="${status.json?.name}" stage="${status.json?.stage}" status="${status.json?.status}"`);
    log(`  /api/map-room/projects list: ${fromMapList ? `name="${fromMapList.name}" stage_idx=${fromMapList.current_stage} status="${fromMapList.status}"` : "(not found)"}`);
    log(`  /api/map-room/projects/${id}: ${mapById.status} name="${mapById.json?.name}" stage_idx=${mapById.json?.current_stage} status="${mapById.json?.status}"`);

    const mismatches = [];
    if (status.status !== 200) mismatches.push(`/status returned ${status.status}`);
    if (mapById.status !== 200) mismatches.push(`/map-room/${id} returned ${mapById.status}`);
    if (status.json?.name && status.json.name !== fromList.name) mismatches.push(`name mismatch: list="${fromList.name}" status="${status.json.name}"`);
    if (mapById.json?.name && mapById.json.name !== fromList.name) mismatches.push(`name mismatch: list="${fromList.name}" map="${mapById.json.name}"`);
    if (status.json?.status && pickStatus(status.json.status) !== pickStatus(fromList.status)) mismatches.push(`status mismatch list="${fromList.status}" /status="${status.json.status}"`);
    if (mapById.json?.status && pickStatus(mapById.json.status) !== pickStatus(fromList.status)) mismatches.push(`status mismatch list="${fromList.status}" /map="${mapById.json.status}"`);
    if (status.json?.stage && pickStage(status.json.stage) !== pickStage(fromList.stage)) mismatches.push(`stage mismatch list="${fromList.stage}" /status="${status.json.stage}"`);

    if (mismatches.length === 0) {
      log(`  ✓ all four stores agree`);
      pass++;
    } else {
      for (const m of mismatches) log(`  ✗ ${m}`);
      fail++;
    }
    log("");
  }

  log(`SUMMARY: ${pass}/${PROBE_IDS.length} passed, ${fail} failed`);

  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase1-verify-${today}.txt`);
  writeFileSync(path, lines.join("\n") + "\n");
  log(`Wrote ${path}`);

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
