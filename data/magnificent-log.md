# Apex Magnificent Sprint Log

## M0 — Pre-sprint setup (2026-05-05)

- Branch `apex-magnificent` created off `master` (default branch is master, not main).
- Baseline KV snapshot: `data/magnificent-baseline-2026-05-05.json` — 57 keys captured, 6 expected nulls (`apex:squad:v2`, `apex:action-room:feed`, `apex:action-room:suggestions`, `maproom:outputs`, `maproom:metrics`, `maproom:platform-rules`).
- Snapshot script: `scripts/magnificent-baseline.mjs` (cloned from `phase1-kv-snapshot.mjs` with new output path; added `apex:practices:v1` to the known-keys list since Phase 2 introduced it).
- `npm install` clean.
- `npm run build` succeeded.
