#!/usr/bin/env node
// M4 batch deleter. Pass one or more keys as args; deletes them from KV
// after capturing their current value into the cumulative deletion log.
// Reversible: log holds the pre-delete bytes for any key.
//
// Usage: node scripts/m4-delete-batch.mjs <key1> <key2> ...

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");
const TODAY = new Date().toISOString().slice(0, 10);
const LOG_PATH = join(ROOT, "data", `magnificent-m4-deletions-${TODAY}.json`);

function loadEnv() {
  const txt = readFileSync(ENV_FILE, "utf8");
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const KV_URL = env.KV_REST_API_URL;
const KV_TOKEN = env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

async function kvDel(key) {
  const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV DEL ${key} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main(keys) {
  if (!keys.length) throw new Error("Pass one or more keys to delete");

  let log = { applied_at_first: new Date().toISOString(), deletions: [] };
  if (existsSync(LOG_PATH)) {
    log = JSON.parse(readFileSync(LOG_PATH, "utf8"));
  }

  for (const key of keys) {
    const before = await kvGet(key);
    const beforeSize =
      before === null || before === undefined
        ? 0
        : typeof before === "string"
        ? before.length
        : JSON.stringify(before).length;

    const delRes = await kvDel(key);
    const after = await kvGet(key);
    const ok = after === null || after === undefined;

    log.deletions.push({
      key,
      deleted_at: new Date().toISOString(),
      before_size_bytes: beforeSize,
      before_value: before === null || before === undefined ? null : before,
      del_response: delRes,
      verified_absent_after: ok,
    });

    console.log(
      `${key}: was ${beforeSize}B, del=${JSON.stringify(delRes)}, absent=${ok}`,
    );
  }

  log.last_updated = new Date().toISOString();
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`\nLog: ${LOG_PATH} (${log.deletions.length} total deletions)`);
}

main(process.argv.slice(2)).catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
