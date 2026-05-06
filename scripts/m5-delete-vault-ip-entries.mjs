#!/usr/bin/env node
// M5 — capture vault:ip-entries pre-deletion value to log, then delete.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const ENV_FILE = join(ROOT, ".env.local");
const LOG = join(ROOT, "data", `magnificent-m5-vault-ip-entries-deletion-${new Date().toISOString().slice(0, 10)}.json`);

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
  if (!res.ok) throw new Error(`KV GET ${key} ${res.status}`);
  const json = await res.json();
  return json.result;
}

async function kvDel(key) {
  const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV DEL ${key} ${res.status}`);
  return res.json();
}

const KEY = "vault:ip-entries";

const main = async () => {
  console.log(`Fetching ${KEY}...`);
  const value = await kvGet(KEY);
  if (value == null) {
    console.log(`${KEY} already null/absent. Nothing to delete.`);
    return;
  }
  const valueString = typeof value === "string" ? value : JSON.stringify(value);
  const sizeBytes = Buffer.byteLength(valueString, "utf8");
  console.log(`Captured ${sizeBytes} bytes.`);

  const log = {
    timestamp: new Date().toISOString(),
    phase: "M5",
    operation: "delete",
    key: KEY,
    sizeBytes,
    note: "IP vault page refactored to read from apex:practices:v1 in M5 (src/lib/practices.ts + /api/practices). vault:ip-entries deletion deferred from M4 due to live caller; caller now uses canonical store.",
    preDeletionValue: typeof value === "object" ? value : valueString,
  };
  writeFileSync(LOG, JSON.stringify(log, null, 2), "utf8");
  console.log(`Logged to ${LOG}`);

  console.log(`Deleting ${KEY}...`);
  await kvDel(KEY);

  // Verify
  const after = await kvGet(KEY);
  if (after !== null) {
    console.error(`DELETION FAILED — ${KEY} still has value: ${JSON.stringify(after).slice(0, 100)}`);
    process.exit(1);
  }
  console.log(`✓ ${KEY} deleted. Rollback: data in ${LOG}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
