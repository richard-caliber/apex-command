#!/usr/bin/env node
// Bootstrap the five active ventures with initial context docs in
// apex:project-context:v1. Reads .env.local for APEX_API_TOKEN, walks OAuth,
// resolves expected venture names to project_ids via apex_list_projects, halts
// on missing Poker OS or a duplicate rawai/rawai-villas project, then writes
// each doc via apex_set_project_context. Writes a JSON log to data/.
//
// Usage: APEX_BASE=http://localhost:3000 node scripts/project-context-bootstrap.mjs
// Or:    APEX_BASE=https://apex-command-seven.vercel.app node scripts/project-context-bootstrap.mjs

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
const LABEL = process.env.APEX_LABEL || (BASE.includes("localhost") ? "local" : "prod");
const APEX_TOKEN = env.APEX_API_TOKEN;
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const log = [];
const note = (msg) => { console.log(msg); log.push({ ts: new Date().toISOString(), msg }); };

// ───────── OAuth plumbing (same pattern as phase4.1-mcp-test.mjs) ─────────

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

async function callTool(token, name, args, id) {
  return rpc(token, "tools/call", { name, arguments: args }, id);
}

function parseToolJson(rpcResp) {
  const text = rpcResp.body?.result?.content?.[0]?.text || "";
  const idx = text.indexOf("\n\n");
  if (idx < 0) return null;
  try { return JSON.parse(text.slice(idx + 2)); } catch { return null; }
}

async function oauth() {
  const reg = await postJson(`${BASE}/api/mcp/oauth/register`, {
    redirect_uris: [REDIRECT],
    client_name: `bootstrap-${LABEL}-${Date.now()}`,
  });
  if (reg.status !== 201) throw new Error(`DCR failed: ${reg.status}`);
  const clientId = reg.body.client_id;
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(8).toString("base64url");
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
  if (authPost.status !== 302) throw new Error(`authorize POST failed: ${authPost.status}`);
  const code = new URL(authPost.location).searchParams.get("code");
  const tok = await postJson(`${BASE}/api/mcp/oauth/token`, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT,
    client_id: clientId,
  });
  if (tok.status !== 200) throw new Error(`token exchange failed: ${tok.status}`);
  return tok.body.access_token;
}

// ───────── Resolve expected ventures → project_ids ─────────

const EXPECTED = [
  { label: "Todd-Safent", aliases: ["todd-safent", "todd-saifent", "todd safent", "safent"] },
  { label: "Caliber Peptides", aliases: ["caliber peptides", "caliber"] },
  { label: "Atlas Drift", aliases: ["atlas drift", "atlas-drift"] },
  { label: "Rawai Villas", aliases: ["rawai villas", "rawai-villas", "rawai", "phuket villas", "villas"] },
  { label: "Poker OS", aliases: ["poker os", "poker-os", "pokeros"] },
];

function resolveProject(allProjects, expected) {
  const lc = (s) => (s ?? "").toString().toLowerCase().trim();
  // Try exact id match, then exact name match, then substring on either.
  for (const alias of expected.aliases) {
    const exactId = allProjects.find((p) => lc(p.id) === alias);
    if (exactId) return { match: exactId, mode: "exact-id", alias };
    const exactName = allProjects.find((p) => lc(p.name) === alias);
    if (exactName) return { match: exactName, mode: "exact-name", alias };
  }
  for (const alias of expected.aliases) {
    const subId = allProjects.find((p) => lc(p.id).includes(alias));
    if (subId) return { match: subId, mode: "substring-id", alias };
    const subName = allProjects.find((p) => lc(p.name).includes(alias));
    if (subName) return { match: subName, mode: "substring-name", alias };
  }
  return null;
}

// ───────── Bootstrap content (texture from MEMORY.md as of 2026-05-20) ─────────

