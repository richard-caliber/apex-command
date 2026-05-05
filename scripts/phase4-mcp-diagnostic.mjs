#!/usr/bin/env node
// Phase 4 — production MCP diagnostic.
// Goal: act as an MCP client end-to-end and verify whether the server is correctly
// advertising its tools when authenticated. Specifically dumps the full tools/list
// schema so we can compare against the format Claude.ai's connector expects.
// Saves transcript to data/phase4-mcp-diagnostic-{ISO-date}.txt.

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

const BASE = process.env.APEX_BASE || "https://apex-command-seven.vercel.app";
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
  return { status: res.status, headers: Object.fromEntries(res.headers), body: json };
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
  return { status: res.status, contentType: res.headers.get("content-type"), body, raw: text };
}

async function main() {
  log(`Phase 4 MCP production diagnostic @ ${new Date().toISOString()}`);
  log(`BASE = ${BASE}`);
  log(`Goal: verify whether tools surfacing in Claude.ai connector UI but not in chat is a server-side or client-side issue.`);

  // ── Sanity: unauthenticated request returns 401 + WWW-Authenticate ──
  header("Sanity: GET /api/mcp/mcp without auth");
  const sanity = await fetch(`${BASE}/api/mcp/mcp`);
  log(`status: ${sanity.status}`);
  log(`www-authenticate: ${sanity.headers.get("www-authenticate")}`);
  log(`body: ${(await sanity.text()).slice(0, 200)}`);

  // ── Well-known endpoints ──
  header("well-known: oauth-protected-resource");
  const prs = await fetch(`${BASE}/.well-known/oauth-protected-resource`).then((r) => r.json());
  log(JSON.stringify(prs, null, 2));

  header("well-known: oauth-authorization-server");
  const ass = await fetch(`${BASE}/.well-known/oauth-authorization-server`).then((r) => r.json());
  log(JSON.stringify(ass, null, 2));

  // ── DCR ──
  header("DCR: POST /api/mcp/oauth/register");
  const reg = await postJson(`${BASE}/api/mcp/oauth/register`, {
    redirect_uris: [REDIRECT],
    client_name: "phase4-prod-diagnostic-2026-05-05",
  });
  log(`status: ${reg.status}\n${JSON.stringify(reg.body, null, 2)}`);
  if (reg.status !== 201) throw new Error("DCR failed");
  const clientId = reg.body.client_id;

  // ── Authorize: PKCE → form POST → callback with code ──
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

  // ── Token exchange ──
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

  // ── MCP initialize ──
  header("MCP: initialize");
  const init = await rpc(accessToken, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "phase4-prod-diagnostic", version: "1.0.0" },
  });
  log(`status: ${init.status}, content-type: ${init.contentType}`);
  log(`raw transport response (first 400 chars):\n${init.raw.slice(0, 400)}`);
  log(`parsed body:\n${JSON.stringify(init.body, null, 2)}`);

  // ── tools/list — FULL schema dump ──
  header("MCP: tools/list (FULL response, not just names)");
  const tools = await rpc(accessToken, "tools/list", {}, 2);
  log(`status: ${tools.status}, content-type: ${tools.contentType}`);
  const toolList = tools.body?.result?.tools || [];
  log(`tool count: ${toolList.length}`);
  log("tool names: " + toolList.map((t) => t.name).join(", "));
  log("\nFULL tools/list result body:");
  log(JSON.stringify(tools.body, null, 2));

  // ── Format compatibility checks against MCP spec / Claude.ai connector format ──
  header("Format compatibility: per-tool field analysis");
  const findings = [];
  for (const t of toolList) {
    const checks = {
      has_name: typeof t.name === "string" && t.name.length > 0,
      has_description: typeof t.description === "string" && t.description.length > 0,
      has_inputSchema: !!t.inputSchema,
      inputSchema_is_object: t.inputSchema && t.inputSchema.type === "object",
      inputSchema_has_properties: t.inputSchema && typeof t.inputSchema.properties === "object",
      has_title: typeof t.title === "string",
      // Claude.ai/MCP common compatibility checks
      name_matches_pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/.test(t.name || ""),
      name_under_64: (t.name || "").length <= 64,
      description_under_1024: (t.description || "").length < 1024,
    };
    findings.push({ name: t.name, checks, schema_snapshot: t.inputSchema });
  }
  log(JSON.stringify(findings, null, 2));

  // ── Tool call: apex_list_projects ──
  header("MCP: tools/call apex_list_projects");
  const r1 = await rpc(accessToken, "tools/call", { name: "apex_list_projects", arguments: {} }, 3);
  log(`status: ${r1.status}, content-type: ${r1.contentType}`);
  log(`response shape:`);
  log(JSON.stringify({
    has_result: !!r1.body?.result,
    has_content: Array.isArray(r1.body?.result?.content),
    content_length: r1.body?.result?.content?.length,
    first_content_type: r1.body?.result?.content?.[0]?.type,
    first_text_length: (r1.body?.result?.content?.[0]?.text || "").length,
  }, null, 2));
  log(`first_text first 400 chars:\n${(r1.body?.result?.content?.[0]?.text || "").slice(0, 400)}`);

  // ── Tool call: apex_get_briefing (composite) ──
  header("MCP: tools/call apex_get_briefing");
  const r2 = await rpc(accessToken, "tools/call", { name: "apex_get_briefing", arguments: {} }, 4);
  log(`status: ${r2.status}, content-type: ${r2.contentType}`);
  log(`first_text first 400 chars:\n${(r2.body?.result?.content?.[0]?.text || "").slice(0, 400)}`);

  // ── Done ──
  header("DONE — saving transcript");
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase4-mcp-diagnostic-${today}.txt`);
  writeFileSync(path, lines.join("\n") + "\n");
  log(`Wrote ${path}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  lines.push(`\n!! FAILED: ${e.stack || e.message}`);
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase4-mcp-diagnostic-${today}.txt`);
  try { writeFileSync(path, lines.join("\n") + "\n"); } catch {}
  process.exit(1);
});
