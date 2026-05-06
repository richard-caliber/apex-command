# M3 Research — data hygiene + pipeline restoration (2026-05-06)

## Missing inputs

`data/apex-magnificent-sprint-plan.md` still absent on disk; ran from chat-pasted M3 deliverables.

## Pre-restore task-count audit (all 17 venture-track ideas)

All 17 projects have intact pipeline tasks. **Kill criterion #1 not triggered** — none at 0 tasks. Counts derived from `apex_list_tasks(project_id=X, limit=200)`.

| Project ID | Tasks | Stage (current) | Notes |
|---|---|---|---|
| storyquest | 16 | idea | inbox + idea sequence done; T-0.9 not_started |
| repostai | 129 | traffic | Worked through inbox/idea/validation/design/mvp/traffic; many T-4.* in_progress (continuous), T-5.* not_started |
| parliament | 16 | idea | inbox + idea sequence done; T-0.9 not_started |
| comic-creator | 16 | idea | inbox + idea sequence done; T-0.9 not_started |
| peptide-stack | 117 | mvp | Worked through to mvp; T-3.4 Build Core Product not_started, T-3.7 blocked "MVP not built yet" |
| villa-investor | 16 | idea | inbox + idea done; T-0.9 not_started |
| market-intel | 16 | idea | inbox + idea done; T-0.9 not_started |
| geopolitik | 16 | idea | inbox + idea done; T-0.9 not_started |
| promptcraft | 16 | idea | inbox + idea done; T-0.9 not_started |
| sales-copilot | 16 | idea | inbox + idea done; T-0.9 not_started |
| splashboard | 16 | idea | inbox + idea done; T-0.9 not_started |
| send-delete | 16 | idea | inbox + idea done; T-0.9 not_started |
| polymarket-bot | 16 | idea | inbox + idea done; T-0.9 not_started |
| ugc-network | 16 | idea | inbox + idea done; T-0.9 not_started |
| newsletter-factory | 16 | idea | inbox + idea done; T-0.9 not_started |
| youtube-channels | 16 | idea | inbox + idea done; T-0.9 not_started |
| tiktok-machine | 16 | idea | inbox + idea done; T-0.9 not_started |

## Restoration plan

For each of the 17:
- `status`: archived → paused
- `blocker`: strip the trailing `\nArchived 2026-05-05: Moved to ideas-vault parent` suffix; restore the original blocker text only
- `stage`: keep current value. 15 are already at `idea` (correct — Newton/Darwin completed the idea-stage sequence but didn't progress further). 2 are at later stages and the task data confirms they belong there:
  - `repostai` stays at `traffic` — it has substantial mvp/traffic in-progress work
  - `peptide-stack` stays at `mvp` — design is fully done, mvp build pending
- All other fields preserved (tags, score, description, image_url, owner, url, metrics, created_at).

## Pre-restore blocker text per project (post-strip target)

| ID | Restored blocker |
|---|---|
| storyquest | "Needs Stripe paywall + SFX + TTS" |
| repostai | "Needs Product Hunt launch + demo video" |
| parliament | "Low revenue potential — parked" |
| comic-creator | "Parked — creative project" |
| peptide-stack | "Depends on Caliber revenue path" |
| villa-investor | "Depends on villa sales" |
| market-intel | "Parked" |
| geopolitik | "Parked" |
| promptcraft | "Parked — scored 3/10" |
| sales-copilot | "Parked" |
| splashboard | "Parked" |
| send-delete | "Parked" |
| polymarket-bot | "Parked" |
| ugc-network | "Parked" |
| newsletter-factory | "Parked" |
| youtube-channels | "Parked" |
| tiktok-machine | "Parked" |

## Other M3 sweep — current state

- `ideas-vault` parent: status=archived, stage=archived, no blocker. 17 transition-scaffold MCP-MOSP* tasks live under it (created 2026-05-05). Will mark each `done` with cleanup-note prefix, then archive the parent.
- `personal` parent: status=active, stage=idea. 4 children (`personal-tv-script`, `personal-rms`, plus 2 placeholder MCP tasks under it). Creative track moves out to a practice; parent then archives.
- 4 creative-track projects to archive: `bracelet-quest`, `pokemon-fusion`, `personal-tv-script`, `personal-rms`. Their pipeline-task records stay in KV; only the project record moves to `archived`.
- Villas WhatsApp task `MCP-MOSPYL9A-uql3`: currently priority unset/medium per M2 verify; bump to `high`.
- Squad agents in `apex:squad:v4`: need `dormant: true` on atlas/newton/darwin/jimmy, `dormant: false` on ginge. M2 banner is hard-coded — will leave the hard-code as fallback (per spec) and add a small note.
- ID drift: `edgeauto` strings in code post-Phase 1. Need to grep src + scripts.
- Practice category casing: `apex_search_practices` to identify any `Best Practices` vs `best-practices` divergence.
- Stage enum: MCP `VALID_PROJECT_STAGES` already includes `archived`; legacy `/api/projects` `VALID_STAGES` still uses `[inbox, idea, validation, design, mvp, traffic, conversion, delivery, scale]`. Need to align — drop "inbox", add "archived".
