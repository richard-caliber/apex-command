#!/usr/bin/env node
// Phase 0 — refactor every API write route to use requireWriteAuth.
// Removes `const TOKEN = "apex-live-2026";` and replaces the auth check.
// Idempotent: skips files already migrated.

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const API_DIR = join(ROOT, "src", "app", "api");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (name === "route.ts") files.push(p);
  }
  return files;
}

function transform(src) {
  let changed = false;

  // 1. Remove the const TOKEN line.
  const tokenLine = /^\s*const\s+TOKEN\s*=\s*"apex-live-2026"\s*;?\s*\n/m;
  if (tokenLine.test(src)) {
    src = src.replace(tokenLine, "");
    changed = true;
  }

  // 2. Replace multi-line auth check.
  //    const auth = req.headers.get("authorization");
  //    if (auth !== `Bearer ${TOKEN}`) {
  //      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  //    }
  const multi = /(\s*)const\s+auth\s*=\s*req\.headers\.get\("authorization"\);\s*\n\s*if\s*\(\s*auth\s*!==\s*`Bearer\s*\$\{TOKEN\}`\s*\)\s*\{\s*\n\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;?\s*\n\s*\}/g;
  if (multi.test(src)) {
    src = src.replace(multi, (_m, indent) => `${indent}const unauthorized = requireWriteAuth(req);\n${indent}if (unauthorized) return unauthorized;`);
    changed = true;
  }

  // 3. Replace single-line auth check.
  //    const auth = req.headers.get("authorization");
  //    if (auth !== `Bearer ${TOKEN}`) return NextResponse.json(...);
  const single = /(\s*)const\s+auth\s*=\s*req\.headers\.get\("authorization"\);\s*\n\s*if\s*\(\s*auth\s*!==\s*`Bearer\s*\$\{TOKEN\}`\s*\)\s+return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;?/g;
  if (single.test(src)) {
    src = src.replace(single, (_m, indent) => `${indent}const unauthorized = requireWriteAuth(req);\n${indent}if (unauthorized) return unauthorized;`);
    changed = true;
  }

  // 4. Add the import if needed and not already present.
  if (changed && !/from\s+"@\/lib\/auth"/.test(src)) {
    // Insert after the last existing import statement at the top.
    const importBlockMatch = src.match(/^(?:import[^\n]+\n)+/);
    if (importBlockMatch) {
      const block = importBlockMatch[0];
      src = src.replace(block, block + 'import { requireWriteAuth } from "@/lib/auth";\n');
    } else {
      src = 'import { requireWriteAuth } from "@/lib/auth";\n' + src;
    }
  }

  return { src, changed };
}

const files = walk(API_DIR);
let touched = 0, skipped = 0;
const remainingTokenRefs = [];

for (const f of files) {
  const before = readFileSync(f, "utf8");
  const { src, changed } = transform(before);
  if (changed) {
    writeFileSync(f, src);
    touched++;
    console.log("rewrote:", relative(ROOT, f));
  } else {
    skipped++;
  }
  // Sanity: any leftover token references?
  if (/apex-live-2026|`Bearer \$\{TOKEN\}`|const TOKEN = "apex-live/.test(src)) {
    remainingTokenRefs.push(relative(ROOT, f));
  }
}

console.log("\nSummary:", touched, "rewritten,", skipped, "unchanged");
if (remainingTokenRefs.length) {
  console.log("\nFILES WITH REMAINING TOKEN REFERENCES (need manual review):");
  for (const f of remainingTokenRefs) console.log(" -", f);
  process.exit(2);
}
