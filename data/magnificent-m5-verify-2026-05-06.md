# M5 Verification (2026-05-06)

## Production deploy
- Deployment ID: `dpl_DUig1dFxyTCzTyEABWeJ99irtfQW`
- URL: https://apex-command-d9efxry71-caliber1.vercel.app
- Aliased: https://apex-command-seven.vercel.app
- Status: READY, build 18s, deploy 38s

## Endpoint checks (production)
- `POST /api/practices` `{"action":"list"}` → 187 items, `lastUpdated=2026-05-06T10:49:17.172Z`
- `GET /schematics/ip-vault` → HTTP 200
- `GET /action-room` → HTTP 200

## MCP checks (canonical state preserved)
- `apex_get_briefing`:
  - 6 active projects ✓
  - 4 venture commitments lead `your_actions` (villas WhatsApp, Caliber CRM, Atlas Drift domain, Todd website) ✓
  - 4 dormant agents + Ginge active ✓
  - 4 blockers ✓
  - 35 archived-snap T-3.7/T-4.5c/T-6.2 tasks no longer in your_actions (M5 bulk-block applied) ✓
- `apex_list_projects`: 49 records (6 active / 19 paused / 24 archived) — unchanged ✓

## KV deletion
- `vault:ip-entries` deleted (877,577 bytes captured pre-deletion to `data/magnificent-m5-vault-ip-entries-deletion-2026-05-06.json`)
- IP Vault page now reads from `apex:practices:v1` via `/api/practices` (canonical store)
- M4-deferred deletion finalised

## Code changes
- New: `src/lib/practices.ts` (canonical reader for `apex:practices:v1`, mirrors `src/lib/projects.ts`/`tasks.ts` pattern)
- Modified: `src/app/api/practices/route.ts` — list/get/search now route through `src/lib/practices.ts`
- Rewritten: `src/app/schematics/ip-vault/page.tsx` — fetches from `/api/practices`, renders practice schema (id, category, title, content, tags, scope, source, dates), categories derived live from data, source-emoji updated to include all 5 squad members + "manual"
- Removed from page: project filter dropdown (practices have no project_id); add/edit form (writes go through MCP `apex_add_practice` / `apex_update_practice`)
- Build clean (`npm run build` ✓ 81/81 pages prerendered)

## MCP write changes applied (M5)
- 35 ginge-owned tasks under archived snap projects → `status=blocked` with "Project archived 2026-05-05 — task suspended (M5 cleanup)"
- 8 promotion tasks under edge-auto → blocker cleared (status=done preserved)
- 1 strategic-note task → status=done
- 1 duplicate `_template` task → status=done with "Duplicate of AH-001"
- 8 Tier-1 deprecated practices marked DEPRECATED with title prefix and content banner pointing to canonical successor (Mission Control v1+v2 → v3; Caliber pricing matrix v1 → v2; Caliber price list initial → -full; Thymosin v1 stub → 03-31; GHK-Cu deep-dive v1 → 04-02; GHK-Cu RB v1 → RB v2; Free LLM APIs 04-07 → 04-11)
- 1 workflow practice (Phase 7 sprint scope) updated to remove broken refs to never-created practices (manual-a26f790a, manual-a656c73b)

## Kill criteria — none fired
1. Bulk-handle threshold (>50 in one batch): MAX was 35 archived-snap blocks, under threshold ✓
2. Practices corruption: 1 missing title + 5 empty tags arrays found, surfaced to Ginge, NOT auto-fixed ✓
3. Workflow audit broken refs: 2 found (manual-a26f790a, manual-a656c73b) — both forward references never written, fixed by editing the referencing practice ✓
4. Production breaks: none ✓
5. MCP tool failures: 1 minor regression — `apex_set_task` defaults to `status=not_started` when status omitted; caused promotion-task done→not_started reset on first pass; immediately fixed by re-applying with status=done ✓

## Files written
- `data/magnificent-m5-task-review.md`
- `data/magnificent-m5-prompts-review.md`
- `data/magnificent-m5-prompts-raw.txt`
- `data/magnificent-m5-practices-review.md`
- `data/magnificent-m5-practices-raw.txt`
- `data/magnificent-m5-notes.md`
- `data/magnificent-m5-vault-ip-entries-deletion-2026-05-06.json`
- `data/magnificent-m5-verify-2026-05-06.md` (this file)
- `scripts/m5-prompts-inventory.mjs`
- `scripts/m5-practices-inventory.mjs`
- `scripts/m5-delete-vault-ip-entries.mjs`
- `src/lib/practices.ts`
- `src/app/schematics/ip-vault/page.tsx` (rewritten)
- `src/app/api/practices/route.ts` (refactored to use lib)
