#!/usr/bin/env node
// Phase 4.1 — end-to-end test for the three new MCP tools.
// Walks: OAuth → tools/list (expect 17) → exercise apex_set_project (create + update),
// apex_archive_project, and apex_update_practice (seeded via apex_add_practice).
// Saves transcript to data/phase4.1-mcp-{LABEL}-{ISO-date}.txt where LABEL is
// "local-test" against localhost:3000 or "prod-verify" against the deployed URL.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash, randomBytes } from "crypto";

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
const LABEL = process.env.APEX_LABEL || (BASE.includes("localhost") ? "local-test" : "prod-verify");
const APEX_TOKEN = env.APEX_API_TOKEN;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
function header(s) { log(`\n── ${s} ──`); }

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function postForm(url, params, headers = {}) {
  const sp = new URLSearchParams(params);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: sp.toString(),
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), body: await res.text() };
}

async function rpc(accessToken, method, params, id = 1) {
  const res = await fetch(`${BASE}/api/mcp/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  const m = text.match(/^data:\s*(\{[\s\S]*?\})\s*$/m);
  let body;
  if (m) {
    try { body = JSON.parse(m[1]); } catch { body = text; }
  } else {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: res.status, body };
}

async function callTool(accessToken, name, args, id) {
  return rpc(accessToken, "tools/call", { name, arguments: args }, id);
}

async function main() {
  log(`Phase 4.1 MCP ${LABEL} @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}`);

  // 1. OAuth flow
  header("DCR: POST /api/mcp/oauth/register");
  const reg = await postJson(`${BASE}/api/mcp/oauth/register`, {
    redirect_uris: [REDIRECT],
    client_name: `phase4.1-${LABEL}`,
  });
  log(`status: ${reg.status}, client_id: ${reg.body.client_id}`);
  if (reg.status !== 201) throw new Error("DCR failed");
  const clientId = reg.body.client_id;

  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(8).toString("base64url");

  header("Authorize: POST with valid APEX_API_TOKEN");
  const authPost = await postForm(`${BASE}/api/mcp/oauth/authorize`, {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "apex:full",
    apex_token: APEX_TOKEN,
  });
  log(`status: ${authPost.status}, location: ${authPost.location}`);
  if (authPost.status !== 302) throw new Error("authorize POST should 302");
  const callbackUrl = new URL(authPost.location);
  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("no code in callback");

  header("Token: POST /api/mcp/oauth/token");
  const tok = await postJson(`${BASE}/api/mcp/oauth/token`, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT,
    client_id: clientId,
  });
  if (tok.status !== 200) throw new Error("token exchange failed");
  const accessToken = tok.body.access_token;
  log(`access_token: ${accessToken.slice(0, 20)}...`);

  // 2. Initialize + tools/list — expect 17 tools (was 14, +3 new)
  header("MCP: initialize");
  const init = await rpc(accessToken, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "phase4.1-test", version: "1.0.0" },
  });
  log(`status: ${init.status}, protocol: ${init.body?.result?.protocolVersion}`);

  header("MCP: tools/list (expect 17)");
  const tools = await rpc(accessToken, "tools/list", {}, 2);
  const toolList = tools.body?.result?.tools || [];
  const toolNames = toolList.map((t) => t.name);
  log(`status: ${tools.status}, count: ${toolList.length}`);
  log(`tools: ${toolNames.join(", ")}`);

  // Confirm the three new tools are present
  const expectedNew = ["apex_set_project", "apex_archive_project", "apex_update_practice"];
  for (const n of expectedNew) {
    if (!toolNames.includes(n)) throw new Error(`Missing new tool: ${n}`);
    const t = toolList.find((x) => x.name === n);
    log(`  ✓ ${n} — title="${t.title}", required=${JSON.stringify(t.inputSchema?.required ?? [])}`);
  }

  // 3. apex_set_project — CREATE
  const testId = `phase41-test-${Date.now().toString(36)}`;
  header(`apex_set_project (create new): id=${testId}`);
  const create = await callTool(accessToken, "apex_set_project", {
    id: testId,
    name: "Phase 4.1 Smoke Test Project",
    stage: "validation",
    status: "active",
    description: "Created by phase4.1-mcp-test.mjs",
    blocker: "Awaiting validation signal",
    tags: ["test", "phase4.1"],
    url: "",
    owner: "ginge",
    score: 5,
    featured: false,
  }, 3);
  const createText = create.body?.result?.content?.[0]?.text || "";
  log(`status: ${create.status}, isError: ${create.body?.result?.isError ?? false}`);
  log(`first 400 chars:\n${createText.slice(0, 400)}`);

  // 4. apex_set_project — UPDATE
  header(`apex_set_project (update existing): id=${testId}`);
  const update = await callTool(accessToken, "apex_set_project", {
    id: testId,
    name: "Phase 4.1 Smoke Test Project (updated)",
    status: "blocked",
    blocker: "Updated blocker via apex_set_project test",
    score: 7,
  }, 4);
  const updateText = update.body?.result?.content?.[0]?.text || "";
  log(`status: ${update.status}, isError: ${update.body?.result?.isError ?? false}`);
  log(`first 400 chars:\n${updateText.slice(0, 400)}`);

  // 5. apex_set_project — INVALID stage (should error)
  header("apex_set_project (invalid stage 'foo' — should error)");
  const badStage = await callTool(accessToken, "apex_set_project", {
    id: testId,
    name: "should not save",
    stage: "foo",
  }, 5);
  log(`isError: ${badStage.body?.result?.isError}, text: ${(badStage.body?.result?.content?.[0]?.text || "").slice(0, 200)}`);

  // 6. apex_archive_project
  header(`apex_archive_project: id=${testId}`);
  const archive = await callTool(accessToken, "apex_archive_project", {
    id: testId,
    reason: "Smoke test cleanup",
  }, 6);
  const archiveText = archive.body?.result?.content?.[0]?.text || "";
  log(`status: ${archive.status}, isError: ${archive.body?.result?.isError ?? false}`);
  log(`first 400 chars:\n${archiveText.slice(0, 400)}`);

  // 7. apex_archive_project — non-existent id
  header("apex_archive_project (missing id 'nonexistent-xyz' — should error)");
  const noProj = await callTool(accessToken, "apex_archive_project", { id: "nonexistent-xyz" }, 7);
  log(`isError: ${noProj.body?.result?.isError}, text: ${(noProj.body?.result?.content?.[0]?.text || "").slice(0, 200)}`);

  // 8. Verify archived project is still readable via apex_get_project
  header(`apex_get_project: id=${testId} (verify archive is readable)`);
  const verify = await callTool(accessToken, "apex_get_project", { id: testId }, 8);
  const verifyText = verify.body?.result?.content?.[0]?.text || "";
  log(`first 400 chars:\n${verifyText.slice(0, 400)}`);

  // 9. apex_add_practice — seed an item to update
  const practiceTitle = `Phase 4.1 update target ${Date.now().toString(36)}`;
  header(`apex_add_practice: seed updatable item titled "${practiceTitle}"`);
  const seed = await callTool(accessToken, "apex_add_practice", {
    title: practiceTitle,
    content: "Original content. Should be replaced by apex_update_practice.",
    category: "test",
    tags: ["phase4.1", "seed"],
    source: "manual",
  }, 9);
  const seedText = seed.body?.result?.content?.[0]?.text || "";
  const seededIdMatch = seedText.match(/"id":\s*"([^"]+)"/);
  const seededId = seededIdMatch ? seededIdMatch[1] : null;
  log(`seeded practice id: ${seededId}`);
  if (!seededId) throw new Error("could not parse seeded practice id");

  // 10. apex_update_practice — partial update (title + content only)
  header(`apex_update_practice: id=${seededId}`);
  const updPrac = await callTool(accessToken, "apex_update_practice", {
    id: seededId,
    title: `${practiceTitle} (UPDATED)`,
    content: "Updated content via apex_update_practice. Original content should be gone.",
  }, 10);
  const updPracText = updPrac.body?.result?.content?.[0]?.text || "";
  log(`status: ${updPrac.status}, isError: ${updPrac.body?.result?.isError ?? false}`);
  log(`first 500 chars:\n${updPracText.slice(0, 500)}`);

  // 11. apex_update_practice — verify category/tags preserved (only updated above what we passed)
  header("apex_update_practice (verify preserved fields by re-fetching)");
  const reget = await callTool(accessToken, "apex_get_practice", { id: seededId }, 11);
  const regetText = reget.body?.result?.content?.[0]?.text || "";
  log(`first 500 chars:\n${regetText.slice(0, 500)}`);

  // 12. apex_update_practice — non-existent id
  header("apex_update_practice (missing id 'nonexistent-practice' — should error)");
  const noPrac = await callTool(accessToken, "apex_update_practice", {
    id: "nonexistent-practice",
    title: "should not save",
  }, 12);
  log(`isError: ${noPrac.body?.result?.isError}, text: ${(noPrac.body?.result?.content?.[0]?.text || "").slice(0, 200)}`);

  // 13. Regression: existing tools still work — call apex_list_projects + apex_search_practices
  header("Regression: apex_list_projects (should still work)");
  const lp = await callTool(accessToken, "apex_list_projects", {}, 13);
  const lpText = lp.body?.result?.content?.[0]?.text || "";
  log(`first 200 chars:\n${lpText.slice(0, 200)}`);

  header("Regression: apex_search_practices q=phase4.1");
  const sp = await callTool(accessToken, "apex_search_practices", { query: "phase4.1", limit: 5 }, 14);
  const spText = sp.body?.result?.content?.[0]?.text || "";
  log(`first 300 chars:\n${spText.slice(0, 300)}`);

  // 14. Audit log shows the new tool calls
  header("apex_get_audit (verify Phase 4.1 events recorded)");
  const audit = await callTool(accessToken, "apex_get_audit", {}, 15);
  const auditText = audit.body?.result?.content?.[0]?.text || "";
  const phase41Hits = (auditText.match(/apex_set_project|apex_archive_project|apex_update_practice/g) || []).length;
  log(`phase 4.1 tool mentions in audit: ${phase41Hits}`);
  log(`first 600 chars:\n${auditText.slice(0, 600)}`);

  // Done
  header("DONE — saving transcript");
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase4.1-mcp-${LABEL}-${today}.txt`);
  writeFileSync(path, lines.join("\n") + "\n");
  log(`Wrote ${path}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  lines.push(`\n!! FAILED: ${e.stack || e.message}`);
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase4.1-mcp-${LABEL}-${today}.txt`);
  try { writeFileSync(path, lines.join("\n") + "\n"); } catch {}
  process.exit(1);
});
