# M6 Route + Dead Code Deletions (2026-05-06)

Build before: 81 routes. Build after: 74 routes.

## Routes deleted (zero src callers verified via grep)

| Path | Reason |
|---|---|
| `src/app/api/action-room/route.ts` | Reads/writes `apex:action-room:feed` + `:suggestions` (deleted M4). No src caller. |
| `src/app/api/squad/files/route.ts` | PUT-only, no caller. Phase 0 + Phase 1 finding "no consumer + caused destructive write." |
| `src/app/api/map-room/ip-vault/route.ts` | Reads `maproom:ip-vault-v2` (deleted M4). Replaced by `/api/practices` in M5. |
| `src/app/api/map-room/ip-vault/[id]/route.ts` | Same. |
| `src/app/api/map-room/prompts/route.ts` | Reads `maproom:prompts` (deleted M4). Canonical is `apex:prompts:v2`. |
| `src/app/api/map-room/prompts/[id]/route.ts` | Same. |
| `src/app/api/map-room/outputs/route.ts` | Reads `maproom:outputs` (deleted M4). |
| `src/app/api/map-room/outputs/[id]/route.ts` | Same. |
| `src/app/api/map-room/metrics/route.ts` | Reads `maproom:metrics` (deleted M4). |
| `src/app/api/map-room/platform-rules/route.ts` | Reads `maproom:platform-rules` (deleted M4). |

## Code stripped from existing files

### `src/app/api/vault/route.ts`
- Removed `IP_KV_KEY`, `IpEntry`, `IpStore`, `getIpStore()`, `saveIpStore()` (all targeted the now-deleted `vault:ip-entries`).
- Removed `case "ip-list" | "ip-get" | "ip-set" | "ip-delete" | "ip-search"` from POST switch.
- Route now only handles api-keys (list/get/set/delete + verify-password). All imports remain in use.

## Orphan files deleted

| Path | Reason |
|---|---|
| `src/types.ts` | Zero imports across src/ (`App`, `Idea`, `Agent`, etc. dashboard types from a pre-Apex era). |
| `src/lib/agent-runs.ts` | Zero imports across src/. KV pattern `apex:agent-runs:{agentId}:{month}` had no MCP tool, no API route, no UI page reading it. Restored from git if revived. |

## Routes considered but kept (defensive — no internal caller, but external consumers possible)

| Path | Reason for keep |
|---|---|
| `src/app/api/status/route.ts` (GET) | M4 left as canonical-shape wrapper. No internal caller, but external HTTP consumers possible. Harmless thin wrapper. |
| `src/app/api/status/[projectId]/route.ts` (GET) | Used by `src/app/project/[id]/page.tsx`. Real caller — keep. |
| `src/app/api/status/[projectId]/tasks/route.ts` (POST 410 Gone) | Intentional marker per M4. Documents retirement, costs nothing. |
| `src/app/api/map-room/projects/route.ts` (GET) | M4 explicit defer: "should remain unless we confirm no MCP-style consumer hits it." No internal caller; external consumers possible. Keep. |
| `src/app/api/map-room/projects/[id]/route.ts` (GET) | Same as above. |

## Verification

- `npm run build` clean (74 pages prerendered, was 81).
- No broken imports.
- No type errors.
- Production deploy + MCP verification deferred to M6 deliverable 6.

## Files NOT touched (out of M6 scope)

- `/api/vault` api-keys logic — alive and used by /schematics/keys page.
- `/api/practices` — fresh in M5, canonical, alive.
- `/api/squad` GET — used by squad page.
- All `/api/projects`, `/api/pipeline-tasks`, `/api/project/[id]` — canonical, alive.
- All `/api/map-room/{capabilities,heartbeat,ideas,tasks,projects,posts,flow-map}` — verified alive callers.
- All `/api/mcp/[transport]` — MCP server, alive.