const BOOTSTRAP_BODIES = {
  "Todd-Safent": {
    current_state:
      "WordPress hosting for Todd's safent.com.au is live on a GCP e2-micro in Sydney (Apache 2.4 + PHP 8.1 + MySQL 8). Let's Encrypt SSL auto-renews 2026-06-20. Costing ~£155/yr to run; Todd pays £250/yr — modest margin. Setup was a favour (setup fee waived); DNS lives at the Australian registrar DDNS, which Todd controls.",
    active_hypotheses: [
      "Per-client managed WordPress could become a productised side-line at ~£95/yr margin if 5+ clients can be onboarded onto the same Sydney box.",
    ],
    open_questions: [
      "Should the hosting offer be formalised as a productised service, or kept as one-off favours?",
      "Is anything brittle in the unattended SSL renewal path when 2026-06-20 hits?",
    ],
    stakeholder_notes: [
      {
        name: "Todd",
        note: "Pays annually upfront. Manages DNS at DDNS himself. Low-touch — no issues raised since 2026-03-21 setup.",
      },
    ],
    recent_decisions: [
      {
        decision: "Bundle SSL + basic maintenance into the £250/yr price rather than charging extras",
        rationale:
          "Margin is already thin enough that nickel-and-diming the favour would damage the relationship. SSL is automated; maintenance is rare.",
      },
    ],
  },

  "Caliber Peptides": {
    current_state:
      "Caliber Peptides e-commerce site is live on Vercel. NOWPayments crypto checkout (BTC/ETH/USDT) plus bank transfer via email/Telegram — Stripe rejected (high-risk vertical). Affiliate coupon system shipped 2026-04-24 with snapshot commission model. Server-side authoritative pricing in src/lib/pricing.ts. Funnel converts; first sale still pending.",
    active_hypotheses: [
      "First sale will come from network outreach, not paid traffic — paid acquisition for crypto-only checkout is a steep ask.",
      "Affiliate coupons will be the cheapest customer-acquisition lever once 2-3 partners are onboarded.",
    ],
    open_questions: [
      "Is the crypto-only checkout suppressing conversion, or is awareness the bottleneck?",
      "Should fiat-to-crypto on-ramp (NOWPayments Mercuryo vs. high-risk gateways) be evaluated now or after the first 10 sales?",
    ],
    stakeholder_notes: [],
    recent_decisions: [
      {
        decision: "Snapshot affiliate commission rates at order time, not retroactively",
        rationale:
          "Prevents future rate changes from re-pricing already-paid orders. Keeps the ledger clean and partner expectations stable.",
      },
      {
        decision: "Defer fiat checkout track until first 10 sales",
        rationale:
          "Peptides vertical is rejected by mainstream card processors. NOWPayments + bank transfer is the only path until volume justifies high-risk gateway diligence.",
      },
    ],
  },

  "Atlas Drift": {
    current_state:
      "Atlas Drift live at atlas-drift.vercel.app. Days 1, 2, 3, 3.5 shipped. Day 3.5 trust layer: Haiku 4.5 generates 3-sentence neutral explainers per top-3 city, cached on quiz_sessions.adjustments.narratives via waitUntil. atlasdrift.org domain alias claimed in Vercel; registrar still on parking page. Voice writing block (8-10 founder few-shots) gates Day 4.",
    active_hypotheses: [
      "Honest editorial voice (Economist-tone, founder lived 8 SEA cities) is the differentiator against Nomadlist's sanitised content and Nomad Capitalist's £25k consult.",
      "Free PDF brief + email capture funnel will out-convert a paid-from-day-one approach for the SEA nomad/expat ICP.",
    ],
    open_questions: [
      "Will founder voice few-shot examples land in time to gate Day 4, or does the build slip?",
      "Do the 19 Tier-B cities ('Atlas hasn't been here yet' disclaimers) hurt trust, or is the honesty net positive?",
    ],
    stakeholder_notes: [],
    recent_decisions: [
      {
        decision:
          "Lock §5 scoring with dynamic burn weight, income-conditional internet weight, explicit 'vibe is not a factor'",
        rationale:
          "Founder validated rules 2026-04-27. Prevents scoring drift between days; vibe is surfaced via dataset fields not weights.",
      },
    ],
  },

  "Rawai Villas": {
    current_state:
      "Phuket Villas portfolio (90M THB total value) is listed and live; buyers delayed. Pivoting outreach from direct buyers to Phuket agencies. Investor-page build queued via Antigravity pipeline.",
    active_hypotheses: [
      "Selling to top 4 Phuket agencies (B2B) will close faster than direct-to-buyer outreach at this price tier.",
      "An investor-grade landing page with ROI calculators is the artefact agents need to forward to their buyer networks.",
    ],
    open_questions: [
      "Which of the top 4 Phuket agencies actually have buyers at this price tier?",
      "Is the 90M THB value being benchmarked against the right comparable portfolio?",
    ],
    stakeholder_notes: [],
    recent_decisions: [],
  },

  "Poker OS": {
    // Filled in if/when Ginge seeds the project record. Placeholder body unused
    // — bootstrap halts before this line is read.
    current_state: "",
    active_hypotheses: [],
    open_questions: [],
    stakeholder_notes: [],
    recent_decisions: [],
  },
};

// ───────── Main ─────────

