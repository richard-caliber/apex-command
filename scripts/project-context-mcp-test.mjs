#!/usr/bin/env node
// End-to-end MCP test for the four project-context tools:
//   apex_get_project_context, apex_log_context,
//   apex_set_project_context, apex_compact_project_context.
// Mirrors scripts/phase4.1-mcp-test.mjs. Writes transcript to
// data/project-context-mcp-{LABEL}-{ISO-date}.txt.
//
// Usage:
//   APEX_BASE=http://localhost:3000 node scripts/project-context-mcp-test.mjs
//   APEX_BASE=https://apex-command-seven.vercel.app node scripts/project-context-mcp-test.mjs

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
const header = (s) => log(`\n── ${s} ──`);

let passes = 0;
let failures = 0;
function assert(cond, label) {
  if (cond) { passes += 1; log(`  ✓ ${label}`); }
  else      { failures += 1; log(`  ✗ ${label}`); }
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
async function postForm(url, params) {
  const sp = new URLSearchParams(params);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: sp.toString(),
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location") };
}
async function rpc(token, method, params, id = 1) {
  const res = await fetch(`${BASE}/api/mcp/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  const m = text.match(/^data:\s*(\{[\s\S]*?\})\s*$/m);
  let body;
  if (m) { try { body = JSON.parse(m[1]); } catch { body = text; } }
  else { try { body = JSON.parse(text); } catch { body = text; } }
  return { status: res.status, body };
}
async function call(token, name, args, id) {
  return rpc(token, "tools/call", { name, arguments: args }, id);
}
function payloadJson(resp) {
  const text = resp.body?.result?.content?.[0]?.text || "";
  const idx = text.indexOf("\n\n");
  if (idx < 0) return null;
  try { return JSON.parse(text.slice(idx + 2)); } catch { return null; }
}

async function main() {
  log(`Project-context MCP ${LABEL} @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}`);

  // ───── OAuth ─────
  header("DCR + authorize + token");
  const reg = await postJson(`${BASE}/api/mcp/oauth/register`, {
    redirect_uris: [REDIRECT],
    client_name: `pctx-test-${LABEL}-${Date.now()}`,
  });
  if (reg.status !== 201) throw new Error(`DCR failed: ${reg.status}`);
  const clientId = reg.body.client_id;
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authPost = await postForm(`${BASE}/api/mcp/oauth/authorize`, {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state: randomBytes(8).toString("base64url"),
    scope: "apex:full",
    apex_token: APEX_TOKEN,
  });
  if (authPost.status !== 302) throw new Error(`authorize failed: ${authPost.status}`);
  const code = new URL(authPost.location).searchParams.get("code");
  const tok = await postJson(`${BASE}/api/mcp/oauth/token`, {
    grant_type: "authorization_code", code, code_verifier: codeVerifier,
    redirect_uri: REDIRECT, client_id: clientId,
  });
  if (tok.status !== 200) throw new Error(`token exchange failed: ${tok.status}`);
  const token = tok.body.access_token;
  log(`access_token ${token.slice(0, 20)}…`);

  // ───── tools/list ─────
  header("tools/list — expect 4 new tools present");
  const tools = await rpc(token, "tools/list", {}, 2);
  const toolNames = (tools.body?.result?.tools || []).map((t) => t.name);
  log(`got ${toolNames.length} tools`);
  for (const n of [
    "apex_get_project_context",
    "apex_log_context",
    "apex_set_project_context",
    "apex_compact_project_context",
  ]) {
    assert(toolNames.includes(n), `tool present: ${n}`);
  }

  const TEST_ID = `pctx-test-${Date.now().toString(36)}`;
  log(`TEST project_id = ${TEST_ID}`);

  // ───── 1. get on missing → null payload, no isError ─────
  header(`apex_get_project_context on missing id ${TEST_ID}`);
  let r = await call(token, "apex_get_project_context", { project_id: TEST_ID }, 3);
  assert(!r.body?.result?.isError, "isError === false for missing doc");
  assert(payloadJson(r) === null, "payload is null");

  // ───── 2. log active_hypotheses (creates doc) ─────
  header("apex_log_context active_hypotheses (creates doc)");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "active_hypotheses",
    payload: { hypothesis: "Crypto-only checkout is suppressing conversion" },
  }, 4);
  assert(!r.body?.result?.isError, "isError === false");
  let doc = payloadJson(r);
  assert(doc?.meta?.version === 1, "version === 1");
  assert(doc?.active_hypotheses?.length === 1, "active_hypotheses has 1 entry");

  // ───── 3. log open_questions (append v2) ─────
  header("apex_log_context open_questions");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "open_questions",
    payload: { question: "Is awareness the bottleneck, or the checkout itself?" },
  }, 5);
  doc = payloadJson(r);
  assert(doc?.meta?.version === 2, "version === 2");
  assert(doc?.open_questions?.length === 1, "open_questions has 1 entry");
  assert(doc?.active_hypotheses?.length === 1, "active_hypotheses preserved");

  // ───── 4. log stakeholder_notes ─────
  header("apex_log_context stakeholder_notes");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "stakeholder_notes",
    payload: { name: "Todd", note: "Has not replied in three weeks on the booking page test." },
  }, 6);
  doc = payloadJson(r);
  assert(doc?.meta?.version === 3, "version === 3");
  assert(doc?.stakeholder_notes?.[0]?.name === "Todd", "name === Todd");
  assert(typeof doc?.stakeholder_notes?.[0]?.updated_at === "string", "stakeholder updated_at present");

  // ───── 5. log recent_decisions ─────
  header("apex_log_context recent_decisions");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "recent_decisions",
    payload: { decision: "Defer fiat checkout track", rationale: "Vertical rejected by mainstream card processors." },
  }, 7);
  doc = payloadJson(r);
  assert(doc?.meta?.version === 4, "version === 4");
  assert(doc?.recent_decisions?.[0]?.decision?.startsWith("Defer fiat"), "decision logged");
  assert(typeof doc?.recent_decisions?.[0]?.logged_at === "string", "decision logged_at present");

  // ───── 6. invalid section ─────
  header("apex_log_context — invalid section");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "not_a_section",
    payload: { hypothesis: "x" },
  }, 8);
  // Zod enum validation will surface as either isError or as an MCP-level error.
  const errText = r.body?.result?.content?.[0]?.text || JSON.stringify(r.body?.error || {});
  assert(
    r.body?.result?.isError || /enum|invalid/i.test(errText),
    `rejected invalid section (got: ${(errText || "").slice(0, 120)})`,
  );

  // ───── 7. payload missing required field ─────
  header("apex_log_context — stakeholder_notes payload missing name");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "stakeholder_notes",
    payload: { note: "missing name field" },
  }, 9);
  assert(r.body?.result?.isError, "isError === true");
  assert(/name/i.test(r.body?.result?.content?.[0]?.text || ""), "error mentions name field");

  // ───── 8. over-length payload ─────
  header("apex_log_context — over-length hypothesis (600 chars)");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "active_hypotheses",
    payload: { hypothesis: "x".repeat(600) },
  }, 10);
  assert(r.body?.result?.isError, "isError === true");
  assert(/500/i.test(r.body?.result?.content?.[0]?.text || ""), "error mentions 500-char limit");

  // ───── 9. whitespace-only payload ─────
  header("apex_log_context — whitespace-only hypothesis");
  r = await call(token, "apex_log_context", {
    project_id: TEST_ID, section: "active_hypotheses",
    payload: { hypothesis: "   " },
  }, 11);
  assert(r.body?.result?.isError, "isError === true");
  assert(/empty|whitespace/i.test(r.body?.result?.content?.[0]?.text || ""), "error mentions empty/whitespace");

  // ───── 10. get returns full populated doc ─────
  header("apex_get_project_context after logs");
  r = await call(token, "apex_get_project_context", { project_id: TEST_ID }, 12);
  doc = payloadJson(r);
  assert(doc?.meta?.version === 4, "version still 4 (failed logs did not bump)");
  assert(doc?.active_hypotheses?.length === 1, "1 hypothesis");
  assert(doc?.open_questions?.length === 1, "1 question");
  assert(doc?.stakeholder_notes?.length === 1, "1 stakeholder note");
  assert(doc?.recent_decisions?.length === 1, "1 decision");

  // ───── 11. compact propose (no save) ─────
  header("apex_compact_project_context — propose only");
  r = await call(token, "apex_compact_project_context", { project_id: TEST_ID }, 13);
  const proposal = payloadJson(r);
  assert(!r.body?.result?.isError, "isError === false");
  assert(proposal?.proposed && proposal?.diff, "returns { proposed, diff }");
  assert(typeof proposal?.diff?.triggers === "object", "diff.triggers present");

  // Confirm nothing was saved.
  r = await call(token, "apex_get_project_context", { project_id: TEST_ID }, 14);
  assert(payloadJson(r)?.meta?.version === 4, "compaction did NOT save (version still 4)");

  // ───── 12. compact on missing → isError ─────
  header("apex_compact_project_context on missing id");
  r = await call(token, "apex_compact_project_context", { project_id: "definitely-not-a-project-xyz" }, 15);
  assert(r.body?.result?.isError, "isError === true");

  // ───── 13. set_project_context — full overwrite ─────
  header("apex_set_project_context — full overwrite");
  r = await call(token, "apex_set_project_context", {
    project_id: TEST_ID,
    current_state: "Test project. All sections deliberately pruned for the overwrite test.",
    active_hypotheses: ["Single hypothesis after overwrite"],
    open_questions: [],
    stakeholder_notes: [],
    recent_decisions: [],
  }, 16);
  doc = payloadJson(r);
  assert(!r.body?.result?.isError, "isError === false");
  assert(doc?.meta?.version === 5, "version === 5 after overwrite");
  assert(doc?.meta?.prior_version?.meta?.version === 4, "prior_version captures v4");
  assert(doc?.meta?.prior_version?.meta?.prior_version === null, "prior_version.prior_version === null (no recursion)");
  assert(doc?.active_hypotheses?.length === 1, "1 hypothesis remains");
  assert(doc?.open_questions?.length === 0, "0 questions");

  // ───── 14. set_project_context — over-length field rejected ─────
  header("apex_set_project_context — over-length current_state");
  r = await call(token, "apex_set_project_context", {
    project_id: TEST_ID,
    current_state: "x".repeat(600),
    active_hypotheses: [], open_questions: [], stakeholder_notes: [], recent_decisions: [],
  }, 17);
  assert(r.body?.result?.isError, "isError === true on over-length");

  // ───── 15. briefing — new keys present ─────
  header("apex_get_briefing — expect new keys");
  r = await call(token, "apex_get_briefing", {}, 18);
  const briefing = payloadJson(r);
  assert(briefing && typeof briefing === "object", "briefing is an object");
  assert("top_project_context" in briefing, "has top_project_context key");
  assert("context_compaction_due" in briefing, "has context_compaction_due key");
  assert("stale_context_projects" in briefing, "has stale_context_projects key");

  // ───── 16. briefing — project_id parameter swaps top_project_context ─────
  header(`apex_get_briefing — project_id=${TEST_ID} swap`);
  r = await call(token, "apex_get_briefing", { project_id: TEST_ID }, 19);
  const swapped = payloadJson(r);
  assert(swapped?.top_project_context?.meta?.project_id === TEST_ID, "top_project_context swapped to test id");

  // ───── 17. audit log contains writes only ─────
  header("apex_get_audit — confirm log/set entries");
  r = await call(token, "apex_get_audit", {}, 20);
  const auditText = r.body?.result?.content?.[0]?.text || "";
  assert(auditText.includes("apex_log_context"), "audit contains apex_log_context");
  assert(auditText.includes("apex_set_project_context"), "audit contains apex_set_project_context");
  assert(!auditText.includes("\"apex_get_project_context\""), "audit does NOT contain apex_get_project_context (read tool)");
  assert(!auditText.includes("\"apex_compact_project_context\""), "audit does NOT contain apex_compact_project_context (proposal tool)");

  // ───── 18. regression sanity ─────
  header("Regression: apex_list_projects + apex_get_practice (sanity)");
  r = await call(token, "apex_list_projects", {}, 21);
  assert(!r.body?.result?.isError && Array.isArray(payloadJson(r)), "apex_list_projects still works");

  // ───── done ─────
  header(`SUMMARY: ${passes} passed, ${failures} failed`);
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `project-context-mcp-${LABEL}-${today}.txt`);
  writeFileSync(path, lines.join("\n") + "\n");
  log(`Wrote ${path}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  log(`\n!! FAILED: ${e.stack || e.message}`);
  const today = new Date().toISOString().slice(0, 10);
  try {
    writeFileSync(
      join(ROOT, "data", `project-context-mcp-${LABEL}-${today}.txt`),
      lines.join("\n") + "\n",
    );
  } catch {}
  process.exit(1);
});
