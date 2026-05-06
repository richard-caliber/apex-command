# M6 Verification (2026-05-06)

## Production deploy
- Deployment ID: `dpl_DvDHU27uc2dT7L2PwJqSqCpZYKrD`
- URL: https://apex-command-h6wzxhfhu-caliber1.vercel.app
- Aliased: https://apex-command-seven.vercel.app
- Status: READY, deploy 41s

## Build counts
- Before M6: 81 pages
- After M6: 74 pages
- Routes deleted: 7 path roots (10 route.ts files including [id] sub-routes)

## Endpoint sweep (production)
| Path | Status |
|---|---|
| `/` | 200 |
| `/action-room` | 200 |
| `/map-room/pipeline` | 200 |
| `/machine-room/automation-map` | 200 |
| `/schematics/ip-vault` | 200 |
| `/schematics/keys` | 200 |
| `/squad` | 307 (pre-existing redirect, M4 noted) |
| `/project/atlas-drift` | 200 |
| `POST /api/practices` `{action:list}` | 200, 188 items |

## Deleted routes verified 404
| Path | Status |
|---|---|
| `/api/action-room` | 404 |
| `/api/squad/files` | 404 |
| `/api/map-room/ip-vault` | 404 |
| `/api/map-room/prompts` | 404 |
| `/api/map-room/outputs` | 404 |
| `/api/map-room/metrics` | 404 |
| `/api/map-room/platform-rules` | 404 |

## MCP state preservation
`apex_get_briefing`:
- 6 active projects ✓
- 4 venture commitments lead `your_actions` (villas WhatsApp, Caliber CRM, Atlas Drift domain, Todd website) ✓
- 4 dormant agents + Ginge active ✓
- 4 blockers ✓
- 35 archived-snap T-3.7/T-4.5c/T-6.2 tasks still hidden (M5 bulk-block preserved) ✓

## Code changes summary
- 10 route files deleted
- 2 orphan src/ files deleted (`src/types.ts`, `src/lib/agent-runs.ts`)
- `/api/vault/route.ts` stripped of ip-* sub-actions + supporting types/helpers (~70 lines)
- `README.md` created (1 file, comprehensive)
- `data/magnificent-m6-route-deletions.md` saved
- `data/openclaw-decommission-2026-05-06.md` saved (manual action surface for Ginge)
- `data/magnificent-m6-notes.md` saved
- `data/magnificent-m6-verify-2026-05-06.md` saved (this file)

## Kill criteria — none fired
1. Unexpected callers on routes flagged for deletion: none ✓
2. Build failures after removal: none ✓
3. Production breaks after deploy: none ✓
4. README understanding gaps: none — known divergences explicitly listed ✓
5. OpenClaw destructive action without verification: skipped (gcloud unavailable), surfaced ✓