async function main() {
  note(`Bootstrap starting @ ${new Date().toISOString()}`);
  note(`BASE = ${BASE}, LABEL = ${LABEL}`);

  const token = await oauth();
  note(`OAuth OK — access token acquired`);

  // 1. List all projects.
  const listResp = await callTool(token, "apex_list_projects", {}, 1);
  const allProjects = parseToolJson(listResp);
  if (!Array.isArray(allProjects)) {
    throw new Error(`apex_list_projects did not return an array: ${JSON.stringify(listResp).slice(0, 400)}`);
  }
  note(`Loaded ${allProjects.length} projects from apex:warroom:projects`);

  // 2. Pre-flight: sanity check for a SEPARATE rawai/rawai-villas project hiding
  //    alongside villas. If the same record matches both filters by name+id, that's
  //    not a duplicate — it's one project with "rawai" in its name. Only halt when
  //    the matches are distinct records.
  const lc = (s) => (s ?? "").toString().toLowerCase().trim();
  const rawaiMatches = allProjects.filter(
    (p) => lc(p.id).includes("rawai") || lc(p.name).includes("rawai"),
  );
  const villasMatches = allProjects.filter(
    (p) => lc(p.id) === "villas" || lc(p.name).includes("phuket villas"),
  );
  const distinctIds = new Set([
    ...rawaiMatches.map((p) => p.id),
    ...villasMatches.map((p) => p.id),
  ]);
  if (rawaiMatches.length > 0 && villasMatches.length > 0 && distinctIds.size > 1) {
    note(`HALT: separate Rawai project found alongside villas`);
    note(`  rawai matches: ${rawaiMatches.map((p) => `${p.id} (${p.name})`).join(", ")}`);
    note(`  villas matches: ${villasMatches.map((p) => `${p.id} (${p.name})`).join(", ")}`);
    note(`Action: decide which is the canonical Rawai Villas record, archive the other, re-run.`);
    persistLog({ halted: true, reason: "duplicate-rawai-and-villas", rawaiMatches, villasMatches });
    process.exit(2);
  }

  // 3. Resolve each expected venture to a project record.
  const resolved = [];
  const missing = [];
  for (const expected of EXPECTED) {
    const r = resolveProject(allProjects, expected);
    if (r) {
      resolved.push({ expected, ...r });
      note(`  ✓ ${expected.label} → ${r.match.id} ("${r.match.name}") via ${r.mode}:"${r.alias}"`);
    } else {
      missing.push(expected);
      note(`  ✗ ${expected.label} — no project found (tried: ${expected.aliases.join(", ")})`);
    }
  }

  // 4. Halt on missing Poker OS (per Ginge's directive). Continue if any others missing,
  //    but call them out clearly.
  const pokerMissing = missing.find((m) => m.label === "Poker OS");
  if (pokerMissing) {
    note(`HALT: Poker OS project not found in apex:warroom:projects`);
    note(`Action required: decide whether to seed Poker OS as a project (via apex_set_project) or skip its bootstrap. Re-run this script after.`);
    note(`Other ventures still missing: ${missing.filter((m) => m.label !== "Poker OS").map((m) => m.label).join(", ") || "none"}`);
    note(`Resolved (would have bootstrapped): ${resolved.map((r) => `${r.expected.label} → ${r.match.id}`).join("; ")}`);
    persistLog({ halted: true, reason: "poker-os-missing", resolved, missing });
    process.exit(1);
  }
  if (missing.length > 0) {
    note(`Continuing with ${resolved.length}/${EXPECTED.length} ventures; missing: ${missing.map((m) => m.label).join(", ")}`);
  }

  // 5. Write context docs.
  const written = [];
  let id = 100;
  for (const r of resolved) {
    const body = BOOTSTRAP_BODIES[r.expected.label];
    if (!body) {
      note(`  SKIP ${r.expected.label} — no bootstrap body defined`);
      continue;
    }
    if (!body.current_state) {
      note(`  SKIP ${r.expected.label} — bootstrap body has empty current_state`);
      continue;
    }
    note(`Writing context for ${r.match.id} (${r.expected.label})…`);
    const args = {
      project_id: r.match.id,
      current_state: body.current_state,
      active_hypotheses: body.active_hypotheses,
      open_questions: body.open_questions,
      stakeholder_notes: body.stakeholder_notes,
      recent_decisions: body.recent_decisions,
    };
    const resp = await callTool(token, "apex_set_project_context", args, id++);
    const isError = resp.body?.result?.isError ?? false;
    const text = resp.body?.result?.content?.[0]?.text || "";
    if (isError) {
      note(`  ✗ ${r.match.id} — ERROR: ${text.slice(0, 300)}`);
      written.push({ project_id: r.match.id, label: r.expected.label, ok: false, error: text });
    } else {
      const summary = text.split("\n\n")[0];
      note(`  ✓ ${r.match.id} — ${summary}`);
      written.push({ project_id: r.match.id, label: r.expected.label, ok: true, summary });
    }
    // Name-divergence note (one-time housekeeping per Ginge: log once, don't repeat).
    const lcLabel = lc(r.expected.label);
    if (lc(r.match.name) !== lcLabel && !lc(r.match.name).includes(lcLabel)) {
      note(`  ℹ name-divergence: bootstrap target "${r.expected.label}" stored as project "${r.match.name}" (id=${r.match.id})`);
    }
  }

  note(`Bootstrap complete: ${written.filter((w) => w.ok).length}/${EXPECTED.length} written`);
  persistLog({ halted: false, resolved, missing, written });
}

function persistLog(extra) {
  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `project-context-bootstrap-${LABEL}-${today}.json`);
  const payload = {
    started_at: log[0]?.ts ?? new Date().toISOString(),
    finished_at: new Date().toISOString(),
    base: BASE,
    label: LABEL,
    log,
    ...extra,
  };
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${path}`);
}

main().catch((e) => {
  note(`FAILED: ${e.stack || e.message}`);
  persistLog({ halted: true, reason: "exception", error: String(e) });
  process.exit(1);
});
