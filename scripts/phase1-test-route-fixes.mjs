#!/usr/bin/env node
// Phase 1 — verify the four broken [id] routes now return real data.
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const BASE = process.env.APEX_BASE || "http://localhost:3000";

const probes = [
  { name: "map-room/ideas/[id]",        method: "GET", path: "/api/map-room/ideas/atlas-ideas-comment" },
  { name: "map-room/capabilities/[id] (gap)",  method: "GET", path: "/api/map-room/capabilities/gap-1" },
  { name: "map-room/capabilities/[id] (research)", method: "GET", path: "/api/map-room/capabilities/res-1" },
  { name: "map-room/ip-vault/[id] (entry wh-1)", method: "GET", path: "/api/map-room/ip-vault/wh-1" },
  { name: "squad/files (PUT v4)",       method: "PUT", path: "/api/squad/files",
    body: { agentId: "atlas", files: [{ path: "TEST.md", description: "phase1 smoke test", size: "1B", status: "current" }] },
    auth: true,
  },
];

const out = [];
const log = (s) => { console.log(s); out.push(s); };

async function main() {
  log(`Phase 1 route-fix smoke test @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}\n`);

  // Read APEX_API_TOKEN from .env.local for auth
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

  let pass = 0, fail = 0;
  for (const p of probes) {
    const headers = { "Content-Type": "application/json" };
    if (p.auth) headers.Authorization = `Bearer ${env.APEX_API_TOKEN}`;
    const res = await fetch(`${BASE}${p.path}`, {
      method: p.method,
      headers,
      body: p.body ? JSON.stringify(p.body) : undefined,
    });
    const body = res.ok ? await res.json() : await res.text();
    const ok = res.status >= 200 && res.status < 300;
    log(`── ${p.name} ──`);
    log(`  ${p.method} ${p.path} → ${res.status} ${ok ? "✓" : "✗"}`);
    log(`  body: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    log("");
    if (ok) pass++; else fail++;
  }
  log(`SUMMARY: ${pass}/${probes.length} passed, ${fail} failed`);

  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase1-route-fixes-${today}.txt`);
  writeFileSync(path, out.join("\n") + "\n");
  log(`Wrote ${path}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
