# M6 Working Notes — dead code + README + release tag

Branch: `apex-magnificent`. Latest commit before M6: `b72b10b`.

## Pre-flight verification (2026-05-06)

- `git status` clean. `git log` confirms branch at b72b10b (M5).
- M5 outcome: IP Vault page now reads from `apex:practices:v1` via `/api/practices`; `vault:ip-entries` deleted; 8 practices marked DEPRECATED; 45 task changes applied.

## Running notes

### Dead route audit (1)
Grepped all 7 flagged routes (`/api/action-room`, `/api/map-room/{ip-vault, prompts, outputs, metrics, platform-rules}`) and `/api/squad/files`. Zero src callers in any of them — all references confined to `data/` and `scripts/` (historical phase logs).

Sub-routes confirmed:
- `/api/map-room/ip-vault/[id]` — same status as parent, no callers
- `/api/map-room/prompts/[id]`, `/api/map-room/outputs/[id]` — same

Considered but kept (defensive — M4 deferred, possible external consumers):
- `/api/status` GET (root)
- `/api/map-room/projects/{,/[id]}` GET — explicit M4 "should remain unless we confirm no MCP-style consumer"

### Deletions applied (2)
10 route files removed, 2 orphan files removed, ip-* sub-actions stripped from `/api/vault/route.ts`. Build clean (74 pages, was 81). Detail in `data/magnificent-m6-route-deletions.md`.

### Stripped from `/api/vault/route.ts`
- `IP_KV_KEY`, `IpEntry`, `IpStore`, `getIpStore()`, `saveIpStore()` — all targeted now-deleted `vault:ip-entries`
- `case "ip-list" | "ip-get" | "ip-set" | "ip-delete" | "ip-search"` from POST switch
- All other imports remained in use (encryption helpers, kv, auth)

### Orphan src/ files (3)
- `src/types.ts` — pre-Apex dashboard types (App, Idea, Agent, etc.); zero imports across src/. Deleted.
- `src/lib/agent-runs.ts` — apex:agent-runs:{agent}:{month} pattern with no MCP tool, no API route, no UI page reading it. Deleted.

### OpenClaw VM (4)
gcloud not installed in M6 environment. Per kill criterion #5: surfaced to Ginge for manual action. Steps documented in `data/openclaw-decommission-2026-05-06.md` (snapshot then delete instance + disk).

### README (5)
Created from scratch (README.md did not exist). Documents:
- Architecture diagram (Claude.ai → MCP → Vercel KV)
- Canonical KV stores table with purpose + lib reader + write path
- KV stores deleted across Magnificent (14 keys, ~898KB)
- Local development env vars
- MCP tools list (read-only + audited writes) + how-to for adding new tools
- Mission Control session pattern v3 reference (manual-8595cf1e)
- Phase 7 + Phase 8 backlog with practice IDs
- Magnificent sprint summary (M0-M6)
- Honest known divergences (defensive-keep routes, enrichment store, OpenClaw VM)
- Repo layout

### Production verification (6)
- Deploy `dpl_DvDHU27uc2dT7L2PwJqSqCpZYKrD` (apex-command-h6wzxhfhu-caliber1.vercel.app)
- `/api/practices` returns 188 items (was 187 in M5; one entry added since via MCP — likely audit log writes are working as intended)
- All pages 200 except /squad (307 redirect — pre-existing per M4)
- Deleted routes return 404 across the board
- MCP `apex_get_briefing` shows preserved canonical state — 6 active projects, 4 venture commitments lead your_actions, 4 dormant agents + Ginge active

### Kill criteria — none fired
1. Unexpected callers on routes flagged for deletion: none ✓
2. Build failures: none ✓
3. Production breaks: none ✓
4. README task understanding gaps: none — known divergences explicitly called out ✓
5. OpenClaw destructive action without verification: skipped (gcloud unavailable), surfaced to Ginge ✓


