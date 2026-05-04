#!/usr/bin/env node
// Phase 2 — verify-only pass against existing apex:practices:v1.
// Used to write the deliverable verify file without re-mutating KV
// (the previous --apply run wrote the key but was interrupted before
// the verify step completed).
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

const EXPECTED_VAULT_LAST_UPDATED = "2026-04-26T18:25:37.852Z";
const EXPECTED_IPV_LAST_UPDATED   = "2026-03-31T06:00:00Z";

async function main() {
  const practices = await kvGet("apex:practices:v1");
  const vault = await kvGet("vault:ip-entries");
  const ipv = await kvGet("maproom:ip-vault-v2");

  if (!practices) throw new Error("apex:practices:v1 missing");
  if (!Array.isArray(practices.items)) throw new Error("apex:practices:v1 has no items[]");

  const byOrigin = practices.items.reduce(
    (acc, x) => ((acc[x.origin_store ?? "(none)"] = (acc[x.origin_store ?? "(none)"] || 0) + 1), acc),
    {},
  );
  const vaultSamples = practices.items.filter((x) => x.origin_store === "vault-ip-entries").slice(0, 3);
  const ipvSamples = practices.items.filter((x) => x.origin_store === "maproom-ip-vault-v2").slice(0, 3);

  const verify = {
    verified_at: new Date().toISOString(),
    apex_practices_v1: {
      lastUpdated: practices.lastUpdated,
      total: practices.items.length,
      by_origin_store: byOrigin,
    },
    legacy_stores_untouched: {
      "vault:ip-entries": {
        lastUpdated_observed: vault?.lastUpdated,
        lastUpdated_expected: EXPECTED_VAULT_LAST_UPDATED,
        unchanged: vault?.lastUpdated === EXPECTED_VAULT_LAST_UPDATED,
        items_count: vault?.items?.length ?? 0,
      },
      "maproom:ip-vault-v2": {
        lastUpdated_observed: ipv?.lastUpdated,
        lastUpdated_expected: EXPECTED_IPV_LAST_UPDATED,
        unchanged: ipv?.lastUpdated === EXPECTED_IPV_LAST_UPDATED,
        sections_count: ipv?.sections?.length ?? 0,
      },
    },
    spot_check_vault_ip_entries: vaultSamples.map((x) => ({
      id: x.id,
      category: x.category,
      title: (x.title || "").slice(0, 80),
      tags: x.tags,
      source: x.source,
      content_chars: (x.content || "").length,
    })),
    spot_check_maproom_ip_vault_v2: ipvSamples.map((x) => ({
      id: x.id,
      category: x.category,
      title: (x.title || "").slice(0, 80),
      source: x.source,
      content_chars: (x.content || "").length,
      content_preview: (x.content || "").slice(0, 200),
    })),
  };

  const today = new Date().toISOString().slice(0, 10);
  const path = join(ROOT, "data", `phase2-practices-verify-${today}.json`);
  writeFileSync(path, JSON.stringify(verify, null, 2));
  console.log(`Wrote ${path}`);

  const v = verify.legacy_stores_untouched;
  if (!v["vault:ip-entries"].unchanged || !v["maproom:ip-vault-v2"].unchanged) {
    console.error("KILL CRITERION: legacy store lastUpdated drifted");
    process.exit(2);
  }
  console.log("\nSummary:");
  console.log(`  apex:practices:v1 total: ${verify.apex_practices_v1.total}`);
  console.log(`  by origin: ${JSON.stringify(byOrigin)}`);
  console.log(`  vault:ip-entries unchanged: ${v["vault:ip-entries"].unchanged}`);
  console.log(`  maproom:ip-vault-v2 unchanged: ${v["maproom:ip-vault-v2"].unchanged}`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
