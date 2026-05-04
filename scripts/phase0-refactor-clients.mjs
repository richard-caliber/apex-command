#!/usr/bin/env node
// Phase 0 — strip the apex-live-2026 token from client pages.
// Browsers send the apex_session HttpOnly cookie automatically on same-origin
// fetches, so we just remove the Authorization header and the const TOKEN line.

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const APP_DIR = join(ROOT, "src", "app");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (name === "page.tsx") files.push(p);
  }
  return files;
}

const TOKEN_VARIANTS = String.raw`(\`Bearer \$\{TOKEN\}\`|"Bearer apex-live-2026")`;

function transform(src) {
  let out = src;

  // 1. Drop "..., Authorization: <token>" — Authorization preceded by another header.
  out = out.replace(new RegExp(`,\\s*Authorization:\\s*${TOKEN_VARIANTS}`, "g"), "");

  // 2. Drop "Authorization: <token>,\n" — Authorization on its own line with trailing comma.
  out = out.replace(new RegExp(`Authorization:\\s*${TOKEN_VARIANTS},[ \\t]*\\n?`, "g"), "");

  // 3. Drop "Authorization: <token>" — Authorization alone (no surrounding comma).
  out = out.replace(new RegExp(`Authorization:\\s*${TOKEN_VARIANTS}`, "g"), "");

  // 4. Remove the const TOKEN line.
  out = out.replace(/^[ \t]*const\s+TOKEN\s*=\s*"apex-live-2026"\s*;?\s*\n/m, "");

  // 5. Tidy up: an empty `headers: { }` / `headers: {  }` is fine, leave it.
  return out;
}

const files = walk(APP_DIR);
let touched = 0, skipped = 0;
const remaining = [];

for (const f of files) {
  const before = readFileSync(f, "utf8");
  const after = transform(before);
  if (after !== before) {
    writeFileSync(f, after);
    touched++;
    console.log("rewrote:", relative(ROOT, f));
  } else {
    skipped++;
  }
  if (/apex-live-2026/.test(after)) remaining.push(relative(ROOT, f));
}

console.log("\nSummary:", touched, "rewritten,", skipped, "unchanged");
if (remaining.length) {
  console.log("\nFILES WITH REMAINING TOKEN STRING:");
  for (const f of remaining) console.log(" -", f);
  process.exit(2);
}
