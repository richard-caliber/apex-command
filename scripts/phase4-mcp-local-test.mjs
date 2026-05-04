#!/usr/bin/env node
// Phase 4 — local end-to-end test of the MCP server.
// Walks: OAuth (DCR → authorize → token) → JSON-RPC tools/list → tools/call sweep.
// Saves transcript to data/phase4-mcp-local-test-{ISO-date}.txt.

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

async function rpc(transport, accessToken, method, params, id = 1) {
  const res = await fetch(`${BASE}/api/mcp/${transport}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  // Streamable HTTP responses are SSE-formatted: parse the first data: line.
  const m = text.match(/^data:\s*(\{[\s\S]*?\})\s*$/m);
  let body;
  if (m) {
    try { body = JSON.parse(m[1]); } catch { body = text; }
  } else {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: res.status, body };
}

async function main() {
  log(`Phase 4 MCP local test @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}`);

  // 1. Well-known endpoints
  header("well-known: oauth-protected-resource");
  const prs = await fetch(`${BASE}/.well-known/oauth-protected-resource`).then((r) => r.json());
  log(JSON.stringify(prs, null, 2));

  header("well-known: oauth-authorization-server");
  const ass = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then((r) => r.json());
  log(JSON.stringify(ass, null, 2));

  // 2. Dynamic Client Registration
  header("DCR: POST /api/mcp/oauth/register");
  const reg = await postJson(`${BASE}/api/mcp/oauth/register`, {
    redirect_uris: [REDIRECT],
    client_name: "phase4-local-test",
  });
  log(`status: ${reg.status}\n${JSON.stringify(reg.body, null, 2)}`);
  if (reg.status !== 201) throw new Error("DCR failed");
  const clientId = reg.body.client_id;

  // 3. Authorize: GET form (just to make sure it renders), then POST with apex token + PKCE
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(8).toString("base64url");

  header("Authorize: GET (form should render)");
  const authGet = await fetch(
    `${BASE}/api/mcp/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT)}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}&scope=apex:full`,
  );
  log(`status: ${authGet.status}, content-type: ${authGet.headers.get("content-type")}`);
  log(`form contains apex_token field: ${(await authGet.text()).includes('name="apex_token"')}`);

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
  if (authPost.status !== 302) throw new Error("authorize POST should redirect on success");
  const callbackUrl = new URL(authPost.location);
  const code = callbackUrl.searchParams.get("code");
  log(`code: ${code ? "(received)" : "(missing!)"}`);
  if (!code) throw new Error("no code in callback");

  header("Authorize: POST with WRONG token (should re-render form, not 302)");
  const wrongAuth = await postForm(`${BASE}/api/mcp/oauth/authorize`, {
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "apex:full",
    apex_token: "wrong-token-here",
  });
  log(`status: ${wrongAuth.status} (expect 200, no Location)`);

  // 4. Token exchange
  header("Token: POST /api/mcp/oauth/token");
  const tok = await postJson(`${BASE}/api/mcp/oauth/token`, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT,
    client_id: clientId,
  });
  log(`status: ${tok.status}\n${JSON.stringify(tok.body, null, 2)}`);
  if (tok.status !== 200) throw new Error("token exchange failed");
  const accessToken = tok.body.access_token;

  header("Token: re-use same code (should fail invalid_grant)");
  const reuse = await postJson(`${BASE}/api/mcp/oauth/token`, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT,
    client_id: clientId,
  });
  log(`status: ${reuse.status}\n${JSON.stringify(reuse.body, null, 2)}`);

  // 5. MCP initialize + tools/list
  header("MCP: initialize");
  const init = await rpc("mcp", accessToken, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "phase4-local-test", version: "1.0.0" },
  });
  log(`status: ${init.status}\n${JSON.stringify(init.body, null, 2).slice(0, 600)}`);

  header("MCP: tools/list");
  const tools = await rpc("mcp", accessToken, "tools/list", {}, 2);
  log(`status: ${tools.status}, count: ${tools.body?.result?.tools?.length}`);
  log("tools: " + (tools.body?.result?.tools || []).map((t) => t.name).join(", "));

  header("MCP: call apex_list_projects");
  const r1 = await rpc("mcp", accessToken, "tools/call", { name: "apex_list_projects", arguments: {} }, 3);
  log(`status: ${r1.status}, content[0].text first 400 chars:\n${(r1.body?.result?.content?.[0]?.text || "").slice(0, 400)}`);

  header("MCP: call apex_get_briefing");
  const r2 = await rpc("mcp", accessToken, "tools/call", { name: "apex_get_briefing", arguments: {} }, 4);
  log(`status: ${r2.status}, content first 600 chars:\n${(r2.body?.result?.content?.[0]?.text || "").slice(0, 600)}`);

  header("MCP: call apex_search_practices (q=carousel)");
  const r3 = await rpc("mcp", accessToken, "tools/call", { name: "apex_search_practices", arguments: { query: "carousel", limit: 3 } }, 5);
  log(`status: ${r3.status}, content first 500 chars:\n${(r3.body?.result?.content?.[0]?.text || "").slice(0, 500)}`);

  header("MCP: call apex_set_task (create new)");
  const r4 = await rpc("mcp", accessToken, "tools/call", {
    name: "apex_set_task",
    arguments: {
      project_id: "edge-auto",
      name: "Phase 4 MCP smoke test task",
      stage: "adhoc",
      status: "not_started",
      owner: "ginge",
      priority: "medium",
      description: "Created by phase4-mcp-local-test.mjs to verify apex_set_task end-to-end",
    },
  }, 6);
  log(`status: ${r4.status}, content first 600 chars:\n${(r4.body?.result?.content?.[0]?.text || "").slice(0, 600)}`);
  const created = r4.body?.result?.content?.[0]?.text || "";
  const createdIdMatch = created.match(/"id":\s*"([^"]+)"/);
  const createdId = createdIdMatch ? createdIdMatch[1] : null;
  log(`created task id: ${createdId}`);

  if (createdId) {
    header(`MCP: call apex_set_task (update existing ${createdId})`);
    const r5 = await rpc("mcp", accessToken, "tools/call", {
      name: "apex_set_task",
      arguments: {
        id: createdId,
        project_id: "edge-auto",
        name: "Phase 4 MCP smoke test task (updated)",
        status: "in_progress",
      },
    }, 7);
    log(`status: ${r5.status}, content first 400 chars:\n${(r5.body?.result?.content?.[0]?.text || "").slice(0, 400)}`);

    header(`MCP: call apex_complete_task (${createdId})`);
    const r6 = await rpc("mcp", accessToken, "tools/call", {
      name: "apex_complete_task",
      arguments: { id: createdId },
    }, 8);
    log(`status: ${r6.status}, content first 400 chars:\n${(r6.body?.result?.content?.[0]?.text || "").slice(0, 400)}`);
  }

  header("MCP: call apex_get_audit");
  const r7 = await rpc("mcp", accessToken, "tools/call", { name: "apex_get_audit", arguments: {} }, 9);
  log(`status: ${r7.status}, content first 600 chars:\n${(r7.body?.result?.content?.[0]?.text || "").slice(0, 600)}`);

  header("MCP: unauthenticated request should 401");
  const unauth = await fetch(`${BASE}/api/mcp/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }),
  });
  log(`status: ${unauth.status}, www-authenticate: ${unauth.headers.get("www-authenticate")}`);

  header("DONE — saving transcript");
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase4-mcp-local-test-${today}.txt`);
  writeFileSync(path, lines.join("\n") + "\n");
  log(`Wrote ${path}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
